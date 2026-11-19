"use strict";
// Resumable, source-pinned TR->EN candidate generator. Never alters the Studio DB.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {DatabaseSync}=require("node:sqlite");
const lang=require("./publication-languages.cjs");
const opencode=require("./ai-opencode.cjs");
const {parseAssistantJson}=require("./ai-client.cjs");
const ROOT=path.resolve(__dirname,"../..");
const DB=path.join(ROOT,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const WORK=path.join(ROOT,"channels/birdesengor/.local-data/studio/translation-work-20261119");
const GLOBAL_QUOTA_PAUSE=path.join(WORK,'quota-paused.json');
const MODEL="opencode/deepseek-v4.1-flash-free", REASONING="max";
const GLOSSARY=[
  "Ömer","Poyraz","Tuji","Nezrin","Meseyn","Arohan","Kral Arohan",
  "Bledum","Mezna","Babil","Ruşun","İbn Karuf","İbni Necemin","Divitli Defter","Düğümlü Kitap","Derin Kuyu","Şira",
  "Eron Ginas","Karon","Gufna","Solomon","Yaşlı Duman","BirDeSenGör",
  "Kapsız Kitap","Karanlık Devrin Kitabı","Roses","Muhsin Abi","Eyşan"
];
// Accepted *place-name* localization, never a character identity change.
const TERM_ALIASES={Babil:['Babylon'], 'İbn Karuf':['İbni Kâruf'], 'İbn Necem':['İbni Necemin']};
const TEXT_KEYS=new Set(["title","summary","description","text","label","alt","caption","notes","numberLabel","role"]);
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const option=(name,def)=>{const n=Number(arg(name)??def);if(!Number.isSafeInteger(n)||n<0)throw Error("Invalid "+name);return n;};
const command=process.argv[2]||"status",batch=arg("--batch")||(command==="plan"?"pilot":"pilot");
if(!/^[a-z][a-z0-9-]{0,40}$/.test(batch))throw Error("Invalid batch name");
const DIR=path.join(WORK,batch);
const json=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const fileKey=(kind,id)=>kind+"-"+crypto.createHash("sha256").update(id).digest("hex").slice(0,20);
function atomic(file,value) {
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+"."+process.pid+".tmp";const fd=fs.openSync(tmp,"w",0o600);
 try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+"\n");fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(tmp,file);
}
function readDb(fn){const db=new DatabaseSync(DB,{readOnly:true});try{return fn(db)}finally{db.close()}}
function getPack(db,item){
 const s=db.prepare("SELECT source_hash,data_json FROM publication_language_sources WHERE kind=? AND id=?").get(item.kind,item.id);
 const tr=db.prepare("SELECT source_hash,data_json,state,approved_revision FROM publication_language_variants WHERE kind=? AND id=? AND language='tr'").get(item.kind,item.id);
 if(!s||!tr||tr.state!=="approved"||s.source_hash!==tr.source_hash)throw Error("TR unavailable or source stale");
 const trHash=lang.hash({sourceHash:tr.source_hash,revision:tr.approved_revision,data:JSON.parse(tr.data_json)});
 if(item.sourceHash!==s.source_hash||item.trHash!==trHash)throw Error("TR source or approved revision changed");
 const en=db.prepare("SELECT source_hash,state,tr_dependency FROM publication_language_variants WHERE kind=? AND id=? AND language='en'").get(item.kind,item.id);
 return {source:JSON.parse(s.data_json),tr:JSON.parse(tr.data_json),validEn:en?.state==="approved"&&en.source_hash===s.source_hash&&(!en.tr_dependency||en.tr_dependency===trHash)};
}
function findReusable(item,source){
 if(!fs.existsSync(WORK))return null;
 const name=fileKey(item.kind,item.id)+".json";
 for(const entry of fs.readdirSync(WORK)){
  if(entry===batch||!fs.statSync(path.join(WORK,entry)).isDirectory())continue;
  const file=path.join(WORK,entry,"results",name);
  if(!fs.existsSync(file))continue;
  const row=json(file);
  if(row.schema!==1||row.kind!==item.kind||row.id!==item.id||row.sourceHash!==item.sourceHash||row.trHash!==item.trHash||row.model!==MODEL||row.reasoning!==REASONING)continue;
  try{lang.validateVariant(item.kind,source,row.data);return row;}catch{}
 }
 return null;
}
function eligible(){
 return readDb(db=>{
 const rows=db.prepare("SELECT s.kind,s.id,s.source_hash,tr.data_json,tr.approved_revision,en.state AS es,en.source_hash AS eh,en.tr_dependency AS ed FROM publication_language_sources s JOIN publication_language_variants tr ON tr.kind=s.kind AND tr.id=s.id AND tr.language='tr' AND tr.state='approved' AND tr.source_hash=s.source_hash LEFT JOIN publication_language_variants en ON en.kind=s.kind AND en.id=s.id AND en.language='en' ORDER BY s.kind,s.id").all();
 return rows.filter(r=>{
 const h=lang.hash({sourceHash:r.source_hash,revision:r.approved_revision,data:JSON.parse(r.data_json)});
 return !(r.es==="approved"&&r.eh===r.source_hash&&(!r.ed||r.ed===h));
 }).map(r=>({kind:r.kind,id:r.id,sourceHash:r.source_hash,trHash:lang.hash({sourceHash:r.source_hash,revision:r.approved_revision,data:JSON.parse(r.data_json)})}));
 });
}
function plan(){
 if(fs.existsSync(path.join(DIR,"manifest.json")))throw Error("Manifest already exists; original immutable plan preserved");
 const available=eligible();
 let items;
 if(batch==="pilot"){
  const sections=available.filter(x=>x.kind==="section");
  const lengths=readDb(db=>sections.map(item=>({item,n:db.prepare("SELECT length(data_json) n FROM publication_language_variants WHERE kind=? AND id=? AND language='tr'").get(item.kind,item.id).n})).sort((a,b)=>a.n-b.n));
  const sample=[0.15,0.5,0.8].map(q=>lengths[Math.floor(q*(lengths.length-1))]?.item).filter(Boolean);
  const entities=available.filter(x=>x.kind==="entity");
  const grouped=readDb(db=>{
   const ret={};for(const item of entities){
    const s=db.prepare("SELECT json_extract(data_json, '$.kind') k FROM publication_language_sources WHERE kind=? AND id=?").get(item.kind,item.id);
    (ret[s.k]??=[]).push(item);
   }return ret;
  });
  items=[...sample,...Object.keys(grouped).sort().flatMap(k=>grouped[k].slice(0,4))];
 }else if(batch==="book")items=available.filter(x=>x.kind==="section");
 else if(batch==="universe")items=available.filter(x=>x.kind==="entity");
 else items=available;
 fs.mkdirSync(DIR,{recursive:true});
 atomic(path.join(DIR,"manifest.json"),{schema:1,createdAt:new Date().toISOString(),batch,model:MODEL,reasoning:REASONING,items});
 console.log("PLAN",JSON.stringify({batch,items:items.length,types:Object.fromEntries([...new Set(items.map(x=>x.kind))].map(k=>[k,items.filter(x=>x.kind===k).length])),path:DIR}));
}
function fieldsFrom(data,kind){
 const fields=[];
 function walk(v,p=[]){if(typeof v==="string"){
  if(TEXT_KEYS.has(String(p.at(-1)))&&v.trim())fields.push({path:p,text:v});
 }else if(Array.isArray(v))v.forEach((c,i)=>walk(c,[...p,i]));
 else if(v&&typeof v==="object")for(const [k,c] of Object.entries(v)){
  if(k!=="core"&&k!=="protectedNames")walk(c,[...p,k]);
 }}
 walk(data);
 if(kind==="entity"&&data.name?.trim())fields.unshift({path:["displayName"],text:data.name});
 return fields;
}
function fieldChunks(fields,maxChars=2500){
 const batches=[];let chunk=[],len=0;
 for(const f of fields){const cost=f.text.length+JSON.stringify(f.path).length+60;
  if(chunk.length&&len+cost>maxChars){batches.push(chunk);chunk=[];len=0;}
  chunk.push(f);len+=cost;
 }
 if(chunk.length)batches.push(chunk);return batches;
}
function applyFields(original,expected,output){
 if(!Array.isArray(output?.fields)||output.fields.length!==expected.length)throw Error("JSON path count mismatch");
 const allowed=new Map(expected.map(x=>[JSON.stringify(x.path),x]));
 const seen=new Set(),changed=structuredClone(original);
 for(const f of output.fields){
  const key=JSON.stringify(f.path),o=allowed.get(key);
  if(!o||seen.has(key)||typeof f.text!=="string"||!f.text.trim())throw Error("Missing or unknown translated field");
  if(/^(?:please translate|as an ai|here is the|not enough context)/i.test(f.text))throw Error("Model meta response instead of translation");
  seen.add(key);let dst=changed;
  for(const part of f.path.slice(0,-1))dst=dst[part];
  dst[f.path.at(-1)]=f.text;
 }
 return changed;
}
function qa(source,translated,fields){
 const flags=[];
 const srcTexts=fields.map(x=>x.text).join(" "),targetTexts=fields.map(f=>{
  let v=translated;for(const p of f.path)v=v[p];return v;
 }).join(" ");
 for(const name of GLOSSARY){
  if(!srcTexts.includes(name))continue;
  const acceptable=[name,...(TERM_ALIASES[name]||[])];
  if(!acceptable.some(value=>targetTexts.includes(value)))flags.push("GLOSSARY:"+name);
 }
 for(const field of fields){
  let translatedField=translated;
  for(const part of field.path)translatedField=translatedField?.[part];
  const sourceField=String(field.text||""),english=String(translatedField||"");
  // Check each field; a name shifted over a fixed inline reference is acceptable
  // ONLY within the same paragraph and directly across that one reference.
  function movedAcrossInlineReference(name){
   const p=field.path, k=p.length;
   if(k<3||p[k-1]!=="text"||p[k-3]!=="spans"||!Number.isInteger(p[k-2]))return false;
   let sourceSpans=source,targetSpans=translated;
   for(const part of p.slice(0,-2)){sourceSpans=sourceSpans?.[part];targetSpans=targetSpans?.[part];}
   if(!Array.isArray(sourceSpans)||!Array.isArray(targetSpans))return false;
   const ix=p[k-2],aliases=[name,...(TERM_ALIASES[name]||[])];
   return [-1,1].some(dir=>{
    const ref=ix+dir,other=ix+dir*2;
    return sourceSpans[ref]?.type==="reference"&&targetSpans[ref]?.type==="reference"
      &&sourceSpans[ref].entityId===targetSpans[ref].entityId
      &&sourceSpans[other]?.type==="text"&&targetSpans[other]?.type==="text"
      &&!String(sourceSpans[other].text||"").includes(name)
      &&aliases.some(alias=>String(targetSpans[other].text||"").includes(alias));
   });
  }
  for(const name of ["Ömer","Kral Arohan","Yaşlı Duman","Nezrin","Meseyn","İbn Karuf","İbn Necem","Poyraz","Tuji","Düğümlü Kitap","Kapsız Kitap","Karanlık Devrin Kitabı","Roses","Muhsin Abi","Eyşan","Derin Kuyu","Şira"])
   if(sourceField.includes(name)&&![name,...(TERM_ALIASES[name]||[])].some(alias=>english.includes(alias))&&!movedAcrossInlineReference(name))
    flags.push("NAME_MISSING:"+name+":"+JSON.stringify(field.path));
  if(sourceField.trim().length>40&&sourceField.trim()===english.trim())
   flags.push("UNTRANSLATED:"+JSON.stringify(field.path));
  if(/telsiz/i.test(sourceField)&&/\bradio\b/i.test(english)
    &&!/walkie-talkie|transceiver|two-way radio|handheld radio/i.test(english))
   flags.push("TRANSCEIVER_MAY_BE_RADIO:"+JSON.stringify(field.path));
 }
 // Compare numeral values rather than thousands separators (4800 = 4,800).
 const numerals=value=>(value.match(/\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,:]\d+)*/g)||[])
  .map(s=>s.replace(/[.,](?=\d{3}(?:[.,]|$))/g,'').replace(/,(?=\d{1,2}$)/g,'.'));
 // Turkish clock notation "saat 9.35" corresponds to English "9:35".
 // Only normalize a dot as a clock separator when the Turkish "saat" marker is present.
 // Source dates such as "03.12 ile 03.59" or "03.12–03.59" may
 // represent a clock *range*, even without an immediate "saat" prefix.
 // Restrict this exception to zero-padded hours with valid minute values
 // AND nearby temporal context. Ordinary decimal quantities still differ.
 const dottedTimeRange=/\b([01]\d|2[0-3])\.([0-5]\d)(\s*(?:ile|[-–])\s*)([01]\d|2[0-3])\.([0-5]\d)\b/gi;
 const rangeNormalized=srcTexts.replace(dottedTimeRange,(match,h1,m1,separator,h2,m2,index,text)=>{
  const vicinity=text.slice(Math.max(0,index-85),Math.min(text.length,index+match.length+85));
  if(!/\b(?:saat|gece|gecenin|zaman|aralık|arasında|arasındaki|aralığı|aralığını|aralığında|uyku|dakika|cuma|cumartesi)\b/i.test(vicinity))return match;
  return h1+":"+m1+separator+h2+":"+m2;
 });
 // Turkish "21.30'da" is a clock time (at 21:30), not a decimal.
 // Suffix and valid hour/minute range are both required; ordinary metric
 // decimals such as "9.35 metre" must still fail mismatched-number QA.
 const atTimeNormalized=rangeNormalized.replace(/\b([01]?\d|2[0-3])\.([0-5]\d)(?=['’](?:da|de|ta|te)\b)/gi,(_all,h,m)=>h+":"+m);
 const timedSource=atTimeNormalized.replace(/\bsaat\s+(\d{1,2})\.(\d{2})(?=\D|$)/gi,(_all,h,m)=>"saat "+h+":"+m);
 // A historical ordinal name written as "5. Murat" is naturally rendered "Murat V".
 // Validate the target ordinal before excluding its Arabic numeral from the generic comparison.
 const muratV=/\b5\.\s*Murat\b/.test(timedSource);
 if(muratV&&!/\bMurat\s+(?:V|5(?:th)?|the Fifth)\b/.test(targetTexts))
  flags.push("NUMBER_NAME_MISMATCH:5_Murat");
 const numericSource=muratV?timedSource.replace(/\b5\.\s*Murat\b/g,"Murat V"):timedSource;
 const originalNums=numerals(numericSource),translatedNums=numerals(targetTexts);
 if(JSON.stringify(originalNums.sort())!==JSON.stringify(translatedNums.sort()))flags.push("NUMBERS_CHANGED");
 const ratio=targetTexts.length/Math.max(srcTexts.length,1);
 if(ratio<0.42||ratio>2.1)flags.push("LENGTH_RATIO:"+ratio.toFixed(2));
 // Do not mistake frequent identity-bearing Turkish proper nouns for untranslated prose.
 // Keep the generic TR script detector active for all remaining words.
 const recognizedProperNameWords=/(?:Eşref|Şami|Çaylık|Çığlık|Ebaruşta|Hurşimi|İbni|Düğümlü|Yaşlı|Şira|Eyşan|Maşrif|Şartem|Şednaz|Hednuriş|Ednuriş|Nuriş|eşhedü)/g;
 const trChars=(targetTexts.replace(recognizedProperNameWords,"").match(/[ÇçĞğİıŞş]/g)||[]).length;
 if(trChars>Math.max(10,srcTexts.length/180))flags.push("POSSIBLE_TURKISH");
 // Inline references are fixed-position spans. A following unconnected pronoun
 // can silently break grammar (e.g. "Poyraz I told him...").
 function scan(value){
  if(!value||typeof value!=="object")return;
  if(Array.isArray(value)){value.forEach(scan);return;}
  if(Array.isArray(value.spans)){
   for(let i=0;i<value.spans.length-1;i++){
    const left=value.spans[i],right=value.spans[i+1];
    if(left?.type==="reference"&&right?.type==="text"&&/^(?:I told (?:him|her|them)|I explained to (?:him|her|them))\b/i.test(String(right.text||"").trim()))
     flags.push("REFERENCE_GRAMMAR:"+String(left.label||"").slice(0,50));
   }
  }
  for(const [key,child] of Object.entries(value))if(key!=="core")scan(child);
 }
 scan(translated);
 return {sourceChars:srcTexts.length,targetChars:targetTexts.length,lengthRatio:+ratio.toFixed(2),flags};
}
function credential(){
 // The running user's OpenCode server password comes from the shell environment.
 // Never inline or persist it in a command, file, log, or candidate result.
 const key=process.env.OPENCODE_PASSWORD||process.env.OPENCODE_SERVER_PASSWORD||process.env.BDS_TRANSLATION_OPENCODE_PASSWORD;
 if(!key)throw Error('OpenCode ortam değişkeninde parola bulunamadı (OPENCODE_PASSWORD).');
 return key;
}
function isQuota(message){return /(?:rate.?limit|429|quota|capacity|usage.?limit|credit.?exhaust|too many requests|free.?limit|model kotası|credits? remaining|limit reached|daily limit|insufficient quota|429 Too Many)/i.test(message);}
function acquireLock(){
 fs.mkdirSync(DIR,{recursive:true});const file=path.join(DIR,".worker.lock");
 if(fs.existsSync(file)){
  const old=json(file);try{process.kill(old.pid,0);throw Error("Worker already running with PID "+old.pid);}catch(e){if(e.code!=="ESRCH")throw e;}
  if(!process.argv.includes("--recover-lock"))throw Error("Stale lock; retry with --recover-lock after checking the old worker is stopped");
  fs.unlinkSync(file);
 }
 const fd=fs.openSync(file,"wx",0o600);fs.writeFileSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()}));fs.closeSync(fd);
 return ()=>{try{fs.unlinkSync(file)}catch{}};
}
async function run(){
 const manifest=json(path.join(DIR,"manifest.json"));
 if(manifest.model!==MODEL||manifest.reasoning!==REASONING)throw Error("Model config mismatch");
 const pauseFile=path.join(DIR,"paused-quota.json");
 const resume=process.argv.includes("--resume");
 if((fs.existsSync(GLOBAL_QUOTA_PAUSE)||fs.existsSync(pauseFile))&&!resume)
  throw Error("DeepSeek kotası dolmuş; limit yenilendikten sonra --resume kullanılmalı.");
 const key=credential();
 // Authentication checked before locking or consuming any queue item.
 await opencode.testServer({endpoint:'http://127.0.0.1:4096',apiKey:key});
 const release=acquireLock(),maxRecords=option("--max-records",manifest.items.length),maxRequests=option("--max-requests",99999),maxFailures=option("--max-failures",3),maxChunks=option("--max-chunks",99999),kindOnly=arg('--kind');
 if(resume){
  fs.rmSync(GLOBAL_QUOTA_PAUSE,{force:true});
  fs.rmSync(pauseFile,{force:true});
 }
 let done=0,requests=0,failed=0,quota=false,skippedExisting=0,deferredLarge=0,deferredErrors=0,staleSkipped=0;
 const items=[...manifest.items];
 if(process.argv.includes('--short-first')){
  const sizes=readDb(db=>{const st=db.prepare("SELECT length(data_json) AS n FROM publication_language_variants WHERE kind=? AND id=? AND language='tr'");return items.map(x=>st.get(x.kind,x.id)?.n||0)});
  const indexed=items.map((item,index)=>({item,n:sizes[index],index}));
  indexed.sort((a,b)=>a.n-b.n||a.index-b.index);
  items.splice(0,items.length,...indexed.map(x=>x.item));
 }
 try{
  for(const item of items){
   if(fs.existsSync(GLOBAL_QUOTA_PAUSE)){console.log('GLOBAL_QUOTA_PAUSE');quota=true;break;}
   if(failed>=maxFailures){console.error('FAILURE_BREAKER',failed,'errors in this run; stopping without losing saved work');break;}
   if(kindOnly&&item.kind!==kindOnly)continue;
   if(done>=maxRecords||requests>=maxRequests)break;
   const base=fileKey(item.kind,item.id),resultFile=path.join(DIR,"results",base+".json");
   if(fs.existsSync(resultFile)){skippedExisting++;continue;}
   // A previous blank response must not consume the next session's whole quota.
   if(process.argv.includes('--defer-errors')&&fs.existsSync(path.join(DIR,'errors',base+'.json'))){deferredErrors++;continue;}
   let pack;
   try{pack=readDb(db=>getPack(db,item));if(pack.validEn){console.log("SKIP_APPROVED",item.kind,item.id);skippedExisting++;continue;}}
   catch(e){console.error("SOURCE_STALE",item.kind,item.id,e.message);staleSkipped++;continue;}
   const reusable=findReusable(item,pack.source);
   if(reusable){atomic(resultFile,{...reusable,reusedFromAnotherBatch:true});console.log("REUSED_CANDIDATE",item.kind,item.id);done++;continue;}
   const fields=fieldsFrom(pack.tr,item.kind),chunks=fieldChunks(fields),proposed=structuredClone(pack.tr);
   if(chunks.length>maxChunks){deferredLarge++;continue;}
   let blocked=false;
   for(let n=0;n<chunks.length;n++){
    const c=chunks[n],cache=path.join(DIR,"chunks",base+"-"+String(n).padStart(3,"0")+".json"),digest=lang.hash({sourceHash:item.sourceHash,trHash:item.trHash,fields:c});
    let response;
    if(fs.existsSync(cache)){const row=json(cache);if(row.digest!==digest)throw Error("Chunk hash mismatch "+cache);response=row.output;}
    else{
     if(fs.existsSync(GLOBAL_QUOTA_PAUSE)){quota=true;blocked=true;break;}
     if(requests>=maxRequests){blocked=true;break;}
     const context={kind:item.kind,entryTitle:pack.tr.title||pack.tr.name||"",entityKind:pack.tr.kind||"",terms:GLOSSARY};
     const prompt="Translate Turkish publication prose to natural English. Faithfully preserve narrator first person, attribution, uncertainty, chronology, and reported versus completed events. No inventing or simplifying. Preserve personal names and coined terms including Nezrin, Meseyn, Arohan, Kral Arohan, İbn Karuf, İbni Necemin, Bledum, Mezna, Divitli Defter, Düğümlü Kitap, Derin Kuyu, Şira, BirDeSenGör and Yaşlı Duman (a personal nickname, NOT Old Smoke or Old Duman). The historical place Babil can be rendered Babylon. The canonical entity name is immutable: displayName is reader-facing localized title only. For purely personal proper names, displayName should be identical to the original; for descriptive titles, translate the descriptive words while preserving proper names. Translate all reference labels, keeping their grammar continuous with adjacent spans. Reference span positions are fixed: for a reference named Poyraz followed by Turkish possessive/case text, write a fluent continuation such as ' was the person I told...', never ungrammatical 'Poyraz I told him...'. Treat telsiz as walkie-talkie/transceiver and radyo as radio; do not conflate them. Emanet is an entrusted item or object, not automatically a relic. Preserve the exact spelling of İbni Necemin and derivative Necemin; do not shorten or replace this person with Ibn Necem or Necem. Preserve exact reported statements and narrator perspective. Distinguish Turkish adayı meaning the island in island contexts from aday meaning a candidate. Preserve plural subjects, Turkish ordinals, attribution, and whether an event was observed, planned, reported, or actually completed. In sacrifice/compensation contexts diyet is not a food diet: retain the word diyet and gloss as a non-monetary forfeit when necessary. Translate ritual davet according to the context rather than a generic social gathering. Tas is a bowl or basin used in an invitation, whereas taş is stone; do not confuse them. Anmak/andığı can mean mention rather than invoke or summon. Ritual tarif means instructions or directions rather than a food recipe. Preserve whose actions are attributed to whom: for example, en küçük yardımcı is the youngest/smallest assistant who speaks, not a descriptor of a chain. Where Turkish leaves an actor ambiguous, do not invent a definite actor. Keep Arabic symbols, numbers, identifiers, references unchanged. Each provided path must appear exactly once, with complete nonempty text. Return JSON object with one fields array; each item contains exact path and its translated text.";
     try{
      requests++;console.log("REQUEST",item.kind,item.id,"chunk",n+1+"/"+chunks.length,"total",requests);
      const answer=await opencode.complete({model:MODEL,reasoningMode:"variant",reasoningEffort:REASONING,endpoint:"http://127.0.0.1:4096",apiKey:key,timeoutSeconds:420},[{role:"system",content:prompt},{role:"user",content:JSON.stringify({context,fields:c})}],{timeoutMs:420000});
      try{response=parseAssistantJson(answer.content);}catch(parseError){
       atomic(path.join(DIR,'responses',base+'-'+String(n).padStart(3,'0')+'.json'),{kind:item.kind,id:item.id,reason:String(parseError.message),content:String(answer.content).slice(0,50000)});
       throw parseError;
      }
      applyFields(pack.tr,c,response);
      atomic(cache,{kind:item.kind,id:item.id,digest,model:answer.model,output:response});
     }catch(e){const msg=String(e?.message||e);
      if(isQuota(msg)){const pause={at:new Date().toISOString(),batch,kind:item.kind,id:item.id,chunk:n,reason:msg.slice(0,500)};atomic(pauseFile,pause);atomic(GLOBAL_QUOTA_PAUSE,pause);console.error("QUOTA_PAUSE",item.kind,item.id,"chunk",n+1,msg.slice(0,200));quota=true;}
      else{atomic(path.join(DIR,"errors",base+".json"),{at:new Date().toISOString(),kind:item.kind,id:item.id,chunk:n,reason:msg.slice(0,800)});console.error("FAILED",item.kind,item.id,"chunk",n+1,msg.slice(0,200));failed++;}
      blocked=true;break;
     }
    }
    const next=applyFields(proposed,c,response);Object.assign(proposed,next);
   }
   if(quota)break;
   if(blocked)continue;
   try{
    lang.validateVariant(item.kind,pack.source,proposed);
    const checks=qa(pack.tr,proposed,fields);
    atomic(resultFile,{schema:1,kind:item.kind,id:item.id,sourceHash:item.sourceHash,trHash:item.trHash,model:MODEL,reasoning:REASONING,translatedAt:new Date().toISOString(),checks,data:proposed});
    fs.rmSync(path.join(DIR,'errors',base+'.json'),{force:true});
    console.log("CANDIDATE",item.kind,item.id,"chunks",chunks.length,"flags",checks.flags.join(",")||"none");
    done++;
   }catch(e){console.error("VALIDATION_FAIL",item.kind,item.id,e.message);atomic(path.join(DIR,"errors",base+".json"),{at:new Date().toISOString(),reason:e.message});failed++;}
  }
 }finally{release();}
 console.log("RUN_SUMMARY",JSON.stringify({batch,completedDuringRun:done,skippedExisting,staleSkipped,deferredLarge,deferredErrors,requests,failed,quotaPaused:quota,limits:{maxRecords,maxRequests,maxFailures,maxChunks}}));
}
function audit(){
 const resultDir=path.join(DIR,"results");
 if(!fs.existsSync(resultDir))return console.log("AUDIT",JSON.stringify({batch,total:0}));
 let clean=0,flagged=0,invalid=0,stale=0;
 for(const filename of fs.readdirSync(resultDir).filter(x=>x.endsWith(".json"))){
  const file=path.join(resultDir,filename),row=json(file);
  try{
   const pack=readDb(db=>getPack(db,row));
   lang.validateVariant(row.kind,pack.source,row.data);
   const checks=qa(pack.tr,row.data,fieldsFrom(pack.tr,row.kind));
   atomic(file,{...row,checks});
   if(checks.flags.length)flagged++;else clean++;
  }catch(e){if(/changed|stale/i.test(e.message))stale++;else invalid++;console.error("AUDIT_ERROR",row.kind,row.id,e.message);}
 }
 console.log("AUDIT",JSON.stringify({batch,clean,flagged,invalid,stale}));
}
function status(){
 const manifest=json(path.join(DIR,"manifest.json"));
 const names=dir=>fs.existsSync(path.join(DIR,dir))?fs.readdirSync(path.join(DIR,dir)).filter(x=>x.endsWith(".json")):[];
 const results=names("results"),flagged=results.filter(name=>json(path.join(DIR,"results",name)).checks?.flags?.length).length;
 const remaining=manifest.items.filter(item=>!fs.existsSync(path.join(DIR,"results",fileKey(item.kind,item.id)+".json"))).length;
 const unresolvedErrors=names("errors").filter(name=>!fs.existsSync(path.join(DIR,"results",name))).length;
 console.log("STATUS",JSON.stringify({batch,manifest:manifest.items.length,results:results.length,flagged,remaining,savedChunks:names("chunks").length,errors:unresolvedErrors,paused:fs.existsSync(path.join(DIR,"paused-quota.json")),globalQuotaPaused:fs.existsSync(GLOBAL_QUOTA_PAUSE),locked:fs.existsSync(path.join(DIR,".worker.lock")),directory:DIR}));
}
if(require.main===module){Promise.resolve().then(()=>{if(command==="plan")return plan();if(command==="run")return run();if(command==="status")return status();if(command==="audit")return audit();throw Error("Usage: plan|run|status|audit --batch pilot|book|universe|all");}).catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});}
module.exports={fieldsFrom,fieldChunks,applyFields,qa,isQuota,fileKey};
