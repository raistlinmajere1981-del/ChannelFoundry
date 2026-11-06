"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const core = require("./vefk-core/index.cjs");
const store = require("./vefk-store.cjs");
const publishing = require("./vefk-publication.cjs");

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  publishing.ensureSchema(db);
  return db;
}
function approve(db, id, title, revision = 1) {
  const doc = core.createVefk({id,title,revision,kind:"magicSquare",parameters:{order:3}});
  store.saveDraft(db,{document:doc});
  store.setReviewState(db,{id,revision,status:"checked",expectedContentHash:doc.contentHash});
  const approved = store.setReviewState(db,{id,revision,status:"approved",expectedContentHash:doc.contentHash});
  return approved.document;
}
test("Empty catalog does not invent any site document, and is deterministic",()=>{
  const db=fixture();
  try {
    const a=publishing.buildCatalog(db), b=publishing.buildCatalog(db);
    assert.deepEqual(a,b);
    assert.equal(a.entries.length,0);
    assert.equal(a.binding.sceneId,"birdesengor-study-v2");
    assert.equal(a.binding.surface.anchorId,"vefk-stand.ink-plane");
    assert.equal(a.binding.pen.anchorId,"quill.tip");
    assert.equal(publishing.validateCatalog(a).ok,true);
  } finally {db.close();}
});
test("explicitly approved revisions are the only selectable site entries",()=>{
  const db=fixture();
  try {
    const draft=core.createVefk({id:"draft-a",title:"Unapproved",parameters:{order:3}});
    store.saveDraft(db,{document:draft});
    assert.throws(()=>publishing.select(db,{id:draft.id,revision:1,enabled:true,contentHash:draft.contentHash}),/yalnız onaylanmış/);
    const approved=approve(db,"approved-a","Approved vefk");
    assert.throws(()=>publishing.select(db,{id:approved.id,revision:1,enabled:true,contentHash:"0".repeat(64)}),/hash/);
    publishing.select(db,{id:approved.id,revision:1,contentHash:approved.contentHash,enabled:true,sortOrder:20});
    const one=publishing.buildCatalog(db);
    assert.equal(one.entries.length,1);
    assert.deepEqual(one.entries[0].document,approved);
    assert.equal(one.entries[0].contentHash,approved.contentHash);
    assert.equal(one.entries[0].order,20);
    assert.match(one.entries[0].url,/^vefk\/documents\/approved-a-r1-[a-f0-9]{16}\.json$/);
    assert.equal(publishing.validateCatalog(one).count,1);
    assert.equal(publishing.selected(db)[0].revision,1);
    const draftNew=core.createVefk({id:approved.id,revision:2,title:"Second draft",parameters:{order:5}});
    store.saveDraft(db,{document:draftNew});
    assert.equal(publishing.buildCatalog(db).entries[0].revision,1,"Selected approved immutable revision survives later drafts.");
    assert.throws(()=>publishing.select(db,{id:approved.id,revision:2,enabled:true,contentHash:draftNew.contentHash}),/yalnız onaylanmış/);
    publishing.select(db,{id:approved.id,enabled:false});
    assert.equal(publishing.buildCatalog(db).entries.length,0);
  } finally {db.close();}
});
test("site catalog sorts by explicit order then ID and fingerprints only content",()=>{
  const db=fixture();
  try {
    const b=approve(db,"vefk-b","Second"),a=approve(db,"vefk-a","First");
    publishing.select(db,{id:b.id,revision:1,enabled:true,sortOrder:10,contentHash:b.contentHash});
    publishing.select(db,{id:a.id,revision:1,enabled:true,sortOrder:10,contentHash:a.contentHash});
    const one=publishing.buildCatalog(db);
    assert.deepEqual(one.entries.map(e=>e.id),["vefk-a","vefk-b"]);
    const unchanged=publishing.buildCatalog(db);
    assert.deepEqual(one,unchanged,"Selection timestamps cannot affect published fingerprints.");
    publishing.select(db,{id:b.id,revision:1,enabled:true,sortOrder:0,contentHash:b.contentHash});
    const second=publishing.buildCatalog(db);
    assert.notEqual(second.fingerprint,one.fingerprint);
    assert.deepEqual(second.entries.map(e=>e.id),["vefk-b","vefk-a"]);
  } finally {db.close();}
});
test("the site package provides stable local JSON and byte-level hashes",()=>{
  const db=fixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),"vefk-bridge-"));
  try {
    const document=approve(db,"published-test","A diagram");
    publishing.select(db,{id:document.id,revision:1,contentHash:document.contentHash,enabled:true});
    const catalog=publishing.buildCatalog(db);
    const result=publishing.exportCatalog(db,root,catalog);
    assert.equal(result.ready,true);
    assert.equal(result.count,1);
    const raw=JSON.parse(fs.readFileSync(result.file,"utf8"));
    assert.deepEqual(raw,catalog);
    const entry=catalog.entries[0];
    const serialized=fs.readFileSync(path.join(root,"public-export","content",entry.url),"utf8");
    const parsed=core.parseVefk(serialized);
    assert.equal(parsed.contentHash,document.contentHash);
    assert.equal(require("node:crypto").createHash("sha256").update(serialized).digest("hex"),entry.sha256);
    const result2=publishing.exportCatalog(db,root);
    assert.equal(result2.fingerprint,result.fingerprint);
    assert.deepEqual(JSON.parse(fs.readFileSync(result2.file,"utf8")),catalog);
  }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
});
test("tampering with source paths, data, or the catalog fingerprint is rejected",()=>{
  const db=fixture();
  try {
    const doc=approve(db,"tamper","Valid");
    publishing.select(db,{id:doc.id,revision:1,enabled:true,contentHash:doc.contentHash});
    const good=publishing.buildCatalog(db);
    const bad=structuredClone(good);
    bad.entries[0].document.title="changed";
    assert.throws(()=>publishing.validateCatalog(bad),/contentHash|mismatch/i);
    const wrongFile=structuredClone(good);
    wrongFile.entries[0].url="../escape.json";
    assert.throws(()=>publishing.validateCatalog(wrongFile),/hash|yolu/);
    const badBinding=structuredClone(good);
    badBinding.binding.surface.anchorId="invented";
    assert.throws(()=>publishing.validateCatalog(badBinding),/sözleşmesi/);
    const badHash=structuredClone(good);
    badHash.fingerprint="f".repeat(64);
    assert.throws(()=>publishing.validateCatalog(badHash),/fingerprint/);
  }finally{db.close();}
});
