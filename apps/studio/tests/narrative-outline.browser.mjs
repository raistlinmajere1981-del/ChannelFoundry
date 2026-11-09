/** Actual React + narrative IPC with disposable SQLite and local video metadata. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),repo=path.resolve(import.meta.dirname,'../../..'),studio=path.join(repo,'apps/studio');
const {DatabaseSync}=require('node:sqlite'),{createServer}=require('vite');
const {chromium}=createRequire(path.join(repo,'channels/birdesengor/web/package.json'))('playwright-core');
const outline=require('../narrative-outline.cjs'),store=require('../narrative-store.cjs'),workspace=require('../universe-workspace.cjs');
const out=path.join(repo,'channels/birdesengor/web/artifacts/evren-journal-design'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'journal-editorial-'));
fs.mkdirSync(out,{recursive:true});const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
workspace.ensureSchema(db);require('../youtube-catalog-store.cjs').ensureSchema(db);outline.ensureSchema(db);
db.prepare("INSERT INTO youtube_channels(id,url,title,is_active) VALUES('test','https://example.test/channel','Fixture',1)").run();
for(const [id,title] of [['v1','Düğümlü Kitap | 54. Davet — Birinci kayıt'],['v2','Düğümlü Kitap | 54. Davet — İkinci kayıt'],['v3','Düğümlü Kitap | 55. Davet — Farklı bölüm']])db.prepare("INSERT INTO youtube_videos(video_id,channel_id,title,canonical_url,thumbnail_url) VALUES(?,'test',?,'','')").run(id,title);
for(const id of ['v1','v2','v3'])db.prepare(`INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state) VALUES(?,1,'story',?,'Kaynak notu','[]',?,'{}','approved')`).run(id,id,JSON.stringify([id]));
const run=store.prepareRun(db);store.saveDraftSections(db,run.id,[...['v1','v2'].map((id,i)=>({key:`section-${id}`,position:i,title:`Anı ${i+1}`,body:'Kaynakta aktarılan anı.',sourceKeys:[id]})),{key:'section-mixed',position:3,title:'Karma davet',body:'Birden fazla davetle ilişkili ayrıntı.',sourceKeys:['v1','v3']}]);store.applyRun(db,run.id);
const memory=store.narrativeMemory(db),handlers=new Map();require('../narrative-ipc.cjs').registerNarrativeIpc({handle:(n,fn)=>handlers.set(n,fn)},{database:()=>db,refreshMainWindow(){}});
const methods={narrativeOutlineStatus:'status',narrativeOutlineSuggestions:'suggestions',narrativeOutlineSaveSeries:'series',narrativeOutlineSaveChapter:'chapter',narrativeOutlinePlaceSection:'place',narrativeOutlineMove:'move'};
let server,browser,p;const errors=[];
try{
 fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
 fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 fs.writeFileSync(path.join(scratch,'entry.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import Outline from '/@fs/${studio}/src/NarrativeOutlineWorkbench.tsx';import '/@fs/${studio}/src/studio-theme-tokens.css';window.channelFoundryStudio=Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,(...args)=>window.__call(name,args)]));window.channelFoundryStudio.onDataChanged=()=>()=>{};document.body.style.background='#0d1116';createRoot(document.getElementById('root')).render(<Outline memory={${JSON.stringify(memory)}}/>);`);
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 p=await browser.newPage({viewport:{width:1366,height:768}});await p.exposeFunction('__call',(n,args)=>handlers.get(`studio:narrative-outline-${methods[n]}`)({},...args));p.on('pageerror',e=>errors.push(e.message));
 await p.goto(server.resolvedUrls.local[0]);
 assert.equal(await p.getByLabel('Anlatıcının adı',{exact:true}).count(),0);
 assert.equal(await p.getByRole('button',{name:'Profili kaydet',exact:true}).count(),0);
 assert.equal(await p.getByText('GÜNLÜK DÜZENİ',{exact:true}).count(),0);
 assert.equal(await p.getByText('Kitaptaki sıralama',{exact:true}).count(),0);
 assert.equal(await p.getByText('Kitapta otomatik',{exact:true}).count(),0);
 assert.equal(await p.getByText('Video başlıklarından bölüm önerileri',{exact:true}).count(),0);
 assert.equal(await p.locator('.outline-help').count(),0);
 await p.getByRole('button',{name:'Dizi ekle',exact:true}).waitFor();
 await p.getByRole('button',{name:'Önerileri getir',exact:true}).click();
 await p.getByText('Düğümlü Kitap / 54. Davet',{exact:true}).waitFor();assert.equal(outline.seriesList(db).length,0);
 await p.getByRole('button',{name:'Düzenlemeye al',exact:true}).first().click();
 assert.equal(await p.getByLabel('Dizi adı',{exact:true}).inputValue(),'Düğümlü Kitap');
 await p.getByLabel('Dizi sırası',{exact:true}).fill('3');await p.getByRole('button',{name:'Diziyi kaydet',exact:true}).click();
 await p.getByLabel('Bölüm adı',{exact:true}).waitFor();
 await p.getByLabel('Bölüm adı',{exact:true}).fill('54. Davet — iki kaynak');await p.getByLabel('Bölüm sırası',{exact:true}).fill('54');
 await p.getByRole('button',{name:'Alt bölümü kaydet',exact:true}).click();
 await p.getByText('Birden fazla bölüme ait kaynaklar: Karma davet.',{exact:false}).waitFor();
 await p.getByRole('button',{name:'Eşleşen anıları seçili bölüme bağla',exact:true}).click();
 await p.waitForFunction(()=>!document.querySelector('.narrative-outline-proposal > button')?.textContent?.includes('Eşleşen'));
 assert.equal(outline.assignments(db).length,2,'Karma davet yanlış bölüme otomatik bağlanmamalı');assert.equal(outline.seriesList(db)[0].position,3);assert.equal(outline.chapterList(db)[0].position,54);
 await p.getByLabel('Bölüm adı',{exact:true}).fill('Düzenlenen başlık');await p.getByRole('button',{name:'Alt bölümü kaydet',exact:true}).click();
 await p.waitForTimeout(120);assert.equal(outline.chapterList(db)[0].position,54);
 assert.equal(await p.locator('[data-outline-node="series"]').count(),1);
 assert.equal(await p.locator('[data-outline-node="chapter"]').count(),1);
 assert.equal(await p.locator('[data-outline-node="section"]').count(),3);
 const handle=id=>p.locator(`[data-outline-key="${id}"] .outline-drag-handle`);
 // Native drag must persist in SQLite and update the tree without a reload.
 await handle('section-v2').dragTo(p.locator('[data-outline-key="section-v1"]'));
 await p.waitForFunction(()=>[...document.querySelectorAll('.outline-node-depth-2 [data-outline-node="section"]')].slice(0,2)
   .map(node=>node.dataset.outlineKey).join(',')==='section-v2,section-v1');
 assert.deepEqual(outline.assignments(db).map(a=>a.sectionKey),['section-v2','section-v1']);
 // Chapter -> independent and independent -> chapter use the same atomic move.
 await handle('section-v1').dragTo(p.locator('.outline-independent-group > strong'));
 await p.waitForFunction(()=>document.querySelector('.outline-independent-group [data-outline-key="section-v1"]')!==null);
 assert.equal(outline.assignments(db).length,1);
 const chapterDrop=p.locator('[data-outline-node="chapter"]').locator('xpath=..').locator('.outline-tree-children').first();
 await handle('section-v1').dragTo(chapterDrop);
 await p.waitForFunction(()=>document.querySelector('.outline-independent-group [data-outline-key="section-v1"]')===null);
 assert.equal(outline.assignments(db).length,2);
 assert.ok(outline.publishedOutline(db,memory.map(m=>({sectionId:m.sectionKey}))).series.length===1);
 await p.screenshot({path:path.join(out,'studio-editorial-1366.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'studio-editorial-verification.json'),JSON.stringify({series:outline.seriesList(db),chapters:outline.chapterList(db),assignments:outline.assignments(db),realDatabaseOpened:false,errors},null,2));
 console.log('PASS actual Studio React/IPC: title suggestions, two source videos, explicit approval, series/chapter/section ordering; disposable SQLite');
}catch(error){if(p)await p.screenshot({path:path.join(out,'studio-editorial-failure.png')});throw error;}
finally{await browser?.close();await server?.close();db.close();fs.rmSync(scratch,{recursive:true,force:true});}
