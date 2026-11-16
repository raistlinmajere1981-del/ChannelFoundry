"use strict";
const path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const service=require("./invitation-draft-service.cjs");
const root=path.resolve(__dirname,"../..");
const dbPath=path.join(root,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const start=Number(process.argv[2]||11),end=Number(process.argv[3]||20);
const concurrency=Math.max(1,Math.min(3,Number(process.argv[4]||2)));
const pending=Array.from({length:end-start+1},(_,i)=>start+i);
const results=[];
const started=Date.now();
function worker(id){
 const db=new DatabaseSync(dbPath);
 db.exec("PRAGMA busy_timeout=10000");
 return (async()=>{
  try{
   while(pending.length){
    const n=pending.shift();
    try{
      const row=service.listing(db).find(item=>item.number===n);
      if(row.state==="imported"||row.state==="generated"||row.state==="edited"||row.state==="reviewed"){
        console.log("SKIP",n,row.state);results.push({n,status:"skip"});continue;
      }
      if(row.state==="missing"){
        console.log("GAP",n,"no direct recording");results.push({n,status:"missing"});continue;
      }
      if(row.state==="stale")throw new Error("Old draft stale; preserve for human-safe review.");
      const out=await service.generate(db,path.dirname(dbPath),n);
      results.push({n,status:"generated",title:out.draft.title,chars:out.draft.body.length,
        notes:out.draft.reviewNotes.length,model:out.draft.model});
      console.log("GENERATED",JSON.stringify(results.at(-1)));
    }catch(err){
      const message=String(err.stack||err.message);
      results.push({n,status:"error",error:message.slice(0,1400)});
      console.error("ERROR",n,message.slice(0,1400));
    }
   }
  }finally{db.close();}
 })();
}
Promise.all(Array.from({length:concurrency},(_,i)=>worker(i+1))).then(()=>{
 const errors=results.filter(x=>x.status==="error");
 console.log("BATCH_RESULT",JSON.stringify({start,end,total:results.length,generated:results.filter(x=>x.status==="generated").length,
  skipped:results.filter(x=>x.status==="skip").length,missing:results.filter(x=>x.status==="missing").map(x=>x.n),
  errors:errors.map(x=>({n:x.n,error:x.error})),elapsedSeconds:Math.round((Date.now()-started)/1000)}));
 if(errors.length)process.exitCode=1;
}).catch(err=>{console.error(err);process.exitCode=1;});
