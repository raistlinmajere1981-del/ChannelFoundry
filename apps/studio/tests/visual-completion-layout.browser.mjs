/** Stage 06 production UI layout, disposable mock data; no channel writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const repo=path.resolve(import.meta.dirname,'../../..'),studio=path.join(repo,'apps/studio');
const {createServer}=require('vite');
const {chromium}=createRequire(path.join(repo,'channels/birdesengor/web/package.json'))('playwright-core');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'stage06-layout-'));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'stage06-artifacts-'));
const seed={description:'',attributes:[],atmosphere:'',prompt:'',negativePrompt:''};
const scenes=[1,2].map(i=>({
  sectionKey:'section-'+i,revisionId:i,revisionNo:1,position:i-1,
  title:'Deneme sahnesi '+i,body:'Görsel kararı verilen deneme anlatısı.',
  sourceKeys:[],sourceVideoIds:[],entityReferences:[],role:'scene',
  profileKey:'profile-'+i,assetId:'asset-'+i,state:'skipped',seed,profile:null
}));
const status={sections:scenes,entities:[],
  counts:{sections:2,sceneReady:0,sceneSkipped:2,scenePending:0,entities:0,entityReady:0,entityMissing:0},complete:true};
let server,browser,page;const errors=[];
try{
  fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
  fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
  const entry=[
    "import React from 'react';import{createRoot}from'react-dom/client';",
    "import Visual from '/@fs/"+studio+"/src/VisualCompletionWorkbench.tsx';",
    ...['studio-theme-tokens.css','styles.css','pipeline.css','studio-accessibility.css','studio-theme-bindings.css','studio-workspace-system.css','studio-fixed-viewport.css'].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
    "const result="+JSON.stringify(status)+";",
    "window.channelFoundryStudio={visualCompletionStatus:async()=>result,onDataChanged:()=>()=>{},visualCompletionSetSceneState:async()=>result,visualProfileGet:async()=>null,aiImageCapability:async()=>null};",
    "document.body.style.cssText='margin:0;padding:12px;background:var(--surface-canvas)';",
    "document.documentElement.dataset.studioTheme='light';createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',minWidth:0}}><div className='ai-stage-content' style={{display:'block',height:'calc(100dvh - 24px)',overflow:'auto'}}><Visual/></div></div>);"
  ].join('\n');
  fs.writeFileSync(path.join(scratch,'entry.tsx'),entry);
  server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',
    esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},
    server:{host:'127.0.0.1',port:0,fs:{allow:[studio,path.join(repo,'node_modules'),scratch]}}});
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  for(const width of [1920,1366,390])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:900});await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
    await page.evaluate(theme=>{document.documentElement.dataset.studioTheme=theme},theme);
    await page.locator('.visual-completion-list > button').first().waitFor();
    assert.equal(await page.locator('.visual-completion-header,.visual-completion-gate:not(.empty),.visual-completion-state').count(),0);
    assert.equal(await page.locator('.visual-completion-metrics > .panel').count(),4);
    const geo=await page.evaluate(()=>{
      const metrics=document.querySelector('.visual-completion-metrics');
      const first=metrics.getBoundingClientRect(),layout=document.querySelector('.visual-completion-layout').getBoundingClientRect();
      const root=document.querySelector('.visual-completion-workbench');
      const cells=[...metrics.children].map(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
      return {height:first.height,top:first.top,layoutTop:layout.top,rootTop:root.getBoundingClientRect().top,scroll:metrics.scrollWidth,client:metrics.clientWidth,cells};
    });
    assert(Math.abs(geo.top-geo.rootTop)<3,'Metrics not first row '+JSON.stringify(geo));
    assert(geo.layoutTop>=geo.top+geo.height && geo.scroll<=geo.client+2,JSON.stringify(geo));
    assert(geo.height<=(width<760?125:65),JSON.stringify(geo));
    for(const c of geo.cells)assert(c.scroll<=c.client+2,JSON.stringify({width,theme,c}));
    assert.deepEqual(await page.locator('.visual-completion-metrics small').allTextContents(),['SAHNE HAZIR','GÖRSELSİZ','BEKLİYOR','ARŞİV GÖRSELİ']);
    await page.locator('.visual-completion-list > button').nth(1).click();
    await page.locator('.visual-completion-context h3').getByText('Deneme sahnesi 2').waitFor();
    await page.screenshot({path:path.join(out,'stage06-'+theme+'-'+width+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Stage06 compact metrics, no extra panels, selection on 1920/1366/390 light/dark. Artifacts:',out);
}catch(e){if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw e}
finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true})}
