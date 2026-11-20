import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const repo=path.resolve(import.meta.dirname,'../../..');
const studio=path.join(repo,'apps/studio');
const {createServer}=require('vite');
const {chromium}=createRequire(path.join(repo,'channels/birdesengor/web/package.json'))('playwright-core');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bds-dashboard-status-'));
let server,browser;
try{
 fs.symlinkSync(path.join(repo,'node_modules'),path.join(tmp,'node_modules'));
 fs.writeFileSync(path.join(tmp,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 fs.writeFileSync(path.join(tmp,'entry.tsx'),`
import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '/@fs/${studio}/src/Dashboard.tsx';
import '/@fs/${studio}/src/studio-theme-tokens.css';
import '/@fs/${studio}/src/styles.css';
let version=0;
let previewMode='same',seoMode='ready';
const rows=[{kind:'video',id:'unpublished-video',flags:{missing:true}}];
const lang={counts:{ready:3062,missing:236,pending:0,stale:0,errors:0},rows};
(window as any).channelFoundryStudio={
  publicationPreview:async()=>previewMode==='error'
   ?{baselineAvailable:false,changed:true,liveError:'Bağlantı hatası'}
   :{baselineAvailable:true,changed:previewMode==='changed'},
  languagesOverview:async()=>lang,
  seoOverview:async()=>{if(seoMode==='error')throw new Error('SEO read failed');
   await new Promise(resolve=>setTimeout(resolve,100));
   return {rows:{length:6094},draftCount:0};},
  analyticsSummary:async()=>({visits:0,activeSeconds:0,areas:[]}),
};
const root=createRoot(document.getElementById('root')!);
(window as any).__renderDashboard=(p='same',seo='ready')=>{
 previewMode=p;seoMode=seo;version++;
 root.render(<Dashboard key={version} items={[]} relations={[]}
 catalog={{total:625} as any} catalogVideos={[]}
 aiStats={{transcripts:615,analyzed:286,waiting:0,running:0,errors:0}}
 mergeStatus={null} workspaceNodes={[]}
 workspaceStatus={{counts:{approved:2717,approvedRelations:5519,draft:0,pendingRevisions:0}} as any}
 publicationInfo={{generatedAt:'',file:'',itemCount:2996,relationCount:5519,publicationId:'pub-current'}}
 activeProjectId="birdesengor" onNavigate={()=>{}}/>);
};
document.body.style.cssText='margin:12px;background:#191919;color:#efe5d1;';
(window as any).__renderDashboard();
`);
 server=await createServer({configFile:false,root:tmp,cacheDir:path.join(tmp,'.vite'),
  logLevel:'error',resolve:{dedupe:['react','react-dom']},
  server:{host:'127.0.0.1',port:0,fs:{allow:[repo,tmp]}}});
 await server.listen();
 const chrome=process.env.CHROME_PATH??[
  path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),
  '/usr/bin/chromium','/usr/bin/google-chrome'].find(fs.existsSync);
 assert(chrome,'Chromium required for dashboard browser regression');
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1650,height:920}});
 page.setDefaultTimeout(15000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);
 await page.getByText('paket güncel',{exact:true}).waitFor();
 await page.getByText('6094 sayfa · tamamı onaylı',{exact:true}).waitFor();
 await page.getByText('Kamera · İngilizce özet bekliyor',{exact:true}).waitFor();
 assert.equal(await page.getByText('Public paketi güncelle',{exact:true}).count(),0,
  '2717 entities vs 2996 total publication records must not trigger update');
 assert.equal(await page.getByText('Demo yayını arama motorlarına kapalı.',{exact:false}).count(),0);
 await page.evaluate(()=>window.__renderDashboard('changed'));
 await page.getByText('canlı yayın yerelden farklı',{exact:true}).waitFor();
 await page.getByText('Public paketi güncelle',{exact:true}).waitFor();
 await page.evaluate(()=>window.__renderDashboard('error','error'));
 await page.getByText('Canlı yayın doğrulanamadı',{exact:true}).waitFor();
 await page.getByText('SEO kontrolü başarısız',{exact:false}).waitFor();
 assert.equal(await page.getByText('Public paketi güncelle',{exact:true}).count(),0,
  'network errors never count as publication differences');
 assert.deepEqual(errors,[]);
 console.log('PASS Studio Dashboard: accurate live fingerprint state, current/changed/unreachable states, SEO success/error and Camera English summary status');
}finally{
 await browser?.close();await server?.close();fs.rmSync(tmp,{recursive:true,force:true});
}
