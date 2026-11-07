"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const projects=require("./channel-projects.cjs");
const {DatabaseSync}=require("node:sqlite");
const workspace=require("./universe-workspace.cjs");
const narrative=require("./narrative-service.cjs");
const {POLICY}=require("./narrative-evidence.cjs");
const quality=require("./narrative-quality.cjs");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"stage4-evidence-"));
projects.createProject({id:"fixture",displayName:"Fixture",narrator:{displayName:"Deniz",mode:"neutral",editorialNote:""}},root);
const db=new DatabaseSync(":memory:");
projects.bindDatabaseProject(db,"fixture",root);
db.exec("PRAGMA foreign_keys=ON");
workspace.ensureSchema(db);
const node=db.prepare("INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state) VALUES(?,1,?,?,?,?,?,'{}','approved')");
node.run("story-54","story","Düğümlü Kitap","Yolculuğu yaşadım.","[]",'["video-54"]');
node.run("object-54","object","Kitap","Kaynakta anılan kitap.","[]",'["video-54","video-55"]');
db.prepare("INSERT INTO universe_workspace_relations(key,run_id,from_key,to_key,label,source_video_ids_json,payload_json,state) VALUES('rel-54',1,'story-54','object-54','hikâyede yer alıyor','[\"video-54\"]','{}','approved')").run();
const initialStatus=narrative.status(db);
assert.equal(initialStatus.next.recordChanges,2);
assert.equal(initialStatus.next.relationChanges,1);
const prepared=narrative.prepare(db);
const request=prepared.request;
assert.equal(prepared.run.input.evidencePolicy,POLICY);
assert.deepEqual(request.input.changes.map(x=>x.sourceType),["node","node"]);
assert.equal(request.input.technicalGraphChanges.length,1);
assert.equal(request.input.relationContext.length,1);
assert.equal(request.input.relationContext[0].label,undefined);
assert.ok(request.input.allowedSources.every(x=>x.sourceType==="node"));
assert.ok(request.input.contextSources.every(x=>x.sourceType==="node"));
assert.equal(request.input.sourceVideos.length,2);
assert.equal(request.input.narrator.mode,"neutral");
assert.deepEqual(narrative.buildRequest(db,prepared.run.id),request,"Frozen input must remain identical");
const response=(sourceKeys,body)=>({contractVersion:1,sections:[{
 order:0,title:"Düğümlü Kitap — Günlük",sourceKeys,blocks:[{type:"paragraph",spans:[{type:"text",text:body}]}],media:[],retire:false
}]});
assert.throws(()=>narrative.saveDraftResponse(db,{runId:prepared.run.id,response:response(["rel-54"],"Kaynakta anlatılıyor.")}),/teknik ilişki/i);
const saved=narrative.saveDraftResponse(db,{runId:prepared.run.id,response:response(["story-54","object-54"],"Defterde yeni bir olay gördüm.\n\nYedi Kapı")});
assert.equal(saved.drafts.length,1);
assert.ok(saved.drafts[0].qualityNotes.some(n=>n.code==="detached_tail_1"));
assert.ok(saved.drafts[0].sourceVideoIds.includes("video-54"));
assert.ok(saved.drafts[0].sourceVideoIds.includes("video-55"));
assert.equal(narrative.status(db).workingRun.drafts[0].qualityNotes[0].code,"detached_tail_1");
assert.equal(narrative.status(db).counts.applied,0,"Tests cannot auto-approve story");
assert.ok(quality.analyzeDraft({body:"Bledum, Babil'e gitti. Bledum Babil",sourceKeys:["story-54"],sourceVideoIds:["video-54"]}).some(n=>n.code==="detached_tail_0"));
assert.ok(quality.analyzeDraft({body:"İbn Kahruf bana görüşmeden söz etti.",sourceKeys:["story-54"],sourceVideoIds:["video-54"]},{mode:"source_bound_first_person",displayName:"Ömer"}).every(n=>n.code!=="third_person_narrator"));
assert.ok(quality.analyzeDraft({body:"Anlatıcı belirtiyor.",sourceKeys:["story-54"],sourceVideoIds:["video-54"]},{mode:"source_bound_first_person",displayName:"Ömer"}).every(n=>n.code!=="third_person_narrator"));
// A real AI failure: prose followed by a dump of entity references is
// unusable as a reader-facing journal even if every entityId is approved.
const tailResponse=response(["story-54","object-54"],"Düğümlü Kitap'ı okudum.");
tailResponse.sections[0].blocks=[{type:"paragraph",spans:[
  {type:"text",text:"Düğümlü Kitap'ı okudum."},
  {type:"reference",entityId:"story-54",label:"Düğümlü Kitap"},
  {type:"reference",entityId:"object-54",label:"Kitap"},
]}];
assert.throws(()=>narrative.saveDraftResponse(db,{runId:prepared.run.id,response:tailResponse}),/bağlantı doğrulaması/i);
const existingDraft=narrative.getRun(db,prepared.run.id).drafts[0];
assert.equal(existingDraft.body,"Defterde yeni bir olay gördüm.\n\nYedi Kapı","A rejected response must not replace an existing good draft");
assert.ok(quality.inlineReferenceFindings([{type:"paragraph",spans:[
  {type:"text",text:"Mezna’da "},{type:"reference",entityId:"story-54",label:"İbn Kahruf"},{type:"text",text:" ile görüştüm."}
]}],{mode:"source_bound_first_person",displayName:"Ömer"}).length===0);
assert.ok(quality.inlineReferenceFindings([{type:"paragraph",spans:[
  {type:"text",text:"Bana "},{type:"reference",entityId:"story-54",label:"Ömer"},{type:"text",text:" diye hitap etti."}
]}],{mode:"source_bound_first_person",displayName:"Ömer"}).some(note=>note.code.startsWith("narrator_reference")));

// Old modern drafts can predate the gate, so approval must re-check persisted
// structured blocks; a caller must not bypass it with a direct applyRun.
db.prepare("UPDATE narrative_section_revisions SET blocks_json=? WHERE id=?")
  .run(JSON.stringify(tailResponse.sections[0].blocks),existingDraft.id);
assert.throws(()=>narrative.apply(db,prepared.run.id),/onayı engellendi/i);
assert.equal(narrative.getRun(db,prepared.run.id).run.state,"prepared");
assert.equal(narrative.status(db).counts.applied,0);
// Simulate a persisted pre-Stage4 run without the new policy flag. It must
// remain valid and its request must retain its historical graph records.
const oldInput={...prepared.run.input};delete oldInput.evidencePolicy;
db.prepare("UPDATE narrative_runs SET input_json=? WHERE id=?").run(JSON.stringify(oldInput),prepared.run.id);
const legacyRequest=narrative.buildRequest(db,prepared.run.id);
assert.equal(legacyRequest.input.changes.filter(x=>x.sourceType==="relation").length,1);
assert.equal(legacyRequest.input.technicalGraphChanges,undefined);
assert.equal(legacyRequest.input.allowedSources.filter(x=>x.sourceType==="relation").length,1);
db.close();
fs.rmSync(root,{recursive:true,force:true});
console.log("PASS Stage4 isolated narrative: node evidence vs graph edges, frozen requests, relation rejection, copy review, source provenance and unapplied drafts");
