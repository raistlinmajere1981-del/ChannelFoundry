import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource,BIRDESENGOR_SITE} from '../scene-workshop-site.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const origin='http://127.0.0.1:5294';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5294'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try{
  let ok=false;
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.equal(ok,true,'Studio preview server did not start: '+log);
  const site=siteSceneSource(),source=await site.snapshot();
  const packet={type:'studio:load',scene:source.scene,siteSource:true,assets:[],
    previewImage:await site.preview(source),previewObjects:site.previewObjects(source)};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v2-harness.html?embedded=1',{waitUntil:'domcontentloaded'});
  await page.evaluate(message=>window.postMessage(message,'*'),packet);
  await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22,{timeout:20000});
  await page.locator('#object-select-stone-specimen').click();
  assert.equal(await page.locator('#visual-source-settings').isVisible(),true);
  assert.equal(await page.locator('#visual-crop-settings').isVisible(),true);
  await page.locator('#visual-crop-top').fill('12');
  await page.locator('#visual-crop-top').press('Tab');
  const scene=await page.evaluate(()=>window.__sceneEditor.getScene());
  const rock=scene.objects.find(item=>item.id==='stone-specimen');
  assert.equal(rock.crop.top,.12);
  assert.match(await page.locator('#stage-object-stone-specimen [data-effect-layer="rock"]').evaluate(node=>node.style.clipPath),/inset\(12%/);
  await page.locator('#visual-crop-desk-enabled').check();
  const clip=await page.locator('#stage-object-stone-specimen [data-effect-layer="rock"]').evaluate(node=>node.style.clipPath);
  assert.ok(clip.includes('inset('));
  const photo=readFileSync(BIRDESENGOR_SITE+'/public/scene-assets/stone/jade-rock.webp');
  await page.locator('#visual-source-file').setInputFiles({name:'replacement.webp',mimeType:'image/webp',buffer:photo});
  await page.waitForFunction(()=>document.querySelector('#visual-source-inspector')?.textContent.includes('Yeni kaynak taslakta'),{timeout:20000});
  const fetchDraft=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
    const requestId='test-'+Math.random(),timeout=setTimeout(()=>reject(Error('scene:get timeout')),6000);
    const listener=event=>{if(event.data?.requestId!==requestId||event.data.type!=='studio:data')return;
      clearTimeout(timeout);window.removeEventListener('message',listener);resolve(event.data);};
    window.addEventListener('message',listener);
    window.postMessage({type:'studio:get',requestId},'*');
  }));
  const draft=await fetchDraft();
  assert.equal(draft.assets.length,1);
  assert.equal(draft.assets[0].path,'/scene-assets/stone/jade-rock.webp');
  assert.match(draft.assets[0].dataUrl,/^data:image\/webp;base64,/);
  const prepared=site.validateAssets(draft.assets,source);
  assert.equal(prepared.length,1);
  assert.equal(site.readiness(draft.scene,source).ready,true);
  await page.locator('#visual-source-restore').click();
  assert.equal((await fetchDraft()).assets.length,0);
  assert.deepEqual(errors,[]);
  console.log('PASS scene crop, desk occlusion, WebP source selection, draft transport and restore');
}finally{await browser?.close();server.kill('SIGTERM');}
