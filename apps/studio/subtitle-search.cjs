const analysis = require("../../packages/subtitle-analysis/index.cjs");
const transcriptStore = require("./transcript-store.cjs");
const catalogStore = require("./youtube-catalog-store.cjs");

const SEARCH_MODES = new Set(["independent", "all-in-video"]);
const SORT_MODES = new Set(["date", "occurrences", "distance"]);
const SEARCH_TYPES = new Set(["terms", "relationship"]);

function normalizeSearchMode(value) {
  const mode = String(value ?? "independent");
  if (!SEARCH_MODES.has(mode)) throw new Error("Geçersiz çoklu arama modu.");
  return mode;
}
function normalizeSortMode(value) {
  const mode = String(value ?? "date");
  if (!SORT_MODES.has(mode)) throw new Error("Geçersiz sıralama modu.");
  return mode;
}
function normalizeSearchType(value) {
  const type = String(value ?? "terms");
  if (!SEARCH_TYPES.has(type)) throw new Error("Geçersiz altyazı araştırma türü.");
  return type;
}
function normalizeDate(value, label) {
  const date = String(value ?? "").trim();
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) throw new Error(`${label} YYYY-AA-GG biçiminde olmalıdır.`);
  return date;
}
function normalizeDateRange(input = {}) {
  const dateFrom = normalizeDate(input.dateFrom, "Başlangıç tarihi");
  const dateTo = normalizeDate(input.dateTo, "Bitiş tarihi");
  if (dateFrom && dateTo && dateFrom > dateTo) throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
  return { dateFrom, dateTo };
}

function transcriptRows(db, input = {}) {
  transcriptStore.ensureSchema(db);
  catalogStore.ensureSchema(db);
  const options = typeof input === "string" ? { channelId: input } : input;
  const channelId = String(options.channelId ?? "").trim();
  const { dateFrom, dateTo } = normalizeDateRange(options);
  const conditions = ["st.provider = 'youtube'"];
  const params = [];
  if (channelId) { conditions.push("yv.channel_id = ?"); params.push(channelId); }
  if (dateFrom) { conditions.push("yv.published_at <> '' AND yv.published_at >= ?"); params.push(dateFrom); }
  if (dateTo) { conditions.push("yv.published_at <> '' AND yv.published_at <= ?"); params.push(dateTo); }
  return db.prepare(`
    SELECT st.external_id AS videoId, st.language, st.text,
           yv.channel_id AS channelId, yv.title, yv.published_at AS publishedAt,
           yv.canonical_url AS url, COALESCE(yc.title, '') AS channelTitle
    FROM source_transcripts st
    JOIN youtube_videos yv ON yv.video_id = st.external_id
    LEFT JOIN youtube_channels yc ON yc.id = yv.channel_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY CASE WHEN yv.published_at = '' THEN 1 ELSE 0 END,
             yv.published_at DESC, yv.title COLLATE NOCASE
  `).all(...params);
}

function sortResults(results, sortMode) {
  results.sort((left, right) => {
    if (sortMode === "occurrences" && left.occurrenceCount !== right.occurrenceCount) return right.occurrenceCount - left.occurrenceCount;
    const byDate = String(right.publishedAt).localeCompare(String(left.publishedAt));
    if (byDate) return byDate;
    if (sortMode === "date" && left.occurrenceCount !== right.occurrenceCount) return right.occurrenceCount - left.occurrenceCount;
    return String(left.title).localeCompare(String(right.title), "tr");
  });
  return results;
}
function sortRelationshipResults(results, sortMode) {
  results.sort((left, right) => {
    if (sortMode === "distance") {
      const leftDistance = left.bestDistance == null ? Number.POSITIVE_INFINITY : left.bestDistance;
      const rightDistance = right.bestDistance == null ? Number.POSITIVE_INFINITY : right.bestDistance;
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    }
    if (sortMode === "occurrences" && left.relationCount !== right.relationCount) return right.relationCount - left.relationCount;
    const byDate = String(right.publishedAt).localeCompare(String(left.publishedAt));
    if (byDate) return byDate;
    if (left.relationCount !== right.relationCount) return right.relationCount - left.relationCount;
    return String(left.title).localeCompare(String(right.title), "tr");
  });
  return results;
}

function termStatsForResults(terms, results) {
  return terms.map((term) => {
    let occurrenceCount = 0;
    let videoCount = 0;
    for (const video of results) {
      const match = video.terms.find((entry) => analysis.fold(entry.term) === analysis.fold(term));
      if (!match) continue;
      occurrenceCount += match.occurrenceCount;
      videoCount += 1;
    }
    return { term, videoCount, occurrenceCount };
  });
}

function searchTranscripts(db, input = {}) {
  const terms = analysis.normalizeTerms(input.terms);
  const matchMode = analysis.normalizeMatchMode(input.matchMode);
  const searchMode = normalizeSearchMode(input.searchMode);
  const sort = normalizeSortMode(input.sort);
  const channelId = String(input.channelId ?? "").trim();
  const { dateFrom, dateTo } = normalizeDateRange(input);
  const rows = transcriptRows(db, { channelId, dateFrom, dateTo });
  const results = [];
  for (const row of rows) {
    const analyzed = analysis.analyzeTranscriptTerms(row.text, terms, matchMode);
    const matched = analyzed.matches.filter((entry) => entry.occurrenceCount > 0);
    const include = searchMode === "all-in-video" ? matched.length === terms.length : matched.length > 0;
    if (!include) continue;
    const videoTerms = matched.map((entry) => ({ term: entry.query, occurrenceCount: entry.occurrenceCount, contexts: entry.contexts }));
    const occurrenceCount = videoTerms.reduce((total, entry) => total + entry.occurrenceCount, 0);
    results.push({
      videoId: String(row.videoId), channelId: String(row.channelId), channelTitle: String(row.channelTitle ?? ""),
      title: String(row.title ?? ""), publishedAt: String(row.publishedAt ?? ""), url: String(row.url ?? ""), language: String(row.language ?? ""),
      occurrenceCount, matchedTermCount: videoTerms.length, terms: videoTerms,
    });
  }
  sortResults(results, sort === "distance" ? "date" : sort);
  const termStats = termStatsForResults(terms, results);
  const totalOccurrences = results.reduce((total, video) => total + video.occurrenceCount, 0);
  return {
    searchType: "terms", generatedAt: new Date().toISOString(), terms, matchMode, searchMode, sort: sort === "distance" ? "date" : sort,
    channelId, dateFrom, dateTo, transcriptCount: rows.length, videoCount: results.length, totalOccurrences, termStats, results,
  };
}

function median(values) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}
function sumMatrix(target, source) {
  for (let row = 0; row < target.length; row += 1) {
    for (let column = 0; column < target[row].length; column += 1) target[row][column] += Number(source?.[row]?.[column] || 0);
  }
}
function relationshipGroupStats(groups, results) {
  return groups.map((group, groupIndex) => {
    let videoCount = 0;
    let occurrenceCount = 0;
    let evidenceMatchCount = 0;
    for (const video of results) {
      const count = Number(video.groupOccurrences?.[groupIndex] || 0);
      if (count) videoCount += 1;
      occurrenceCount += count;
      for (const evidence of video.evidence || []) evidenceMatchCount += (evidence.matches || []).filter((match) => match.groupIndex === groupIndex).length;
    }
    return { id: group.id, label: group.label, terms: group.terms, videoCount, occurrenceCount, evidenceMatchCount };
  });
}

function searchRelationships(db, input = {}) {
  const groups = analysis.normalizeGroups(input.groups);
  const excludeTerms = analysis.normalizeTerms(input.excludeTerms ?? [], { maxTerms: analysis.MAX_TERMS, allowEmpty: true });
  const matchMode = analysis.normalizeMatchMode(input.matchMode);
  const proximity = analysis.normalizeProximity(input.proximity);
  const direction = analysis.normalizeDirection(input.direction);
  const sort = normalizeSortMode(input.sort);
  const channelId = String(input.channelId ?? "").trim();
  const { dateFrom, dateTo } = normalizeDateRange(input);
  const rows = transcriptRows(db, { channelId, dateFrom, dateTo });
  const results = [];
  const matrix = groups.map(() => groups.map(() => 0));
  const allDistances = [];
  let tokenPairCount = 0;

  for (const row of rows) {
    const relation = analysis.analyzeRelationshipDocument(row.text, groups, { matchMode, proximity, direction, excludeTerms });
    if (!relation.evidence.length) continue;
    // V3.1: every matrix cell now uses the same population: videos that satisfy
    // the complete relationship query. No global diagonal mixed with result-only pairs.
    sumMatrix(matrix, relation.pairCounts);
    const distances = relation.evidence.map((entry) => entry.distance).filter((value) => Number.isFinite(value));
    allDistances.push(...distances);
    tokenPairCount += Number(relation.tokenPairCount || 0);
    results.push({
      videoId: String(row.videoId), channelId: String(row.channelId), channelTitle: String(row.channelTitle ?? ""),
      title: String(row.title ?? ""), publishedAt: String(row.publishedAt ?? ""), url: String(row.url ?? ""), language: String(row.language ?? ""),
      relationCount: relation.evidence.length,
      relationClusters: relation.evidence.length,
      relation_clusters: relation.evidence.length,
      tokenPairCount: Number(relation.tokenPairCount || 0),
      token_pair_count: Number(relation.tokenPairCount || 0),
      bestDistance: distances.length ? Math.min(...distances) : null,
      groupOccurrences: relation.groupOccurrences,
      evidence: relation.evidence.map((entry) => ({ ...entry, token_pair_count: Number(entry.tokenPairCount || 0) })),
    });
  }

  sortRelationshipResults(results, sort);
  const relationCount = results.reduce((total, video) => total + video.relationCount, 0);
  const groupStats = relationshipGroupStats(groups, results);
  return {
    searchType: "relationship", generatedAt: new Date().toISOString(), groups, excludeTerms, matchMode, proximity, direction, sort,
    channelId, dateFrom, dateTo, transcriptCount: rows.length, videoCount: results.length,
    relationCount,
    relationClusters: relationCount,
    relation_clusters: relationCount,
    tokenPairCount,
    token_pair_count: tokenPairCount,
    minDistance: allDistances.length ? Math.min(...allDistances) : null,
    medianDistance: median(allDistances), groupStats,
    matrix: { labels: groups.map((group) => group.label), values: matrix }, results,
  };
}

function markdownEscape(value) { return String(value ?? "").replace(/\|/gu, "\\|").replace(/\r?\n/gu, " "); }
function searchModeLabel(value) { return value === "all-in-video" ? "Aynı videoda tüm terimler" : "Bağımsız terimler"; }
function matchModeLabel(value) { return value === "whole-word" ? "Tam kelime/ifade" : "Kelime başlangıcı / ekli kullanım"; }
function proximityLabel(proximity) {
  if (proximity?.unit === "video") return "Aynı video";
  if (proximity?.unit === "sentences") return `±${Number(proximity?.distance || 0)} cümle`;
  return `±${Number(proximity?.distance || 0)} kelime`;
}
function directionLabel(direction) { return direction === "ordered" ? "Grup sırası korunmalı (A → B → …)" : "Yön serbest"; }
function distanceLabel(value, proximity) {
  if (value == null || proximity?.unit === "video") return "aynı video";
  return `${value} ${proximity?.unit === "sentences" ? "cümle" : "kelime"}`;
}
function compactEvidenceMatches(matches) {
  const order = [];
  const counts = new Map();
  for (const match of matches || []) {
    const key = `${match.groupIndex}:${analysis.fold(match.term)}`;
    if (!counts.has(key)) order.push(key);
    const current = counts.get(key) || { label: match.groupLabel, term: match.term, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return order.map((key) => {
    const item = counts.get(key);
    return `${item.label}=${item.term}${item.count > 1 ? ` ×${item.count}` : ""}`;
  }).join(" | ");
}

function renderTermMarkdownReport(report) {
  const terms = analysis.normalizeTerms(report?.terms);
  const lines = [
    "# Channel Foundry — Altyazı Arama Raporu", "", `- Oluşturma: ${String(report?.generatedAt || new Date().toISOString())}`,
    `- Terimler: ${terms.join(", ")}`, `- Arama modu: ${searchModeLabel(report?.searchMode)}`, `- Eşleşme modu: ${matchModeLabel(report?.matchMode)}`,
    `- Tarih aralığı: ${report?.dateFrom || "başlangıç"} → ${report?.dateTo || "bugün"}`, `- Taranan altyazı: ${Number(report?.transcriptCount || 0)}`,
    `- Eşleşen video: ${Number(report?.videoCount || 0)}`, `- Toplam kullanım: ${Number(report?.totalOccurrences || 0)}`,
    "", "## Terim Özeti", "", "| Terim | Video | Kullanım |", "| --- | ---: | ---: |",
  ];
  const stats = Array.isArray(report?.termStats) ? report.termStats : [];
  for (const term of terms) {
    const stat = stats.find((entry) => analysis.fold(entry?.term) === analysis.fold(term));
    lines.push(`| ${markdownEscape(term)} | ${Number(stat?.videoCount || 0)} | ${Number(stat?.occurrenceCount || 0)} |`);
  }
  for (const [videoIndex, video] of (report?.results || []).entries()) {
    lines.push("", `## VIDEO ${String(videoIndex + 1).padStart(3, "0")}`, "", `- Başlık: ${markdownEscape(video?.title)}`,
      `- Tarih: ${markdownEscape(video?.publishedAt || "—")}`, `- Kanal: ${markdownEscape(video?.channelTitle || video?.channelId || "—")}`,
      `- Video ID: ${markdownEscape(video?.videoId)}`, `- URL: ${markdownEscape(video?.url)}`, `- Toplam kullanım: ${Number(video?.occurrenceCount || 0)}`);
    for (const termResult of video?.terms || []) {
      lines.push("", `### ${markdownEscape(termResult?.term)} — ${Number(termResult?.occurrenceCount || 0)} kullanım`, "");
      (termResult?.contexts || []).forEach((context, index) => {
        const suffix = context?.truncated ? " _(bağlam penceresi)_" : "";
        const repeated = Number(context?.occurrenceCount || 0) > 1 ? ` [${Number(context.occurrenceCount)} kullanım]` : "";
        lines.push(`${index + 1}. ${String(context?.context || "").trim()}${repeated}${suffix}`);
      });
    }
  }
  return `${lines.join("\n").trim()}\n`;
}

function renderRelationshipMarkdownReport(report) {
  const groups = analysis.normalizeGroups(report?.groups);
  const lines = [
    "# Channel Foundry — Altyazı İlişki Raporu", "", `- Oluşturma: ${String(report?.generatedAt || new Date().toISOString())}`,
    `- Yakınlık: ${proximityLabel(report?.proximity)}`, `- Yön: ${directionLabel(report?.direction)}`, `- Eşleşme modu: ${matchModeLabel(report?.matchMode)}`,
    `- Hariç tut: ${(report?.excludeTerms || []).join(", ") || "—"}`, `- Tarih aralığı: ${report?.dateFrom || "başlangıç"} → ${report?.dateTo || "bugün"}`,
    `- Taranan altyazı: ${Number(report?.transcriptCount || 0)}`, `- Eşleşen video: ${Number(report?.videoCount || 0)}`,
    `- Bağımsız ilişki kümesi: ${Number(report?.relation_clusters ?? report?.relationCount ?? 0)}`,
    `- Ham yakınlık eşleşmesi: ${Number(report?.token_pair_count ?? 0)}`,
    `- En yakın ilişki: ${distanceLabel(report?.minDistance, report?.proximity)}`,
    `- Medyan mesafe: ${distanceLabel(report?.medianDistance, report?.proximity)}`, "", "## Kavram Grupları", "",
  ];
  groups.forEach((group, index) => lines.push(`- Grup ${index + 1} — **${markdownEscape(group.label)}**: ${group.terms.map(markdownEscape).join(" | ")}`));
  lines.push("", "## Grup Özeti", "", "| Grup | Video | Kullanım | İlişki içi eşleşme |", "| --- | ---: | ---: | ---: |");
  for (const stat of report?.groupStats || []) lines.push(`| ${markdownEscape(stat.label)} | ${Number(stat.videoCount || 0)} | ${Number(stat.occurrenceCount || 0)} | ${Number(stat.evidenceMatchCount || 0)} |`);
  const labels = report?.matrix?.labels || [];
  const values = report?.matrix?.values || [];
  if (labels.length) {
    lines.push("", "## Yakınlık Matrisi", "", `| | ${labels.map(markdownEscape).join(" | ")} |`, `| --- | ${labels.map(() => "---:").join(" | ")} |`);
    labels.forEach((label, row) => lines.push(`| ${markdownEscape(label)} | ${(values[row] || []).map((value) => Number(value || 0)).join(" | ")} |`));
    lines.push("", "_Tüm hücreler yalnız ilişki sonucu bulunan videolardan hesaplanır. Köşegen bu sonuç kümesindeki grup kullanımını; diğer hücreler seçilen yakınlık koşulundaki bağımsız ikili ilişki kümelerini gösterir._");
  }
  for (const [videoIndex, video] of (report?.results || []).entries()) {
    lines.push("", `## VIDEO ${String(videoIndex + 1).padStart(3, "0")}`, "", `- Başlık: ${markdownEscape(video?.title)}`,
      `- Tarih: ${markdownEscape(video?.publishedAt || "—")}`, `- Kanal: ${markdownEscape(video?.channelTitle || video?.channelId || "—")}`,
      `- Video ID: ${markdownEscape(video?.videoId)}`, `- URL: ${markdownEscape(video?.url)}`,
      `- İlişki kümesi: ${Number(video?.relation_clusters ?? video?.relationCount ?? 0)}`,
      `- Ham yakınlık eşleşmesi: ${Number(video?.token_pair_count ?? 0)}`,
      `- En yakın: ${distanceLabel(video?.bestDistance, report?.proximity)}`);
    (video?.evidence || []).forEach((evidence, evidenceIndex) => {
      const matched = compactEvidenceMatches(evidence?.matches || []);
      lines.push("", `### RELATION CLUSTER ${String(evidenceIndex + 1).padStart(3, "0")} · en yakın ${distanceLabel(evidence?.distance, report?.proximity)}`, "",
        `- Eşleşen: ${markdownEscape(matched)}`,
        `- Ham yakınlık eşleşmesi: ${Number(evidence?.token_pair_count ?? evidence?.tokenPairCount ?? 0)}`,
        `- En yakın kelime mesafesi: ${evidence?.wordDistance ?? "—"}`,
        `- Küme kapsamı (kelime): ${evidence?.spanWordDistance ?? "—"}`,
        `- En yakın cümle mesafesi: ${evidence?.sentenceDistance ?? "—"}`,
        `- Küme kapsamı (cümle): ${evidence?.spanSentenceDistance ?? "—"}`, "", `> ${String(evidence?.context || "").trim().replace(/\n/gu, " ")}`);
    });
  }
  return `${lines.join("\n").trim()}\n`;
}

function renderMarkdownReport(report) { return report?.searchType === "relationship" ? renderRelationshipMarkdownReport(report) : renderTermMarkdownReport(report); }
function slugify(value) {
  return String(value ?? "").toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/gu, "c").replace(/[ğĞ]/gu, "g").replace(/[ıİiI]/gu, "i").replace(/[öÖ]/gu, "o").replace(/[şŞ]/gu, "s").replace(/[üÜ]/gu, "u")
    .normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 72) || "arama";
}
function reportFilename(report, extension = "md") {
  const date = String(report?.generatedAt || new Date().toISOString()).slice(0, 10);
  if (report?.searchType === "relationship") {
    const labels = (report?.groups || []).slice(0, 4).map((group) => group?.label || group?.terms?.[0] || "grup");
    return `subtitle-relation-${slugify(labels.join("-"))}-${date}.${extension}`;
  }
  const terms = analysis.normalizeTerms(report?.terms);
  return `subtitle-search-${slugify(terms.slice(0, 4).join("-"))}-${date}.${extension}`;
}
function runSearch(db, input = {}) {
  const searchType = normalizeSearchType(input.searchType);
  const report = searchType === "relationship" ? searchRelationships(db, input) : searchTranscripts(db, input);
  return { ...report, markdown: renderMarkdownReport(report), filename: reportFilename(report, "md"), jsonFilename: reportFilename(report, "json") };
}

module.exports = {
  SEARCH_MODES, SEARCH_TYPES, SORT_MODES, directionLabel, distanceLabel, matchModeLabel, normalizeDateRange, normalizeSearchMode,
  normalizeSearchType, normalizeSortMode, proximityLabel, renderMarkdownReport, reportFilename, runSearch, searchModeLabel,
  searchRelationships, searchTranscripts, sortRelationshipResults, sortResults, termStatsForResults, transcriptRows,
};
