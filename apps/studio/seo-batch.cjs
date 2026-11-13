'use strict';
const fs=require('node:fs'),path=require('node:path');
const seo=require('./seo-workspace.cjs');
const {activeProject}=require('./channel-projects.cjs');
const key=row=>`${row.language}:${row.kind}:${row.id}`;
function file(root,projectId=activeProject()?.id){return path.join(root,'seo-workspaces',`${String(projectId||'default').replace(/[^a-zA-Z0-9_.-]/g,'')}.queue.json`);}
function load(root,projectId){try{const value=JSON.parse(fs.readFileSync(file(root,projectId),'utf8'));return Array.isArray(value.jobs)?value.jobs:[];}catch{return [];}}
function store(root,rows,projectId){const dest=file(root,projectId);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest+'.tmp',JSON.stringify({version:1,jobs:rows},null,2)+'\n',{mode:0o600});fs.renameSync(dest+'.tmp',dest);}
const counts=rows=>rows.reduce((result,row)=>(result[row.state]++,result),{queued:0,running:0,done:0,failed:0,skipped:0});
function controller({root,snapshot,suggest=seo.suggest,onProgress=()=>{}}){
 let stopped=true,worker=null;
 const projectId=activeProject()?.id||'default';
 const dir=()=>root(),list=()=>load(dir(),projectId);
 const current=()=>{const rows=list();return {rows,counts:counts(rows),running:!stopped&&Boolean(worker),paused:stopped};};
 const notify=()=>{try{onProgress();}catch{}};
 function update(row,patch){const rows=list();const i=rows.findIndex(r=>key(r)===key(row));if(i===-1)return;rows[i]={...rows[i],...patch,updatedAt:new Date().toISOString()};store(dir(),rows,projectId);notify();}
 function recover(){const rows=list().map(r=>r.state==='running'?{...r,state:'queued',error:'Önceki işlem kesildi; devam ettirilebilir.'}:r);store(dir(),rows,projectId);return current();}
 function enqueue(input){
  if((activeProject()?.id||'default')!==projectId)throw Error('Proje değişti. Yeni proje için kuyruğu yeniden aç.');
  const sources=seo.defaults(snapshot());const targets=input?.items;
  if(!Array.isArray(targets)||!targets.length||targets.length>600)throw Error('SEO için 1–600 kayıt seçilmeli.');
  const index=new Map(sources.map(row=>[key(row),row]));
  const rows=list();let queued=0,skipped=0;
  for(const value of targets){const identity=key(value),source=index.get(identity);
   if(!source){skipped++;continue;}
   const current=seo.overview(dir(),snapshot()).rows.find(row=>key(row)===identity);
   if(current&&!current.needsReview){skipped++;continue;}
   const old=rows.findIndex(item=>key(item)===identity);
   const next={kind:source.kind,id:source.id,language:source.language,sourceHash:source.sourceHash,state:'queued',attempts:0,error:'',updatedAt:new Date().toISOString()};
   if(old>=0&&rows[old].state==='running'){skipped++;continue;}
   if(old>=0)rows[old]=next;else rows.push(next);
   queued++;
  }
  store(dir(),rows,projectId);if(queued)start();return {...current(),queued,skipped};
 }
 async function run(){
  try{while(!stopped){
    const job=list().find(row=>row.state==='queued');if(!job)break;
    const source=seo.defaults(snapshot()).find(row=>key(row)===key(job));
    if(!source||source.sourceHash!==job.sourceHash){update(job,{state:'skipped',error:'SEO kaynağı değişti; yeniden sıraya alınmalı.'});continue;}
    update(job,{state:'running',attempts:job.attempts+1,error:''});
    try{
      const proposal=await suggest(dir(),job,snapshot());
      const latest=seo.defaults(snapshot()).find(row=>key(row)===key(job));
      if(!latest||latest.sourceHash!==job.sourceHash){update(job,{state:'skipped',error:'Üretim sırasında kaynak değişti.'});continue;}
      if((activeProject()?.id||'default')!==projectId){stopped=true;break;}
      seo.saveCandidate(dir(),latest,proposal);
      update(job,{state:'done',error:''});
    }catch(error){update(job,{state:'failed',error:String(error?.message||error).slice(0,900)});}
   }
  }finally{worker=null;notify();}
 }
 function start(){if((activeProject()?.id||'default')!==projectId)throw Error('Proje değişti.');stopped=false;if(!worker)worker=Promise.resolve().then(run);return current();}
 function pause(){stopped=true;return current();}
 function retry(){const rows=list().map(row=>row.state==='failed'?{...row,state:'queued',error:''}:row);store(dir(),rows,projectId);return start();}
 return {current,recover,enqueue,start,pause,retry,whenIdle:()=>worker??Promise.resolve()};
}
module.exports={controller,load,counts};
