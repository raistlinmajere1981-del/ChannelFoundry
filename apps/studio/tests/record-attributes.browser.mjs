import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';

const port=5302,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port',String(port)],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
let browser;
try{
 let ready=false;
 for(let i=0;i<125;i++){try{if((await fetch(base+'/tests/records-v3-harness.html')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Server failed: '+log);
 const chrome=process.env.CHROME_PATH??[path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),'/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1460,height:880}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(base+'/tests/records-v3-harness.html');
 await page.evaluate(()=>{document.documentElement.dataset.studioTheme='light';window.__mountRecords();});
 await page.getByTestId('records-workspace-v3').waitFor({timeout:25000});
 const field=name=>page.getByRole('textbox',{name:'Özellik: '+name}).or(page.getByRole('combobox',{name:'Özellik: '+name}));
 await page.getByRole('option',{name:/Ömer/}).click();
 const panel=page.locator('.record-v3-attribute-section');
 await panel.waitFor();
 await panel.getByRole('combobox',{name:'Özellik: Tür'}).waitFor();
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Taraf durumu'}).inputValue(),'notr');
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Tür'}).inputValue(),'İnsan');
 assert.equal(await panel.getByRole('textbox',{name:'Özellik: Yaş'}).inputValue(),'48');
 assert.match(await panel.innerText(),/AI önerisi:.*Komutan/);
 // Source provenance from same shared store.
 await panel.getByRole('button',{name:'▾ Onaylı kaynak'}).click();
 assert.match(await panel.innerText(),/Ömer insan olarak anlatılıyor/);
 await panel.getByRole('button',{name:'▴ Kaynak dayanağını kapat'}).click();
 // Unsaved attribute edits participate in the global record-leave guard.
 await panel.getByRole('textbox',{name:'Özellik: Yaş'}).fill('49');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:records-unsaved')==='1');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('option',{name:/Kayıt yüzüğü/}).click();
 assert.equal(await page.locator('.record-v3-heading h2').innerText(),'Ömer');
 await panel.getByRole('button',{name:'Özellikleri kaydet (1)'}).click();
 await page.waitForFunction(()=>window.__actions.some(a=>a.name==='attribute-save'&&a.edits.some(e=>e.entityKey==='character-omer'&&e.field==='age'&&e.value==='49')));
 assert.equal(await panel.getByRole('textbox',{name:'Özellik: Yaş'}).inputValue(),'49');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:records-unsaved')==='0');
 // Approve a real pending proposal through the existing shared review handler.
 await panel.getByRole('button',{name:'Onayla'}).click();
 await page.waitForFunction(()=>window.__actions.some(a=>a.name==='attribute-review'&&a.action==='approve'));
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Mevki'}).inputValue(),'Komutan');
 await panel.getByRole('button',{name:'▾ Onaylı kaynak'}).last().click();
 assert.match(await panel.innerText(),/komutan olarak anıldı/);
 // Shared dictionary options are editable from a single record too.
 await panel.locator('.record-v3-attribute-field').filter({has:page.getByRole('combobox',{name:'Özellik: Mevki'})})
   .getByRole('button',{name:'+ Sözlüğe seçenek ekle'}).click();
 await panel.getByRole('textbox',{name:'Türkçe değer'}).fill('Bilgin');
 await panel.getByRole('textbox',{name:'İngilizce karşılığı (isteğe bağlı)'}).fill('Scholar');
 await panel.getByRole('button',{name:'Sözlüğe ekle'}).click();
 await page.waitForFunction(()=>window.__actions.some(a=>a.name==='attribute-option-add'&&a.value==='Bilgin'));
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Mevki'}).inputValue(),'Bilgin');
 await panel.getByRole('button',{name:'Özellikleri kaydet (1)'}).click();
 await page.waitForFunction(()=>window.__attributeData.profiles.find(p=>p.entityKey==='character-omer').fields.rank==='Bilgin');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:records-unsaved')==='0'&&sessionStorage.getItem('channel-foundry:records-busy')==='0');
 // Object fields are separate from character fields.
 await page.getByRole('option',{name:/Kayıt yüzüğü/}).click();
 assert.equal(await page.locator('.record-v3-heading h2').innerText(),'Kayıt yüzüğü');
 await panel.getByRole('combobox',{name:'Özellik: Tür'}).waitFor();
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Tür'}).inputValue(),'Yüzük');
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Sahibi \/ Koruyucusu'}).inputValue(),'Ömer');
 await panel.getByRole('textbox',{name:'Özellik: Özellik'}).fill('Işık yayar ve renk değiştirir');
 await panel.getByRole('button',{name:'Özellikleri kaydet (1)'}).click();
 await page.waitForFunction(()=>window.__attributeData.profiles.find(p=>p.entityKey==='object-ring').fields.property==='Işık yayar ve renk değiştirir');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:records-unsaved')==='0'&&sessionStorage.getItem('channel-foundry:records-busy')==='0');
 // Location auto-dimension follows the existing bulk behavior.
 await page.getByRole('option',{name:/Mezna bölgesi/}).click();
 await panel.getByRole('combobox',{name:'Özellik: Konum'}).waitFor();
 await panel.getByRole('combobox',{name:'Özellik: Konum'}).selectOption('Dünya');
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Boyut'}).inputValue(),'3');
 await panel.getByRole('button',{name:'Özellikleri kaydet (2)'}).click();
 await page.waitForFunction(()=>window.__attributeData.profiles.find(p=>p.entityKey==='location-mezna')?.fields.dimension==='3');
 await page.waitForFunction(()=>sessionStorage.getItem('channel-foundry:records-unsaved')==='0'&&sessionStorage.getItem('channel-foundry:records-busy')==='0');
 // Draft workspace nodes are visible but not mutable.
 await page.getByRole('option',{name:/Taş numune/}).click();
 await panel.getByRole('combobox',{name:'Özellik: Tür'}).waitFor();
 assert.equal(await panel.getByRole('combobox',{name:'Özellik: Tür'}).isDisabled(),true);
 assert.deepEqual(errors,[],'no browser JS errors');
 console.log('PASS single-record attributes: source/proposals/dictionary, character/object/location, live-safe save, drafts, dirty guard, no page exceptions');
}finally{await browser?.close();server.kill('SIGTERM')}
