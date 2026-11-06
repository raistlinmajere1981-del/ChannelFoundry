import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {
  readVefkPublication, validateSceneBinding, vefkFrameAt, createVefkPlayer,
} from "../../docs/contracts/vefk-site-consumer.mjs";
import * as siteConsumer from "../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs";
import s6Fixtures from "./vefk-s6-fixtures.cjs";

const require=createRequire(import.meta.url);
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const {DatabaseSync}=require("node:sqlite");
const core=require("./vefk-core/index.cjs");
const store=require("./vefk-store.cjs");
const selection=require("./vefk-publication.cjs");
const publication=require("./publication-v2.cjs");
const storagePublication=require("./storage-publication.cjs");
const workspace=require("./universe-workspace.cjs");
const narrative=require("./narrative-store.cjs");
const completion=require("./visual-completion-store.cjs");
const aiAnalysis=require("./ai-analysis.cjs");
const youtubeCatalog=require("./youtube-catalog.cjs");

test("S4b doc2 remains rejected in catalog1 or catalog2 without binding3 capability", async()=>{
  for (const catalogVersion of [1,2]) {
    const raw=s6Fixtures.fixture();
    const old=raw.vefkCatalog.entries[0].document;
    const doc=core.createVefk({id:old.id,title:old.title,schemaVersion:2});
    assert.equal(core.validateVefk(doc).ok,true);
    raw.vefkCatalog.entries[0].document=structuredClone(doc);
    raw.vefkCatalog.schemaVersion=catalogVersion;
    s6Fixtures.rehash(raw); // Every hash is correct: rejection is a version gate.
    for(const consumer of [{readVefkPublication,createVefkPlayer},siteConsumer]) {
      assert.equal(consumer.createVefkPlayer(doc).frameAt(350).pen.penDown,true);
      await assert.rejects(consumer.readVefkPublication(raw),/katalog/);
    }
  }
});

test("S4a readVefkPublication retains strict v1 stroke fields after v2 support",async()=>{
  for (const easing of ["linear","ease-in","ease-out","ease-in-out"]) {
    const raw=s6Fixtures.fixture();
    raw.vefkCatalog.entries[0].document.drawPlan.strokes[0].easing=easing;
    s6Fixtures.rehash(raw);
    for(const consumer of [{readVefkPublication,createVefkPlayer},siteConsumer]) {
      assert.throws(()=>consumer.createVefkPlayer(raw.vefkCatalog.entries[0].document),/easing/);
      await assert.rejects(consumer.readVefkPublication(raw),/easing/);
    }
  }
});

function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"vefk-site-consumer-"));
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("CREATE TABLE studio_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT");
  workspace.ensureSchema(db);narrative.ensureSchema(db);
  completion.ensureSchema(db);aiAnalysis.ensureSchema(db);
  youtubeCatalog.ensureSchema(db);selection.ensureSchema(db);
  return {db,root,close(){db.close();fs.rmSync(root,{recursive:true,force:true});}};
}
function approved(db) {
  const doc=core.createVefk({
    id:"vefk-site-bridge",title:"Geçişli kare",parameters:{order:3},
  });
  store.saveDraft(db,{document:doc});
  store.setReviewState(db,{id:doc.id,revision:1,status:"checked",expectedContentHash:doc.contentHash});
  store.setReviewState(db,{id:doc.id,revision:1,status:"approved",expectedContentHash:doc.contentHash});
  selection.select(db,{id:doc.id,revision:1,contentHash:doc.contentHash,enabled:true});
  return doc;
}

test("S4b only explicit selection of an approved immutable doc2 enables catalog2 export",async()=>{
  const fx=fixture();
  try {
    const old=approved(fx.db);
    const before=publication.buildPublicationV2(fx.db).snapshot;
    const input={id:old.id,title:old.title,revision:2,schemaVersion:2,parameters:{order:3}};
    const plan=structuredClone(core.createVefk(input).drawPlan);
    plan.strokes.forEach((stroke,i)=>stroke.easing=["linear","ease-in","ease-out","ease-in-out"][i%4]);
    const doc=core.createVefk({...input,drawPlan:plan});
    assert.equal(store.saveDraft(fx.db,{document:doc}).document.schemaVersion,2);
    assert.throws(()=>selection.select(fx.db,{id:doc.id,revision:2,enabled:true,contentHash:doc.contentHash}),/yalnız onaylanmış/);
    for(const status of ["checked","approved"]) store.setReviewState(fx.db,{
      id:doc.id,revision:2,status,expectedContentHash:doc.contentHash});
    assert.throws(()=>store.saveDraft(fx.db,{document:doc,expectedContentHash:doc.contentHash}),/değiştirilemez/);
    assert.deepEqual(publication.buildPublicationV2(fx.db).snapshot.vefkCatalog,before.vefkCatalog);
    assert.equal(publication.buildPublicationV2(fx.db).snapshot.publication.contentFingerprint,before.publication.contentFingerprint);
    selection.select(fx.db,{id:doc.id,revision:2,enabled:true,contentHash:doc.contentHash});
    const built=publication.buildPublicationV2(fx.db).snapshot;
    assert.equal(built.vefkCatalog.schemaVersion,2);
    assert.deepEqual(built.vefkCatalog.binding,selection.BINDING_V2);
    assert.notEqual(built.publication.contentFingerprint,before.publication.contentFingerprint);
    assert.notEqual(built.vefkCatalog.fingerprint,before.vefkCatalog.fingerprint);
    const scene=JSON.parse(fs.readFileSync(path.join(repo,"channels/birdesengor/web/src/scene/data/study.scene.json"),"utf8"));
    for(const consumer of [{readVefkPublication,createVefkPlayer},siteConsumer]) {
      const result=await consumer.readVefkPublication(built,scene);
      assert.deepEqual(result.entries[0].document,doc);
      assert.deepEqual(consumer.createVefkPlayer(result.entries[0].document).frameAt(350),createVefkPlayer(doc).frameAt(350));
    }
    const exported=storagePublication.exportPublicSnapshot(fx.db,fx.root);
    const stored=JSON.parse(fs.readFileSync(exported.file,"utf8"));
    assert.equal((await readVefkPublication(stored,scene)).status,"ready");
    const entry=stored.vefkCatalog.entries[0];
    assert.equal(fs.readFileSync(path.join(fx.root,"public-export/content",entry.url),"utf8"),core.serializeVefk(doc,2));
    assert.equal(exported.readiness.readyForTheme,false);
    selection.select(fx.db,{id:old.id,revision:1,enabled:true,contentHash:old.contentHash});
    assert.deepEqual(publication.buildPublicationV2(fx.db).snapshot.vefkCatalog,before.vefkCatalog);
    assert.equal(publication.buildPublicationV2(fx.db).snapshot.publication.contentFingerprint,before.publication.contentFingerprint);
  } finally {fx.close();}
});

test("no selected vefk -> no vefkCatalog in legacy publication, no changed fingerprint", async()=>{
  const fx=fixture();
  try {
    const initial=publication.buildPublicationV2(fx.db,{generatedAt:"2026-11-03T19:00:00Z"}).snapshot;
    const changedTime=publication.buildPublicationV2(fx.db,{generatedAt:"2026-11-03T19:30:00Z"}).snapshot;
    assert.equal(initial.vefkCatalog,undefined);
    assert.equal(initial.publication.contentFingerprint,changedTime.publication.contentFingerprint);
    assert.equal((await readVefkPublication(initial)).status,"empty");
  }finally{fx.close();}
});

test("approved selected vefk flows Studio -> publication v2 -> site consumer -> stand and quill anchors", async()=>{
  const fx=fixture();
  try {
    const before=publication.buildPublicationV2(fx.db).snapshot;
    const doc=approved(fx.db);
    const built=publication.buildPublicationV2(fx.db).snapshot;
    assert.ok(built.vefkCatalog);
    assert.equal(built.vefkCatalog.entries.length,1);
    assert.notEqual(built.publication.contentFingerprint,before.publication.contentFingerprint);
    assert.equal(built.vefkCatalog.entries[0].document.contentHash,doc.contentHash);
    const scene=JSON.parse(fs.readFileSync(path.join(repo,"channels/birdesengor/web/src/scene/data/study.scene.json"),"utf8"));
    assert.equal(validateSceneBinding(built.vefkCatalog.binding,scene),true);
    const consumer=await readVefkPublication(built,scene);
    assert.equal(consumer.status,"ready");
    assert.equal(consumer.entries.length,1);
    assert.deepEqual(consumer.entries[0].document,doc);
    const begin=vefkFrameAt(doc,0);
    assert.equal(begin.timeMs,0);
    assert.equal(begin.visibility[0].fraction,0);
    const half=vefkFrameAt(doc,doc.drawPlan.strokes[0].durationMs/2);
    assert.ok(Math.abs(half.visibility[0].fraction-0.5)<0.001);
    assert.equal(half.pen.pathId,doc.drawPlan.strokes[0].pathId);
    assert.equal(half.pen.penDown,true);
    assert.ok(Number.isFinite(half.pen.position.x));
    assert.ok(Number.isFinite(half.pen.position.y));
    const end=vefkFrameAt(doc,doc.drawPlan.durationMs);
    assert.equal(end.complete,true);
    assert.ok(end.visibility.every(entry=>entry.fraction===1));
    assert.equal(end.pen.penDown,false);
    assert.throws(()=>vefkFrameAt(doc,Number.NaN),/geçersiz/);
    const local=storagePublication.exportPublicSnapshot(fx.db,fx.root);
    assert.equal(local.vefkCount,1,"Local export shows selected vefk count");
    assert.equal(storagePublication.getPublicationInfo(fx.db).vefkCount,1,
      "Published vefk count survives local metadata reload");
    const stored=JSON.parse(fs.readFileSync(local.file,"utf8"));
    assert.equal(stored.vefkCatalog.fingerprint,built.vefkCatalog.fingerprint);
    const standalone=path.join(fx.root,"public-export","content","vefk","vefk_catalog.json");
    assert.ok(fs.existsSync(standalone));
    const standaloneCatalog=JSON.parse(fs.readFileSync(standalone,"utf8"));
    assert.equal(standaloneCatalog.fingerprint,built.vefkCatalog.fingerprint);
    assert.equal((await readVefkPublication(stored,scene)).status,"ready");
    assert.equal(local.readiness.readyForTheme,false,"Vefk site export does not bypass narrative/theme gate");
  }finally{fx.close();}
});

test("site rejects tampered document, binding and publication revision instead of guessing",async()=>{
  const fx=fixture();
  try{
    approved(fx.db);
    const publicationRaw=publication.buildPublicationV2(fx.db).snapshot;
    const broken=structuredClone(publicationRaw);
    broken.vefkCatalog.entries[0].document.geometry.paths[0].d+=" onload=alert(1)";
    await assert.rejects(readVefkPublication(broken),/güvensiz|fingerprint/);
    const wrongHash=structuredClone(publicationRaw);
    wrongHash.vefkCatalog.fingerprint="1".repeat(64);
    await assert.rejects(readVefkPublication(wrongHash),/fingerprint/);
    const wrongScene=structuredClone(publicationRaw);
    wrongScene.vefkCatalog.binding.pen.anchorId="fictional";
    await assert.rejects(readVefkPublication(wrongScene),/fingerprint|bağlantısı/);
    const removedCatalog=structuredClone(publicationRaw);
    delete removedCatalog.vefkCatalog;
    await assert.rejects(readVefkPublication(removedCatalog), /fingerprint/);
    const wrongContent=structuredClone(publicationRaw);
    wrongContent.vefkCatalog.entries[0].document.description="modified";
    await assert.rejects(readVefkPublication(wrongContent),/fingerprint|hash/);
  }finally{fx.close();}
});
