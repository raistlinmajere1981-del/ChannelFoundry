"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const store=require("./storage-publication.cjs");

test("publication info prefers the current on-disk export to stale SQLite export metadata",t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"bds-publication-info-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const db=new DatabaseSync(":memory:");
  t.after(()=>db.close());
  db.exec("CREATE TABLE studio_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT");
  const old=store.recordPublicationInfo(db,{
    generatedAt:"2026-11-19T10:00:00.000Z",file:"old-publication.json",
    publicationId:"pub-old",contentFingerprint:"old-fingerprint",
    sectionCount:50,entityCount:2717,relationCount:100,assetCount:9,vefkCount:1,
  });
  assert.equal(old.itemCount,2767);
  // The metadata still says the old publication, exactly as after the
  // separately authorized 20 November web/SEO release.
  const directory=path.join(root,"public-export","content");
  fs.mkdirSync(directory,{recursive:true});
  const exported={
    schemaVersion:2,
    publication:{id:"pub-current",generatedAt:"2026-11-20T06:00:00.000Z",contentFingerprint:"current-fingerprint"},
    journal:{sections:[{sectionId:"a"},{sectionId:"b"}]},
    archive:{entities:[{entityId:"a"},{entityId:"b"},{entityId:"c"}],relations:[{id:"x"}]},
    assets:[{assetId:"image-a"},{assetId:"image-b"}],
    vefkCatalog:{entries:[{id:"drawing"}]},
  };
  const file=path.join(directory,"publication.json");
  fs.writeFileSync(file,JSON.stringify(exported));
  assert.deepEqual(store.getPublicationInfo(db,root),{
    file,generatedAt:exported.publication.generatedAt,publicationId:"pub-current",
    contentFingerprint:"current-fingerprint",sectionCount:2,entityCount:3,
    relationCount:1,assetCount:2,vefkCount:1,itemCount:5,
  });
  assert.equal(db.prepare("SELECT value FROM studio_meta WHERE key='last_export_publication_id'").get().value,"pub-old",
    "Reading the current file must not alter SQLite export history");
  fs.writeFileSync(file,"{invalid-json");
  assert.equal(store.getPublicationInfo(db,root),null,"A damaged export is not silently replaced with stale metadata");
  fs.rmSync(file);
  assert.equal(store.getPublicationInfo(db,root).publicationId,"pub-old",
    "Metadata is only fallback when no export file exists");
  assert.equal(store.getPublicationInfo(db).publicationId,"pub-old");
});
