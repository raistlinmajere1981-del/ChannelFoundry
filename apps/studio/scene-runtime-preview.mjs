/**
 * Read-only, on-demand capture of the ACTUAL BirDeSenGör React room.
 * Never writes site files, a scene draft, cookies or publication. It spins up a
 * loopback-only Vite process + disposable Chromium context and closes both.
 * Production content is NOT retrieved: an explicit synthetic fixture keeps
 * the capture isolated from accounts, community and analytics.
 */
import {createServer} from 'vite';
import {chromium} from '../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {syntheticBookPublication} from '../../channels/birdesengor/web/tests/fixtures/p75-book-fixture.mjs';
import {existsSync,readdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {BIRDESENGOR_SITE,siteSceneSource} from './scene-workshop-site.mjs';

const FOCUS=new Set(['research-journal','community-journal','camera','vefk-stand']);
const STAGES=new Set(['room','approach','open','return']);
const DEVICES=Object.freeze({desktop:{width:1366,height:768},mobile:{width:390,height:844}});
// 25 MiB V2 scene + at most 24 MiB validated WebP payload encoded as base64.
// A 27 MiB IPC cap incorrectly rejected otherwise valid combined drafts.
const LIMIT=64*1024*1024;
const INTERACTION_TTL_MS=120_000;
const sessions=new Map();
async function disposeSession(id){
 const session=sessions.get(id);
 if(!session)return;
 sessions.delete(id);
 clearTimeout(session.timeout);
 await session.browser.close().catch(()=>{});
 await session.vite.close().catch(()=>{});
}
function armSession(id){
 const session=sessions.get(id);
 if(!session)return;
 clearTimeout(session.timeout);
 session.timeout=setTimeout(()=>void disposeSession(id),INTERACTION_TTL_MS);
 session.timeout.unref?.();
}
export async function closeSceneRuntimeSession({sessionId}={}){
 if(typeof sessionId!=='string'||!sessions.has(sessionId))return {ok:true};
 await disposeSession(sessionId);
 return {ok:true};
}
export async function interactSceneRuntime(input={}){
 const {sessionId,action}=input;
 if(typeof sessionId!=='string'||!sessions.has(sessionId))
   throw Error('Gerçek web oturumunun süresi doldu. Yeni görüntü alın.');
 const session=sessions.get(sessionId);
 if(session.busy)throw Error('Gerçek web etkileşimi devam ediyor.');
 if(!['click','key','refresh'].includes(action))throw Error('Geçersiz gerçek web etkileşimi.');
 if(action==='click'&&
    (!Number.isFinite(input.x)||!Number.isFinite(input.y)
     ||input.x<0||input.y<0||input.x>=session.width||input.y>=session.height))
   throw Error('Görsel dışındaki tıklamalar kabul edilmez.');
 if(action==='key'&&!['Escape','ArrowLeft','ArrowRight','PageUp','PageDown'].includes(input.key))
   throw Error('Yalnız kitap/oda gezinme tuşları kullanılabilir.');
 session.busy=true;
 try{
   const before=await session.site.snapshot();
   if(before.sourceHash!==session.sourceHash)throw Error('Kaynak değişti. Önizlemeyi yeniden açın.');
   if(action==='click')await session.page.mouse.click(input.x,input.y);
   if(action==='key')await session.page.keyboard.press(input.key);
   await session.page.waitForTimeout(240);
   const buffer=await session.page.screenshot({type:'jpeg',quality:82,timeout:18000});
   const result=await session.page.evaluate(()=>{
     const root=document.querySelector('.scene-root');
     const id=root?.dataset.activeObject;
     const surface=document.querySelector('[data-book-surface="'+id+'"]');
     return {phase:root?.dataset.phase??'unknown',stage:surface?.dataset.bookStage??null,
       activeObject:id??''};
   });
   const after=await session.site.snapshot();
   if(after.sourceHash!==session.sourceHash)
     throw Error('Önizleme sırasında kaynak değişti; yeni görüntü gerekiyor.');
   armSession(sessionId);
   return {...result,sessionId,image:'data:image/jpeg;base64,'+buffer.toString('base64'),
     width:session.width,height:session.height};
 }catch(error){
   await disposeSession(sessionId);
   throw error;
 }finally{session.busy=false;}
}

function chromiumPath(){
  const direct=[process.env.CHROME_PATH,'/usr/bin/chromium','/usr/bin/chromium-browser',
    '/usr/bin/google-chrome','/usr/bin/brave-browser'];
  const cache=join(homedir(),'.claude-server-commander/puppeteer-cache/chrome');
  if(existsSync(cache)){
    const versions=readdirSync(cache).filter(name=>name.startsWith('linux-')).sort().reverse();
    direct.push(...versions.map(version=>join(cache,version,'chrome-linux64/chrome')));
  }
  const found=direct.find(path=>path&&existsSync(path));
  if(!found)throw Error('Yerel Chromium bulunamadı. Gerçek web görüntüsü için tarayıcı gerekli.');
  return found;
}
function validateRequest(input,source,site){
  if(!input||typeof input!=='object'||Array.isArray(input)
    ||!FOCUS.has(input.objectId)||!STAGES.has(input.stage)||!DEVICES[input.device])
    throw Error('Gerçek web önizleme isteği geçersiz.');
  if(typeof input.expectedSourceHash!=='string'||input.expectedSourceHash!==source.sourceHash)
    throw Error('Web kaynağı değişmiş; gerçek görünüm için Sahne Atölyesi kaynağını yenileyin.');
  if(Buffer.byteLength(JSON.stringify(input))>LIMIT)throw Error('Önizleme verisi çok büyük.');
  site.validate(input.scene,source,input.presentation);
  return site.validateAssets?.(input.assets??[],source,input.scene)??[];
}

const phase=async (page,value)=>page.waitForFunction(
  state=>document.querySelector('.scene-root')?.dataset.phase===state,value,{timeout:22000});

export async function captureSceneRuntime(input,{site=siteSceneSource(),onReady}={}){
  const source=await site.snapshot();
  const preparedAssets=validateRequest(input,source,site);
  if(input.keepOpen!==undefined&&typeof input.keepOpen!=='boolean')
    throw Error('Geçersiz etkileşimli önizleme seçeneği.');
  if(input.keepOpen){
    for(const id of [...sessions.keys()])await disposeSession(id);
  }
  const draftAssetBytes=new Map(preparedAssets.map(({path,bytes})=>[path,bytes]));
  let vite=null,browser=null;
  try{
    // The preview server MUST NOT listen on a network interface or expose any
    // community proxy. Browser traffic cannot leave the ephemeral origin.
    vite=await createServer({root:BIRDESENGOR_SITE,configFile:join(BIRDESENGOR_SITE,'vite.config.js'),
      logLevel:'silent',
      server:{host:'127.0.0.1',port:0,strictPort:false},
      clearScreen:false,
    });
    await vite.listen();
    const address=vite.httpServer.address();
    const origin='http://127.0.0.1:'+address.port;
    onReady?.(origin);
    browser=await chromium.launch({executablePath:chromiumPath(),headless:true,
      args:['--no-sandbox','--disable-dev-shm-usage']});
    const transitionCapture=input.stage==='approach'||input.stage==='return';
    const context=await browser.newContext({locale:'tr-TR',viewport:DEVICES[input.device],
      reducedMotion:transitionCapture?'no-preference':'reduce',
      serviceWorkers:'block',acceptDownloads:false});
    // A hidden object can still be inspected without changing its saved flag.
    // The room-state capture continues to show the actual hidden state.
    const capturePresentation=structuredClone(input.presentation);
    // A screenshot command itself consumes compositor frames. For transition
    // inspection only, slow the real site's authored transition to keep the
    // intermediate pose visible during capture; never alter saved timings.
    const timingSlowed=input.stage==='approach'||input.stage==='return';
    if(input.stage==='approach')capturePresentation.objects[input.objectId].focusMs=1800;
    if(input.stage==='return')capturePresentation.objects[input.objectId].returnMs=1800;
    const temporarilyRevealed=input.stage!=='room'&&
      capturePresentation.objects[input.objectId].roomVisible===false;
    if(temporarilyRevealed)capturePresentation.objects[input.objectId].roomVisible=true;
    await context.addInitScript(({presentation,scene})=>{
      Object.defineProperty(window,'__BDSG_SCENE_CAPTURE__',{
        value:{mode:'studio-validated-readonly',presentation,scene},
        writable:false,configurable:false,
      });
    },{presentation:capturePresentation,scene:input.scene});
    const page=await context.newPage();
    page.setDefaultTimeout(25000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const fixture=syntheticBookPublication();
    const loadedDraftAssets=new Set();
    await page.route('**/*',async route=>{
      const request=route.request();
      const url=new URL(request.url());
      if(url.origin!==origin||!['GET','HEAD'].includes(request.method())){
        return route.abort('blockedbyclient');
      }
      if(draftAssetBytes.has(url.pathname)){
        loadedDraftAssets.add(url.pathname);
        return route.fulfill({status:200,contentType:'image/webp',
          headers:{'cache-control':'no-store'},
          body:request.method()==='HEAD'?Buffer.alloc(0):draftAssetBytes.get(url.pathname)});
      }
      if(url.pathname==='/api/publication'){
        return route.fulfill({status:200,contentType:'application/json',
          headers:{'cache-control':'no-store'},body:JSON.stringify(fixture)});
      }
      if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/content/')){
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await page.goto(origin,{waitUntil:'domcontentloaded',timeout:35000});
    await page.locator('#entrance').waitFor({state:'detached',timeout:40000});
    await page.locator('.scene-root').waitFor({state:'visible',timeout:15000});
    if(input.stage!=='room'){
      const control=page.getByTestId('scene-object-'+input.objectId);
      await control.waitFor({state:'visible'});
      if(input.stage==='approach'){
        // Freeze the browser's React timers before focusing. Playwright can
        // then advance actual RAF/transition time deterministically to 300ms
        // without the 1800ms settle timer outrunning a slow screenshot.
        await page.clock.install();
        await page.clock.pauseAt(new Date());
      }
      await control.click({timeout:18000});
      if(input.stage==='approach'){
        await phase(page,'focusing');
        await page.clock.runFor(300);
      }else{
        await phase(page,'active');
        if(input.objectId==='research-journal'||input.objectId==='community-journal'){
          await page.waitForFunction(id=>document.querySelector('[data-book-surface="'+id+'"]')?.dataset.bookStage==='open',
            input.objectId,{timeout:20000});
        }
        if(input.stage==='return'){
          await page.clock.install();
          await page.clock.pauseAt(new Date());
          await page.keyboard.press('Escape');
          // Advance the actual React/Grabfold teardown into a real closing
          // frame, then freeze timers before screenshot under heavy load.
          await page.clock.runFor(320);
          await page.waitForFunction(id=>{
            const root=document.querySelector('.scene-root');
            const book=document.querySelector('[data-book-surface="'+id+'"]');
            return root?.dataset.phase==='returning'||book?.dataset.bookStage==='closing'
              ||root?.dataset.phase==='active';
          },input.objectId,{timeout:12000});
        }
      }
    }
    // Only the compositor of the *actual site* produces the pixels.
    const bytes=await page.screenshot({type:'jpeg',quality:82,timeout:18000});
    const measure=await page.evaluate(id=>{
      const root=document.querySelector('.scene-root');
      const selector=id==='research-journal'||id==='community-journal'
        ? '[data-book-surface="'+id+'"]' : id==='camera' ? '.camera-object' : '.vefk-stand';
      const target=document.querySelector(selector);
      const bounds=target?.getBoundingClientRect();
      const sides=bounds?{
        left:Math.max(0,-bounds.left),right:Math.max(0,bounds.right-innerWidth),
        top:Math.max(0,-bounds.top),bottom:Math.max(0,bounds.bottom-innerHeight)
      }:null;
      const clickable=document.querySelector('[data-testid="scene-object-'+id+'"]');
      const box=clickable?.getBoundingClientRect();
      const targetBounds=box?{x:box.x,y:box.y,width:box.width,height:box.height}:null;
      return {targetBounds,phase:root?.dataset.phase??'unknown',stage:target?.dataset.bookStage??null,
        object:id,overflow:sides,visible:!!target&&getComputedStyle(target).visibility!=='hidden',
        candleButtonCount:document.querySelectorAll('.study-candle-touch').length,
        customArtworkCount:document.querySelectorAll('.study-custom-artwork').length};
    },input.objectId);
    if(errors.length)throw Error('Gerçek site görüntüsünde JavaScript hatası: '+errors[0]);
    // A Vite HMR edit while Chromium is rendering invalidates the comparison.
    const finalSource=await site.snapshot();
    if(finalSource.sourceHash!==source.sourceHash)
      throw Error('Gerçek web yakalaması sırasında kaynak değişti. Görüntüyü yeniden oluşturun.');
    let sessionId=null;
    if(input.keepOpen){
      sessionId=randomUUID();
      sessions.set(sessionId,{
        vite,browser,page,site,sourceHash:source.sourceHash,
        width:DEVICES[input.device].width,height:DEVICES[input.device].height,
        timeout:null,busy:false,
      });
      armSession(sessionId);
      // Ownership of the temporary site/browser moves to the live session.
      vite=null;browser=null;
    }
    return {image:'data:image/jpeg;base64,'+bytes.toString('base64'),
      width:DEVICES[input.device].width,height:DEVICES[input.device].height,
      ...measure,syntheticContent:true,temporarilyRevealed,timingSlowed,
      draftEffectsApplied:true,draftAssetsApplied:draftAssetBytes.size,
      draftAssetLoads:[...loadedDraftAssets],sessionId,sourceHash:source.sourceHash,
      note:'Gerçek web bileşenleri. Kaydedilmemiş sunum/efekt/görsel taslağı bellekte kullanılır. Metin/kayıtlar sentetiktir.'};
  }finally{
    await browser?.close().catch(()=>{});
    await vite?.close().catch(()=>{});
  }
}
