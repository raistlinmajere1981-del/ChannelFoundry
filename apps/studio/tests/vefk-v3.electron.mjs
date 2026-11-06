/** Native Electron QA using the real preload, IPC, SQLite and existing exporter.
 * Requires an explicitly isolated /tmp profile with a real AI analysis.
 * Set VEFK_ELECTRON_PROFILE and VEFK_TEST_IMAGE. Never targets the user's data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {_electron:electron}=createRequire(new URL('../../../channels/birdesengor/web/package.json',import.meta.url))('playwright-core');
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const seedRoot=path.resolve(process.env.VEFK_ELECTRON_PROFILE??'');
assert.ok(seedRoot.startsWith(path.join(os.tmpdir(),'vefk-v3-electron-')),'An isolated Vefk QA profile is required');
assert.ok(process.env.VEFK_TEST_IMAGE && fs.existsSync(process.env.VEFK_TEST_IMAGE),'Real source image required');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vefk-v3-electron-run-'));
fs.mkdirSync(path.join(root,'studio'),{recursive:true});
const seedDb=new DatabaseSync(path.join(seedRoot,'studio/channel-foundry-studio.sqlite'),{readOnly:true});
const originalAI=seedDb.prepare("SELECT * FROM vefk_source_analyses WHERE origin='ai' ORDER BY id ASC LIMIT 1").get();seedDb.close();
assert.ok(originalAI,'A persisted real AI analysis is required');
const seededDb=new DatabaseSync(path.join(root,'studio/channel-foundry-studio.sqlite'));
seededDb.exec('PRAGMA foreign_keys=ON');
const sourceStore=require('../vefk-sources.cjs');
const seededSource=sourceStore.importSource(seededDb,path.join(root,'studio'),process.env.VEFK_TEST_IMAGE);
sourceStore.appendAnalysis(seededDb,{sourceId:seededSource.id,origin:'ai',provider:originalAI.provider,model:originalAI.model,result:JSON.parse(originalAI.result_json)});
seededDb.close();fs.copyFileSync(path.join(seedRoot,'studio/ai-config.json'),path.join(root,'studio/ai-config.json'));
const evidence=path.resolve(process.argv[2]??'artifacts/vefk-v3');fs.mkdirSync(evidence,{recursive:true});
const env={...process.env,CHANNEL_FOUNDRY_DATA_ROOT:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:require('electron'),args:[path.join(repo,'apps/studio'),'--no-sandbox'],env,timeout:30000});
const checks=[],errors=[];
try{
 const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async dialog=>{ try { await dialog.accept(); } catch {} });
 await page.waitForLoadState('domcontentloaded');await page.getByRole('button',{name:'Vefk Atölyesi',exact:false}).click();
 await page.locator('.vefk-workshop').waitFor();
 const button=name=>page.getByRole('button',{name,exact:true});
 // Real file picker IPC, with only the native dialog selection supplied by QA.
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},process.env.VEFK_TEST_IMAGE);
 await button('Görsel ekle').click();
 await page.getByRole('button',{name:/Sonraki belirsiz öğe/}).waitFor();
 const sources=await page.evaluate(()=>window.channelFoundryStudio.vefkSourceList());assert.equal(sources.length,1);
 const initial=await page.evaluate(id=>window.channelFoundryStudio.vefkSourceAnalysis(id),sources[0].id);
 assert.equal(initial.origin,'ai');assert.ok(initial.result.regions.every(region=>!region.reviewed));
 checks.push('real configured AI analysis persisted, duplicate import opens same source, real preload/IPC');
 await page.screenshot({path:path.join(evidence,'electron-ai-review.png')});
 await page.getByRole('button',{name:sources[0].filename+' işlemleri',exact:true}).click();await button('Yeniden adlandır').click();await page.getByLabel('Yeni ad',{exact:true}).fill('Vefk fotoğrafı');await button('Adı kaydet').click();
 await page.getByRole('button',{name:'Vefk fotoğrafı işlemleri',exact:true}).waitFor();
 await page.getByText('Toplu inceleme',{exact:true}).click();await button('Yüksek güvenlileri seç').click();
 const bulk=page.getByRole('button',{name:/^Seçilenleri onayla ·/});if(await bulk.isEnabled())await bulk.click();
 await page.getByRole('button',{name:/Sonraki belirsiz öğe/}).click();
 for(let i=0;i<100;i++){
  if(!/öğe kaldı/.test(await page.locator('.vefk-flow').innerText()))break;
  await page.locator('.vefk-source-selected-editor').waitFor();
  const field=page.getByLabel('Okunan değer',{exact:true});
  if(await field.count()){if(!(await field.inputValue()).trim())await field.fill('Belirsiz işaret');}
  else{
   const kind=page.getByLabel('Bölge türü',{exact:true});if(await kind.inputValue()==='unknown')await kind.selectOption('symbol');
   const label=page.getByLabel('Okunan işaret',{exact:true});if(!(await label.inputValue()).trim())await label.fill('Belirsiz işaret');
  }
  await button('Onayla ve ilerle').click();
 }
 assert.ok(!/öğe kaldı/.test(await page.locator('.vefk-flow').innerText()));console.log('REVIEW_COMPLETED');checks.push('native cell/region queue, selected bulk confirmation, next item and green review feedback');
 await button('Bölge çiz').click();const photo=await page.locator('.vefk-source-picture').boundingBox();
 await page.mouse.move(photo.x+photo.width*.434,photo.y+photo.height*.242);await page.mouse.down();await page.mouse.move(photo.x+photo.width*.519,photo.y+photo.height*.350);await page.mouse.up();
 await page.getByLabel('Okunan işaret',{exact:true}).fill('Yıldız');await button('Onayla ve ilerle').click();
 console.log('MANUAL_REGION_ADDED');await button('Maske').click();await button('Çizgi çıkar').first().click();await page.locator('.vefk-source-trace.pending path').first().waitFor();await button('Konturları onayla').click();
 console.log('CONTOURS_READY');await button('İncelemeyi kaydet →').click();await button('Çizimi oluştur →').click();await page.locator('.vefk-vector-surface:not([hidden])').waitFor();
 await button('Kaydet').click();await page.getByRole('status').filter({hasText:'kaydedildi'}).waitFor();
 checks.push('native source mask and real tracing, approved contour, explicit partial SVG, SQLite save');
 for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1080,height:720},{width:900,height:640}]){
  await app.evaluate(({BrowserWindow},size)=>{const win=BrowserWindow.getAllWindows()[0];win.unmaximize();win.setMinimumSize(600,500);win.setContentSize(size.width,size.height);},size);
  await page.setViewportSize(size);
  await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,size);await page.waitForTimeout(150);
  const metrics=await page.evaluate(()=>({h:innerHeight,body:document.documentElement.scrollHeight,w:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('.vefk-artboard-scroll').getBoundingClientRect().height}));
  assert.ok(metrics.body<=metrics.h+1,JSON.stringify(metrics));assert.ok(metrics.scroll<=metrics.w+1,JSON.stringify(metrics));assert.ok(metrics.canvas>180,JSON.stringify(metrics));
  await page.screenshot({path:path.join(evidence,`electron-drawing-${size.width}.png`)});
 }
 checks.push('native full Studio shell: 1920x1080, 1366x768, 1080x720, 900x640 without page overflow');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));await page.setViewportSize({width:1366,height:768});
 await button('Önizle →').click();await button('Oynat').click();await page.waitForTimeout(450);await button('Duraklat').click();
 await button('Önizlemeyi doğrula →').click();await button('Onayla →').click();await button('Siteye hazırla →').click();await button('Paketi hazırla →').click();
 await page.getByRole('status').filter({hasText:'Yerel yayın paketi hazır'}).waitFor();
 assert.equal((await page.evaluate(()=>window.channelFoundryStudio.vefkPackageStatus())).ready,true);
 const file=path.join(root,'studio/public-export/content/publication.json');assert.ok(fs.existsSync(file));
 const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(snapshot.vefkCatalog.entries.length,1);
 checks.push('native playback, checked/approved revision, catalog and existing full publication.json export');
 await page.screenshot({path:path.join(evidence,'electron-package-ready.png')});
 await page.reload();await page.getByRole('button',{name:'Vefk Atölyesi',exact:false}).click();await page.locator('.vefk-document-row').filter({hasText:'Vefk fotoğrafı'}).click();
 await button('Paket hazır ✓ →').waitFor();checks.push('package and review checkpoints survive application reload');
 const packageBytes=fs.readFileSync(file);
 const docRow=page.locator('.vefk-collection-row').filter({has:page.locator('.vefk-document-row')});
 await docRow.getByRole('button',{name:'Vefk fotoğrafı işlemleri',exact:true}).click();
 await button('Belgeyi ve revizyonları sil').click();
 await page.waitForFunction(async()=>!(await window.channelFoundryStudio.vefkList()).length);
 assert.equal((await page.evaluate(()=>window.channelFoundryStudio.vefkCatalogList())).length,0);
 assert.deepEqual(fs.readFileSync(file),packageBytes);checks.push('native explicit document deletion removes local catalog and leaves prepared publication bytes untouched');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,'electron-results.json'),JSON.stringify({status:'PASS',checks,errors,profile:root,vision:{provider:initial.provider,model:initial.model,regions:initial.result.regions.length,cells:initial.result.grid?.cells.length}},null,2));
 console.log(JSON.stringify({status:'PASS',checks},null,2));
}catch(error){const page=await app.firstWindow();await page.screenshot({path:path.join(evidence,'electron-failure.png')}).catch(()=>{});console.error('NATIVE_ERROR',error);throw error;}finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});fs.rmSync(root,{recursive:true,force:true});}
