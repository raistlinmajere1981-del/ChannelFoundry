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
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok){online=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(online);
  const site=siteSceneSource(),source=await site.snapshot();
  const packet={type:'studio:load',scene:source.scene,siteSource:true,
    previewImage:await site.preview(source),previewObjects:site.previewObjects(source)};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
  await page.evaluate(message=>window.postMessage(message,'*'),packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects?.some(o=>o.veil?.enabled),null,{timeout:15000});
  await page.locator('#object-select-ceremonial-robe').click();
  const pane=page.locator('#robe-veil-settings');
  assert.equal(await pane.isVisible(),true);
  assert.equal(await page.locator('#visual-placement-settings').isVisible(),true);
  const robe=s=>s.objects.find(o=>o.id==='ceremonial-robe');
  const before=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.equal(robe(before).veil.enabled,true);
  await page.locator('#robe-veil-preview').click();
  const image=page.locator('#stage-object-ceremonial-robe [data-effect-layer="fabric"] img');
  const canvas=page.locator('#stage-object-ceremonial-robe canvas.scene-robe-preview-refraction');
  await page.waitForFunction(()=>{const n=document.querySelector('#stage-object-ceremonial-robe canvas');return n?.width>0&&n.height>0;},null,{timeout:6000});
  assert.equal(await image.evaluate(n=>n.style.opacity),String(robe(before).veil.residualOpacity));
  assert.match(await page.locator('#stage-object-ceremonial-robe').evaluate(n=>n.style.clipPath),/inset/);
  await page.locator('#robe-veil-distortionPx').fill('4.1');
  await page.locator('#robe-veil-distortionPx').press('Tab');
  await page.locator('#visual-y').fill(String((robe(before).pose.y+.012)*100));
  await page.locator('#visual-y').press('Tab');
  const after=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.equal(robe(after).veil.distortionPx,4.1);
  assert.ok(robe(after).pose.y>robe(before).pose.y+.011);
  assert.equal(site.readiness(after,source).ready,true);
  await page.locator('#robe-veil-preview').click();
  assert.equal(await image.evaluate(n=>n.style.opacity),'1');
  assert.deepEqual(errors,[]);
  console.log('PASS Studio veil preview, styling, setting change, visual alignment and site-stage acceptance');
}finally{await browser?.close();server.kill('SIGTERM');}
