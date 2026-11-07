/** Ayıklama reader acceptance: mocked source data, no production SQLite. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),repo=path.resolve(import.meta.dirname,"../../.."),studio=path.join(repo,"apps/studio");
const {createServer}=require("vite");
const {chromium}=createRequire(path.join(repo,"channels/birdesengor/web/package.json"))("playwright-core");
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"curation-reading-"));
const out=path.join(repo,"artifacts/curation-reading");fs.mkdirSync(out,{recursive:true});
const sourceText="Olayın gerçekleştiği yerde eski bir taş işaret bulunduğu anlatılıyor. Kaynakta yer alan tarif, iki farklı mekânı birbirine bağlamaya yetmiyor. Bu nedenle metnin eksiksiz okunması ve gerçekten yeni bir yer kaydı gerekip gerekmediğine karar verilmesi gerekiyor.";
const oldReason="Evren'de eşleşen kayıt yok ve ek ayrıntı sınırlı; yeni kayıt kararını gözden geçir.";
const video={videoId:"test-1",title:"Her an görebilirsin — Deneme video başlığı",publishedAt:"2026-11-01",hasAnalysis:true,editorialState:"pending",universeLocked:false};
const resolution=(status,needsReview,extra={})=>({status,kind:"location",matchedBy:"",canonicalName:"",candidates:[],recommendedDecision:"include",needsReview,reason:oldReason,...extra});
const review={videoId:"test-1",state:"pending",reviewedAt:null,manualSponsors:[],manualContributors:[],entityCatalog:[],universeLocked:false,items:[
{key:"a",category:"location",label:"Keçi başlı kavmin adası",detail:sourceText,target:"universe",decision:"include",resolution:resolution("new",true)},
{key:"b",category:"object",label:"Gizemli taş işareti",detail:"Bu taşın adı başka kaynaklarda farklı kaydedilmiş. ".repeat(10),target:"universe",decision:"context",resolution:resolution("ambiguous",true,{kind:"object",candidates:[{key:"1",name:"Taş 1",kind:"object",aliases:[],state:"approved"},{key:"2",name:"Taş 2",kind:"object",aliases:[],state:"approved"}]})},
{key:"c",category:"character",label:"Bilinen muhatap",detail:"Yeni ayrıntılar bulundu.",target:"universe",decision:"include",resolution:resolution("existing",false,{kind:"character",canonicalName:"Eski muhatap"})},
{key:"s",category:"sponsor",label:"Destek kaydı",detail:"",target:"support",decision:"confirm"}
]};
let browser,server,page;const errors=[];
try{
 fs.symlinkSync(path.join(repo,"node_modules"),path.join(scratch,"node_modules"));
 fs.writeFileSync(path.join(scratch,"index.html"),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 fs.writeFileSync(path.join(scratch,"entry.tsx"),[
 "import React from 'react';import{createRoot}from'react-dom/client';",
 "import Curation from '/@fs/"+studio+"/src/AnalysisCurationWorkbench.tsx';",
 ...["studio-theme-tokens.css","styles.css","pipeline.css","studio-accessibility.css","studio-theme-bindings.css","studio-workspace-system.css","studio-fixed-viewport.css"].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
 "const video="+JSON.stringify(video)+",review="+JSON.stringify(review)+";",
 "window.channelFoundryStudio={aiAnalysisList:async()=>[video],aiAnalysisStats:async()=>({analyzed:1,editorialPending:1,curated:0,excluded:0}),aiAnalysisEditorial:async()=>review,aiAnalysisEditorialSave:async input=>{window.__saved=input;return {...review,state:input.state,items:review.items.map(item=>({...item,decision:input.decisions[item.key]??item.decision}))};},onDataChanged:()=>()=>{}};",
 "document.body.style.margin='0';document.body.style.padding='12px';document.body.style.background='var(--surface-canvas)';",
 "document.documentElement.dataset.studioTextSize='large';document.documentElement.dataset.studioTheme='light';document.documentElement.dataset.studioReadingWidth='medium';",
 "createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',width:'100%'}}><div className='ai-production-workbench' style={{display:'block',width:'100%'}}><div className='ai-stage-content' style={{display:'block',width:'100%',height:'820px'}}><Curation/></div></div></div>);"
 ].join("\n"));
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:"error",esbuild:{jsx:"automatic"},resolve:{dedupe:["react","react-dom"]},server:{host:"127.0.0.1",port:0,fs:{allow:[repo,scratch]}}});
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),".claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome"),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 page=await browser.newPage({viewport:{width:1640,height:900}});
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);
 const entry=page.locator(".analysis-curation-reading-entry").first();
 await entry.locator(".analysis-curation-entry-reading").waitFor();
 assert.equal(await entry.locator(".analysis-curation-entry-reading").textContent(),sourceText);
 assert.equal(await entry.getByText(oldReason,{exact:true}).count(),0,"Long technical note must not interrupt prose");
 assert.equal(await entry.getByText("Eşleşme yok · ayrıntı sınırlı").count(),1);
 const values=await entry.evaluate(n=>({
   title:parseFloat(getComputedStyle(n.querySelector(".analysis-curation-entry-heading strong")).fontSize),
   reading:parseFloat(getComputedStyle(n.querySelector(".analysis-curation-entry-reading")).fontSize),
   note:parseFloat(getComputedStyle(n.querySelector(".analysis-curation-resolution span")).fontSize),
   line:getComputedStyle(n.querySelector(".analysis-curation-entry-reading")).lineHeight,
   noteRight:n.querySelector(".analysis-curation-entry-decision").getBoundingClientRect().left >= n.querySelector(".analysis-curation-entry-main").getBoundingClientRect().right-2
 }));
 assert.ok(values.title>=20,JSON.stringify(values));
 assert.ok(values.reading>=19 && values.reading>=values.note+4,JSON.stringify(values));
 assert.equal(values.noteRight,true,JSON.stringify(values));
 await page.screenshot({path:path.join(out,"curation-reading-light-1640.png"),fullPage:true});
 await entry.getByRole("combobox",{name:"Keçi başlı kavmin adası kararı"}).selectOption("context");
 await entry.locator(".analysis-curation-resolution strong").getByText("Yalnız bağlam",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Kararları kaydet"}).click();
 await page.waitForFunction(()=>window.__saved?.decisions.a==="context");
 assert.equal(await page.evaluate(()=>window.__saved.decisions.a),"context");
 await page.getByRole("button",{name:"Tüm kararları göster (3)"}).click();
 await page.getByText("Bilinen muhatap",{exact:true}).waitFor();
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{document.documentElement.dataset.studioTheme="dark";document.documentElement.dataset.studioTextSize="comfortable";});
 await page.screenshot({path:path.join(out,"curation-reading-dark-1366.png"),fullPage:true});
 assert.deepEqual(errors,[]);
 const result={values,decisionSaved:"context",visibleEntries:await page.locator(".analysis-curation-reading-entry").count(),errors};
 fs.writeFileSync(path.join(out,"verification.json"),JSON.stringify(result,null,2));
 console.log("PASS synthetic Ayıklama reader: large light + comfortable dark",JSON.stringify(result));
}catch(e){if(page)await page.screenshot({path:path.join(out,"curation-reading-failure.png"),fullPage:true});throw e;}
finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
