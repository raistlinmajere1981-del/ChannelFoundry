import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
const site=siteSceneSource(),source=await site.snapshot();
const posterId='ABcDeFGhij0',posterUrl='https://i.ytimg.com/vi/'+posterId+'/mqdefault.jpg';
const packet={cameraCover:{url:posterUrl,videoId:posterId,publishedAt:'2026-11-09'},
  scene:source.scene,presentation:source.presentation,sourceHash:source.sourceHash,
  background:site.backgroundInfo(source),
  previewImage:await site.preview(source),previewObjects:site.previewObjects(source),
  previewArt:site.previewArt(source),roomObjects:site.roomObjects(source),
  focusTargets:site.focusTargets(source),readiness:site.readiness(source.scene,source),assets:[]};
const port=5323,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--strictPort','--port',String(port)],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',data=>log+=data);server.stderr.on('data',data=>log+=data);
let browser;
try {
  let ready=false;
  for(let i=0;i<150;i++){
    try {if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}
    catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,log);
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1580,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.stack));
  await page.route('https://i.ytimg.com/**',route=>route.fulfill({
    status:200,contentType:'image/svg+xml',
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#4a5346"/></svg>'
  }));
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
  const snap=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
  const original=await snap();
  const book=page.locator('[data-room-object="research-journal"]');
  await page.locator('#show-markers').click();
  await book.hover();
  await page.waitForFunction(()=>document.querySelector(
    '[data-room-object="research-journal"] > canvas.object-effect-overlay'
  )?.style.display==='block',null,{timeout:5000});
  assert.equal(await book.locator('canvas.object-effect-overlay').count(),1,
    'Studio seal trace follows the real photo cover, not the proxy object');
  assert.equal(await book.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)',
    'hovered transparent cover must not acquire a grey button rectangle');
  await page.locator('#object-select-research-journal').click();
  assert.equal(await page.locator('#scene-focus-toolbar').isVisible(),true);
  await page.locator('[data-focus-state="approach"]').click();
  assert.equal(await page.locator('#scene-viewport').evaluate(node=>node.classList.contains('presentation-preview')),true);
  await page.locator('[data-focus-state="return"]').click();
  assert.equal(await page.locator('[data-focus-state="return"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-focus-state="open"]').click();
  assert.equal(await page.locator('#scene-focus-overlay').isVisible(),true);
  assert.equal(await page.locator('#scene-focus-overlay').getAttribute('data-kind'),'research-journal');
  assert.equal(await page.locator('#scene-focus-overlay .scene-focus-leaf').count(),2);
  await page.locator('#focus-preview-device').selectOption('mobile');
  assert.equal(await page.locator('#scene-focus-overlay').getAttribute('data-device'),'mobile');
  assert.equal(await page.locator('#scene-screen-preview').getAttribute('data-simulated'),'true');
  assert.equal(await page.locator('#scene-focus-overlay .scene-focus-leaf--left').isVisible(),false);
  // Physical book composition honours mobile-specific reading insets.
  await page.locator('#book-readingPadXMobile').fill('9');
  await page.locator('#book-readingPadXMobile').press('Tab');
  assert.equal(await page.locator('.scene-focus-book').evaluate(node=>node.style.getPropertyValue('--book-pad-x')),'9%');
  await page.locator('#object-select-camera').click();
  assert.equal(await page.locator('#scene-focus-overlay').getAttribute('data-kind'),'camera');
  assert.equal(await page.locator('.scene-focus-lcd').count(),1);
  assert.equal(await page.locator('.scene-focus-poster-art').count(),1,'same local approved cover previewed in Studio');
  assert.equal(await page.locator('.scene-focus-poster-art').getAttribute('src'),posterUrl);
  assert.equal(await page.locator('.scene-focus-poster-art').evaluate(node=>getComputedStyle(node).objectFit),'contain');
  await page.locator('.scene-book-controls > summary').filter({hasText:'Son bölüm afişi'}).click();
  await page.locator('#physical-coverBrightness').fill('110');
  await page.locator('#physical-coverBrightness').press('Tab');
  assert.equal(await page.locator('.scene-focus-poster').evaluate(node=>node.style.getPropertyValue('--camera-cover-brightness')),'1.1');
  await page.locator('#physical-coverScale').fill('115');
  await page.locator('#physical-coverScale').press('Tab');
  assert.equal(await page.locator('.scene-focus-poster').evaluate(node=>node.style.getPropertyValue('--camera-cover-scale')),'1.15');
  const withPoster=await snap();
  assert.deepEqual(withPoster.scene,original.scene,'poster preview cannot affect effect scene');
  await page.locator('#camera-poster-preview-toggle').click();
  assert.equal(await page.locator('.scene-focus-lcd-layout').count(),1,'open archive remains previewable');
  await page.locator('#camera-poster-preview-toggle').click();
  assert.equal(await page.locator('.scene-focus-poster-art').count(),1);
  await page.locator('.scene-book-controls > summary').filter({hasText:'Arşiv ve oynatıcı'}).click();
  await page.locator('#physical-hingeAngle').fill('8');
  await page.locator('#physical-hingeAngle').press('Tab');
  assert.match(await page.locator('.scene-focus-lcd').evaluate(node=>node.style.transform),/rotateY\(8deg\)/);
  await page.locator('#object-select-vefk-stand').click();
  assert.equal(await page.locator('#scene-focus-overlay').getAttribute('data-kind'),'vefk-stand');
  const before=await page.locator('.scene-focus-quill').evaluate(node=>node.style.left);
  await page.locator('.scene-book-controls > summary').filter({hasText:'Divit dinlenme konumu'}).click();
  await page.locator('#physical-quillDockX').fill('12');
  await page.locator('#physical-quillDockX').press('Tab');
  await page.locator('#physical-quillRestAngle').fill('20');
  await page.locator('#physical-quillRestAngle').press('Tab');
  assert.notEqual(await page.locator('.scene-focus-quill').evaluate(node=>node.style.left),before);
  assert.match(await page.locator('.scene-focus-quill').evaluate(node=>node.style.transform),/rotate\(6deg\)/);
  const after=await snap();
  assert.equal(after.presentation.objects['vefk-stand'].physical.mobile.quillDockX,12);
  assert.equal(after.presentation.objects['vefk-stand'].physical.mobile.quillRestAngle,20);
  assert.equal(site.readiness(after.scene,source,after.presentation).ready,true);
  assert.deepEqual(after.scene,original.scene,'preview and device controls cannot rewrite authored effects');
  await page.locator('[data-focus-state="room"]').click();
  assert.equal(await page.locator('#scene-focus-overlay').isVisible(),false);
  assert.equal(await page.locator('#scene-focus-toolbar').isVisible(),true);
  await page.locator('#object-select-candle').click();
  assert.equal(await page.locator('#scene-focus-toolbar').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS four focus states + mobile framing, physical near preview, book material, camera hinge, quill docking, transparent hover, site validation');
} finally {
  await browser?.close();server.kill('SIGTERM');
}
