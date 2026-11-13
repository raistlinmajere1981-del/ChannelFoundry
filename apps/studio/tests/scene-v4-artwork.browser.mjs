import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
const site=siteSceneSource(),source=await site.snapshot();
const packet={scene:source.scene,presentation:source.presentation,previewImage:await site.preview(source),
  previewObjects:site.previewObjects(source),previewArt:site.previewArt(source),roomObjects:site.roomObjects(source),
  focusTargets:site.focusTargets(source),assets:[],sourceHash:source.sourceHash,
  readiness:site.readiness(source.scene,source),note:'V4 test sahnesi'};
const port=5293,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port',String(port)],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',buf=>log+=buf);server.stderr.on('data',buf=>log+=buf);
let browser;
try{
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'Vite did not start '+log);
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1580,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{
    window.__sceneV3Packet=data;window.__studioSceneSave=null;
    window.channelFoundryStudio={
      sceneWorkshopLoad:async()=>data,
      sceneWorkshopSave:async payload=>{window.__studioSceneSave=payload;return {sourceHash:data.sourceHash,readiness:data.readiness,message:'Kaydedildi'};},
      onSceneWorkshopProgress:()=>()=>{},
    };
    window.__mountStudioSceneV3();
  },packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14);
  assert.equal(await page.locator('.scene-tree-group').count(),1,'no site-specific hardcoded categories');
  const webp=readFileSync(new URL('../../../channels/birdesengor/web/public/scene-assets/stone/jade-rock.webp',import.meta.url));
  await page.locator('#new-artwork-file').setInputFiles({name:'v4-artwork.webp',mimeType:'image/webp',buffer:webp});
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===15,{timeout:12000});
  assert.equal(await page.locator('#visual-source-settings').isVisible(),true);
  assert.equal(await page.locator('#visual-crop-settings').isVisible(),true);
  assert.equal(await page.locator('#visual-source-export').isVisible(),true);
  const download=page.waitForEvent('download');
  await page.locator('#visual-source-export').click();
  assert.match((await download).suggestedFilename(),/\.webp$/);
  await page.locator('#object-group').fill('Yeni grup');
  await page.locator('#object-group').press('Tab');
  assert.ok(await page.locator('[data-tree-group="Yeni grup"]').count());
  const sceneBefore=await page.evaluate(()=>window.__sceneEditor.getScene());
  const created=sceneBefore.objects.find(o=>o.kind==='artwork');
  assert.ok(created?.visual.asset.startsWith('/scene-assets/custom/'));
  await page.locator('[data-inspector-tab="effect"]').click();
  assert.ok(await page.locator('#add-effect').isVisible());
  await page.locator('#add-effect-type').selectOption('glow');
  await page.locator('#add-effect').click();
  await page.waitForFunction(()=>window.__sceneEditor.getScene().effects.length===23);
  const candidate=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.equal(site.readiness(candidate,source).ready,true,site.readiness(candidate,source).problems.join('\n'));
  await page.getByRole('button',{name:/^Kaydet/}).click();
  await page.waitForFunction(()=>window.__studioSceneSave?.scene?.objects?.length===15);
  const saved=await page.evaluate(()=>window.__studioSceneSave);
  assert.equal(saved.assets.length,1);
  assert.equal(saved.assets[0].path,created.visual.asset);
  assert.equal(site.validateAssets(saved.assets,source,saved.scene).length,1);
  assert.deepEqual(errors,[]);
  console.log('PASS V4 image file import, generic object, group, export, effect, draft save and readiness');
}finally{await browser?.close();server.kill('SIGTERM');}
