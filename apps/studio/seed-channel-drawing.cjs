'use strict';
/** Explicit local-only installation; no network, commit or deployment. */
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const project=require('./channel-projects.cjs');
const drawing=require('./channel-drawing.cjs');
const catalog=require('./vefk-publication.cjs');
function install() {
  const root=path.resolve(__dirname,'../..');
  if(project.activeProjectId(root)!=='birdesengor')throw Error('Yalnız etkin BirDeSenGör kanalına kurulabilir.');
  const folder=path.join(project.activeDataRoot(root),'studio');
  const dbFile=path.join(folder,'channel-foundry-studio.sqlite');
  if(!fs.existsSync(dbFile))throw Error('Studio veritabanı bulunamadı.');
  const db=new DatabaseSync(dbFile,{timeout:5000});
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const backup=path.join(folder,'backups','channel-drawing-'+new Date().toISOString().replace(/[:.]/g,'-'));
    fs.mkdirSync(backup,{recursive:true});
    db.prepare('VACUUM INTO ?').run(path.join(backup,'studio.sqlite'));
    const exportFolder=path.join(folder,'public-export');
    if(fs.existsSync(exportFolder))fs.cpSync(exportFolder,path.join(backup,'public-export'),{recursive:true});
    const languages=require('./publication-languages.cjs');
    const videos=require('./ai-analysis-public.cjs').publicVideoSummaries(db).filter(v=>Object.keys(languages.published(db,'video',v.videoId)).length);
    const result=drawing.synchronize(db,videos,{install:true});
    // Remove old demo selections, keeping all original editable documents.
    const removed=catalog.selected(db).filter(s=>s.id!==drawing.ID);
    for(const entry of removed)catalog.select(db,{id:entry.id,enabled:false});
    const exported=require('./storage-publication.cjs').exportPublicSnapshot(db,folder);
    const snapshot=JSON.parse(fs.readFileSync(exported.file,'utf8'));
    if(snapshot.vefkCatalog.entries.length!==1||snapshot.vefkCatalog.entries[0].id!==drawing.ID)throw Error('Tek ana kayıt doğrulanamadı.');
    return {id:result.id,revision:result.revision,sponsor:result.sponsor,paths:result.document.geometry.paths.length,
      durationMs:result.document.drawPlan.durationMs,removedSelections:removed.map(e=>e.id),backup,publication:exported.file,localOnly:true};
  } finally {db.close();}
}
module.exports={install};
if(require.main===module)console.log(JSON.stringify(install(),null,2));
