/** Real React/Chromium, real IPC handlers + SQLite, deterministic vision transport.
 * VEFK_TEST_IMAGE may point at a local source photograph. No user DB or live transport. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const require=createRequire(import.meta.url);
const {createServer}=require('vite');
const {chromium}=createRequire(new URL('../../../channels/birdesengor/web/package.json',import.meta.url))('playwright-core');
const core=require('../vefk-core/index.cjs'),store=require('../vefk-store.cjs'),sources=require('../vefk-sources.cjs');
const publication=require('../vefk-publication.cjs');
const {registerVefkIpc}=require('../vefk-ipc.cjs');
const {registerVefkSourceIpc}=require('../vefk-source-ipc.cjs');
const {createVefkPlayer}=await import('../../../docs/contracts/vefk-site-consumer.mjs');
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'vefk-v3-browser-'));
const evidence=path.resolve(process.argv[2]??'artifacts/vefk-arabic');fs.mkdirSync(evidence,{recursive:true});
const db=new DatabaseSync(path.join(scratch,'test.sqlite'));db.exec('PRAGMA foreign_keys=ON');
const sourceFile=process.env.VEFK_TEST_IMAGE;
const demo=require('../seed-vefk-showcase.cjs').showcaseDocument(1);
store.saveDraft(db,{document:demo});
store.setReviewState(db,{id:demo.id,revision:1,status:'checked',expectedContentHash:demo.contentHash});
store.setReviewState(db,{id:demo.id,revision:1,status:'approved',expectedContentHash:demo.contentHash});
fs.writeFileSync(path.join(scratch,'ai-config.json'),JSON.stringify({provider:'openai-compatible',endpoint:'https://vision.test/v1',model:'test-vision',apiKey:'test-only'}));
const sample={schema:'vefk.source-analysis.v1',orientation:'rtl',note:'Test transport; photo is real. Human review is required.',
 regions:[{kind:'grid',box:[215,210,565,630],label:'5 × 5',confidence:1},
  {kind:'symbol',box:[434,242,85,108],label:'Yıldız',confidence:.99},
  {kind:'text',box:[280,65,420,130],label:'بسم الله',confidence:.99}],
 grid:{rows:5,columns:5,cells:Array.from({length:25},(_,i)=>({row:Math.floor(i/5),column:i%5,text:i===0?'?':i===2?'★':String(i+1),confidence:i===0?.35:.99}))}};
const handlers=new Map();let source;
const runtime={database:()=>db,vefkUserDataPath:()=>scratch,refreshMainWindow(){},pickVefkSource:async()=>({canceled:false,source:source=sources.importSource(db,scratch,sourceFile)})};
registerVefkIpc({handle:(name,fn)=>handlers.set(name,fn)},runtime);
registerVefkSourceIpc({handle:(name,fn)=>handlers.set(name,fn)},runtime);
// Same vision sanitization and append boundary, controlled transport only.
handlers.set('studio:vefk-source-analyze',async(_event,id)=>require('../vefk-vision.cjs').analyze(db,scratch,id,{transport:async()=>({content:JSON.stringify(sample),model:'test-vision'})}));
const map={vefkList:'vefk-list',vefkGet:'vefk-get',vefkGenerate:'vefk-generate',vefkValidate:'vefk-validate',vefkRevisions:'vefk-revisions',vefkSaveDraft:'vefk-save-draft',vefkReview:'vefk-review',vefkSourceReviewInfo:'vefk-source-review-info',vefkDelete:'vefk-delete',vefkCopy:'vefk-copy',vefkPackageStatus:'vefk-package-status',vefkCatalogList:'vefk-catalog-list',vefkCatalogSelect:'vefk-catalog-select',vefkSourceList:'vefk-source-list',vefkSourcePick:'vefk-source-pick',vefkSourceAnalysis:'vefk-source-analysis',vefkSourceAnalyze:'vefk-source-analyze',vefkSourceReview:'vefk-source-review',vefkSourcePrepare:'vefk-source-prepare',vefkSourceDelete:'vefk-source-delete',vefkAnalysisDelete:'vefk-analysis-delete',vefkSourceRename:'vefk-source-rename',vefkSourceCleanup:'vefk-source-cleanup',vefkVisionSupport:'vefk-vision-support'};
const methods=Object.fromEntries(Object.entries(map).map(([name,channel])=>[name,(input)=>handlers.get('studio:'+channel)({},input)]));
methods.vefkSourceGet=(id,preparationRevision)=>handlers.get('studio:vefk-source-get')({},{id,preparationRevision});
methods.exportPublicSnapshot=()=>{const exported=publication.exportCatalog(db,scratch);fs.writeFileSync(path.join(scratch,"public-export/content/publication.json"),JSON.stringify({vefkCatalog:publication.buildCatalog(db)}));return {...exported,readiness:{readyForTheme:false,narrativeSections:0,visualComplete:false,narrativeChangesPending:false}};};
let browser,server;const errors=[];const checks=[];
try{
 fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
 fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 fs.writeFileSync(path.join(scratch,'entry.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import VefkWorkshop from '/@fs/${repo}/apps/studio/src/VefkWorkshop.tsx';import '/@fs/${repo}/apps/studio/src/studio-theme-tokens.css';window.channelFoundryStudio=Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,(...args)=>window.__call(name,args)]));window.channelFoundryStudio.onDataChanged=()=>()=>{};document.body.style.margin='0';document.getElementById('root').style.height='100vh';createRoot(document.getElementById('root')).render(<VefkWorkshop/>);`);
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});await server.listen();
 const chrome=process.env.CHROME_PATH??[path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept(d.type()==='prompt'?'Yeni ad':undefined));
 await page.exposeFunction('__call',(name,args)=>methods[name](...args));await page.goto(server.resolvedUrls.local[0]);
 const button=(name)=>page.getByRole('button',{name,exact:true});
 await page.getByTitle(demo.title,{exact:true}).click();
 await page.getByLabel(demo.title+' SVG çizimi',{exact:true}).waitFor();
 await page.screenshot({path:path.join(evidence,'studio-complete.png')});
 await button('Başa sar').click();await page.getByLabel('Oynatma hızı').selectOption('2');
 await button('Oynat').click();await button('Duraklat').waitFor();
 await page.waitForTimeout(1500);await page.screenshot({path:path.join(evidence,'studio-playing.png')});
 await button('Duraklat').click();
 const scrub=page.getByLabel('Çizim zamanında ileri geri sar');
 await scrub.fill('80000');
 await button('Oynat').click();
 await button('Oynat').waitFor({timeout:30000});
 assert.ok(Math.abs(Number(await page.getByLabel('Çizim zamanında ileri geri sar').inputValue())-demo.drawPlan.durationMs)<10);
 await page.screenshot({path:path.join(evidence,'studio-finished.png')});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({status:'PASS',checks:['Studio record opens','real timeline playback at 2x; seek to hold and finish','no browser errors'],paths:demo.geometry.paths.length},null,2));
 console.log('PASS Studio open, preview playback and completion');
}finally{await browser?.close();await server?.close();db.close();fs.rmSync(scratch,{recursive:true,force:true});}
