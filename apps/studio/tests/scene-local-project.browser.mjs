import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {createLocalScene,localSceneSource} from '../scene-workshop-local.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';

const work=mkdtempSync(join(tmpdir(),'scene-selector-ui-'));
const local=createLocalScene(work,'Bağımsız Sahne');
const site=siteSceneSource(),siteState=await site.snapshot();
const localSource=localSceneSource(work,local.id),localState=await localSource.snapshot();
const packet=(state,source,siteBound)=>({
  scene:state.scene,presentation:state.presentation,origin:'site',sourceHash:state.sourceHash,
  siteSource:siteBound,canPublish:siteBound,
  previewImage:null,previewObjects:source.previewObjects(state),
  previewArt:source.previewArt?.(state)??[],roomObjects:source.roomObjects?.(state)??[],
  focusTargets:source.focusTargets?.(state)??[],
  assets:[],readiness:source.readiness(state.scene,state),note:'Sahne açıldı',
});
const packets={
  birdesengor:{...packet(siteState,site,true),previewImage:await site.preview(siteState),background:site.backgroundInfo(siteState)},
  [local.id]:{...packet(localState,localSource,false),previewImage:await localSource.preview(localState),background:localSource.backgroundInfo(localState)},
};
const origin='http://127.0.0.1:5298';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5298'],
  {cwd:new URL('../',import.meta.url).pathname,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
let browser;
try{
 let ready=false;
 for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ready,'Vite did not start '+log);
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1580,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(({packets,local})=>{
   window.__savedPackets=[];
   window.channelFoundryStudio={
     sceneWorkshopProjects:async()=>[
       {id:'birdesengor',label:'BirDeSenGör',siteBound:true,canPublish:true},
       {id:local.id,label:local.label,siteBound:false,canPublish:false},
     ],
     sceneWorkshopLoad:async input=>packets[input?.projectId??'birdesengor'],
     sceneWorkshopSave:async input=>{
       window.__savedPackets.push(input);
       return {sourceHash:packets[input.projectId].sourceHash,
         readiness:packets[input.projectId].readiness,message:'Kaydedildi'};
     },
     sceneWorkshopPrepare:async()=>({sourceHash:'test',readiness:{ready:true,effectCount:0,enabledCount:0,mountedCount:0,problems:[]},message:'Yerel sahne hazır'}),
     sceneWorkshopInvalidate:async()=>({ok:true}),
     sceneWorkshopCreate:async input=>{window.__createdSceneName=input.name;return local;},
     onSceneWorkshopProgress:()=>()=>{},
   };
   window.__mountStudioSceneV3();
 },{packets,local});
 await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.objects.length===14,{timeout:15000});
 assert.equal(await page.getByRole('button',{name:'Canlı yayın'}).count(),1);
 await page.locator('[aria-label="Sahne projesi"]').selectOption(local.id);
 await page.waitForFunction(id=>window.__sceneEditor?.getScene()?.sceneId==='local-'+id,local.id);
 assert.equal(await page.locator('#object-count').textContent(),'0');
 assert.equal(await page.getByRole('button',{name:'Canlı yayın'}).count(),0,'local project has no deploy control');
 assert.equal(await page.getByRole('button',{name:'Ön kontrol'}).count(),0,'local project has no preflight');
 assert.equal(await page.getByRole('button',{name:'Yerelde hazırla'}).count(),1);
 assert.equal(await page.locator('#visual-edit-mode').isDisabled(),false);
 assert.equal(await page.locator('[data-inspector-page="background"]').count(),1);
 await page.locator('#open-background').click();
 assert.match(await page.locator('#background-original-dimensions').textContent(),/1024 × 512/);
 const jpg=readFileSync(new URL('./fixtures/room-2x1-alt.webp',import.meta.url));
 await page.locator('#new-artwork-file').setInputFiles({name:'local-object.webp',mimeType:'image/webp',buffer:jpg});
 await page.waitForFunction(()=>window.__sceneEditor.getScene().objects.length===1);
 const state=await page.evaluate(()=>window.__sceneEditor.snapshot());
 assert.equal(state.assets.length,1);
 await page.getByRole('button',{name:/^Kaydet/}).click();
 await page.waitForFunction(()=>window.__savedPackets.length===1);
 const saved=await page.evaluate(()=>window.__savedPackets[0]);
 assert.equal(saved.projectId,local.id);
 assert.equal(localSource.validateAssets(saved.assets,localState,saved.scene).length,1);
 await page.locator('[aria-label="Sahne projesi"]').selectOption('birdesengor');
 await page.waitForFunction(()=>window.__sceneEditor.getScene().sceneId==='birdesengor-study-v2');
 assert.equal(await page.getByRole('button',{name:'Canlı yayın'}).count(),1);
 page.once('dialog',dialog=>dialog.accept('İkinci Deneme Sahnesi'));
 await page.getByRole('button',{name:'＋ Sahne'}).click();
 await page.waitForFunction(id=>window.__sceneEditor.getScene().sceneId==='local-'+id,local.id);
 assert.equal(await page.evaluate(()=>window.__createdSceneName),'İkinci Deneme Sahnesi');
 assert.equal(await page.getByRole('button',{name:'Canlı yayın'}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS independent scene selection, blank canvas, artwork, draft identity and publish isolation');
}finally{await browser?.close();server.kill('SIGTERM');rmSync(work,{recursive:true,force:true});}
