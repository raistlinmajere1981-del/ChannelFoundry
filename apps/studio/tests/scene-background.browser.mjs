import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';

const sourceSite=siteSceneSource(),source=await sourceSite.snapshot();
const background=sourceSite.backgroundInfo(source);
const packet={
  scene:source.scene,presentation:source.presentation,siteSource:true,
  previewImage:await sourceSite.preview(source),background,
  previewObjects:sourceSite.previewObjects(source),objectVisuals:sourceSite.objectVisuals(source),previewArt:sourceSite.previewArt(source),
  roomObjects:sourceSite.roomObjects(source),focusTargets:sourceSite.focusTargets(source),
  assets:[],readiness:sourceSite.readiness(source.scene,source),sourceHash:source.sourceHash,
};
const origin='http://127.0.0.1:5296';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5296'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let logs='';server.stdout.on('data',c=>logs+=c);server.stderr.on('data',c=>logs+=c);
let browser;
try{
  let ok=false;
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ok,'Vite not started: '+logs);
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1580,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{
    window.channelFoundryStudio={
      sceneWorkshopLoad:async()=>data,
      sceneWorkshopSave:async()=>({sourceHash:data.sourceHash,readiness:data.readiness,message:'Kaydedildi'}),
      onSceneWorkshopProgress:()=>()=>{},
    };
    window.__mountStudioSceneV3();
  },packet);
  try { await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14||Boolean(document.querySelector('strong[role=alert]')),{timeout:30000}); }
  catch(e){
    console.error('Studio load diagnosis:',await page.evaluate(()=>({
      mounted:Boolean(window.__sceneEditor),
      sceneLength:window.__sceneEditor?.getScene()?.objects?.length,
      status:document.querySelector('#status')?.textContent,
      statusClass:document.querySelector('#status')?.className,
      error:document.querySelector('strong[role=alert]')?.textContent
    })),errors.slice(0,4));
    throw e;
  }
  assert.equal(await page.locator('strong[role=alert]').count(),0,(await page.locator('strong[role=alert]').allTextContents()).join(' | '));
  await page.locator('#open-background').click();
  assert.equal(await page.locator('[data-inspector-page="background"]').isVisible(),true);
  assert.equal(await page.locator('#background-original-dimensions').textContent(),background.width+' × '+background.height+' px');
  assert.equal(await page.locator('#background-visible-fraction').textContent(),'%100');
  // The approved room is the sole master; physical objects use canonical
  // scene poses and changing them must not mutate the artwork source.
  assert.equal(await page.locator('#scene-atmosphere-wash').count(),1);
  const layerOrder=await page.evaluate(()=>({
    atmosphere:Number(getComputedStyle(document.querySelector('#scene-atmosphere-wash')).zIndex),
    objects:Number(getComputedStyle(document.querySelector('#scene-objects')).zIndex),
    foreground:Number(getComputedStyle(document.querySelector('#scene-room-objects')).zIndex),
    guides:Number(getComputedStyle(document.querySelector('#scene-composition-guide')).zIndex),
    markers:Number(getComputedStyle(document.querySelector('#scene-markers')).zIndex)
  }));
  assert.ok(layerOrder.objects<layerOrder.atmosphere,'wall and passive materials tinted');
  assert.ok(layerOrder.atmosphere<layerOrder.foreground,'books and focus devices stay above atmospheric wash');
  assert.ok(layerOrder.foreground<layerOrder.guides&&layerOrder.guides<layerOrder.markers,
    'composition guides and edit markers remain legible');

  assert.equal(await page.locator('#scene-atmosphere-wash').evaluate(node=>
    getComputedStyle(node).pointerEvents),'none');
  assert.equal(await page.locator('#stage-object-candle [data-contact-shadow="candle"]').count(),1);
  assert.equal(await page.locator('#stage-object-stone-specimen [data-contact-shadow="stone-specimen"]').count(),1);
  assert.equal(await page.locator('#stage-object-metal-pendulum [data-contact-shadow="metal-pendulum"]').count(),1);
  if(process.env.BDSG_STUDIO_ROOM_SHOT)
    await page.locator('#scene-viewport').screenshot({path:process.env.BDSG_STUDIO_ROOM_SHOT});
  const photo=await page.locator('#scene-photo').evaluate(node=>({
    width:node.naturalWidth,height:node.naturalHeight,
    src:node.getAttribute('src')
  }));
  assert.equal(photo.width,1774);
  assert.equal(photo.height,887);
  assert.match(photo.src,/^data:image\/webp;base64,/);
  const baselinePlan=await page.evaluate(()=>window.__sceneEditor.snapshot());
  await page.locator('#object-select-water-basin').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  assert.equal(await page.locator('#visual-placement-settings').isVisible(),true);
  const originalWaterX=baselinePlan.scene.objects.find(o=>o.id==='water-basin').pose.x;
  assert.ok(Math.abs(Number(await page.locator('#visual-x').inputValue())-originalWaterX*100)<.01,
    'Studio visual X matches saved physical scene, not an obsolete seed coordinate');
  const initialHit=await page.evaluate(()=>window.__sceneEditor.snapshot().scene.objects
    .find(o=>o.id==='water-basin').hitArea);
  await page.locator('#visual-x').fill('15');
  await page.locator('#visual-x').press('Tab');
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).scene.objects
    .find(o=>o.id==='water-basin').pose.x,.15);
  assert.equal(await page.locator('#stage-object-water-basin').evaluate(el=>el.style.left),'15%');
  assert.ok((await page.evaluate(()=>window.__sceneEditor.snapshot().scene.objects
    .find(o=>o.id==='water-basin').hitArea.x))>initialHit.x);
  await page.locator('#undo').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).scene.objects
    .find(o=>o.id==='water-basin').pose.x,originalWaterX);
  assert.deepEqual(await page.evaluate(()=>window.__sceneEditor.snapshot()),baselinePlan);
  await page.locator('#open-background').click();

  const planButton=page.locator('#scene-plan-toggle');
  assert.equal(await planButton.isDisabled(),false);
  await planButton.click();
  assert.equal(await page.locator('#scene-composition-guide').getAttribute('data-mode'),'fixed');
  assert.equal(await page.locator('[data-plan-zone]').count(),5);
  assert.equal(await page.locator('#scene-composition-guide').evaluate(node=>getComputedStyle(node).pointerEvents),'none');
  await planButton.click();
  assert.equal(await page.locator('#scene-composition-guide').getAttribute('data-mode'),'focus');
  assert.equal(await page.locator('[data-plan-zone]').count(),4);
  await planButton.click();
  assert.equal(await page.locator('#scene-composition-guide').getAttribute('data-mode'),'details');
  assert.equal(await page.locator('[data-plan-zone]').count(),7);
  await planButton.click();
  assert.equal(await page.locator('#scene-composition-guide').isVisible(),false);
  // Read-only part inventory must not mutate canonical effects or presentation.
  await page.locator('#object-select-candle').click();
  await page.locator('[data-inspector-tab="visual"]').click();
  assert.equal(await page.locator('#scene-family-settings').isVisible(),true);
  assert.match(await page.locator('#scene-family-inspector').textContent(),/Mum gövdesi/);
  assert.match(await page.locator('#scene-family-inspector').textContent(),/Mum gövdesiBağlı/);
  assert.match(await page.locator('#scene-family-inspector').textContent(),/melted-candle\.webp/);
  await page.locator('#object-select-archive-chest').click();
  assert.match(await page.locator('#scene-family-inspector').textContent(),/archive-chest\.rear-hinge/);
  assert.deepEqual(await page.evaluate(()=>window.__sceneEditor.snapshot()),baselinePlan,
    'composition guides cannot affect site data or Studio drafts');
  await page.locator('#open-background').click();
  assert.equal(await page.locator('#background-restore').isDisabled(),true);
  // Scene V4: a selected cold/clear grade must be editable in Studio and
  // serialize to the exact presentation that the real web runtime consumes.
  assert.equal(await page.locator('#scene-tone-brightness').inputValue(),'0.8');
  assert.equal(await page.locator('#scene-tone-coolTint').inputValue(),'0.12');
  assert.match(await page.locator('#scene-photo').evaluate(node=>getComputedStyle(node).filter),/brightness\(0\.8\)/);
  await page.locator('#scene-tone-preset-neutral').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.appearance.brightness,1);
  await page.locator('#undo').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.appearance.brightness,.8);
  await page.locator('#redo').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.appearance.brightness,1);
  await page.locator('#scene-tone-preset-coolClear').click();
  await page.locator('#scene-tone-brightness').fill('0.72');
  await page.locator('#scene-tone-brightness').press('Tab');
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.appearance.brightness,.72);
  await page.locator('#scene-tone-preset-coolClear').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.appearance.brightness,.8);

  const initial=await page.locator('#scene-viewport').boundingBox();
  assert.ok(Math.abs(initial.width/initial.height-2)<.03);
  await page.locator('#background-screen-preset').selectOption('390x844');
  assert.match(await page.locator('#background-room-geometry').textContent(),/390 × 195/);
  assert.match(await page.locator('#background-letterbox').textContent(),/324.5/);
  assert.equal(await page.locator('#background-image-scale').textContent(),'22%');
  const frame=await page.locator('#scene-screen-preview').boundingBox();
  const room=await page.locator('#scene-viewport').boundingBox();
  assert.ok(Math.abs(frame.width/frame.height-390/844)<.03);
  assert.ok(Math.abs(room.width/room.height-2)<.03);
  assert.ok(room.y>frame.y+frame.height*.3,'portrait letterbox is visible in work canvas');
  await page.locator('#background-screen-preset').selectOption('custom');
  await page.locator('#background-screen-width').fill('2560');
  await page.locator('#background-screen-width').press('Tab');
  await page.locator('#background-screen-height').fill('720');
  await page.locator('#background-screen-height').press('Tab');
  assert.match(await page.locator('#background-room-geometry').textContent(),/1440 × 720/);
  assert.match(await page.locator('#background-letterbox').textContent(),/Sol\/sağ 560/);
  const image=readFileSync(new URL('../../../channels/birdesengor/web/public/scene-assets/approved/room-effects-v4-2to1.webp',import.meta.url));
  const dl=page.waitForEvent('download');
  await page.locator('#background-original-export').click();
  assert.match((await dl).suggestedFilename(),/orijinal\.webp$/);
  // The imported WebP is re-encoded as a draft; the published image is untouched.
  await page.locator('#scene-background-file').setInputFiles({name:'room.webp',mimeType:'image/webp',buffer:image});
  await page.waitForFunction(path=>window.__sceneEditor.snapshot().assets.some(a=>a.path===path),background.asset);
  const draft=await page.evaluate(()=>window.__sceneEditor.snapshot());
  assert.equal(draft.assets.length,1);
  assert.equal(draft.assets[0].path,background.asset);
  assert.equal(sourceSite.validateAssets(draft.assets,source,draft.scene).length,1);
  assert.equal(await page.locator('#background-restore').isDisabled(),false);
  await page.locator('#undo').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).assets.length,0);
  await page.locator('#redo').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).assets.length,1);
  await page.locator('#background-restore').click();
  assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).assets.length,0);
  assert.deepEqual(errors,[]);
  console.log('PASS room background: intrinsic pixels, 2:1 framing, phone/ultrawide visible field, WebP export/import, undo/redo and draft restore');
}finally{await browser?.close();server.kill('SIGTERM');}
