const fs = require("node:fs");
const youtubeImporter = require("./youtube-import.cjs");

function ensureColumn(db, table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition};`);
}

function ensureActiveSelection(db) {
  const activeRows = db.prepare(`
    SELECT id FROM youtube_channels WHERE is_active = 1
    ORDER BY COALESCE(last_synced_at, created_at) DESC, created_at DESC
  `).all();
  if (activeRows.length > 1) {
    const keep = activeRows[0].id;
    db.prepare("UPDATE youtube_channels SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END").run(keep);
    return keep;
  }
  if (activeRows.length === 1) return activeRows[0].id;
  const fallback = db.prepare(`
    SELECT id FROM youtube_channels
    ORDER BY COALESCE(last_synced_at, created_at) DESC, created_at DESC
    LIMIT 1
  `).get();
  if (!fallback) return "";
  db.prepare("UPDATE youtube_channels SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END").run(fallback.id);
  return String(fallback.id);
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_channels (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      handle TEXT NOT NULL DEFAULT '',
      last_synced_at TEXT,
      last_full_synced_at TEXT,
      video_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;

    CREATE TABLE IF NOT EXISTS youtube_videos (
      video_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL DEFAULT '',
      duration_seconds INTEGER,
      canonical_url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      thumbnail_file TEXT NOT NULL DEFAULT '',
      availability TEXT NOT NULL DEFAULT '',
      live_status TEXT NOT NULL DEFAULT '',
      discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_published ON youtube_videos(published_at);
    CREATE INDEX IF NOT EXISTS idx_youtube_videos_duration ON youtube_videos(duration_seconds);
  `);
  ensureColumn(db, "youtube_channels", "is_active", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "youtube_videos", "subtitle_status", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "youtube_videos", "subtitle_languages_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "youtube_videos", "automatic_caption_languages_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "youtube_videos", "detail_signature", "TEXT NOT NULL DEFAULT ''");
  ensureActiveSelection(db);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_youtube_channels_active ON youtube_channels(is_active) WHERE is_active = 1;");
}

function channelRow(db, channelId) {
  return db.prepare(`
    SELECT id, url, title, handle, last_synced_at AS lastSyncedAt,
           last_full_synced_at AS lastFullSyncedAt, video_count AS videoCount,
           CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS active
    FROM youtube_channels WHERE id = ?
  `).get(String(channelId ?? "").trim());
}

function getChannel(db, channelId) {
  ensureSchema(db);
  const row = channelRow(db, channelId);
  return row ? { ...row, active: Boolean(row.active) } : null;
}

function activeChannel(db) {
  ensureSchema(db);
  const activeId = ensureActiveSelection(db);
  if (!activeId) return null;
  return getChannel(db, activeId);
}

function setActiveChannel(db, channelId) {
  ensureSchema(db);
  const id = String(channelId ?? "").trim();
  if (!id) throw new Error("Aktif kanal seçilmedi.");
  const row = channelRow(db, id);
  if (!row) throw new Error("Seçilen YouTube kanalı yerel katalogda bulunamadı.");
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare("UPDATE youtube_channels SET is_active = 0 WHERE is_active <> 0").run();
    db.prepare("UPDATE youtube_channels SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
  return getChannel(db, id);
}

function scopedChannelId(db, input = {}) {
  if (input?.allChannels === true) return "";
  const explicit = String(input?.channelId ?? "").trim();
  if (explicit) return explicit;
  return activeChannel(db)?.id || "";
}

function detailedVideoIds(db, detailSignature) {
  ensureSchema(db);
  const signature = String(detailSignature || "");
  db.prepare(`
    UPDATE youtube_videos SET detail_signature=?
    WHERE detail_signature='' AND published_at<>''
      AND subtitle_status IN ('manual', 'automatic', 'none')
  `).run(signature);
  return db.prepare(`
    SELECT video_id AS videoId FROM youtube_videos
    WHERE published_at<>'' AND subtitle_status IN ('manual', 'automatic', 'none')
      AND detail_signature=?
  `).all(signature).map((row) => row.videoId);
}

function upsertCatalog(db, identity, url, videos, mode) {
  const now = new Date().toISOString();
  const existingIds = new Set(db.prepare("SELECT video_id AS videoId FROM youtube_videos WHERE channel_id = ?").all(identity.channelId).map((row) => row.videoId));
  const incomingIds = new Set(videos.map((video) => video.videoId));
  const staleIds = mode === "full" ? [...existingIds].filter((videoId) => !incomingIds.has(videoId)) : [];
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`
      INSERT INTO youtube_channels (id, url, title, handle, last_synced_at, last_full_synced_at, video_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET url=excluded.url, title=excluded.title, handle=excluded.handle,
        last_synced_at=excluded.last_synced_at,
        last_full_synced_at=CASE WHEN ?='full' THEN excluded.last_full_synced_at ELSE youtube_channels.last_full_synced_at END,
        video_count=CASE WHEN ?='full' THEN excluded.video_count ELSE MAX(youtube_channels.video_count, excluded.video_count) END,
        updated_at=CURRENT_TIMESTAMP
    `).run(identity.channelId, url, identity.title, identity.handle, now, mode === "full" ? now : null, videos.length, mode, mode);

    const statement = db.prepare(`
      INSERT INTO youtube_videos (
        video_id, channel_id, title, published_at, duration_seconds, canonical_url,
        thumbnail_url, thumbnail_file, availability, live_status, subtitle_status,
        subtitle_languages_json, automatic_caption_languages_json, detail_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(video_id) DO UPDATE SET channel_id=excluded.channel_id, title=excluded.title,
        published_at=CASE WHEN excluded.published_at<>'' THEN excluded.published_at ELSE youtube_videos.published_at END,
        duration_seconds=COALESCE(excluded.duration_seconds, youtube_videos.duration_seconds),
        canonical_url=excluded.canonical_url, thumbnail_url=excluded.thumbnail_url,
        thumbnail_file=CASE WHEN excluded.thumbnail_file<>'' THEN excluded.thumbnail_file ELSE youtube_videos.thumbnail_file END,
        availability=excluded.availability, live_status=excluded.live_status,
        subtitle_status=CASE WHEN excluded.subtitle_status IN ('manual','automatic','none') THEN excluded.subtitle_status ELSE youtube_videos.subtitle_status END,
        subtitle_languages_json=CASE WHEN excluded.subtitle_status IN ('manual','automatic','none') THEN excluded.subtitle_languages_json ELSE youtube_videos.subtitle_languages_json END,
        automatic_caption_languages_json=CASE WHEN excluded.subtitle_status IN ('manual','automatic','none') THEN excluded.automatic_caption_languages_json ELSE youtube_videos.automatic_caption_languages_json END,
        detail_signature=CASE WHEN excluded.detail_signature<>'' THEN excluded.detail_signature ELSE youtube_videos.detail_signature END,
        updated_at=CURRENT_TIMESTAMP
    `);
    for (const video of videos) {
      statement.run(
        video.videoId, video.channelId, video.title, video.publishedAt, video.durationSeconds,
        video.canonicalUrl, video.thumbnailUrl, video.thumbnailFile ?? "", video.availability, video.liveStatus,
        video.subtitleStatus ?? "unknown", JSON.stringify(video.subtitleLanguages ?? []),
        JSON.stringify(video.automaticCaptionLanguages ?? []), video.detailSignature ?? "",
      );
    }
    const deleteStatement = db.prepare("DELETE FROM youtube_videos WHERE channel_id=? AND video_id=?");
    for (const videoId of staleIds) deleteStatement.run(identity.channelId, videoId);
    if (mode === "full") db.prepare("UPDATE youtube_channels SET video_count=(SELECT COUNT(*) FROM youtube_videos WHERE channel_id=?) WHERE id=?").run(identity.channelId, identity.channelId);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
  setActiveChannel(db, identity.channelId);
  return { newCount: videos.filter((video) => !existingIds.has(video.videoId)).length, updatedCount: videos.length, removedCount: staleIds.length };
}

function listChannels(db) {
  ensureSchema(db);
  return db.prepare(`
    SELECT id, url, title, handle, last_synced_at AS lastSyncedAt,
           last_full_synced_at AS lastFullSyncedAt, video_count AS videoCount,
           CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS active
    FROM youtube_channels
    ORDER BY is_active DESC, COALESCE(last_synced_at, created_at) DESC
  `).all().map((row) => ({ ...row, active: Boolean(row.active) }));
}

function hasTable(db, name) {
  return Boolean(db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").get(String(name)));
}

function listVideos(db, input = {}) {
  ensureSchema(db);
  const channelId = scopedChannelId(db, input);
  const sourceTranscriptJoin = hasTable(db, "source_transcripts")
    ? "LEFT JOIN source_transcripts st ON st.provider = 'youtube' AND st.external_id = yv.video_id" : "";
  const contentTranscriptJoin = hasTable(db, "content_transcripts")
    ? "LEFT JOIN content_transcripts ct ON ct.content_key = ci.key" : "";
  const transcriptSelect = hasTable(db, "source_transcripts") && hasTable(db, "content_transcripts")
    ? "CASE WHEN st.external_id IS NOT NULL OR ct.content_key IS NOT NULL THEN 1 ELSE 0 END AS hasTranscript"
    : hasTable(db, "source_transcripts")
      ? "CASE WHEN st.external_id IS NOT NULL THEN 1 ELSE 0 END AS hasTranscript"
      : hasTable(db, "content_transcripts")
        ? "CASE WHEN ct.content_key IS NOT NULL THEN 1 ELSE 0 END AS hasTranscript" : "0 AS hasTranscript";
  const rows = db.prepare(`
    SELECT yv.video_id AS videoId, yv.channel_id AS channelId, yv.title,
           yv.published_at AS publishedAt, yv.duration_seconds AS durationSeconds,
           yv.canonical_url AS url, yv.thumbnail_url AS thumbnailUrl,
           yv.thumbnail_file AS thumbnailFile, yv.availability, yv.live_status AS liveStatus,
           yv.subtitle_status AS subtitleStatus, yv.subtitle_languages_json AS subtitleLanguagesJson,
           yv.automatic_caption_languages_json AS automaticCaptionLanguagesJson,
           ci.key AS contentKey, ci.status AS editorialStatus, ${transcriptSelect}
    FROM youtube_videos yv
    LEFT JOIN content_sources cs ON cs.provider='youtube' AND cs.external_id=yv.video_id
    LEFT JOIN content_items ci ON ci.key=cs.content_key
    ${sourceTranscriptJoin}
    ${contentTranscriptJoin}
    ${channelId ? "WHERE yv.channel_id = ?" : ""}
    ORDER BY CASE WHEN yv.published_at='' THEN 1 ELSE 0 END, yv.published_at DESC, yv.discovered_at DESC
  `).all(...(channelId ? [channelId] : []));
  return rows.map((row) => ({
    ...row,
    subtitleLanguages: parseJsonArray(row.subtitleLanguagesJson),
    automaticCaptionLanguages: parseJsonArray(row.automaticCaptionLanguagesJson),
    hasTranscript: Boolean(row.hasTranscript),
    thumbnailCached: Boolean(row.thumbnailFile && fs.existsSync(row.thumbnailFile)),
  }));
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function importCatalogVideo(db, input) {
  ensureSchema(db);
  const videoId = String(input?.videoId ?? "").trim();
  const row = db.prepare(`
    SELECT yv.video_id AS videoId, yv.title, yv.published_at AS publishedAt,
           yv.canonical_url AS url, yv.thumbnail_url AS thumbnailUrl, yc.title AS channel
    FROM youtube_videos yv JOIN youtube_channels yc ON yc.id=yv.channel_id WHERE yv.video_id=?
  `).get(videoId);
  if (!row) throw new Error("Video yerel kanal kataloğunda bulunamadı.");
  const result = youtubeImporter.saveYoutubeImport(db, {
    provider: "youtube", videoId: row.videoId, url: row.url, title: row.title,
    channel: row.channel, thumbnailUrl: row.thumbnailUrl,
  });
  if (result.imported && row.publishedAt) {
    db.prepare("UPDATE content_items SET meta=?, updated_at=CURRENT_TIMESTAMP WHERE key=?").run(row.publishedAt, result.item.key);
    result.item.meta = row.publishedAt;
  }
  return result;
}

function countForChannel(db, sql, channelId) {
  return Number(db.prepare(sql).get(...(channelId ? [channelId] : [])).count);
}

function catalogStats(db, input = {}) {
  ensureSchema(db);
  const channelId = scopedChannelId(db, input);
  const where = channelId ? "WHERE yv.channel_id = ?" : "";
  const total = countForChannel(db, `SELECT COUNT(*) AS count FROM youtube_videos yv ${where}`, channelId);
  const imported = countForChannel(db, `
    SELECT COUNT(*) AS count FROM youtube_videos yv
    JOIN content_sources cs ON cs.provider='youtube' AND cs.external_id=yv.video_id
    ${where}
  `, channelId);
  let transcripts = 0;
  if (hasTable(db, "source_transcripts")) {
    transcripts = countForChannel(db, `
      SELECT COUNT(DISTINCT yv.video_id) AS count FROM youtube_videos yv
      JOIN source_transcripts st ON st.provider='youtube' AND st.external_id=yv.video_id
      ${where}
    `, channelId);
  }
  if (hasTable(db, "content_transcripts")) {
    const conditions = [];
    if (channelId) conditions.push("yv.channel_id = ?");
    if (hasTable(db, "source_transcripts")) conditions.push("st.external_id IS NULL");
    const legacyOnly = countForChannel(db, `
      SELECT COUNT(DISTINCT yv.video_id) AS count FROM youtube_videos yv
      JOIN content_sources cs ON cs.provider='youtube' AND cs.external_id=yv.video_id
      JOIN content_transcripts ct ON ct.content_key=cs.content_key
      ${hasTable(db, "source_transcripts") ? "LEFT JOIN source_transcripts st ON st.provider='youtube' AND st.external_id=yv.video_id" : ""}
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    `, channelId);
    transcripts += legacyOnly;
  }
  return { total, imported, transcripts, pendingImport: Math.max(0, total - imported) };
}

module.exports = {
  activeChannel,
  catalogStats,
  detailedVideoIds,
  ensureSchema,
  getChannel,
  importCatalogVideo,
  listChannels,
  listVideos,
  scopedChannelId,
  setActiveChannel,
  upsertCatalog,
};
