"use strict";

async function resolveYoutubeSyncChannel({ catalog, project, db, onProgress, signal }) {
  if (!project?.youtubeChannelUrl) {
    throw new Error("Önce Ayarlar > Kanal ve yayın bölümüne YouTube kanal adresini ekle.");
  }
  const expectedUrl = catalog.normalizeChannelUrl(project.youtubeChannelUrl);
  const expectedPlaylist = project.youtubePlaylistUrl
    ? catalog.normalizePlaylistUrl(project.youtubePlaylistUrl) : "";
  let channel = catalog.activeChannel(db);
  if (!channel) {
    onProgress?.({ phase: "preparing", processed: 0, total: 0, currentTitle: "Projenin YouTube kanalı bağlanıyor…" });
    if (signal?.aborted) {
      const canceled = new Error("Senkronizasyon iptal edildi.");
      canceled.code = "CHANNEL_FOUNDRY_SYNC_CANCELLED";
      throw canceled;
    }
    const result = await catalog.addChannel(db, { url: expectedUrl, playlistUrl: expectedPlaylist });
    channel = result.channel;
  }
  if (channel.url !== expectedUrl || (channel.playlistUrl || "") !== expectedPlaylist) {
    throw new Error("Aktif katalog proje kaynağından farklı. Önce Ayarlar > Kanal ve yayın üzerinden kaynağı bağla.");
  }
  return channel;
}

module.exports = { resolveYoutubeSyncChannel };
