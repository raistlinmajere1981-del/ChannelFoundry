/** Local Studio component smoke: real Chromium + real core/in-memory SQLite.
 * No Electron/user DB, site scene, export or running Vite server is used.
 * Run: node apps/studio/src/vefk-motion-editor.browser.mjs [evidence-directory] */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
const require=createRequire(import.meta.url);
const {createServer}=require('vite');
const {chromium}=createRequire(new URL('../../../channels/birdesengor/web/package.json',import.meta.url))('playwright-core');
const core=require('../vefk-core/index.cjs'),store=require('../vefk-store.cjs');
const {createVefkPlayer}=await import('../../../docs/contracts/vefk-site-consumer.mjs');
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'vefk-s4c1-browser-'));
const evidence=process.argv[2]??scratch;
fs.mkdirSync(evidence,{recursive:true});
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
const original=core.createVefk({id:'s4c1-browser',title:'S4c1 Chromium taslak',kind:'magicSquare',parameters:{order:3}});
store.saveDraft(db,{document:original});
const methods={
  vefkList: input=>store.listDocuments(db,input),
  vefkSourceList:()=>[], vefkCatalogList:()=>[],
  vefkRevisions:id=>store.listRevisions(db,id),
  vefkGet:({id,revision})=>store.getDocument(db,id,revision),
  vefkGenerate:input=>core.createVefk(input),
  vefkSaveDraft:input=>store.saveDraft(db,input),
  vefkReview:input=>store.setReviewState(db,input),
};
const calls=[];
let server,browser;
try {
  fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
  fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
  fs.writeFileSync(path.join(scratch,'entry.tsx'),`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import VefkWorkshop from '/@fs/${repo}/apps/studio/src/VefkWorkshop.tsx';
    import '/@fs/${repo}/apps/studio/src/studio-theme-tokens.css';
    import '/@fs/${repo}/apps/studio/src/styles.css';
    window.channelFoundryStudio=Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,(...args)=>window.__vefkCall(name,args)]));
    window.channelFoundryStudio.onDataChanged=()=>()=>{};
    document.body.style.margin='0';
    document.getElementById('root').style.height='100vh';
    createRoot(document.getElementById('root')).render(<VefkWorkshop/>);
  `);
  server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',
    esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},
    server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});
  await server.listen();
  const chrome=process.env.CHROME_PATH??process.env.CHROME_BIN??[path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),'/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome'].find(p=>fs.existsSync(p));
  assert.ok(chrome,'Chromium executable required');
  browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  await page.exposeFunction('__vefkCall',(name,args)=>{
    assert.ok(Object.hasOwn(methods,name),name);
    calls.push({name,args});return methods[name](...args);
  });
  await page.goto(server.resolvedUrls.local[0]);
  const library=page.locator('.vefk-document-row').first();
  await library.click();
  const expand=page.getByRole('button',{name:'Çizim zaman çizelgesi'});
  await expand.click();
  const opt=page.getByRole('button',{name:'Kalıcı v2 eğrilerini aç',exact:true});
  await opt.waitFor();
  await page.getByLabel('Deneysel çizgi içi hız eğrisi (kaydedilmez)',{exact:true}).selectOption('ease-out');
  assert.equal(await page.getByRole('button',{name:'Kaydet',exact:true}).isDisabled(),true);
  assert.equal(store.getDocument(db,original.id).document.contentHash,original.contentHash);
  await opt.click();
  // Use the generated path ID, rather than assuming a fixture naming convention.
  const pathId=original.drawPlan.strokes[0].pathId;
  const firstCurve=page.getByLabel(pathId+' Kalıcı çizgi içi eğri',{exact:true});
  await firstCurve.waitFor();
  assert.equal(await firstCurve.inputValue(),'linear');
  await page.getByRole('button',{name:'Geri al',exact:true}).click();
  await opt.waitFor();
  await page.getByRole('button',{name:'Yinele',exact:true}).click();
  await firstCurve.waitFor();
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await page.getByRole('status').filter({hasText:'kaydedildi'}).waitFor();
  const optedIn=store.getDocument(db,original.id).document;
  assert.equal(optedIn.schemaVersion,2);
  assert.ok(optedIn.drawPlan.strokes.every(s=>s.easing==='linear'),'opt-in stores explicit linear on every stroke');
  // Native keyboard interaction changes just this row and participates in history.
  await firstCurve.focus();await firstCurve.press('End');await firstCurve.press('Tab');
  assert.equal(await firstCurve.inputValue(),'ease-in-out');
  await page.getByLabel(pathId+' çizim süresi',{exact:true}).fill('1450');
  await page.getByRole('button',{name:'Kaydet',exact:true}).click();
  await page.getByRole('status').filter({hasText:'kaydedildi'}).waitFor();
  const saved=store.getDocument(db,original.id).document;
  assert.equal(saved.schemaVersion,2);assert.equal(saved.drawPlan.strokes[0].easing,'ease-in-out');
  assert.equal(saved.drawPlan.strokes[0].durationMs,1450);
  assert.equal(core.validateVefk(saved).ok,true);
  await page.reload();await library.click();await expand.click();await firstCurve.waitFor();
  assert.equal(await firstCurve.inputValue(),'ease-in-out');
  await page.getByLabel('Çizim zamanında ileri geri sar',{exact:true}).fill('720');
  const expectedFrame=createVefkPlayer(saved).frameAt(720);
  await page.waitForFunction(()=>document.querySelector('.vefk-ink')?.hasAttribute('stroke-dashoffset'));
  const visible=await page.locator('.vefk-ink').first().getAttribute('stroke-dashoffset');
  assert.ok(Math.abs(Number(visible)-(1-expectedFrame.visibility[0].fraction))<1e-10);
  const pen=await page.locator('.vefk-pen-nib').getAttribute('transform');
  assert.equal(pen,`translate(${expectedFrame.pen.position.x} ${expectedFrame.pen.position.y})`);
  await page.screenshot({path:path.join(evidence,'studio-doc2-1366.png')});
  await page.getByRole('button',{name:'Kontrole gönder',exact:true}).click();
  await page.getByRole('button',{name:'Onayla',exact:true}).waitFor();
  assert.equal(await firstCurve.isDisabled(),true);
  await page.getByRole('button',{name:'Onayla',exact:true}).click();
  const nextRevision=page.getByRole('button',{name:'Yeni revizyon oluştur',exact:true});
  await nextRevision.waitFor();assert.equal(await firstCurve.isDisabled(),true);
  assert.equal(store.getDocument(db,original.id).status,'approved');
  await nextRevision.click();
  await page.waitForFunction(()=>document.querySelector('.vefk-state')?.textContent?.includes('r2'));
  assert.equal(await firstCurve.isDisabled(),false);
  assert.equal(await firstCurve.inputValue(),'ease-in-out');
  assert.equal(store.getDocument(db,original.id,1).document.contentHash,saved.contentHash);
  // Locked v1 must create a revision before the v2 opt-in becomes available.
  const locked=core.createVefk({id:'s4c1-browser-locked',title:'S4c1 kilitli v1',parameters:{order:3}});
  store.saveDraft(db,{document:locked});
  for(const status of ['checked','approved'])store.setReviewState(db,{id:locked.id,revision:1,status,expectedContentHash:locked.contentHash});
  await page.reload();
  await page.locator('.vefk-document-row').filter({hasText:locked.title}).click();
  await expand.click();await opt.waitFor();assert.equal(await opt.isDisabled(),true);
  await nextRevision.click();
  await page.waitForFunction(()=>document.querySelector('.vefk-state')?.textContent?.includes('r2'));
  assert.equal(await opt.isDisabled(),false);
  await opt.click();await page.getByLabel(locked.drawPlan.strokes[0].pathId+' Kalıcı çizgi içi eğri',{exact:true}).waitFor();
  const lastGenerated=calls.filter(c=>c.name==='vefkGenerate').at(-1).args[0];
  assert.equal(lastGenerated.schemaVersion,2);assert.equal(lastGenerated.revision,2);
  assert.equal(store.getDocument(db,locked.id,1).document.contentHash,locked.contentHash);
  assert.deepEqual(errors,[]);
  const result={status:'PASS',browser:'Chromium',viewport:[1366,900],
    checks:['v1 transient preview','draft explicit opt-in','undo/redo across version','explicit linear for every opted-in stroke','native keyboard easing + duration',
      'canonical generation/save','reload doc2','canonical SVG ink + nib preview','checked/approved lock','v2 next revision retained',
      'approved v1 requires new revision then explicit opt-in'],
    generatedVersions:calls.filter(c=>c.name==='vefkGenerate').map(c=>c.args[0].schemaVersion),
    savedContentHash:saved.contentHash,errors,
    limitation:'Studio component with real core/in-memory store; not Electron IPC or S4c2 site visual E2E'};
  fs.writeFileSync(path.join(evidence,'studio-browser.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {
  await browser?.close();await server?.close();db.close();
  if(evidence!==scratch)fs.rmSync(scratch,{recursive:true,force:true});
}
