"use strict";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
function ensureSchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS youtube_transcript_ignored (video_id TEXT PRIMARY KEY, subtitle_languages_json TEXT NOT NULL, reason TEXT NOT NULL DEFAULT 'unavailable', detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;");
}
function signature(languages) {
  return JSON.stringify(Array.isArray(languages) ? [...new Set(languages.map(String))] : []);
}
function mark(db, videoId, languages) {
  ensureSchema(db);
  const id = String(videoId || "");
  if (!VIDEO_ID.test(id)) throw new Error("Geçersiz YouTube video kimliği.");
  db.prepare("INSERT INTO youtube_transcript_ignored (video_id, subtitle_languages_json) VALUES (?, ?) ON CONFLICT(video_id) DO UPDATE SET subtitle_languages_json=excluded.subtitle_languages_json, detected_at=CURRENT_TIMESTAMP").run(id, signature(languages));
}
function clear(db, videoId) {
  ensureSchema(db);
  const id = String(videoId || "");
  if (!VIDEO_ID.test(id)) throw new Error("Geçersiz YouTube video kimliği.");
  return {cleared: db.prepare("DELETE FROM youtube_transcript_ignored WHERE video_id=?").run(id).changes > 0};
}
function isIgnored(db, videoId, languages) {
  ensureSchema(db);
  const row = db.prepare("SELECT subtitle_languages_json AS signature FROM youtube_transcript_ignored WHERE video_id=?").get(String(videoId || ""));
  return Boolean(row && row.signature === signature(languages));
}
function ignoredVideoIds(db, languages) {
  ensureSchema(db);
  return db.prepare("SELECT video_id AS videoId FROM youtube_transcript_ignored WHERE subtitle_languages_json=?").all(signature(languages)).map((row)=>row.videoId);
}
module.exports = {ensureSchema, signature, mark, clear, isIgnored, ignoredVideoIds};
