import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {closedBooksFor,closedBookRegion,closedBookHitPolygon} from '../../../channels/birdesengor/web/src/book/closedBookLayout.js';
import {validateScenePresentation} from '../../../packages/effect-engine/src/model/scene-presentation.mjs';

const site=siteSceneSource(),source=await site.snapshot();
// Isolated preview fixture: future site visibility edits must not make this editor test brittle.
const previewPresentation=structuredClone(source.presentation);
for(const entry of Object.values(previewPresentation.objects))entry.roomVisible=true;
const packet={scene:source.scene,presentation:previewPresentation,
  previewImage:await site.preview(source),previewObjects:site.previewObjects(source),
  previewArt:site.previewArt(source),roomObjects:site.roomObjects(source),
  focusTargets:site.focusTargets(source),sourceHash:source.sourceHash,
  readiness:site.readiness(source.scene,source),assets:[]};
const port=5321,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--strictPort','--port',String(port)],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',data=>log+=data);server.stderr.on('data',data=>log+=data);
let browser;
try{
  let ready=false;
  for(let i=0;i<130;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'Vite failed: '+log);
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{
    window.__sceneV3Packet=data;
    window.channelFoundryStudio={
      sceneWorkshopLoad:async()=>data,
      sceneWorkshopSave:async()=>({sourceHash:data.sourceHash,readiness:data.readiness,message:'Kaydedildi'}),
      onSceneWorkshopProgress:()=>()=>{},
    };
    window.__mountStudioSceneV3();
  },packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14,{timeout:15000});
  const snapshot=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
  const bookObject='research-journal';
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').count(),1);
  assert.equal(await page.locator('#preview-eye-'+bookObject).getAttribute('aria-pressed'),'true');
  const original=await snapshot();
  await page.locator('#preview-eye-'+bookObject).click();
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').count(),0,'local eye must hide physical book');
  assert.equal(await page.locator('#stage-object-'+bookObject).isHidden(),true,'local eye must hide overlay');
  assert.equal(await page.locator('#preview-eye-'+bookObject).getAttribute('aria-pressed'),'false');
  const afterEye=await snapshot();
  assert.deepEqual(afterEye.scene,original.scene,'preview visibility must not mutate scene');
  assert.deepEqual(afterEye.presentation,original.presentation,'preview visibility must not mutate site presentation');
  await page.locator('#preview-eye-'+bookObject).click();
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').count(),1);
  await page.locator('#object-select-'+bookObject).click();
  assert.equal(await page.locator('#presentation-roomVisible').isChecked(),true);
  await page.locator('#presentation-roomVisible').uncheck();
  let draft=await snapshot();
  assert.equal(draft.presentation.objects[bookObject].roomVisible,false);
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').count(),0);
  assert.deepEqual(draft.scene,source.scene,'publish visibility must change presentation alone');
  // A published-hidden object can be shown locally for editing without changing the published flag.
  await page.locator('#preview-eye-'+bookObject).click();
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').count(),1);
  assert.deepEqual((await snapshot()).presentation,draft.presentation);
  await page.locator('#preview-eye-'+bookObject).click();
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').count(),0);
  await page.locator('#undo').click();
  assert.equal((await snapshot()).presentation.objects[bookObject].roomVisible,true);
  await page.locator('#redo').click();
  assert.equal((await snapshot()).presentation.objects[bookObject].roomVisible,false);
  await page.locator('#presentation-roomVisible').check();

  // Both closed books follow the one source that the site and Studio preview share.
  await page.locator('#book-desk-x').fill('68.5');
  await page.locator('#book-desk-x').press('Tab');
  draft=await snapshot();
  assert.equal(draft.presentation.objects[bookObject].closedBook.x,.685);
  assert.equal(await page.locator('[data-room-object="'+bookObject+'"]').evaluate(node=>node.style.left),'68.5%');
  let books=closedBooksFor(draft.presentation);
  const moved=books.find(book=>book.id===bookObject),region=closedBookRegion(moved);
  assert.equal(moved.x,.685);
  assert.ok(region.width>0&&region.height>0);
  assert.ok(closedBookHitPolygon(moved,region).startsWith('polygon('));
  await page.locator('#object-select-community-journal').click();
  await page.locator('#book-desk-angle').fill('-7');
  await page.locator('#book-desk-angle').press('Tab');
  await page.locator('#book-desk-width').fill('23');
  await page.locator('#book-desk-width').press('Tab');
  draft=await snapshot();
  assert.equal(draft.presentation.objects['community-journal'].closedBook.angle,-7);
  assert.equal(draft.presentation.objects['community-journal'].closedBook.width,.23);
  assert.equal(draft.presentation.objects[bookObject].closedBook.x,.685);
  // Dragging the closed physical book edits the same validated placement object.
  await page.locator('#visual-edit-mode').click();
  const physical=page.locator('[data-room-object="community-journal"]');
  const rect=await physical.boundingBox();assert.ok(rect);
  const originalX=(await snapshot()).presentation.objects['community-journal'].closedBook.x;
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();
  await page.mouse.move(rect.x+rect.width/2+18,rect.y+rect.height/2+6,{steps:5});
  await page.mouse.up();
  const afterDrag=await snapshot();
  assert.notEqual(afterDrag.presentation.objects['community-journal'].closedBook.x,originalX,'desk drag changes x');
  assert.deepEqual(afterDrag.scene,source.scene,'book drag does not mutate effect scene');
  draft=afterDrag;
  assert.equal(validateScenePresentation(draft.presentation),draft.presentation);
  assert.equal(site.readiness(draft.scene,source,draft.presentation).ready,true);

  // Existing independent artwork visibility is publishable; photographic objects are only local preview masks.
  await page.locator('#preview-eye-candle').click();
  assert.equal(await page.locator('#stage-object-candle').isHidden(),true);
  assert.equal(await page.locator('#scene-photo').isVisible(),true,'cannot erase candle embedded in photographic source');
  assert.deepEqual((await snapshot()).scene,source.scene);
  await page.locator('#preview-eye-candle').click();
  assert.deepEqual(errors,[]);
  console.log('PASS local eye vs published visibility, closed book placement, hit polygon, undo/redo, photo boundary, source integrity');
}finally{await browser?.close();server.kill('SIGTERM');}
