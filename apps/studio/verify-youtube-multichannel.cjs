const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const catalog = require("./youtube-catalog.cjs");
const source = require("./youtube-catalog-source.cjs");
const store = require("./youtube-catalog-store.cjs");

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE content_items (
    key TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT;
  CREATE TABLE content_sources (
    content_key TEXT PRIMARY KEY REFERENCES content_items(key) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    thumbnail_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, external_id)
  ) STRICT;
`);
store.ensureSchema(db);

const playlistUrl = "https://www.youtube.com/playlist?list=PL1234567890abc";
assert.equal(source.normalizePlaylistUrl("https://www.youtube.com/watch?v=AAAAAAAAAAA&list=PL1234567890abc&index=2"), playlistUrl);
assert.deepEqual(source.catalogTargets("https://www.youtube.com/@example-a", "channel-a", { playlistUrl }), [playlistUrl]);
assert.throws(() => source.normalizePlaylistUrl("https://www.youtube.com/@example-a"), /list kimliği/u);

db.prepare("INSERT INTO youtube_channels (id, url, title, handle, last_synced_at, video_count) VALUES (?, ?, ?, ?, ?, ?)")
  .run("channel-a", "https://www.youtube.com/@example-a", "Kanal A", "@example-a", "2026-08-20T10:00:00Z", 1);
db.prepare("INSERT INTO youtube_channels (id, url, title, handle, last_synced_at, video_count) VALUES (?, ?, ?, ?, ?, ?)")
  .run("channel-b", "https://www.youtube.com/@example-b", "Kanal B", "@example-b", "2026-08-21T10:00:00Z", 1);

db.prepare(`
  INSERT INTO youtube_videos (video_id, channel_id, title, published_at, duration_seconds, canonical_url, thumbnail_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run("AAAAAAAAAAA", "channel-a", "Video A", "2026-08-20", 600, "https://www.youtube.com/watch?v=AAAAAAAAAAA", "https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg");
db.prepare(`
  INSERT INTO youtube_videos (video_id, channel_id, title, published_at, duration_seconds, canonical_url, thumbnail_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run("BBBBBBBBBBB", "channel-b", "Video B", "2026-08-21", 700, "https://www.youtube.com/watch?v=BBBBBBBBBBB", "https://i.ytimg.com/vi/BBBBBBBBBBB/hqdefault.jpg");

const migratedActive = store.activeChannel(db);
assert.equal(migratedActive.id, "channel-b");
assert.equal(store.listVideos(db, {}).length, 1);
assert.equal(store.listVideos(db, {})[0].channelId, "channel-b");
assert.equal(store.listVideos(db, { allChannels: true }).length, 2);
assert.deepEqual(store.catalogStats(db), { total: 1, imported: 0, transcripts: 0, pendingImport: 1 });
assert.deepEqual(store.catalogStats(db, { allChannels: true }), { total: 2, imported: 0, transcripts: 0, pendingImport: 2 });

const switched = store.setActiveChannel(db, "channel-a");
assert.equal(switched.id, "channel-a");
assert.equal(switched.active, true);
assert.equal(store.listVideos(db, {})[0].videoId, "AAAAAAAAAAA");
const channels = store.listChannels(db);
assert.equal(channels[0].id, "channel-a");
assert.equal(channels[0].active, true);
assert.equal(channels.filter((channel) => channel.active).length, 1);

const channelAOptions = store.saveChannelMediaOptions(db, {
  channelId: "channel-a",
  metadataLanguage: "original",
  subtitleLanguages: ["en", "tr", "en"],
  thumbnailSize: "large",
});
const channelBOptions = store.saveChannelMediaOptions(db, {
  channelId: "channel-b",
  metadataLanguage: "tr",
  subtitleLanguages: ["tr"],
  thumbnailSize: "small",
});
assert.deepEqual(channelAOptions, {
  channelId: "channel-a", metadataLanguage: "original", subtitleLanguages: ["en", "tr"], thumbnailSize: "large",
});
assert.deepEqual(channelBOptions, {
  channelId: "channel-b", metadataLanguage: "tr", subtitleLanguages: ["tr"], thumbnailSize: "small",
});
assert.deepEqual(store.channelMediaOptions(db, "channel-a"), channelAOptions);
assert.deepEqual(store.channelMediaOptions(db, "channel-b"), channelBOptions);

db.prepare("UPDATE youtube_videos SET subtitle_status='manual', detail_signature='' WHERE video_id IN ('AAAAAAAAAAA', 'BBBBBBBBBBB')").run();
assert.deepEqual(store.detailedVideoIds(db, "channel-a-detail", "channel-a"), ["AAAAAAAAAAA"]);
assert.equal(db.prepare("SELECT detail_signature AS signature FROM youtube_videos WHERE video_id='BBBBBBBBBBB'").get().signature, "", "Bir kanalın ayrıntı imzası diğer kanala taşmamalı");

const nextVideo = {
  videoId: "CCCCCCCCCCC",
  channelId: "channel-b",
  title: "Yeni B",
  publishedAt: "2026-08-22",
  durationSeconds: 800,
  canonicalUrl: "https://www.youtube.com/watch?v=CCCCCCCCCCC",
  thumbnailUrl: "https://i.ytimg.com/vi/CCCCCCCCCCC/hqdefault.jpg",
  thumbnailFile: "",
  availability: "public",
  liveStatus: "not_live",
  subtitleStatus: "none",
  subtitleLanguages: [],
  automaticCaptionLanguages: [],
  detailSignature: "test",
};
store.upsertCatalog(db, { channelId: "channel-b", title: "Kanal B", handle: "@example-b" }, "https://www.youtube.com/@example-b", [nextVideo], "recent");
assert.equal(store.activeChannel(db).id, "channel-b");
assert.equal(store.listVideos(db, {})[0].videoId, "CCCCCCCCCCC");
assert.equal(store.listChannels(db).filter((channel) => channel.active).length, 1);

assert.throws(() => store.setActiveChannel(db, "missing-channel"), /bulunamadı/u);

const preservedChannelACount = store.listVideos(db, { channelId: "channel-a" }).length;
const preservedChannelBCount = store.listVideos(db, { channelId: "channel-b" }).length;
const registered = store.registerChannel(db, {
  channelId: "channel-c",
  title: "Kanal C",
  handle: "@example-c",
}, "https://www.youtube.com/@example-c", undefined, {
  playlistUrl,
  playlistTitle: "Kanal C Seçkisi",
});
assert.equal(registered.created, true);
assert.equal(registered.channel.id, "channel-c");
assert.equal(registered.channel.videoCount, 0);
assert.equal(registered.channel.lastSyncedAt, null);
assert.equal(registered.channel.sourceType, "playlist");
assert.equal(registered.channel.playlistUrl, playlistUrl);
assert.equal(registered.channel.playlistTitle, "Kanal C Seçkisi");
assert.equal(store.activeChannel(db).id, "channel-c");
assert.equal(store.listVideos(db, {}).length, 0, "Yeni kanal boş bir arşivle açılmalı");
assert.equal(store.listVideos(db, { channelId: "channel-a" }).length, preservedChannelACount, "Mevcut kanal arşivleri korunmalı");
assert.equal(store.listVideos(db, { channelId: "channel-b" }).length, preservedChannelBCount, "Diğer kanal arşivleri korunmalı");

const reactivated = store.registerChannel(db, {
  channelId: "channel-a",
  title: "Kanal A Güncel",
  handle: "@example-a",
}, "https://www.youtube.com/@example-a");
assert.equal(reactivated.created, false);
assert.equal(reactivated.channel.videoCount, 1);
assert.equal(store.activeChannel(db).id, "channel-a");
assert.equal(store.listVideos(db, {}).length, 1, "Kayıtlı kanalı yeniden eklemek arşivini boşaltmamalı");
assert.deepEqual(store.channelMediaOptions(db, "channel-a"), channelAOptions, "Kanalı yeniden eklemek medya tercihlerini değiştirmemeli");
const preservedPlaylist = store.registerChannel(db, {
  channelId: "channel-c", title: "Kanal C", handle: "@example-c",
}, "https://www.youtube.com/@example-c");
assert.equal(preservedPlaylist.channel.playlistUrl, playlistUrl, "Kaynak seçimi verilmeden kanalı etkinleştirmek playlist kapsamını korumalı");

const legacyDb = new DatabaseSync(":memory:");
legacyDb.exec(`
  CREATE TABLE youtube_channels (
    id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '', handle TEXT NOT NULL DEFAULT '',
    last_synced_at TEXT, last_full_synced_at TEXT, video_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT;
  INSERT INTO youtube_channels (id, url, title) VALUES ('legacy-channel', 'https://www.youtube.com/@legacy', 'Legacy');
`);
store.ensureSchema(legacyDb);
assert.deepEqual(store.channelMediaOptions(db, "channel-b"), channelBOptions);
assert.deepEqual(store.channelMediaOptions(legacyDb, "legacy-channel", {
  metadataLanguage: "original", subtitleLanguages: ["en"], thumbnailSize: "large",
}), {
  channelId: "legacy-channel", metadataLanguage: "original", subtitleLanguages: ["en"], thumbnailSize: "large",
});
assert.equal(store.getChannel(legacyDb, "legacy-channel").sourceType, "channel");
assert.equal(store.getChannel(legacyDb, "legacy-channel").playlistUrl, "");
legacyDb.close();

async function verifyChannelAdditionDoesNotSync() {
  const originalStatus = source.ytDlpStatus;
  const originalIdentity = source.fetchChannelIdentity;
  const originalPlaylistMetadata = source.fetchPlaylistMetadata;
  const originalCatalog = source.fetchCatalog;
  let catalogFetches = 0;
  let playlistMetadataFetches = 0;
  source.ytDlpStatus = async () => ({ available: true, version: "test" });
  source.fetchChannelIdentity = async () => ({ channelId: "UCchannelD", title: "Kanal D", handle: "@example-d" });
  source.fetchPlaylistMetadata = async (url) => {
    playlistMetadataFetches += 1;
    return { playlistId: "PL1234567890abc", title: "Kanal D Seçkisi", channelId: "UCchannelD", url };
  };
  source.fetchCatalog = async () => {
    catalogFetches += 1;
    throw new Error("Kanal eklerken katalog taranmamalı.");
  };
  try {
    const result = await catalog.addChannel(db, { url: "https://www.youtube.com/@example-d", playlistUrl });
    assert.equal(result.ok, true);
    assert.equal(result.created, true);
    assert.equal(result.channel.videoCount, 0);
    assert.equal(result.channel.lastSyncedAt, null);
    assert.equal(result.channel.sourceType, "playlist");
    assert.equal(result.channel.playlistUrl, playlistUrl);
    assert.equal(result.channel.playlistTitle, "Kanal D Seçkisi");
    assert.equal(store.listVideos(db, {}).length, 0);
    assert.deepEqual(catalog.channelMediaOptions(db, { channelId: "UCchannelD" }), {
      channelId: "UCchannelD", metadataLanguage: "tr", subtitleLanguages: ["tr", "en"], thumbnailSize: "standard",
    });
    assert.equal(playlistMetadataFetches, 1, "Playlist yalnız kimlik ve sahiplik doğrulaması için okunmalı");
    assert.equal(catalogFetches, 0, "Kanal ekleme video kataloğu taramasını çağırmamalı");

    source.fetchPlaylistMetadata = async (url) => ({
      playlistId: "PL1234567890abc", title: "Başka Kanal", channelId: "UCotherChannel", url,
    });
    await assert.rejects(
      catalog.addChannel(db, { url: "https://www.youtube.com/@example-d", playlistUrl }),
      /girilen YouTube kanalına ait değil/u,
    );
    assert.equal(store.getChannel(db, "UCchannelD").playlistTitle, "Kanal D Seçkisi", "Geçersiz playlist mevcut kaynak seçimini değiştirmemeli");

    let syncInput = null;
    source.fetchCatalog = async (_url, _mode, input) => {
      syncInput = input;
      return {
        payload: { entries: [] },
        identity: { channelId: "UCchannelD", title: "Kanal D", handle: "@example-d" },
        options: input.mediaOptions,
        filters: source.scanFilters(input),
        detailStats: { requested: 0, completed: 0, unavailable: 0, skipped: 0 },
      };
    };
    await catalog.syncChannel(db, process.cwd(), { channelId: "UCchannelD", mode: "full" });
    assert.equal(syncInput.playlistUrl, playlistUrl, "Manuel senkronizasyon kayıtlı playlist ile sınırlandırılmalı");
  } finally {
    source.ytDlpStatus = originalStatus;
    source.fetchChannelIdentity = originalIdentity;
    source.fetchPlaylistMetadata = originalPlaylistMetadata;
    source.fetchCatalog = originalCatalog;
  }
}

verifyChannelAdditionDoesNotSync()
  .then(() => console.log("youtube multi-channel contracts ready"))
  .catch((error) => { console.error(error); process.exitCode = 1; });
