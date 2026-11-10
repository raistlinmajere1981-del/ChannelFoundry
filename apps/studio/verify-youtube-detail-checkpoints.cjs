"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const source = require("./youtube-catalog-source.cjs");
const store = require("./youtube-catalog-store.cjs");
const checkpoints = require("./youtube-detail-checkpoints.cjs");
const ytDlp = require("./ytdlp-manager.cjs");

const A = "AAAAAAAAAAA", B = "BBBBBBBBBBB", C = "CCCCCCCCCCC", D = "DDDDDDDDDDD";
const channelId = "channel-checkpoint-test";
const options = { metadataLanguage: "tr", subtitleLanguages: ["tr"], thumbnailSize: "standard" };
const signature = source.detailSignature(options);
const base = new Date("2026-11-10T12:00:00.000Z");
const outputLine = (id, subtitle) => [
  id, JSON.stringify("Bir test videosu"), "20261110", "", "", "180", "public", "not_live", "1", "2",
  subtitle === "none" ? "0" : "1", "0",
].join("\t");
const quote = (text) => "'" + String(text).replace(/'/g, "'\\''") + "'";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "youtube-detail-checkpoints-"));
  const filename = path.join(dir, "catalog.sqlite");
  let db = null;
  const originalExecutable = ytDlp.executablePath;
  try {
    db = new DatabaseSync(filename);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(`CREATE TABLE content_items (key TEXT PRIMARY KEY, status TEXT NOT NULL) STRICT;
      CREATE TABLE content_sources (content_key TEXT NOT NULL, provider TEXT NOT NULL, external_id TEXT NOT NULL) STRICT;`);
    store.ensureSchema(db);
    db.prepare("INSERT INTO youtube_channels (id,url,title,handle,metadata_language,subtitle_languages_json) VALUES (?,?,?,?,?,?)")
      .run(channelId, "https://www.youtube.com/@checkpoint-test", "Test", "@checkpoint-test", "tr", JSON.stringify(["tr"]));

    const executable = path.join(dir, "fake-yt-dlp");
    const makeExecutable = (script) => {
      fs.writeFileSync(executable, "#!/bin/sh\n" + script, { mode: 0o700 });
      fs.chmodSync(executable, 0o700);
    };
    ytDlp.executablePath = () => executable;

    // Use a fake executable on POSIX; Windows verifies the same durable schema without /bin/sh.
    if (process.platform !== "win32") {
    // Interrupted scan: successful video is immediately durable; catalogue wasn't committed.
    makeExecutable("printf '%s\\n' " + quote(outputLine(A, "manual")) + "\nsleep 2\nprintf '%s\\n' " + quote(outputLine(B, "manual")) + "\n");
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 180);
    await assert.rejects(
      source.fetchDetailedEntries("https://www.youtube.com/@checkpoint-test/videos", "full", options, {
        signal: controller.signal, videoIds: [A, B], playlistItems: [1, 2],
        onEntry: (detail) => checkpoints.record(db, { channelId, videoId: detail.id, signature, detail }),
      }),
      (error) => error.code === "CHANNEL_FOUNDRY_SYNC_CANCELLED",
    );
    clearTimeout(abortTimer);
    } else {
      checkpoints.record(db, { channelId, videoId: A, signature, detail: {
        id: A, subtitle_status: "manual", subtitle_languages: ["tr"], automatic_caption_languages: [],
      } });
    }
    assert.equal(db.prepare("SELECT count(*) AS count FROM youtube_videos").get().count, 0);
    assert.deepEqual(checkpoints.load(db, channelId, signature).skipVideoIds, [A]);
    db.close(); db = null;

    db = new DatabaseSync(filename);
    db.exec("PRAGMA foreign_keys = ON;");
    assert.deepEqual(checkpoints.load(db, channelId, signature).skipVideoIds, [A], "Checkpoint survives process restart");
    assert.equal(checkpoints.load(db, channelId, signature).cachedDetails[0].subtitle_status, "manual");

    // A known access restriction has a separate state from a transient error or no subtitles.
    if (process.platform !== "win32") {
    makeExecutable("printf '%s\\n' " + quote(outputLine(A, "manual")) +
      "\nprintf '%s\\n' " + quote("ERROR: [youtube] " + B + ": Private video") + " >&2\n");
    const result = await source.fetchDetailedEntries("https://www.youtube.com/@checkpoint-test/videos", "full", options, {
      videoIds: [A, B], playlistItems: [1, 2],
      onEntry: (detail) => checkpoints.record(db, { channelId, videoId: detail.id, signature, detail, now: base }),
      onFailed: ({ videoId, error }) => checkpoints.record(db, { channelId, videoId, signature, error, now: base }),
      allowEmpty: true,
    });
    assert.equal(result.length, 1);
    } else {
      checkpoints.record(db, { channelId, videoId: B, signature, error: "Private video", now: base });
    }
    assert.equal(db.prepare("SELECT result FROM youtube_detail_checks WHERE video_id=?").get(B).result, "unavailable");
    assert.equal(checkpoints.load(db, channelId, signature, base).deferredVideoIds.includes(B), true);
    assert.equal(checkpoints.load(db, channelId, signature, new Date("2026-11-25T12:00:00Z")).deferredVideoIds.includes(B), false);

    checkpoints.record(db, { channelId, videoId: C, signature, detail: {
      id: C, subtitle_status: "none", subtitle_languages: [], automatic_caption_languages: [],
    }, now: base });
    assert.equal(db.prepare("SELECT result FROM youtube_detail_checks WHERE video_id=?").get(C).result, "none");
    assert.equal(checkpoints.load(db, channelId, signature).skipVideoIds.includes(C), true);

    const first = checkpoints.record(db, { channelId, videoId: D, signature, error: "HTTP Error 429", now: base });
    const second = checkpoints.record(db, { channelId, videoId: D, signature, error: "HTTP Error 429", now: new Date("2026-11-10T12:35:00Z") });
    assert.equal(first.result, "retry");
    assert.equal(first.failureCount, 1);
    assert.equal(first.retryAt, "2026-11-10T12:30:00.000Z");
    assert.equal(second.failureCount, 2);
    assert.equal(second.retryAt, "2026-11-10T13:35:00.000Z");
    assert.equal(checkpoints.load(db, channelId, signature, base).deferredVideoIds.includes(D), true);
    assert.equal(checkpoints.load(db, channelId, signature, new Date("2026-11-11T12:00:00Z")).deferredVideoIds.includes(D), false);
    assert.equal(checkpoints.load(db, channelId, '{"metadataLanguage":"tr","subtitleLanguages":["de"]}').skipVideoIds.length, 0);

    // Unknown YouTube metadata remains independent from local transcript and archive existence.
    db.prepare("INSERT INTO youtube_videos (video_id,channel_id,title,canonical_url,thumbnail_url,subtitle_status) VALUES (?,?,?,?,?,?)")
      .run(D, channelId, "D", "https://www.youtube.com/watch?v=" + D, "https://i.ytimg.com/vi/" + D + "/hqdefault.jpg", "unknown");
    const video = store.listVideos(db, { channelId }).find((row) => row.videoId === D);
    assert.equal(video.subtitleStatus, "unknown");
    assert.equal(video.detailCheckStatus, "retry");
    assert.equal(video.hasTranscript, false);
    assert.equal(video.detailRetryAt, second.retryAt);

    // Once metadata is checked (even without publication date), it is reusable.
    db.prepare("UPDATE youtube_videos SET subtitle_status='none', published_at='', detail_signature=? WHERE video_id=?").run(signature, D);
    assert.equal(store.detailedVideoIds(db, signature, channelId).includes(D), true);
    console.log("PASS durable metadata checkpoints: abort/restart, access error, no-subtitle, retry backoff, language isolation, archive independence");
  } finally {
    ytDlp.executablePath = originalExecutable;
    db?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
