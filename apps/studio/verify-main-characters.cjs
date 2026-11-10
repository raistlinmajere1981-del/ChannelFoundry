"use strict";
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const core = require("./universe-workspace-core.cjs");
const store = require("./universe-workspace-store.cjs");
const narrative = require("./narrative-store.cjs");
const generation = require("./narrative-ai-generation.cjs");
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
core.ensureSchema(db);
const insert = db.prepare("INSERT INTO universe_workspace_nodes (key,run_id,kind,name,state,aliases_json) VALUES (?,1,?,?,?,?)");
insert.run("character-a", "character", "Davetli", "approved", '["Misafir"]');
insert.run("character-b", "character", "İbn Karuf", "approved", '[]');
insert.run("story-a", "story", "Yedi Kapı", "approved", '[]');
// Normalize editable payload once, so that the test isolates the selection flag.
for (const key of ["character-a","character-b"]) {
  const n = store.listNodes(db).find(row=>row.key===key);
  store.updateNode(db, {key, name:n.name, summary:n.summary, aliases:n.aliases});
}
const initial = narrative.currentUniverseSources(db);
const before = narrative.buildInput(db).universeFingerprint;
let nodes = store.listNodes(db, {kind:"character"});
assert.equal(nodes.length, 2);
assert.ok(nodes.every(n=>n.isMainCharacter===false));
function select(key, checked) {
  const node = store.listNodes(db).find(n=>n.key===key);
  return store.updateNode(db, {key, state:"approved", name:node.name, summary:node.summary, aliases:node.aliases, isMainCharacter:checked});
}
assert.equal(select("character-a", true).isMainCharacter, true);
assert.equal(select("character-b", true).isMainCharacter, true);
assert.equal(store.listNodes(db, {kind:"character"}).filter(n=>n.isMainCharacter).length, 2);
assert.equal(narrative.buildInput(db).universeFingerprint, before, "Editorial choice must not change evidence fingerprint");
assert.deepEqual(narrative.currentUniverseSources(db), initial, "Editorial choice must not change source evidence");
assert.equal(select("character-a", false).isMainCharacter, false);
assert.equal(store.listNodes(db).find(n=>n.key==="character-b").isMainCharacter, true);
assert.throws(()=>store.updateNode(db,{key:"story-a",isMainCharacter:true}), /yalnız muhataplara/);
// Metadata-only selections never rewrite node payload/fingerprint, even for raw AI nodes.
const flagged = store.updateNode(db, {key:"character-a",isMainCharacter:true});
assert.equal(flagged.isMainCharacter,true);
assert.deepEqual(narrative.currentUniverseSources(db), initial);
const draft = store.updateNode(db, {key:"character-a",state:"draft",isMainCharacter:true});
assert.equal(draft.isMainCharacter,true,"Draft selection is allowed");
assert.equal(store.listNodes(db).find(n=>n.key==="character-a").state,"draft");
assert.deepEqual(narrative.currentUniverseSources(db).filter(x=>x.sourceKey==="character-a"),[],"Unapproved nodes are excluded from evidence");
store.updateNode(db, {key:"character-a",state:"approved",isMainCharacter:false});
const messages = generation.buildMessages({input:{evidencePolicy:"narrative-records-v2",narrator:{},mainCharacters:[{sourceKey:"character-b",name:"İbn Karuf",aliases:[]}]}});
assert.match(messages[0].content, /input\.mainCharacters/);
assert.match(messages[0].content, /kaynak kanıtı/);
db.prepare("DELETE FROM universe_workspace_nodes WHERE key='character-b'").run();
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM universe_main_characters").get().n,0,"Deleted nodes must cascade editorial choice");
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
// Frozen narrative input carries only explicitly selected, approved identities.
store.updateNode(db, {key:"character-a",isMainCharacter:true});
const run = narrative.prepareRun(db);
const request = require("./narrative-ai-contract.cjs").buildRequest(db,run.id);
assert.deepEqual(request.input.mainCharacters, [{sourceKey:"character-a",name:"Davetli",aliases:["Misafir"]}]);
assert.equal(narrative.prepareRun(db).id,run.id);
store.updateNode(db,{key:"character-a",isMainCharacter:false});
const another = narrative.prepareRun(db);
assert.notEqual(another.id,run.id,"Editorial selection changes produce distinct frozen request contexts");
assert.equal("mainCharacters" in another.input,false,"No empty editorial list is required");
assert.deepEqual(require("./narrative-ai-contract.cjs").buildRequest(db,run.id).input.mainCharacters,request.input.mainCharacters,"Frozen requests remain unchanged");
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
db.close();
console.log("main characters: 12 assertions PASS");
