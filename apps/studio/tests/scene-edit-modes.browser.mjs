import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
const origin='http://127.0.0.1:5319';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--strictPort','--port','5319'],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
let browser;
const EPS=.000001;
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}
    catch{}await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Studio dev server unavailable: '+output);
  const adapter=siteSceneSource(),snapshot=await adapter.snapshot();
  const packet={scene:snapshot.scene,presentation:snapshot.presentation,siteSource:true,
    background:adapter.backgroundInfo(snapshot),previewImage:await adapter.preview(snapshot),
    previewObjects:adapter.previewObjects(snapshot),roomObjects:adapter.roomObjects(snapshot),
    previewArt:adapter.previewArt(snapshot),objectVisuals:adapter.objectVisuals(snapshot),
    focusTargets:adapter.focusTargets(snapshot),assets:[],sourceHash:snapshot.sourceHash,
    readiness:adapter.readiness(snapshot.scene,snapshot),note:'Sahne test'};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??
    '/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1640,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{
    window.channelFoundryStudio={
      sceneWorkshopLoad:async()=>data,
      sceneWorkshopSave:async()=>({sourceHash:data.sourceHash,readiness:data.readiness,message:'Saved'}),
      onSceneWorkshopProgress:()=>()=>{},
    };
    window.__mountStudioSceneV3();
  },packet);
  await page.waitForFunction(()=>document.querySelectorAll('.scene-tree-object').length===14);
  const read=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
  const ownerId='water-basin',before=await read();
  const original=before.scene.objects.find(entry=>entry.id===ownerId);
  const effect=before.scene.effects.find(entry=>entry.target.objectId===ownerId);
  assert.ok(original?.hitArea&&effect,'test fixture must contain a selectable hit area and effect');
  assert.equal(await page.locator('.scene-editor-root').getAttribute('data-edit-mode'),'select');
  await page.locator('#object-select-'+ownerId).click();
  assert.equal(await page.locator('#scene-hit-'+ownerId).evaluate(node=>getComputedStyle(node).pointerEvents),'none',
    'in select mode the click area cannot move');
  await page.locator('#object-select-'+ownerId).click({button:'right'});
  assert.match(await page.locator('#scene-context-menu').innerText(),/Tıklama alanını düzenle/);
  await page.getByRole('menuitem',{name:'Tıklama alanını düzenle'}).click();
  assert.equal(await page.locator('.scene-editor-root').getAttribute('data-edit-mode'),'hit');
  assert.equal(await page.locator('#hit-edit-mode').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#scene-hit-'+ownerId+' [data-hit-corner]').count(),4);
  assert.equal(await page.locator('#scene-hit-'+ownerId).evaluate(node=>getComputedStyle(node).pointerEvents),'auto');
  const box=await page.locator('#scene-hit-'+ownerId).boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+19,box.y+box.height/2-9,{steps:4});
  await page.mouse.up();
  const moved=(await read()).scene.objects.find(entry=>entry.id===ownerId).hitArea;
  assert.ok(moved.x>original.hitArea.x+EPS,'hit box x changes only in hit edit mode');
  await page.locator('#undo').click();
  assert.deepEqual((await read()).scene.objects.find(entry=>entry.id===ownerId).hitArea,original.hitArea,
    'hit drag is undoable');
  const corner=await page.locator('#scene-hit-'+ownerId+' [data-hit-corner="se"]').boundingBox();
  await page.mouse.move(corner.x+corner.width/2,corner.y+corner.height/2);
  await page.mouse.down();
  await page.mouse.move(corner.x+corner.width/2+13,corner.y+corner.height/2+12,{steps:4});
  await page.mouse.up();
  const resized=(await read()).scene.objects.find(entry=>entry.id===ownerId).hitArea;
  assert.ok(resized.width>original.hitArea.width,'hit resize handle changes width');
  await page.locator('#undo').click();
  assert.deepEqual((await read()).scene.objects.find(entry=>entry.id===ownerId).hitArea,original.hitArea);
  await page.locator('#effect-edit-mode').click();
  assert.equal(await page.locator('#hit-edit-mode').getAttribute('aria-pressed'),'false','tool exclusivity');
  assert.equal(await page.locator('#effect-edit-mode').getAttribute('aria-pressed'),'true');
  const marker=page.locator('#marker-'+effect.id);
  const position=await marker.boundingBox();
  await page.mouse.move(position.x+position.width/2,position.y+position.height/2);
  await page.mouse.down();
  await page.mouse.move(position.x+position.width/2+15,position.y+position.height/2+7,{steps:4});
  await page.mouse.up();
  const offset=(await read()).scene.effects.find(entry=>entry.id===effect.id).target.offset;
  assert.notDeepEqual(offset,effect.target.offset,'effect target is draggable in effect mode');
  await page.locator('#undo').click();
  assert.deepEqual((await read()).scene.effects.find(entry=>entry.id===effect.id).target.offset,effect.target.offset);
  await page.locator('#visual-edit-mode').click();
  assert.equal(await page.locator('#effect-edit-mode').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#stage-object-'+ownerId+' [data-visual-corner]').count(),4);
  const vc=await page.locator('#stage-object-'+ownerId+' [data-visual-corner="se"]').boundingBox();
  await page.mouse.move(vc.x+vc.width/2,vc.y+vc.height/2);
  await page.mouse.down();
  await page.mouse.move(vc.x+vc.width/2+11,vc.y+vc.height/2+8,{steps:4});
  await page.mouse.up();
  const visual=(await read()).scene.objects.find(entry=>entry.id===ownerId).pose;
  assert.ok(visual.width>original.pose.width,'selected image corner changes width');
  await page.locator('#undo').click();
  assert.deepEqual((await read()).scene.objects.find(entry=>entry.id===ownerId).pose,original.pose);
  await page.locator('#select-mode').click();
  assert.equal(await page.locator('#scene-hit-'+ownerId).evaluate(node=>getComputedStyle(node).pointerEvents),'none');
  // Solo and drag-lock are editor-only state; they must not mark the scene dirty.
  await page.locator('#object-select-'+ownerId).click({button:'right'});
  await page.getByRole('menuitem',{name:'Sürüklemeyi kilitle'}).click();
  await page.locator('#visual-edit-mode').click();
  const lockedPose=(await read()).scene.objects.find(entry=>entry.id===ownerId).pose;
  const lockedObject=await page.locator('#stage-object-'+ownerId).boundingBox();
  await page.mouse.move(lockedObject.x+lockedObject.width/2,lockedObject.y+lockedObject.height/2);
  await page.mouse.down();
  await page.mouse.move(lockedObject.x+lockedObject.width/2+21,lockedObject.y+lockedObject.height/2+17,{steps:3});
  await page.mouse.up();
  assert.deepEqual((await read()).scene.objects.find(entry=>entry.id===ownerId).pose,lockedPose,'locked drag does nothing');
  await page.locator('#object-select-'+ownerId).click({button:'right'});
  await page.getByRole('menuitem',{name:'Sürükleme kilidini aç'}).click();
  await page.locator('#object-select-'+ownerId).click({button:'right'});
  await page.getByRole('menuitem',{name:'Yalnız bu nesneyi göster'}).click();
  assert.equal(await page.locator('#scene-objects .scene-object:not([hidden])').count(),1,'solo view isolates one object');
  await page.locator('#object-select-'+ownerId).click({button:'right'});
  await page.getByRole('menuitem',{name:'Tüm nesneleri göster'}).click();
  assert.ok(await page.locator('#scene-objects .scene-object:not([hidden])').count()>1,'solo view restores all');
  assert.deepEqual((await read()).scene,before.scene,'all editor-only settings leave scene unchanged');
  assert.deepEqual(errors,[],'no runtime errors');
  console.log('PASS V6.2 exclusive scene editing, context menu, hit/visual resize, effect drag, undo, original scene');
}finally{await browser?.close();server.kill('SIGTERM');}
