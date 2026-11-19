import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {deviceStageHit} from '../src/scene-workspace/scene-room-geometry.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const url='http://127.0.0.1:5346';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5346'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',d=>log+=String(d));server.stderr.on('data',d=>log+=String(d));
let browser;
try {
 let ready=false;
 for(let i=0;i<150;i++){try{if((await fetch(url+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Studio failed: '+log);
 const site=siteSceneSource(),source=await site.snapshot();
 const packet={scene:source.scene,presentation:source.presentation,roomObjects:site.roomObjects(source),
  previewImage:await site.preview(source),background:site.backgroundInfo(source),
  previewObjects:site.previewObjects(source),objectVisuals:site.objectVisuals(source),previewArt:site.previewArt(source),
  focusTargets:site.focusTargets(source),assets:[],siteSource:true,readiness:site.readiness(source.scene,source),
  sourceHash:source.sourceHash};
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(data=>{window.channelFoundryStudio={sceneWorkshopLoad:async()=>data,sceneWorkshopSave:async()=>({sourceHash:data.sourceHash,readiness:data.readiness}),onSceneWorkshopProgress:()=>()=>{}};window.__mountStudioSceneV3();},packet);
 await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.some(e=>e.id==='community-journal-tree-hover'),null,{timeout:25000});
 const get=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
 const update=async(id,val)=>{await page.locator(id).fill(String(val));await page.locator(id).press('Tab');};
 const hit=data=>data.scene.objects.find(o=>o.id==='community-journal').hitArea;
 const book=data=>data.presentation.objects['community-journal'].closedBook;
 await page.locator('#object-select-community-journal').click();
 await page.locator('#visual-edit-mode').click();
 assert.equal(await page.locator('#book-area-x').count(),1);
 assert.equal(await page.locator('#visual-linked').isChecked(),true);
 const original=await get();
 const x=Number(await page.locator('#book-area-x').inputValue());
 await update('#book-area-x',x+1);
 let current=await get();
 assert.ok(book(current).x>book(original).x+.009);
 assert.ok(hit(current).x>hit(original).x,'linked click area follows book position');
 await page.locator('#visual-linked').uncheck();
 const y=Number(await page.locator('#book-area-y').inputValue());
 await update('#book-area-y',y+.8);
 let unlinked=await get();
 assert.ok(book(unlinked).y>book(current).y+.007);
 assert.deepEqual(hit(unlinked),hit(current),'independent book movement leaves hit untouched');
 await page.locator('#hit-edit-mode').click();
 await page.locator('#hit-linked').check();
 const hx=Number(await page.locator('[data-testid="scene-hit-x"]').inputValue());
 await update('[data-testid="scene-hit-x"]',hx+.5);
 current=await get();
 assert.ok(hit(current).x>hit(unlinked).x+.004,'click moved');
 assert.ok(book(current).x>book(unlinked).x,'linked book responds to hit edit');
 await page.locator('#hit-linked').uncheck();
 const hy=Number(await page.locator('[data-testid="scene-hit-y"]').inputValue());
 await update('[data-testid="scene-hit-y"]',hy+.5);
 unlinked=await get();
 assert.ok(hit(unlinked).y>hit(current).y+.004);
 assert.deepEqual(book(unlinked),book(current),'independent click edit leaves book untouched');
 await page.locator('#visual-edit-mode').click();
 assert.equal(await page.locator('[data-room-object="community-journal"] [data-room-corner]').count(),4);
 const b=await page.locator('[data-room-object="community-journal"] [data-room-corner="se"]').boundingBox();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
 await page.mouse.down();
 await page.mouse.move(b.x+b.width/2+8,b.y+b.height/2+6,{steps:6});
 await page.mouse.up();
 const resized=await get();
 assert.ok(book(resized).width>book(unlinked).width,'corner resize updates canonical book width');
 assert.deepEqual(hit(resized),hit(unlinked),'independent resize preserves click boundary');
 await page.screenshot({path:'/tmp/bdsg-book-areas-editor.png'});
 await page.locator('#object-select-camera').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#device-area-x').count(),1);
 const position=data=>data.presentation.objects.camera.roomPlacement;
 const initialDevice=await get();
 const originalStageHit=deviceStageHit(initialDevice.presentation,'camera',
   initialDevice.scene.objects.find(o=>o.id==='camera').hitArea);
 await page.locator('#visual-linked').uncheck();
 const cx=Number(await page.locator('#device-area-x').inputValue());
 await update('#device-area-x',cx+.5);
 const separated=await get();
 assert.ok(position(separated).x>position(initialDevice).x+.004);
 const separateHit=deviceStageHit(separated.presentation,'camera',
   separated.scene.objects.find(o=>o.id==='camera').hitArea);
 assert.ok(Math.abs(originalStageHit.x-separateHit.x)<.00001,'separated device leaves hit box in place');
 await page.locator('#visual-linked').check();
 const scale=Number(await page.locator('#device-area-scale').inputValue());
 await update('#device-area-scale',scale+4);
 const scaled=await get();
 assert.ok(position(scaled).scale>position(separated).scale+.03,'device scale adjustable');
 const scaledHit=deviceStageHit(scaled.presentation,'camera',
   scaled.scene.objects.find(o=>o.id==='camera').hitArea);
 assert.ok(scaledHit.width>separateHit.width,'linked device scale follows click region');
 assert.equal(await page.locator('[data-room-object="camera"] [data-room-corner]').count(),4);
 const handle=await page.locator('[data-room-object="camera"] [data-room-corner="se"]').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);
 await page.mouse.down();
 await page.mouse.move(handle.x+handle.width/2+8,handle.y+handle.height/2+6,{steps:5});
 await page.mouse.up();
 const deviceResize=await get();
 assert.ok(position(deviceResize).scale>position(scaled).scale,'camera corner resize works');
 const report=site.readiness(deviceResize.scene,source,deviceResize.presentation);
 assert.equal(report.ready,true,'Linked object and hit edits must remain publishable: '+report.problems.join('; '));
 assert.deepEqual(errors,[]);
 console.log('PASS linked/unlinked book + device and click fields; four resize handles; no browser errors');
}finally{await browser?.close();server.kill('SIGTERM');}
