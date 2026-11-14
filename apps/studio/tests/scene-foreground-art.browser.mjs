import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from '../../../channels/birdesengor/web/node_modules/playwright-core/index.mjs';
import {siteSceneSource,BIRDESENGOR_SITE} from '../scene-workshop-site.mjs';
import {webpDimensions} from '../scene-asset-overrides.mjs';
import {PHYSICAL_ART_SLOTS,ALL_PHYSICAL_ART_PATHS} from '../scene-physical-art.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)),origin='http://127.0.0.1:5301';
const server=spawn(process.execPath,['../../node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort','--port','5301'],{cwd:root,stdio:'pipe'});
let log='';server.stdout.on('data',b=>log+=String(b));server.stderr.on('data',b=>log+=String(b));
let browser;
try{
 let ok=false;
 for(let i=0;i<120;i++){try{if((await fetch(origin+'/tests/scene-v3-harness.html')).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
 assert.ok(ok,'Studio edit server: '+log);
 const site=siteSceneSource(),source=await site.snapshot();
 const artwork=site.previewArt(source),roomObjects=site.roomObjects(source);
 assert.equal(artwork.length,ALL_PHYSICAL_ART_PATHS.length);
 assert.deepEqual(new Set(artwork.map(a=>a.path)),new Set(ALL_PHYSICAL_ART_PATHS));
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/home/raistlin/.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome',
   headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/tests/scene-v3-harness.html',{waitUntil:'domcontentloaded'});
 const packet={scene:source.scene,presentation:source.presentation,roomObjects,
   previewImage:await site.preview(source),background:site.backgroundInfo(source),
   previewObjects:site.previewObjects(source),objectVisuals:site.objectVisuals(source),
   previewArt:artwork,focusTargets:site.focusTargets(source),
   assets:[],siteSource:true,readiness:site.readiness(source.scene,source),sourceHash:source.sourceHash};
 await page.evaluate(message=>{
   window.channelFoundryStudio={
     sceneWorkshopLoad:async()=>message,
     sceneWorkshopSave:async()=>({sourceHash:message.sourceHash,readiness:message.readiness,message:'Kaydedildi'}),
     onSceneWorkshopProgress:()=>()=>{},
   };
   window.__mountStudioSceneV3();
 },packet);
 try {
   await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22
      ||Boolean(document.querySelector('strong[role=alert]')),{timeout:30000});
 }catch(e){
   console.error('V3 foreground load diagnosis:',
     await page.locator('strong[role=alert]').allTextContents(),errors);
   throw e;
 }
 assert.equal(await page.locator('strong[role=alert]').count(),0,
   (await page.locator('strong[role=alert]').allTextContents()).join(' | '));

 assert.equal(await page.locator('#scene-room-objects [data-room-object]').count(),4,'four objects composited over room');
 assert.equal(await page.locator('#show-room-objects').getAttribute('aria-pressed'),'true');
 for(const id of ['research-journal','community-journal','camera','vefk-stand']){
   const figure=page.locator('[data-room-object="'+id+'"]');
   assert.equal(await figure.isVisible(),true,id+' room image is visible');
   assert.ok(await figure.locator('img').count()>0,id+' has original art');
   assert.ok(await figure.locator('img').first().evaluate(img=>img.decode().then(()=>img.naturalWidth>0)),id+' art decodes');
 }
 for(const record of roomObjects){
   const result=await page.locator('[data-room-object="'+record.id+'"]').evaluate(element=>{
     const view=document.querySelector('#scene-viewport').getBoundingClientRect();
     const box=element.getBoundingClientRect(),cs=getComputedStyle(element);
     return {left:parseFloat(element.style.left)/100,top:parseFloat(element.style.top)/100,
       width:parseFloat(element.style.width)/100,height:parseFloat(element.style.height)/100,
       rectWidth:box.width,viewWidth:view.width,imgCount:element.querySelectorAll('img').length,
       transform:cs.transform};
   });
   const basis=record.kind==='book'?record:record.foundation;
   assert.ok(Math.abs(result.left-basis.x)<.0001&&Math.abs(result.top-basis.y)<.0001,record.id+' placement is from web coordinates');
   assert.ok(Math.abs(result.width-basis.width)<.0001,record.id+' size is from web coordinates');
   assert.ok(result.rectWidth>5,record.id+' image has physical visible width');
   if(record.id==='camera'){
     const cameraSize=await page.locator('[data-room-object="camera"]').evaluate(node=>{
       const picture=node.querySelector('img'),outer=node.getBoundingClientRect(),image=picture.getBoundingClientRect();
       return {outerW:outer.width,outerH:outer.height,imageW:image.width,imageH:image.height,position:getComputedStyle(picture).position};
     });
     assert.equal(cameraSize.position,'static','camera body is the one fitted image within its own footprint');
     assert.ok(Math.abs(cameraSize.imageW-cameraSize.outerW)<2);
     assert.ok(Math.abs(cameraSize.imageH-cameraSize.outerH)<2);
   }
   if(record.id==='vefk-stand'){
     const diag=await page.locator('[data-room-object="vefk-stand"]').evaluate(node=>{
       const viewport=document.querySelector('#scene-viewport').getBoundingClientRect();
       return {viewport:{w:viewport.width,h:viewport.height},outer:{w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height,top:node.getBoundingClientRect().top,left:node.getBoundingClientRect().left},images:[...node.querySelectorAll('img')].map(img=>{const r=img.getBoundingClientRect(),cs=getComputedStyle(img);return{class:img.className,source:img.getAttribute('src')?.slice(0,50),natural:[img.naturalWidth,img.naturalHeight],rect:{w:r.width,h:r.height,x:r.x,y:r.y},style:{width:cs.width,height:cs.height,position:cs.position,transform:cs.transform}};})};
     });
     assert.equal(result.imgCount,4,'frame, vellum, quill and inkpot compose one device');
     for(const image of diag.images){
       assert.equal(image.style.position,'absolute',image.class+' must be positioned within the chassis');
       assert.ok(image.rect.w>1&&image.rect.h>1,image.class+' must be visible');
       assert.ok(image.rect.w<=diag.outer.w*1.04,image.class+' must never overflow the chassis width');
       assert.ok(image.rect.h<=diag.outer.h*1.04,image.class+' must never overflow the chassis height');
     }
     assert.ok(diag.images.some(image=>image.class==='scene-room-paper'&&image.rect.w<diag.outer.w*.86),
       'parchment is a contained panel, not an older room-sized fullscreen overlay');
   }
 }
 await page.locator('#show-room-objects').click();
 assert.equal(await page.locator('#scene-room-objects [data-room-object]').count(),0,'room object toggle only affects preview');
 await page.locator('#show-room-objects').click();
 assert.equal(await page.locator('#scene-room-objects [data-room-object]').count(),4);
 await page.locator('[data-room-object="camera"]').click();
 assert.match(await page.locator('#selected-object-name').textContent(),/Kamera/);
 await page.locator('#object-select-research-journal').click();
 const get=()=>page.evaluate(()=>window.__sceneEditor.snapshot());
 const file=(path)=>({name:'replacement.webp',mimeType:'image/webp',buffer:readFileSync(BIRDESENGOR_SITE+'/public'+path)});
 const book='/scene-assets/books/scene-closed/evren-master-closed.webp';
 const bookEn='/scene-assets/books/scene-closed/evren-master-closed-en.webp';
 const camera='/scene-assets/camera/research/camera-body.webp';
 const vellum='/scene-assets/vefk/vellum.webp';
 await page.locator('#object-select-research-journal').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#visual-source-settings').isVisible(),true);
 assert.equal(await page.locator('#visual-crop-settings').isVisible(),false,'book has image source but no destructive crop controls');
 assert.equal(await page.locator('#visual-source-slot option').count(),PHYSICAL_ART_SLOTS['research-journal'].length);
 assert.equal(await page.locator('#visual-source-slot').inputValue(),book);
 assert.match(await page.locator('.scene-source-warning').textContent(),/1536/);
 await page.locator('.scene-source-preview img').evaluate(async img=>{await img.decode();});
 assert.ok(await page.locator('.scene-source-preview img').evaluate(img=>img.naturalWidth>0));
 // A malformed book silhouette must fail before it enters the local draft.
 await page.locator('#visual-source-file').setInputFiles(file(vellum));
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('3:2'));
 assert.equal((await get()).assets.length,0);
 await page.locator('#visual-source-file').setInputFiles(file(bookEn));
 await page.waitForFunction(()=>document.querySelector('#visual-source-inspector')?.dataset.modified==='true',{timeout:20000});
 let draft=await get();
 assert.equal(draft.assets.length,1);
 assert.equal(draft.assets[0].path,book);
 assert.deepEqual(webpDimensions(Buffer.from(draft.assets[0].dataUrl.split(',')[1],'base64')),{width:1536,height:1024});
 assert.equal(await page.locator('.scene-source-preview img').evaluate(img=>img.getAttribute('src')===null),false);
 assert.equal(await page.locator('[data-room-object="research-journal"] img').getAttribute('src'),draft.assets[0].dataUrl,
   'new artwork is visible in the full room preview without staging');
 await page.locator('#visual-source-slot').selectOption(bookEn);
 assert.match(await page.locator('.scene-source-warning').textContent(),/Türkçe kapak/);
 await page.locator('#object-select-community-journal').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#visual-source-slot option').count(),PHYSICAL_ART_SLOTS['community-journal'].length);
 await page.locator('#visual-source-slot').selectOption('/scene-assets/books/community-live/spine.webp');
 assert.ok(await page.locator('.scene-source-preview img').isVisible());
 await page.locator('#object-select-camera').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#visual-source-slot option').count(),1);
 assert.equal(await page.locator('#visual-source-slot').inputValue(),camera);
 await page.locator('#visual-source-file').setInputFiles(file(camera));
 await page.waitForFunction(()=>document.querySelector('#visual-source-inspector')?.dataset.modified==='true',{timeout:20000});
 await page.locator('#object-select-vefk-stand').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#visual-source-slot option').count(),PHYSICAL_ART_SLOTS['vefk-stand'].length);
 assert.equal(await page.locator('#visual-source-slot').inputValue(),vellum);
 await page.locator('#visual-source-file').setInputFiles(file(vellum));
 await page.waitForFunction(()=>document.querySelector('#visual-source-inspector')?.dataset.modified==='true',{timeout:20000});
 draft=await get();
 assert.deepEqual(draft.assets.map(a=>a.path),[book,camera,vellum]);
 assert.equal(site.validateAssets(draft.assets,source).length,3);
 assert.equal(site.readiness(draft.scene,source,draft.presentation).ready,true);
 assert.deepEqual(draft.scene,source.scene);
 // Saved local sources restore in their own object, including preview.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.evaluate(message=>{
   window.channelFoundryStudio={
     sceneWorkshopLoad:async()=>message,
     sceneWorkshopSave:async()=>({sourceHash:message.sourceHash,readiness:message.readiness,message:'Kaydedildi'}),
     onSceneWorkshopProgress:()=>()=>{},
   };
   window.__mountStudioSceneV3();
 },{...packet,assets:draft.assets});
 await page.waitForFunction(()=>window.__sceneEditor?.getScene()?.effects?.length===22);
 await page.locator('#object-select-research-journal').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#visual-source-inspector').getAttribute('data-modified'),'true');
 await page.locator('#visual-source-restore').click();
 assert.notEqual(await page.locator('[data-room-object="research-journal"] img').getAttribute('src'),
   draft.assets.find(a=>a.path===book).dataUrl,'restoring draft also restores room picture');
 assert.deepEqual((await get()).assets.map(a=>a.path),[camera,vellum]);
 await page.locator('#object-select-stone-specimen').click();
 await page.locator('[data-inspector-tab="visual"]').click();
 assert.equal(await page.locator('#visual-source-slot option').count(),3,
   'stone, copper plinth and physically independent dropper sources remain editable');
 assert.equal(await page.locator('#visual-crop-settings').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS '+artwork.length+' physical art slots, book alpha ratio protection, source preview, 3-object draft restore and independent stone crop');
}finally{await browser?.close();server.kill('SIGTERM');}
