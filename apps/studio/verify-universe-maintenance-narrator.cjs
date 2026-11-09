"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const projects=require("./channel-projects.cjs"),workspace=require("./universe-workspace.cjs"),maintenance=require("./universe-maintenance.cjs");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"universe-narrator-reset-"));
const connections=[];
const note="Yalnız kaynağın anlattıklarını birinci şahısla yaz.";
function dbFor(id){
  fs.mkdirSync(path.join(root,"channels",id,".local-data/studio"),{recursive:true});
  const db=new DatabaseSync(path.join(root,"channels",id,".local-data/studio/channel-foundry-studio.sqlite"));
  connections.push(db);db.exec("PRAGMA foreign_keys=ON");workspace.ensureSchema(db);return db;
}
function seed(db,key){
  db.prepare("INSERT INTO universe_workspace_nodes (key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state) VALUES (?,1,'character','Anlatıcı','Kaynak kişisi','[]','[\"video\"]','{}','approved')").run(key);
}
function attach(id,db,key){
  projects.updateProject({id,narrator:{displayName:"Ömer",editorialNote:note,mode:"source_bound_first_person",sourceEntityKeys:[key]}},root,db);
}
function configFile(id){return path.join(root,"channels",id,"channel.json")}
function config(id){return JSON.parse(fs.readFileSync(configFile(id),"utf8"))}
try {
  projects.createProject({id:"test-channel",displayName:"Test channel"},root);
  projects.createProject({id:"other-channel",displayName:"Other channel"},root);
  const db=dbFor("test-channel"),other=dbFor("other-channel");
  seed(db,"old-narrator");seed(other,"other-narrator");
  attach("test-channel",db,"old-narrator");attach("other-channel",other,"other-narrator");
  const otherBefore=fs.readFileSync(configFile("other-channel"),"utf8");
  assert.equal(maintenance.status(db).narratorLinks,1);
  assert.throws(()=>maintenance.reset(db,root,{confirmation:"wrong"}),/Onay metni/);
  assert.deepEqual(config("test-channel").narrator.sourceEntityKeys,["old-narrator"]);
  const result=maintenance.reset(db,root,{confirmation:maintenance.CONFIRMATION});
  assert.equal(result.narratorLinksCleared,1);
  assert.equal(result.after.narratorLinks,0);
  assert.equal(result.after.reset.universe_workspace_nodes,0);
  assert.equal(result.after.resetCount,0);
  assert.ok(fs.existsSync(result.backup));
  assert.ok(fs.existsSync(result.narratorBackup));
  assert.deepEqual(JSON.parse(fs.readFileSync(result.narratorBackup,"utf8")).narrator.sourceEntityKeys,["old-narrator"]);
  assert.deepEqual(config("test-channel").narrator.sourceEntityKeys,[]);
  assert.equal(config("test-channel").narrator.displayName,"Ömer");
  assert.equal(config("test-channel").narrator.editorialNote,note);
  assert.equal(config("test-channel").narrator.mode,"source_bound_first_person");
  assert.equal(fs.readFileSync(configFile("other-channel"),"utf8"),otherBefore);

  const stale=config("test-channel");stale.narrator.sourceEntityKeys=["old-narrator"];
  fs.writeFileSync(configFile("test-channel"),JSON.stringify(stale,null,2)+"\n");
  assert.equal(maintenance.status(db).resetCount,1);
  const staleOnly=maintenance.reset(db,root,{confirmation:maintenance.CONFIRMATION});
  assert.equal(staleOnly.narratorLinksCleared,1);
  assert.equal(staleOnly.after.resetCount,0);

  seed(db,"failure-narrator");attach("test-channel",db,"failure-narrator");
  const rollbackConfig=fs.readFileSync(configFile("test-channel"),"utf8");
  db.exec("CREATE TABLE external_identity_lock (key TEXT PRIMARY KEY, node_key TEXT NOT NULL REFERENCES universe_workspace_nodes(key) ON DELETE RESTRICT)");
  db.prepare("INSERT INTO external_identity_lock (key,node_key) VALUES (?,?)").run("locked","failure-narrator");
  assert.throws(()=>maintenance.reset(db,root,{confirmation:maintenance.CONFIRMATION}),/FOREIGN KEY constraint failed/);
  assert.equal(fs.readFileSync(configFile("test-channel"),"utf8"),rollbackConfig);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM universe_workspace_nodes").get().n,1);
  assert.equal(maintenance.status(db).narratorLinks,1);
  assert.equal(fs.readFileSync(configFile("other-channel"),"utf8"),otherBefore);
  console.log("PASS universe narrator reset: backup, link clearing, stale-only repair, separate project, rollback");
} finally {for(const db of connections)db.close();fs.rmSync(root,{recursive:true,force:true})}
