"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const lang=require("../publication-languages.cjs");
const fast=require("../dashboard-fast-status.cjs");
const projects=require("../channel-projects.cjs");
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"bdsg-dashboard-fast-"));
 const project=projects.activeProject()?.id||"default";
 fs.mkdirSync(path.join(root,"seo-workspaces"),{recursive:true});
 const db=new DatabaseSync(":memory:");
 db.exec("CREATE TABLE universe_workspace_nodes(key TEXT PRIMARY KEY,state TEXT NOT NULL);");
 db.exec("CREATE TABLE narrative_sections(key TEXT PRIMARY KEY,state TEXT,current_revision_id INTEGER);");
 lang.ensureSchema(db);
 const id="universe-character-test";
 db.prepare("INSERT INTO universe_workspace_nodes(key,state) VALUES(?,?)").run(id,"approved");
 const entity={name:"Test karakteri",kind:"character",summary:"Kaynak özeti",details:[],sourceVideoIds:[]};
 const sourceHash=lang.putSource(db,"entity",id,entity);
 lang.save(db,{kind:"entity",id,language:"tr",sourceHash,revision:0,approved:true,data:entity});
 lang.save(db,{kind:"entity",id,language:"en",sourceHash,revision:0,approved:true,
   data:{...entity,summary:"Source description"}});
 const tr=lang.published(db,"entity",id).tr,en=lang.published(db,"entity",id).en;
 const seo={schemaVersion:2,site:{tr:{},en:{}},items:{}};
 for(const [language,data] of [["tr",tr],["en",en]]){
   seo.items[language+":entity:"+id]={title:data.name,description:data.summary,approvedHash:lang.hash(data)};
 }
 const seoPath=path.join(root,"seo-workspaces",project+".json");
 fs.writeFileSync(seoPath,JSON.stringify(seo));
 return {root,db,id,entity,seo,seoPath,close(){
   db.close();fs.rmSync(root,{recursive:true,force:true});
 }};
}
test("Dashboard counters match published language/SEO identities without returning entire documents",()=>{
 const f=fixture();
 try{
   const result=fast.overview(f.db,f.root);
   assert.deepEqual(result.languages,{ready:1,missing:0,pending:0,stale:0,errors:0});
   assert.deepEqual(result.seo,{pages:2,draftCount:0});
   assert.ok(Buffer.byteLength(JSON.stringify(result))<1500);
   assert.strictEqual(fast.overview(f.db,f.root),result,"same snapshot uses cache");
   // Editing the sidecar externally invalidates only the compact summary.
   f.seo.items["tr:entity:"+f.id].approvedHash="stale";
   fs.writeFileSync(f.seoPath,JSON.stringify(f.seo)+"\n");
   assert.deepEqual(fast.overview(f.db,f.root).seo,{pages:2,draftCount:1});
 }finally{f.close();fast.clear()}
});
test("Dashboard cache follows transactions, rollbacks and Turkish dependencies",()=>{
 const f=fixture();
 try{
   const baseline=fast.overview(f.db,f.root);
   f.db.exec("BEGIN IMMEDIATE");
   try{
     f.db.prepare("UPDATE publication_language_variants SET state='draft' WHERE kind='entity' AND id=? AND language='en'").run(f.id);
     const next=fast.overview(f.db,f.root);
     assert.deepEqual(next.languages,{ready:0,missing:0,pending:1,stale:0,errors:0});
     assert.deepEqual(next.seo,{pages:1,draftCount:0});
   }finally{f.db.exec("ROLLBACK")}
   assert.deepEqual(fast.overview(f.db,f.root),baseline);
   // TR revision makes the existing English approval stale until re-approved.
   const tr=lang.variants(f.db,"entity",f.id);
   lang.save(f.db,{kind:"entity",id:f.id,language:"tr",sourceHash:tr.sourceHash,
     revision:tr.variants.tr.revision,data:f.entity,approved:true});
   const stale=fast.overview(f.db,f.root);
   assert.equal(stale.languages.ready,0);
   assert.equal(stale.languages.stale,1);
   assert.equal(stale.seo.pages,1);
 }finally{f.close();fast.clear()}
});
