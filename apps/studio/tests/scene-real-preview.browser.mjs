import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';

const site=siteSceneSource(),source=await site.snapshot();
const packet={
  scene:source.scene,presentation:source.presentation,siteSource:true,
  previewImage:await site.preview(source),background:site.backgroundInfo(source),
  previewObjects:site.previewObjects(source),previewArt:site.previewArt(source),
  roomObjects:site.roomObjects(source),focusTargets:site.focusTargets(source),
  readiness:site.readiness(source.scene,source),sourceHash:source.sourceHash,assets:[],
};
const origin='http://127.0.0.1:5342';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--strictPort','--port','5342'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let serverLog='';server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
let browser;
try{
  let ready=false;
  for(let i=0;i<140;i++){
    try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}
    catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(ready,serverLog);
  browser=await chromium.launch({
    executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],
  });
  const page=await browser.newPage({viewport:{width:1580,height:900}});
  const errors=[];page.on('pageerror',err=>errors.push(err.stack));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{
    window.__captureRequest=null;
    window.__actions=[];
    window.__closedSessions=[];
    window.channelFoundryStudio={
      sceneWorkshopProjects:async()=>[{id:'birdesengor',label:'BirDeSenGör',siteBound:true,canPublish:true}],
      sceneWorkshopLoad:async()=>data,
      sceneWorkshopCapture:async request=>{
        window.__captureRequest=request;
        if(window.__captureFail)throw Error('Yerel görüntü denetim hatası');
        return {
          image:'data:image/jpeg;base64,/9j/2Q==',width:390,height:844,sessionId:'test-session',
          object:request.objectId,phase:'active',stage:'open',
          overflow:{left:0,right:0,top:0,bottom:0},visible:true,
          syntheticContent:true,timingSlowed:true,note:'Sentetik içerik',sourceHash:data.sourceHash,
        };
      },
      sceneWorkshopInteract:async input=>{
        window.__actions.push(input);
        return {image:'data:image/jpeg;base64,/9j/2Q==',width:390,height:844,
          sessionId:input.sessionId,phase:'active',stage:'open',activeObject:'research-journal'};
      },
      sceneWorkshopCaptureClose:async input=>{window.__closedSessions.push(input.sessionId);return {ok:true};},
      onSceneWorkshopProgress:()=>()=>{},
    };
    window.__mountStudioSceneV3();
  },packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14);
  await page.locator('#object-select-candle').click();
  assert.equal(await page.locator('#focus-real-capture').isVisible(),false,
    'preview requires a selected focus object');
  await page.locator('#object-select-research-journal').click();
  assert.equal(await page.locator('#focus-real-capture').isEnabled(),true);
  await page.locator('[data-focus-state="open"]').click();
  await page.locator('#focus-preview-device').selectOption('mobile');
  await page.locator('#focus-real-capture').click();
  assert.equal(await page.locator('#scene-real-preview-dialog').isVisible(),true);
  await page.waitForFunction(()=>document.querySelector('#scene-real-preview-image')?.hidden===false);
  const request=await page.evaluate(()=>window.__captureRequest);
  assert.equal(request.objectId,'research-journal');
  assert.equal(request.stage,'open');
  assert.equal(request.device,'mobile');
  assert.equal(request.expectedSourceHash,source.sourceHash);
  assert.equal(request.scene.effects.length,22);
  assert.deepEqual(request.presentation,source.presentation,'opening screenshot does not mutate draft');
  assert.match(await page.locator('#scene-real-preview-meta').innerText(),/SENTETİK İÇERİK/);
  assert.match(await page.locator('#scene-real-preview-meta').innerText(),/Geçiş yalnız yakalamada yavaşlatıldı/);
  assert.equal(await page.locator('#scene-real-preview-navigation').isVisible(),true);
  await page.locator('#scene-real-preview-refresh').click();
  await page.waitForFunction(()=>window.__actions.length===1);
  assert.equal(await page.evaluate(()=>window.__actions[0].action),'refresh');
  await page.locator('#scene-real-preview-dialog').press('ArrowRight');
  await page.waitForFunction(()=>window.__actions.length===2);
  assert.equal(await page.evaluate(()=>window.__actions[1].key),'ArrowRight');
  await page.locator('#scene-real-preview-close').click();
  await page.waitForFunction(()=>window.__closedSessions.length===1);
  assert.deepEqual(await page.evaluate(()=>window.__closedSessions),['test-session']);
  assert.equal(await page.locator('#scene-real-preview-dialog').isVisible(),false);
  await page.evaluate(()=>window.__captureFail=true);
  await page.locator('#focus-real-capture').click();
  await page.waitForFunction(()=>document.querySelector('#scene-real-preview-message')?.textContent.includes('Yerel görüntü denetim hatası'));
  assert.equal(await page.locator('#scene-real-preview-image').isVisible(),false,
    'failed capture never displays stale photo');
  await page.locator('#scene-real-preview-close').click();
  assert.equal(await page.getByText('Kaydedilmedi', {exact:false}).count(),0,
    'one-shot runtime capture is not a draft mutation');
  assert.deepEqual(errors,[]);
  console.log('PASS real web capture UI: on-demand, draft/device/state snapshot, dialog, failure isolation, no dirty flag');
}finally{await browser?.close();server.kill('SIGTERM');}
