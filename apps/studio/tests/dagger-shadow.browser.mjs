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
  const site=siteSceneSource(),snapshot=await site.snapshot();
  const previews=site.previewObjects(snapshot);
  const daggerPreview=previews.find(p=>p.objectId==='ceremonial-dagger');
  assert.match(daggerPreview.bladeMask,/^data:image\/webp;base64,/);
  const packet={type:'studio:load',scene:snapshot.scene,siteSource:true,
    previewImage:await site.preview(snapshot),previewObjects:previews};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
  await page.evaluate(message=>window.postMessage(message,'*'),packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,null,{timeout:15000});
  await page.locator('#object-select-ceremonial-dagger').click();
  assert.equal(await page.locator('#visual-placement-settings').isVisible(),true);
  assert.equal(await page.locator('#stage-object-ceremonial-dagger [data-effect-layer="blade"] img').count(),1);
  const original=await page.evaluate(()=>window.__sceneEditor.getScene());
  const dagger=s=>s.objects.find(o=>o.id==='ceremonial-dagger');
  await page.locator('#effect-select-ceremonial-dagger-shadow').click();
  assert.equal(await page.locator('.scene-effect-title').innerText(),'Yabancı yansıma');
  const preview=page.locator('#preview-pulse');
  assert.equal(await preview.isEnabled(),true);
  await preview.click();
  const canvas=page.locator('#stage-object-ceremonial-dagger canvas.object-effect-overlay');
  await canvas.waitFor({state:'attached',timeout:3000});
  const properties=await canvas.evaluate(c=>({mask:getComputedStyle(c).maskImage,
    overlayAlpha:getComputedStyle(c).pointerEvents,width:c.width,height:c.height}));
  assert.match(properties.mask,/^url\("data:image\/webp;base64,/);
  assert.equal(properties.overlayAlpha,'none');
  await page.waitForFunction(()=>{
    const c=document.querySelector('#stage-object-ceremonial-dagger canvas.object-effect-overlay');
    if(!c)return false;
    const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let count=0;for(let i=3;i<px.length;i+=4)if(px[i]>0)count++;
    return count>30;
  },null,{timeout:2200});
  await page.locator('#visual-y').fill(String((dagger(original).pose.y-.02)*100));
  await page.locator('#visual-y').press('Tab');
  const edited=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.ok(dagger(edited).pose.y<dagger(original).pose.y-.019);
  assert.ok(dagger(edited).hitArea.y<dagger(original).hitArea.y-.019);
  assert.equal(site.readiness(edited,snapshot).ready,true,'site staging accepts independent dagger placement');
  const frozen=structuredClone(edited);
  frozen.objects.find(o=>o.id==='guardian-sword-left').pose.y+=.01;
  assert.equal(site.readiness(frozen,snapshot).ready,false,'unrelated static sword pose remains locked');
  await page.locator('#visual-reset').click();
  assert.deepEqual(dagger((await page.evaluate(()=>window.__sceneEditor.getScene()))).pose,dagger(original).pose);
  assert.deepEqual(errors,[]);
  console.log('PASS Studio dagger physical art, masked pulse, position+hit-area and publication checks');
}finally{await browser?.close();server.kill('SIGTERM');}
