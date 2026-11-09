import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const repo=path.resolve(import.meta.dirname,'../../..'),studio=path.join(repo,'apps/studio');
const {createServer}=require('vite');
const {chromium}=createRequire(path.join(repo,'channels/birdesengor/web/package.json'))('playwright-core');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'studio-subtitle-layout-'));
let server,browser;
const results=Array.from({length:36},(_,i)=>({videoId:'video-'+i,channelId:'channel',channelTitle:'Kanal',title:'Örnek kayıt '+i,publishedAt:'2026-11-09',url:'https://www.youtube.com',language:'tr',occurrenceCount:1,matchedTermCount:1,terms:[{term:'deneme',occurrenceCount:1,contexts:[{context:'Bu deneme altyazı arşivinde bulunuyor.',occurrenceCount:1,truncated:false}]}]}));
try {
 fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
 fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 const entry=[
 "import React from 'react';import{createRoot}from'react-dom/client';",
 "import SubtitleResearch from '/@fs/"+studio+"/src/SubtitleResearch.tsx';",
 ...['studio-theme-tokens.css','styles.css','studio-workspace-system.css','studio-fixed-viewport.css'].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
 "document.body.style.margin='0';",
 "window.channelFoundryStudio={youtubeCatalogChannels:async()=>[]};",
 "window.channelFoundrySubtitleAnalysis={search:async input=>window.__search(input)};",
 "createRoot(document.getElementById('root')).render(<div className='studio-content pipeline-content' style={{height:'100dvh',width:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',padding:'14px'}}><SubtitleResearch/></div>);"
 ].join('\n');
 fs.writeFileSync(path.join(scratch,'entry.tsx'),entry);
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const viewport of [{width:1648,height:900},{width:1366,height:768}]){
  const p=await browser.newPage({viewport});p.setDefaultTimeout(10000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.exposeFunction('__search',async input=>({searchType:'terms',generatedAt:new Date().toISOString(),terms:input.terms,matchMode:'contains',searchMode:'independent',sort:'date',channelId:'',dateFrom:'',dateTo:'',transcriptCount:606,videoCount:36,totalOccurrences:36,termStats:[{term:'deneme',videoCount:36,occurrenceCount:36}],results,markdown:'test',filename:'test.md',jsonFilename:'test.json'}));
  await p.goto(server.resolvedUrls.local[0]);
  await p.getByRole('button',{name:'İlişki Arama'}).waitFor();
  const dimensions=()=>p.evaluate(()=>{const panel=document.querySelector('.subtitle-search-panel'),region=document.querySelector('.subtitle-results-region'),submit=document.querySelector('.subtitle-search-submit');const pb=panel.getBoundingClientRect(),rb=region.getBoundingClientRect(),sb=submit.getBoundingClientRect(),rail=document.querySelector('.relation-groups-rail'),form=document.querySelector('.subtitle-search-form-v3'),fr=form.getBoundingClientRect(),filters=document.querySelector('.subtitle-advanced-filters'),filterRect=filters.getBoundingClientRect(),lastControl=filters.querySelector('label:last-of-type input'),lastRect=lastControl?.getBoundingClientRect();return {panelHeight:pb.height,panelOverflow:panel.scrollHeight-panel.clientHeight,formOverflow:form.scrollHeight-form.clientHeight,filtersInside:filterRect.bottom<=fr.bottom+2&&lastRect?.bottom<=fr.bottom+2,resultsHeight:rb.height,submitInside:sb.bottom<=pb.bottom+1,submitOnSecondRow:sb.y>filters.querySelector('label').getBoundingClientRect().y+20,submitAtRight:pb.right-sb.right<24,presetsInHeader:!!document.querySelector('.subtitle-mode-tabs .subtitle-presets'),controlWidth:filters.querySelector('label').getBoundingClientRect().width,railHeight:rail?.clientHeight||0,groupInputVisible:[...document.querySelectorAll('.relation-group-card')].every(card=>{const input=card.querySelector('.subtitle-term-input-row input');return input.getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom-1}),filters:!!document.querySelector('.subtitle-filters-heading'),hasDetails:!!document.querySelector('.subtitle-advanced-filters summary'),resultScroll:region.scrollHeight-region.clientHeight,groups:[...document.querySelectorAll('.relation-group-card')].map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})),railOverflow:rail?rail.scrollWidth-rail.clientWidth:0};});
  const term=await dimensions();assert(term.filters&&!term.hasDetails&&term.submitInside&&term.submitOnSecondRow&&term.submitAtRight&&term.presetsInHeader&&term.panelOverflow<=3&&term.filtersInside&&term.formOverflow<=3&&term.resultsHeight>140,JSON.stringify(term));
  await p.getByRole('button',{name:'İlişki Arama'}).click();
  const relation=await dimensions();assert(relation.panelHeight>term.panelHeight+100);assert(relation.submitInside&&relation.submitOnSecondRow&&relation.submitAtRight&&relation.presetsInHeader&&relation.panelOverflow<=3&&relation.filtersInside&&relation.formOverflow<=3&&relation.filters&&relation.groupInputVisible&&relation.railHeight>95,JSON.stringify(relation));
  assert(relation.groups.length===2&&Math.abs(relation.groups[0].y-relation.groups[1].y)<2&&relation.groups[0].x<relation.groups[1].x);
  for(let n=0;n<4;n++)await p.getByRole('button',{name:/Kavram grubu ekle/}).click();
  const many=await dimensions();assert(many.groups.length===6&&many.railOverflow>200&&many.groupInputVisible&&many.panelOverflow<=3,JSON.stringify(many));
  await p.getByRole('button',{name:'Terim Arama'}).click();
  await p.getByPlaceholder("Terim yaz ve Enter'a bas…").fill('deneme');
  await p.getByRole('button',{name:'Altyazılarda ara'}).click();
  await p.locator('.subtitle-result-video').first().waitFor();
  const after=await dimensions();assert(after.resultScroll>100&&after.submitInside&&after.panelOverflow<=3,JSON.stringify(after));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({viewport,termHeight:term.panelHeight,relationHeight:relation.panelHeight,groupScroll:many.railOverflow,resultScroll:after.resultScroll}));
  await p.close();
 }
 console.log('PASS SubtitleResearch: fixed composer, persistent filters, horizontal relation groups, shared actions and scrollable results');
}finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
