/** Production narrative reader with a synthetic pending draft. Never opens a real DB. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),repo=path.resolve(import.meta.dirname,"../../.."),studio=path.join(repo,"apps/studio");
const {createServer}=require("vite"),{chromium}=createRequire(path.join(repo,"channels/birdesengor/web/package.json"))("playwright-core");
const quality=require("../narrative-quality.cjs");
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"narrative-reader-"));
const out=path.join(repo,"artifacts/narrative-stage4");fs.mkdirSync(out,{recursive:true});
const body="Düğümlü Kitap ile yola çıktım. Davetliden duyduğum bazı iddialar beni düşündürdü. Kaynağa göre kitap uzun yıllardır saklanmış.\n\nYedi Kapı";
const draft={id:3,sectionKey:"section-fixture",runId:3,revisionNo:1,position:0,title:"Düğümlü Kitap — 54. Davet",body,blocks:[],entityReferences:[],sourceKeys:["story-fixture"],sourceVideoIds:["video-54","video-55","video-56","video-57"],media:[],retire:false,state:"draft",createdAt:"",approvedAt:null,publishedAt:null};
draft.qualityNotes=quality.analyzeDraft(draft,{mode:"source_bound_first_person",displayName:"Ömer"});
const request={input:{changes:[{sourceType:"node",sourceKey:"story-fixture",changeKind:"new"}],technicalGraphChanges:[{sourceKey:"rel-1"}],allowedSources:[{sourceKey:"story-fixture",sourceType:"node",name:"Düğümlü Kitap",kind:"story"}],sourceVideos:[{videoId:"video-54",title:"Düğümlü Kitap 54. Davet",publishedAt:"2026-04-27"},{videoId:"video-55",title:"Düğümlü Kitap 55. Davet",publishedAt:"2026-05-04"}],baselineNarrative:[],removed:[],narrator:{displayName:"Ömer",mode:"source_bound_first_person",editorialNote:""}}};
const run={id:3,state:"prepared",baselineRunId:null,inputFingerprint:"A".repeat(64),universeFingerprint:"B".repeat(64),input:{},model:"fixture-model",createdAt:"2026-11-07",appliedAt:null,discardedAt:null};
const status={workingRun:{run,drafts:[draft],request},next:{hasChanges:true,changes:2,removed:0},counts:{activeSections:0,applied:0},memory:[]};

const blockedDraft={...draft,blocks:[{type:"paragraph",spans:[
  {type:"text",text:"Görüşmenin ardından kitaba döndüm."},
  {type:"reference",entityId:"story-fixture",label:"Ömer"},
  {type:"reference",entityId:"story-fixture",label:"Düğümlü Kitap"},
]}]};
blockedDraft.qualityNotes=quality.analyzeDraft(blockedDraft,{mode:"source_bound_first_person",displayName:"Ömer"});
const blockedStatus={...status,workingRun:{...status.workingRun,drafts:[blockedDraft]}};
const outline={profile:{displayName:"Ömer",mode:"source_bound_first_person",editorialNote:""},series:[],chapters:[],assignments:[]};
let browser,server,page;const errors=[];
try{
 fs.symlinkSync(path.join(repo,"node_modules"),path.join(scratch,"node_modules"));
 fs.writeFileSync(path.join(scratch,"index.html"),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 fs.writeFileSync(path.join(scratch,"entry.tsx"),[
  "import React from 'react';import{createRoot}from'react-dom/client';",
  "import Narrative from '/@fs/"+studio+"/src/NarrativeWorkbench.tsx';",
  ...["studio-theme-tokens.css","styles.css","pipeline.css","studio-accessibility.css","studio-theme-bindings.css","studio-workspace-system.css","studio-fixed-viewport.css"].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
  "const normalStatus="+JSON.stringify(status)+",blockedStatus="+JSON.stringify(blockedStatus)+",status=location.search.includes('blocked=1')?blockedStatus:normalStatus,outline="+JSON.stringify(outline)+";",
  "window.channelFoundryStudio={narrativeStatus:async()=>status,narrativeOutlineStatus:async()=>outline,onDataChanged:()=>()=>{}};",
  "document.body.style.margin='0';document.body.style.padding='12px';document.body.style.background='var(--surface-canvas)';",
  "document.documentElement.dataset.studioTextSize='large';document.documentElement.dataset.studioTheme='light';",
  "createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',width:'100%'}}><div className='ai-stage-content' style={{display:'block',height:'850px',width:'100%',overflow:'auto'}}><Narrative/></div></div>);"
 ].join("\n"));
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:"error",esbuild:{jsx:"automatic"},resolve:{dedupe:["react","react-dom"]},server:{host:"127.0.0.1",port:0,fs:{allow:[repo,scratch]}}});
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),".claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome"),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 page=await browser.newPage({viewport:{width:1640,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);
 const card=page.locator(".narrative-draft-card").first();
 await card.locator(".narrative-body").waitFor({state:"attached"});
 await card.locator(".narrative-body").scrollIntoViewIfNeeded();
 const values=await card.evaluate(n=>({size:parseFloat(getComputedStyle(n.querySelector(".narrative-body")).fontSize),bodyColor:getComputedStyle(n.querySelector(".narrative-body")).color,cardBackground:getComputedStyle(n).backgroundColor,alerts:[...n.querySelectorAll(".narrative-quality li")].map(n=>n.textContent)}));
 assert.ok(values.size>=19,JSON.stringify(values));
 assert.ok(values.alerts.some(t=>t.includes("Yedi Kapı")));
 assert.ok(values.alerts.some(t=>t.includes("4 videoya")));
 await page.getByRole("tab",{name:/Kaynaklar/}).click();
 assert.equal(await page.locator(".narrative-graph-note").count(),1,"Technical links belong only to source review");
 assert.equal(await page.locator(".narrative-sources-view code").count(),0,"Source keys and video IDs must remain internal");
 await page.getByRole("tab",{name:/Anlatı/}).click();
 await page.screenshot({path:path.join(out,"narrative-reading-light-1640.png"),fullPage:true});
 let promptText="";
 page.on("dialog",async dialog=>{promptText=dialog.message();await dialog.dismiss();});
 await page.getByRole("button",{name:"Bölümleri onayla · 1"}).click();
 assert.match(promptText,/editoryal kontrol notu/u);
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{document.documentElement.dataset.studioTheme="dark";document.documentElement.dataset.studioTextSize="comfortable";});
 await card.locator(".narrative-body").scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(out,"narrative-reading-dark-1366.png"),fullPage:true});
 await page.goto(server.resolvedUrls.local[0]+"?blocked=1");
 const disabled=page.getByRole("button",{name:/Onay engellendi/});
 await disabled.waitFor();
 assert.equal(await disabled.isDisabled(),true,"A malformed draft must not be approvable from the UI");
 assert.equal(await page.locator(".narrative-quality-blocker").count(),2);
 await page.screenshot({path:path.join(out,"narrative-approval-blocked-1366.png"),fullPage:true});
 assert.deepEqual(errors,[]);
 const output={values,confirmationShowsRisk:true,errors};
 fs.writeFileSync(path.join(out,"verification.json"),JSON.stringify(output,null,2));
 console.log("PASS Stage4 narrative reader with synthetic pending draft:",JSON.stringify(output));
}catch(e){if(page)await page.screenshot({path:path.join(out,"narrative-reading-failure.png"),fullPage:true});throw e;}
finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
