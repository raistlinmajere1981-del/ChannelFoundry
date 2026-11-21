"use strict";
const {parentPort,workerData}=require("node:worker_threads");
const {DatabaseSync}=require("node:sqlite");
const project=require("./channel-projects.cjs");
const pub=require("./publication-v2.cjs");
async function remoteMetadata(url){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{Accept:"application/json"}});
    if(!response.ok)throw Error("Canlı yayın HTTP "+response.status);
    if(!response.body)throw Error("Canlı yayın üst bilgisi okunamadı.");
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let preview="";
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      preview+=decoder.decode(value,{stream:true});
      const match=preview.match(/"publication"\s*:\s*\{\s*"id"\s*:\s*"(pub-[a-f0-9]{24})"\s*,\s*"generatedAt"\s*:\s*"[^"]*"\s*,\s*"contentFingerprint"\s*:\s*"([a-f0-9]{64})"/);
      if(match){
        controller.abort(); // Full archive remains on the server; only metadata is needed.
        if(match[1]!=="pub-"+match[2].slice(0,24))throw Error("Canlı parmak izi tutarsız.");
        return {id:match[1],contentFingerprint:match[2]};
      }
      if(preview.length>131072)throw Error("Canlı yayın üst bilgisi ilk 128 KB içinde bulunamadı.");
    }
    throw Error("Canlı yayın kimliği okunamadı.");
  }finally{clearTimeout(timeout);controller.abort()}
}
(async()=>{
 const live=await remoteMetadata(workerData.publicationUrl);
 const db=new DatabaseSync(workerData.databaseFile,{timeout:20000});
 try{
   if(workerData.projectId)project.bindDatabaseProject(db,workerData.projectId);
   const snapshot=pub.buildPublicationV2(db).snapshot;
   return {
     state:live.contentFingerprint===snapshot.publication.contentFingerprint?"current":"changed",
     livePublicationId:live.id,
     localPublicationId:snapshot.publication.id
   };
 }finally{db.close()}
})().then(result=>parentPort.postMessage(result)).catch(error=>parentPort.postMessage({
 state:"error",error:String(error?.message||error).slice(0,250)
}));
