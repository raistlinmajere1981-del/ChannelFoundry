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
{key:"s",category:"sponsor",label:"Destek kaydı",detail:"",target:"support",decision:"confirm"},
{key:"s2",category:"contributor",label:"İkinci destekçi",detail:"",target:"support",decision:"confirm"}
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
 "if(new URLSearchParams(location.search).has('many')) review.items=Array.from({length:18},(_,i)=>({key:'x'+i,category:'scene',label:'Uzun liste kaydı '+i,detail:('Uzun kaynak anlatımı. ').repeat(24),target:'universe',decision:i<11?'include':'context',resolution:{status:'new',kind:'scene',matchedBy:'',canonicalName:'',candidates:[],recommendedDecision:'include',needsReview:false,reason:''}}));",
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
 await page.addInitScript(()=>{window.__curationMoves=[];const original=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.classList?.contains("analysis-curation-reading-entry")||this.classList?.contains("analysis-curation-moving-ghost"))window.__curationMoves.push({cls:this.className,frames});return original.call(this,frames,options);};});
 await page.goto(server.resolvedUrls.local[0]);
 const entry=page.locator('.analysis-curation-reading-entry[data-curation-key="a"]');
 await entry.locator(".analysis-curation-entry-reading").waitFor();
 assert.equal(await entry.locator(".analysis-curation-entry-reading").textContent(),sourceText);
 assert.equal(await entry.getByText(oldReason,{exact:true}).count(),0,"Long technical note must not interrupt prose");
 assert.equal(await entry.getByText("Eşleşme yok · ayrıntı sınırlı").count(),1);
 const values=await entry.evaluate(n=>({
   title:parseFloat(getComputedStyle(n.querySelector(".analysis-curation-entry-heading strong")).fontSize),
   reading:parseFloat(getComputedStyle(n.querySelector(".analysis-curation-entry-reading")).fontSize),
   note:parseFloat(getComputedStyle(n.querySelector(".analysis-curation-resolution span")).fontSize),
   line:getComputedStyle(n.querySelector(".analysis-curation-entry-reading")).lineHeight,
   noteBelow:n.querySelector(".analysis-curation-entry-decision").getBoundingClientRect().top >= n.querySelector(".analysis-curation-entry-main").getBoundingClientRect().bottom-2,
   selectableCards:getComputedStyle(document.querySelector(".analysis-curation-items")).rowGap !== "1px",
   statusVisible:document.querySelector(".analysis-curation-state").getBoundingClientRect().height>=28,
   allVisible:document.querySelectorAll('.analysis-curation-reading-entry').length===3,
   compactSummary:!!document.querySelector('.analysis-curation-selected-summary'),
   removedPanels:!document.querySelector('.analysis-curation-auto-summary, .analysis-curation-decision-summary, .analysis-curation-auto-empty')
 }));
 assert.ok(values.title>=20,JSON.stringify(values));
 assert.ok(values.reading>=19 && values.reading>=values.note+4,JSON.stringify(values));
 assert.equal(values.noteBelow,true,JSON.stringify(values));
 assert.equal(values.selectableCards,true,JSON.stringify(values));
 assert.equal(values.statusVisible,true,JSON.stringify(values));
 assert.equal(values.allVisible,true,JSON.stringify(values));
 assert.equal(values.compactSummary,true,JSON.stringify(values));
 assert.equal(values.removedPanels,true,JSON.stringify(values));
 await page.screenshot({path:path.join(out,"curation-reading-light-1640.png"),fullPage:true});
 assert.equal(await entry.locator(".analysis-curation-entry-decision select").count(),0,"Dropdown is replaced with decision chips");
 await entry.getByRole("button",{name:"Yalnız bağlam"}).click();
 assert.equal(await entry.getByRole("button",{name:"Yalnız bağlam"}).getAttribute("aria-pressed"),"true");
 assert.equal(await page.locator(".analysis-curation-reading-entry").first().getAttribute("data-curation-key"),"c","Evrene aktar kararları önce sıralanır.");
 assert.equal(await page.locator(".analysis-curation-reading-entry").nth(1).getAttribute("data-curation-key"),"a","Bağlamlar evren kayıtlarının altında olmalı.");
 assert.match((await page.locator(".analysis-curation-selected-summary .context").innerText()).replace(/\s+/g," "),/2 bağlam/);
 assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.analysis-curation-reading-entry')),true,"Karardan sonra odak okuma alanında kalmalı.");
 await entry.locator(".analysis-curation-resolution strong").getByText("Yalnız bağlam",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Kararları kaydet"}).click();
 await page.waitForFunction(()=>window.__saved?.decisions.a==="context");
 assert.equal(await page.evaluate(()=>window.__saved.decisions.a),"context");
 await page.getByText("Bilinen muhatap",{exact:true}).waitFor();
 assert.equal(await page.getByText("Studio mevcut Evren kayıtlarını isim ve lakaplarla eşleştirir.",{exact:false}).count(),0);
 const record=page.locator(".analysis-curation-reading-entry").filter({hasText:"Keçi başlı kavmin adası"});
 await record.getByRole("button",{name:"Hariç tut"}).click();
 assert.equal(await page.locator(".analysis-curation-reading-entry").last().locator(".analysis-curation-entry-heading strong").innerText(),"Keçi başlı kavmin adası");
 const tones=await page.locator(".analysis-curation-reading-entry").evaluateAll(rows=>rows.map(row=>({decision:[...row.classList].find(c=>c.startsWith("decision-")),color:getComputedStyle(row).backgroundColor})));
 assert.equal(new Set(tones.map(t=>t.color)).size,3,JSON.stringify(tones));
 await record.getByRole("button",{name:"Yalnız bağlam"}).click();
 assert.equal(await page.locator(".analysis-curation-reading-entry").nth(1).locator(".analysis-curation-entry-heading strong").innerText(),"Keçi başlı kavmin adası","Bağlam, Evrene aktarılan kaydın ardından gelir.");
 await record.getByRole("button",{name:"Evrene aktar"}).click();
 assert.equal(await page.locator(".analysis-curation-reading-entry").first().locator(".analysis-curation-entry-heading strong").innerText(),"Keçi başlı kavmin adası");
 const support=page.locator(".analysis-curation-support-entry");
 await support.first().getByRole("button",{name:"Hariç tut"}).click();
 assert.equal(await support.last().getByText("Destek kaydı").count(),1,"Excluded support entry must move to the end");
 assert.equal(await support.last().getByRole("button",{name:"Hariç tut"}).getAttribute("aria-pressed"),"true");
 await page.getByRole("button",{name:"Kararları kaydet"}).click();
 await page.waitForFunction(()=>window.__saved?.decisions.s==="exclude");
 assert.equal(await page.evaluate(()=>window.__saved.decisions.s),"exclude");
 const manual=await page.locator(".analysis-curation-manual").evaluate(n=>({labels:[...n.querySelectorAll("label")].map(el=>({size:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color})),inputs:[...n.querySelectorAll("textarea")].map(el=>({fontSize:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color}))}));
 assert(manual.labels.every(x=>x.size>=12)&&manual.inputs.every(x=>x.fontSize>=13),JSON.stringify(manual));
 await page.setViewportSize({width:1366,height:768});
 await page.evaluate(()=>{document.documentElement.dataset.studioTheme="dark";document.documentElement.dataset.studioTextSize="comfortable";});
 await page.screenshot({path:path.join(out,"curation-reading-dark-1366.png"),fullPage:true});
 const themeColors=await page.evaluate(()=>{const chip=document.querySelector(".analysis-curation-choice:not(.active)"),selected=document.querySelector(".analysis-curation-choice.active");return {rootPanel:getComputedStyle(document.documentElement).getPropertyValue("--surface-panel"),shellPanel:getComputedStyle(chip).getPropertyValue("--surface-panel"),rootText:getComputedStyle(document.documentElement).getPropertyValue("--text-primary"),shellText:getComputedStyle(chip).getPropertyValue("--text-primary"),inactiveBg:getComputedStyle(chip).backgroundColor,inactiveText:getComputedStyle(chip).color,selectedBg:getComputedStyle(selected).backgroundColor,selectedText:getComputedStyle(selected).color,disabled:chip.disabled};});
 console.log("CURATION DARK CHIP STYLES",JSON.stringify(themeColors));
 assert.deepEqual(errors,[]);
 // Longer lists: move a visible item far down without losing the next reading card.
 await page.goto(server.resolvedUrls.local[0]+'?many=1');
 const moving=page.locator('[data-curation-key="x3"]');
 await moving.getByRole('button',{name:'Yalnız bağlam'}).scrollIntoViewIfNeeded();
 const previous=await page.evaluate(()=>({scroll:document.querySelector('.analysis-curation-scroll').scrollTop,anchor:document.querySelector('[data-curation-key="x4"]').getBoundingClientRect().top}));
 await moving.getByRole('button',{name:'Yalnız bağlam'}).click();
 const afterMove=await page.evaluate(()=>({scroll:document.querySelector('.analysis-curation-scroll').scrollTop,anchor:document.querySelector('[data-curation-key="x4"]').getBoundingClientRect().top,focused:document.activeElement?.closest('[data-curation-key]')?.dataset.curationKey,animationCount:window.__curationMoves.length,sorted:[...document.querySelectorAll('.analysis-curation-reading-entry')].map(n=>({key:n.dataset.curationKey,decision:[...n.classList].find(c=>c.startsWith('decision-'))}))}));
 assert.equal(afterMove.sorted.findIndex(n=>n.key==='x3'),10,'Changed item should move below included entries.');
 assert(afterMove.scroll>0,'Reader should not jump to the beginning.');
 assert(Math.abs(afterMove.anchor-previous.anchor)<25,'Anchor should stay at the same reading position: '+JSON.stringify({previous,afterMove}));
 assert.equal(afterMove.focused,'x4','Keyboard focus should continue on the adjacent record.');
 assert(afterMove.animationCount>0,'Reordering should animate.');
 // Reduced-motion users get the same sorting/focus behavior with no animated transforms.
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{window.__curationMoves=[];});
 await page.locator('[data-curation-key="x4"]').getByRole('button',{name:'Yalnız bağlam'}).click();
 const reduced=await page.evaluate(()=>({count:window.__curationMoves.length,focused:document.activeElement?.closest('[data-curation-key]')?.dataset.curationKey}));
 assert.equal(reduced.count,0,'Reduced-motion should suppress the moving animation.');
 assert(reduced.focused,'Focus should remain within the editorial list.');
 const result={values,decisionSaved:"context",visibleEntries:await page.locator(".analysis-curation-reading-entry").count(),errors};
 fs.writeFileSync(path.join(out,"verification.json"),JSON.stringify(result,null,2));
 console.log("PASS synthetic Ayıklama reader: large light + comfortable dark",JSON.stringify(result));
}catch(e){if(page)await page.screenshot({path:path.join(out,"curation-reading-failure.png"),fullPage:true});throw e;}
finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
