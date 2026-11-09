"use strict";
// Editorial publication variants. Source documents and drawing geometry never live here.
const crypto = require('node:crypto');
const LANGUAGES = ['tr', 'en'];
const KINDS = ['video', 'section', 'vefk', 'entity', 'outline'];
const PROMPT_VERSION = 'publication-language-2';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const parse = value => { try { return JSON.parse(value); } catch { return null; } };
const textKeys = new Set(['title','summary','description','text','label','alt','caption','notes','numberLabel','role']);
function language(value) { if (!LANGUAGES.includes(value)) throw new Error('Yalnız Türkçe ve İngilizce destekleniyor.'); return value; }
function ensureSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS publication_language_sources (
    kind TEXT NOT NULL, id TEXT NOT NULL, source_hash TEXT NOT NULL, data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(kind,id)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS publication_language_variants (
    kind TEXT NOT NULL, id TEXT NOT NULL, language TEXT NOT NULL CHECK(language IN ('tr','en')),
    source_hash TEXT NOT NULL, data_json TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('draft','approved')),
    revision INTEGER NOT NULL DEFAULT 1, approved_revision INTEGER NOT NULL DEFAULT 0, manual INTEGER NOT NULL DEFAULT 0, model TEXT NOT NULL DEFAULT '',
    prompt_version TEXT NOT NULL DEFAULT '', candidate_json TEXT, error TEXT NOT NULL DEFAULT '',
    job_state TEXT NOT NULL DEFAULT '' CHECK(job_state IN ('','running','done','error')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(kind,id,language), FOREIGN KEY(kind,id) REFERENCES publication_language_sources(kind,id) ON DELETE CASCADE
  ) STRICT;`);
  if(!db.prepare('PRAGMA table_info(publication_language_variants)').all().some(c=>c.name==='approved_revision')){db.exec('ALTER TABLE publication_language_variants ADD COLUMN approved_revision INTEGER NOT NULL DEFAULT 0');db.exec("UPDATE publication_language_variants SET approved_revision=revision WHERE state='approved'");}
}
function resetInterrupted(db) {
  ensureSchema(db);
  return Number(db.prepare("UPDATE publication_language_variants SET job_state='error',error='Üretim yarıda kesildi. Yeniden oluşturabilir veya metni elle tamamlayabilirsin.' WHERE job_state='running'").run().changes);
}
function source(db, kind, id) { ensureSchema(db); return db.prepare('SELECT * FROM publication_language_sources WHERE kind=? AND id=?').get(kind,id); }
function putSource(db, kind, id, data) {
  ensureSchema(db);
  if (!KINDS.includes(kind) || !id) throw new Error('İçerik kimliği geçersiz.');
  const sourceHash = hash(data);
  db.prepare(`INSERT INTO publication_language_sources(kind,id,source_hash,data_json) VALUES(?,?,?,?)
    ON CONFLICT(kind,id) DO UPDATE SET source_hash=excluded.source_hash,data_json=excluded.data_json,updated_at=CURRENT_TIMESTAMP
    WHERE source_hash<>excluded.source_hash`).run(kind,id,sourceHash,JSON.stringify(data));
  return sourceHash;
}
function variants(db, kind, id) {
  const s = source(db,kind,id); if (!s) return null;
  const result = { kind,id,sourceHash:s.source_hash,source:parse(s.data_json),variants:{} };
  for (const row of db.prepare('SELECT * FROM publication_language_variants WHERE kind=? AND id=?').all(kind,id)) {
    result.variants[row.language] = { language:row.language, data:parse(row.data_json), state:row.state,
      stale:row.source_hash!==s.source_hash, sourceHash:row.source_hash, revision:row.revision,approvedRevision:row.approved_revision,
      manual:Boolean(row.manual), model:row.model, promptVersion:row.prompt_version,
      candidate:parse(row.candidate_json)?.data||null,candidateMeta:parse(row.candidate_json)?{model:parse(row.candidate_json).model,promptVersion:parse(row.candidate_json).promptVersion,sourceHash:parse(row.candidate_json).sourceHash}:null, jobState:row.job_state, error:row.error };
  }
  return result;
}
// Only prose leaves may change. IDs, references, symbols, timing and all shape data are immutable.
function validateData(original, next, key='') {
  if(key==='core') {if(hash(original)!==hash(next)) throw new Error('Temel çözümleme değiştirilemez.');return;}
  if (typeof original === 'string') {
    if (typeof next !== 'string' || next.length > Math.max(24000, original.length * 6)) throw new Error('Çeviri metni geçersiz.');
    if (textKeys.has(key)) {
      if (original.trim() && !next.trim()) throw new Error('Gerekli çeviri alanı eksik.');
      const protectedText = original.match(/[\u0600-\u06ff\u0750-\u077f]+/g) || [];
      if (protectedText.some(t => !next.includes(t))) throw new Error('Arapça harfler korunmalı.');
    } else if (original !== next) throw new Error('Özel ad, sembol veya kaynak kimliği değiştirilemez.');
    return;
  }
  if (original === null || typeof original !== 'object') {
    if (original !== next) throw new Error('Kaynak yapısı değiştirilemez.'); return;
  }
  if(original?.type==='reference'&&original.label!==next?.label)throw new Error('Kaynak özel adı korunmalı.');
  if (!next || typeof next !== 'object' || Array.isArray(original)!==Array.isArray(next) || JSON.stringify(Object.keys(original).sort())!==JSON.stringify(Object.keys(next).sort())) throw new Error('Çeviri kaynak yapısıyla eşleşmiyor.');
  for (const k of Object.keys(original)) validateData(original[k],next[k],Array.isArray(original)?key:k);
}
function save(db, input) {
  const lang=language(input.language), s=source(db,input.kind,input.id);
  if (!s) throw new Error('Önce kaynak içeriği kaydet veya onayla.');
  const existing=variants(db,input.kind,input.id).variants[lang];
  if (input.sourceHash!==s.source_hash || (input.revision ?? 0)!==(existing?.revision ?? 0)) throw new Error('İçerik değişti; editörü yenileyip yeniden incele.');
  validateData(parse(s.data_json),input.data);
  if(input.approved===true) {if(input.data.analysisStale)throw new Error('Önce temel çözümlemeyi güncelle.');required(input.kind,input.data);}
  db.prepare(`INSERT INTO publication_language_variants(kind,id,language,source_hash,data_json,state,manual,approved_revision)
    VALUES(?,?,?,?,?,?,1,?) ON CONFLICT(kind,id,language) DO UPDATE SET source_hash=excluded.source_hash,
    data_json=excluded.data_json,state=excluded.state,manual=1,approved_revision=CASE WHEN excluded.state='approved' THEN revision+1 ELSE 0 END,revision=revision+1,candidate_json=NULL,error='',job_state='',updated_at=CURRENT_TIMESTAMP`)
    .run(input.kind,input.id,lang,s.source_hash,JSON.stringify(input.data),input.approved===true?'approved':'draft',input.approved===true?1:0);
  return variants(db,input.kind,input.id);
}
// Send only mutable prose to the language model; source core, identity, geometry,
// evidence, references and other immutable fields remain entirely local.
function translatableFields(node,path=[],out=[]) {
  if(typeof node==='string') {
    if(textKeys.has(String(path.at(-1)))&&node.trim())out.push({path,text:node});
  } else if(Array.isArray(node)) node.forEach((v,i)=>translatableFields(v,[...path,i],out));
  else if(node&&typeof node==='object') for(const [key,value] of Object.entries(node)) {
    if(!['core','protectedNames'].includes(key))translatableFields(value,[...path,key],out);
  }
  return out;
}
function applyTranslatedFields(original,expected,output) {
  if(!Array.isArray(output?.fields)||output.fields.length!==expected.length)throw new Error('Çeviri alanları eksik veya fazla.');
  const allowed=new Map(expected.map(item=>[JSON.stringify(item.path),item]));
  const seen=new Set(),result=structuredClone(original);
  for(const field of output.fields) {
    const key=JSON.stringify(field.path),source=allowed.get(key);
    if(!source||seen.has(key)||typeof field.text!=='string')throw new Error('Çeviri alanı veya yolu geçersiz.');
    seen.add(key);
    let target=result;
    for(const segment of field.path.slice(0,-1))target=target[segment];
    target[field.path.at(-1)]=field.text;
  }
  validateData(original,result);
  return result;
}
function proseBatches(fields,maxChars=7500) {
  const batches=[];let batch=[],size=0;
  for(const field of fields) {
    const estimate=field.text.length+JSON.stringify(field.path).length+32;
    if(batch.length&&size+estimate>maxChars){batches.push(batch);batch=[];size=0;}
    batch.push(field);size+=estimate;
  }
  if(batch.length)batches.push(batch);
  return batches;
}
async function generate(db,userDataPath,input,client=require('./ai-client.cjs')) {
  const lang=language(input.language), s=source(db,input.kind,input.id);
  if (!s) throw new Error('Çeviri için kayıtlı kaynak gerekli.');
  if(parse(s.data_json)?.analysisStale)throw new Error('Kaynak altyazı değişti. Önce temel çözümlemeyi yenile.');
  const existing=variants(db,input.kind,input.id).variants[lang];
  // A provisional row records failures, including the first generation failure.
  db.prepare(`INSERT INTO publication_language_variants(kind,id,language,source_hash,data_json,state,job_state)
    VALUES(?,?,?,?,?,'draft','running') ON CONFLICT(kind,id,language) DO UPDATE SET job_state='running',error=''`)
    .run(input.kind,input.id,lang,s.source_hash,'{}');
  try {
    const original=parse(s.data_json);
    const fields=translatableFields(original);
    if(!fields.length)throw new Error('Bu kaynakta çevrilebilir metin alanı bulunamadı.');
    const translated=[];
    const models=[];
    const context={
      title:String(original.title||'').slice(0,200),
      coreConcepts:Array.isArray(original.core?.concepts)?original.core.concepts.slice(0,12):[],
      coreTopics:Array.isArray(original.core?.topics)?original.core.topics.slice(0,12):[],
      protectedNames:original.protectedNames||[],
    };
    for(const batch of proseBatches(fields)) {
      if(input.signal?.aborted)throw new Error('Dil üretimi iptal edildi.');
      const response=await client.chat(userDataPath,[{role:'system',content:
        `Yayın editörüsün. ${lang==='en'?'İngilizce':'Türkçe'} metin üret. Yalnız verilen metni çevir; yeni iddia ekleme. Özel adları, Arapça harfleri, sembolleri ve teknik gösterimleri koru. JSON alanlarının path dizilerini aynen döndür. Yalnız {"fields":[{"path":["title"],"text":"..."},...]} biçiminde yanıt ver; listedeki her alana tam bir çeviri yaz. Kaynak çözümlemeyi veya altyazıyı yeniden analiz etme.`},
        {role:'user',content:JSON.stringify({context,fields:batch})}],{json:true,returnMeta:true,maxTokens:14000,temperature:0.15,signal:input.signal});
      const parsed=client.parseAssistantJson(typeof response==='string'?response:response.content);
      // Reject missing, repeated or invented paths before applying the next batch.
      applyTranslatedFields(original,batch,parsed);
      translated.push(...parsed.fields);
      if(response?.model)models.push(response.model);
    }
    const data=applyTranslatedFields(original,fields,{fields:translated});
    const response={model:models.at(-1)||''};
    const prose=value=>typeof value==='string'?value:Array.isArray(value)?value.map(prose).join(' '):value&&typeof value==='object'?Object.entries(value).filter(([key])=>key!=='core'&&key!=='protectedNames').map(([,v])=>prose(v)).join(' '):'';
    const before=prose(original),after=prose(data);
    for(const name of original.protectedNames||[])if(before.includes(name)&&!after.includes(name))throw new Error('AI önerisinde özel ad değişmiş; insan incelemesi gerekli.');
    const current=variants(db,input.kind,input.id).variants[lang];
    if (source(db,input.kind,input.id).source_hash!==s.source_hash) throw new Error('Üretim sırasında kaynak değişti. Yeniden üret.');
    // Always stage regeneration; manual edits and approved variants are never overwritten.
    const stage=Boolean(existing?.manual || existing?.state==='approved' || (current?.revision??0)!==(existing?.revision??1));
    db.prepare(`UPDATE publication_language_variants SET data_json=?,candidate_json=?,source_hash=?,state=?,
      model=?,prompt_version=?,job_state='done',error='',revision=revision+1,updated_at=CURRENT_TIMESTAMP
      WHERE kind=? AND id=? AND language=?`).run(stage?JSON.stringify(current.data):JSON.stringify(data),stage?JSON.stringify({data,model:response.model||'',promptVersion:PROMPT_VERSION,sourceHash:s.source_hash}):null,
      stage?current.sourceHash:s.source_hash,stage?current.state:'draft',stage?current.model:(response.model||''),stage?current.promptVersion:PROMPT_VERSION,input.kind,input.id,lang);
    return variants(db,input.kind,input.id);
  } catch(error) {
    db.prepare(`UPDATE publication_language_variants SET job_state='error',error=? WHERE kind=? AND id=? AND language=?`).run(String(error.message).slice(0,2000),input.kind,input.id,lang);
    throw error;
  }
}
function required(kind,data) {
  const fields=kind==='video'?['title','summary','description']:kind==='vefk'?['title','description']:kind==='entity'?['name']:['title'];
  if(fields.some(key=>typeof data[key]!=='string'||!data[key].trim()) || kind==='section'&&!data.blocks?.length)throw new Error('Gerekli yayın metinleri eksik.');
}
function published(db,kind,id) {
  const pack=variants(db,kind,id), result={};
  for (const lang of LANGUAGES) {
    const v=pack?.variants[lang];
    if (!v || v.state!=='approved' || v.stale) continue;
    try { validateData(pack.source,v.data);required(kind,v.data); if(v.data.analysisStale)continue; const {core,analysisStale,...prose}=v.data; result[lang]={...prose,status:'approved',sourceHash:v.sourceHash,revision:v.approvedRevision}; } catch {}
  }
  return result;
}
function videoSources(db) {
  ensureSchema(db);
  const exists=name=>db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if(!['source_ai_analyses','youtube_videos','source_transcripts'].every(exists))return [];
  return db.prepare(`SELECT a.*, y.thumbnail_url,y.published_at,y.duration_seconds,y.availability,st.text AS transcript,st.language AS transcript_language
    FROM source_ai_analyses a JOIN youtube_videos y ON y.video_id=a.external_id
    JOIN source_transcripts st ON st.provider=a.provider AND st.external_id=a.external_id`).all().map(r=>({
      videoId:r.external_id,title:r.title,summary:r.summary,core:parse(r.core_json)||{},
      sourceVersion:hash({core:parse(r.core_json)||{},transcript:r.transcript,language:r.transcript_language}),
      analysisStale: r.source_hash!==hash({videoId:r.external_id,language:r.transcript_language,transcript:r.transcript}),
      thumbnailUrl:r.thumbnail_url,publishedAt:r.published_at,durationSeconds:r.duration_seconds,
      analysisStatus:'complete',publicationStatus:'published',membersOnly:['subscriber_only','premium_only','needs_auth'].includes(r.availability),
    }));
}
function records(snapshot) {
  const result=[];
  for (const v of snapshot.youtubeAnalysis?.videos??[]) result.push({kind:'video',id:v.videoId,data:{title:v.title,summary:v.summary,description:v.description||v.summary||'',core:v.core||{},protectedNames:['BirDeSenGör',...['characters','locations','objects'].flatMap(k=>(v.core?.[k]||[]).map(e=>e.name)).filter(Boolean)],analysisStale:!!v.analysisStale},dependency:v.sourceVersion||''});
  for (const s of snapshot.journal?.sections??[]) result.push({kind:'section',id:s.sectionId,data:{title:s.title,blocks:s.blocks,media:s.media||[],sourceVideoIds:s.sourceVideoIds||[]},dependency:s.revision});
  for (const e of snapshot.archive?.entities??[]) result.push({kind:'entity',id:e.entityId,data:{name:e.name,summary:e.summary,details:e.details||[],sourceVideoIds:e.sourceVideoIds||[]}});
  for (const v of snapshot.vefkCatalog?.entries??[]) result.push({kind:'vefk',id:v.id,data:{title:v.document.title,description:v.document.description||'',notes:v.document.provenance?.notes||'',references:v.document.provenance?.references||[]},dependency:v.contentHash});
  for (const s of snapshot.journal?.outline?.series??[]) {
    result.push({kind:'outline',id:s.key,data:{title:s.title,description:s.description||''}});
    for(const c of s.chapters??[]) result.push({kind:'outline',id:c.key,data:{title:c.title,numberLabel:c.numberLabel||''}});
  }
  return result;
}
function sync(db,snapshot) {
  ensureSchema(db);
  const videos=new Map(videoSources(db).map(v=>[v.videoId,v.sourceVersion]));
  for(const r of records(snapshot)) {const dependency=r.data.sourceVideoIds?.length?hash({revision:r.dependency||'',videos:r.data.sourceVideoIds.map(id=>[id,videos.get(id)||''])}):r.dependency;putSource(db,r.kind,r.id,{...r.data,...(dependency?{sourceVersion:dependency}:{})});}
}
function overview(db,snapshot) {
  sync(db,snapshot);
  const rows=records(snapshot).map(r=>variants(db,r.kind,r.id));
  const counts={ready:0,missing:0,pending:0,stale:0,errors:0};
  for(const row of rows) {
    const vs=Object.values(row.variants);
    const hasValidText=(lang)=>{const v=row.variants[lang];if(!v)return false;try{validateData(row.source,v.data);required(row.kind,v.data);return true;}catch{return false;}};
    // The dashboard counters and the list filters use exactly the same per-content flags.
    const flags={
      ready:LANGUAGES.every(l=>row.variants[l]?.state==='approved'&&!row.variants[l].stale&&hasValidText(l)),
      missing:!hasValidText('en'),
      pending:vs.some(v=>{if(v.candidate&&v.candidateMeta?.sourceHash===row.sourceHash)return true;if(v.state!=='draft'||v.stale)return false;try{validateData(row.source,v.data);required(row.kind,v.data);return true;}catch{return false;}}),
      stale:vs.some(v=>v.stale),
      errors:vs.some(v=>v.jobState==='error'),
    };
    row.flags=flags;
    for(const key of Object.keys(counts)) if(flags[key]) counts[key]++;
  }
  return {rows,counts};
}
function apply(db,snapshot) {
  sync(db,snapshot);
  snapshot.languageVersion=1; snapshot.languages=LANGUAGES;
  const attach=(r,kind,id)=>{r.locales=published(db,kind,id);};
  for(const v of snapshot.youtubeAnalysis.videos) {attach(v,'video',v.videoId);delete v.title;delete v.summary;delete v.description;delete v.core;}
  snapshot.youtubeAnalysis.videos=snapshot.youtubeAnalysis.videos.filter(v=>Object.keys(v.locales).length);
  for(const s of snapshot.journal.sections) {attach(s,'section',s.sectionId);delete s.title;delete s.blocks;delete s.media;}
  for(const e of snapshot.archive.entities) {attach(e,'entity',e.entityId);delete e.summary;delete e.details;}
  for(const s of snapshot.journal.outline?.series??[]) {attach(s,'outline',s.key);delete s.title;delete s.description;
    for(const c of s.chapters??[]) {attach(c,'outline',c.key);delete c.title;delete c.numberLabel;}}
  // Text variants are a sidecar: the signed canonical drawing/catalog stays byte-identical.
  snapshot.vefkLanguages=Object.fromEntries((snapshot.vefkCatalog?.entries??[]).map(e=>[e.id,published(db,'vefk',e.id)]));
  return snapshot;
}
module.exports={resetInterrupted,videoSources,LANGUAGES,PROMPT_VERSION,hash,ensureSchema,language,putSource,source,variants,save,generate,published,records,sync,overview,apply,validateData};
