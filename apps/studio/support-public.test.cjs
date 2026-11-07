const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const editorial = require('./ai-analysis-editorial.cjs');
const records = require('./ai-support-records.cjs');
const { publicationSupport } = require('./support-public.cjs');
function fixture() {
const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE source_ai_analyses (
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    topics_json TEXT NOT NULL DEFAULT '[]',
    story_beats_json TEXT NOT NULL DEFAULT '[]',
    story_hints_json TEXT NOT NULL DEFAULT '[]',
    cover_visual_json TEXT NOT NULL DEFAULT '{}',
    characters_json TEXT NOT NULL DEFAULT '[]',
    locations_json TEXT NOT NULL DEFAULT '[]',
    objects_json TEXT NOT NULL DEFAULT '[]',
    scenes_json TEXT NOT NULL DEFAULT '[]',
    sponsors_json TEXT NOT NULL DEFAULT '[]',
    contributors_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(provider, external_id)
  ) STRICT;
  CREATE TABLE youtube_videos (
    video_id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    published_at TEXT NOT NULL DEFAULT '',
    canonical_url TEXT NOT NULL DEFAULT ''
  ) STRICT;
`);


editorial.ensureSchema(db);
for (const [id,date] of [['support0001','2026-10-02T15:45:00Z'],['support0002','2026-10-03'],['support0003','2026-10-04']]) {
 db.prepare("INSERT INTO youtube_videos(video_id,title,published_at,canonical_url) VALUES(?,?,?,?)").run(id,id,date,'https://www.youtube.com/watch?v='+id);
 db.prepare("INSERT INTO source_ai_analyses(provider,external_id,title,sponsors_json,contributors_json) VALUES('youtube',?,?,?,?)").run(id,id,JSON.stringify(['Elif',' elif ']),JSON.stringify(['Can']));
 editorial.saveReview(db,{videoId:id,state:id==='support0003'?'excluded':'curated',decisions:{},manualSponsors:[],manualContributors:[]});
}
return db;
}
test('publication support uses the catalog video identity, preserves roles and normalizes ISO dates',()=>{
 const db=fixture();try{
  const result=publicationSupport(db,[{videoId:'support0001'}]);
  assert.deepEqual(result.sponsors.map(row=>row.name),['Elif']);
  assert.deepEqual(result.contributors.map(row=>row.name),['Can']);
  assert.equal(result.sponsors[0].video.id,'support0001');assert.equal(result.sponsors[0].date,'2026-10-02');
 }finally{db.close();}
});
test('unpublished and excluded video records remain editable but are excluded from the publication allowlist',()=>{
 const db=fixture();try{
  const result=publicationSupport(db,[]);assert.deepEqual(result,{sponsors:[],contributors:[]});
  assert.ok(records.supportSources(db).some(row=>row.state==='excluded'));
 }finally{db.close();}
});
test('moving a credit to a missing video is rejected without deleting the original',()=>{
 const db=fixture();try{
  const before=records.supportRecords(db);assert.throws(()=>records.saveSupportRecord(db,{videoId:'support0001',kind:'sponsor',originalName:'Elif',name:'Elif',targetVideoId:'missing'}),/video/);
  assert.deepEqual(records.supportRecords(db),before);
 }finally{db.close();}
});
test('moving a record between valid videos preserves the sponsor/contributor distinction',()=>{
 const db=fixture();try{
  records.saveSupportRecord(db,{videoId:'support0001',kind:'sponsor',originalName:'Elif',name:'Elif',targetVideoId:'support0002',targetKind:'contributor'});
  const rows=records.supportRecords(db);assert.ok(!rows.some(row=>row.videoId==='support0001'&&row.kind==='sponsor'));assert.ok(rows.some(row=>row.videoId==='support0002'&&row.kind==='contributor'&&row.name==='Elif'));
 }finally{db.close();}
});
test('orphan video relations are visible to Studio and cannot silently publish',()=>{
 const db=fixture();try{
  db.prepare("DELETE FROM youtube_videos WHERE video_id='support0001'").run();
  assert.equal(records.supportSources(db).find(row=>row.videoId==='support0001').sourceValid,false);
  assert.deepEqual(publicationSupport(db,[]).sponsors,[]);
 }finally{db.close();}
});

test('a mid-move editorial failure rolls back both source and destination',()=>{
 const db=fixture();try{
  db.prepare("DELETE FROM source_ai_analyses WHERE external_id='support0002'").run();
  const before=records.supportRecords(db);
  assert.throws(()=>records.saveSupportRecord(db,{videoId:'support0001',kind:'sponsor',originalName:'Elif',name:'Elif',targetVideoId:'support0002'}));
  assert.deepEqual(records.supportRecords(db),before);
 }finally{db.close();}
});

test('hundreds of AI and manual support names survive save, reread and publication without truncation',()=>{
 const db=fixture();try{
  const ai=Array.from({length:450},(_,i)=>`AI Destekçi ${i+1}`);
  const manual=Array.from({length:501},(_,i)=>`Manuel Destekçi ${i+1}`);
  db.prepare("UPDATE source_ai_analyses SET contributors_json=? WHERE external_id='support0001'").run(JSON.stringify(ai));
  editorial.saveReview(db,{videoId:'support0001',state:'curated',decisions:{},manualSponsors:[],manualContributors:manual});
  const pack=editorial.editorialPackage(db,'support0001');assert.equal(pack.manualContributors.length,501);
  assert.equal(pack.items.filter(item=>item.category==='contributor').length,450);
  const published=publicationSupport(db,[{videoId:'support0001'}]);assert.equal(published.contributors.length,951);
  assert.ok(published.contributors.some(row=>row.name==='AI Destekçi 450'));assert.ok(published.contributors.some(row=>row.name==='Manuel Destekçi 501'));
  records.saveSupportRecord(db,{videoId:'support0001',kind:'contributor',name:'Sonraki destekçi'});
  assert.equal(publicationSupport(db,[{videoId:'support0001'}]).contributors.length,952);
 }finally{db.close();}
});
