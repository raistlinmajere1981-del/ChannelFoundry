const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
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

console.log("youtube multi-channel contracts ready");
