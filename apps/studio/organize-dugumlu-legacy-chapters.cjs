"use strict";
/* Non-destructive TOC reorganization. No narrative text or source is retired. */
const {DatabaseSync}=require("node:sqlite");
const assert=require("node:assert/strict"),path=require("node:path");
const publications=require("./publication-v2.cjs");
const languages=require("./publication-languages.cjs");
const outline=require("./narrative-outline.cjs");
const root=path.resolve(__dirname,"../..");
const source=path.join(root,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const at=process.argv.indexOf("--db"),file=at<0?source:path.resolve(process.argv[at+1]||"");
if(at>=0)assert(file.startsWith("/tmp/"),"Test DB must be located under /tmp");
const chapter="topic-chapter-dugumlu-ara-kayitlar";
const legacy=[
 "narrative-section-127176c55905d5","narrative-section-b95cb594436ab0",
 "narrative-section-f6d840d0eb2d8e","narrative-section-814520052f1ab5",
 "narrative-section-d0f52f9f477a55","narrative-section-cc18bdfaf95189",
 "narrative-section-6ad26bb9d8e9e1","narrative-section-91e5bfae40b3ad"
];
const db=new DatabaseSync(file);
db.exec("PRAGMA foreign_keys=ON");
try{
 outline.ensureSchema(db);
 const numbers=db.prepare("SELECT invitation_number AS number FROM narrative_invitation_numbers WHERE series_key='topic-series-dugumlu-kitap' ORDER BY invitation_number").all().map(x=>x.number);
 const expected=Array.from({length:68},(_,i)=>i+1).filter(n=>![25,56,66].includes(n));
 assert.deepEqual(numbers,expected,"First complete all 65 direct invitation numbers");
 const old=db.prepare("SELECT section_key, chapter_key, position FROM narrative_section_chapters WHERE section_key=?");
 for(const sectionKey of legacy){
  const row=old.get(sectionKey);
  assert(row&&[chapter,"topic-chapter-dugumlu-kitap"].includes(row.chapter_key),"Old section moved unexpectedly: "+sectionKey);
 }
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM narrative_sections").get().n,105);
 const beforeOutline=outline.publishedOutline(db, require("./narrative-store.cjs").narrativeMemory(db).map(r=>({sectionId:r.sectionKey})));
 console.log("LEGACY_REORG_READINESS",JSON.stringify({
   preview:!process.argv.includes("--apply"),oldChapter:beforeOutline.series.find(s=>s.key==='topic-series-dugumlu-kitap')?.chapters?.map(x=>({title:x.title,count:x.sectionIds.length})),
   legacyCount:legacy.length
 }));
 if(process.argv.includes("--apply")){
  db.exec("BEGIN IMMEDIATE");
  try{
   if(!db.prepare("SELECT 1 FROM narrative_chapters WHERE key=?").get(chapter)){
    db.prepare("INSERT INTO narrative_chapters(key,series_key,title,number_label,position) VALUES(?,?,?,?,?)")
      .run(chapter,"topic-series-dugumlu-kitap","Ara Kayıtlar","",100);
   }
   for(const [index,key] of legacy.entries()){
    db.prepare("UPDATE narrative_section_chapters SET chapter_key=?,position=? WHERE section_key=?")
      .run(chapter,index,key);
   }
   db.prepare("UPDATE narrative_chapters SET title=? WHERE key=?")
     .run("Davetler","topic-chapter-dugumlu-kitap");
   const snapshot=publications.buildPublicationV2(db,{sourceOnly:true}).snapshot;
   languages.sync(db,snapshot);
   for(const key of ["topic-chapter-dugumlu-kitap",chapter]){
     const tr=languages.source(db,"outline",key);
     assert(tr,"Missing outline translation source "+key);
     const current=languages.variants(db,"outline",key).variants.tr;
     if(!current || current.state!=="approved" || current.stale ||
       JSON.stringify(current.data)!==tr.data_json){
       languages.save(db,{kind:"outline",id:key,language:"tr",sourceHash:tr.source_hash,
         revision:current?.revision??0,approved:true,data:JSON.parse(tr.data_json)});
     }
   }
   // Keep canonical source/revision titles intact; only displayed TR locale
   // separates former numbered summaries from the new primary invitation list.
   for(const sectionKey of legacy){
     const source=languages.source(db,"section",sectionKey);
     const sourceData=JSON.parse(source.data_json);
     if(!/^\d{1,3}\.\s*Davet/iu.test(sourceData.title))continue;
     const desired="Önceki Kayıt — "+sourceData.title;
     const existing=languages.variants(db,"section",sectionKey).variants.tr;
     const data={...(existing && !existing.stale ? existing.data : sourceData),title:desired};
     if(!existing || existing.stale || existing.data?.title!==desired){
       languages.save(db,{kind:"section",id:sectionKey,language:"tr",sourceHash:source.source_hash,
         revision:existing?.revision??0,approved:true,data});
     }
   }
   const final=outline.publishedOutline(db,snapshot.journal.sections);
   const group=final.series.find(s=>s.key==="topic-series-dugumlu-kitap");
   const main=group.chapters.find(c=>c.key==="topic-chapter-dugumlu-kitap");
   const extra=group.chapters.find(c=>c.key===chapter);
   assert.equal(main.sectionIds.length,65);
   assert.equal(extra.sectionIds.length,8);
   assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
   assert.equal(db.prepare("PRAGMA quick_check").get().quick_check,"ok");
   db.exec("COMMIT");
   console.log("LEGACY_REORG_DONE",JSON.stringify({main:main.sectionIds.length,extra:extra.sectionIds.length,
     totalSections:db.prepare("SELECT COUNT(*) AS n FROM narrative_sections").get().n}));
  }catch(e){db.exec("ROLLBACK");throw e;}
 }
}finally{db.close();}
