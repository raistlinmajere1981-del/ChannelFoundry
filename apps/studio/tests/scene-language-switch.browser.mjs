import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';

const site=siteSceneSource(),source=await site.snapshot();
const data={scene:source.scene,presentation:source.presentation,siteSource:true,
  previewImage:await site.preview(source),background:site.backgroundInfo(source),
  previewObjects:site.previewObjects(source),previewArt:site.previewArt(source),
  roomObjects:site.roomObjects(source),focusTargets:site.focusTargets(source),
  assets:[],readiness:site.readiness(source.scene,source),
  sourceHash:source.sourceHash,note:'Sahne açıldı'};
const origin='http://127.0.0.1:5299';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5299'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Vite unavailable '+logs);
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1560,height:900}});
 const errors=[];page.on('pageerror',error=>errors.push(error.stack));
 await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(data=>{
  window.__lastSceneSave=null;
  window.channelFoundryStudio={
   sceneWorkshopLoad:async()=>data,
   sceneWorkshopSave:async input=>{window.__lastSceneSave=input;
     return {sourceHash:data.sourceHash,readiness:data.readiness,message:'Kaydedildi'};},
   onSceneWorkshopProgress:()=>()=>{},
  };
  window.__mountStudioSceneV3();
 },data);
 await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14);
 assert.equal(await page.locator('.scene-tree-object').count(),14);
 assert.equal(await page.locator('.scene-tree-control').count(),1);
 assert.equal(await page.locator('#scene-language-switch').count(),1);
 await page.locator('#scene-control-select-languageSwitch').click();
 assert.equal(await page.locator('[data-inspector-page="control"]').isVisible(),true);
 assert.equal(await page.locator('#language-x').inputValue(),'22');
 assert.equal(await page.locator('#language-y').inputValue(),'90.5');
 assert.equal(await page.locator('#scene-language-switch').getAttribute('data-selected'),'true');
 await page.locator('#language-x').fill('25.5');
 await page.locator('#language-x').press('Tab');
 assert.equal(await page.evaluate(()=>window.__sceneEditor.snapshot().presentation.controls.languageSwitch.desktop.x),25.5);
 await page.locator('#undo').click();
 assert.equal(await page.evaluate(()=>window.__sceneEditor.snapshot().presentation.controls.languageSwitch.desktop.x),22);
 await page.locator('#redo').click();
 assert.equal(await page.evaluate(()=>window.__sceneEditor.snapshot().presentation.controls.languageSwitch.desktop.x),25.5);
 await page.locator('#language-plateScale').fill('112');
 await page.locator('#language-plateScale').press('Tab');
 await page.locator('#language-skew').fill('-20');
 await page.locator('#language-skew').press('Tab');
 await page.locator('#language-hitWidth').fill('128');
 await page.locator('#language-hitWidth').press('Tab');
 await page.locator('#language-preview-en').click();
 assert.equal(await page.locator('#scene-language-switch .scene-switch-track').getAttribute('data-language'),'en');
 await page.locator('#language-device').selectOption('mobile');
 assert.equal(await page.locator('#language-bottom').inputValue(),'28');
 assert.equal(await page.locator('#scene-screen-preview').getAttribute('data-simulated'),'true');
 await page.locator('#language-x').fill('17.5');await page.locator('#language-x').press('Tab');
 await page.locator('#language-bottom').fill('36');await page.locator('#language-bottom').press('Tab');
 const draft=await page.evaluate(()=>window.__sceneEditor.snapshot());
 assert.equal(draft.presentation.controls.languageSwitch.mobile.x,17.5);
 assert.equal(draft.presentation.controls.languageSwitch.mobile.bottom,36);
 assert.equal(draft.presentation.controls.languageSwitch.desktop.plateScale,1.12);
 assert.equal(draft.presentation.controls.languageSwitch.desktop.skew,-20);
 assert.equal(draft.presentation.controls.languageSwitch.desktop.hitWidth,1.28);
 assert.equal(site.readiness(draft.scene,source,draft.presentation).ready,true);
 await page.getByRole('button',{name:/^Kaydet/}).click();
 await page.waitForFunction(()=>window.__lastSceneSave?.presentation?.controls?.languageSwitch?.mobile?.bottom===36);
 await page.locator('#open-background').click();
 await page.locator('#background-screen-preset').selectOption('1366x768');
 assert.equal(await page.locator('#scene-language-switch').evaluate(n=>n.style.left),'25.5%');
 await page.locator('#background-screen-preset').selectOption('390x844');
 assert.equal(await page.locator('#scene-language-switch').evaluate(n=>n.style.left),'17.5%');
 await page.locator('#object-select-camera').click();
 assert.equal(await page.locator('[data-inspector-tab="focus"]').getAttribute('aria-selected'),'true');
 await page.locator('#scene-control-select-languageSwitch').click();
 await page.locator('#language-device').selectOption('mobile');
 await page.locator('#visual-edit-mode').click();
 const node=page.locator('#scene-language-switch');
 const before=(await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.controls.languageSwitch.mobile;
 const box=await node.boundingBox();assert.ok(box);
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+9,box.y+box.height/2-3,{steps:5});
 await page.mouse.up();
 const after=(await page.evaluate(()=>window.__sceneEditor.snapshot())).presentation.controls.languageSwitch.mobile;
 assert.notEqual(after.x,before.x,'dragged language switch updates independent site control coordinates');
 assert.equal((await page.evaluate(()=>window.__sceneEditor.snapshot())).scene.objects.length,14);
 assert.deepEqual(errors,[]);
 console.log('PASS language switch Studio: tree, desktop/mobile, physical controls, stage preview, drag, history, save, original scene inventory');
}finally{await browser?.close();server.kill('SIGTERM');}
