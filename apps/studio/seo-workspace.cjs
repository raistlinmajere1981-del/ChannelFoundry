"use strict";
const fs=require('node:fs'),path=require('node:path');
const aiClient=require('./ai-client.cjs'),{activeProject}=require('./channel-projects.cjs');
const {LANGUAGES,language,hash}=require('./publication-languages.cjs');
const limit=(v,n)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
const safeId=v=>String(v??'').replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,120);
const prefixes={section:'/evren/bolum/',video:'/kamera/video/',vefk:'/vefk/'};
function storePath(root){return path.join(root,'seo-workspaces',safeId(activeProject()?.id||'default')+'.json');}
function load(root){try{const v=JSON.parse(fs.readFileSync(storePath(root),'utf8'));if(v.schemaVersion===2)return v;}catch{}return {schemaVersion:2,site:{tr:{},en:{}},items:{}};}
function write(root,value){const file=storePath(root);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n',{mode:0o600});fs.renameSync(file+'.tmp',file);}
function prose(value){if(typeof value==='string')return value;if(!value||typeof value!=='object')return '';if(Array.isArray(value))return value.map(prose).join(' ');return ['text','label','title','description','summary','caption','notes'].map(k=>typeof value[k]==='string'?value[k]:'').concat(['blocks','spans','items'].map(k=>prose(value[k]))).filter(Boolean).join(' ');}
function defaults(snapshot){const rows=[];
 const add=(kind,id,locales)=>{for(const lang of LANGUAGES){const data=locales?.[lang];if(data?.status!=='approved')continue;const source=limit(kind==='section'?prose(data.blocks):kind==='video'?data.summary:[data.description,data.notes].filter(Boolean).join(' '),10000);if(!data.title||!source)continue;rows.push({kind,id:safeId(id),language:lang,title:limit(data.title,120),description:limit(source,180),source,sourceHash:hash(data),path:'/'+lang+prefixes[kind]+encodeURIComponent(safeId(id))});}};
 for(const section of snapshot.journal?.sections??[])add('section',section.sectionId,section.locales);
 for(const v of snapshot.youtubeAnalysis?.videos??[])if(!v.membersOnly&&v.publicationStatus==='published'&&v.analysisStatus==='complete')add('video',v.videoId,v.locales);
 for(const v of snapshot.vefkCatalog?.entries??[])add('vefk',v.id,snapshot.vefkLanguages?.[v.id]);
 return rows;
}
const key=r=>r.language+':'+r.kind+':'+r.id;
function overview(root,snapshot){const stored=load(root);const rows=defaults(snapshot).map(record=>{const saved=stored.items[key(record)]||{};return {...record,title:saved.title||record.title,description:saved.description||record.description,override:Boolean(saved.title||saved.description),needsReview:saved.approvedHash!==record.sourceHash||!saved.title||!saved.description,candidate:saved.candidate?.sourceHash===record.sourceHash?saved.candidate:null};});
 const sites=Object.fromEntries(LANGUAGES.map(lang=>[lang,{title:stored.site[lang]?.title||'BirDeSenGör',description:stored.site[lang]?.description||(lang==='tr'?'BirDeSenGör evreni, videolar, topluluk ve vefk arşivi.':'The BirDeSenGör universe, videos, community and vefk archive.'),image:stored.site[lang]?.image||''}]));
 return {site:sites.tr,sites,rows,draftCount:rows.filter(r=>r.needsReview).length};}
function update(root,input,snapshot){const lang=language(input.language),stored=load(root);
 if(input.kind==='site')stored.site[lang]={title:limit(input.title,120),description:limit(input.description,180),image:limit(input.image,250)};
 else {const record=defaults(snapshot).find(r=>r.kind===input.kind&&r.id===input.id&&r.language===lang);if(!record)throw new Error('SEO kaydı bu dilde onaylı yayına ait değil.');if(input.approved===true&&input.sourceHash!==record.sourceHash)throw new Error('SEO kaynağı değişti. Güncel içeriği inceleyip yeniden onayla.');const title=limit(input.title,120),description=limit(input.description,180);if(input.approved&&(!title||!description))throw new Error('SEO başlığı ve açıklaması gerekli.');stored.items[key(record)]={title,description,approvedHash:input.approved===true?record.sourceHash:null};}
 write(root,stored);return overview(root,snapshot);}
async function suggest(root,input,snapshot){const lang=language(input.language);
 const record=input.kind==='site'?{
   title:overview(root,snapshot).sites[lang].title,
   source:defaults(snapshot).filter(row=>row.language===lang).slice(0,24).map(row=>row.title+' '+row.source.slice(0,260)).join(' | ').slice(0,9000),
 }:defaults(snapshot).find(r=>r.kind===input.kind&&r.id===input.id&&r.language===lang);
 if(!record||!record.source)throw new Error('SEO önerisi yalnız bu dilde onaylı içerikten üretilebilir.');
 const response=await aiClient.chat(root,[{role:'system',content:`${lang==='en'?'İngilizce':'Türkçe'} SEO başlığı ve açıklaması öner. Yalnız onaylı kaynağı kullan; yeni iddia ekleme. Özel adları, Arapça harfleri ve sembolleri koru. Yalnız JSON: {"title":"...","description":"..."}. Başlık 65, açıklama 160 karakteri aşmasın. Yayın kararı insandadır.`},{role:'user',content:JSON.stringify({title:record.title,source:record.source})}],{json:true,maxTokens:400,temperature:0.15});const data=aiClient.parseAssistantJson(typeof response==='string'?response:response.content);return {title:limit(data.title,120),description:limit(data.description,180)};}
function saveCandidate(root,record,proposal){
 const stored=load(root),k=key(record),current=stored.items[k]||{};
 stored.items[k]={...current,candidate:{sourceHash:record.sourceHash,title:limit(proposal.title,120),description:limit(proposal.description,180),createdAt:new Date().toISOString()}};
 write(root,stored);return stored.items[k].candidate;
}
function manifest(root,snapshot,webUrl){const data=overview(root,snapshot);let baseUrl='';try{const url=new URL(webUrl);if(url.protocol==='https:')baseUrl=url.origin;}catch{}
 const pages=data.rows.filter(r=>!r.needsReview).map(({kind,id,language,path:route,title,description,source,sourceHash})=>({kind,id,language,path:route,title,description,body:source,sourceHash,approved:true,contentHash:hash({title,description,source,language})}));
 return {schemaVersion:2,publicationId:snapshot.publication.id,contentFingerprint:snapshot.publication.contentFingerprint,generatedAt:snapshot.publication.generatedAt,baseUrl,site:data.sites,pages};}
module.exports={overview,update,suggest,manifest,defaults,load,saveCandidate};
