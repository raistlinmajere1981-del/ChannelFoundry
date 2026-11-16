import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';

const port=5337,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port',String(port)],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/tests/settings-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 assert(ready,log);
 const chrome=process.env.CHROME_PATH??[path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),'/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:880}});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base+'/tests/settings-v3-harness.html');
 await page.evaluate(()=>{
   window.__storedConfig={...window.__storedConfig,reasoningEffort:'xhigh',reasoningMode:'effort',
     image:{...window.__storedConfig.image,reasoningEffort:'high',reasoningMode:'effort'}};
   window.__mountSettings();
 });
 const openAi=async()=>{await page.getByRole('button',{name:'AI servisleri'}).click();await page.getByRole('combobox',{name:'Reasoning'}).waitFor();};
 await openAi();
 assert.equal(await page.getByRole('combobox',{name:'Reasoning'}).inputValue(),'xhigh','persisted reasoning must show without catalog retrieval');
 assert.match(await page.locator('.ai-minimal').innerText(),/Kaydedilen seçim/);
 await page.getByRole('button',{name:'Kanal ve yayın'}).click();
 await openAi();
 assert.equal(await page.getByRole('combobox',{name:'Reasoning'}).inputValue(),'xhigh','switching tab must preserve reasoning');
 await page.getByRole('button',{name:'Modelleri getir'}).click();
 await page.getByRole('combobox',{name:'Reasoning'}).selectOption('medium');
 await page.getByRole('button',{name:'Tümünü kaydet'}).click();
 await page.waitForFunction(()=>window.__storedConfig.reasoningEffort==='medium');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:settings-unsaved')==='0');
 assert.equal(await page.evaluate(()=>window.__actions.at(-1)?.input.reasoningEffort),'medium');
 assert.equal(await page.evaluate(()=>window.__storedConfig.image.reasoningEffort),'high','unmodified image reasoning survives text settings save');
 await page.evaluate(()=>window.__mountSettings());await openAi();
 assert.equal(await page.getByRole('combobox',{name:'Reasoning'}).inputValue(),'medium','saved medium must survive unmount and return');
 await page.getByRole('button',{name:'Modelleri getir'}).click();
 await page.getByRole('combobox',{name:'Reasoning'}).selectOption('xhigh');
 await page.getByRole('button',{name:'Tümünü kaydet'}).click();
 await page.waitForFunction(()=>window.__storedConfig.reasoningEffort==='xhigh');
 await page.evaluate(()=>window.__mountSettings());await openAi();
 assert.equal(await page.getByRole('combobox',{name:'Reasoning'}).inputValue(),'xhigh','saved xhigh must survive remount');
 await page.locator('.ai-role-cards button').nth(1).click();
 assert.equal(await page.getByRole('combobox',{name:'Reasoning'}).inputValue(),'high','image reasoning independently restored');
 assert.equal(await page.getByRole('button',{name:'Tümünü kaydet'}).isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS settings reasoning: saved choices visible without model fetch, tab navigation, save, remount, text/image isolation');
}finally{await browser?.close();server.kill('SIGTERM');}
