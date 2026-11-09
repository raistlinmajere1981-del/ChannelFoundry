/** 04 · İnceleme UI regression: isolated React fixture; never contacts real databases/services. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'../../..'),studio=path.join(root,'apps/studio');
const {createServer}=require('vite');
const {chromium}=createRequire(path.join(root,'channels/birdesengor/web/package.json'))('playwright-core');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'studio-review-reading-'));
const out=path.join(root,'artifacts/review-reading');fs.mkdirSync(out,{recursive:true});
let server,browser;
const titles=['Bledum Daveti ve Babil Yolculuğu','Yedi Kapı ve Uzak Adadaki Kavim','Amir kabilesi','Anlatıcı','Bledum’dan çağrılan davetli','Babil','Meza'];
const kinds=['story','story','character','character','character','location','location'];
const records=Array.from({length:27},(_,i)=>({
 key:'node-'+i,runId:1,kind:kinds[i%kinds.length],
 name:titles[i%titles.length]+(i>=7?' · '+i:''),state:'draft',aliases:i%4===0?['Eski ad']:[],
 summary:'Anlatıcı, davetliyle kapıları ve Amir kabilesini konuşur. '+('Bu olayın kaynaklardaki aktarımı karşılaştırıldı. ').repeat(3),
 sourceVideoIds:i%2===0?['source-1','source-2']:['source-1'],
 payload:{storyNames:['Bledum Daveti'],characterNames:['Anlatıcı','Davetli'],locationNames:['Babil'],objectNames:['Bakır tas'],
   sequence:Array.from({length:6},(_,j)=>({text:(j+1)+'. kaynakta anlatılan olay ve kişiler arasındaki ilişkiler.',sourceVideoIds:['source-1']})),
   visual:{description:'Gizemli bir daveti ve yolculuğu simgeleyen sahne.',attributes:['Gümüş işlemeli bakır tas','Su','Uzak yolcu silüetleri'],atmosphere:'Dikkatli ve gizemli',prompt:'İçinde su bulunan, gümüş işlemeli bakır tas ön planda; belirsiz yolcu silüetleri uzakta görünsün.',negativePrompt:'Belirgin yüzler ve keskin kıyafetler'}}
,updatedAt:'2026-11-09'
}));
try{
 fs.symlinkSync(path.join(root,'node_modules'),path.join(scratch,'node_modules'));
 fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 const entry=[
  "import React from 'react';import{createRoot}from'react-dom/client';",
  "import Review from '/@fs/"+studio+"/src/EditorialReviewWorkspace.tsx';",
  ...['studio-theme-tokens.css','styles.css','pipeline.css','studio-accessibility.css','studio-theme-bindings.css','studio-workspace-system.css','studio-workspace-layout.css','studio-fixed-viewport.css','ai-editorial-review.css','universe-workbench.css','ai-production-workbench.css'].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
  "window.__rows="+JSON.stringify(records)+";",
  "const hasRevision=new URLSearchParams(location.search).get('revision')==='1';",
  "window.__revisions=hasRevision?[{id:7,nodeKey:'node-0',runId:2,baseRunId:1,state:'pending',diff:['summary'],proposed:{name:window.__rows[0].name,summary:'Yeni video önceki yolculuk ayrıntılarını tamamlıyor.',aliases:[],sourceVideoIds:['source-1'],payload:{}},createdAt:'2026-11-09',reviewedAt:null}]:[];",
  "const count=()=>({total:window.__rows.length,draft:window.__rows.filter(r=>r.state==='draft').length,approved:window.__rows.filter(r=>r.state==='approved').length,pendingRevisions:window.__revisions.filter(r=>r.state==='pending').length});",
  "window.channelFoundryStudio={universeWorkspaceStatus:async()=>({latestImport:null,counts:count()}),universeWorkspaceList:async(input)=>input?.view==='revisions'?window.__revisions:input?.view==='history'?[]:window.__rows,universeWorkspaceSetState:async({keys,state})=>{window.__rows=window.__rows.map(r=>keys.includes(r.key)?{...r,state}:r);return {counts:count()};},youtubeCatalogVideos:async()=>[{videoId:'source-1',title:'Birinci anlatı'},{videoId:'source-2',title:'İkinci anlatı'}],navigate:(dest)=>window.__destination=dest,onDataChanged:()=>()=>{}};",
  "document.documentElement.dataset.studioTheme=new URLSearchParams(location.search).get('theme')||'light';",
  "document.body.style.margin='0';createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',width:'100%',height:'100dvh',padding:'14px',boxSizing:'border-box'}}><div className='ai-production-workbench' style={{height:'100%',display:'block'}}><div className='ai-stage-content' style={{height:'100%',boxSizing:'border-box'}}><Review onReadyForUniverse={()=>window.__returned=true}/></div></div></div>);"
 ].join('\n');
 fs.writeFileSync(path.join(scratch,'entry.tsx'),entry);
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,scratch]}}});await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:1648,height:900},{width:1366,height:768}]){
 for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport});page.setDefaultTimeout(14000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'?theme='+theme);
 await page.getByText('Editoryal karar alanı').waitFor();
 await page.getByText('Bledum Daveti ve Babil Yolculuğu',{exact:true}).first().waitFor();
 assert.equal(await page.getByText('Yeni kayıtları onayla; onaylı kayıtlara gelen değişiklikleri ayrı revizyon olarak değerlendir.').count(),0);
 assert.equal(await page.getByText('İnceleme sonraki tura hazır.').count(),0);
 assert.equal(await page.getByText(/Görsel Tamamlama aşamasında/).count(),0);
 assert.equal(await page.getByText('GÖRSEL TANIM').count(),1);
 const layout=await page.evaluate(()=>{
 const rect=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom}:null;};
 const selected=document.querySelector('.ai-review-list>div:last-child>button.active');
 const rows=[...document.querySelectorAll('.ai-review-list>div:last-child>button')];
 const area=document.querySelector('.ai-review-list');
 const toolbar=area.querySelector('.ai-review-toolbar');
 const detail=document.querySelector('.ai-review-detail');
 return {stage:rect('.editorial-review-workspace'),head:rect('.review-mode-header'),gate:rect('.review-readiness-gate'),status:document.querySelector('.review-header-status')?.textContent.trim(),list:rect('.ai-review-list'),detail:rect('.ai-review-detail'),
   type:rect('.ai-review-toolbar>select:nth-of-type(1)'),state:rect('.ai-review-toolbar>select:nth-of-type(2)'),
   toolbarScroll:toolbar.scrollWidth-toolbar.clientWidth,listScrollX:area.scrollWidth-area.clientWidth,
   rowCount:rows.length,selectedBg:getComputedStyle(selected).backgroundColor,selectedText:getComputedStyle(selected.querySelector('strong')).color,detailText:getComputedStyle(detail.querySelector('.ai-review-summary p')).color,
   panelCount:detail.querySelectorAll(':scope>article,:scope>section,:scope>footer').length};
 });
 assert(layout.head.h<75 && layout.gate===null && layout.status==='Bekleyen revizyon yok','Header status must replace separate readiness bar: '+JSON.stringify(layout));
 assert.equal(await page.getByRole('button',{name:'Evrene İşlemeye dön'}).count(),0);
 assert(layout.type.w<165&&layout.state.w<165,'Dropdowns must fit their content: '+JSON.stringify(layout));
 assert(layout.toolbarScroll<=2&&layout.listScrollX<=2,'Review filter must not scroll horizontally: '+JSON.stringify(layout));
 assert(layout.panelCount>=4,'Review details should form separate reading panels');
 if(theme==='light') assert.equal(layout.selectedBg,'rgb(234, 219, 197)','Light selection should not be black');
 else assert.notEqual(layout.selectedBg,'rgb(234, 219, 197)','Dark selection should respect dark tokens');
 const row=page.locator('.ai-review-list>div:last-child>button').nth(1);
 await row.hover();
 const hovered=await row.evaluate(e=>getComputedStyle(e).backgroundColor);
 assert.notEqual(hovered,'rgb(19, 24, 32)','Hover must not use hard coded dark theme on light');
 await row.click();
 assert.equal(await row.getAttribute('class'),'active');
 await page.getByText('Yedi Kapı ve Uzak Adadaki Kavim',{exact:true}).last().waitFor();
 await page.screenshot({path:path.join(out,'review-'+theme+'-'+viewport.width+'.png')});
 console.log(JSON.stringify({viewport,theme,layout,hovered,checks:'PASS'}));
 assert.deepEqual(errors,[]);
 await page.close();
 }}
 const rev=await browser.newPage({viewport:{width:1366,height:768}});rev.setDefaultTimeout(11000);
 await rev.goto(server.resolvedUrls.local[0]+'?theme=light&revision=1');
 await rev.getByText('1 revizyon kararı bekliyor').waitFor();
 await rev.getByRole('button',{name:/Revizyonlar 1/}).click();
 await rev.getByText('Yeni video önceki yolculuk ayrıntılarını tamamlıyor.',{exact:true}).waitFor();
 const revStyles=await rev.evaluate(()=>{
   const row=document.querySelector('.revision-review-list-rows>button.active');
   const text=row?.querySelector('strong');
   const h=document.querySelector('.review-mode-header').getBoundingClientRect();
   const selector=document.querySelector('.revision-review-toolbar select').getBoundingClientRect();
   return {bg:getComputedStyle(row).backgroundColor,title:getComputedStyle(text).color,headerHeight:h.height,selectorWidth:selector.width};
 });
 assert.equal(revStyles.bg,'rgb(234, 219, 197)','Revizyon seçimi de açık tema yüzeyini kullanmalı');
 assert(revStyles.headerHeight<75 && revStyles.selectorWidth<=160,JSON.stringify(revStyles));
 await rev.screenshot({path:path.join(out,'revision-light-1366.png')});
 await rev.close();
 console.log('PASS 04 review: compact header, bounded filters, theme hover/active, readable grouped content, no visual-production placeholders, revisions');
}finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
