/** Disconnected Studio fixture. UI/flow tests do not touch production data or invoke AI models. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const repo=path.resolve(import.meta.dirname,'../../..'),studio=path.join(repo,'apps/studio');
const {createServer}=require('vite');
const {chromium}=createRequire(path.join(repo,'channels/birdesengor/web/package.json'))('playwright-core');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'universe-stage-clarity-'));
const out=path.join(repo,'artifacts/universe-stage-clarity');fs.mkdirSync(out,{recursive:true});
let server,browser;
const sources=Array.from({length:4},(_,i)=>({videoId:'source-'+(i+1),title:['Davet ve bilinen isimler','Kayıp mekânın izleri','Kronolojik olaylar ve yeni kayıtlar','İlk anlatıdan başka bir ilişki'][i],publishedAt:'2026-10-'+String(21+i).padStart(2,'0')}));
const moreSources=Array.from({length:10},(_,i)=>({videoId:'long-'+i,title:'Uzun sıradaki video '+(i+1)+' · '+('Anlatı '.repeat(10)),publishedAt:'2026-09-'+String(i+1).padStart(2,'0')}));
const universe={stories:[{name:'Kayıp mekânın anlatısı',summary:'İki videoda ortak geçen mekânın anlatısı ve ayrı bölüm notları.',sourceVideoIds:['source-1','source-2'],sequence:[{text:'Mekânın konumu iki kaynakta anlatılıyor.'}]}],characters:[{name:'Bilinen kişi',summary:'İlk videodaki muhatap.',roles:[],sourceVideoIds:['source-1'],details:[]}],events:[],locations:[],objects:[],relations:[]};
const result={id:9,state:'done',complete:true,analysisCount:2,model:'test/model',universe,sources:sources.slice(0,2),sourceCoverage:{expected:2,actual:2,missing:[]}};
function status(mode) {
  return {availableAnalyses:mode==='many'?10:4,run:mode==='active'?{id:8,state:'running',analysisCount:3,doneChunks:2,totalChunks:8}:
    mode==='ready'?{id:9,state:'done',analysisCount:2,doneChunks:4,totalChunks:4}:
    mode==='failed'?{id:10,state:'error',analysisCount:2,doneChunks:1,totalChunks:4,error:'Test error'}:null,
    ingest:{pending:mode==='many'?10:4,processed:0,batchLimit:10,nextSources:mode==='many'?moreSources:sources,
      awaitingApplyRunId:mode==='ready'?9:null,
      backlog:{drafts:0,revisions:mode==='blocked'?2:0}}};
}
try {
  fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
  fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
  const entry=[
    "import React from 'react';import{createRoot}from'react-dom/client';",
    "import Stage from '/@fs/"+studio+"/src/IncrementalUniverseWorkbench.tsx';",
    ...['studio-theme-tokens.css','styles.css','pipeline.css','studio-accessibility.css','studio-theme-bindings.css','studio-workspace-system.css','studio-workspace-layout.css','studio-fixed-viewport.css','universe-workbench.css'].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
    "const m=new URLSearchParams(location.search).get('mode')||'selection';",
    "const statuses="+JSON.stringify(Object.fromEntries(['selection','active','ready','blocked','failed','many'].map(m=>[m,status(m)])))+";",
    "const result="+JSON.stringify(result)+";",
    "window.__current={status:statuses[m],workspace:{counts:{draft:0,approved:0,pendingRevisions:0},latestImport:null},result:m==='ready'?result:null};",
    "window.channelFoundryStudio={universeMergeStatus:async()=>window.__current.status,universeWorkspaceStatus:async()=>window.__current.workspace,universeMergeResult:async()=>window.__current.result,universeMergeStart:async({videoIds})=>{window.__started=videoIds;return {id:21}},universeMergeCancel:async()=>({canceled:true,runId:10}),universeWorkspaceApply:async id=>{window.__applied=id;window.__current.workspace.latestImport={runId:id};return {...window.__current.workspace,created:2,updated:0,revisionProposed:0,ingestProcessed:2}},onDataChanged:()=>()=>{}};",
    "document.body.style.margin='0';document.documentElement.dataset.studioTheme=new URLSearchParams(location.search).get('theme')||'light';",
    "createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',width:'100%',height:'100dvh',padding:'14px',boxSizing:'border-box'}}><div className='ai-production-workbench' style={{width:'100%',height:'100%',display:'block'}}><div className='ai-stage-content' style={{width:'100%',height:'100%',boxSizing:'border-box'}}><Stage onOpenReview={mode=>window.__reviewMode=mode}/></div></div></div>);"
  ].join('\n');
  fs.writeFileSync(path.join(scratch,'entry.tsx'),entry);
  server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});await server.listen();
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const viewport of [{width:1648,height:900},{width:1366,height:768}]) {
    for(const theme of ['light','dark']) {
      const page=await browser.newPage({viewport});page.setDefaultTimeout(12000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(server.resolvedUrls.local[0]+'?mode=selection&theme='+theme);
      const start=page.getByRole('button',{name:/Evren taslağı oluştur/});
      await start.waitFor();
      await page.getByText('Birleştirilecek kaynakları seç').waitFor();
      assert.equal(await page.locator('.universe-batch-list label').count(),4);
      assert.equal(await page.locator('.universe-steps>span').count(),3);
      await page.waitForFunction(()=>document.querySelector('.universe-workspace-kicker')?.textContent?.includes('bekleyen'));
      const geometry=await page.evaluate(()=>{
        const e=document.querySelector('.universe-workbench').getBoundingClientRect(),s=document.querySelector('.universe-batch-selection').getBoundingClientRect(),l=document.querySelector('.universe-batch-list'),first=l.querySelector('.universe-batch-copy strong'),style=getComputedStyle(first),selected=getComputedStyle(l.querySelector('label.selected'));
        return {stageHeight:e.height,selectionBottom:s.bottom,stageBottom:e.bottom,listScroll:l.scrollHeight-l.clientHeight,fontSize:parseFloat(style.fontSize),color:style.color,selectedBg:selected.backgroundColor,videoText:first.textContent,activeButtons:document.querySelectorAll('.universe-batch-list input:checked').length};
      });
      assert(geometry.selectionBottom<=geometry.stageBottom+2 && geometry.fontSize>=12 && geometry.activeButtons===4,JSON.stringify(geometry));
      assert(!geometry.color.includes('199, 196, 189'),'The light theme must not use a legacy pale video text color.');

      await page.locator('.universe-batch-list input').nth(1).uncheck();
      await page.getByRole('button',{name:/Evren taslağı oluştur · 3 video/}).waitFor();
      await page.getByText('Sırada kalsın').waitFor();
      await page.screenshot({path:path.join(out,'selection-'+theme+'-'+viewport.width+'.png')});
      page.once('dialog',d=>d.accept());
      await page.getByRole('button',{name:/Evren taslağı oluştur · 3 video/}).click();
      await page.waitForFunction(()=>Array.isArray(window.__started));
      assert.deepEqual(await page.evaluate(()=>window.__started),['source-1','source-3','source-4']);
      assert.deepEqual(errors,[],JSON.stringify(errors));
      console.log(JSON.stringify({viewport,theme,selection:'PASS',started:'PASS',geometry}));
      await page.close();
    }
  }
  const ten=await browser.newPage({viewport:{width:1366,height:768}});ten.setDefaultTimeout(11000);
  await ten.goto(server.resolvedUrls.local[0]+'?mode=many&theme=light');
  await ten.getByText('Birleştirilecek kaynakları seç').waitFor();
  assert.equal(await ten.locator('.universe-batch-list label').count(),10);
  const overflow=await ten.evaluate(()=>{const el=document.querySelector('.universe-batch-list'),panel=document.querySelector('.universe-batch-selection');return {scroll:el.scrollHeight-el.clientHeight,bottom:panel.getBoundingClientRect().bottom,viewport:window.innerHeight}});
  assert(overflow.scroll>120 && overflow.bottom<=overflow.viewport+1,'Long source list must scroll inside the workspace: '+JSON.stringify(overflow));
  await ten.locator('.universe-batch-list label').last().scrollIntoViewIfNeeded();
  assert(await ten.locator('.universe-batch-list label').last().isVisible());
  await ten.screenshot({path:path.join(out,'selection-ten-light-1366.png')});
  await ten.close();
  const page=await browser.newPage({viewport:{width:1648,height:900}});page.setDefaultTimeout(11000);
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await page.goto(server.resolvedUrls.local[0]+'?mode=active&theme=light');
  await page.getByText('Videolar ortak Evren taslağına dönüştürülüyor').waitFor();
  assert.equal(await page.locator('.universe-run-progress-track').getAttribute('aria-valuenow'),'25');
  assert.equal(await page.locator('.universe-run-progress-track i').evaluate(e=>e.style.width),'25%');
  await page.screenshot({path:path.join(out,'processing-light-1648.png')});
  await page.goto(server.resolvedUrls.local[0]+'?mode=ready&theme=light');
  await page.getByRole('button',{name:'Taslağı İncelemeye aktar'}).waitFor();
  await page.getByText('Kayıp mekânın anlatısı',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.universe-result-source-ids').getByText(sources[0].title).count(),1);
  assert.equal(await page.locator('.universe-result-source-ids code').count(),0);
  await page.screenshot({path:path.join(out,'result-light-1648.png')});
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Taslağı İncelemeye aktar'}).click();
  await page.waitForFunction(()=>window.__applied===9&&window.__reviewMode==='records');
  await page.goto(server.resolvedUrls.local[0]+'?mode=blocked&theme=light');
  await page.getByRole('button',{name:'Revizyonlara geç'}).click();
  assert.equal(await page.evaluate(()=>window.__reviewMode),'revisions');
  await page.goto(server.resolvedUrls.local[0]+'?mode=failed&theme=light');
  await page.getByText('Hiçbir kayıt aktarılmadı').waitFor();
  assert.equal(await page.getByText('Teknik hata ayrıntısı').count(),1);
  assert.deepEqual(failures,[]);
  console.log('PASS processing progress, result source titles, apply -> review navigation, revision lock and error handling');
  await page.close();
}finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
