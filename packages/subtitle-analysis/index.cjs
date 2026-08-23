const TURKISH_LOCALE = "tr-TR";
const MAX_QUERY_LENGTH = 200;
const MAX_TERMS = 12;
const MAX_GROUPS = 6;
const MAX_TERMS_PER_GROUP = 8;
const MAX_TOTAL_GROUP_TERMS = 32;
const MAX_CONTEXT_LENGTH = 360;
const CONTEXT_WORD_RADIUS = 24;
const RELATION_CONTEXT_PADDING = 18;
const RELATION_FRAGMENT_PADDING = 10;
const MATCH_MODES = new Set(["contains", "whole-word"]);
const PROXIMITY_UNITS = new Set(["words", "sentences", "video"]);
const DIRECTIONS = new Set(["any", "ordered"]);

function normalizeQuery(value) {
  const query = String(value ?? "").replace(/\s+/gu, " ").trim();
  if (!query) throw new Error("Aranacak kelime veya ifade gerekli.");
  if (query.length > MAX_QUERY_LENGTH) throw new Error(`Arama ifadesi en fazla ${MAX_QUERY_LENGTH} karakter olabilir.`);
  return query;
}

function fold(value) {
  return String(value ?? "").normalize("NFC").toLocaleLowerCase(TURKISH_LOCALE);
}

function normalizeTerms(values, options = {}) {
  if (!Array.isArray(values)) throw new Error("Aranacak terimler liste olarak verilmelidir.");
  const maxTerms = Number(options.maxTerms || MAX_TERMS);
  const allowEmpty = Boolean(options.allowEmpty);
  const terms = [];
  const seen = new Set();
  for (const value of values) {
    const raw = String(value ?? "").replace(/\s+/gu, " ").trim();
    if (!raw) continue;
    const term = normalizeQuery(raw);
    const key = fold(term);
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  if (!terms.length && !allowEmpty) throw new Error("En az bir kelime veya ifade ekle.");
  if (terms.length > maxTerms) throw new Error(`Bu alanda en fazla ${maxTerms} terim kullanılabilir.`);
  return terms;
}

function normalizeMatchMode(value) {
  const mode = String(value ?? "contains");
  if (!MATCH_MODES.has(mode)) throw new Error("Geçersiz eşleşme modu.");
  return mode;
}

function normalizeProximity(input = {}) {
  const unit = String(input.unit ?? "words");
  if (!PROXIMITY_UNITS.has(unit)) throw new Error("Geçersiz yakınlık birimi.");
  if (unit === "video") return { unit, distance: null };
  const defaultDistance = unit === "sentences" ? 1 : 25;
  const maxDistance = unit === "sentences" ? 10 : 500;
  const distance = Number.isFinite(Number(input.distance)) ? Math.trunc(Number(input.distance)) : defaultDistance;
  if (distance < 0 || distance > maxDistance) throw new Error(`Yakınlık mesafesi 0-${maxDistance} aralığında olmalıdır.`);
  return { unit, distance };
}

function normalizeDirection(value) {
  const direction = String(value ?? "any");
  if (!DIRECTIONS.has(direction)) throw new Error("Geçersiz ilişki yönü.");
  return direction;
}

function normalizeGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) throw new Error("İlişki grupları liste olarak verilmelidir.");
  if (rawGroups.length < 2) throw new Error("İlişki araması için en az iki kavram grubu gerekli.");
  if (rawGroups.length > MAX_GROUPS) throw new Error(`En fazla ${MAX_GROUPS} kavram grubu kullanılabilir.`);
  let totalTerms = 0;
  const groups = rawGroups.map((rawGroup, index) => {
    const terms = normalizeTerms(rawGroup?.terms, { maxTerms: MAX_TERMS_PER_GROUP });
    totalTerms += terms.length;
    const defaultLabel = `Grup ${String.fromCharCode(65 + index)}`;
    const label = String(rawGroup?.label ?? "").replace(/\s+/gu, " ").trim().slice(0, 80) || defaultLabel;
    const id = String(rawGroup?.id ?? "").trim().slice(0, 80) || `group-${index + 1}`;
    return { id, label, terms };
  });
  if (totalTerms > MAX_TOTAL_GROUP_TERMS) throw new Error(`Kavram gruplarında toplam en fazla ${MAX_TOTAL_GROUP_TERMS} terim kullanılabilir.`);
  return groups;
}

function normalizeTranscript(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/\n+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sentenceRanges(value) {
  const text = normalizeTranscript(value);
  if (!text) return [];
  if (typeof Intl?.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(TURKISH_LOCALE, { granularity: "sentence" });
    return [...segmenter.segment(text)]
      .map((entry) => {
        const segment = String(entry.segment ?? "");
        const leading = segment.length - segment.trimStart().length;
        const trailing = segment.length - segment.trimEnd().length;
        const start = Number(entry.index ?? 0) + leading;
        const end = Number(entry.index ?? 0) + segment.length - trailing;
        return { start, end, text: text.slice(start, end) };
      })
      .filter((entry) => entry.text);
  }
  const ranges = [];
  const regex = /[^.!?…]+(?:[.!?…]+["'”’\])}]*|$)/gu;
  let match;
  while ((match = regex.exec(text))) {
    const segment = String(match[0] ?? "");
    const leading = segment.length - segment.trimStart().length;
    const trailing = segment.length - segment.trimEnd().length;
    const start = Number(match.index) + leading;
    const end = Number(match.index) + segment.length - trailing;
    if (end > start) ranges.push({ start, end, text: text.slice(start, end) });
    if (!segment.length) break;
  }
  return ranges.length ? ranges : [{ start: 0, end: text.length, text }];
}

function sentenceSegments(value) {
  return sentenceRanges(value).map((entry) => entry.text);
}

function isWordCharacter(value) {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

// V3.1: "contains" is intentionally word-start/prefix matching. This keeps
// suffix variants such as rütbe/rütbesi/rütbeli, but "izin" no longer matches "sizin".
function literalMatchIndexes(value, rawQuery, rawMode = "contains") {
  const query = fold(normalizeQuery(rawQuery));
  const text = fold(value);
  const mode = normalizeMatchMode(rawMode);
  if (!text || !query) return [];
  const indexes = [];
  let offset = 0;
  while (offset <= text.length - query.length) {
    const index = text.indexOf(query, offset);
    if (index < 0) break;
    const before = index > 0 ? text[index - 1] : "";
    const after = index + query.length < text.length ? text[index + query.length] : "";
    const startBoundaryOk = !isWordCharacter(query[0]) || !isWordCharacter(before);
    const endBoundaryOk = !isWordCharacter(query[query.length - 1]) || !isWordCharacter(after);
    if (startBoundaryOk && (mode === "contains" || endBoundaryOk)) indexes.push(index);
    offset = index + Math.max(1, query.length);
  }
  return indexes;
}

function countLiteralOccurrences(value, rawQuery, rawMode = "contains") {
  return literalMatchIndexes(value, rawQuery, rawMode).length;
}

function wordRanges(value) {
  return [...String(value ?? "").matchAll(/\S+/gu)].map((match, index) => ({
    index,
    start: Number(match.index ?? 0),
    end: Number(match.index ?? 0) + String(match[0]).length,
  }));
}

function mergeRanges(ranges) {
  const ordered = ranges.map(([start, end]) => [Number(start), Number(end)]).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ordered) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1]);
    else merged.push(range);
  }
  return merged;
}

function longContextWindows(segment, query, matchMode) {
  const indexes = literalMatchIndexes(segment, query, matchMode);
  if (!indexes.length) return [];
  const words = wordRanges(segment);
  if (!words.length) {
    return indexes.map((index) => {
      const start = Math.max(0, index - 180);
      const end = Math.min(segment.length, index + normalizeQuery(query).length + 180);
      const context = `${start ? "… " : ""}${segment.slice(start, end).trim()}${end < segment.length ? " …" : ""}`;
      return { context, occurrenceCount: countLiteralOccurrences(context, query, matchMode), truncated: start > 0 || end < segment.length };
    });
  }
  const ranges = [];
  for (const index of indexes) {
    const matchEnd = index + fold(normalizeQuery(query)).length;
    let wordIndex = words.findIndex((word) => word.end > index && word.start < matchEnd);
    if (wordIndex < 0) wordIndex = words.findIndex((word) => word.start >= index);
    if (wordIndex < 0) wordIndex = words.length - 1;
    ranges.push([Math.max(0, wordIndex - CONTEXT_WORD_RADIUS), Math.min(words.length - 1, wordIndex + CONTEXT_WORD_RADIUS)]);
  }
  return mergeRanges(ranges).map(([startWord, endWord]) => {
    const start = words[startWord].start;
    const end = words[endWord].end;
    const context = `${startWord ? "… " : ""}${segment.slice(start, end).trim()}${endWord < words.length - 1 ? " …" : ""}`;
    return { context, occurrenceCount: countLiteralOccurrences(context, query, matchMode), truncated: startWord > 0 || endWord < words.length - 1 };
  });
}

function analyzeTranscript(value, rawQuery, rawMode = "contains") {
  const query = normalizeQuery(rawQuery);
  const matchMode = normalizeMatchMode(rawMode);
  const contexts = [];
  let occurrenceCount = 0;
  for (const sentence of sentenceSegments(value)) {
    const count = countLiteralOccurrences(sentence, query, matchMode);
    if (!count) continue;
    occurrenceCount += count;
    if (sentence.length <= MAX_CONTEXT_LENGTH) contexts.push({ context: sentence, occurrenceCount: count, truncated: false });
    else contexts.push(...longContextWindows(sentence, query, matchMode));
  }
  return { query, matchMode, occurrenceCount, contexts };
}

function analyzeTranscriptTerms(value, rawTerms, rawMode = "contains") {
  const terms = normalizeTerms(rawTerms);
  const matchMode = normalizeMatchMode(rawMode);
  return { terms, matchMode, matches: terms.map((term) => analyzeTranscript(value, term, matchMode)) };
}

function prepareDocument(value) {
  const text = normalizeTranscript(value);
  return { text, words: wordRanges(text), sentences: sentenceRanges(text) };
}

function containingRangeIndex(ranges, start, end) {
  let index = ranges.findIndex((range) => range.end > start && range.start < end);
  if (index < 0) index = ranges.findIndex((range) => range.start >= start);
  return index < 0 ? Math.max(0, ranges.length - 1) : index;
}

function locateTermMatches(document, rawTerm, rawMode = "contains") {
  const term = normalizeQuery(rawTerm);
  const matchMode = normalizeMatchMode(rawMode);
  const indexes = literalMatchIndexes(document.text, term, matchMode);
  return indexes.map((index) => {
    const end = index + fold(term).length;
    return {
      term,
      index,
      end,
      matchedText: document.text.slice(index, end),
      wordIndex: containingRangeIndex(document.words, index, end),
      sentenceIndex: containingRangeIndex(document.sentences, index, end),
    };
  });
}

function locateGroupMatches(document, group, groupIndex, matchMode) {
  const matches = [];
  for (const term of group.terms) {
    for (const match of locateTermMatches(document, term, matchMode)) matches.push({ ...match, groupIndex, groupId: group.id, groupLabel: group.label });
  }
  matches.sort((a, b) => a.index - b.index || a.end - b.end);
  return matches;
}

function relationDistance(matches, proximity) {
  if (!matches.length) return { distance: null, wordDistance: null, sentenceDistance: null };
  const wordIndexes = matches.map((match) => match.wordIndex).filter((value) => value >= 0);
  const sentenceIndexes = matches.map((match) => match.sentenceIndex).filter((value) => value >= 0);
  const wordDistance = wordIndexes.length ? Math.max(...wordIndexes) - Math.min(...wordIndexes) : null;
  const sentenceDistance = sentenceIndexes.length ? Math.max(...sentenceIndexes) - Math.min(...sentenceIndexes) : null;
  const distance = proximity.unit === "words" ? wordDistance : proximity.unit === "sentences" ? sentenceDistance : null;
  return { distance, wordDistance, sentenceDistance };
}

function relationQualifies(matches, proximity) {
  if (proximity.unit === "video") return true;
  const { distance } = relationDistance(matches, proximity);
  return distance !== null && distance <= proximity.distance;
}

function orderedWindows(groupMatches, proximity) {
  const windows = [];
  for (const first of groupMatches[0] || []) {
    const selected = [first];
    let previous = first;
    let complete = true;
    for (let groupIndex = 1; groupIndex < groupMatches.length; groupIndex += 1) {
      const candidate = groupMatches[groupIndex].find((match) => match.index > previous.index);
      if (!candidate) { complete = false; break; }
      selected.push(candidate);
      previous = candidate;
    }
    if (complete && relationQualifies(selected, proximity)) windows.push(selected);
  }
  return windows;
}

function unorderedWindows(groupMatches, proximity) {
  const flat = groupMatches.flat().sort((a, b) => a.index - b.index || a.groupIndex - b.groupIndex);
  const counts = Array.from({ length: groupMatches.length }, () => 0);
  const windows = [];
  let represented = 0;
  let left = 0;
  for (let right = 0; right < flat.length; right += 1) {
    if (counts[flat[right].groupIndex]++ === 0) represented += 1;
    while (represented === groupMatches.length && left <= right) {
      const candidate = flat.slice(left, right + 1);
      if (relationQualifies(candidate, proximity)) windows.push(candidate);
      const leftGroup = flat[left].groupIndex;
      counts[leftGroup] -= 1;
      if (counts[leftGroup] === 0) represented -= 1;
      left += 1;
    }
  }
  return windows;
}

function contextRangesForEvidence(document, matches, proximity) {
  if (!matches.length || !document.words.length) return [[0, document.text.length]];
  const wordIndexes = matches.map((match) => match.wordIndex).filter((value) => value >= 0);
  if (!wordIndexes.length) return [[Math.max(0, matches[0].index - 180), Math.min(document.text.length, matches[matches.length - 1].end + 180)]];
  const minWord = Math.min(...wordIndexes);
  const maxWord = Math.max(...wordIndexes);
  const span = maxWord - minWord;
  const contiguous = proximity.unit !== "video" || span <= CONTEXT_WORD_RADIUS * 3;
  if (contiguous) {
    const startWord = Math.max(0, minWord - RELATION_CONTEXT_PADDING);
    const endWord = Math.min(document.words.length - 1, maxWord + RELATION_CONTEXT_PADDING);
    return [[document.words[startWord].start, document.words[endWord].end]];
  }
  const snippets = matches.map((match) => {
    const startWord = Math.max(0, match.wordIndex - RELATION_FRAGMENT_PADDING);
    const endWord = Math.min(document.words.length - 1, match.wordIndex + RELATION_FRAGMENT_PADDING);
    return [document.words[startWord].start, document.words[endWord].end];
  });
  return mergeRanges(snippets);
}

function buildEvidenceContext(document, ranges) {
  const fragments = ranges.map(([start, end]) => `${start > 0 ? "… " : ""}${document.text.slice(start, end).trim()}${end < document.text.length ? " …" : ""}`);
  return { context: fragments.join("  […]  "), truncated: ranges.length > 1 || ranges[0]?.[0] > 0 || ranges[0]?.[1] < document.text.length };
}

function rangeContainsMatch(ranges, match) {
  return ranges.some(([start, end]) => match.index < end && match.end > start);
}

function matchKey(match) {
  return `${match.groupIndex}:${match.index}:${match.end}:${fold(match.term)}`;
}

function uniqueMatches(matches) {
  const seen = new Set();
  const output = [];
  for (const match of matches) {
    const key = matchKey(match);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(match);
  }
  return output.sort((a, b) => a.index - b.index || a.groupIndex - b.groupIndex);
}

function rawEvidenceCandidates(document, groupMatches, config, excludeMatches) {
  if (groupMatches.some((matches) => !matches.length)) return [];
  const rawWindows = config.direction === "ordered" ? orderedWindows(groupMatches, config.proximity) : unorderedWindows(groupMatches, config.proximity);
  const candidates = [];
  const seen = new Set();
  for (const rawMatches of rawWindows) {
    const matches = uniqueMatches(rawMatches);
    const coreStart = Math.min(...matches.map((match) => match.index));
    const coreEnd = Math.max(...matches.map((match) => match.end));
    const key = `${coreStart}:${coreEnd}:${matches.map(matchKey).join("|")}`;
    if (seen.has(key)) continue;
    const ranges = contextRangesForEvidence(document, matches, config.proximity);
    if (excludeMatches.some((match) => rangeContainsMatch(ranges, match))) continue;
    seen.add(key);
    candidates.push({ matches, coreStart, coreEnd, ...relationDistance(matches, config.proximity) });
  }
  return candidates.sort((a, b) => a.coreStart - b.coreStart || a.coreEnd - b.coreEnd);
}

function clusterCandidates(candidates) {
  const clusters = [];
  for (const candidate of candidates) {
    const previous = clusters[clusters.length - 1];
    if (previous && candidate.coreStart <= previous.coreEnd) {
      previous.candidates.push(candidate);
      previous.coreEnd = Math.max(previous.coreEnd, candidate.coreEnd);
    } else {
      clusters.push({ coreStart: candidate.coreStart, coreEnd: candidate.coreEnd, candidates: [candidate] });
    }
  }
  return clusters;
}

function minFinite(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return finite.length ? Math.min(...finite) : null;
}

function buildEvidenceFromMatches(document, groups, groupMatches, config, excludeMatches) {
  const clusters = clusterCandidates(rawEvidenceCandidates(document, groupMatches, config, excludeMatches));
  return clusters.map((cluster) => {
    const matches = uniqueMatches(cluster.candidates.flatMap((candidate) => candidate.matches));
    const ranges = contextRangesForEvidence(document, matches, config.proximity);
    const context = buildEvidenceContext(document, ranges);
    const span = relationDistance(matches, config.proximity);
    const tokenPairCount = cluster.candidates.length;
    return {
      ...context,
      distance: minFinite(cluster.candidates.map((candidate) => candidate.distance)),
      wordDistance: minFinite(cluster.candidates.map((candidate) => candidate.wordDistance)),
      sentenceDistance: minFinite(cluster.candidates.map((candidate) => candidate.sentenceDistance)),
      spanWordDistance: span.wordDistance,
      spanSentenceDistance: span.sentenceDistance,
      tokenPairCount,
      token_pair_count: tokenPairCount,
      matches: matches.map((match) => ({
        groupIndex: match.groupIndex,
        groupId: match.groupId,
        groupLabel: match.groupLabel,
        term: match.term,
        matchedText: match.matchedText,
        wordIndex: match.wordIndex,
        sentenceIndex: match.sentenceIndex,
      })),
    };
  });
}

function analyzeRelationshipDocument(value, rawGroups, options = {}) {
  const groups = normalizeGroups(rawGroups);
  const matchMode = normalizeMatchMode(options.matchMode);
  const proximity = normalizeProximity(options.proximity);
  const direction = normalizeDirection(options.direction);
  const excludeTerms = normalizeTerms(options.excludeTerms ?? [], { maxTerms: MAX_TERMS, allowEmpty: true });
  const document = prepareDocument(value);
  const config = { matchMode, proximity, direction };
  if (!document.text) {
    return { groups, excludeTerms, matchMode, proximity, direction, evidence: [], relationClusters: 0, tokenPairCount: 0, groupOccurrences: groups.map(() => 0), pairCounts: groups.map(() => groups.map(() => 0)) };
  }
  const groupMatches = groups.map((group, index) => locateGroupMatches(document, group, index, matchMode));
  const groupOccurrences = groupMatches.map((matches) => matches.length);
  const excludeMatches = excludeTerms.flatMap((term) => locateTermMatches(document, term, matchMode));
  const evidence = buildEvidenceFromMatches(document, groups, groupMatches, config, excludeMatches);
  const pairCounts = groups.map(() => groups.map(() => 0));
  for (let index = 0; index < groups.length; index += 1) pairCounts[index][index] = groupOccurrences[index];
  for (let left = 0; left < groups.length; left += 1) {
    for (let right = left + 1; right < groups.length; right += 1) {
      const pairGroups = [groups[left], groups[right]];
      const pairMatches = [groupMatches[left].map((match) => ({ ...match, groupIndex: 0 })), groupMatches[right].map((match) => ({ ...match, groupIndex: 1 }))];
      const count = buildEvidenceFromMatches(document, pairGroups, pairMatches, config, excludeMatches).length;
      pairCounts[left][right] = count;
      pairCounts[right][left] = count;
    }
  }
  return {
    groups, excludeTerms, matchMode, proximity, direction, evidence,
    relationClusters: evidence.length,
    tokenPairCount: evidence.reduce((total, entry) => total + Number(entry.tokenPairCount || 0), 0),
    groupOccurrences, pairCounts,
  };
}

function findRelationshipEvidence(value, rawGroups, options = {}) {
  return analyzeRelationshipDocument(value, rawGroups, options);
}

module.exports = {
  CONTEXT_WORD_RADIUS, DIRECTIONS, MATCH_MODES, MAX_CONTEXT_LENGTH, MAX_GROUPS, MAX_QUERY_LENGTH, MAX_TERMS,
  MAX_TERMS_PER_GROUP, MAX_TOTAL_GROUP_TERMS, PROXIMITY_UNITS, analyzeTranscript, analyzeTranscriptTerms,
  analyzeRelationshipDocument, countLiteralOccurrences, findRelationshipEvidence, fold, literalMatchIndexes,
  locateTermMatches, normalizeDirection, normalizeGroups, normalizeMatchMode, normalizeProximity, normalizeQuery,
  normalizeTerms, normalizeTranscript, prepareDocument, relationDistance, sentenceRanges, sentenceSegments, wordRanges,
};
