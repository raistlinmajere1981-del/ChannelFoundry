"use strict";
/* Verify current transcript audits, then mark only safe existing drafts reviewed. */
const {DatabaseSync}=require("node:sqlite");
const path=require("node:path"),fs=require("node:fs"),crypto=require("node:crypto");
const service=require("./invitation-draft-service.cjs");
const root=path.resolve(__dirname,"../..");
const primary=path.join(root,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const folder=path.join(path.dirname(primary),"invitation-audits");
const i=process.argv.indexOf("--db"),file=i<0?primary:process.argv[i+1];
if(i>=0&&!path.resolve(file).startsWith("/tmp/"))throw Error("Test DB must be /tmp");
const a=process.argv.indexOf("--start"),b=process.argv.indexOf("--end");
const start=a<0?11:Number(process.argv[a+1]),end=b<0?20:Number(process.argv[b+1]);
if(start<11||end>68||end-start>=12)throw Error("Batch range invalid");
const hash=v=>crypto.createHash("sha256").update(v).digest("hex");
const db=new DatabaseSync(file);
db.exec("PRAGMA busy_timeout=10000");
try{
 const items=[];
 for(let n=start;n<=end;n++){
  if(service.listing(db).find(x=>x.number===n)?.state==="missing")continue;
  const data=service.detail(db,n),draft=data.draft;
  if(!draft||data.stale||data.imported)throw Error("Missing/current/imported status "+n);
  if(/(?:bu (?:cümleyi|paragrafı).*(?:taşı|çıkar)|editoryal inceleme gerekir|source excerpt|taslak metni|metinden çıkar|önceki paragraftaki)/iu.test(draft.body))
   throw Error("Editorial instruction leaked into narrative #"+n);
  const p=path.join(folder,n+".json");
  if(!fs.existsSync(p))throw Error("No audit #"+n);
  const audit=JSON.parse(fs.readFileSync(p));
  if(!["pass","review"].includes(audit.verdict)||audit.issues.some(x=>x.severity==="blocking"))
   throw Error("Source audit blocking #"+n);
  if(audit.draftHash!==hash(draft.title+"\n"+draft.body)||audit.sourceHash!==hash(data.originalSubtitle))
   throw Error("Source audit stale #"+n);
  if(audit.sourceVideoIds && JSON.stringify(audit.sourceVideoIds)!==JSON.stringify(data.sourceVideoIds))
   throw Error("Mismatched direct video sources #"+n);
  items.push({n,state:audit.verdict,issues:audit.issues.length});
 }
 db.exec("BEGIN IMMEDIATE");
 try{
  for(const item of items){const reviewed=service.review(db,{number:item.n,reviewed:true});if(!reviewed.reviewed)throw Error("Could not mark "+item.n);}
  db.exec("COMMIT");
 }catch(e){db.exec("ROLLBACK");throw e;}
 console.log("REVIEW_GATE_PASSED",JSON.stringify({range:[start,end],reviewed:items.length,items}));
}finally{db.close();}
