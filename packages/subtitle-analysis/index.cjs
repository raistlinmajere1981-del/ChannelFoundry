const TURKISH_LOCALE = "tr-TR";
const MAX_QUERY_LENGTH = 200;
const MAX_TERMS = 12;
const MAX_CONTEXT_LENGTH = 360;
const CONTEXT_WORD_RADIUS = 24;
const MATCH_MODES = new Set(["contains", "whole-word"]);

function normalizeQuery(value) {
  const query = String(value ?? "").replace(/\s+/gu, " ").trim();
  if (!query) throw new Error("Aranacak kelime veya ifade gerekli.");
  if (query.length > MAX_QUERY_LENGTH) throw new Error(`Arama ifadesi en fazla ${MAX_QUERY_LENGTH} karakter olabilir.`);
  return query;
}

function fold(value) {
  return String(value ?? "").normalize("NFC").toLocaleLowerCase(TURKISH_LOCALE);
}

function normalizeTerms(values) {
  if (!Array.isArray(values)) throw new Error("Aranacak terimler liste olarak verilmelidir.");
  const terms = [];
  const seen = new Set();
  for (const value of values) {
    const term = normalizeQuery(value);
    const key = fold(term);
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
  }
  if (!terms.length) throw new Error("En az bir kelime veya ifade ekle.");
  if (terms.length > MAX_TERMS) throw new Error(`Tek raporda en fazla ${MAX_TERMS} terim aranabilir.`);
  return terms;
}

function normalizeMatchMode(value) {
  const mode = String(value ?? "contains");
  if (!MATCH_MODES.has(mode)) throw new Error("Geçersiz eşleşme modu.");
  return mode;
}

function normalizeTranscript(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/\n+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function sentenceSegments(value) {
  const text = normalizeTranscript(value);
  if (!text) return [];
  if (typeof Intl?.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(TURKISH_LOCALE, { granularity: "sentence" });
    return [...segmenter.segment(text)]
      .map((entry) => String(entry.segment ?? "").trim())
      .filter(Boolean);
  }
  return (text.match(/[^.!?…]+(?:[.!?…]+["'”’\])}]*|$)/gu) ?? [text])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isWordCharacter(value) {
  return Boolean(value && /[\p{L}\p{N}_]/u.test(value));
}

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
    if (mode === "contains" || (startBoundaryOk && endBoundaryOk)) indexes.push(index);
    offset = index + Math.max(1, query.length);
  }
  return indexes;
}

function countLiteralOccurrences(value, rawQuery, rawMode = "contains") {
  return literalMatchIndexes(value, rawQuery, rawMode).length;
}

function wordRanges(value) {
  return [...String(value ?? "").matchAll(/\S+/gu)].map((match) => ({
    start: Number(match.index ?? 0),
    end: Number(match.index ?? 0) + String(match[0]).length,
  }));
}

function mergeRanges(ranges) {
  const ordered = ranges
    .map(([start, end]) => [Number(start), Number(end)])
    .sort((left, right) => left[0] - right[0]);
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
    ranges.push([
      Math.max(0, wordIndex - CONTEXT_WORD_RADIUS),
      Math.min(words.length - 1, wordIndex + CONTEXT_WORD_RADIUS),
    ]);
  }

  return mergeRanges(ranges).map(([startWord, endWord]) => {
    const start = words[startWord].start;
    const end = words[endWord].end;
    const context = `${startWord ? "… " : ""}${segment.slice(start, end).trim()}${endWord < words.length - 1 ? " …" : ""}`;
    return {
      context,
      occurrenceCount: countLiteralOccurrences(context, query, matchMode),
      truncated: startWord > 0 || endWord < words.length - 1,
    };
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
    if (sentence.length <= MAX_CONTEXT_LENGTH) {
      contexts.push({ context: sentence, occurrenceCount: count, truncated: false });
      continue;
    }
    contexts.push(...longContextWindows(sentence, query, matchMode));
  }

  return { query, matchMode, occurrenceCount, contexts };
}

function analyzeTranscriptTerms(value, rawTerms, rawMode = "contains") {
  const terms = normalizeTerms(rawTerms);
  const matchMode = normalizeMatchMode(rawMode);
  return {
    terms,
    matchMode,
    matches: terms.map((term) => analyzeTranscript(value, term, matchMode)),
  };
}

module.exports = {
  CONTEXT_WORD_RADIUS,
  MATCH_MODES,
  MAX_CONTEXT_LENGTH,
  MAX_QUERY_LENGTH,
  MAX_TERMS,
  analyzeTranscript,
  analyzeTranscriptTerms,
  countLiteralOccurrences,
  fold,
  literalMatchIndexes,
  normalizeMatchMode,
  normalizeQuery,
  normalizeTerms,
  normalizeTranscript,
  sentenceSegments,
};
