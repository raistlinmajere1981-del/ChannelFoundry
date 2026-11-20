import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {importProject,exportProject} from '../../../packages/effect-engine/src/model/project.mjs';
const port=5357,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--strictPort','--port',String(port)],{
  cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'
});
let output='';server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
let browser;
const close=(a,b)=>Math.abs(a-b)<.0003;
try{
  let ready=false;
  for(let i=0;i<160;i++){
    try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,'Vite failed: '+output);
  const adapter=siteSceneSource(),source=await adapter.snapshot();
  const packet={scene:source.scene,presentation:source.presentation,siteSource:true,
    background:adapter.backgroundInfo(source),previewImage:await adapter.preview(source),
    previewObjects:adapter.previewObjects(source),roomObjects:adapter.roomObjects(source),
    previewArt:adapter.previewArt(source),objectVisuals:adapter.objectVisuals(source),
    focusTargets:adapter.focusTargets(source),assets:[],sourceHash:source.sourceHash,
    readiness:adapter.readiness(source.scene,source)};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??
    '/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1640,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(packet=>{
    window.channelFoundryStudio={
      sceneWorkshopLoad:async()=>packet,
      sceneWorkshopSave:async()=>({sourceHash:packet.sourceHash,readiness:packet.readiness}),
      onSceneWorkshopProgress:()=>()=>{}
    };
    window.__mountStudioSceneV3();
  },packet);
  await page.waitForFunction(()=>window.__sceneEditor?.snapshot()?.scene?.objects?.length===14);
  const snap=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
  const find=(snapshot,id)=>snapshot.scene.objects.find(x=>x.id===id);
  const change=async(id,value)=>{await page.locator(id).fill(String(value));await page.locator(id).press('Tab');};
  // All 14 native scene objects: books, devices, decor and layered art.
  for(const id of source.scene.objects.map(object=>object.id)){
    await page.locator('#object-select-'+id).click();
    await page.locator('[data-inspector-tab="visual"]').click();
    const before=await snap(),original=find(before,id),beforeEffects=before.scene.effects.filter(x=>x.target.objectId===id);
    // Previous site edits may already include an editorArea; linking is always opt-in.
    if(await page.locator('#visual-linked').isChecked())await page.locator('#visual-linked').uncheck();
    await page.locator('#editor-area-independent').check();
    let enabled=await snap(),item=find(enabled,id);
    assert.ok(item.editorArea&&item.editorArea.width>0&&item.editorArea.height>0,id+' independent area enabled');
    assert.deepEqual(item.pose,original.pose,id+' image pose is not modified by enabling editor area');
    assert.deepEqual(item.hitArea,original.hitArea,id+' hit area unchanged by enabling');
    assert.deepEqual(enabled.scene.effects.filter(x=>x.target.objectId===id),beforeEffects,id+' effects unchanged');
    assert.equal(await page.locator('#visual-linked').isChecked(),false,'link to hit defaults off');
    const earlierWidth=item.editorArea.width;
    await change('#editor-area-width',earlierWidth*72);
    let resized=await snap(),changed=find(resized,id);
    assert.ok(changed.editorArea.width<earlierWidth*.8,id+' independent width shrinks');
    assert.deepEqual(changed.pose,original.pose,id+' source art size does not shrink');
    assert.deepEqual(changed.hitArea,original.hitArea,id+' click box not automatically changed');
    assert.deepEqual(resized.presentation,before.presentation,id+' presentation unaffected');
    assert.deepEqual(resized.scene.effects.filter(x=>x.target.objectId===id),beforeEffects,id+' effect poses unaffected');
    assert.equal(await page.locator('#scene-independent-area-'+id).isVisible(),true,id+' overlay visible');
    assert.ok(await page.locator('#scene-independent-area-'+id).boundingBox(),id+' overlay geometry');
    if(id==='guardian-sword-left'){
      await page.locator('#visual-edit-mode').click();
      const grip=await page.locator('#scene-independent-area-'+id+' [data-visual-corner="se"]').boundingBox();
      assert.ok(grip?.width>0,'independent selection offers draggable resize handles');
      await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
      await page.mouse.down();
      await page.mouse.move(grip.x+grip.width/2+15,grip.y+grip.height/2-7,{steps:5});
      await page.mouse.up();
      const cornered=await snap();
      assert.ok(find(cornered,id).editorArea.width>changed.editorArea.width+.003,
        'dragging the selection outline resizes only the outline');
      assert.deepEqual(find(cornered,id).pose,original.pose,
        'dragging the selection outline does not scale the sword image');
      await page.locator('#undo').click();
      assert.deepEqual(find(await snap(),id).editorArea,changed.editorArea,
        'independent outline drag is undoable');
    }
    if(id==='guardian-sword-right'){
      await page.locator('#visual-linked').check();
      const beforeLinked=await snap();
      const initialHit=find(beforeLinked,id).hitArea.x;
      await change('#editor-area-x',Math.min(90,changed.editorArea.x*100+.8));
      const afterLinked=await snap();
      assert.ok(Math.abs(find(afterLinked,id).hitArea.x-initialHit)>.002,
        'opt-in linked movement updates hit frame');
      assert.deepEqual(find(afterLinked,id).pose,original.pose,
        'even linked movement cannot scale or move the real sword art');
      await page.locator('#undo').click();
      assert.deepEqual(find(await snap(),id).hitArea,find(beforeLinked,id).hitArea,
        'linked hit movement is undoable');
    }
    if(id==='ceremonial-robe'){
      await page.locator('details.scene-tools-menu').evaluate(node=>{node.open=true;});
      await page.locator('#scene-plan-toggle').click(); // focus
      assert.equal(await page.locator('#scene-composition-guide [data-plan-zone="ceremonial-robe"]').count(),0);
      await page.locator('#scene-plan-toggle').click(); // details
      let plan=page.locator('#scene-composition-guide [data-plan-zone="ceremonial-robe"]');
      assert.equal(await plan.count(),1);
      let p=await plan.evaluate(n=>({x:parseFloat(n.style.left)/100,width:parseFloat(n.style.width)/100}));
      assert.ok(close(p.x,changed.editorArea.x)&&close(p.width,changed.editorArea.width),
        'dynamic plan reflects current independent bound, not legacy hardcoded pose');
      await change('#editor-area-x',Math.min(90,changed.editorArea.x*100+1));
      let latest=await snap();plan=page.locator('#scene-composition-guide [data-plan-zone="ceremonial-robe"]');
      p=await plan.evaluate(n=>parseFloat(n.style.left)/100);
      assert.ok(close(p,find(latest,id).editorArea.x),'plan updates as inspector value changes');
      await page.locator('#scene-plan-toggle').click(); // all
      assert.equal(await page.locator('#scene-composition-guide [data-plan-zone="ceremonial-robe"]').count(),1);
      await page.locator('#scene-plan-toggle').click(); // off
    }
    // The same JSON can be saved/reloaded and validated for site readiness.
    const saved=await snap(),roundtrip=importProject(exportProject(saved.scene));
    assert.deepEqual(roundtrip,saved.scene);
    assert.equal(adapter.readiness(roundtrip,source,saved.presentation).ready,true,id+' staging remains valid');
    await page.locator('#undo').click();
    if(id==='ceremonial-robe')await page.locator('#undo').click(); // extra x edit
    const restored=await snap();
    assert.ok(close(find(restored,id).editorArea.width,earlierWidth),id+' resize undo restored');
    await page.locator('#editor-area-independent').uncheck();
    const disabled=await snap();
    assert.equal(find(disabled,id).editorArea,undefined,id+' optional area removed cleanly');
    assert.deepEqual(find(disabled,id).pose,original.pose,id+' normal visual pose restored');
    assert.deepEqual(find(disabled,id).hitArea,original.hitArea);
  }
  // Existing editor drawing remains unchanged until the user opts in.
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('PASS independent editor bounds for all 14 objects, including swords drag, plan, undo, source preservation and site validation');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
