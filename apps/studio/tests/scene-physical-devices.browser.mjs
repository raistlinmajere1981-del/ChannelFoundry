import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),origin='http://127.0.0.1:5299';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5299'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'studio preview server: '+log);
 const site=siteSceneSource(),source=await site.snapshot();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
   headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
 await page.evaluate(packet=>window.postMessage(packet,'*'),{
  type:'studio:load',scene:source.scene,presentation:source.presentation,siteSource:true,
  previewImage:await site.preview(source),previewObjects:site.previewObjects(source),
  focusTargets:site.focusTargets(source),assets:[],
 });
 await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,{timeout:20000});
 const get=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
  const requestId='physical-'+Math.random(),timeout=setTimeout(()=>reject(Error('timeout')),5000);
  const listener=e=>{if(e.data?.requestId!==requestId||e.data.type!=='studio:data')return;
    clearTimeout(timeout);window.removeEventListener('message',listener);resolve(e.data);};
  window.addEventListener('message',listener);window.postMessage({type:'studio:get',requestId},'*');
 }));
 const change=async(selector,value)=>{
   await page.locator(selector).fill(String(value));
   await page.locator(selector).press('Tab');
 };
 await page.locator('#object-select-camera').click();
 assert.equal(await page.locator('#physical-offsetX').inputValue(),'0');
 await change('#physical-offsetX',8);
 await change('#physical-widthScale',103);
 await page.locator('.scene-book-controls > summary').filter({hasText:'LCD iç boşluklar'}).click();
 await change('#physical-bezelPaddingX',29);
 await page.locator('.scene-book-controls > summary').filter({hasText:'Arşiv ve oynatıcı'}).click();
 await change('#physical-archiveWidth',355);
 await change('#physical-hingeAngle',7);
 let draft=await get();
 let camera=draft.presentation.objects.camera.physical;
 assert.equal(camera.desktop.offsetX,8);
 assert.equal(camera.desktop.widthScale,1.03);
 assert.equal(camera.desktop.bezelPaddingX,29);
 assert.equal(camera.desktop.archiveWidth,355);
 assert.equal(camera.desktop.hingeAngle,7);
 await page.locator('#presentation-device').selectOption('mobile');
 assert.equal(await page.locator('#physical-widthScale').inputValue(),'100');
 await change('#physical-offsetY',-10);
 await change('#physical-heightScale',98);
 if(!await page.locator('[data-panel-key="physical-LCD iç boşluklar"]').evaluate(n=>n.open))
   await page.locator('[data-panel-key="physical-LCD iç boşluklar"] > summary').click();
 await change('#physical-contentPadding',13);
 draft=await get();camera=draft.presentation.objects.camera.physical;
 assert.equal(camera.mobile.offsetY,-10);
 assert.equal(camera.mobile.heightScale,.98);
 assert.equal(camera.mobile.contentPadding,13);
 assert.equal(camera.desktop.contentPadding,14);
 await page.locator('#undo').click();
 assert.equal((await get()).presentation.objects.camera.physical.mobile.contentPadding,11);
 await page.locator('#redo').click();
 assert.equal((await get()).presentation.objects.camera.physical.mobile.contentPadding,13);
 await page.locator('#object-select-vefk-stand').click();
 assert.equal(await page.locator('#physical-paperScale').inputValue(),'100');
 await change('#physical-paperX',12);
 await change('#physical-paperY',-8);
 await change('#physical-paperScale',104);
 await page.locator('.scene-book-controls > summary').filter({hasText:'Donanım yerleşimi'}).click();
 await change('#physical-inkwellX',-6);
 await page.locator('.scene-book-controls > summary').filter({hasText:'Divit dinlenme konumu'}).click();
 await change('#physical-quillDockX',9);
 await change('#physical-quillDockY',-5);
 await change('#physical-quillRestAngle',19);
 await change('#physical-topRailY',9);
 await change('#physical-rulerX',11);
 await page.locator('.scene-book-controls > summary').filter({hasText:'Katalog kapağı'}).click();
 await change('#physical-catalogX',14);
 draft=await get();let vefk=draft.presentation.objects['vefk-stand'].physical;
 assert.equal(vefk.mobile.paperX,12);
 assert.equal(vefk.mobile.paperScale,1.04);
 assert.equal(vefk.mobile.inkwellX,-6);
 assert.equal(vefk.mobile.quillDockX,9);
 assert.equal(vefk.mobile.quillDockY,-5);
 assert.equal(vefk.mobile.quillRestAngle,19);
 assert.equal(vefk.mobile.topRailY,9);
 assert.equal(vefk.mobile.rulerX,11);
 assert.equal(vefk.mobile.catalogX,14);
 assert.equal(vefk.desktop.paperX,0);
 await page.locator('#presentation-device').selectOption('desktop');
 await change('#physical-paperX',-12);
 draft=await get();
 assert.equal(draft.presentation.objects['vefk-stand'].physical.desktop.paperX,-12);
 assert.equal(draft.presentation.objects['vefk-stand'].physical.mobile.paperX,12);
 assert.equal(site.readiness(draft.scene,source,draft.presentation).ready,true);
 assert.deepEqual(draft.scene,source.scene,'presentation leaves effect scene untouched');
 await page.locator('#presentation-reset').click();
 draft=await get();
 assert.deepEqual(draft.presentation.objects['vefk-stand'],source.presentation.objects['vefk-stand']);
 assert.equal(draft.presentation.objects.camera.physical.mobile.contentPadding,13);
 await page.locator('#object-select-research-journal').click();
 assert.equal(await page.locator('#physical-paperScale').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS camera LCD + Vefk physical control groups, device isolation, undo/redo and reset');
}finally{await browser?.close();server.kill('SIGTERM');}
