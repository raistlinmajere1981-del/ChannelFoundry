"use strict";
// Read-only, compact counters for Dashboard. Full translation/SEO editors
// keep their authoritative snapshot validation.
const fs=require("node:fs");
const path=require("node:path");
const language=require("./publication-languages.cjs");
const {activeProject}=require("./channel-projects.cjs");
let cache=null;
const readJSON=value=>{try{return JSON.parse(value)}catch{return null}};
const emptyCounts=()=>({ready:0,missing:0,pending:0,stale:0,errors:0});
function one(db,statement){
 try{return db.prepare(statement).get()}catch(error){if(/no such table/i.test(error.message))return null;throw error}
}
function all(db,statement){
 try{return db.prepare(statement).all()}catch(error){if(/no such table/i.test(error.message))return [];throw error}
}
function seoFile(root){
 const name=String(activeProject()?.id||"default").replace(/[^a-zA-Z0-9_.:-]/g,"").slice(0,120);
 return path.join(root,"seo-workspaces",name+".json");
}
function readSeo(root){
 try{const file=readJSON(fs.readFileSync(seoFile(root),"utf8"));return file?.schemaVersion===2?file.items||{}:{}}
 catch{return {}}
}
function signature(db,root){
 const stat=(()=>{try{return fs.statSync(seoFile(root))}catch{return null}})();
 return [one(db,"SELECT total_changes() AS n")?.n||0,one(db,"PRAGMA data_version")?.data_version||0,
   stat?.mtimeMs||0,stat?.size||0,activeProject()?.id||"default"].join(":");
}
function compute(db,root){
 const counts=emptyCounts();
 const seoItems=readSeo(root);
 // Retired outline branches and old entity sources remain stored for history.
 // They must never inflate the current published translation inventory.
 const privateVideos=new Set(all(db,"SELECT video_id AS id FROM youtube_videos WHERE availability IN ('subscriber_only','premium_only','needs_auth')").map(row=>row.id));
 const publicEntities=new Set(all(db,"SELECT key FROM universe_workspace_nodes WHERE state='approved'").map(row=>row.key));
 const activeSections=new Set(all(db,"SELECT key FROM narrative_sections WHERE state='active' AND current_revision_id IS NOT NULL").map(row=>row.key));
 const publicChapters=new Set(all(db,"SELECT DISTINCT sc.chapter_key AS key FROM narrative_section_chapters sc "+
   "JOIN narrative_sections n ON n.key=sc.section_key WHERE n.state='active' AND n.current_revision_id IS NOT NULL").map(row=>row.key));
 const publicSeries=new Set(all(db,"SELECT DISTINCT c.series_key AS key FROM narrative_chapters c "+
   "JOIN narrative_section_chapters sc ON sc.chapter_key=c.key "+
   "JOIN narrative_sections n ON n.key=sc.section_key WHERE n.state='active' AND n.current_revision_id IS NOT NULL").map(row=>row.key));
 const sourceRows=all(db,"SELECT s.kind,s.id,s.source_hash AS sourceHash, "+
   "tr.state AS trState,tr.source_hash AS trHash,tr.approved_revision AS trRevision, "+
   "tr.data_json AS trData,tr.job_state AS trJob,tr.candidate_json AS trCandidate, "+
   "en.state AS enState,en.source_hash AS enHash,en.approved_revision AS enRevision,en.tr_dependency AS enDependency, "+
   "en.data_json AS enData,en.job_state AS enJob,en.candidate_json AS enCandidate "+
   "FROM publication_language_sources s "+
   "LEFT JOIN publication_language_variants tr ON tr.kind=s.kind AND tr.id=s.id AND tr.language='tr' "+
   "LEFT JOIN publication_language_variants en ON en.kind=s.kind AND en.id=s.id AND en.language='en'");
 let seoPages=0,seoDraftCount=0,missingNonVideo=0;
 for(const row of sourceRows){
   if(row.kind==='entity'&&!publicEntities.has(row.id))continue;
   if(row.kind==='section'&&!activeSections.has(row.id))continue;
   if(row.kind==='outline'&&!publicChapters.has(row.id)&&!publicSeries.has(row.id))continue;
   const trCurrent=row.trHash===row.sourceHash;
   const enCurrent=row.enHash===row.sourceHash;
   const trOK=row.trState==="approved"&&trCurrent;
   let trDependency="";
   if(trOK && row.enDependency){
     trDependency=language.hash({sourceHash:row.trHash,revision:row.trRevision,data:readJSON(row.trData)});
   }
   const enStale=Boolean(row.enDependency)&&row.enDependency!==trDependency;
   const enOK=row.enState==="approved"&&enCurrent&&!enStale;
   if(trOK&&enOK)counts.ready++;
   if(!row.enData||!readJSON(row.enData)||row.enData==='{}'){counts.missing++;if(row.kind!=='video')missingNonVideo++;}
   if((row.trState==="draft"&&trCurrent)||(row.enState==="draft"&&enCurrent)
      ||[row.trCandidate,row.enCandidate].some(candidate=>{
       const data=readJSON(candidate);
       return data?.sourceHash===row.sourceHash;
     }))counts.pending++;
   if((row.trState&& !trCurrent)||(row.enState&&(!enCurrent||enStale)))counts.stale++;
   if(row.trJob==='error'||row.enJob==='error')counts.errors++;
   if(!["entity","section","video","vefk"].includes(row.kind))continue;
   if(row.kind==='video'&&privateVideos.has(row.id))continue;
   for(const [locale,approved,textValue,revision] of [["tr",trOK,row.trData,row.trRevision],["en",enOK,row.enData,row.enRevision]]){
     if(!approved)continue;
     const data=readJSON(textValue);
     if(!data||data.analysisStale)continue;
     const {core,analysisStale,...prose}=data;
     const published={...prose,status:'approved',sourceHash:row.sourceHash,revision};
     if(row.kind==="video" && (data.membersOnly||data.analysisStatus==="stale"))continue;
     const title=row.kind==="entity"?data.name:data.title;
     if(!title)continue;
     const key=locale+":"+row.kind+":"+row.id;
     const saved=seoItems[key]||{};
     seoPages++;
     if(!saved.title||!saved.description||saved.approvedHash!==language.hash(published))seoDraftCount++;
   }
 }
 const extraEntities=Number(one(db,"SELECT COUNT(*) AS n FROM universe_workspace_nodes n "+
   "WHERE n.state='approved' AND NOT EXISTS (SELECT 1 FROM publication_language_sources s "+
   "WHERE s.kind='entity' AND s.id=n.key)")?.n||0);
 const extraSections=Number(one(db,"SELECT COUNT(*) AS n FROM narrative_sections n "+
   "WHERE n.state='active' AND NOT EXISTS (SELECT 1 FROM publication_language_sources s "+
   "WHERE s.kind='section' AND s.id=n.key)")?.n||0);
 const extraVideos=Number(one(db,"SELECT COUNT(*) AS n FROM source_ai_analyses a "+
   "JOIN ai_analysis_jobs j ON j.provider=a.provider AND j.external_id=a.external_id AND j.state='done' "+
   "JOIN ai_analysis_editorial_reviews er ON er.provider=a.provider AND er.external_id=a.external_id AND er.state='curated' "+
   "WHERE a.provider='youtube' AND NOT EXISTS (SELECT 1 FROM publication_language_sources s "+
   "WHERE s.kind='video' AND s.id=a.external_id)")?.n||0);
 const extras=extraEntities+extraSections+extraVideos;
 counts.missing+=extras;
 missingNonVideo+=extraEntities+extraSections;
 return {languages:counts,missingVideoOnly:counts.missing>0&&missingNonVideo===0,seo:{pages:seoPages,draftCount:seoDraftCount},merge:mergeSnapshot(db)};
}
function mergeSnapshot(db){
 const processed=Number(one(db,"SELECT COUNT(*) AS n FROM universe_ingest_sources WHERE provider='youtube'")?.n||0);
 const eligible=Number(one(db,"SELECT COUNT(*) AS n FROM source_ai_analyses a "+
   "JOIN ai_analysis_jobs j ON j.provider=a.provider AND j.external_id=a.external_id AND j.state='done' "+
   "JOIN ai_analysis_editorial_reviews er ON er.provider=a.provider AND er.external_id=a.external_id AND er.state='curated' "+
   "WHERE a.provider='youtube'")?.n||0);
 const pending=Number(one(db,"SELECT COUNT(*) AS n FROM source_ai_analyses a "+
   "JOIN ai_analysis_jobs j ON j.provider=a.provider AND j.external_id=a.external_id AND j.state='done' "+
   "JOIN ai_analysis_editorial_reviews er ON er.provider=a.provider AND er.external_id=a.external_id AND er.state='curated' "+
   "WHERE a.provider='youtube' AND NOT EXISTS (SELECT 1 FROM universe_ingest_sources s "+
   "WHERE s.provider=a.provider AND s.external_id=a.external_id)")?.n||0);
 const run=one(db,"SELECT id,state,model,analysis_count AS analysisCount,error,created_at AS createdAt, "+
   "updated_at AS updatedAt,finished_at AS finishedAt FROM universe_merge_runs ORDER BY id DESC LIMIT 1");
 const progress=run?one(db,"SELECT COUNT(*) AS totalChunks, "+
   "SUM(CASE WHEN state='done' THEN 1 ELSE 0 END) AS doneChunks, "+
   "SUM(CASE WHEN state='error' THEN 1 ELSE 0 END) AS errorChunks, "+
   "MAX(level) AS level FROM universe_merge_chunks WHERE run_id="+Number(run.id)):null;
 const prepared=one(db,"SELECT run_id AS runId FROM universe_ingest_runs WHERE state='prepared' ORDER BY run_id DESC LIMIT 1");
 const drafts=Number(one(db,"SELECT COUNT(*) AS n FROM universe_workspace_nodes WHERE state='draft'")?.n||0);
 const revisions=Number(one(db,"SELECT COUNT(*) AS n FROM universe_workspace_revisions WHERE state='pending'")?.n||0);
 const ingest={pending,newSources:pending,changedSources:0,eligible,processed,withdrawals:0,
   awaitingApplyRunId:prepared?.runId??null,batchLimit:10,nextSources:[],
   backlog:{drafts,revisions,total:drafts+revisions}};
 const lastRun=run?{...run,id:Number(run.id),analysisCount:Number(run.analysisCount),
   totalChunks:Number(progress?.totalChunks||0),doneChunks:Number(progress?.doneChunks||0),
   errorChunks:Number(progress?.errorChunks||0),level:Number(progress?.level||0)}:null;
 return {availableAnalyses:pending,ingest,run:lastRun};
}
function overview(db,root){
 // An uncommitted transaction may roll back without changing SQLite's total
 // changes marker. Bypass caching until the transaction ends.
 if(db.isTransaction)return compute(db,root);
 const current=signature(db,root);
 if(cache?.db===db&&cache?.root===root&&cache?.signature===current)return cache.result;
 const result=compute(db,root);
 cache={db,root,signature:signature(db,root),result};
 return result;
}
module.exports={overview,clear:()=>{cache=null}};
