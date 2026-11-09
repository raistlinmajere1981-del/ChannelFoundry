import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const repo=path.resolve(import.meta.dirname,'../../..');
const studio=path.join(repo,'apps/studio');
const require=createRequire(import.meta.url);
const {createServer}=require('vite');
const {chromium}=createRequire(path.join(repo,'channels/birdesengor/web/package.json'))('playwright-core');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'studio-ai-activity-'));
let server,browser;
try {
fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
const entry=[
"import React from 'react';import{createRoot}from'react-dom/client';",
"import AiActivityMonitor from '/@fs/"+studio+"/src/AiActivityMonitor.tsx';",
"import{AiWorkbenchStatusProvider}from '/@fs/"+studio+"/src/AiWorkbenchStatus.tsx';",
...['studio-theme-tokens.css','styles.css','studio-workspace-system.css','studio-fixed-viewport.css'].map(n=>"import '/@fs/"+studio+"/src/"+n+"';"),
"document.body.style.margin='0';document.documentElement.setAttribute('data-studio-theme','light');",
"const at='2026-11-09T15:30:00.000Z';",
"const events=[{id:'e1',at,type:'status',tone:'info',label:'Kaynak hazırlanıyor',message:'Yerel transkript ve video bilgileri hazırlandı.'},{id:'e2',at,type:'request',label:'Evren malzemesi ve destek kayıtlarını çözümle',attempt:'primary',provider:'codex-cli',model:'gpt-6.1-terra',settings:{maxTokens:7000,temperature:.1,reasoningEffort:'low',json:true},messages:[{role:'system',content:'Rol: çözümleme',characters:15,truncated:false},{role:'user',content:'Kaynak altyazısı',characters:16,truncated:false}]},{id:'e3',at,type:'response',label:'Model yanıtı alındı',model:'gpt-6.1-terra',content:'{\"summary\":\"Örnek yanıt\"}',characters:25,durationMs:9000},{id:'e4',at,type:'request',label:'İkinci istek',attempt:'primary',provider:'codex-cli',model:'gpt-6.1-terra',messages:[]}];",
"const session={id:'run-1',key:'video',kind:'analysis',title:'Video çözümleme',subject:'Örnek video başlığı',state:'running',provider:'codex-cli',configuredModel:'gpt-6.1-terra',model:'gpt-6.1-terra',fallbackUsed:false,stage:'Evren malzemesi hazırlanıyor',detail:'Yerel kaynak',requestCount:2,responseCount:1,errorCount:0,omittedEventCount:0,startedAt:at,updatedAt:at,finishedAt:null,durationMs:23000,context:{}};",
"const snapshot={activeSessionId:'run-1',activeModel:'gpt-6.1-terra',latestModel:'gpt-6.1-terra',sessions:[session],selectedSession:{...session,events}};",
"window.channelFoundryStudio={aiAnalysisList:async()=>[{videoId:'id1',jobState:'running',title:'Örnek video başlığı'}],aiAnalysisStats:async()=>({waiting:0,running:1,errors:0}),universeMergeStatus:async()=>({run:null}),aiConfig:async()=>({provider:'codex-cli',model:'gpt-6.1-terra'}),aiActivitySnapshot:async()=>snapshot};",
"createRoot(document.getElementById('root')).render(<div className='studio-shell pipeline-shell' style={{display:'block',padding:'16px'}}><div className='ai-production-workbench' style={{display:'grid',gridTemplateRows:'auto 70px 1fr',width:'100%',height:'700px'}}><AiWorkbenchStatusProvider><AiActivityMonitor summary={{errors:0,queue:1,review:0,approved:0}}/></AiWorkbenchStatusProvider><div className='ai-stage-rail'></div><div className='ai-stage-content'></div></div></div>);"
].join('\n');
fs.writeFileSync(path.join(scratch,'entry.tsx'),entry);
server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});await server.listen();
browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
for(const viewport of [{width:1648,height:900},{width:1366,height:768}]){
const page=await browser.newPage({viewport});page.setDefaultTimeout(12000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(server.resolvedUrls.local[0]);
await page.getByRole('button',{name:'Çalışma günlüğü'}).waitFor();
await page.getByText('Video çözümleme çalışıyor').waitFor();
const bar=await page.evaluate(()=>{const el=document.querySelector('.ai-activity'),r=el.getBoundingClientRect(),status=el.querySelector('[role=progressbar]');return {height:r.height,width:r.width,details:el.querySelectorAll('.ai-activity-counts').length,indeterminate:status.classList.contains('indeterminate'),ariaNow:status.getAttribute('aria-valuenow'),summary:el.querySelector('.ai-activity-summary').getBoundingClientRect().height};});
assert(bar.height<=65&&bar.details===0&&bar.indeterminate&&bar.ariaNow===null,JSON.stringify(bar));
await page.getByRole('button',{name:'Çalışma günlüğü'}).click();
const dialog=page.getByRole('dialog',{name:'Çalışma günlüğü'});await dialog.waitFor();
assert.equal(await dialog.locator('.ai-log-event').count(),4);
assert.equal(await dialog.getByText('Model yanıtı bekleniyor').count(),1);
await dialog.getByRole('button',{name:'İstekler 2'}).click();
assert.equal(await dialog.locator('.ai-log-event').count(),2);
assert.equal(await dialog.locator('.ai-log-event-dot').first().innerText(),'2');
await dialog.getByRole('button',{name:'Yanıtlar 1'}).click();
assert.equal(await dialog.locator('.ai-log-event').count(),1);
await dialog.getByText('Yanıt metnini göster').click();
assert.equal(await dialog.locator('.ai-log-event pre').count(),1);
await dialog.getByRole('button',{name:'Durumlar 1'}).click();
assert.equal(await dialog.locator('.ai-log-event').count(),1);
await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
assert.deepEqual(errors,[]);
console.log(JSON.stringify({viewport,bar,filters:'PASS',expand:'PASS',escape:'PASS',errors:0}));
await page.close();
}
console.log('PASS compact AI activity bar and filterable chronological activity journal');
}finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
