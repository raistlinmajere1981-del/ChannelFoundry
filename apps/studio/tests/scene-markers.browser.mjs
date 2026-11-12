import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const origin='http://127.0.0.1:5293';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5293'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try{
  let online=false;
  for(let i=0;i<100;i++){try{if((await fetch(origin+'/tests/scene-v2-harness.html')).ok){online=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(online,'Studio Vite did not start: '+log);
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/tests/scene-v2-harness.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#scene-markers .scene-marker').length>0,{timeout:12000});
  const count=await page.locator('#scene-markers .scene-marker').count();
  assert.ok(count>0);
  const toggle=page.locator('#show-markers');
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#scene-markers').evaluate(el=>getComputedStyle(el).display),'none');
  assert.equal(await page.locator('#show-effects').getAttribute('aria-pressed'),'true','only guides toggle');
  await page.locator('[id^="object-select-"]').first().click();
  assert.equal(await page.locator('#scene-markers').evaluate(el=>getComputedStyle(el).display),'none','hidden state persists across redraw');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  assert.notEqual(await page.locator('#scene-markers').evaluate(el=>getComputedStyle(el).display),'none');
  assert.equal(await page.locator('#scene-markers .scene-marker').count(),count);
  assert.deepEqual(errors,[]);
  console.log('PASS Studio marker toggle',count,'targets; redraw stable; live effects unchanged');
}finally{await browser?.close();server.kill('SIGTERM');}
