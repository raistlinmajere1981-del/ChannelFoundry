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
  assert.ok(await page.locator('#add-visual-layer').count());
  await page.locator('#visual-layer-file').setInputFiles({name:'moving-piece.webp',mimeType:'image/webp',buffer:webp});
  await page.waitForFunction(()=>window.__sceneEditor.getScene().objects.some(o=>o.kind==='artwork'&&o.motionLayers.length===1));
  const attached=await page.evaluate(()=>window.__sceneEditor.getScene().objects.find(o=>o.kind==='artwork'));
  assert.equal(attached.visual.layers.length,1);
  assert.equal(attached.motionLayers[0],attached.visual.layers[0].id);
  assert.equal(await page.locator('#stage-object-'+created.id+' .scene-motion-fixed').evaluate(node=>node.style.filter),'none');
  await page.locator('[data-inspector-tab="effect"]').click();
  assert.ok(await page.locator('#add-effect').isVisible());
  assert.ok(await page.locator('#add-effect-type option[value="pendulum-sway"]').count());
  await page.locator('#add-effect-type').selectOption('pendulum-sway');
  await page.locator('#add-effect').click();
  await page.waitForFunction(()=>window.__sceneEditor.getScene().effects.length===23);
  const candidate=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.equal(site.readiness(candidate,source).ready,true,site.readiness(candidate,source).problems.join('\n'));
  await page.getByRole('button',{name:/^Kaydet/}).click();
  await page.waitForFunction(()=>window.__studioSceneSave?.scene?.objects?.length===15);
  const saved=await page.evaluate(()=>window.__studioSceneSave);
  assert.equal(saved.assets.length,2);
  assert.ok(saved.assets.some(asset=>asset.path===created.visual.asset));
  assert.ok(saved.assets.some(asset=>asset.path===attached.visual.layers[0].asset));
  assert.equal(site.validateAssets(saved.assets,source,saved.scene).length,2);
  const draft=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
  // Undo/redo must preserve both scene shape and its binary artwork revisions.
  await page.locator('#undo').click();
  assert.equal((await draft()).scene.effects.length,22);
  assert.equal((await draft()).assets.length,2);
  await page.locator('#undo').click();
  assert.equal((await draft()).scene.objects.find(o=>o.id===created.id).motionLayers.length,0);
  assert.equal((await draft()).assets.length,1);
  await page.locator('#redo').click();
  assert.equal((await draft()).scene.objects.find(o=>o.id===created.id).motionLayers.length,1);
  assert.equal((await draft()).assets.length,2);
  await page.locator('#redo').click();
  assert.equal((await draft()).scene.effects.length,23);
  await page.locator('#object-select-'+created.id).click();
  await page.locator('#duplicate-artwork').click();
  const duplicated=(await draft()).scene.objects.find(o=>o.kind==='artwork'&&o.id!==created.id);
  assert.ok(duplicated,'duplicated artwork must exist');
  assert.notEqual(duplicated.visual.asset,created.visual.asset,'images are independent');
  assert.notEqual(duplicated.visual.layers[0].asset,attached.visual.layers[0].asset);
  assert.equal((await draft()).assets.length,4);
  assert.equal((await draft()).scene.effects.length,24);
  await page.locator('#undo').click();
  assert.equal((await draft()).scene.objects.length,15);
  assert.equal((await draft()).assets.length,2);
  await page.locator('#redo').click();
  assert.equal((await draft()).scene.objects.length,16);
  assert.equal((await draft()).assets.length,4);
  await page.locator('#object-select-'+duplicated.id).click();
  await page.locator('#delete-artwork').click();
  assert.equal((await draft()).scene.objects.length,15);
  assert.equal((await draft()).assets.length,2);
  await page.locator('#undo').click();
  assert.equal((await draft()).scene.objects.length,16);
  assert.equal((await draft()).assets.length,4);
  await page.locator('#object-select-'+duplicated.id).click();
  await page.locator('#visual-layers-settings').evaluate(node=>{node.open=true;});
  await page.locator('.scene-layer-entry button.scene-danger').click();
  assert.equal((await draft()).scene.effects.length,23);
  assert.equal((await draft()).assets.length,3);
  await page.locator('#undo').click();
  assert.equal((await draft()).scene.effects.length,24);
  assert.equal((await draft()).assets.length,4);
  await page.locator('#object-select-'+duplicated.id).click();
  await page.locator('#visual-source-slot').selectOption(duplicated.visual.asset);
  const beforePixels=(await draft()).assets.find(a=>a.path===duplicated.visual.asset).dataUrl;
  const replacement=readFileSync(new URL('../../../channels/birdesengor/web/public/scene-assets/robe/ceremonial-kaftan.webp',import.meta.url));
  await page.locator('#visual-source-file').setInputFiles({name:'new-art.webp',mimeType:'image/webp',buffer:replacement});
  await page.waitForFunction(({path,previous})=>
    window.__sceneEditor.snapshot().assets.find(a=>a.path===path)?.dataUrl!==previous,
    {path:duplicated.visual.asset,previous:beforePixels},{timeout:15000});
  const afterPixels=(await draft()).assets.find(a=>a.path===duplicated.visual.asset).dataUrl;
  assert.notEqual(afterPixels,beforePixels);
  await page.locator('#undo').click();
  assert.equal((await draft()).assets.find(a=>a.path===duplicated.visual.asset).dataUrl,beforePixels);
  await page.locator('#redo').click();
  assert.equal((await draft()).assets.find(a=>a.path===duplicated.visual.asset).dataUrl,afterPixels);
  assert.equal(site.validateAssets((await draft()).assets,source,(await draft()).scene).length,4);
  await page.locator('#object-select-'+duplicated.id).click();
  await page.locator('#visual-layer-file').setInputFiles({name:'second-layer.webp',mimeType:'image/webp',buffer:webp});
  await page.waitForFunction(id=>window.__sceneEditor.getScene().objects.find(o=>o.id===id)?.motionLayers.length===2,
    duplicated.id,{timeout:15000});
  const order=(await draft()).scene.objects.find(o=>o.id===duplicated.id).motionLayers;
  await page.locator('#visual-layers-settings').evaluate(node=>{node.open=true;});
  await page.locator('.scene-layer-entry').nth(1).getByRole('button',{name:'Katmanı üste taşı'}).click();
  assert.deepEqual((await draft()).scene.objects.find(o=>o.id===duplicated.id).motionLayers,[order[1],order[0]]);
  await page.locator('#undo').click();
  assert.deepEqual((await draft()).scene.objects.find(o=>o.id===duplicated.id).motionLayers,order);
  await page.locator('#redo').click();
  assert.deepEqual((await draft()).scene.objects.find(o=>o.id===duplicated.id).motionLayers,[order[1],order[0]]);
  assert.equal((await draft()).assets.length,5);
  await page.locator('#object-select-'+duplicated.id).click();
  await page.locator('#hit-area-settings').evaluate(node=>{node.open=true;});
  await page.locator('#artwork-hit-enabled').check();
  assert.ok((await draft()).scene.objects.find(o=>o.id===duplicated.id).hitArea);
  await page.locator('#hit-inspector [data-testid="scene-hit-width"]').fill('12');
  await page.locator('#hit-inspector [data-testid="scene-hit-width"]').press('Tab');
  assert.equal((await draft()).scene.objects.find(o=>o.id===duplicated.id).hitArea.width,.12);
  await page.locator('#undo').click();
  assert.equal((await draft()).scene.objects.find(o=>o.id===duplicated.id).hitArea.width,duplicated.pose.width);
  await page.locator('#redo').click();
  assert.equal((await draft()).scene.objects.find(o=>o.id===duplicated.id).hitArea.width,.12);
  assert.equal(site.validateAssets((await draft()).assets,source,(await draft()).scene).length,5);
  assert.equal(site.readiness((await draft()).scene,source).ready,true);
  assert.deepEqual(errors,[]);
  console.log('PASS V4 artwork files, layers, effects, duplication, undo/redo, binary revisions and draft readiness');
}finally{await browser?.close();server.kill('SIGTERM');}
