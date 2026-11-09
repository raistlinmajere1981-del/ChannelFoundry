const current = require("./ai-analysis-current.cjs");
const legacy = require("./ai-analysis-legacy.cjs");
const support = require("./ai-support-records.cjs");

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function stats(db) {
  const base = tableExists(db, "source_transcripts")
    ? legacy.stats(db)
    : { transcripts: 0, analyzed: 0, waiting: 0, running: 0, errors: 0 };
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN er.state='curated' THEN 1 ELSE 0 END) AS curated,
      SUM(CASE WHEN er.state='excluded' THEN 1 ELSE 0 END) AS excluded,
      SUM(CASE WHEN COALESCE(er.state,'pending')='pending' THEN 1 ELSE 0 END) AS editorialPending
    FROM source_ai_analyses sa
    LEFT JOIN ai_analysis_editorial_reviews er
      ON er.provider=sa.provider AND er.external_id=sa.external_id
    WHERE sa.provider='youtube'
  `).get();
  Object.defineProperties(base, {
    curated: { value: Number(row?.curated ?? 0), enumerable: false },
    excluded: { value: Number(row?.excluded ?? 0), enumerable: false },
    editorialPending: { value: Number(row?.editorialPending ?? 0), enumerable: false },
  });
  return base;
}

function publicVideoSummaries(db) {
  // This is the camera's publication allowlist. Channel discovery never adds
  // records here; only completed analyses with a real summary enter a snapshot.
  if (!["source_ai_analyses", "ai_analysis_jobs", "ai_analysis_editorial_reviews", "youtube_videos"].every((name) => tableExists(db, name))) return [];
  const allowed = new Set(db.prepare(`SELECT a.external_id FROM source_ai_analyses a
    JOIN ai_analysis_jobs j ON j.provider=a.provider AND j.external_id=a.external_id AND j.state='done'
    JOIN ai_analysis_editorial_reviews e ON e.provider=a.provider AND e.external_id=a.external_id AND e.state='curated'
    WHERE a.provider='youtube'`).all().map(r=>r.external_id));
  return require('./publication-languages.cjs').videoSources(db).filter(r=>allowed.has(r.videoId)&&/^[A-Za-z0-9_-]{11}$/.test(r.videoId)&&r.title.trim()&&r.summary.trim());
}

module.exports = {
  ...current,
  stats,
  supportRecords: support.supportRecords,
  supportSources: support.supportSources,
  saveSupportRecord: support.saveSupportRecord,
  publicVideoSummaries,
};
