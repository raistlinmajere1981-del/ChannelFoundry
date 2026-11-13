import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {roomFrameGeometry} from '../../../packages/effect-engine/src/model/room-frame.mjs';

const root=new URL('../../../channels/birdesengor/web/',import.meta.url).pathname;
const origin='http://127.0.0.1:5297';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5297'],
  {cwd:root,stdio:'pipe',env:{...process.env,CHANNEL_FOUNDRY_PUBLICATION_FILE:'',BIRDESENGOR_COMMUNITY_ORIGIN:''}});
let log='';server.stderr.on('data',c=>log+=c);server.stdout.on('data',c=>log+=c);
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'web preview did not start: '+log);
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
   headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [width,height] of [[1920,1080],[390,844],[2560,720]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin,{waitUntil:'domcontentloaded'});
   await page.locator('#entrance').waitFor({state:'detached',timeout:35000});
   await page.waitForFunction(()=>document.querySelector('main')?.dataset.phase==='room');
   const observed=await page.locator('.study-frame').evaluate(node=>{
     const rect=node.getBoundingClientRect(),img=node.querySelector('.study-plate');
     return {width:rect.width,height:rect.height,x:rect.x,y:rect.y,
       sourceWidth:img.naturalWidth,sourceHeight:img.naturalHeight,fit:getComputedStyle(img).objectFit};
   });
   const expected=roomFrameGeometry(width,height);
   for(const key of ['width','height','x','y'])
     assert.ok(Math.abs(observed[key]-expected.room[key])<1,
       width+'x'+height+': web '+key+' '+observed[key]+' != Studio '+expected.room[key]);
   assert.equal(observed.sourceWidth/observed.sourceHeight,2);
   assert.equal(observed.fit,'fill');
   assert.deepEqual(errors,[]);
   await page.close();
 }
 console.log('PASS room frame: real BirDeSenGör web equals Studio desktop, phone and ultrawide geometry');
}finally{await browser?.close();server.kill('SIGTERM');}
