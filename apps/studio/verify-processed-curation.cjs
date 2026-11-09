const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const aiAnalysis = require("./ai-analysis.cjs");
const ingest = require("./universe-ingest.cjs");

const db = new DatabaseSync(":memory:");
aiAnalysis.ensureSchema(db);
ingest.ensureSchema(db);

db.prepare(`
  INSERT INTO source_ai_analyses (
    provider, external_id, model, title, summary, topics_json, story_beats_json, story_hints_json,
    cover_visual_json, characters_json, locations_json, objects_json, scenes_json, sponsors_json, contributors_json
  ) VALUES ('youtube','video-a','test-model','Video A','Özet','[]','[]','[]','{}',?,'[]','[]','[]',?,'[]')
`).run(
  JSON.stringify([{ name: "Ömer", aliases: [], role: "Araştırmacı", details: ["Defteri inceler"], visual: {} }]),
  JSON.stringify(["Sponsor A"]),
);

const initial = aiAnalysis.editorialPackage(db, "video-a");
const initialDecisions = Object.fromEntries(initial.items.map((item) => [item.key, item.decision]));
aiAnalysis.editorialSave(db, {
  videoId: "video-a",
  state: "curated",
  decisions: initialDecisions,
  manualSponsors: [],
  manualContributors: [],
});

db.prepare(`
  INSERT INTO universe_ingest_sources (provider, external_id, fingerprint, last_run_id)
  VALUES ('youtube','video-a','processed',1)
`).run();

const locked = aiAnalysis.editorialPackage(db, "video-a");
assert.equal(locked.universeLocked, true, "Evrene işlenmiş video Ayıklama katmanında kilitli görünmeli");
const lockedDecisions = Object.fromEntries(locked.items.map((item) => [item.key, item.decision]));

assert.throws(() => aiAnalysis.editorialSave(db, {
  videoId: "video-a",
  state: "excluded",
  decisions: lockedDecisions,
  manualSponsors: [],
  manualContributors: [],
}), /Evrene daha önce işlendiği için/);

const character = locked.items.find((item) => item.category === "character");
assert.ok(character, "Test videosunda Muhatap malzemesi bulunmalı");
const changedCharacterDecision = character.decision === "include" ? "context" : "include";
assert.throws(() => aiAnalysis.editorialSave(db, {
  videoId: "video-a",
  state: "curated",
  decisions: { ...lockedDecisions, [character.key]: changedCharacterDecision },
  manualSponsors: [],
  manualContributors: [],
}), /Evren malzemesi Ayıklama ekranından değiştirilemez/);

const supportSaved = aiAnalysis.editorialSave(db, {
  videoId: "video-a",
  state: "curated",
  decisions: lockedDecisions,
  manualSponsors: ["Manuel Sponsor"],
  manualContributors: ["Katkı A"],
});
assert.equal(supportSaved.universeLocked, true);
assert.deepEqual(aiAnalysis.curatedResult(db, "video-a").sponsors.sort(), ["Manuel Sponsor", "Sponsor A"].sort());
assert.deepEqual(aiAnalysis.curatedResult(db, "video-a").contributors, ["Katkı A"]);

require('./youtube-catalog.cjs').ensureSchema(db);
require('./transcript-store.cjs').ensureSchema(db);
db.exec("CREATE TABLE content_items(key TEXT PRIMARY KEY,title TEXT,summary TEXT,updated_at TEXT);CREATE TABLE content_sources(content_key TEXT,provider TEXT,external_id TEXT);INSERT INTO youtube_channels(id,url,title) VALUES('test-channel','https://www.youtube.com/@test','Test');INSERT INTO youtube_videos(video_id,channel_id,title,canonical_url,thumbnail_url) VALUES('video-a','test-channel','Video A','https://www.youtube.com/watch?v=video-a','');INSERT INTO source_transcripts(provider,external_id,source,language,text) VALUES('youtube','video-a','manual','tr','Yeni kaynak metni');");
assert.equal(aiAnalysis.enqueue(db,{videoIds:['video-a'],force:true}).accepted,1);
aiAnalysis.complete(db,'video-a','test-model',{title:'Yeni çözümleme',summary:'Yeni kaynak çözümlemesi',topics:[],storyBeats:[],storyHints:[],coverVisual:{},characters:[],locations:[],objects:[],scenes:[],sponsors:[],contributors:[]});
assert.equal(aiAnalysis.getResult(db,'video-a').title,'Yeni çözümleme');
assert.equal(aiAnalysis.editorialPackage(db,'video-a').universeLocked,false,'New source revisions reopen human review');

db.close();
console.log("Processed universe records stay intact; new source revisions reopen curation and invalidate publication variants");
