import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
const origin='http://127.0.0.1:5293';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5293'],{
  cwd:new URL('..',import.meta.url).pathname,stdio:'pipe'});
let browser;
try{
  let online=false;
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok){online=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(online,'Studio Vite unavailable');
  const site=siteSceneSource(),snapshot=await site.snapshot();
  const previewObjects=site.previewObjects(snapshot);
  const item=previewObjects.find(o=>o.objectId==='archive-chest');
  assert.ok(item?.image?.startsWith('data:image/webp;base64,'));
  assert.ok(item.lightMask?.startsWith('data:image/webp;base64,'));
  assert.deepEqual(item.layers.map(layer=>layer.id),['lid']);
  const packet={type:'studio:load',scene:snapshot.scene,siteSource:true,
    previewImage:await site.preview(snapshot),previewObjects};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
  await page.evaluate(message=>window.postMessage(message,'*'),packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,null,{timeout:15000});
  await page.locator('#object-select-archive-chest').click();
  assert.equal(await page.locator('#visual-placement-settings').isVisible(),true);
  const lid=page.locator('#stage-object-archive-chest [data-effect-layer="lid"]');
  assert.equal(await lid.count(),1);
  const size=await lid.evaluate(n=>parseFloat(n.style.width));
  assert.equal(size,150,'editor preview matches right-edge material crop');
  await page.locator('#effect-select-archive-chest-lid-open').click();
  assert.equal(await page.locator('.scene-effect-title').innerText(),'Sandık aralanması');
  await page.locator('#preview-pulse').click();
  await page.waitForFunction(()=>document.querySelector('#stage-object-archive-chest [data-effect-layer="lid"]')?.style.transform.includes('rotateX('),
    null,{timeout:1600});
  await page.locator('#effect-select-archive-chest-light-leak').click();
  assert.equal(await page.locator('.scene-effect-title').innerText(),'İçeriden ışık');
  await page.locator('#preview-pulse').click();
  const canvas=page.locator('#stage-object-archive-chest canvas.object-effect-overlay');
  await canvas.waitFor({state:'attached',timeout:3500});
  const paint=await canvas.evaluate(n=>({mask:getComputedStyle(n).maskImage,width:n.width,height:n.height,pointer:getComputedStyle(n).pointerEvents}));
  assert.match(paint.mask,/^url\("data:image\/webp;base64,/);
  assert.ok(paint.width>0&&paint.height>0);
  assert.equal(paint.pointer,'none');
  const original=await page.evaluate(()=>window.__sceneEditor.getScene());
  const chest=s=>s.objects.find(o=>o.id==='archive-chest');
  await page.locator('#visual-y').fill(String((chest(original).pose.y+.013)*100));
  await page.locator('#visual-y').press('Tab');
  const edited=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.ok(chest(edited).pose.y>chest(original).pose.y+.012);
  assert.ok(chest(edited).hitArea.y>chest(original).hitArea.y+.012);
  assert.equal(site.readiness(edited,snapshot).ready,true,'site accepts movable chest in authored JSON');
  const invalid=structuredClone(edited);
  invalid.objects.find(o=>o.id==='guardian-sword-right').pose.x+=.01;
  assert.equal(site.readiness(invalid,snapshot).ready,false,'other objects stay locked');
  await page.locator('#visual-reset').click();
  assert.deepEqual(chest(await page.evaluate(()=>window.__sceneEditor.getScene())).pose,chest(original).pose);
  assert.deepEqual(errors,[]);
  console.log('PASS Studio chest two controls, motion, light mask, visual placement, stage validation');
}finally{await browser?.close();server.kill('SIGTERM');}
