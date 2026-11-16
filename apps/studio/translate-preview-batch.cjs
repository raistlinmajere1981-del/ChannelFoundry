"use strict";
/*
 * Bounded English publication translation + validation + editorial approval.
 * No publication, SEO, assets, scene, or source revisions are touched.
 * Usage: node translate-preview-batch.cjs --offset 0 --count 10 --workers 2
 */
const {DatabaseSync}=require("node:sqlite");
const path=require("node:path");
const {buildPublicationV2}=require("./publication-v2.cjs");
const languages=require("./publication-languages.cjs");
const aiCli=require("./ai-cli.cjs");
const aiConfig=require("./ai-config.cjs");
const aiClient=require("./ai-client.cjs");
const openCode=require("./ai-opencode.cjs");
let opencodeEndpointPromise=null;
const alternateClient=async(messages,options)=>{
  opencodeEndpointPromise ??= openCode.sharedService();
  const endpoint=await opencodeEndpointPromise;
  const file=path.join(process.env.HOME||"","/.config/opencode/service.json");
  const privateConfig=JSON.parse(fs.readFileSync(file,"utf8"));
  if(!privateConfig.password)throw Error("OpenCode private service credentials unavailable");
  return openCode.complete({
    model:process.env.BDS_OPENCODE_MODEL||"opencode/deepseek-v4.1-flash-free",
    endpoint,apiKey:privateConfig.password,timeoutSeconds:420
  },messages,options);
};
const translationClient={
  chat:(root,messages,options)=>{
    if(process.env.BDS_TRANSLATOR_BACKEND==="opencode")return alternateClient(messages,options);
    const config=aiConfig.readConfig(root);
    if(config.provider==="codex-cli"){
      return aiCli.requestTextCompletion({...config,reasoningEffort:"high"},messages,options);
    }
    return aiClient.chat(root,messages,options);
  },
  parseAssistantJson:aiClient.parseAssistantJson,
};
const fs=require("node:fs");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const dbPath=path.join(root,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const userData=path.dirname(dbPath);
const num=flag=>{const at=process.argv.indexOf(flag);return at<0?undefined:Number(process.argv[at+1]);};
const offset=num("--offset")??0,count=num("--count")??10,workers=Math.min(3,Math.max(1,num("--workers")??2));
const entityMode=process.argv.includes("--entities");
if(!Number.isInteger(offset)||offset<0||!Number.isInteger(count)||count<1||count>15)throw Error("Only small 1–15 item translation batches are allowed.");
const dbInit=new DatabaseSync(dbPath);
dbInit.exec("PRAGMA busy_timeout=10000");
try {
 const snapshot=buildPublicationV2(dbInit,{sourceOnly:true}).snapshot;
 languages.sync(dbInit,snapshot);
}finally{dbInit.close()}
function qualifiedItems(){
 const db=new DatabaseSync(dbPath,{readOnly:true});
 try{
  const items=[];
  if(entityMode){
    const refs=db.prepare("SELECT json_extract(j.value,'$.entityId') AS id,COUNT(*) AS mentions " +
      "FROM narrative_sections s JOIN narrative_section_revisions r ON r.id=s.current_revision_id " +
      "JOIN json_each(r.entity_references_json) j WHERE s.state='active' " +
      "GROUP BY 1 ORDER BY mentions DESC,1").all();
    for(const ref of refs){
      const row=db.prepare("SELECT json_extract(data_json,'$.name') AS title FROM publication_language_sources " +
        "WHERE kind='entity' AND id=?").get(ref.id);
      if(row)items.push({kind:'entity',id:ref.id,title:row.title,mentions:ref.mentions});
    }
  }else{
    const ss=db.prepare("SELECT s.key,COALESCE(sc.position,999999) AS p,r.title FROM narrative_sections s JOIN narrative_section_revisions r ON r.id=s.current_revision_id LEFT JOIN narrative_section_chapters sc ON sc.section_key=s.key WHERE s.state='active' ORDER BY p,s.key").all();
    for (const x of ss)items.push({kind:"section",id:x.key,title:x.title});
    const outline=db.prepare("SELECT kind,id,json_extract(data_json,'$.title') title FROM publication_language_sources WHERE kind='outline' ORDER BY id").all();
    for(const x of outline)items.push({kind:"outline",id:x.id,title:x.title});
    items.push(...db.prepare("SELECT kind,id,json_extract(data_json,'$.title') title FROM publication_language_sources WHERE kind='vefk'").all());
  }
  return items.filter(x=>{
    const p=languages.variants(db,x.kind,x.id);
    return p?.variants.tr?.state==="approved"&&!p.variants.tr.stale&&
      !(p.variants.en?.state==="approved"&&!p.variants.en.stale);
  });
 }finally{db.close()}
}
const all=qualifiedItems(),selected=all.slice(offset,offset+count);
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const reviewPath=path.join(userData,"translation-review");
fs.mkdirSync(reviewPath,{recursive:true});
const pending=[...selected],results=[],begin=Date.now();
const systemEnglish=/\b(the|and|was|were|with|that|from|asked|said|then|this|had|could|would|about|because|when|there|into|after|before)\b/gi;
function prose(x){
 if(typeof x==="string")return x;
 if(!x||typeof x!=="object")return "";
 if(Array.isArray(x))return x.map(prose).join(" ");
 return Object.entries(x).filter(([k])=>!["core","protectedNames","sourceVersion","sourceVideoIds","entityId","sourceHash"].includes(k)).map(([,v])=>prose(v)).join(" ");
}
function verify(original,translated,item){
 languages.validateVariant(item.kind,original,translated);
 const before=prose(original),after=prose(translated);
 const ratio=after.length/Math.max(1,before.length);
 if(item.kind==="section" && (ratio<0.38||ratio>2.4))throw Error("Unusual translated-length ratio "+ratio.toFixed(2));
 const hits=(after.match(systemEnglish)||[]).length;
 if(item.kind==="section" && after.length>800 && hits<8)throw Error("Translated section not recognizably English.");
 if(/(?:this sentence should be|please translate|as an ai language model|as an editor|not enough context)/i.test(after))
   throw Error("Meta instruction leaked to English reader.");
 const trText=before.match(/[\u00c7\u00e7\u011e\u011f\u0130\u0131\u015e\u015f]/g)?.length||0;
 const enText=after.match(/[\u00c7\u00e7\u011e\u011f\u0130\u0131\u015e\u015f]/g)?.length||0;
 if(item.kind==="section"&&enText>Math.max(14,trText*0.55))throw Error("Large share of Turkish prose not translated.");
 return {ratio:Math.round(ratio*100)/100,englishHits:hits,sourceChars:before.length,targetChars:after.length,sourceTRLetters:trText,targetTRLetters:enText,
  targetHash:sha(JSON.stringify(translated))};
}
async function worker(index){
 const db=new DatabaseSync(dbPath);db.exec("PRAGMA busy_timeout=20000");
 try {
  while(pending.length){
   const item=pending.shift();
   try {
    const before=languages.variants(db,item.kind,item.id);
    if(!before?.variants.tr||before.variants.tr.stale || before.variants.tr.state!=="approved")
      throw Error("Current TR missing");
    if(before.variants.en?.state==="approved"&&!before.variants.en.stale){
      console.log("SKIP",item.kind,item.id);results.push({item,state:"skipped"});continue;
    }
    if(before.variants.en?.candidate && before.variants.en?.candidateMeta?.sourceHash!==before.sourceHash)
      throw Error("Outdated candidate; manual attention");
    if(!(before.variants.en?.candidate) || before.variants.en.candidateMeta?.sourceHash!==before.sourceHash){
      await languages.generate(db,userData,{kind:item.kind,id:item.id,language:"en"},translationClient);
    }
    const pack=languages.variants(db,item.kind,item.id);
    const translated=pack.variants.en?.candidate||pack.variants.en?.data;
    if(!translated)throw Error("Generated EN missing");
    const check=verify(pack.variants.tr.data,translated,item);
    const currentSource=languages.source(db,item.kind,item.id);
    if(pack.sourceHash!==currentSource.source_hash)throw Error("TR source changed after generation");
    const output=languages.save(db,{kind:item.kind,id:item.id,language:"en",sourceHash:pack.sourceHash,
      revision:pack.variants.en?.revision??0,approved:true,data:translated});
    const final=output.variants.en;
    if(final.state!=="approved"||final.stale)throw Error("English approval did not persist");
    const log={kind:item.kind,id:item.id,title:item.title,sourceHash:pack.sourceHash,
      model:pack.variants.en?.candidateMeta?.model||pack.variants.en?.model,check,approvedAt:new Date().toISOString()};
    fs.writeFileSync(path.join(reviewPath,item.kind+"-"+sha(item.id).slice(0,12)+".json"),JSON.stringify(log,null,2)+"\n");
    results.push({kind:item.kind,id:item.id,state:"approved",title:item.title,...check});
    console.log("APPROVED",JSON.stringify(results.at(-1)));
   }catch(error){
    results.push({kind:item.kind,id:item.id,state:"error",message:String(error.message||error)});
    console.error("FAILED",item.kind,item.id,String(error.message||error).slice(0,600));
   }
  }
 }finally{db.close()}
}
Promise.all(Array.from({length:workers},(_,i)=>worker(i))).then(()=>{
 const approved=results.filter(x=>x.state==="approved").length,errors=results.filter(x=>x.state==="error");
 console.log("BATCH_SUMMARY",JSON.stringify({mode:entityMode?'entities':'book',offset,count,eligibleAtStart:all.length,
  selected:selected.length,approved,skipped:results.filter(x=>x.state==="skipped").length,
  failed:errors.map(x=>({id:x.id,error:x.message})),elapsedSeconds:Math.round((Date.now()-begin)/1000)}));
 if(errors.length)process.exitCode=1;
}).catch(e=>{console.error(e);process.exitCode=1});
