const analysis = require("../../packages/subtitle-analysis/index.cjs");
const transcriptStore = require("./transcript-store.cjs");
const catalogStore = require("./youtube-catalog-store.cjs");

const SEARCH_MODES = new Set(["independent", "all-in-video"]);
const SORT_MODES = new Set(["date", "occurrences"]);

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

function transcriptRows(db, channelId) {
  transcriptStore.ensureSchema(db);
  catalogStore.ensureSchema(db);
  const filter = channelId ? "AND yv.channel_id = ?" : "";
  return db.prepare(`
    SELECT st.external_id AS videoId, st.language, st.text,
           yv.channel_id AS channelId, yv.title, yv.published_at AS publishedAt,
           yv.canonical_url AS url, COALESCE(yc.title, '') AS channelTitle
    FROM source_transcripts st
    JOIN youtube_videos yv ON yv.video_id = st.external_id
    LEFT JOIN youtube_channels yc ON yc.id = yv.channel_id
    WHERE st.provider = 'youtube' ${filter}
    ORDER BY CASE WHEN yv.published_at = '' THEN 1 ELSE 0 END,
             yv.published_at DESC, yv.title COLLATE NOCASE
  `).all(...(channelId ? [channelId] : []));
}

function sortResults(results, sortMode) {
  results.sort((left, right) => {
    if (sortMode === "occurrences" && left.occurrenceCount !== right.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
    const byDate = String(right.publishedAt).localeCompare(String(left.publishedAt));
    if (byDate) return byDate;
    if (sortMode === "date" && left.occurrenceCount !== right.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
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
  const rows = transcriptRows(db, channelId);
  const results = [];

  for (const row of rows) {
    const analyzed = analysis.analyzeTranscriptTerms(row.text, terms, matchMode);
    const matched = analyzed.matches.filter((entry) => entry.occurrenceCount > 0);
    const include = searchMode === "all-in-video"
      ? matched.length === terms.length
      : matched.length > 0;
    if (!include) continue;

    const videoTerms = matched.map((entry) => ({
      term: entry.query,
      occurrenceCount: entry.occurrenceCount,
      contexts: entry.contexts,
    }));
    const occurrenceCount = videoTerms.reduce((total, entry) => total + entry.occurrenceCount, 0);

    results.push({
      videoId: String(row.videoId),
      channelId: String(row.channelId),
      channelTitle: String(row.channelTitle ?? ""),
      title: String(row.title ?? ""),
      publishedAt: String(row.publishedAt ?? ""),
      url: String(row.url ?? ""),
      language: String(row.language ?? ""),
      occurrenceCount,
      matchedTermCount: videoTerms.length,
      terms: videoTerms,
    });
  }

  sortResults(results, sort);
  const termStats = termStatsForResults(terms, results);
  const totalOccurrences = results.reduce((total, video) => total + video.occurrenceCount, 0);

  return {
    generatedAt: new Date().toISOString(),
    terms,
    matchMode,
    searchMode,
    sort,
    channelId,
    transcriptCount: rows.length,
    videoCount: results.length,
    totalOccurrences,
    termStats,
    results,
  };
}

function markdownEscape(value) {
  return String(value ?? "").replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
}

function searchModeLabel(value) {
  return value === "all-in-video" ? "Aynı videoda tüm terimler" : "Bağımsız terimler";
}

function matchModeLabel(value) {
  return value === "whole-word" ? "Tam kelime/ifade" : "İçeren";
}

function renderMarkdownReport(report) {
  const terms = analysis.normalizeTerms(report?.terms);
  const lines = [
    "# Channel Foundry — Altyazı Arama Raporu",
    "",
    `- Oluşturma: ${String(report?.generatedAt || new Date().toISOString())}`,
    `- Terimler: ${terms.join(", ")}`,
    `- Arama modu: ${searchModeLabel(report?.searchMode)}`,
    `- Eşleşme modu: ${matchModeLabel(report?.matchMode)}`,
    `- Taranan altyazı: ${Number(report?.transcriptCount || 0)}`,
    `- Eşleşen video: ${Number(report?.videoCount || 0)}`,
    `- Toplam kullanım: ${Number(report?.totalOccurrences || 0)}`,
    "",
    "## Terim Özeti",
    "",
    "| Terim | Video | Kullanım |",
    "| --- | ---: | ---: |",
  ];

  const stats = Array.isArray(report?.termStats) ? report.termStats : [];
  for (const term of terms) {
    const stat = stats.find((entry) => analysis.fold(entry?.term) === analysis.fold(term));
    lines.push(`| ${markdownEscape(term)} | ${Number(stat?.videoCount || 0)} | ${Number(stat?.occurrenceCount || 0)} |`);
  }

  const results = Array.isArray(report?.results) ? report.results : [];
  results.forEach((video, videoIndex) => {
    lines.push(
      "",
      `## VIDEO ${String(videoIndex + 1).padStart(3, "0")}`,
      "",
      `- Başlık: ${markdownEscape(video?.title)}`,
      `- Tarih: ${markdownEscape(video?.publishedAt || "—")}`,
      `- Kanal: ${markdownEscape(video?.channelTitle || video?.channelId || "—")}`,
      `- Video ID: ${markdownEscape(video?.videoId)}`,
      `- URL: ${markdownEscape(video?.url)}`,
      `- Toplam kullanım: ${Number(video?.occurrenceCount || 0)}`,
    );

    const videoTerms = Array.isArray(video?.terms) ? video.terms : [];
    videoTerms.forEach((termResult) => {
      lines.push("", `### ${markdownEscape(termResult?.term)} — ${Number(termResult?.occurrenceCount || 0)} kullanım`, "");
      const contexts = Array.isArray(termResult?.contexts) ? termResult.contexts : [];
      contexts.forEach((context, index) => {
        const suffix = context?.truncated ? " _(bağlam penceresi)_" : "";
        const repeated = Number(context?.occurrenceCount || 0) > 1 ? ` [${Number(context.occurrenceCount)} kullanım]` : "";
        lines.push(`${index + 1}. ${String(context?.context || "").trim()}${repeated}${suffix}`);
      });
    });
  });

  return `${lines.join("\n").trim()}\n`;
}

function slugify(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/gu, "c")
    .replace(/[ğĞ]/gu, "g")
    .replace(/[ıİiI]/gu, "i")
    .replace(/[öÖ]/gu, "o")
    .replace(/[şŞ]/gu, "s")
    .replace(/[üÜ]/gu, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72) || "arama";
}

function reportFilename(report) {
  const terms = analysis.normalizeTerms(report?.terms);
  const date = String(report?.generatedAt || new Date().toISOString()).slice(0, 10);
  return `subtitle-search-${slugify(terms.slice(0, 4).join("-"))}-${date}.md`;
}

module.exports = {
  SEARCH_MODES,
  SORT_MODES,
  matchModeLabel,
  normalizeSearchMode,
  normalizeSortMode,
  renderMarkdownReport,
  reportFilename,
  searchModeLabel,
  searchTranscripts,
  sortResults,
  termStatsForResults,
  transcriptRows,
};
