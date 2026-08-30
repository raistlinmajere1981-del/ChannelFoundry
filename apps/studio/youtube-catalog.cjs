const fs = require("node:fs");
const source = require("./youtube-catalog-source.cjs");
const store = require("./youtube-catalog-store.cjs");
const { cacheThumbnails, thumbnailCacheFile } = require("./youtube-thumbnail-cache.cjs");
const ytDlp = require("./ytdlp-manager.cjs");

async function addChannel(db, input) {
  store.ensureSchema(db);
  const tool = await source.ytDlpStatus();
  if (!tool.available) throw new Error("Kanal eklemek için yt-dlp kurulu olmalı.");
  const url = source.normalizeChannelUrl(input?.url);
  const playlistUrl = input?.playlistUrl ? source.normalizePlaylistUrl(input.playlistUrl) : "";
  const [identity, playlist] = await Promise.all([
    source.fetchChannelIdentity(url),
    playlistUrl ? source.fetchPlaylistMetadata(playlistUrl) : Promise.resolve(null),
  ]);
  if (playlist?.channelId && /^UC[A-Za-z0-9_-]+$/.test(identity.channelId) && playlist.channelId !== identity.channelId) {
    throw new Error("Seçilen playlist, girilen YouTube kanalına ait değil.");
  }
  const result = store.registerChannel(db, identity, url, ytDlp.mediaOptions(), {
    playlistUrl,
    playlistTitle: playlist?.title || "",
  });
  return { ok: true, ...result };
}

function channelMediaOptions(db, input = {}) {
  return store.channelMediaOptions(db, input?.channelId, ytDlp.mediaOptions());
}

function saveChannelMediaOptions(db, input = {}) {
  return store.saveChannelMediaOptions(db, input, ytDlp.mediaOptions());
}

async function syncChannel(db, userDataPath, input) {
  store.ensureSchema(db);
  const tool = await source.ytDlpStatus();
  if (!tool.available) throw new Error("Kanal senkronizasyonu için yt-dlp kurulu olmalı.");
  const selectedChannel = input?.channelId ? store.getChannel(db, input.channelId) : store.activeChannel(db);
  if (!selectedChannel) throw new Error("Senkronizasyon için aktif YouTube kanalı bulunamadı.");
  const mediaOptions = store.channelMediaOptions(db, selectedChannel.id, ytDlp.mediaOptions());
  const url = source.normalizeChannelUrl(input?.url || selectedChannel.url);
  const mode = input?.mode === "recent" ? "recent" : "full";
  const detailSignature = source.currentDetailSignature(mediaOptions);
  const { payload, identity, options, filters, detailStats } = await source.fetchCatalog(url, mode, {
    mediaOptions,
    playlistUrl: selectedChannel.playlistUrl,
    excludeShorts: input?.excludeShorts,
    excludeLive: input?.excludeLive,
    excludeMembersOnly: input?.excludeMembersOnly,
    signal: input?.signal,
    onProgress: input?.onProgress,
    skipVideoIds: store.detailedVideoIds(db, detailSignature, selectedChannel.id),
  });
  const videos = source.flattenEntries(payload?.entries)
    .filter((entry) => source.shouldIncludeEntry(entry, filters))
    .map((entry) => source.normalizeEntry(entry, identity.channelId, options))
    .filter(Boolean);
  const existingThumbnails = new Map(db.prepare(`
    SELECT video_id AS videoId, thumbnail_url AS thumbnailUrl, thumbnail_file AS thumbnailFile
    FROM youtube_videos
  `).all().map((row) => [row.videoId, row]));
  const uncached = videos.filter((video) => {
    const row = existingThumbnails.get(video.videoId);
    const expectedFile = thumbnailCacheFile(userDataPath, video);
    if (row?.thumbnailFile === expectedFile && fs.existsSync(expectedFile)) {
      video.thumbnailFile = expectedFile;
      video.thumbnailUrl = row.thumbnailUrl;
      return false;
    }
    return true;
  });
  if (input?.signal?.aborted) {
    const error = new Error("Senkronizasyon kullanıcı tarafından iptal edildi.");
    error.code = "CHANNEL_FOUNDRY_SYNC_CANCELLED";
    throw error;
  }
  if (uncached.length) input?.onProgress?.({ phase: "thumbnails", processed: 0, total: uncached.length, currentTitle: "" });
  const alreadyArchived = uncached.filter((video) => {
    const file = thumbnailCacheFile(userDataPath, video);
    return fs.existsSync(file) && fs.statSync(file).size > 100;
  }).length;
  const preparedThumbnailCount = await cacheThumbnails(userDataPath, uncached, {
    signal: input?.signal,
    onProgress: (progress) => input?.onProgress?.({ phase: "thumbnails", ...progress }),
  });
  const cachedCount = Math.max(0, preparedThumbnailCount - alreadyArchived);
  const archivedThumbnailCount = videos.filter((video) => {
    const file = thumbnailCacheFile(userDataPath, video);
    return fs.existsSync(file) && fs.statSync(file).size > 100;
  }).length;
  if (input?.signal?.aborted) {
    const error = new Error("Senkronizasyon kullanıcı tarafından iptal edildi.");
    error.code = "CHANNEL_FOUNDRY_SYNC_CANCELLED";
    throw error;
  }
  input?.onProgress?.({ phase: "saving", processed: videos.length, total: videos.length, currentTitle: "" });
  const result = store.upsertCatalog(db, identity, url, videos, mode);
  const channel = store.getChannel(db, identity.channelId);
  return { ok: true, mode, tool, channel, ...result, cachedCount, archivedThumbnailCount, detailStats };
}

module.exports = {
  addChannel,
  activeChannel: store.activeChannel,
  catalogStats: store.catalogStats,
  channelMediaOptions,
  detailedVideoIds: store.detailedVideoIds,
  ensureSchema: store.ensureSchema,
  flattenEntries: source.flattenEntries,
  getChannel: store.getChannel,
  importCatalogVideo: store.importCatalogVideo,
  listChannels: store.listChannels,
  listVideos: store.listVideos,
  normalizeChannelUrl: source.normalizeChannelUrl,
  normalizeEntry: source.normalizeEntry,
  normalizePlaylistUrl: source.normalizePlaylistUrl,
  saveChannelMediaOptions,
  setActiveChannel: store.setActiveChannel,
  syncChannel,
  uploadsPlaylistUrl: source.uploadsPlaylistUrl,
  ytDlpStatus: source.ytDlpStatus,
};
