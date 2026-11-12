import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
const origin='http://127.0.0.1:5298',server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5298'],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,`Vite unavailable: ${log}`);
 const site=siteSceneSource(),source=await site.snapshot();
 const packet={scene:source.scene,presentation:source.presentation,previewImage:await site.preview(source),previewObjects:site.previewObjects(source),previewArt:site.previewArt?.(source)??[],roomObjects:site.roomObjects?.(source)??[],focusTargets:site.focusTargets?.(source)??[],assets:[],sourceHash:source.sourceHash,readiness:site.readiness(source.scene,source),note:'Güncel site sahnesi açıldı.'};
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:900}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.stack);console.log('PAGE ERROR',e.stack)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE ERROR',m.text())});
 await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(data=>{
   window.__sceneV3Packet=data;
   window.__studioSceneSave=null;
   window.channelFoundryStudio={
      sceneWorkshopLoad:()=>Promise.resolve(data),
      sceneWorkshopSave:async payload=>{window.__studioSceneSave=payload;return {sourceHash:data.sourceHash,readiness:data.readiness,message:'Yerel taslak kaydedildi.'};},
      onSceneWorkshopProgress:()=>()=>{},
   };
   window.__mountStudioSceneV3();
 },packet);
 await page.waitForFunction(()=>document.querySelectorAll('.scene-tree-object').length===14,undefined,{timeout:8500}).catch(async e=>{console.log('ROOT HTML',String(await page.locator('body').innerText()).slice(0,1600));console.log('ROOT COUNTS',await page.evaluate(()=>({root:!!document.querySelector('.scene-editor-root'), tree:!!document.querySelector('#object-list'), html:document.querySelector('#object-list')?.innerHTML.slice(0,1000), error:document.querySelector('.scene-workshop-status')?.innerText})));throw e});
 assert.equal(await page.locator('iframe').count(),0,'no iframe in Studio scene module');
 assert.equal(await page.locator('.scene-tree-effect').count(),22,'effect rows nested under object tree');
 assert.equal(await page.locator('#scene-photo').evaluate(n=>n.hidden),false);
 assert.equal(await page.locator('#scene-room-objects [data-room-object]').count()>0,true,'book/camera/vefk room objects render');
 const selection=page.locator('#object-select-camera');await selection.click();
 assert.equal(await page.locator('[data-inspector-tab="focus"]').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#focus-presentation-settings').isVisible(),true);
 await page.locator('#presentation-focusMs').fill('910');await page.locator('#presentation-focusMs').press('Tab');
 await page.getByRole('button',{name:/^Kaydet/}).click();
 await page.waitForFunction(()=>window.__studioSceneSave?.presentation?.objects?.camera?.focusMs===910,{timeout:15000});
 assert.equal(await page.evaluate(()=>window.__studioSceneSave.scene.effects.length),22);
 await selection.click({button:'right'});
 assert.equal(await page.locator('#scene-context-menu').isVisible(),true);
 assert.match(await page.locator('#scene-context-menu').innerText(),/Kamera|Özellikler/);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#scene-context-menu').isVisible(),false);
 const stage=page.locator('.scene-stage-well');const widthBefore=(await stage.boundingBox()).width;
 await page.locator('#scene-toggle-tree').click();
 assert.equal(await page.locator('#library-panel').isVisible(),false);
 assert.ok((await stage.boundingBox()).width>widthBefore+100,'canvas expands when tree hidden');
 await page.locator('#scene-toggle-tree').click();
 assert.equal(await page.locator('#library-panel').isVisible(),true);
 assert.deepEqual(errors,[],'no JS console errors');
 await page.screenshot({path:'/tmp/scene-v3-browser.png',fullPage:true});
 console.log('PASS Studio V3 direct React module, 14 tree nodes, 22 nested effects, real room artwork, contextual focus, saved presentation, right-click, panels; no iframe');
}finally{await browser?.close();server.kill('SIGTERM');}
