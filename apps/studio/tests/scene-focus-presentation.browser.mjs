import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),origin='http://127.0.0.1:5297';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5297'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'scene Vite server: '+log);
 const site=siteSceneSource(),source=await site.snapshot();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
 await page.evaluate(packet=>window.postMessage(packet,'*'),{
   type:'studio:load',scene:source.scene,presentation:source.presentation,
   previewImage:await site.preview(source),previewObjects:site.previewObjects(source),
   focusTargets:site.focusTargets(source),siteSource:true,assets:[],
 });
 await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,{timeout:20000});
 const get=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
   const requestId='presentation-test-'+Math.random(),timeout=setTimeout(()=>reject(Error('get timeout')),6000);
   const listener=event=>{if(event.data?.requestId!==requestId||event.data.type!=='studio:data')return;
     clearTimeout(timeout);window.removeEventListener('message',listener);resolve(event.data);};
   window.addEventListener('message',listener);
   window.postMessage({type:'studio:get',requestId},'*');
 }));
 await page.locator('#object-select-camera').click();
 assert.equal(await page.locator('#focus-presentation-settings').isVisible(),true);
 await page.locator('#presentation-focusMs').fill('900');
 await page.locator('#presentation-focusMs').press('Tab');
 await page.locator('#presentation-device').selectOption('mobile');
 await page.locator('#presentation-nearZoom').fill('110');
 await page.locator('#presentation-nearZoom').press('Tab');
 await page.locator('#presentation-roomShiftX').fill('2');
 await page.locator('#presentation-roomShiftX').press('Tab');
 let draft=await get();
 assert.equal(draft.presentation.objects.camera.focusMs,900);
 assert.equal(draft.presentation.objects.camera.mobile.nearZoom,1.1);
 assert.equal(draft.presentation.objects.camera.mobile.roomShiftX,2);
 assert.equal(draft.presentation.objects.camera.desktop.nearZoom,1);
 assert.deepEqual(draft.scene,source.scene,'presentation does not alter scene objects/effects');
 assert.equal(site.readiness(draft.scene,source,draft.presentation).ready,true);
 await page.locator('#presentation-preview').click();
 assert.equal(await page.locator('#scene-viewport').evaluate(n=>n.classList.contains('presentation-preview')),true);
 assert.match(await page.locator('#scene-photo').evaluate(n=>n.style.transform),/scale\(/);
 await page.locator('#undo').click();
 draft=await get();
 assert.equal(draft.presentation.objects.camera.mobile.roomShiftX,0);
 assert.equal(draft.presentation.objects.camera.mobile.nearZoom,1.1);
 await page.locator('#redo').click();
 draft=await get();
 assert.equal(draft.presentation.objects.camera.mobile.roomShiftX,2);
 await page.locator('#presentation-device').selectOption('desktop');
 assert.equal(await page.locator('#presentation-nearZoom').inputValue(),'100');
 await page.locator('#presentation-reset').click();
 draft=await get();
 assert.deepEqual(draft.presentation.objects.camera,source.presentation.objects.camera);
 await page.locator('#object-select-stone-specimen').click();
 assert.equal(await page.locator('#focus-presentation-settings').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('PASS four-object focus presentation controls, desktop/mobile isolation, preview, undo/redo and reset');
}finally{await browser?.close();server.kill('SIGTERM');}
