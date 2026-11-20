import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {defaultRoomDevicePlacement,roomDevicePlacement,placedDeviceHitArea} from '../../../packages/effect-engine/src/model/scene-presentation.mjs';
import {effectScenePoint} from '../../../packages/effect-engine/src/runtime/object-scene.mjs';
import {deviceStagePoint,deviceVisibleBox} from '../src/scene-workspace/scene-room-geometry.mjs';

const site=siteSceneSource(),source=await site.snapshot();
const data={scene:source.scene,presentation:source.presentation,siteSource:true,
  previewImage:await site.preview(source),background:site.backgroundInfo(source),
  previewObjects:site.previewObjects(source),previewArt:site.previewArt(source),
  roomObjects:site.roomObjects(source),objectVisuals:site.objectVisuals(source),
  focusTargets:site.focusTargets(source),cameraCover:site.cameraCover(),
  assets:[],readiness:site.readiness(source.scene,source),
  sourceHash:source.sourceHash,note:'Kalibrasyon önizlemesi'};
const origin='http://127.0.0.1:5298';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--strictPort','--port','5298'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let logs='';server.stdout.on('data',b=>logs+=String(b));server.stderr.on('data',b=>logs+=String(b));
let browser;
try{
  let ready=false;
  for(let i=0;i<130;i++){
    try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,logs);
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??
    '/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1500,height:660}}),errors=[];
  page.on('pageerror',error=>errors.push(error.stack));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(packet=>{
    window.channelFoundryStudio={
      sceneWorkshopLoad:async()=>packet,
      sceneWorkshopSave:async()=>({sourceHash:packet.sourceHash,readiness:packet.readiness,message:'Kaydedildi'}),
      onSceneWorkshopProgress:()=>()=>{},
    };
    window.__mountStudioSceneV3();
  },data);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects?.length===14,{timeout:30000});
  const snapshot=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
  const change=async(selector,value)=>{
    await page.locator(selector).fill(String(value));
    await page.locator(selector).press('Tab');
  };
  // 1) The copper surface and socket must scale/tilt while the hit box stays
  // independent. Capture actual DOM geometry, not just saved JSON values.
  await page.locator('#scene-control-select-languageSwitch').click();
  const dimensions=()=>page.locator('#scene-language-switch').evaluate(node=>{
    const face=node.querySelector('.scene-switch-plate'),a=face.getBoundingClientRect(),
      b=node.getBoundingClientRect(),socket=getComputedStyle(node,'::before');
    return {faceWidth:a.width,hitWidth:b.width,transform:getComputedStyle(face).transform,
      socketTransform:socket.transform};
  });
  const baseline=await dimensions();
  await change('#language-plateScale',170);
  const enlarged=await dimensions();
  assert.ok(enlarged.faceWidth>baseline.faceWidth*1.45,
    'plate scale visibly enlarges copper instead of only updating data');
  assert.ok(Math.abs(enlarged.hitWidth-baseline.hitWidth)<2,
    'click target must remain independent of copper scale');
  assert.notEqual(enlarged.socketTransform,baseline.socketTransform,
    'the recessed wooden socket must scale in concert with copper');
  await change('#language-skew',-48);
  const tilted=await dimensions();
  assert.notEqual(tilted.transform,enlarged.transform,'tilt changes projected face');
  await change('#language-hitWidth',145);
  const changedHit=await dimensions();
  assert.ok(changedHit.hitWidth>enlarged.hitWidth*1.35);
  assert.ok(Math.abs(changedHit.faceWidth-tilted.faceWidth)<2,
    'changing touch area must not resize copper face');
  let draft=await snapshot();
  assert.equal(draft.presentation.controls.languageSwitch.desktop.plateScale,1.7);
  assert.equal(draft.presentation.controls.languageSwitch.desktop.skew,-48);

  // 2) Right inspector has a nested scroller. It must remain stable on
  // edit, not spring to the first field when each number is committed.
  const controlScroll=page.locator('.scene-inspector-page[data-inspector-page="control"]');
  // Reproduce the tall-property-panel case even on a large desktop:
  // renderControlInspector replaces only its own section, never this page.
  await controlScroll.evaluate(n=>{
    const spacer=document.createElement('div');
    spacer.id='scroll-regression-spacer';spacer.style.height='560px';
    n.appendChild(spacer);
  });
  const maxControl=await controlScroll.evaluate(n=>n.scrollHeight-n.clientHeight);
  assert.ok(maxControl>35,'narrow workspace has a real scrollable inspector');
  await controlScroll.evaluate(n=>n.scrollTop=Math.min(90,n.scrollHeight-n.clientHeight));
  const beforeScroll=await controlScroll.evaluate(n=>n.scrollTop);
  await page.locator('#language-skew').evaluate(n=>{
    n.value='-42';
    n.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const afterScroll=await controlScroll.evaluate(n=>n.scrollTop);
  assert.ok(Math.abs(afterScroll-beforeScroll)<4,
    'numeric input rebuild must preserve nested inspector scroll position');

  // 3) Native room device placement edits must not shift the close-up,
  // source-scene object, or other device. Test numeric, drag and reset.
  // The physical Vefk button can overlap the camera at calibration extremes.
  // Locally hide the device in Studio's transient preview while dragging the
  // camera, then restore it before testing the Vefk. Published flags untouched.
  await page.locator('#object-select-vefk-stand').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  await page.locator('#preview-object-visible').uncheck();
  for(const id of ['camera','vefk-stand']){
    await page.locator('#object-select-'+id).click();
    if(id==='vefk-stand'){
      await page.locator('[data-inspector-tab="visual"]').click();
      await page.locator('#preview-object-visible').check();
    }
    await page.locator('[data-inspector-tab="focus"]').click();
    const selector='[data-room-object="'+id+'"]';
    const room=page.locator(selector);
    assert.equal(await room.count(),1);
    assert.ok(await page.locator('#device-room-x').isVisible());
    const initial=await room.evaluate(n=>({left:parseFloat(n.style.left),top:parseFloat(n.style.top),
      width:parseFloat(n.style.width)}));
    const original=defaultRoomDevicePlacement(id);
    const authored=roomDevicePlacement(source.presentation,id);
    assert.ok(Math.abs(initial.left-authored.x*100)<.01,
      id+' room image must reflect current authored placement, not old defaults');
    await change('#device-room-x',id==='camera'?76.3:63.2);
    await change('#device-room-y',id==='camera'?74.5:67.5);
    await change('#device-room-scale',id==='camera'?125:82);
    let next=await snapshot(),placement=next.presentation.objects[id].roomPlacement;
    assert.ok(placement);
    assert.equal(placement.x,id==='camera'?.763:.632);
    assert.equal(placement.y,id==='camera'?.745:.675);
    assert.equal(placement.scale,id==='camera'?1.25:.82);
    assert.ok(Math.abs(parseFloat(await room.evaluate(n=>n.style.left))-placement.x*100)<.01);
    assert.ok(Math.abs(parseFloat(await room.evaluate(n=>n.style.top))-placement.y*100)<.01);
    assert.ok(Math.abs(parseFloat(await room.evaluate(n=>n.style.width))
      -initial.width*placement.scale/authored.scale)<.1);
    assert.deepEqual(next.scene,source.scene,'device placement belongs only to presentation');
    assert.equal(site.readiness(next.scene,source,next.presentation).ready,true);

    // A selected device's area now follows the actual visible cutout. For
    // Vefk, the original canvas has 333 entirely transparent bottom rows.
    const visualFrame=await page.locator('#stage-object-'+id).boundingBox();
    const physicalFrame=await room.boundingBox();
    const visible=deviceVisibleBox(next.presentation,id,new Map(data.roomObjects.map(item=>[item.id,item])));
    const viewport=await page.locator('#scene-viewport').boundingBox();
    const projected={x:viewport.x+visible.x*viewport.width,y:viewport.y+visible.y*viewport.height,
      width:visible.width*viewport.width,height:visible.height*viewport.height};
    for(const key of ['x','y','width','height'])
      assert.ok(Math.abs(visualFrame[key]-projected[key])<3,
        id+' selection uses visible bounds for '+key);
    if(id==='vefk-stand'){
      assert.ok(visualFrame.height<physicalFrame.height*.8,'old blank Vefk tail is excluded');
      assert.ok(Math.abs(visualFrame.width-physicalFrame.width)<3);
    }else{
      for(const key of ['x','y','width','height'])
        assert.ok(Math.abs(visualFrame[key]-physicalFrame[key])<3,
          id+' camera visible frame remains unchanged for '+key);
    }
    const native=next.scene.objects.find(object=>object.id===id).hitArea;
    const hit=placedDeviceHitArea(next.presentation,id,native);
    const shownHit=await page.locator('#scene-hit-'+id).evaluate(node=>({
      x:parseFloat(node.style.left)/100,y:parseFloat(node.style.top)/100,
      width:parseFloat(node.style.width)/100,height:parseFloat(node.style.height)/100,
    }));
    for(const key of ['x','y','width','height'])
      assert.ok(Math.abs(hit[key]-shownHit[key])<.000005,id+' site hit and Studio visible hit '+key);
    // Effect target markers must shift and scale with the same device,
    // without rewriting their anchor/offset metadata.
    const siteObject=next.scene.objects.find(o=>o.id===id);
    const target=next.scene.effects.find(e=>e.target.objectId===id);
    if(target){
      const nativePoint=effectScenePoint(siteObject,target);
      const stagePoint=deviceStagePoint(next.presentation,id,nativePoint);
      const shown=await page.locator('#marker-'+target.id).evaluate(node=>({
        x:parseFloat(node.style.left)/100,y:parseFloat(node.style.top)/100,
      }));
      assert.ok(Math.abs(stagePoint.x-shown.x)<.000005&&Math.abs(stagePoint.y-shown.y)<.000005,
        id+' visible effect target tracks physical object placement');
      await page.locator('#effect-edit-mode').click();
      const marker=page.locator('#marker-'+target.id),markerBox=await marker.boundingBox();
      const mx=markerBox.x+markerBox.width/2,my=markerBox.y+markerBox.height/2;
      await page.mouse.move(mx,my);await page.mouse.down();
      await page.mouse.move(mx+11,my+7,{steps:5});await page.mouse.up();
      const adjusted=await snapshot();
      const adjustedTarget=adjusted.scene.effects.find(e=>e.id===target.id);
      assert.notDeepEqual(adjustedTarget.target.offset,target.target.offset,
        id+' target can be dragged in Effect mode at its projected position');
      const adjustedPoint=deviceStagePoint(adjusted.presentation,id,
        effectScenePoint(adjusted.scene.objects.find(o=>o.id===id),adjustedTarget));
      const actualMarker=await marker.evaluate(node=>({
        x:parseFloat(node.style.left)/100,y:parseFloat(node.style.top)/100,
      }));
      assert.ok(Math.abs(adjustedPoint.x-actualMarker.x)<.000005&&
        Math.abs(adjustedPoint.y-actualMarker.y)<.000005,
        id+' marker stays correctly projected after drag');
      await page.locator('#undo').click();
      assert.deepEqual((await snapshot()).scene,next.scene,
        id+' effect drag Undo returns to unchanged authored offsets');
    }
    await page.locator('#hit-edit-mode').click();
    // This scenario deliberately edits the click target independently.
    // The default linked mode also moves the physical camera/stand.
    await page.locator('#hit-area-settings').evaluate(node=>node.open=true);
    await page.locator('#hit-linked').uncheck();
    assert.equal(await page.locator('#scene-hit-'+id).evaluate(node=>getComputedStyle(node).pointerEvents),'auto');
    const hitBox=await page.locator('#scene-hit-'+id).boundingBox();
    await page.mouse.move(hitBox.x+hitBox.width*.5,hitBox.y+hitBox.height*.5);
    await page.mouse.down();
    await page.mouse.move(hitBox.x+hitBox.width*.5+9,hitBox.y+hitBox.height*.5+7,{steps:5});
    await page.mouse.up();
    const afterHit=await snapshot();
    assert.notDeepEqual(afterHit.scene.objects.find(o=>o.id===id).hitArea,native,
      id+' hit area remains directly editable at the physical device location');
    assert.deepEqual(afterHit.presentation,next.presentation,
      'hit adjustment changes only the native hit geometry, not device placement');
    await page.locator('#undo').click();
    assert.deepEqual((await snapshot()).scene,next.scene,'Undo restores initial device hit geometry');
    await page.locator('#hit-linked').check();
    await page.locator('#visual-edit-mode').click();

    // Mode "Taşı" uses the same physical room image for pointer movement.
    const mode=page.locator('#visual-edit-mode');
    if((await mode.getAttribute('aria-pressed'))!=='true')await mode.click();
    const rect=await room.boundingBox();assert.ok(rect);
    const x=rect.x+rect.width*.5,y=rect.y+rect.height*.5;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x-14,y+17,{steps:6});await page.mouse.up();
    next=await snapshot();
    assert.notEqual(next.presentation.objects[id].roomPlacement.y,placement.y,
      id+' physical image drag must update scene presentation');
    assert.equal(site.readiness(next.scene,source,next.presentation).ready,true);

    // Reset belongs to the device's Focus inspector, not Visual mode.
    // Undo and reset must not affect its companion device.
    await page.locator('[data-inspector-tab="focus"]').click();
    await page.locator('#device-room-reset').click();
    next=await snapshot();
    assert.equal(next.presentation.objects[id].roomPlacement,undefined);
    assert.ok(Math.abs(parseFloat(await room.evaluate(n=>n.style.left))-original.x*100)<.01);
  }
  // Studio visibility tooling affects preview only. Both cutout art AND
  // legacy effect/ghost art disappear; object guides stay independently usable.
  const beforeLayers=await snapshot();
  const menu=page.locator('.scene-tools-menu');
  if(!(await menu.getAttribute('open')))await menu.locator('summary').click();
  await page.locator('#show-room-objects').click();
  assert.equal(await page.locator('#show-room-objects').getAttribute('aria-pressed'),'false');
  assert.ok(await page.locator('#scene-viewport').evaluate(n=>n.classList.contains('hide-room-objects')));
  assert.equal(await page.locator('#scene-room-objects').isHidden(),true);
  assert.equal(await page.locator('#stage-object-ceremonial-robe img').first()
    .evaluate(node=>getComputedStyle(node).visibility),'hidden',
    'legacy translucent robe artwork must not remain after hiding Objects');
  assert.deepEqual(await snapshot(),beforeLayers,'temporary layer hide cannot mutate publishable scene');
  await page.locator('#show-room-objects').click();
  assert.equal(await page.locator('#stage-object-ceremonial-robe img').first()
    .evaluate(node=>getComputedStyle(node).visibility),'visible');
  assert.deepEqual(await snapshot(),beforeLayers);
  assert.deepEqual(errors,[]);
  console.log('PASS V6.5 physical camera/Vefk overlay boxes, site hit geometry, hit edit+undo, no ghosts on hide, saved scene isolation');
}finally{await browser?.close();server.kill('SIGTERM');}
