"use strict";
/* Editorially approve approved Universe archive entities in Turkish for preview.
 * No event content changes, no AI generation and no remote publication.
 */
const {DatabaseSync}=require("node:sqlite");
const path=require("node:path");
const p=require("./publication-v2.cjs");
const languages=require("./publication-languages.cjs");
const dbPath=path.resolve(__dirname,"../../channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const db=new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout=25000");
try{
 const before=db.prepare("SELECT COUNT(*) AS n FROM narrative_sections").get().n;
 const snap=p.buildPublicationV2(db,{sourceOnly:true}).snapshot;
 languages.sync(db,snap);
 const totals={ready:0,created:0,refreshed:0,skipped:0};
 const queued=[];
 for(const entity of snap.archive.entities) {
  const pack=languages.variants(db,"entity",entity.entityId);
  if(!pack)throw Error("Missing publication entity source "+entity.entityId);
  const tr=pack.variants.tr;
  if(tr?.state==="approved"&&!tr.stale){totals.ready++;continue;}
  const currentSource=languages.source(db,"entity",entity.entityId);
  if(!currentSource)throw Error("Missing source "+entity.entityId);
  queued.push({id:entity.entityId,sourceHash:pack.sourceHash,revision:tr?.revision??0,
    data:JSON.parse(currentSource.data_json),wasStale:!!tr});
 }
 console.log("TR_SOURCE_PROMOTION_PLAN",JSON.stringify({
   sourceEntities:snap.archive.entities.length,alreadyValid:totals.ready,
   approve:queued.length,stale:queued.filter(x=>x.wasStale).length,
 }));
 if(process.argv.includes("--plan"))process.exit(0);
 db.exec("BEGIN IMMEDIATE");
 try{
   for(const item of queued){
     const r=languages.save(db,{kind:"entity",id:item.id,language:"tr",
       sourceHash:item.sourceHash,revision:item.revision,approved:true,data:item.data});
     if(r.variants.tr?.state!=="approved"||r.variants.tr.stale)throw Error("TR approval failed "+item.id);
     totals[item.wasStale?"refreshed":"created"]++;
   }
   if(db.prepare("SELECT COUNT(*) n FROM narrative_sections").get().n!==before)
     throw Error("Narrative count altered by language approval");
   if(db.prepare("PRAGMA quick_check").get().quick_check!=="ok")
     throw Error("SQLite integrity issue");
   if(db.prepare("PRAGMA foreign_key_check").all().length)throw Error("Bad FK");
   db.exec("COMMIT");
 }catch(e){db.exec("ROLLBACK");throw e;}
 const result=p.buildPublicationV2(db).snapshot;
 const validTR=result.archive.entities.filter(x=>x.locales?.tr?.status==="approved").length;
 if(validTR!==snap.archive.entities.length)throw Error("Published TR entity count mismatch "+validTR);
 console.log("TR_SOURCE_PROMOTION_COMPLETE",JSON.stringify({validTR,ready:totals.ready,
   created:totals.created,refreshed:totals.refreshed,unchangedSections:before}));
}finally{db.close()}
