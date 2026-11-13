import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
const port=5311,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port',String(port)],{cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',chunk=>log+=chunk);server.stderr.on('data',chunk=>log+=chunk);
let browser;
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/tests/records-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,log);
 const chrome=process.env.CHROME_PATH??[path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),'/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const workspace of ['records','publish']){
  const page=await browser.newPage({viewport:{width:1500,height:870}});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>{console.log('PAGE ERROR',e.stack);errors.push(e.stack);});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE ERROR',m.text())});
  let dialogMode='accept';page.on('dialog',d=>dialogMode==='dismiss'?d.dismiss():d.accept());
  await page.goto(base+'/tests/records-v3-harness.html');await page.evaluate(choice=>{document.documentElement.dataset.studioTheme='light';choice==='records'?window.__mountRecords():window.__mountPublish();},workspace);
  if(workspace==='records'){
    await page.getByTestId('records-workspace-v3').waitFor();
    await page.getByRole('button',{name:/TR \/ EN/}).click();
    await page.getByTestId('records-language-workspace').waitFor();
    await page.getByRole('tab',{name:'İngilizce',exact:true}).click();
    await page.getByText('Onaylı Türkçe anlatı.',{exact:true}).waitFor();
    assert.equal(await page.locator('.record-visual-dock').count(),1,'visual rail remains available for matching entity');
    const en=page.locator('.publication-compare-row').first();assert.equal(await en.locator('textarea').count(),1);
    await page.getByRole('button',{name:/Eksik \/ eski kayıtları çevir/}).click();
    await page.waitForFunction(()=>window.__actions.some(a=>a.name==='batch'));
    assert.deepEqual(await page.evaluate(()=>window.__actions.find(a=>a.name==='batch').payload.items),[{kind:'entity',id:'story-publication-67'}]);
    await page.locator('select[aria-label="Çeviri durumu"]').selectOption('missing');
    assert.equal(await page.locator('.records-language-item').count(),1);
    await page.getByLabel('Özet',{exact:true}).fill('Edited English summary before approval.');
    // The records navigation guard catches unsaved translation edits.
    dialogMode='dismiss';await page.getByRole('button',{name:/Kayıt arşivine dön/}).click();
    assert.equal(await page.getByTestId('records-language-workspace').count(),1);
    dialogMode='accept';await page.getByRole('button',{name:/Kayıt arşivine dön/}).click();
    assert.equal(await page.getByTestId('records-language-workspace').count(),0);
    await page.getByRole('button',{name:/TR \/ EN/}).click();
    await page.getByTestId('records-language-workspace').waitFor();
    await page.screenshot({path:'/tmp/records-translation-v3.png',fullPage:true});
    for(const size of [{width:1500,height:870},{width:1366,height:768},{width:1280,height:720}]){
      await page.setViewportSize(size);
      const overflow=await page.evaluate(()=>({document:document.documentElement.scrollHeight-innerHeight,grid:document.querySelector('.records-v3-grid').scrollHeight-document.querySelector('.records-v3-grid').clientHeight}));
      assert.ok(overflow.document<=2&&overflow.grid<=2,JSON.stringify({size,overflow}));
    }
    console.log('PASS Records publication V3: TR source comparison, EN drafts, AI queue selection, visible visual rail, unsaved guard, responsive viewport');
  }else{
    await page.getByTestId('publish-v3').waitFor();await page.getByRole('button',{name:'Tam yayını başlat'}).waitFor();
    assert.equal(await page.getByRole('button',{name:/paket.*oluştur/i}).count(),0,'manual packaging removed');
    await page.getByRole('button',{name:'Tam yayını başlat'}).click();
    await page.waitForFunction(()=>window.__actions.filter(a=>a.name==='publish').length===1);
    assert.equal(await page.evaluate(()=>window.__actions.find(a=>a.name==='publish').mode),'full');
    await page.evaluate(()=>{window.__preview.coverage={...window.__preview.coverage,requiresFull:false,reasons:[],newEntities:0};});
    await page.getByRole('button',{name:'Durumu yenile'}).click();
    await page.getByRole('button',{name:'Değişiklikleri yayınla'}).waitFor();
    await page.getByRole('button',{name:'Değişiklikleri yayınla'}).click();
    await page.waitForFunction(()=>window.__actions.filter(a=>a.name==='publish').length===2);
    assert.equal(await page.evaluate(()=>window.__actions.filter(a=>a.name==='publish')[1].mode),'update');
    await page.locator('.publish-v3-options').locator('summary').click();
    await page.getByLabel('İki dil tam onaylı olmadan yayınlamayı engelle').check();
    assert.equal(await page.getByRole('button',{name:'Değişiklikleri yayınla'}).isDisabled(),true);
    await page.evaluate(()=>window.__readyLanguages=true);
    await page.getByRole('button',{name:'Durumu yenile'}).click();
    assert.equal(await page.getByRole('button',{name:'Değişiklikleri yayınla'}).isEnabled(),true);
    await page.screenshot({path:'/tmp/publication-center-v3.png',fullPage:true});
    for(const size of [{width:1500,height:870},{width:1366,height:768},{width:1280,height:720}]){
      await page.setViewportSize(size);
      const overflow=await page.evaluate(()=>({document:document.documentElement.scrollHeight-innerHeight,content:document.querySelector('.publish-v3').scrollHeight-document.querySelector('.publish-v3').clientHeight}));
      assert.ok(overflow.document<=2&&overflow.content<=2,JSON.stringify({size,overflow}));
    }
    console.log('PASS Publishing V3: one-screen layout, automatically selected full/update, implicit packaging, explicit confirmations, optional strict bilingual gate');
  }
  assert.deepEqual(errors,[],'No uncaught React errors');await page.close();
 }
}finally{await browser?.close();server.kill('SIGTERM');}
