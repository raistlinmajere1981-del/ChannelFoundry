/** Isolated invitation editor browser test: mocked AI and no access to live SQLite. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const repo=path.resolve(import.meta.dirname,"../../..");
const studio=path.join(repo,"apps/studio");
const {createServer}=require("vite");
const {chromium}=createRequire(path.join(repo,"channels/birdesengor/web/package.json"))("playwright-core");
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),"invitation-draft-ui-"));
const items=Array.from({length:68},(_,index)=>({
 number:index+1,videoId:"mock-video-"+(index+1),
 analysisTitle:"Düğüm daveti "+(index+1),publishedAt:"2025-03-01",
 state:[25,56,66].includes(index+1)?"missing":"unstarted",editedAt:"",model:""
}));
const sources=Object.fromEntries(items.map(item=>[item.number,{
 number:item.number,videoId:item.videoId,publishedAt:item.publishedAt,
 title:item.analysisTitle,summary:"Özgün çözümleme özeti.",
 storyBeats:["Davet açılır.","Konuk konuşur."],
 storyHints:["Konuk adının sesletimi kesin değil."],
 originalSubtitle:"Davet kaydındaki konuşmalar. ".repeat(250),
 sourceHash:"x".repeat(64),sourceVideoIds:item.number===53?[item.videoId,"second-mock-source"]:[item.videoId],sourceLanguages:[item.number===52?"en":"tr"],
 imported:false,draft:null,stale:false,
}]));
let server,browser,page;
try{
 fs.symlinkSync(path.join(repo,"node_modules"),path.join(scratch,"node_modules"));
 fs.writeFileSync(path.join(scratch,"index.html"),'<html lang="tr"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
 fs.writeFileSync(path.join(scratch,"entry.tsx"),[
  "import React from 'react';import{createRoot}from'react-dom/client';",
  "import InvitationDrafts from '/@fs/"+studio+"/src/InvitationDraftWorkbench.tsx';",
  ...["studio-theme-tokens.css","styles.css","pipeline.css","studio-accessibility.css","studio-theme-bindings.css"].map(file=>"import '/@fs/"+studio+"/src/"+file+"';"),
  "const items="+JSON.stringify(items)+",sources="+JSON.stringify(sources)+";",
  "const draft=(n,title,body,state)=>({number:n,sourceVideoId:sources[n].videoId,sourceHash:sources[n].sourceHash,title,body,state,model:'mock-model',reviewNotes:['Taslak kontrol notu.'],reviewed:false,reviewedAt:'',createdAt:'2026-11-16',updatedAt:'2026-11-16'});",
  "window.testBridge={invitationDraftsList:async()=>items.map(x=>({...x})),invitationDraftsDetail:async n=>({...sources[n]}),",
  "invitationDraftsGenerate:async n=>{const d=draft(n,'Davet hikâyesi','Davetli ile konuştum. '.repeat(35),'generated');sources[n].draft=d;items[n-1].state='generated';return {draft:d,reviewNotes:d.reviewNotes}},",
  "invitationDraftsUpdate:async input=>{const d=draft(input.number,input.title,input.body,'edited');sources[input.number].draft=d;items[input.number-1].state='edited';return d},",
  "invitationDraftsReview:async input=>{const d=sources[input.number].draft;d.reviewed=input.reviewed;items[input.number-1].state=input.reviewed?'reviewed':'edited';return d}};",
  "document.body.style.cssText='background:var(--surface-canvas);margin:0;padding:12px';document.documentElement.dataset.studioTheme='dark';",
  "createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',width:'100%',minWidth:0}}><div className='ai-stage-content' style={{display:'block',width:'100%',minWidth:0}}><InvitationDrafts bridge={window.testBridge} notify={()=>{}}/></div></div>);"
 ].join("\n"));
 server=await createServer({configFile:false,root:scratch,cacheDir:path.join(scratch,'.vite'),logLevel:"error",
  esbuild:{jsx:"automatic"},resolve:{dedupe:["react","react-dom"]},
  server:{host:"127.0.0.1",port:0,fs:{allow:[repo,scratch]}}});
 await server.listen();
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),".claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome"),
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 for(const width of [1366,390]){
  page=await browser.newPage({viewport:{width,height:850}});
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole("button",{name:"1. Davet Kaynak hazır",exact:true}).waitFor();
  assert.equal(await page.locator(".invitation-draft-nav button").count(),68);
  for (const n of [25,56,66]) {
    assert.equal(await page.getByRole("button",{name:n+". Davet Doğrudan kayıt yok"}).isDisabled(),true);
  }
  await page.locator("summary").filter({hasText:"Özgün kaynak altyazı"}).click();
  assert.equal(await page.locator(".invitation-draft-subtitle").count(),1);
  await page.getByRole("button",{name:"Bu davetin taslağını üret"}).click();
  await page.getByText("Taslak kontrol notu.").waitFor();
  await page.getByLabel("Kitap bölümü başlığı · davet numarası ayrı gösterilir").fill("Yeni başlık");
  await page.getByRole("button",{name:"Taslak değişikliklerini kaydet"}).click();
  await page.getByRole("button",{name:"1. Davet Düzenlenmiş taslak",exact:true}).waitFor();
  page.once("dialog",dialog=>void dialog.accept());
  await page.getByRole("button",{name:"İnceledim · işaretle"}).click();
  await page.getByRole("button",{name:"1. Davet İncelendi",exact:true}).waitFor();
  await page.getByRole("button",{name:"İncelendi işaretini kaldır"}).click();
  await page.getByRole("button",{name:"1. Davet Düzenlenmiş taslak",exact:true}).waitFor();
  await page.getByRole("button",{name:"52. Davet Kaynak hazır",exact:true}).click();
  await page.locator("summary").filter({hasText:"Özgün kaynak altyazı (EN)"}).waitFor();
  await page.getByRole("button",{name:"53. Davet Kaynak hazır",exact:true}).click();
  await page.getByRole("link",{name:"1. kaynak video"}).waitFor();
  assert.equal(await page.getByRole("link",{name:"2. kaynak video"}).count(),1);
  const layout=await page.evaluate(()=>{
   const panel=document.querySelector(".invitation-draft-workbench");
   const nav=document.querySelector(".invitation-draft-nav");
   const detail=document.querySelector(".invitation-draft-detail");
   return {outerScrollWidth:panel.scrollWidth,outerClientWidth:panel.clientWidth,
    detailWidth:detail.getBoundingClientRect().width,navWidth:nav.getBoundingClientRect().width};
  });
  assert(layout.outerScrollWidth<=layout.outerClientWidth+2,JSON.stringify({width,layout}));
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log("PASS invitation-draft-ui",width,"navigation, source, generation, edit and no horizontal clipping");
  await page.close();page=null;
 }
}finally{await page?.close();await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
