import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const origin='http://127.0.0.1:5293';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5293'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try {
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const site=siteSceneSource(), source=await site.snapshot();
  const packet={type:'studio:load',scene:source.scene,siteSource:true,
    previewImage:await site.preview(source),previewObjects:site.previewObjects(source)};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
  await page.evaluate(message=>window.postMessage(message,'*'),packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,{timeout:20000});
  await page.locator('#object-select-stone-specimen').click();
  assert.equal(await page.locator('#visual-placement-settings').isVisible(),true);
  assert.equal(await page.locator('#visual-linked').isChecked(),true);
  const snapshot=await page.evaluate(()=>window.__sceneEditor.getScene());
  const stone=obj=>obj.objects.find(o=>o.id==='stone-specimen');
  const effects=obj=>obj.effects.filter(e=>e.target.objectId==='stone-specimen');
  const point=(o,e)=>{const a=o.anchors.find(a=>a.id===e.target.anchorId);return [o.pose.x+(a.x+e.target.offset.x)*o.pose.width,o.pose.y+(a.y+e.target.offset.y)*o.pose.height];};
  assert.equal(await page.locator('#zoom-fit').innerText(),'100%');
  const w1=await page.locator('#scene-viewport').evaluate(n=>n.getBoundingClientRect().width);
  await page.locator('#zoom-in').click();
  assert.equal(await page.locator('#zoom-fit').innerText(),'125%');
  assert.ok((await page.locator('#scene-viewport').evaluate(n=>n.getBoundingClientRect().width))>w1*1.23);
  await page.locator('#visual-y').fill(String((stone(snapshot).pose.y+.014)*100));
  await page.locator('#visual-y').press('Tab');
  const edited=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.ok(stone(edited).pose.y>stone(snapshot).pose.y+.013);
  assert.ok(stone(edited).hitArea.y>stone(snapshot).hitArea.y+.013);
  assert.ok(point(stone(edited),effects(edited)[0])[1]>point(stone(snapshot),effects(snapshot)[0])[1]+.013);
  await page.locator('#visual-scale').fill('120');
  await page.locator('#visual-scale').press('Tab');
  const scaled=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.ok(stone(scaled).pose.width>stone(snapshot).pose.width*1.19);
  assert.ok(stone(scaled).pose.height>stone(snapshot).pose.height*1.19);
  await page.locator('#visual-linked').uncheck();
  const beforeUnlinked=await page.evaluate(()=>window.__sceneEditor.getScene());
  await page.locator('#visual-x').fill(String((stone(beforeUnlinked).pose.x+.01)*100));
  await page.locator('#visual-x').press('Tab');
  const unlinked=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.equal(stone(unlinked).hitArea.x,stone(beforeUnlinked).hitArea.x);
  for(let i=0;i<effects(unlinked).length;i++){
    const beforePoint=point(stone(beforeUnlinked),effects(beforeUnlinked)[i]);
    const afterPoint=point(stone(unlinked),effects(unlinked)[i]);
    assert.ok(Math.abs(beforePoint[0]-afterPoint[0])<.0001);
    assert.ok(Math.abs(beforePoint[1]-afterPoint[1])<.0001);
  }
  await page.locator('#visual-linked').check();
  await page.locator('#visual-edit-mode').click();
  assert.equal(await page.locator('#visual-edit-mode').getAttribute('aria-pressed'),'true');
  const obj=page.locator('#stage-object-stone-specimen');
  await obj.scrollIntoViewIfNeeded();
  const rect=await obj.boundingBox();
  assert.ok(rect);
  assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,
    {x:rect.x+rect.width/2,y:rect.y+rect.height/2}),'stage-object-stone-specimen');
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2+16,rect.y+rect.height/2+14,{steps:4});
  await page.mouse.up();
  const dragged=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.ok(stone(dragged).pose.x>stone(unlinked).pose.x);
  assert.ok(stone(dragged).pose.y>stone(unlinked).pose.y);
  await page.locator('#zoom-fit').click();
  assert.equal(await page.locator('#zoom-fit').innerText(),'100%');
  await page.locator('#visual-reset').click();
  const reset=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.deepEqual(stone(reset).pose,stone(snapshot).pose);
  assert.equal(site.readiness(dragged,source).ready,true);
  assert.deepEqual(errors,[]);
  console.log('PASS site visual placement, link on/off, zoom, drag, reset and publish validation');
} finally {await browser?.close();server.kill('SIGTERM');}
