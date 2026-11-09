"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const bridge = require("./nexa-analysis-bridge.cjs");
const analysisService = require("./ai-analysis.cjs");
const { exportNext, check } = require("./nexa-analysis-cli.cjs");

const A = "00000000001", B = "00000000002", C = "00000000003", D = "00000000004";
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec([
    "CREATE TABLE youtube_channels(id TEXT PRIMARY KEY,is_active INTEGER NOT NULL);",
    "CREATE TABLE youtube_videos(video_id TEXT PRIMARY KEY,channel_id TEXT,title TEXT,published_at TEXT,",
    "duration_seconds INTEGER,canonical_url TEXT,thumbnail_url TEXT,availability TEXT DEFAULT '');",
    "CREATE TABLE source_transcripts(provider TEXT,external_id TEXT,source TEXT,language TEXT,text TEXT,",
    "PRIMARY KEY(provider,external_id));",
    "CREATE TABLE content_items(key TEXT PRIMARY KEY,title TEXT,summary TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);",
    "CREATE TABLE content_sources(content_key TEXT,provider TEXT,external_id TEXT);",
    "INSERT INTO youtube_channels VALUES ('on',1),('off',0);",
  ].join("\n"));
  const video = db.prepare("INSERT INTO youtube_videos(video_id,channel_id,title,published_at,duration_seconds,canonical_url,thumbnail_url) VALUES(?,?,?,?,?,?,?)");
  const subtitle = db.prepare("INSERT INTO source_transcripts VALUES('youtube',?,'youtube','tr',?)");
  for (const [id, date, channel] of [
    [A, "2025-01-02", "on"], [B, "2025-01-01", "on"],
    [C, "2025-01-01", "on"], [D, "2024-01-01", "off"],
  ]) {
    video.run(id,channel,"Video "+id,date,250,"https://www.youtube.com/watch?v="+id,"");
    subtitle.run(id,"Anlatıcı eski kitaptan söz etti. Eserde bir kapı ve anahtar bulundu. Kaynak "+id);
  }
  analysisService.ensureSchema(db);
  return db;
}
function response(db, videoId) {
  const { request } = bridge.requestFor(db, videoId);
  const result = bridge.blankResponse(request);
  result.analysis.summary = "Konuşmacı bir kitap ve kapıdan söz ediyor.";
  result.analysis.storyBeats = ["Konuşmacı eski kitaptan söz etti."];
  result.analysis.evidence = [{
    id: "ref-1", startSeconds: 0, endSeconds: 0,
    excerpt: "Anlatıcı eski kitaptan söz etti.", topic: "kitap",
  }];
  return result;
}

test("eski tarihten başlanır, aynı tarihte ID sıralanır ve aktif kanal dışı atlanır", () => {
  const db = fixture();
  try {
    assert.deepEqual(bridge.next(db, 3).map(v => v.videoId), [B,C,A]);
    assert.throws(() => bridge.next(db, 0), /Video adedi/);
    assert.throws(() => bridge.next(db, 21), /Video adedi/);
  } finally { db.close(); }
});

test("başka AI kuyruğundaki video seçilmez ve dışa aktarma tekrar sonuçları silmez", () => {
  const db = fixture();
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "nexa-bridge-"));
  try {
    db.prepare("INSERT INTO ai_analysis_jobs(provider,external_id,state) VALUES('youtube',?,'waiting')").run(B);
    assert.deepEqual(bridge.next(db,3).map(v => v.videoId), [C,A]);
    const output = exportNext(db, path.join(folder, "requests"), 2);
    assert.equal(output.videos.length, 2);
    assert.match(fs.readFileSync(output.videos[0].transcriptFile,"utf8"), /Anlatıcı eski kitaptan/);
    const first = fs.readFileSync(output.videos[0].responseFile,"utf8");
    assert.equal(exportNext(db,path.join(folder,"requests"),2).videos[0].responseState, "existing");
    assert.equal(fs.readFileSync(output.videos[0].responseFile,"utf8"), first);
    assert.equal(analysisService.stats(db).analyzed, 0);
  } finally { db.close(); fs.rmSync(folder,{recursive:true,force:true}); }
});

test("geçerli sonuç Studio çözümlemesi ve editoryal pending olarak kaydedilir", () => {
  const db = fixture();
  try {
    const result = response(db,B);
    assert.equal(check(db,result).valid,true);
    const imported = bridge.importResult(db,result);
    assert.equal(imported.editorialState,"pending");
    assert.equal(imported.translation,"not-generated");
    const row = db.prepare("SELECT model,source_hash,core_json FROM source_ai_analyses WHERE external_id=?").get(B);
    assert.match(row.model,/ChatGPT GPT-6/);
    assert.equal(row.source_hash,result.sourceHash);
    assert.equal(JSON.parse(row.core_json).provider,"chatgpt-terminal");
    assert.equal(JSON.parse(row.core_json).promptVersion,bridge.BRIDGE_VERSION);
    assert.equal(analysisService.stats(db).analyzed,1);
    assert.equal(db.prepare("SELECT state FROM ai_analysis_jobs WHERE external_id=?").get(B).state,"done");
    assert.equal(db.prepare("SELECT state FROM ai_analysis_editorial_reviews WHERE external_id=?").get(B).state,"pending");
    assert.ok(db.prepare("SELECT 1 FROM publication_language_sources WHERE kind='video' AND id=?").get(B));
    assert.equal(bridge.next(db,3).some(item=>item.videoId===B),false);
    assert.throws(()=>bridge.importResult(db,result), /--replace/);
  } finally { db.close(); }
});

test("kanıtı olmayan veya şeması bozuk çözümleme kaydedilmez", () => {
  const db = fixture();
  try {
    const result = response(db,B);
    result.analysis.evidence[0].excerpt = "Uydurulmuş alıntı";
    assert.throws(() => bridge.importResult(db,result),/birebir/);
    assert.equal(analysisService.stats(db).analyzed,0);
    result.analysis.evidence[0].excerpt = "Anlatıcı eski kitaptan söz etti.";
    result.analysis.unknown = "kabul edilmez";
    assert.throws(() => bridge.importResult(db,result),/bilinmeyen alan/);
    assert.equal(analysisService.stats(db).analyzed,0);
  } finally { db.close(); }
});

test("altyazı güncellemesi eski dosyayı reddeder, yeniden çözümleme önerir", () => {
  const db = fixture();
  try {
    const result = response(db,B);
    db.prepare("UPDATE source_transcripts SET text=text || ' Yeni bir ifade.' WHERE external_id=?").run(B);
    assert.throws(() => bridge.importResult(db,result),/Altyazı değişmiş/);
    assert.equal(analysisService.stats(db).analyzed,0);
    const fresh = response(db,B);
    bridge.importResult(db,fresh);
    assert.equal(bridge.next(db,3).some(v=>v.videoId===B),false);
    db.prepare("UPDATE source_transcripts SET text=text || ' İkinci değişiklik.' WHERE external_id=?").run(B);
    const stale = bridge.next(db,3).find(v=>v.videoId===B);
    assert.equal(stale.reason,"source-changed");
    const newer = response(db,B);
    assert.throws(()=>bridge.importResult(db,newer),/--replace/);
    bridge.importResult(db,newer,{replace:true});
    assert.equal(db.prepare("SELECT state FROM ai_analysis_editorial_reviews WHERE external_id=?").get(B).state,"pending");
  } finally { db.close(); }
});
