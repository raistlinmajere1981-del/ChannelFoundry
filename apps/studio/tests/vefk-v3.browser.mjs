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
const evidence=path.resolve(process.argv[2]??'artifacts/vefk-v3');fs.mkdirSync(evidence,{recursive:true});
const db=new DatabaseSync(path.join(scratch,'test.sqlite'));db.exec('PRAGMA foreign_keys=ON');
const sourceFile=process.env.VEFK_TEST_IMAGE;
assert.ok(sourceFile && fs.existsSync(sourceFile),'Set VEFK_TEST_IMAGE to a local reference image');
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
 await button('Görsel ekle').click();
 await button('Kırp ve hizala').click();await page.getByAltText('Düzeltilmiş vefk kaynak görseli').waitFor();
 await button('Düzeltmeyi kaydet').click();await button('İncelemeye başla →').waitFor();checks.push('crop/perspective preparation and source revision saved on the same surface');
 await button('İncelemeye başla →').click();
 await page.getByLabel('Üretim aşamaları').filter({hasText:'28 öğe kaldı'}).waitFor();checks.push('source import, vision transport, 100% confidence still requires review');
 await button('Sonraki belirsiz öğe →').click();await page.getByLabel('Okunan değer',{exact:true}).fill('5');
 await button('Onayla ve ilerle').click();
 assert.ok(await page.getByRole('button',{name:'Hücre 1/1',exact:true}).getAttribute('class').then(x=>x.includes('reviewed')));
 assert.equal(await page.locator('.vefk-source-cell.reviewed').count(),1);
 assert.match(await page.locator('.vefk-source-selected-editor h4').textContent(),/1 \/ 2/);checks.push('cell correction, green overlay/check, queue decremented and next selected');
 await page.getByText('Toplu inceleme',{exact:true}).click();await button('Yüksek güvenlileri seç').click();await button('Seçilenleri onayla · 27').click();
 assert.equal(await page.locator('.vefk-source-cell.reviewed').count(),25);assert.equal(await page.getByLabel('Üretim yöntemi').locator('option[value=grid]').isDisabled(),true);checks.push('explicit selected bulk review; symbol cell blocks mathematical square');
 await page.screenshot({path:path.join(evidence,'review-1920.png')});
 await page.getByRole('button',{name:'Sembol Yıldız',exact:true}).click();
 await button('Maske').click();await page.locator('.vefk-source-picture image').nth(1).waitFor();
 await page.getByText('Mürekkep ve sınırlar',{exact:true}).click();await button('Maskeleri karşılaştır').click();assert.equal(await page.locator('.vefk-mask-comparison-options img').count(),3);
 await button('Doku dışla · 0').click();const box=await page.locator('.vefk-source-picture').boundingBox();
 await page.mouse.move(box.x+box.width*.438,box.y+box.height*.245);await page.mouse.down();await page.mouse.move(box.x+box.width*.458,box.y+box.height*.265);await page.mouse.up();
 await page.locator('.vefk-source-excluded-area').waitFor();assert.equal(await page.locator('.vefk-source-excluded-area').count(),1);
 await button('Çizgi çıkar').first().click();await page.locator('.vefk-source-trace.pending path').first().waitFor();checks.push('mask, comparison, texture exclusion and real local centerline tracing');
 await button('Konturları onayla').click();assert.equal(await page.locator('.vefk-source-trace.pending').count(),0);assert.ok(await page.locator('.vefk-source-trace.reviewed path').count()>0);
 await page.screenshot({path:path.join(evidence,'traced-1920.png')});
 await button('İncelemeyi kaydet →').click();
 await button('Çizimi oluştur →').click();await page.locator('.vefk-vector-surface:not([hidden]) .vefk-ink').first().waitFor();
 assert.equal(sources.latestAnalysis(db,source.id).result.grid.cells[2].text,'★');checks.push('contour approval, saved human review, explicit partial conversion on same viewport');
 await button('Kaydet').click();await page.getByRole('status').filter({hasText:'kaydedildi'}).waitFor();
 const saved=store.listDocuments(db)[0];assert.equal(store.sourceReview(db,saved.id).partialAccepted,true);
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:900,height:640},{width:680,height:580}]){
  await page.setViewportSize(viewport);
  await page.waitForFunction(()=>{const sheet=document.querySelector('.vefk-viewport-sheet').getBoundingClientRect();const view=document.querySelector('.vefk-artboard-scroll').getBoundingClientRect();return sheet.bottom<=view.bottom+1&&sheet.right<=view.right+1;});
  const metrics=await page.evaluate(()=>({body:document.body.scrollHeight,h:innerHeight,w:innerWidth,scroll:document.documentElement.scrollWidth,
    surface:document.querySelector('.vefk-viewport-sheet').getBoundingClientRect().toJSON(),viewport:document.querySelector('.vefk-artboard-scroll').getBoundingClientRect().toJSON()}));
  assert.ok(metrics.body<=metrics.h+1,JSON.stringify(metrics));assert.ok(metrics.scroll<=metrics.w+1,JSON.stringify(metrics));
  assert.ok(metrics.surface.height>140,JSON.stringify(metrics));assert.ok(metrics.surface.bottom<=metrics.viewport.bottom+1,JSON.stringify(metrics));
  await page.screenshot({path:path.join(evidence,`drawing-${viewport.width}.png`)});
 }
 checks.push('1920x1080, 1366x768, 900x640, 680x580: no page overflow and fitted canvas');
 await page.setViewportSize({width:1920,height:1080});
 const widthBefore=(await page.locator('.vefk-artboard-scroll').boundingBox()).width;await button('Koleksiyonu daralt').click();await button('Özellikleri daralt').click();
 assert.ok((await page.locator('.vefk-artboard-scroll').boundingBox()).width>widthBefore);await button('Koleksiyonu aç').click();await button('Özellikleri aç').click();
 await button('Büyüt').click();await button('Görünümü taşı').click();await button('Görünüme sığdır').click();await button('Görünümü taşı').click();checks.push('pan, zoom, fit and collapsed panel growth');
 await button('Önizle →').click();await button('Oynat').click();await page.waitForTimeout(300);await button('Duraklat').click();
 const time=300;await page.getByLabel('Çizim zamanında ileri geri sar',{exact:true}).fill(String(time));
 const doc=store.getDocument(db,saved.id).document;const frame=createVefkPlayer(doc).frameAt(time);
 assert.ok(Math.abs(Number(await page.locator('.vefk-ink').first().getAttribute('stroke-dashoffset'))-(1-frame.visibility[0].fraction))<1e-8);
 assert.equal(await page.locator('.vefk-pen-nib').getAttribute('transform'),`translate(${frame.pen.position.x} ${frame.pen.position.y})`);
 await page.screenshot({path:path.join(evidence,'preview-1920.png')});
 await button('Önizlemeyi doğrula →').click();await button('Onayla →').click();await button('Siteye hazırla →').click();await button('Paketi hazırla →').click();
 await page.getByRole('status').filter({hasText:'Yerel yayın paketi hazır'}).waitFor();assert.equal(publication.buildCatalog(db).entries.length,1);checks.push('timeline + canonical frame/nib, checked, approved, catalog, local export');
 await button('Yeni revizyon').click();await button('Kaydet').click();assert.equal(store.getDocument(db,saved.id).revision,2);assert.equal(publication.selected(db)[0].revision,1);
 await button('＋ Sıfırdan').click();await page.getByRole('textbox',{name:'Adı',exact:true}).fill('Yeni çizim');await button('Çalışmayı oluştur').click();await page.locator('[aria-labelledby=vefk-create-title]').waitFor({state:'hidden'});
 assert.equal(await page.locator('.vefk-ink').count(),0);await button('Çizgi',{exact:true}).click();
 const art=await page.locator('.vefk-artboard').boundingBox();await page.mouse.move(art.x+art.width*.2,art.y+art.height*.2);await page.mouse.down();await page.mouse.move(art.x+art.width*.8,art.y+art.height*.8);await page.mouse.up();
 await button('Seç / taşı').click();await page.locator('.vefk-ink').first().click();
 await page.getByLabel('Yol geometrisi',{exact:true}).fill('M 100 100 L 800 800');await page.getByLabel('Yol geometrisi',{exact:true}).press('Tab');
 await page.waitForFunction(()=>document.querySelector('.vefk-ink')?.getAttribute('d')==='M 100 100 L 800 800');
 await button('Sil').click();await page.waitForFunction(()=>document.querySelectorAll('.vefk-ink').length===0);assert.equal(await page.locator('.vefk-ink').count(),0);assert.equal(await button('Kaydet').isDisabled(),true);
 await button('Geri al').click();await page.locator('.vefk-ink').waitFor();assert.equal(await page.locator('.vefk-ink').count(),1);await page.locator('.vefk-ink').first().click();
 await page.getByLabel('Yol geometrisi',{exact:true}).fill('M 100 100 Q 800 800');await page.getByLabel('Yol geometrisi',{exact:true}).press('Tab');
 await page.getByRole('alert').waitFor();assert.equal(await page.locator('.vefk-ink').first().getAttribute('d'),'M 100 100 L 800 800');
 await button('Kaydet').click();assert.ok(store.listDocuments(db).find(item=>item.title==='Yeni çizim'));checks.push('new revision preserves catalog baseline, blank creation, path geometry, delete last path, undo, invalid SVG rejected, save');
 // Each destructive action goes through the collection menu and an explicit native dialog.
 await page.getByRole('button',{name:'Yeni çizim işlemleri',exact:true}).click();await button('Çoğalt').click();await page.getByRole('status').filter({hasText:'İşlem tamamlandı'}).waitFor();
 assert.ok(store.listDocuments(db).some(item=>item.title.includes('Kopya')));
 await page.getByRole('button',{name:'Yeni çizim işlemleri',exact:true}).click();await button('Yeniden adlandır').click();await page.getByLabel('Yeni ad',{exact:true}).fill('Yeni ad');await button('Adı kaydet').click();await page.getByRole('button',{name:'Yeni ad işlemleri',exact:true}).waitFor();
 await page.getByRole('button',{name:source.filename+' işlemleri',exact:true}).click();await button('Yalnız analizleri sil').click();assert.equal(sources.latestAnalysis(db,source.id),null);
 await page.getByRole('button',{name:source.filename+' işlemleri',exact:true}).click();await button('Görseli ve analizleri sil').click();assert.equal(sources.listSources(db).length,0);assert.ok(store.getDocument(db,saved.id));
 await page.getByRole('button',{name:saved.title+' işlemleri',exact:true}).click();await button('Belgeyi ve revizyonları sil').click();assert.equal(store.getDocument(db,saved.id),null);assert.equal(publication.selected(db).length,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 checks.push('copy, rename, delete analyses/source/document, catalog and FK integrity');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({status:'PASS',checks,errors,vision:'deterministic transport; real source photo and real raster tracing'},null,2));console.log(JSON.stringify({status:'PASS',checks},null,2));
}catch(error){console.error(error);throw error;}finally{await browser?.close();await server?.close();db.close();fs.rmSync(scratch,{recursive:true,force:true});}
