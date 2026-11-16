"use strict";
/**
 * Promote a reviewed source-scoped invitation batch into canonical local book chapters.
 *
 * Guardrails: all pre-existing sections untouched; scoped editorial narrative run
 * does NOT consume general Universe change baseline. One SQLite transaction.
 */
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {DatabaseSync}=require("node:sqlite");
const drafts=require("./invitation-draft-service.cjs");
const narrative=require("./narrative-store.cjs");
const structure=require("./narrative-structured-content.cjs");
const invitationNums=require("./narrative-invitation-numbers.cjs");
const publications=require("./publication-v2.cjs");
const languages=require("./publication-languages.cjs");

const root=path.resolve(__dirname,"../..");
const defaultDb=path.join(root,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const targetChapter="topic-chapter-dugumlu-kitap";
const prefix="invitation-editorial:";
const auditFolder=path.join(root,"channels/birdesengor/.local-data/studio/invitation-audits");
const hash=value=>crypto.createHash("sha256").update(String(value)).digest("hex");

function sectionKey(n){return "narrative-section-dugumlu-invitation-"+String(n).padStart(3,"0");}
function isWordBounded(text,start,length){
  const letter=/[\p{L}\p{N}]/u;
  return (start===0||!letter.test(text[start-1])) && (start+length===text.length||!letter.test(text[start+length]));
}
function inlineBlocks(body,available){
  const candidates=available.filter(source=>source.sourceType==="node" &&
    source.snapshot?.name && source.snapshot.name!=="Ömer" &&
    source.snapshot.name!=="Anlatıcı" &&
    ["character","object","location"].includes(source.snapshot.kind))
    .sort((a,b)=>b.snapshot.name.length-a.snapshot.name.length);
  const referenced=new Set();
  const blocks=body.split(/\n\s*\n/).map(paragraph=>{
    const matches=[];
    for(const source of candidates){
      if(referenced.has(source.sourceKey))continue;
      const name=source.snapshot.name;
      const index=paragraph.toLocaleLowerCase("tr-TR").indexOf(name.toLocaleLowerCase("tr-TR"));
      if(index<0||!isWordBounded(paragraph,index,name.length))continue;
      if(matches.some(m=>index<m.end&&index+name.length>m.start))continue;
      matches.push({start:index,end:index+name.length,entityId:source.sourceKey,label:paragraph.slice(index,index+name.length)});
      referenced.add(source.sourceKey);
    }
    matches.sort((a,b)=>a.start-b.start);
    let cursor=0;
    const spans=[];
    for(const match of matches){
      if(match.start>cursor)spans.push({type:"text",text:paragraph.slice(cursor,match.start)});
      spans.push({type:"reference",entityId:match.entityId,label:match.label});
      cursor=match.end;
    }
    if(cursor<paragraph.length)spans.push({type:"text",text:paragraph.slice(cursor)});
    return {type:"paragraph",spans};
  });
  return blocks;
}
function dbOption(){
  const i=process.argv.indexOf("--db");
  if(i<0)return defaultDb;
  const filename=path.resolve(process.argv[i+1]||"");
  assert(filename.startsWith("/tmp/"),"Only /tmp copies are accepted for explicit --db.");
  return filename;
}
function approvedDrafts(db,start,end){
  const draftRows=[];
  const inventory=drafts.listing(db);
  for(let n=start;n<=end;n++){
    // No fabricated dialogues for a numbered invitation without direct recording.
    if (!inventory.find(x=>x.number===n)?.videoId) {
      console.log("NO_DIRECT_RECORDING",n);continue;
    }
    const detail=drafts.detail(db,n);
    assert(detail.draft && !detail.stale,"Missing or stale draft #"+n);
    assert(detail.draft.reviewed,"Unreviewed draft #"+n);
    const p=path.join(auditFolder,n+".json");
    assert(fs.existsSync(p),"No source-verification audit for #"+n);
    const audit=JSON.parse(fs.readFileSync(p));
    assert(["pass","review"].includes(audit.verdict),"Blocking source audit for #"+n+": "+audit.verdict);
    assert(!audit.issues.some(i=>i.severity==="blocking"),"Unresolved source audit issue for #"+n);
    assert(audit.videoId===detail.videoId,"Audit video mismatch #"+n);
    assert(audit.sourceVideoIds===undefined ||
      JSON.stringify(audit.sourceVideoIds)===JSON.stringify(detail.sourceVideoIds),"Audit source list mismatch #"+n);
    assert(audit.draftHash===hash(detail.draft.title+"\n"+detail.draft.body),"Audit draft outdated #"+n);
    assert(audit.sourceHash===hash(detail.originalSubtitle),"Audit transcript outdated #"+n);
    const existing=db.prepare("SELECT 1 FROM narrative_sections WHERE key=?").get(sectionKey(n));
    assert(!existing,"Canonical invitation chapter already exists #"+n);
    draftRows.push({n,key:sectionKey(n),detail,audit});
  }
  return draftRows;
}
function prepare(db,start,end){
  narrative.ensureSchema(db);
  const items=approvedDrafts(db,start,end);
  assert(items.length,"No eligible approved invitations in requested interval");
  const prior=db.prepare("SELECT id,universe_fingerprint AS universeFingerprint FROM narrative_runs " +
    "WHERE state='applied' AND model NOT LIKE 'invitation-editorial:%' ORDER BY id DESC LIMIT 1").get();
  assert(prior,"Missing general narrative source baseline");
  const approved=db.prepare("SELECT COUNT(*) AS n FROM narrative_sections WHERE state='active' AND current_revision_id IS NOT NULL").get().n;
  assert(approved>=50,"Expected the original 40 plus first ten approved invitations");
  assert(db.prepare("SELECT 1 FROM narrative_chapters WHERE key=?").get(targetChapter));
  const baseline=narrative.buildInput(db);
  assert(baseline.changes.length>0,"Unexpected empty pending general Universe delta");
  const current=narrative.currentUniverseSources(db);
  const sourceByVideo=new Map();
  for(const source of current){
    if(source.sourceType!=="node" || source.snapshot?.name==="Ömer")continue;
    for(const video of source.sourceVideoIds){
      if(!sourceByVideo.has(video))sourceByVideo.set(video,[]);
      sourceByVideo.get(video).push(source);
    }
  }
  for(const item of items){
    item.sources=[...new Map(item.detail.sourceVideoIds.flatMap(id=>sourceByVideo.get(id)||[])
       .map(s=>[s.sourceKey,s])).values()];
    assert(item.sources.some(x=>x.snapshot.kind==="character" || x.snapshot.kind==="object"),
      "No approved entity provenance for invitation "+item.n);
  }
  return {items,prior,baseline,current,start,end,approved};
}
function apply(db,preview){
  const {items,prior,baseline,start,end}=preview;
  const fingerprint=narrative.fingerprint({
    scope:"invitation-editorial-v1", invitations:items.map(item=>({
      number:item.n,sources:item.detail.sourceVideoIds,
      sourceHash:item.detail.sourceHash,
      draftHash:item.audit.draftHash,
      auditVerdict:item.audit.verdict,
    }))
  });
  const model=prefix+"gpt-6.1-terra";
  const sourceCurrentMap=new Map(preview.current.map(s=>[s.sourceKey,s]));
  const previousMax=db.prepare("SELECT COALESCE(MAX(position),-1) AS m FROM narrative_section_revisions r " +
    "JOIN narrative_sections s ON s.current_revision_id=r.id WHERE s.state='active'").get().m;
  const beforeCount=db.prepare("SELECT count(*) n FROM narrative_sections").get().n;
  const beforePending=baseline.changes.length;
  db.exec("BEGIN IMMEDIATE");
  try{
    const runId=Number(db.prepare("INSERT INTO narrative_runs(state,baseline_run_id,universe_fingerprint,input_fingerprint,input_json,model,applied_at) " +
       "VALUES('applied',?,?,?,?,?,CURRENT_TIMESTAMP)").run(
        prior.id,baseline.universeFingerprint,fingerprint,
        JSON.stringify({scope:"invitation-editorial-v1",generalSourceBaselineRunId:prior.id,
          invitationNumbers:items.map(i=>i.n),sourceVideoIds:items.flatMap(i=>i.detail.sourceVideoIds),
          sourceAuditFingerprints:items.map(i=>i.audit.inputHash),
          outstandingUniverseChanges:beforePending}),
        model).lastInsertRowid);
    // Preserve the previous general baseline's archival evidence and add only
    // the current exact-video entities. Change detection excludes this run.
    db.prepare("INSERT INTO narrative_run_sources(run_id,source_type,source_key,change_kind,is_current," +
      "source_fingerprint,source_video_ids_json,snapshot_json) SELECT ?,source_type,source_key,change_kind,is_current," +
      "source_fingerprint,source_video_ids_json,snapshot_json FROM narrative_run_sources WHERE run_id=?")
      .run(runId,prior.id);
    const upsert=db.prepare("INSERT INTO narrative_run_sources(run_id,source_type,source_key,change_kind,is_current," +
      "source_fingerprint,source_video_ids_json,snapshot_json) VALUES(?,?,?,'unchanged',1,?,?,?) " +
      "ON CONFLICT(run_id,source_type,source_key) DO UPDATE SET " +
      "source_fingerprint=excluded.source_fingerprint,source_video_ids_json=excluded.source_video_ids_json," +
      "snapshot_json=excluded.snapshot_json,is_current=1");
    const allSelected=[...new Map(items.flatMap(i=>i.sources).map(s=>[s.sourceKey,s])).values()];
    for(const source of allSelected){
      upsert.run(runId,source.sourceType,source.sourceKey,source.fingerprint,
        JSON.stringify(source.sourceVideoIds),JSON.stringify(source.snapshot));
    }
    // Insert at requested ordinal positions; preserve existing later / previous entries.
    db.prepare("UPDATE narrative_section_chapters SET position=position+? WHERE chapter_key=? AND position>=?")
      .run(end-start+1,targetChapter,start-1);
    for(const item of items){
      const srcKeys=[...new Set(item.sources.map(x=>x.sourceKey))];
      const blocks=inlineBlocks(item.detail.draft.body,item.sources);
      const sourceMap=new Map(item.sources.map(x=>[x.sourceKey,x]));
      const normalized=structure.normalizeBlocks(blocks,{
        entityLookup:id=>sourceMap.get(id),sourceKeys:new Set(srcKeys)});
      const plain=structure.plainTextFromBlocks(normalized);
      const normalizedProse=item.detail.draft.body.trim().split(/\n\s*\n/).map(p=>p.trim()).join("\n\n");
      assert(plain===normalizedProse,"Structured blocks altered narrative beyond paragraph whitespace #"+item.n);
      const references=structure.entityReferencesFromBlocks(normalized,id=>sourceMap.get(id));
      db.prepare("INSERT INTO narrative_sections(key,state) VALUES(?,'active')").run(item.key);
      const info=db.prepare("INSERT INTO narrative_section_revisions(section_key,run_id,revision_no,position,title,body," +
        "blocks_json,entity_references_json,source_keys_json,source_video_ids_json,media_json,retire,state,approved_at) " +
        "VALUES(?,?,1,?,?,?,?,?,?,?,'[]',0,'approved',CURRENT_TIMESTAMP)").run(
          item.key,runId,previousMax+item.n,item.detail.draft.title,plain,
          JSON.stringify(normalized),JSON.stringify(references),JSON.stringify(srcKeys),
          JSON.stringify(item.detail.sourceVideoIds));
      db.prepare("UPDATE narrative_sections SET current_revision_id=? WHERE key=?").run(Number(info.lastInsertRowid),item.key);
      db.prepare("INSERT INTO narrative_section_chapters(section_key,chapter_key,position) VALUES(?,?,?)")
        .run(item.key,targetChapter,item.n-1);
      invitationNums.save(db,{sectionKey:item.key,seriesKey:drafts.TARGET_SERIES,
        number:item.n,sourceVideoId:item.detail.videoId});
    }
    // Make reviewed Turkish book prose immediately renderable, with EN later.
    const publication=publications.buildPublicationV2(db,{sourceOnly:true});
    languages.sync(db,publication.snapshot);
    for(const item of items){
      const s=languages.source(db,"section",item.key);
      assert(s,"No Turkish publication source for "+item.key);
      languages.save(db,{kind:"section",id:item.key,language:"tr",sourceHash:s.sourceHash??s.source_hash,
        revision:0,approved:true,data:JSON.parse(s.data_json)});
    }
    const after=narrative.buildInput(db);
    assert.equal(after.changes.length,beforePending,"Pending source differences were silently consumed");
    assert.equal(after.removed.length,baseline.removed.length);
    assert.equal(db.prepare("SELECT count(*) n FROM narrative_sections").get().n,beforeCount+items.length);
    assert.equal(invitationNums.get(db).filter(r=>r.seriesKey===drafts.TARGET_SERIES).length,
      preview.approved-40+items.length);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check,"ok");
    db.exec("COMMIT");
    return {runId,beforeCount,afterCount:beforeCount+items.length,beforePending,afterPending:after.changes.length,
      referencesCount:db.prepare("SELECT SUM(json_array_length(r.entity_references_json)) n FROM narrative_section_revisions r " +
        "WHERE r.run_id=?").get(runId).n};
  }catch(err){db.exec("ROLLBACK");throw err;}
}
function main(){
 const file=dbOption();
 const atStart=process.argv.indexOf('--start'), atEnd=process.argv.indexOf('--end');
 const start=atStart<0?11:Number(process.argv[atStart+1]);
 const end=atEnd<0?20:Number(process.argv[atEnd+1]);
 assert(Number.isInteger(start)&&Number.isInteger(end)&&start>=11&&end<=68&&end>=start&&end-start<=11,
   'Only ordered source batches of at most 12 numbers are allowed');
 const db=new DatabaseSync(file);
 db.exec("PRAGMA foreign_keys=ON");
 try{
  const pre=prepare(db,start,end);
  console.log("IMPORT_READINESS",JSON.stringify({database:file,apply:process.argv.includes("--apply"),
    range:[start,end],drafts:pre.items.length,sourceBaseline:pre.prior.id,
    oldSections:pre.approved,pendingChanges:pre.baseline.changes.length,
    entityEvidence:pre.items.map(x=>({number:x.n,entities:x.sources.map(s=>s.snapshot.name)}))}));
  if(process.argv.includes("--apply"))console.log("IMPORT_RESULT",JSON.stringify(apply(db,pre)));
 }finally{db.close();}
}
main();
