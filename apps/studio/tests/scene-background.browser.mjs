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
  previewObjects:sourceSite.previewObjects(source),previewArt:sourceSite.previewArt(source),
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
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14);
  await page.locator('#open-background').click();
  assert.equal(await page.locator('[data-inspector-page="background"]').isVisible(),true);
  assert.equal(await page.locator('#background-original-dimensions').textContent(),background.width+' × '+background.height+' px');
  assert.equal(await page.locator('#background-visible-fraction').textContent(),'%100');
  assert.equal(await page.locator('#background-restore').isDisabled(),true);
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
