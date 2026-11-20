import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {bookStageArea} from '../src/scene-workspace/scene-book-area.mjs';
import {stoneVisibleArea} from '../src/scene-workspace/scene-stone-bounds.mjs';
import {deviceStageHit,deviceRoomBox,deviceVisibleBox} from '../src/scene-workspace/scene-room-geometry.mjs';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url)),url='http://127.0.0.1:5353';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5353'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',x=>log+=String(x));server.stderr.on('data',x=>log+=String(x));
const close=(a,b)=>Math.abs(a-b)<.00002;
const sameBox=(a,b)=>['x','y','width','height'].every(key=>close(a[key],b[key]));
const contains=(outer,inner)=>inner.x>=outer.x-.0002&&inner.y>=outer.y-.0002&&inner.x+inner.width<=outer.x+outer.width+.0002&&inner.y+inner.height<=outer.y+outer.height+.0002;
let browser;
try{
  let ready=false;
  for(let i=0;i<150;i++){try{if((await fetch(url+'/tests/scene-v3-harness.html')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
  assert.ok(ready,'Vite not ready: '+log);
  const site=siteSceneSource(),source=await site.snapshot();
  // Exercise native artwork alignment, not the optional Studio selection outline.
  // The independent overlay is tested separately in scene-independent-area.browser.mjs.
  const nativeScene=structuredClone(source.scene);
  nativeScene.objects.forEach(item=>delete item.editorArea);
  const fixtureBook=nativeScene.objects.find(item=>item.id==='research-journal');
  // Current hit is taller than a closed book may legally stretch.
  fixtureBook.hitArea.height=Math.min(fixtureBook.hitArea.height,fixtureBook.hitArea.width*4/3*1.16);
  const packet={scene:nativeScene,presentation:source.presentation,roomObjects:site.roomObjects(source),
    previewImage:await site.preview(source),background:site.backgroundInfo(source),
    previewObjects:site.previewObjects(source),objectVisuals:site.objectVisuals(source),previewArt:site.previewArt(source),
    focusTargets:site.focusTargets(source),assets:[],siteSource:true,readiness:site.readiness(nativeScene,source),sourceHash:source.sourceHash};
  const roomMap=new Map(packet.roomObjects.map(r=>[r.id,r]));
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{window.channelFoundryStudio={sceneWorkshopLoad:async()=>data,sceneWorkshopSave:async()=>({sourceHash:data.sourceHash,readiness:data.readiness}),onSceneWorkshopProgress:()=>()=>{}};window.__mountStudioSceneV3()},packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects?.length===14,null,{timeout:25000});
  const snap=()=>page.evaluate(()=>window.__sceneEditor.snapshot()),get=(s,id)=>s.scene.objects.find(o=>o.id===id);
  const change=async(id,value)=>{await page.locator(id).fill(String(value));await page.locator(id).press('Tab')};
  // Exact photo-book alignment from independently edited hit box, then undo.
  await page.locator('#object-select-research-journal').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  await page.locator('#visual-linked').uncheck();
  const original=await snap(),originalBook=bookStageArea(original.presentation.objects['research-journal'].closedBook);
  const originalHit=get(original,'research-journal').hitArea;
  assert.ok(!sameBox(originalBook,originalHit),'fixture must have independently padded frames');
  await page.locator('#sync-visual-from-hit-visual').click();
  const aligned=await snap(),alignedBook=bookStageArea(aligned.presentation.objects['research-journal'].closedBook);
  assert.ok(sameBox(alignedBook,originalHit),'book visual is exactly copied from hit rectangle');
  assert.deepEqual(get(aligned,'research-journal').hitArea,originalHit,'hit source never moves');
  assert.equal(await page.locator('#visual-linked').isChecked(),false,'independent edit setting preserved');
  await page.locator('#undo').click();
  assert.deepEqual((await snap()).presentation.objects['research-journal'].closedBook,original.presentation.objects['research-journal'].closedBook,'one undo reverts visual alignment');
  await page.locator('#redo').click();
  assert.ok(sameBox(bookStageArea((await snap()).presentation.objects['research-journal'].closedBook),originalHit),'one redo restores alignment');
  // Reverse: after moving the book independently, the click region snaps to its final book frame.
  const beforeReverse=await snap(),x=Number(await page.locator('#book-area-x').inputValue());
  await change('#book-area-x',x+.8);
  const moved=await snap(),movedBook=bookStageArea(moved.presentation.objects['research-journal'].closedBook);
  assert.deepEqual(get(moved,'research-journal').hitArea,get(beforeReverse,'research-journal').hitArea);
  await page.locator('#hit-area-settings').evaluate(n=>n.open=true);
  await page.locator('#sync-hit-from-visual').click();
  const reverse=await snap();
  assert.ok(sameBox(get(reverse,'research-journal').hitArea,movedBook),'reverse operation copies visual to hit');
  // Physical camera keeps its native projection: visually fits hit and does not move hit.
  await page.locator('#object-select-camera').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  const cameraBefore=await snap(),cameraHit=deviceStageHit(cameraBefore.presentation,'camera',get(cameraBefore,'camera').hitArea);
  await page.locator('#sync-visual-from-hit-visual').click();
  const cameraAfter=await snap(),cameraShown=deviceRoomBox(cameraAfter.presentation,'camera',roomMap);
  const cameraHitAfter=deviceStageHit(cameraAfter.presentation,'camera',get(cameraAfter,'camera').hitArea);
  assert.ok(sameBox(cameraHitAfter,cameraHit),'camera hit stage bounds stay fixed during visual alignment');
  assert.ok(contains(cameraHitAfter,cameraShown),'camera physical image fits inside its click area');
  assert.ok(close(cameraShown.width/cameraShown.height,roomMap.get('camera').foundation.width/roomMap.get('camera').foundation.height),'camera source aspect preserved');
  // Vefk has an obsolete transparent tail in its source image: the visible
  // frame ends at pixel 1203, not the image's full 1536px transparent canvas.
  await page.locator('#object-select-vefk-stand').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  const vefkOriginal=await snap();
  const vefkFull=deviceRoomBox(vefkOriginal.presentation,'vefk-stand',roomMap);
  const vefkVisible=deviceVisibleBox(vefkOriginal.presentation,'vefk-stand',roomMap);
  assert.ok(vefkVisible.height<vefkFull.height*.8,'visual frame excludes the blank alpha tail');
  const selectionBox=await page.locator('#stage-object-vefk-stand').evaluate(n=>({
    x:parseFloat(n.style.left)/100,y:parseFloat(n.style.top)/100,
    width:parseFloat(n.style.width)/100,height:parseFloat(n.style.height)/100}));
  assert.ok(sameBox(selectionBox,vefkVisible),'stage selection matches the visible body');
  await page.locator('#hit-area-settings').evaluate(n=>n.open=true);
  await page.locator('#sync-hit-from-visual').click();
  const hitAligned=await snap();
  const copied=deviceStageHit(hitAligned.presentation,'vefk-stand',get(hitAligned,'vefk-stand').hitArea);
  assert.ok(sameBox(copied,vefkVisible),'click target equals visible artwork, not invisible canvas');
  assert.ok(sameBox(deviceRoomBox(hitAligned.presentation,'vefk-stand',roomMap),vefkFull),
    'only the hit frame changed; old physical source art is intact');
  await page.locator('#undo').click();
  assert.deepEqual((await snap()).scene,vefkOriginal.scene,'undo restores Vefk native hit');
  await page.locator('#sync-visual-from-hit-visual').click();
  const vefkFitted=await snap();
  const visualFitted=deviceVisibleBox(vefkFitted.presentation,'vefk-stand',roomMap);
  const targetHit=deviceStageHit(vefkFitted.presentation,'vefk-stand',get(vefkFitted,'vefk-stand').hitArea);
  assert.ok(contains(targetHit,visualFitted),'visual-only sync fits visible board into hit area');
  assert.ok(close(visualFitted.width/visualFitted.height,
    roomMap.get('vefk-stand').foundation.width/
      (roomMap.get('vefk-stand').foundation.height*1203/1536)),
    'visible desk aspect stays stable; image not stretched');
  // Independent photographic object also fits without aspect deformation.
  await page.locator('#object-select-stone-specimen').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  const stoneBefore=await snap(),stoneHit=get(stoneBefore,'stone-specimen').hitArea;
  const oldPose=get(stoneBefore,'stone-specimen').pose;
  const oldVisible=stoneVisibleArea(oldPose);
  assert.ok(oldVisible.height<oldPose.height*.52,
    'old stone canvas has a large invisible top portion');
  const stoneFrame=page.locator('#scene-stone-visible');
  assert.ok(await stoneFrame.isVisible(),'selection follows real stone and plate, not their old host');
  const region=await stoneFrame.evaluate(n=>({
    x:parseFloat(n.style.left)/100,y:parseFloat(n.style.top)/100,
    width:parseFloat(n.style.width)/100,height:parseFloat(n.style.height)/100}));
  assert.ok(sameBox(region,oldVisible),'photo-layer alpha bounds are projected onto the stage');
  await page.locator('#visual-linked').uncheck();
  await page.locator('#visual-edit-mode').click();
  // Dragging the visible (not old native) southeast grip resizes that outline.
  const stoneGrip=page.locator('#scene-stone-visible [data-visual-corner="se"]');
  const grip=await stoneGrip.boundingBox();
  assert.ok(grip?.width>0,'stone visible grip renders in visual mode');
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
  await page.mouse.down();
  await page.mouse.move(grip.x+grip.width/2+12,grip.y+grip.height/2-7,{steps:5});
  await page.mouse.up();
  const gripped=await snap(),grippedVisible=stoneVisibleArea(get(gripped,'stone-specimen').pose);

  assert.ok(grippedVisible.width>oldVisible.width+.002,'grip changes visible stone width');
  assert.ok(grippedVisible.height<oldVisible.height-.002,'grip changes visible stone height independently');
  await page.locator('#undo').click();
  assert.deepEqual((await snap()).scene,stoneBefore.scene,'grip move undo restores original stone');
  const visibleHeight=Number(await page.locator('#stone-visible-height').inputValue());
  const visibleWidth=Number(await page.locator('#stone-visible-width').inputValue());
  await change('#stone-visible-height',visibleHeight*.75);
  const shortened=await snap(),shortPose=get(shortened,'stone-specimen').pose;
  assert.ok(stoneVisibleArea(shortPose).height<oldVisible.height*.78,
    'stone height can shrink independently');
  assert.ok(close(stoneVisibleArea(shortPose).width,oldVisible.width),
    'changing stone height does not change width');
  assert.deepEqual(get(shortened,'stone-specimen').hitArea,stoneHit,
    'independent height editing leaves click area untouched');
  await change('#stone-visible-width',visibleWidth*.85);
  const narrowed=await snap(),narrowPose=get(narrowed,'stone-specimen').pose;
  assert.ok(stoneVisibleArea(narrowPose).width<oldVisible.width*.87,
    'stone width can shrink independently');
  await page.locator('#undo').click();
  await page.locator('#undo').click();
  assert.deepEqual((await snap()).scene,stoneBefore.scene,'two undo operations restore original stone');
  await page.locator('#sync-hit-from-visual').click();
  const hitMatched=await snap();
  assert.ok(sameBox(get(hitMatched,'stone-specimen').hitArea,oldVisible),
    'visual-to-hit sync uses alpha-tight visible stone');
  await page.locator('#undo').click();
  await page.locator('#sync-visual-from-hit-visual').click();
  const stoneAfter=await snap(),pose=get(stoneAfter,'stone-specimen').pose;
  const syncedVisible=stoneVisibleArea(pose);
  assert.ok(['x','y','width','height'].every(key=>Math.abs(syncedVisible[key]-stoneHit[key])<.00012),
    'hit-to-visual sync copies visible stone within pose rounding: '+JSON.stringify({syncedVisible,stoneHit}));
  assert.deepEqual(get(stoneAfter,'stone-specimen').hitArea,stoneHit);
  assert.equal(site.readiness(stoneAfter.scene,source,stoneAfter.presentation).ready,true,'all resulting edits remain publishable');
  assert.deepEqual(errors,[],'no runtime errors');
  console.log('PASS camera, book, photographic object: explicit two-way area sync, independent editing, aspect, undo/redo and publish validation');
}finally{await browser?.close();server.kill('SIGTERM')}
