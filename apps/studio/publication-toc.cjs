"use strict";
// TOC-only English headings. A translated index label is NOT an approved English article.
// Exact approved Turkish title + current source revision pins every published heading.
const {DatabaseSync}=require("node:sqlite");
function ensureSchema(db){
 db.exec(`CREATE TABLE IF NOT EXISTS publication_toc_titles (
   kind TEXT NOT NULL CHECK(kind IN ('section','outline')),
   id TEXT NOT NULL,
   tr_title TEXT NOT NULL,
   tr_source_hash TEXT NOT NULL,
   en_title TEXT NOT NULL,
   updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(kind,id)
 ) STRICT;`);
}
function sourceTitle(db,kind,id){
 const row=db.prepare(`SELECT s.source_hash AS hash,t.source_hash AS th,t.data_json AS data
   FROM publication_language_sources s JOIN publication_language_variants t
   ON s.kind=t.kind AND s.id=t.id
   WHERE s.kind=? AND s.id=? AND t.language='tr' AND t.state='approved'`).get(kind,id);
 if(!row||row.hash!==row.th)return null;
 let tr;try{tr=JSON.parse(row.data)}catch{return null}
 const title=String(tr.title||'').trim();
 return title?{title,sourceHash:row.hash}:null;
}
function put(db,kind,id,trTitle,enTitle){
 ensureSchema(db);
 if(!['section','outline'].includes(kind)||typeof id!=='string'||!id)throw Error('TOC identity invalid');
 const tr=sourceTitle(db,kind,id);
 if(!tr||tr.title!==trTitle)throw Error('Approved Turkish title changed or missing: '+id);
 const english=String(enTitle||'').trim();
 if(!english||english.length>500||/[\r\n]/.test(english))throw Error('English TOC title invalid: '+id);
 db.prepare(`INSERT INTO publication_toc_titles(kind,id,tr_title,tr_source_hash,en_title) VALUES(?,?,?,?,?)
   ON CONFLICT(kind,id) DO UPDATE SET tr_title=excluded.tr_title,
   tr_source_hash=excluded.tr_source_hash,en_title=excluded.en_title,updated_at=CURRENT_TIMESTAMP`)
  .run(kind,id,tr.title,tr.sourceHash,english);
}
function published(db,kind,id){
 ensureSchema(db);
 const tr=sourceTitle(db,kind,id);
 if(!tr)return {};
 const en=db.prepare('SELECT tr_title,tr_source_hash,en_title FROM publication_toc_titles WHERE kind=? AND id=?').get(kind,id);
 if(!en||en.tr_title!==tr.title||en.tr_source_hash!==tr.sourceHash)return {};
 return {en:{title:en.en_title}};
}
function attach(db,snapshot){
 ensureSchema(db);
 for(const s of snapshot.journal?.sections||[]){
  const titles=published(db,'section',s.sectionId);
  if(Object.keys(titles).length)s.tocLocales=titles;
 }
 for(const s of snapshot.journal?.outline?.series||[]){
  const titles=published(db,'outline',s.key);
  if(Object.keys(titles).length)s.tocLocales=titles;
  for(const c of s.chapters||[]){
   const names=published(db,'outline',c.key);
   if(Object.keys(names).length)c.tocLocales=names;
  }
 }
 return snapshot;
}
module.exports={ensureSchema,sourceTitle,put,published,attach};
