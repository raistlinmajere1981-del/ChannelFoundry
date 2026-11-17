import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
const origin='http://127.0.0.1:5293';
const artifacts=new URL('../../../artifacts/robe-veil-controls/',import.meta.url).pathname;
await mkdir(artifacts,{recursive:true});
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5293'],{
  cwd:new URL('..',import.meta.url).pathname,stdio:'pipe'});
let browser;
try{
  let online=false;
  for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){online=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(online);
  const site=siteSceneSource(),source=await site.snapshot();
  const packet={scene:source.scene,presentation:source.presentation,siteSource:true,
    previewImage:await site.preview(source),background:site.backgroundInfo(source),
    previewObjects:site.previewObjects(source),objectVisuals:site.objectVisuals(source),
    previewArt:site.previewArt(source),roomObjects:site.roomObjects(source),focusTargets:site.focusTargets(source),
    sourceHash:source.sourceHash,readiness:site.readiness(source.scene,source),assets:[]};
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
    headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(data=>{
    window.channelFoundryStudio={sceneWorkshopLoad:async()=>data,onSceneWorkshopProgress:()=>()=>{}};
    window.__mountStudioSceneV3();
  },packet);
  await page.locator('#object-select-ceremonial-robe').click();
  await page.locator('#robe-veil-settings').evaluate(n=>{n.open=true;});
  const robe=s=>s.objects.find(o=>o.id==='ceremonial-robe');
  const before=await page.evaluate(()=>window.__sceneEditor.getScene());
  const host=page.locator('#stage-object-ceremonial-robe');
  const image=host.locator('[data-effect-layer="fabric"] img');
  const edge=host.locator('.scene-robe-preview-edge');
  const refraction=host.locator('.scene-robe-preview-refraction');
  const stats=locator=>locator.evaluate(c=>{
    const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let count=0,sum=0,max=0;for(let i=3;i<d.length;i+=4){if(d[i])count++;sum+=d[i];max=Math.max(max,d[i]);}
    return {count,sum,max,width:c.width,height:c.height};
  });
  const set=async(key,value)=>{
    const input=page.locator('#robe-veil-'+key);
    await input.fill(String(value));await input.press('Tab');
    await image.evaluate(n=>n.decode());
    await page.waitForFunction(()=>{
      const n=document.querySelector('.scene-robe-preview-edge');
      const item=window.__sceneEditor.getScene().objects.find(o=>o.veil);
      return n?.width===Math.round(item.pose.width*document.querySelector('#scene-photo').naturalWidth);
    });
    assert.equal(robe(await page.evaluate(()=>window.__sceneEditor.getScene())).veil[key],value);
  };
  await page.locator('#robe-veil-preview').click();
  await set('distortionPx',0);await set('residualOpacity',0);await set('edgeOpacity',0);
  assert.equal(await image.evaluate(n=>getComputedStyle(n).opacity),'0');
  assert.equal((await stats(edge)).sum,0);assert.equal((await stats(refraction)).sum,0);
  const hit=page.locator('#scene-hit-ceremonial-robe');
  assert.equal(await hit.evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)',
    'selection fill must not masquerade as residual fabric');
  await page.locator('.scene-stage-well').screenshot({path:artifacts+'zero.png'});
  await set('edgeOpacity',.06);const low=await stats(edge);
  assert(low.sum>100);assert(low.count<low.width*low.height*.1,'edge paints a contour, not a filled robe');
  await page.locator('.scene-stage-well').screenshot({path:artifacts+'edge-006.png'});
  await set('edgeOpacity',.35);const high=await stats(edge);
  assert(high.sum>low.sum*4,'selected edge value changes actual raster alpha');
  assert.equal((await stats(refraction)).sum,0,'edge remains visible with zero refraction');
  await page.locator('.scene-stage-well').screenshot({path:artifacts+'edge-035.png'});
  await set('edgeOpacity',0);assert.equal((await stats(edge)).sum,0);
  const invisible=await host.screenshot();
  await set('residualOpacity',.3);
  assert.equal(await image.evaluate(n=>getComputedStyle(n).opacity),'0.3');
  assert.notDeepEqual(await host.screenshot(),invisible,'fabric opacity changes rendered pixels');
  await page.locator('.scene-stage-well').screenshot({path:artifacts+'fabric-030.png'});
  await set('residualOpacity',.065);
  assert.equal(await image.evaluate(n=>getComputedStyle(n).opacity),'0.065');
  await set('distortionPx',.5);const faint=await stats(refraction);assert(faint.sum>100);
  const faintPixels=await refraction.evaluate(n=>n.toDataURL());
  await set('distortionPx',7);
  assert.notEqual(await refraction.evaluate(n=>n.toDataURL()),faintPixels,'refraction amount changes actual wall pixels');
  assert.equal((await stats(edge)).sum,0,'refraction never creates a silhouette edge at edge=0');
  const after=await page.evaluate(()=>window.__sceneEditor.getScene());
  assert.equal(site.readiness(after,source).ready,true);
  assert.deepEqual(after.objects.filter(o=>!o.veil),before.objects.filter(o=>!o.veil));
  assert.deepEqual(robe(after).pose,robe(before).pose);
  await page.locator('#robe-veil-preview').click();
  assert.equal(await image.evaluate(n=>n.style.opacity),'1');
  assert.equal(await edge.evaluate(n=>n.style.opacity),'0');
  assert.equal(await refraction.evaluate(n=>n.style.opacity),'0');
  assert.deepEqual(errors,[]);
  await writeFile(artifacts+'results.json',JSON.stringify({low,high,zeroDistortionEdgeWorks:true,residualOpacity:[0,.065,.3],distortion:[0,.5,7],sceneReady:true,errors},null,2)+'\n');
  console.log('PASS Studio: independent edge 0/.06/.35 at zero distortion, fabric 0/.065/.3, refraction 0/.5/7, clear selection, visible state and unchanged placement');
}finally{await browser?.close();server.kill('SIGTERM');}
