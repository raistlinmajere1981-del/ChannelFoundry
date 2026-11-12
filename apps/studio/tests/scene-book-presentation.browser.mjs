import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const origin='http://127.0.0.1:5298';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5298'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try {
  let ready=false;
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/scene.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.equal(ready,true,'Studio scene preview server: '+log);
  const site=siteSceneSource(),source=await site.snapshot();
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/scene.html?embedded=1',{waitUntil:'domcontentloaded'});
  await page.evaluate(packet=>window.postMessage(packet,'*'),{
    type:'studio:load',scene:source.scene,presentation:source.presentation,siteSource:true,
    previewImage:await site.preview(source),previewObjects:site.previewObjects(source),
    focusTargets:site.focusTargets(source),assets:[],
  });
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,{timeout:20000});
  const get=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
    const requestId='book-check-'+Math.random(),timeout=setTimeout(()=>reject(Error('Book draft timeout')),8000);
    const listener=event=>{if(event.data?.requestId!==requestId||event.data.type!=='studio:data')return;
      clearTimeout(timeout);window.removeEventListener('message',listener);resolve(event.data);};
    window.addEventListener('message',listener);
    window.postMessage({type:'studio:get',requestId},'*');
  }));
  const change=async(id,value)=>{
    await page.locator(id).fill(String(value));
    await page.locator(id).press('Tab');
  };
  await page.locator('#object-select-research-journal').click();
  assert.equal(await page.locator('#focus-presentation-settings').isVisible(),true);
  assert.equal(await page.locator('#book-turnMs').inputValue(),'840');
  await change('#book-turnMs',960);
  await change('#book-thickness',32);
  await change('#book-pageRatio',84);
  await change('#book-depthDesktop',58);
  await change('#book-readingPadXDesktop',9);
  await change('#book-ribbon-widthDesktop',55);
  let draft=await get();
  let universe=draft.presentation.objects['research-journal'].book;
  assert.equal(universe.turnMs,960);
  assert.equal(universe.thickness,32);
  assert.equal(universe.pageRatio,.84);
  assert.equal(universe.depthDesktop,58);
  assert.equal(universe.readingPadXDesktop,9);
  assert.equal(universe.ribbon.widthDesktop,55);
  await page.locator('#presentation-device').selectOption('mobile');
  assert.equal(await page.locator('#book-readingPadXMobile').inputValue(),'8');
  await change('#book-mobilePageRatio',62);
  await change('#book-readingPadYMobile',9);
  await change('#book-ribbon-offsetMobile',-7);
  await change('#book-ribbon-widthMobile',46);
  draft=await get();universe=draft.presentation.objects['research-journal'].book;
  assert.equal(universe.mobilePageRatio,.62);
  assert.equal(universe.readingPadYMobile,9);
  assert.equal(universe.ribbon.offsetMobile,-7);
  assert.equal(universe.ribbon.widthMobile,46);
  await page.locator('#undo').click();
  assert.equal((await get()).presentation.objects['research-journal'].book.ribbon.widthMobile,44);
  await page.locator('#redo').click();
  assert.equal((await get()).presentation.objects['research-journal'].book.ribbon.widthMobile,46);
  await page.locator('#object-select-community-journal').click();
  assert.equal(await page.locator('#book-index-topMobile').inputValue(),'5');
  await change('#book-index-topMobile',8);
  await change('#book-index-gapMobile',20);
  await change('#book-readingPadXMobile',8.5);
  draft=await get();
  assert.equal(draft.presentation.objects['community-journal'].book.indexes.topMobile,8);
  assert.equal(draft.presentation.objects['community-journal'].book.indexes.gapMobile,20);
  assert.equal(draft.presentation.objects['community-journal'].book.readingPadXMobile,8.5);
  assert.equal(draft.presentation.objects['research-journal'].book.ribbon.widthMobile,46);
  assert.deepEqual(draft.scene,source.scene,'Book tuning never mutates object/effect inventory');
  assert.equal(site.readiness(draft.scene,source,draft.presentation).ready,true);
  await page.locator('#presentation-reset').click();
  draft=await get();
  assert.deepEqual(draft.presentation.objects['community-journal'],source.presentation.objects['community-journal']);
  assert.equal(draft.presentation.objects['research-journal'].book.turnMs,960);
  await page.locator('#object-select-camera').click();
  assert.equal(await page.locator('#book-turnMs').count(),0,'Camera has no book-only controls');
  assert.deepEqual(errors,[]);
  console.log('PASS book cover, page, ribbons, indexes, reading insets, mobile/desktop, undo/redo and selective reset');
} finally {await browser?.close();server.kill('SIGTERM');}
