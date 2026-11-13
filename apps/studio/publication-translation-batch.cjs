'use strict';
// Durable, single-worker publication translation queue. It never approves or publishes.
// Queue rows belong to the currently opened Studio SQLite database.
const languages = require('./publication-languages.cjs');
const VALID_KINDS=new Set(['video','section','entity','outline','vefk']);
const MAX_BATCH=1500;
function ensureSchema(db){
  languages.ensureSchema(db);
  db.exec(`CREATE TABLE IF NOT EXISTS publication_translation_jobs (
    kind TEXT NOT NULL, id TEXT NOT NULL, language TEXT NOT NULL CHECK(language='en'),
    source_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('queued','running','done','failed','skipped')),
    attempts INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(kind,id,language)
  ) STRICT;`);
}
function status(db){
  ensureSchema(db);
  const rows=db.prepare('SELECT kind,id,language,source_hash AS sourceHash,state,attempts,error,updated_at AS updatedAt FROM publication_translation_jobs ORDER BY updated_at DESC,kind,id LIMIT 1500').all();
  const counts={queued:0,running:0,done:0,failed:0,skipped:0};
  for(const item of rows)counts[item.state]++;
  return {rows,counts};
}
function eligible(db,kind,id){
  const pack=languages.variants(db,kind,id);
  if(!pack)return {reason:'Kaynak bulunamadı'};
  const tr=pack.variants.tr,en=pack.variants.en;
  if(!tr||tr.stale||tr.state!=='approved')return {reason:'Türkçe metin onaylanmamış'};
  if(en?.state==='approved'&&!en.stale)return {reason:'İngilizce zaten güncel ve onaylı'};
  if(en?.candidate&&!en.stale)return {reason:'AI önerisi inceleme bekliyor'};
  return {pack};
}
function enqueue(db,input={}){
  ensureSchema(db);
  const items=input.items;
  if(!Array.isArray(items)||!items.length||items.length>MAX_BATCH)throw new Error('Çeviri için 1–1500 kaynak kayıt seçilmeli.');
  const insert=db.prepare(`INSERT INTO publication_translation_jobs(kind,id,language,source_hash,state,attempts,error,updated_at)
    VALUES(?,?, 'en',?, 'queued',0,'',CURRENT_TIMESTAMP)
    ON CONFLICT(kind,id,language) DO UPDATE SET source_hash=excluded.source_hash,state='queued',attempts=0,error='',updated_at=CURRENT_TIMESTAMP`);
  let queued=0,skipped=0;
  const seen=new Set();
  for(const item of items){
    const kind=String(item?.kind||''),id=String(item?.id||'');
    if(!VALID_KINDS.has(kind)||!id||id.length>400)throw new Error('Geçersiz çeviri kaydı.');
    if(seen.has(kind+':'+id))continue;
    seen.add(kind+':'+id);
    const result=eligible(db,kind,id);
    if(!result.pack){skipped++;continue;}
    insert.run(kind,id,result.pack.sourceHash);
    queued++;
  }
  return {queued,skipped,...status(db)};
}
function createController({database,userDataPath,generate=languages.generate,onProgress=()=>{}}){
  let paused=true,worker=null,controller=null;
  const db=()=>database();
  const notify=()=>{try{onProgress();}catch{}};
  function recover(){
    ensureSchema(db());
    db().prepare("UPDATE publication_translation_jobs SET state='queued',error='Önceki çalışma kesildi; devam edilecek.',updated_at=CURRENT_TIMESTAMP WHERE state='running'").run();
    return current();
  }
  function current(){return {...status(db()),running:!!worker&&!paused,paused};}
  async function process(){
    try{
      while(!paused){
        const row=db().prepare("SELECT kind,id,source_hash FROM publication_translation_jobs WHERE state='queued' ORDER BY updated_at,kind,id LIMIT 1").get();
        if(!row)break;
        const check=eligible(db(),row.kind,row.id);
        if(!check.pack||check.pack.sourceHash!==row.source_hash){
          db().prepare("UPDATE publication_translation_jobs SET state='skipped',error=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=? AND language='en'").run(check.reason||'Kaynak bu sırada değişti',row.kind,row.id);
          notify();continue;
        }
        db().prepare("UPDATE publication_translation_jobs SET state='running',attempts=attempts+1,error='',updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=? AND language='en'").run(row.kind,row.id);
        controller=new AbortController();notify();
        try{
          await generate(db(),userDataPath(),{kind:row.kind,id:row.id,language:'en',signal:controller.signal});
          db().prepare("UPDATE publication_translation_jobs SET state='done',error='',updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=? AND language='en'").run(row.kind,row.id);
        }catch(error){
          const interrupted=paused || controller.signal.aborted;
          db().prepare("UPDATE publication_translation_jobs SET state=?,error=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=? AND language='en'")
            .run(interrupted?'queued':'failed',interrupted?'Durduruldu; yeniden başlatılabilir.':String(error?.message||error).slice(0,1200),row.kind,row.id);
        }finally{controller=null;notify();}
      }
    }finally{worker=null;notify();}
  }
  function start(){
    paused=false;
    if(!worker){worker=Promise.resolve().then(process);}
    return current();
  }
  function pause(){paused=true;controller?.abort();return current();}
  function queue(input){const result=enqueue(db(),input);if(result.queued)start();return {...result,running:!paused};}
  function retry(){
    db().prepare("UPDATE publication_translation_jobs SET state='queued',error='',updated_at=CURRENT_TIMESTAMP WHERE state='failed'").run();
    return start();
  }
  return {recover,current,start,pause,queue,retry,whenIdle:()=>worker??Promise.resolve()};
}
module.exports={ensureSchema,status,eligible,enqueue,createController};
