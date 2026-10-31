"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const ytDlp = require("./ytdlp-manager.cjs");
const catalog = require("./youtube-catalog.cjs");
const store = require("./youtube-catalog-store.cjs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-media-prechannel-"));
const db = new DatabaseSync(":memory:");
let notified = 0;
try {
  ytDlp.configure(tmp, () => { notified++; });
  const initial = catalog.channelMediaOptions(db);
  assert.deepEqual(initial, {
    channelId: "", metadataLanguage: "tr", subtitleLanguages: ["tr", "en"], thumbnailSize: "standard",
  }, "No channel should still return usable form settings");

  const chosen = catalog.saveChannelMediaOptions(db, {
    channelId: "", metadataLanguage: "de", subtitleLanguages: ["de", "tr"], thumbnailSize: "large",
  });
  assert.deepEqual(chosen, {
    channelId: "", metadataLanguage: "de", subtitleLanguages: ["de", "tr"], thumbnailSize: "large",
  });
  assert.deepEqual(catalog.channelMediaOptions(db), chosen, "Choices must survive reload before first sync");
  assert.deepEqual(ytDlp.mediaOptions(), {
    metadataLanguage: "de", subtitleLanguages: ["de", "tr"], thumbnailSize: "large",
  });
  assert.ok(notified > 0, "Persisted preferences notify Studio of changes");
  const savedFile = path.join(tmp, "tools", "yt-dlp", "settings.json");
  assert.equal(JSON.parse(fs.readFileSync(savedFile, "utf8")).metadataLanguage, "de");

  store.registerChannel(db, { channelId: "UCFIRST", title: "First" },
    "https://www.youtube.com/@first", ytDlp.mediaOptions());
  assert.deepEqual(catalog.channelMediaOptions(db), {
    channelId: "UCFIRST", metadataLanguage: "de", subtitleLanguages: ["de", "tr"], thumbnailSize: "large",
  }, "First channel must inherit choices made before it was connected");
  const updated = catalog.saveChannelMediaOptions(db, {
    channelId: "UCFIRST", metadataLanguage: "fr", subtitleLanguages: ["fr"], thumbnailSize: "small",
  });
  assert.deepEqual(catalog.channelMediaOptions(db), updated, "Connected channel saves its own preferences");
  assert.equal(ytDlp.mediaOptions().metadataLanguage, "de", "Channel edits must not change project defaults");

  store.registerChannel(db, { channelId: "UCSECOND", title: "Second" },
    "https://www.youtube.com/@second", ytDlp.mediaOptions());
  assert.equal(catalog.channelMediaOptions(db).metadataLanguage, "de",
    "Second channel inherits project defaults, not first channel changes");
  store.setActiveChannel(db, "UCFIRST");
  assert.deepEqual(catalog.channelMediaOptions(db), updated, "Switching channel restores own options");
  assert.throws(() => catalog.saveChannelMediaOptions(db, {
    channelId: "UCNOTFOUND", metadataLanguage: "es",
  }), /bulunamadı/);

  const ui = fs.readFileSync(path.join(__dirname, "src", "VideoArchive.tsx"), "utf8");
  assert.ok(ui.includes('INITIAL_MEDIA_OPTIONS'), "Form needs defaults while options load");
  assert.ok(ui.includes('className="channel-media-options"'), "Controls always render");
  assert.ok(!ui.includes('{mediaOptions && <div className="channel-media-options"'),
    "Controls may not be hidden when no channel is connected");
  assert.ok(ui.includes("disabled={!mediaOptions || Boolean(busy) || optionsBusy}"),
    "Form is disabled only while initial options load or an operation runs");
  console.log("Video Archive media options: visible before sync, persisted defaults, per-channel isolation PASS");
} finally {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
