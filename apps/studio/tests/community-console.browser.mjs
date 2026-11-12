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
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'community-console-'));
const threads=Array.from({length:127},(_,index)=>({
  id:index+1,title:'Deneme konusu '+(index+1),visibility:index%4===0?'special':'community',
  locked:index%7===0,createdAt:'2026-11-10 09:00:00',updatedAt:'2026-11-12 09:00:00',
  postCount:index===0?109:2,author:{username:'uye'+index,displayName:'Üye '+index}
}));
const users=Array.from({length:132},(_,index)=>({
  id:index+1,username:index===0?'admin':'uye'+index,
  displayName:index===0?'Yönetici':'Deneme üyesi '+index,role:index===0?'admin':'member',
  status:index%8===2?'suspended':'active',researchAccess:index%3===0,
  specialAccess:index%3===0,createdAt:'2026-11-11',lastLoginAt:'2026-11-12 08:00:00',
  threadCount:index+1,postCount:index+2,email:'uye'+index+'@example.invalid',emailVerified:true
}));
let server,browser;
try{
  fs.symlinkSync(path.join(repo,'node_modules'),path.join(scratch,'node_modules'));
  fs.writeFileSync(path.join(scratch,'index.html'),'<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
  fs.writeFileSync(path.join(scratch,'entry.tsx'),[
    "import React from 'react';import{createRoot}from'react-dom/client';",
    "import CommunityAdmin from '/@fs/"+studio+"/src/CommunityAdmin.tsx';",
    ...['studio-theme-tokens.css','styles.css','studio-workspace-system.css','studio-fixed-viewport.css'].map(name=>"import '/@fs/"+studio+"/src/"+name+"';"),
    "document.body.style.margin='0';",
    "createRoot(document.getElementById('root')).render(<div className='studio-content pipeline-content' style={{height:'100dvh',width:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',padding:'14px'}}><CommunityAdmin projectId='birdesengor'/></div>);"
  ].join('\n'));
  server=await createServer({root:scratch,configFile:false,cacheDir:path.join(scratch,'.vite'),logLevel:'error',esbuild:{jsx:'automatic'},resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:0,fs:{allow:[repo,scratch]}}});
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH??path.join(os.homedir(),'.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'),headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const viewport of [{width:1648,height:900,theme:'light'},{width:1366,height:768,theme:'dark'},{width:900,height:768,theme:'light'}]){
    const page=await browser.newPage({viewport});page.setDefaultTimeout(12000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({threads,users,theme})=>{
      document.addEventListener('DOMContentLoaded',()=>{document.documentElement.dataset.studioTheme=theme;},{once:true});
      window.__calls=[];
      window.__mockThreads=[...threads];
      window.__mockUsers=[...users];
      window.__authRelease=null;
      window.__topicsRelease=null;
      window.__detailRelease=null;
      window.__session={connected:true,configured:true,connecting:false,username:'admin',lastError:null};
      window.channelFoundryStudio={
        communitySession:async()=>{window.__calls.push('session');return {...window.__session,connected:false};},
        communityAdminConnect:async()=>{window.__calls.push('connect');return new Promise(resolve=>{window.__authRelease=()=>resolve(window.__session);});},
        communityUsers:async()=>{window.__calls.push('users');return {ok:true,users:window.__mockUsers};},
        communitySetResearch:async input=>{
          window.__calls.push(input.action||'special');
          if(input.action==='forumThreads'){
            if(!window.__topicsReady)await new Promise(resolve=>{window.__topicsRelease=()=>{window.__topicsReady=true;resolve();};});
            return {threads:window.__mockThreads.map(t=>({...t}))};
          }
          if(input.action==='forumThread'){
            if(!window.__detailReady)await new Promise(resolve=>{window.__detailRelease=()=>{window.__detailReady=true;resolve();};});
            const thread=window.__mockThreads.find(t=>t.id===input.threadId);
            const count=thread?.postCount||1;
            return {thread:{...thread,posts:Array.from({length:count},(_,i)=>({
              id:thread.id*1000+i,body:'Mesaj içerik '+i,createdAt:'2026-11-12 08:00:00',editedAt:null,
              attachments:[],author:{username:'uye'+i,displayName:'Deneme üyesi '+i}
            }))}};
          }
          if(input.action==='createThread'){
            const next={id:10000,title:input.title,visibility:input.visibility,locked:false,
              createdAt:'2026-11-12 10:00:00',updatedAt:'2026-11-12 10:00:00',postCount:1,
              author:{username:'admin',displayName:'Yönetici'}};
            window.__mockThreads.unshift(next);return {threadId:next.id};
          }
          if(input.action==='updateThread'){
            window.__mockThreads=window.__mockThreads.map(t=>t.id===input.threadId?{...t,locked:input.locked,visibility:input.visibility}:t);return {ok:true};
          }
          if(input.action==='deletePost')return {ok:true};
          if(input.action==='deleteThread'){window.__mockThreads=window.__mockThreads.filter(t=>t.id!==input.threadId);return {ok:true};}
          if(!input.action){window.__mockUsers=window.__mockUsers.map(u=>u.id===input.userId?{...u,specialAccess:input.enabled,researchAccess:input.enabled}:u);return {ok:true};}
          return {ok:true};
        },
        communitySetStatus:async input=>{window.__calls.push('status');window.__mockUsers=window.__mockUsers.map(u=>u.id===input.userId?{...u,status:input.status}:u);return {ok:true};},
      };
    },{threads,users,theme:viewport.theme});
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(()=>typeof window.__authRelease==='function');
    assert.equal(await page.getByText('Topluluk hazırlanıyor').count(),1);
    assert.equal(await page.getByText('Yönetici bağlantısı gerekli').count(),0);
    assert.equal(await page.getByRole('tab',{name:/Konular/}).count(),0,'No panel flash before authentication');
    await page.evaluate(()=>window.__authRelease());
    await page.waitForFunction(()=>typeof window.__topicsRelease==='function');
    assert.equal(await page.getByText('Topluluk hazırlanıyor').count(),1,'Keep loading during forum fetch');
    await page.evaluate(()=>window.__topicsRelease());
    await page.waitForFunction(()=>typeof window.__detailRelease==='function');
    assert.equal(await page.getByText('Topluluk hazırlanıyor').count(),1,'Keep loading during first thread fetch');
    await page.evaluate(()=>window.__detailRelease());
    await page.getByRole('tab',{name:/Konular/}).waitFor();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('channel-foundry:community-summary-v1:birdesengor')||'null')?.threads===127);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('channel-foundry:community-summary-v1:birdesengor')).members),null,'Members remain unknown until opened');
    assert.equal(await page.evaluate(()=>localStorage.getItem('channel-foundry:community-summary-v1:another')),null,'Project snapshots are isolated');
    assert.equal(await page.locator('.community-admin-metrics').count(),0,'Legacy metric cards removed');
    assert.equal(await page.getByText('Bağlantı ayarları').count(),0,'Settings link removed');
    assert.equal(await page.locator('.community-console-list>.community-console-item').count(),40,'Topics are rendered in bounded pages');
    assert.equal(await page.locator('.community-console-post').count(),40,'Posts are rendered in bounded pages');
    assert.equal(await page.evaluate(()=>window.__calls.includes('users')),false,'Do not fetch users before entering members tab');
    assert.equal(await page.locator('.community-console-body').evaluate(el=>{const b=el.getBoundingClientRect();return b.width>500&&b.height>180;}),true);
    await page.getByRole('button',{name:'Sonraki liste sayfası'}).click();
    assert.equal(await page.locator('.community-console-list>.community-console-item').count(),40);
    await page.getByRole('button',{name:'Önceki liste sayfası'}).click();
    await page.getByRole('button',{name:'Sonraki mesajlar'}).click();
    assert.equal(await page.locator('.community-console-post').count(),40);
    await page.getByRole('button',{name:'Önceki mesajlar'}).click();
    await page.getByRole('button',{name:/Yeni konu/}).click();
    assert.equal(await page.getByRole('heading',{name:'Yeni konu aç'}).count(),1);
    assert.equal(await page.locator('.community-console-post').count(),0,'Compose mode replaces topic detail');
    await page.locator('.community-console-form input').first().fill('Yeni örnek konu');
    await page.locator('.community-console-form textarea').fill('İçerik');
    await page.getByRole('button',{name:'Foruma yayınla'}).click();
    await page.getByText('Yeni örnek konu').first().waitFor();
    await page.locator('.community-console-detail-top h2').getByText('Yeni örnek konu').waitFor();
    assert.equal(await page.getByRole('heading',{name:'Yeni konu aç'}).count(),0);
    await page.getByRole('button',{name:'Yanıtları kilitle'}).click();
    await page.getByRole('button',{name:'Yanıtları aç'}).waitFor();
    await page.getByRole('tab',{name:/Üyeler/}).click();
    await page.locator('.community-console-item').first().waitFor();
    assert.equal(await page.locator('.community-console-list>.community-console-item').count(),40,'Members are rendered in bounded pages');
    assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c==='users').length),1,'Users fetched only on first members tab');
    await page.locator('.community-console-list>.community-console-item').nth(1).click();
    await page.getByRole('button',{name:'Kapalı',exact:true}).click();
    await page.getByRole('button',{name:'Açık',exact:true}).waitFor();
    page.on('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Üyeliği iptal et'}).click();
    await page.getByText('Erişime kapalı').waitFor();
    assert.equal(await page.evaluate(()=>window.__calls.includes('special')&&window.__calls.includes('status')),true,'Member permissions and status remain functional');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('channel-foundry:community-summary-v1:birdesengor')||'null')?.members===132);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('channel-foundry:community-summary-v1:birdesengor')).threads),128);
    await page.getByRole('tab',{name:/Konular/}).click();
    await page.getByRole('tab',{name:/Üyeler/}).click();
    assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c==='users').length),1,'Members are cached across view switches');
    await page.getByRole('button',{name:'Sonraki liste sayfası'}).click();
    assert.equal(await page.locator('.community-console-list>.community-console-item').count(),40);
    await page.getByRole('button',{name:'Önceki liste sayfası'}).click();
    const rect=await page.locator('.community-console-body').evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
    assert(rect.height>180,'Workbench retains usable height');
    assert.deepEqual(errors,[]);
    console.log('PASS Community Console',viewport.width+'x'+viewport.height,viewport.theme,'auth gate, lazy members, create, pagination, retained selection');
    await page.close();
  }
  console.log('PASS Community Console overall');
}finally{await browser?.close();await server?.close();fs.rmSync(scratch,{recursive:true,force:true});}
