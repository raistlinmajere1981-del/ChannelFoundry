const analysis = require("../../packages/subtitle-analysis/index.cjs");
const transcriptStore = require("./transcript-store.cjs");
const catalogStore = require("./youtube-catalog-store.cjs");

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

function searchTranscripts(db, input = {}) {
  const query = analysis.normalizeQuery(input.query);
  const channelId = String(input.channelId ?? "").trim();
  const rows = transcriptRows(db, channelId);
  const results = [];
  let totalOccurrences = 0;

  for (const row of rows) {
    const match = analysis.analyzeTranscript(row.text, query);
    if (!match.occurrenceCount) continue;
    totalOccurrences += match.occurrenceCount;
    results.push({
      videoId: String(row.videoId),
      channelId: String(row.channelId),
      channelTitle: String(row.channelTitle ?? ""),
      title: String(row.title ?? ""),
      publishedAt: String(row.publishedAt ?? ""),
      url: String(row.url ?? ""),
      language: String(row.language ?? ""),
      occurrenceCount: match.occurrenceCount,
      sentences: match.sentences,
    });
  }

  return {
    query,
    matchMode: "literal",
    channelId,
    transcriptCount: rows.length,
    videoCount: results.length,
    totalOccurrences,
    results,
  };
}

module.exports = { searchTranscripts, transcriptRows };
