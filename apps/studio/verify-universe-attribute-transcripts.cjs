"use strict";
const assert=require("node:assert/strict");
const {DatabaseSync}=require("node:sqlite");
const workspace=require("./universe-workspace.cjs");
const quality=require("./universe-attribute-quality.cjs");
const source=require("./universe-attribute-transcripts.cjs");
const ai=require("./ai-client.cjs");
const previous=ai.chat;
let mockChat;
ai.chat=(...args)=>mockChat(...args);
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
workspace.ensureSchema(db);
db.exec(`CREATE TABLE IF NOT EXISTS source_transcripts (
 provider TEXT NOT NULL, external_id TEXT NOT NULL, source TEXT NOT NULL,
 language TEXT NOT NULL, text TEXT NOT NULL,
 PRIMARY KEY(provider,external_id)) STRICT;`);
const content="Kral Aruhan bizim Müslüman dostumuz. Başka biri değil, Kral Aruhan Müslüman olduğunu açıkladı. Aruhan Babil'in kralı olarak hüküm sürüyor.";
db.prepare("INSERT INTO source_transcripts(provider,external_id,source,language,text) VALUES('youtube','vid-real','youtube','tr',?)")
  .run(content);
db.prepare("INSERT INTO source_transcripts(provider,external_id,source,language,text) VALUES('youtube','vid-english','youtube','en',?)")
  .run(content);
const node=db.prepare("INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,aliases_json,payload_json,source_video_ids_json,state) VALUES (?,1,'character',?,?,?,?,?,'approved')");
node.run("character-source-1","Kral Arohan","Babil Kralı",JSON.stringify(["Aruhan","Kral Aruhan"]),JSON.stringify({details:[]}),JSON.stringify(["vid-real","vid-english"]));
node.run("character-source-2","Örnek Karakter","Kısa kayıt","[]",JSON.stringify({details:[]}),JSON.stringify(["vid-real"]));
const n=db.prepare("SELECT * FROM universe_workspace_nodes WHERE key='character-source-1'").get();
const attrs=require("./universe-attributes.cjs");
attrs.ensureSchema(db);
assert.ok(db.prepare("PRAGMA table_info(universe_entity_attribute_analysis)").all().some(row=>row.name==="source_version"));
const cache=new Map(),examples=source.sourceExcerpts(db,n,{},cache);
assert.ok(examples.some(x=>x.text.includes("Müslüman olduğunu")), "Linked Turkish transcript should be included");
assert.ok(examples.some(x=>x.text.includes("kralı")), "Rank evidence should be visible");
assert.equal(examples.every(x=>x.sourceVideoId==="vid-real"),true,"Non-Turkish source must be ignored");
const i=examples.findIndex(x=>x.text.includes("Müslüman olduğunu"));
assert.ok(i>=0);
const good={sourceType:"transcript",transcriptIndex:i,quote:"Kral Aruhan Müslüman olduğunu açıkladı",sourceVideoId:"vid-real"};
const validated=quality.evidenceFor(n,{details:[]},[good],examples,cache);
assert.equal(validated.length,1);
assert.equal(validated[0].sourceType,"transcript");
assert.equal(validated[0].detailIndex,-1);
assert.equal(quality.validateSuggestion("character","sideStatus","aydinlik",validated),true);
assert.equal(quality.evidenceFor(n,{details:[]},[{...good,quote:"Uydurma bir alıntı, videoda bulunmuyor."}],examples,cache).length,0);
assert.equal(quality.evidenceFor(n,{details:[]},[{...good,sourceVideoId:"vid-english"}],examples,cache).length,0);
assert.equal(quality.evidenceFor(n,{details:[]},[{...good,transcriptIndex:99}],examples,cache).length,0);
mockChat=async(_,messages)=>{
  const records=JSON.parse(messages[1].content);
  assert.equal(records.length,2);
  assert.ok(records[0].transcriptExcerpts.some(x=>x.sourceVideoId==="vid-real"));
  return JSON.stringify({records:records.map(record=>({
    key:record.key,
    fields:record.key==="character-source-1"?{
      sideStatus:{value:"aydinlik",reason:"Doğrudan isimle verilen durum",evidence:[good]},
      rank:{value:"Kral",reason:"Doğrudan unvan",evidence:[{sourceType:"transcript",transcriptIndex:i,quote:"Aruhan Babil'in kralı",sourceVideoId:"vid-real"}]},
      species:{value:"Cin",reason:"Uydurma",evidence:[{sourceType:"transcript",transcriptIndex:i,quote:"Kral Aruhan cin olduğunu açıkça söyledi",sourceVideoId:"vid-real"}]}
    }:{}
  }))});
};
(async()=>{
 try{
  const result=await attrs.suggest(db,"unused",{keys:["character-source-1","character-source-2"]});
  assert.equal(result.evaluated,2);
  assert.equal(result.proposed,2);
  assert.equal(result.filtered.invalidEvidence,1);
  const listed=attrs.list(db);
  assert.equal(listed.profiles.length,0,"Never approve automatically");
  assert.equal(listed.analyses.find(x=>x.entityKey==="character-source-1").sourceVersion,2);
  assert.equal(listed.proposals.filter(x=>x.entityKey==="character-source-1").length,2);
  assert.ok(listed.proposals.find(x=>x.field==="sideStatus").evidence[0].sourceType==="transcript");
  attrs.review(db,{action:"approve",items:[{entityKey:"character-source-1",field:"sideStatus"}]});
  assert.equal(attrs.list(db).provenance.find(x=>x.field==="sideStatus").evidence[0].sourceType,"transcript");
  console.log("PASS: transcript candidates, identity-linked evidence, invalid-quote rejection, source version, manual review, provenance retention");
 }finally{
  ai.chat=previous;
  db.close();
 }
})().catch(e=>{console.error(e.stack);process.exitCode=1});
