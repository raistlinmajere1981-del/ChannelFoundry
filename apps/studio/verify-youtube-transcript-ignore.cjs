"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {DatabaseSync} = require("node:sqlite");
const ignore = require("./youtube-transcript-ignore.cjs");
const catalogue = require("./youtube-catalog-store.cjs");
const transcript = require("./transcript-youtube.cjs");
const ytDlp = require("./ytdlp-manager.cjs");

async function test() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-ignored-subs-"));
  const oldStatus = ytDlp.status;
  const oldExecutable = ytDlp.executablePath;
  const db = new DatabaseSync(":memory:");
  const id = "AbCdEfGhI12";
  try {
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("CREATE TABLE content_items (key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'draft') STRICT;");
    db.exec("CREATE TABLE content_sources (content_key TEXT NOT NULL, provider TEXT NOT NULL, external_id TEXT NOT NULL, canonical_url TEXT NOT NULL) STRICT;");
    catalogue.ensureSchema(db);
    db.prepare("INSERT INTO youtube_channels (id,url,title,handle,subtitle_languages_json) VALUES (?,?,?,?,?)")
      .run("UCtest", "https://www.youtube.com/@example", "Example", "@example", JSON.stringify(["tr","en"]));
    db.prepare("INSERT INTO youtube_videos (video_id,channel_id,title,canonical_url,thumbnail_url) VALUES (?,?,?,?,?)")
      .run(id, "UCtest", "Example video", "https://www.youtube.com/watch?v=" + id, "https://example.com/thumb.jpg");
    const fake = path.join(dir, "fake-ytdlp");
    fs.writeFileSync(fake, "#!/usr/bin/env node\n" +
      "const fs=require('node:fs');const args=process.argv.slice(2);" +
      "fs.appendFileSync(process.env.SUBS_TEST_LOG,'attempt\\n');" +
      "if(process.env.SUBS_TEST_MODE==='temporary'){" +
      "console.error('HTTP Error 429: Too Many Requests'); process.exit(1);}" +
      "if(process.env.SUBS_TEST_MODE==='success'){" +
      "const i=args.indexOf('--output'); const path=args[i+1].replace('%(id)s','AbCdEfGhI12').replace('%(ext)s','tr.vtt');" +
      "fs.writeFileSync(path,'WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\nMerhaba dunya\\n');}" +
      "else console.log('There are no subtitles for the requested languages');\n");
    fs.chmodSync(fake, 0o755);
    ytDlp.status = async () => ({available: true, version: "fake"});
    ytDlp.executablePath = () => fake;
    process.env.SUBS_TEST_LOG = path.join(dir, "calls");
    process.env.SUBS_TEST_MODE = "no-subtitles";

    await assert.rejects(() => transcript.fetchYoutubeTranscript(db, {videoId: id}),
      (error) => error.code === "CHANNEL_FOUNDRY_SUBTITLE_UNAVAILABLE");
    assert.equal(ignore.isIgnored(db, id, ["tr","en"]), true);
    assert.equal(ignore.isIgnored(db, id, ["de"]), false, "different subtitle language must be retryable");
    assert.deepEqual(ignore.ignoredVideoIds(db, ["tr","en"]), [id]);
    const calls = fs.readFileSync(process.env.SUBS_TEST_LOG,"utf8").trim().split("\n").length;
    assert.equal(calls, 2, "manual and automatic subtitles were attempted");

    await assert.rejects(() => transcript.fetchYoutubeTranscript(db, {videoId:id}),
      (error) => error.code === "CHANNEL_FOUNDRY_SUBTITLE_IGNORED");
    assert.equal(fs.readFileSync(process.env.SUBS_TEST_LOG,"utf8").trim().split("\n").length,2);

    const videos = catalogue.listVideos(db, {});
    assert.equal(videos.length,1);
    assert.equal(videos[0].subtitleIgnored,true);

    // Transcript download exclusions do not suppress independent YouTube metadata checks.
    const source = require("./youtube-catalog-source.cjs");
    const catalogApi = require("./youtube-catalog.cjs");
    const originalSourceStatus = source.ytDlpStatus;
    const originalFetchCatalog = source.fetchCatalog;
    let observedSkip = false;
    try {
      source.ytDlpStatus = async () => ({available:true, version:"fake"});
      source.fetchCatalog = async (_url, _mode, input) => {
        observedSkip = input.skipVideoIds.includes(id);
        return {
          payload: {entries:[]},
          identity: {channelId:"UCtest",title:"Example",handle:"@example"},
          options:input.mediaOptions,
          filters:source.scanFilters(input),
          detailStats:{requested:0, completed:0, unavailable:0, skipped:0},
        };
      };
      await catalogApi.syncChannel(db, dir, {channelId:"UCtest",mode:"recent"});
      assert.equal(observedSkip,false,"ignored transcript downloads must not suppress metadata checks");
    } finally {
      source.ytDlpStatus = originalSourceStatus;
      source.fetchCatalog = originalFetchCatalog;
    }
    db.prepare("UPDATE youtube_channels SET subtitle_languages_json=? WHERE id='UCtest'").run(JSON.stringify(["de"]));
    assert.equal(catalogue.listVideos(db,{})[0].subtitleIgnored,false,"changing languages should reveal an old ignored video");
    db.prepare("UPDATE youtube_channels SET subtitle_languages_json=? WHERE id='UCtest'").run(JSON.stringify(["tr","en"]));
    assert.equal(catalogue.listVideos(db,{})[0].subtitleIgnored,true);

    ignore.clear(db, id);
    assert.equal(catalogue.listVideos(db,{})[0].subtitleIgnored,false);
    process.env.SUBS_TEST_MODE = "temporary";
    await assert.rejects(() => transcript.fetchYoutubeTranscript(db, {videoId:id}), /429/);
    assert.equal(ignore.isIgnored(db,id,["tr","en"]),false,"429 must remain retryable");

    process.env.SUBS_TEST_MODE = "success";
    const saved = await transcript.fetchYoutubeTranscript(db,{videoId:id});
    assert.equal(saved.wordCount,2);
    assert.equal(ignore.isIgnored(db,id,["tr","en"]),false);
    console.log("PASS YouTube subtitle exclusions: persisted, no repeat download, language scoping, clear/retry, transient 429, success");
  } finally {
    ytDlp.status=oldStatus;
    ytDlp.executablePath=oldExecutable;
    delete process.env.SUBS_TEST_LOG;
    delete process.env.SUBS_TEST_MODE;
    db.close();
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
test().catch((error)=>{console.error(error);process.exitCode=1;});
