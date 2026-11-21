"use strict";
const path=require("node:path");
const {Worker}=require("node:worker_threads");
const {activeProject}=require("./channel-projects.cjs");
let cached=null,inFlight=null;
const dataVersion=db=>Number(db.prepare("PRAGMA data_version").get()?.data_version||0);
function signature(db,root){
 const project=activeProject();
 return [root,project?.id||"",project?.webUrl||"",db.prepare("SELECT total_changes() AS n").get()?.n||0,dataVersion(db)].join("|");
}
function check(db,root){
 const key=signature(db,root);
 if(cached?.key===key&&Date.now()-cached.checkedAt<120000)return Promise.resolve(cached.value);
 if(inFlight?.key===key)return inFlight.promise;
 const project=activeProject();
 if(!project?.webUrl)return Promise.resolve({state:"error",error:"Canlı site adresi tanımlı değil."});
 const publicationUrl=new URL("/content/publication.json",project.webUrl).toString();
 const worker=new Worker(path.join(__dirname,"dashboard-publication-worker.cjs"),{
   workerData:{databaseFile:path.join(root,"channel-foundry-studio.sqlite"),
     publicationUrl,projectId:project.id}
 });
 const promise=new Promise(resolve=>{
   let complete=false;
   const finish=value=>{
     if(complete)return;complete=true;
     clearTimeout(timer);
     worker.terminate().catch(()=>{});
     resolve(value);
   };
   const timer=setTimeout(()=>finish({state:"error",error:"Canlı yayın kontrolü zaman aşımına uğradı."}),50000);
   worker.once("message",finish);
   worker.once("error",error=>finish({state:"error",error:String(error?.message||error)}));
   worker.once("exit",code=>{if(code!==0)finish({state:"error",error:"Yayın kontrolü tamamlanamadı."})});
 }).then(value=>{
   // Worker-side publication preparation may synchronize source metadata.
   // Use the fresh SQLite marker so subsequent visits reuse the exact result.
   cached={key:signature(db,root),value,checkedAt:Date.now()};
   if(inFlight?.promise===promise)inFlight=null;
   return value;
 });
 inFlight={key,promise};
 return promise;
}
module.exports={check,clear:()=>{cached=null;inFlight=null}};
