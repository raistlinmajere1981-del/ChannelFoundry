"use strict";

// Durable per-video YouTube metadata checkpoints. Transcripts are intentionally not consulted.
const VALID_RESULTS = new Set(["checked", "none", "unavailable", "retry"]);
const TEMPORARY_RETRY_MINUTES = 30;
const MAX_RETRY_MINUTES = 24 * 60;
const UNAVAILABLE_RETRY_DAYS = 14;

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_detail_checks (
      channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      detail_signature TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('checked','none','unavailable','retry')),
      detail_json TEXT NOT NULL DEFAULT '',
      checked_at TEXT NOT NULL,
      retry_at TEXT NOT NULL DEFAULT '',
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (channel_id, video_id, detail_signature)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_youtube_detail_checks_retry
    ON youtube_detail_checks(channel_id, detail_signature, retry_at);
  `);
}

function errorCategory(message) {
  const error = String(message || "").toLowerCase();
  if (/private video|members.only|subscriber.only|video unavailable|has been removed|has been deleted|not available in your country|geo.restricted|copyright claim|this video is unavailable/.test(error)) return "unavailable";
  return "retry";
}

function retryDelayMs(result, failures) {
  if (result === "unavailable") return UNAVAILABLE_RETRY_DAYS * 86400000;
  return Math.min(TEMPORARY_RETRY_MINUTES * (2 ** Math.min(failures - 1, 8)), MAX_RETRY_MINUTES) * 60000;
}

function record(db, { channelId, videoId, signature, detail = null, error = "", now = new Date() }) {
  if (!channelId || !/^[A-Za-z0-9_-]{11}$/.test(String(videoId)) || !signature) throw new Error("Geçersiz YouTube ayrıntı kontrol kimliği.");
  ensureSchema(db);
  const previous = db.prepare(`
    SELECT failure_count AS failureCount FROM youtube_detail_checks
    WHERE channel_id=? AND video_id=? AND detail_signature=?
  `).get(channelId, videoId, signature);
  const success = Boolean(detail);
  const result = success ? (detail.subtitle_status === "none" ? "none" : "checked") : errorCategory(error);
  if (!VALID_RESULTS.has(result)) throw new Error("Geçersiz kontrol sonucu.");
  const failureCount = success ? 0 : (Number(previous?.failureCount) || 0) + 1;
  const timestamp = new Date(now).toISOString();
  const retryAt = success ? "" : new Date(new Date(now).getTime() + retryDelayMs(result, failureCount)).toISOString();
  db.prepare(`
    INSERT INTO youtube_detail_checks (
      channel_id, video_id, detail_signature, result, detail_json, checked_at, retry_at, failure_count, last_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(channel_id, video_id, detail_signature) DO UPDATE SET
      result=excluded.result,
      detail_json=excluded.detail_json,
      checked_at=excluded.checked_at,
      retry_at=excluded.retry_at,
      failure_count=excluded.failure_count,
      last_error=excluded.last_error
  `).run(channelId, videoId, signature, result, success ? JSON.stringify(detail) : "", timestamp, retryAt, failureCount, success ? "" : String(error).slice(0, 240));
  return { result, failureCount, checkedAt: timestamp, retryAt };
}

function load(db, channelId, signature, now = new Date()) {
  ensureSchema(db);
  const skipVideoIds = [];
  const deferredVideoIds = [];
  const cachedDetails = [];
  const entries = db.prepare(`
    SELECT video_id AS videoId, result, detail_json AS detailJson, retry_at AS retryAt
    FROM youtube_detail_checks WHERE channel_id=? AND detail_signature=?
  `).all(channelId, signature);
  const current = new Date(now).toISOString();
  for (const entry of entries) {
    if (entry.result === "checked" || entry.result === "none") {
      try {
        const detail = JSON.parse(entry.detailJson);
        if (detail && detail.id === entry.videoId) {
          skipVideoIds.push(entry.videoId);
          cachedDetails.push(detail);
        }
      } catch { /* Damaged checkpoint is rechecked. */ }
    } else if (entry.retryAt && entry.retryAt > current) {
      skipVideoIds.push(entry.videoId);
      deferredVideoIds.push(entry.videoId);
    }
  }
  return { skipVideoIds, deferredVideoIds, cachedDetails };
}

function statusMap(db, channelId = "") {
  ensureSchema(db);
  const rows = db.prepare(`
    SELECT channel_id AS channelId, video_id AS videoId, detail_signature AS signature,
           result, detail_json AS detailJson, checked_at AS checkedAt, retry_at AS retryAt
    FROM youtube_detail_checks ${channelId ? "WHERE channel_id=?" : ""}
  `).all(...(channelId ? [channelId] : []));
  const statuses = new Map();
  for (const row of rows) {
    let detail = null;
    try { detail = row.detailJson ? JSON.parse(row.detailJson) : null; } catch {}
    statuses.set([row.channelId, row.videoId, row.signature].join("\t"), { ...row, detail });
  }
  return statuses;
}

function prune(db, channelId, availableIds) {
  // Only after a successful full catalogue: keep checkpoints for currently listed videos.
  ensureSchema(db);
  const known = new Set(availableIds);
  const rows = db.prepare("SELECT DISTINCT video_id AS videoId FROM youtube_detail_checks WHERE channel_id=?").all(channelId);
  const remove = db.prepare("DELETE FROM youtube_detail_checks WHERE channel_id=? AND video_id=?");
  for (const row of rows) if (!known.has(row.videoId)) remove.run(channelId, row.videoId);
}

module.exports = { ensureSchema, record, load, statusMap, prune, errorCategory, retryDelayMs };
