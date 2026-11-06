"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const sources = require("./vefk-sources.cjs");
const store = require("./vefk-store.cjs");
const management = require("./vefk-management.cjs");
const publication = require("./vefk-publication.cjs");
const core = require("./vefk-core/index.cjs");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=", "base64");
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-v3-"));
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON; CREATE TABLE unrelated(value TEXT); INSERT INTO unrelated VALUES('koru');");
  const file = path.join(root,"source.png"); fs.writeFileSync(file,PNG);
  const source = sources.importSource(db,root,file);
  const ai = sources.appendAnalysis(db,{sourceId:source.id,origin:"ai",provider:"test",model:"vision",result:{
    schema:"vefk.source-analysis.v1",regions:[{kind:"symbol",box:[0,0,500,500],label:"☉",confidence:1,reviewed:true},
      {kind:"text",box:[500,0,500,500],label:"ب",confidence:1,reviewed:true}],
    grid:{rows:1,columns:1,cells:[{row:0,column:0,text:"☉",confidence:1,reviewed:true}]},
  }});
  const input={ id:"source-document",title:"Kaynak",kind:"manualPaths",provenance:{references:[source.id]},
    geometry:{coordinateSpace:"svg-viewBox",viewBox:[0,0,1000,1000],inkStyles:{trace:{width:5,cap:"round"}},
      paths:[{id:"trace.region-001.001",ink:"trace",d:"M 20 20 L 100 100"}]} };
  function reviewed() {
    const current=sources.latestAnalysis(db,source.id); const result=structuredClone(current.result);
    result.regions.forEach(item=>{item.reviewed=true;}); result.grid.cells[0].reviewed=true;
    result.traces=[{regionId:"region-001",reviewed:true,paths:[{id:"trace.region-001.001",d:"M 20 20 L 100 100"}]}];
    return sources.appendAnalysis(db,{sourceId:source.id,origin:"review",provider:"test",model:"vision",result,expectedAnalysisId:current.id});
  }
  return {root,db,source,ai,input,reviewed,close(){ assert.equal(db.prepare("SELECT value FROM unrelated").get().value,"koru"); db.close();fs.rmSync(root,{recursive:true,force:true}); }};
}
test("100% AI confidence never supplies human consent; partial source drawing requires an explicit decision",()=>{
 const f=fixture();try{
  assert.ok(f.ai.result.regions.every(item=>!item.reviewed && item.needsReview));
  assert.equal(f.ai.result.grid.cells[0].reviewed,false);
  const doc=core.createVefk(f.input);
  assert.throws(()=>store.saveDraft(f.db,{document:doc}),/inceleme kaydı/);
  const review=f.reviewed();
  const evidence={sourceId:f.source.id,analysisId:review.id,method:"traced",partialAccepted:false};
  assert.throws(()=>store.saveDraft(f.db,{document:doc,sourceReview:evidence}),/kısmi çizim/);
  store.saveDraft(f.db,{document:doc,sourceReview:{...evidence,partialAccepted:true}});
  assert.deepEqual(store.sourceReview(f.db,doc.id).omittedRegions,["region-002"]);
  assert.equal(store.sourceReview(f.db,doc.id).partialAccepted,true);
 }finally{f.close();}
});
test("symbol cells stay symbols; mathematical conversion cannot silently replace them",()=>{
 const f=fixture();try{
  const review=f.reviewed();const doc=core.createVefk({...f.input,id:"numeric-document",kind:"manualSquare",grid:[[1,2,3],[4,5,6],[7,8,9]],geometry:undefined});
  assert.throws(()=>store.saveDraft(f.db,{document:doc,sourceReview:{sourceId:f.source.id,analysisId:review.id,method:"grid"}}),/semboller/);
  assert.equal(sources.latestAnalysis(f.db,f.source.id).result.grid.cells[0].text,"☉");
 }finally{f.close();}
});
test("analysis/source deletion preserves documents; document deletion clears all revisions and catalog without changing exported package",()=>{
 const f=fixture();try{
  const review=f.reviewed();const document=core.createVefk(f.input);
  store.saveDraft(f.db,{document,sourceReview:{sourceId:f.source.id,analysisId:review.id,method:"traced",partialAccepted:true}});
  for(const status of ["checked","approved"])store.setReviewState(f.db,{id:document.id,revision:1,status,expectedContentHash:document.contentHash});
  publication.select(f.db,{id:document.id,revision:1,contentHash:document.contentHash,enabled:true});
  const exported=publication.exportCatalog(f.db,f.root);const bytes=fs.readFileSync(exported.file);
  const revision=core.createVefk({...f.input,revision:2});store.saveDraft(f.db,{document:revision});
  assert.throws(()=>management.deleteAnalyses(f.db,{id:f.source.id}),/onay/);
  management.deleteAnalyses(f.db,{id:f.source.id,confirmed:true});
  assert.equal(sources.latestAnalysis(f.db,f.source.id),null);
  assert.ok(store.getDocument(f.db,document.id));
  management.deleteSource(f.db,f.root,{id:f.source.id,confirmed:true});
  assert.equal(sources.listSources(f.db).length,0);assert.equal(store.listRevisions(f.db,document.id).length,2);
  const copy=management.copyDocument(f.db,{id:document.id,newId:"copied-document"});assert.equal(copy.status,"draft");
  assert.equal(store.sourceReview(f.db,copy.id).sourceId,f.source.id);
  assert.throws(()=>management.deleteDocument(f.db,{id:document.id}),/onay/);
  const result=management.deleteDocument(f.db,{id:document.id,confirmed:true});assert.equal(result.revisions,2);assert.equal(result.catalogRemoved,true);
  assert.equal(store.getDocument(f.db,document.id),null);assert.deepEqual(publication.selected(f.db),[]);
  assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(),[]);
  assert.deepEqual(fs.readFileSync(exported.file),bytes);
 }finally{f.close();}
});
test("cleanup preserves referenced bytes, unknown filenames, symlinks and every unrelated record",()=>{
 const f=fixture();try{
  const folder=path.join(f.root,"vefk-sources");const orphan="a".repeat(64)+".png";
  fs.writeFileSync(path.join(folder,orphan),PNG);fs.writeFileSync(path.join(folder,"notes.txt"),"keep");
  const linked="b".repeat(64)+".png";fs.symlinkSync(path.join(f.root,"source.png"),path.join(folder,linked));
  assert.equal(management.cleanup(f.db,f.root).removed,1);
  assert.ok(fs.existsSync(path.join(folder,linked)));assert.ok(fs.existsSync(path.join(folder,"notes.txt")));
  management.renameSource(f.db,{id:f.source.id,title:"Yeni kaynak"});assert.equal(sources.listSources(f.db)[0].filename,"Yeni kaynak");
  assert.throws(()=>management.renameSource(f.db,{id:f.source.id,title:" "}),/Ad/);
  assert.ok(sources.loadSource(f.db,f.root,f.source.id).imageDataUrl);
  const original=folder+"-original", outside=path.join(f.root,"outside");
  fs.renameSync(folder,original);fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,orphan),PNG);
  fs.symlinkSync(outside,folder,"dir");
  assert.throws(()=>management.cleanup(f.db,f.root),/gerçek bir dizin/);
  assert.ok(fs.existsSync(path.join(outside,orphan)));
  fs.unlinkSync(folder);fs.renameSync(original,folder);
 }finally{f.close();}
});

test("package readiness survives reload and rejects stale catalog or tampered local paths",()=>{
 const f=fixture();try{
  const document=core.createVefk({id:"package-test",title:"Paket",parameters:{order:3}});
  store.saveDraft(f.db,{document});for(const status of ["checked","approved"])store.setReviewState(f.db,{id:document.id,revision:1,status,expectedContentHash:document.contentHash});
  publication.select(f.db,{id:document.id,revision:1,contentHash:document.contentHash,enabled:true});
  const catalog=publication.buildCatalog(f.db);publication.exportCatalog(f.db,f.root);
  const folder=path.join(f.root,"public-export/content");fs.writeFileSync(path.join(folder,"publication.json"),JSON.stringify({vefkCatalog:catalog}));
  assert.equal(publication.packageStatus(f.db,f.root).ready,true);
  fs.writeFileSync(path.join(folder,catalog.entries[0].url),"tampered");assert.equal(publication.packageStatus(f.db,f.root).ready,false);
  publication.exportCatalog(f.db,f.root);assert.equal(publication.packageStatus(f.db,f.root).ready,true);
  publication.select(f.db,{id:document.id,enabled:false});assert.equal(publication.packageStatus(f.db,f.root).ready,false);
 }finally{f.close();}
});

test("corrupted documents fail package readiness but can still be explicitly deleted",()=>{
 const f=fixture();try{
  const document=core.createVefk({id:"corrupted-local",title:"Bozuk",parameters:{order:3}});
  store.saveDraft(f.db,{document});for(const status of ["checked","approved"])store.setReviewState(f.db,{id:document.id,revision:1,status,expectedContentHash:document.contentHash});
  publication.select(f.db,{id:document.id,revision:1,contentHash:document.contentHash,enabled:true});
  f.db.prepare("UPDATE vefk_revisions SET document_json='{}' WHERE document_id=?").run(document.id);
  assert.equal(publication.packageStatus(f.db,f.root).ready,false);
  assert.equal(management.deleteDocument(f.db,{id:document.id,confirmed:true}).catalogRemoved,true);
  assert.deepEqual(f.db.prepare("PRAGMA foreign_key_check").all(),[]);
 }finally{f.close();}
});
