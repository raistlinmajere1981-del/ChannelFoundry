"use strict";
/**
 * Apply only exact-match source-audit blocking corrections, preserving a ledger.
 * A second independent audit must pass before any approval/import.
 */
const {DatabaseSync}=require("node:sqlite");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const service=require("./invitation-draft-service.cjs");
const root=path.resolve(__dirname,"../..");
const dbPath=path.join(root,"channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const folder=path.join(path.dirname(dbPath),"invitation-audits");
const first=Number(process.argv[2]||11),last=Number(process.argv[3]||20);
const digest=s=>crypto.createHash("sha256").update(s).digest("hex");
const db=new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout=10000");
try{
 const report=[];
 for(let n=first;n<=last;n++){
  const item=service.listing(db).find(x=>x.number===n);
  if(!item||item.state==="missing"||item.state==="imported")continue;
  const info=service.detail(db,n),draft=info.draft,filename=path.join(folder,n+".json");
  if(!draft||!fs.existsSync(filename)){report.push({n,state:"not-ready"});continue;}
  const audit=JSON.parse(fs.readFileSync(filename,"utf8"));
  if(audit.draftHash!==digest(draft.title+"\n"+draft.body) || audit.sourceHash!==digest(info.originalSubtitle)){
    report.push({n,state:"stale-audit"});continue;
  }
  const issues=audit.issues.filter(x=>x.severity==="blocking");
  if(!issues.length){report.push({n,state:audit.verdict});continue;}
  let body=draft.body, title=draft.title;
  const changes=[],skipped=[];
  const editorialInstruction=/(?:taşıyın|değiştirin|kontrol edin|doğrulayın|editoryal|bu cümleyi|düzeltilmeli|gerekir|çıkarın|yazımı)/iu;
  for(const issue of issues){
    const old=String(issue.draftClaim||"").trim();
    const next=String(issue.proposedChange||"").trim();
    if(!old||!next||old===next||editorialInstruction.test(next)||next.length<12||
      next.length>Math.max(old.length*2,old.length+220)){
       skipped.push(issue.draftClaim);continue;
    }
    if(old===title){
      title=next;changes.push({old,new:next,reason:issue.explanation,field:"title"});continue;
    }
    if(body.split(old).length!==2){
       skipped.push(issue.draftClaim);continue;
    }
    body=body.replace(old,next);
    changes.push({old,new:next,reason:issue.explanation});
  }
  if(!changes.length){report.push({n,state:"unresolved",skipped:skipped.length});continue;}
  const beforeHash=digest(draft.title+"\n"+draft.body);
  const updated=service.update(db,{number:n,title,body});
  const ledger=path.join(folder,n+".correction-history.jsonl");
  fs.appendFileSync(ledger,JSON.stringify({at:new Date().toISOString(),number:n,
    sourceVideoIds:info.sourceVideoIds,beforeHash,afterHash:digest(updated.title+"\n"+updated.body),
    changes,skipped})+"\n");
  report.push({n,state:"corrected",count:changes.length,skipped:skipped.length});
  console.log("PATCH",JSON.stringify(report.at(-1)));
 }
 console.log("CORRECTIONS",JSON.stringify(report));
}finally{db.close();}
