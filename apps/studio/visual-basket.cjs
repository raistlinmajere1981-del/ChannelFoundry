'use strict';
// Isolated opt-in image basket. Candidate images do not replace published files until accepted.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const profiles = require('./visual-profiles.cjs');
const presets = require('./visual-presets.cjs');
const refs = require('./visual-references.cjs');
const ai = require('./ai-service.cjs');
const {optimizeImage} = require('./visual-image-optimizer.cjs');
const META_KEY = 'visual-basket-settings-v1';
let running = false, stopping = false;

function ensure(db) {
  db.exec("CREATE TABLE IF NOT EXISTS visual_basket_jobs (entity_key TEXT PRIMARY KEY,entity_type TEXT NOT NULL,title TEXT NOT NULL,prompt TEXT NOT NULL,negative_prompt TEXT NOT NULL DEFAULT '',preset_id TEXT NOT NULL,image_size TEXT NOT NULL DEFAULT '1024x1024',use_reference INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT 'pending',candidate_file TEXT NOT NULL DEFAULT '',error_text TEXT NOT NULL DEFAULT '',generation_provider TEXT NOT NULL DEFAULT '',generation_model TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;");
  const columns=db.prepare("PRAGMA table_info(visual_basket_jobs)").all();
  if(!columns.some(col=>col.name==="generation_provider"))db.exec("ALTER TABLE visual_basket_jobs ADD COLUMN generation_provider TEXT NOT NULL DEFAULT ''");
  if(!columns.some(col=>col.name==="generation_model"))db.exec("ALTER TABLE visual_basket_jobs ADD COLUMN generation_model TEXT NOT NULL DEFAULT ''");
}
function settings(db) {
  let v={};
  try {v=JSON.parse(db.prepare('SELECT value FROM studio_meta WHERE key=?').get(META_KEY)?.value || '{}');} catch {}
  return { imagesPerRequest:[1,2,4].includes(Number(v.imagesPerRequest)) ? Number(v.imagesPerRequest) : 1 };
}
function setSettings(db,input) {
  const n=Number(input?.imagesPerRequest);
  if (![1,2,4].includes(n)) throw new Error('Bir üretimde 1, 2 veya 4 görsel seçilmeli.');
  db.prepare('INSERT INTO studio_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(META_KEY,JSON.stringify({imagesPerRequest:n}));
  return settings(db);
}
function list(db) {
  ensure(db);
  return db.prepare("SELECT entity_key AS entityKey,entity_type AS entityType,title,prompt,negative_prompt AS negativePrompt,preset_id AS presetId,image_size AS size,use_reference AS useReference,state,candidate_file AS candidateFile,error_text AS error,generation_provider AS generationProvider,generation_model AS generationModel,created_at AS createdAt FROM visual_basket_jobs ORDER BY created_at,entity_key").all()
    .map(row=>({...row,useReference:Boolean(row.useReference),hasCandidate:Boolean(row.candidateFile)}));
}
function status(db) {return {settings:settings(db),items:list(db),running,pauseRequested:stopping};}
function add(db,input,root='') {
  ensure(db);
  if (running) throw new Error('Üretim sürerken sepete kayıt eklenemez.');
  const key=String(input?.entityKey||'').trim(),prompt=String(input?.prompt||'').trim().slice(0,12000);
  if (!key || key.length>700 || !prompt) throw new Error('Kayıt ve görsel üretim tarifi gerekli.');
  const existing=db.prepare('SELECT state, candidate_file AS file FROM visual_basket_jobs WHERE entity_key=?').get(key);
  if (existing?.state==='working') throw new Error('Bu görsel halen üretiliyor.');
  if (!existing && db.prepare('SELECT count(*) AS n FROM visual_basket_jobs').get().n>=300) throw new Error('Sepet en fazla 300 kayıt alabilir.');
  const title=String(input?.title||key).slice(0,300);
  const type=String(input?.entityType||'entity').slice(0,80);
  const preset=presets.resolve(db,input?.presetId).id;
  const size=['1024x1024','1536x1024','1024x1536'].includes(input?.size)?input.size:'1024x1024';
  const neg=String(input?.negativePrompt||'').slice(0,6000);
  db.prepare("INSERT INTO visual_basket_jobs(entity_key,entity_type,title,prompt,negative_prompt,preset_id,image_size,use_reference,state) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(entity_key) DO UPDATE SET entity_type=excluded.entity_type,title=excluded.title,prompt=excluded.prompt,negative_prompt=excluded.negative_prompt,preset_id=excluded.preset_id,image_size=excluded.image_size,use_reference=excluded.use_reference,state=excluded.state,candidate_file='',error_text='',updated_at=CURRENT_TIMESTAMP")
    .run(key,type,title,prompt,neg,preset,size,input?.useReference===false?0:1,input?.externalOnly===true?'external':'pending');
  // A renewed basket entry invalidates its previous candidate without touching the book image.
  if (existing?.file && root) {
    const old=fileFor(root,existing.file);
    if(old)try{fs.unlinkSync(old);}catch{}
  }
  return status(db);
}
function candidateDir(root) {const dir=path.join(root,'visual-candidates');fs.mkdirSync(dir,{recursive:true});return dir;}
function fileFor(root,name) {return /^[a-f0-9]{24}\.webp$/.test(String(name||''))?path.join(candidateDir(root),name):'';}
function remove(db,root,key) {
  if (running) throw new Error('Önce üretimi duraklat.');
  const row=db.prepare('SELECT candidate_file AS file FROM visual_basket_jobs WHERE entity_key=?').get(key);
  db.prepare('DELETE FROM visual_basket_jobs WHERE entity_key=?').run(key);
  const file=fileFor(root,row?.file);if(file)try{fs.unlinkSync(file);}catch{}
  return status(db);
}
function retry(db,key) {
  if (running) throw new Error('Önce üretimi duraklat.');
  db.prepare("UPDATE visual_basket_jobs SET state='pending',error_text='',updated_at=CURRENT_TIMESTAMP WHERE entity_key=? AND state='error'").run(key);
  return status(db);
}
// Import an externally generated image as a reviewable basket candidate.
// The original input, existing candidate and published book image remain intact on failure.
async function importCandidate(db,root,key,sourceFile) {
  ensure(db);
  if (running) throw new Error('Üretim sürerken dış görsel alınamaz.');
  const item=db.prepare("SELECT state,candidate_file AS file FROM visual_basket_jobs WHERE entity_key=?").get(String(key||'').trim());
  if (!item) throw new Error('Görsel sepetinde bu kayıt bulunamadı.');
  if (item.state==='working') throw new Error('Bu kayıt halen üretiliyor.');
  const source=String(sourceFile||'').trim();
  if (!source) throw new Error('Görsel dosyası seçilmedi.');
  const target=path.join(candidateDir(root),crypto.randomBytes(12).toString('hex')+'.webp');
  try {
    await optimizeImage(source,target);
    db.prepare("UPDATE visual_basket_jobs SET state='ready',candidate_file=?,generation_provider='external-import',generation_model='',error_text='',updated_at=CURRENT_TIMESTAMP WHERE entity_key=?")
      .run(path.basename(target),String(key).trim());
    const old=fileFor(root,item.file);
    if(old && old!==target)try{fs.unlinkSync(old);}catch{}
  } catch(e) {try{fs.unlinkSync(target);}catch{}throw e;}
  return status(db);
}
function candidate(db,root,key) {
  const row=db.prepare("SELECT candidate_file AS file FROM visual_basket_jobs WHERE entity_key=? AND state='ready'").get(key);
  const file=fileFor(root,row?.file);
  if(!file||!fs.existsSync(file))throw new Error('Aday görsel bulunamadı.');
  const data=fs.readFileSync(file);if(data.length>12*1024*1024)throw new Error('Aday görsel çok büyük.');
  return {entityKey:key,imageDataUrl:'data:image/webp;base64,'+data.toString('base64')};
}
async function accept(db,root,key) {
  if(running)throw new Error('Üretim sürerken aday kabul edilmez.');
  const row=db.prepare("SELECT * FROM visual_basket_jobs WHERE entity_key=? AND state='ready'").get(key);
  const file=fileFor(root,row?.candidate_file);
  if(!row||!file||!fs.existsSync(file))throw new Error('Onaylanacak aday görsel bulunamadı.');
  const target=profiles.targetFile(root,key,'.webp');
  try {
    await optimizeImage(file,target);
    profiles.attachStoredFile(db,key,{entityType:row.entity_type,file:target,source:row.generation_provider==='external-import'?'manual':'generated',provider:row.generation_provider||'basket',model:row.generation_model||'unspecified'});
    db.prepare('DELETE FROM visual_basket_jobs WHERE entity_key=?').run(key);
    try{fs.unlinkSync(file);}catch{}
  } catch(e) {try{fs.unlinkSync(target);}catch{}throw e;}
  return status(db);
}
function layout(n) {
  if(n===1)return {cols:1,rows:1};
  if(n===2)return {cols:2,rows:1};
  if(n===4)return {cols:2,rows:2};
  throw new Error('Bir levhada 1, 2 veya 4 görsel olmalı.');
}
function nextGroup(db) {
  const pending=db.prepare("SELECT * FROM visual_basket_jobs WHERE state='pending' ORDER BY created_at,entity_key").all();
  if(!pending.length)return [];
  const first=pending[0],same=pending.filter(row=>row.preset_id===first.preset_id&&row.image_size===first.image_size);
  const limit=settings(db).imagesPerRequest;
  const count=limit===4&&same.length===3?2:Math.min(limit,same.length);
  return same.slice(0,count);
}
function promptFor(db,rows) {
  const preset=presets.resolve(db,rows[0].preset_id);
  const shape=layout(rows.length);
  const positions=rows.length===1?['tek görsel']:rows.length===2?['SOL','SAĞ']:['SOL ÜST','SAĞ ÜST','SOL ALT','SAĞ ALT'];
  const items=rows.map((r,i)=>String(i+1)+'. '+positions[i]+' — '+r.title+'\n'+r.prompt+
    (r.negative_prompt?'\nBu karede kaçınılacak: '+r.negative_prompt:'')+
    '\nReferans levhasındaki aynı konumun kaynak görüntüsü yalnız bu kareye aittir.').join('\n\n');
  const intro=rows.length===1?'Tek bir kaynak temelli resim üret.':
    'TEK ÇIKTI içerisinde '+shape.cols+' sütun x '+shape.rows+' satırdan oluşan eşit boyutlu kareler üret. '+
    'Her hücre tamamen BAĞIMSIZ, tek başına eksiksiz ve merkezli bir görsel. Konumları KESİNLİKLE karıştırma. '+
    'Hücreler arasında çizim devam etmesin, ayraç çizgisi, çerçeve, metin ve boşluk olmasın.';
  return {prompt:[intro,'Karakalem standardı:\n'+preset.instruction,'Hedefler:\n'+items,
    'Kaynakta verilmemiş yüz, kişi, nesne, kıyafet ve simge ekleme. Yazı veya filigran oluşturma.'].join('\n\n'),
    negative:[preset.negative,...rows.map(r=>r.negative_prompt)].filter(Boolean).join('; ').slice(0,6000)};
}
async function referenceBoard(db,root,rows) {
  const files=rows.map(row=>row.use_reference?refs.get(db,root,row.entity_key,false)?.imagePath||'':'');
  if(!files.some(Boolean))return '';
  const shape=layout(rows.length),tile=600,layers=[];
  for(let i=0;i<files.length;i++) {
    if(!files[i])continue;
    const buf=await sharp(files[i]).resize(tile,tile,{fit:'contain',background:'#f8f4eb'}).png().toBuffer();
    layers.push({input:buf,left:i%shape.cols*tile,top:Math.floor(i/shape.cols)*tile});
  }
  const file=path.join(candidateDir(root),crypto.randomBytes(12).toString('hex')+'.png');
  await sharp({create:{width:shape.cols*tile,height:shape.rows*tile,channels:3,background:'#f8f4eb'}})
    .composite(layers).png().toFile(file);
  return file;
}
async function processGroup(db,root,rows,generate=ai.generateImage) {
  const shape=layout(rows.length),files=[];
  let generated,board='';
  try {
    board=await referenceBoard(db,root,rows);
    const prompt=promptFor(db,rows);
    generated=await generate(root,{entityKey:'basket-sheet',prompt:prompt.prompt,negativePrompt:prompt.negative,
      referenceImagePath:board,size:rows.length===1?rows[0].image_size:'1536x1024'});
    const meta=await sharp(generated.file).metadata();
    if(!meta.width||!meta.height||meta.width<shape.cols*128||meta.height<shape.rows*128)throw new Error('Levha çözünürlüğü yetersiz.');
    for(let i=0;i<rows.length;i++) {
      const col=i%shape.cols,row=Math.floor(i/shape.cols);
      const left=Math.floor(col*meta.width/shape.cols),top=Math.floor(row*meta.height/shape.rows);
      const right=Math.floor((col+1)*meta.width/shape.cols),bottom=Math.floor((row+1)*meta.height/shape.rows);
      const target=path.join(candidateDir(root),crypto.randomBytes(12).toString('hex')+'.webp');
      await sharp(generated.file).extract({left,top,width:right-left,height:bottom-top}).webp({quality:88,effort:4}).toFile(target);
      files.push({key:rows[i].entity_key,name:path.basename(target),path:target});
    }
    const stmt=db.prepare("UPDATE visual_basket_jobs SET state='ready',candidate_file=?,generation_provider=?,generation_model=?,error_text='',updated_at=CURRENT_TIMESTAMP WHERE entity_key=?");
    db.exec('BEGIN IMMEDIATE');
    try{for(const file of files)stmt.run(file.name,generated.provider||'',generated.model||generated.controllerModel||'',file.key);db.exec('COMMIT');}
    catch(e){db.exec('ROLLBACK');throw e;}
    return files.length;
  } catch(e){for(const f of files)try{fs.unlinkSync(f.path);}catch{}throw e;}
  finally{
    if(generated?.file)try{fs.unlinkSync(generated.file);}catch{}
    if(board)try{fs.unlinkSync(board);}catch{}
  }
}
async function work(db,root,generate) {
  running=true;stopping=false;
  try{
    for(;;){
      if(stopping)break;
      const rows=nextGroup(db);if(!rows.length)break;
      const mark=db.prepare("UPDATE visual_basket_jobs SET state='working',updated_at=CURRENT_TIMESTAMP WHERE entity_key=?");
      for(const row of rows)mark.run(row.entity_key);
      try{await processGroup(db,root,rows,generate);}
      catch(e){
        const fail=db.prepare("UPDATE visual_basket_jobs SET state='error',error_text=?,updated_at=CURRENT_TIMESTAMP WHERE entity_key=?");
        for(const row of rows)fail.run(String(e?.message||e).slice(0,1200),row.entity_key);
      }
    }
  } finally{running=false;stopping=false;}
  return status(db);
}
function start(db,root,generate) {
  ensure(db);if(!running)void work(db,root,generate).catch(e=>{running=false;stopping=false;console.error('[visual basket]',e);});
  return status(db);
}
function pause(){stopping=true;return {running,pauseRequested:stopping};}
function recover(db){
  ensure(db);
  if(!running)db.prepare("UPDATE visual_basket_jobs SET state='error',error_text='Önceki oturum kapandı; yeniden dene.',updated_at=CURRENT_TIMESTAMP WHERE state='working'").run();
}
module.exports={ensure,settings,setSettings,list,status,add,remove,retry,importCandidate,candidate,accept,
  layout,nextGroup,promptFor,referenceBoard,processGroup,start,pause,recover};
