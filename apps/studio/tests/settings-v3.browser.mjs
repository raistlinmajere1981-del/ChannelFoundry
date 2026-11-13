import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
const port=5331,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port',String(port)],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/tests/settings-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert(ready,log);
 const chrome=process.env.CHROME_PATH??[path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),'/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1500,height:870}});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',err=>errors.push(err.stack));page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text())});
 page.on('dialog',d=>d.accept());
 await page.goto(base+'/tests/settings-v3-harness.html');await page.evaluate(()=>{document.documentElement.dataset.studioTheme='light';window.__mountSettings()});
 await page.locator('.settings-v3-bar').waitFor();await page.getByLabel('Proje adı').waitFor();
 await page.locator('label:has-text("Proje adı") input').fill('BirDeSenGör V3');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:settings-unsaved')==='1');
 await page.getByRole('button',{name:'AI servisleri'}).click();
 await page.locator('.ai-minimal').waitFor();
 assert.equal(await page.locator('.ai-minimal select[aria-label="Model"]').inputValue(),'codex-saved-model','saved model shown on first open without model discovery');
 await page.getByRole('button',{name:'Modelleri getir'}).click();
 await page.getByRole('combobox',{name:'Model',exact:true}).selectOption('codex-new-model');
 await page.locator('.ai-role-cards button').nth(1).click();
 assert.equal(await page.getByRole('combobox',{name:'Model',exact:true}).inputValue(),'image-saved-model','saved image model also visible');
 await page.screenshot({path:'/tmp/settings-v3-ai-light.png',fullPage:true});
 await page.getByRole('button',{name:'SEO',exact:true}).click();await page.getByTestId('seo-v3').waitFor();
 await page.screenshot({path:'/tmp/settings-v3-seo-light.png',fullPage:true});
 await page.getByRole('button',{name:/Kayıtlı birinci hikâye/}).click();
 await page.getByLabel('SEO arama başlığı').fill('Düzenlenmiş arama başlığı');
 assert.equal(await page.getByRole('button',{name:'Tümünü kaydet'}).isEnabled(),true);
 await page.getByRole('button',{name:'Tümünü kaydet'}).click();
 await page.waitForFunction(()=>['project-save','ai-save','seo-save'].every(type=>window.__actions.some(action=>action.type===type)));
 assert.deepEqual(await page.evaluate(()=>window.__actions.filter(x=>['project-save','ai-save','seo-save'].includes(x.type)).map(x=>x.type)),['project-save','ai-save','seo-save']);
 await page.getByRole('button',{name:'Tümünü kaydet'}).waitFor({state:'visible'});
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:settings-unsaved')==='0');
 await page.getByRole('button',{name:'✦ AI önerisi'}).click();
 await page.getByText('AI SEO Önerisi').waitFor();
 assert.equal(await page.getByLabel('SEO arama başlığı').inputValue(),'Düzenlenmiş arama başlığı','AI proposal never overwrites form');
 await page.getByRole('button',{name:'Taslağa al'}).click();
 await page.getByRole('button',{name:'Vazgeç'}).click();
 assert.equal(await page.getByLabel('SEO arama başlığı').inputValue(),'Düzenlenmiş arama başlığı');
 // Partial saves explicitly report a failed section without rolling back the others.
 await page.getByRole('button',{name:'Kanal ve yayın'}).click();
 await page.locator('label:has-text("Proje adı") input').fill('BirDeSenGör V4');
 await page.getByRole('button',{name:'SEO',exact:true}).click();
 await page.getByLabel('SEO arama başlığı').fill('İkinci SEO düzenlemesi');
 await page.evaluate(()=>window.__failSeoOnce=true);
 await page.getByRole('button',{name:'Tümünü kaydet'}).click();
 await page.locator('.settings-v3-actions .is-error').getByText(/SEO geçici kayıt hatası/).waitFor();
 assert.equal(await page.evaluate(()=>window.__actions.filter(a=>a.type==='project-save').length),2);
 assert.equal(await page.evaluate(()=>window.__actions.filter(a=>a.type==='seo-save-error').length),1);
 assert.equal(await page.getByRole('button',{name:'Tümünü kaydet'}).isEnabled(),true,'failed section stays dirty');
 await page.keyboard.press('Control+s');
 await page.waitForFunction(()=>window.__actions.filter(a=>a.type==='seo-save').length===2);
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:settings-unsaved')==='0');
 await page.getByRole('button',{name:'Eksik SEO önerilerini üret'}).click();
 await page.waitForFunction(()=>window.__actions.some(a=>a.type==='seo-queue'));
 await page.getByRole('button',{name:'Yerel veri'}).click();
 await page.getByText('Evreni Baştan Oluştur').first().waitFor();
 const maintenance=await page.locator('.universe-maintenance-copy').evaluate(el=>getComputedStyle(el).color);
 assert.notEqual(maintenance,'rgb(143, 147, 152)','hardcoded dark-mode gray removed');
 assert.equal(await page.locator('.universe-maintenance-card').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(251, 247, 239)','light theme maintenance panel must not use hard-coded dark background');
 for(const theme of ['light','soft-dark']){
   await page.evaluate(theme=>{document.documentElement.dataset.studioTheme=theme;},theme);
   await page.screenshot({path:`/tmp/settings-v3-${theme}.png`,fullPage:true});
 }
 for(const size of [{width:1500,height:870},{width:1366,height:768},{width:1280,height:720}]){
  await page.setViewportSize(size);
  const dimensions=await page.evaluate(()=>({root:document.documentElement.scrollHeight-innerHeight,surface:document.querySelector('.settings-v3').scrollHeight-document.querySelector('.settings-v3').clientHeight}));
  assert(dimensions.root<=2&&dimensions.surface<=2,JSON.stringify({size,dimensions}));
 }
 assert.deepEqual(errors,[]);console.log('PASS settings V3: central and partial-failure saves across tabs, models persist, SEO AI proposal/queue, accessible maintenance, theme and viewport');
}finally{await browser?.close();server.kill('SIGTERM');}
