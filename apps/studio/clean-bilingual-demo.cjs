"use strict";
// Deliberately local-only maintenance. No transport, network or remote database support.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const STUDIO_TABLES=[
 'publication_language_variants','publication_language_sources',
 'narrative_section_chapters','narrative_chapters','narrative_series','narrative_visual_slots',
 'narrative_section_revisions','narrative_sections','narrative_run_sources','narrative_runs',
 'entity_visual_profiles','universe_main_characters','universe_workspace_history','universe_workspace_revisions','universe_workspace_relations',
 'universe_workspace_imports','universe_workspace_nodes','universe_ingest_run_sources','universe_ingest_runs','universe_ingest_sources',
 'universe_merge_chunks','universe_merge_runs','ai_analysis_editorial_reviews','ai_analysis_jobs','source_ai_analyses',
 'vefk_document_sources','vefk_publication_selection','vefk_revisions','vefk_documents','vefk_source_analyses',
];
const PRESERVE=['source_transcripts','content_transcripts','youtube_channels','youtube_videos','youtube_transcript_ignored','content_items','content_sources','relations','narrative_narrator_profile','vefk_sources','vefk_source_preparations'];
const COMMUNITY_TABLES=['forum_attachments','forum_posts','forum_threads'];
const exists=(db,name)=>Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function tableSnapshot(db,names){return Object.fromEntries(names.filter(n=>exists(db,n)).map(n=>{const rows=db.prepare(`SELECT * FROM "${n}"`).all().map(r=>JSON.stringify(r)).sort();return[n,{rows:rows.length,sha256:digest(rows)}];}));}
function clearDatabase(db,tables,preserved,studio=false){
 const before=tableSnapshot(db,preserved),removed=Object.fromEntries(tables.filter(n=>exists(db,n)).map(n=>[n,Number(db.prepare(`SELECT COUNT(*) AS n FROM "${n}"`).get().n)]));
 db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON;');
 try{
  for(const n of tables)if(exists(db,n))db.exec(`DELETE FROM "${n}"`);
  if(studio&&exists(db,'studio_meta'))db.exec("DELETE FROM studio_meta WHERE key IN ('last_export_at','last_export_file','last_export_publication_id','last_export_fingerprint','last_export_sections','last_export_entities','last_export_relations','last_export_assets','last_export_vefks')");
  const after=tableSnapshot(db,preserved);
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Korunacak kaynak veya yetkilendirme verisi değişti. İşlem geri alındı.');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('İlişkisel bütünlük kontrolü başarısız.');
  db.exec('COMMIT;');return {removed,preserved:after,integrity:db.prepare('PRAGMA integrity_check').get().integrity_check};
 }catch(error){db.exec('ROLLBACK;');throw error;}
}
function localPaths(){const root=path.resolve(__dirname,'../../channels/birdesengor');return {root,studio:path.join(root,'.local-data/studio'),community:path.join(root,'web/.local-data/community.sqlite')};}
function run(apply=false){
 const paths=localPaths(),studioFile=path.join(paths.studio,'channel-foundry-studio.sqlite');
 const targets=[['studio',studioFile,STUDIO_TABLES,PRESERVE],['community',paths.community,COMMUNITY_TABLES,['users','email_verifications']]].filter(([,file])=>fs.existsSync(file));
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=path.join(paths.studio,'backups','bilingual-clean-'+stamp),report={scope:'Local BirDeSenGör demo only',applied:apply,databases:{},files:[]};
 const preservedFiles=[path.join(paths.root,'channel.json'),...fs.readdirSync(paths.studio).filter(n=>/config|credentials|settings/.test(n)&&fs.statSync(path.join(paths.studio,n)).isFile()).map(n=>path.join(paths.studio,n))];
 const filesBefore=Object.fromEntries(preservedFiles.map(f=>[f,digest(fs.readFileSync(f))]));
 if(apply)fs.mkdirSync(backup,{recursive:true,mode:0o700});
 for(const [kind,file,tables,preserve]of targets){
  if(!fs.realpathSync(file).startsWith(fs.realpathSync(paths.root)+path.sep))throw new Error('Yerel kanal dizini dışında temizlik yapılamaz.');
  const db=new DatabaseSync(file,{readOnly:!apply});
  try{if(apply){db.prepare('VACUUM INTO ?').run(path.join(backup,kind+'.sqlite'));report.databases[kind]=clearDatabase(db,tables,preserve,kind==='studio');}
   else report.databases[kind]={cleanup:tableSnapshot(db,tables),preserved:tableSnapshot(db,preserve)};
  }finally{db.close();}
 }
 if(apply){
  // Archive only generated output and SEO drafts. Original assets and downloads stay in place.
  for(const name of ['public-export','seo-workspaces']){const file=path.join(paths.studio,name);if(fs.existsSync(file)){fs.renameSync(file,path.join(backup,name));report.files.push(name);}}
  const db=new DatabaseSync(studioFile);
  try{require('./ai-analysis.cjs').ensureSchema(db);require('./publication-languages.cjs').ensureSchema(db);report.emptyPublication=require('./publication-v2.cjs').exportPublicationV2(db,paths.studio);const afterExport=tableSnapshot(db,PRESERVE);if(JSON.stringify(afterExport)!==JSON.stringify(report.databases.studio.preserved))throw new Error('Yayın üretiminden sonra kaynak bütünlüğü değişti.');report.postExportArchiveVerified=true;}finally{db.close();}
  for(const f of preservedFiles)if(digest(fs.readFileSync(f))!==filesBefore[f])throw new Error('Korunan ayar dosyası değişti.');
  report.protectedFilesVerified=preservedFiles.length;report.backup=backup;
  fs.writeFileSync(path.join(backup,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
 }
 return report;
}
if(require.main===module){const apply=process.argv.includes('--apply-local');console.log(JSON.stringify(run(apply),null,2));}
module.exports={STUDIO_TABLES,PRESERVE,clearDatabase,run,tableSnapshot};
