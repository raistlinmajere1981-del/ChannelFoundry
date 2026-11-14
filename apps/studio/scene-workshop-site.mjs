import {writeFile,unlink,chmod} from 'node:fs/promises';
import {readFileSync,renameSync,statSync,realpathSync,copyFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {importProject,validateProject,exportProject} from '../../packages/effect-engine/src/model/project.mjs';
import {compileObjectScene} from '../../packages/effect-engine/src/runtime/object-compile.mjs';
import {validateAssetOverrides,webpDimensions,ROOM_BACKGROUND_ASSET} from './scene-asset-overrides.mjs';
import {PHYSICAL_ART_SLOTS,ALL_PHYSICAL_ART_PATHS} from './scene-physical-art.mjs';
import {closedBooksFor} from '../../channels/birdesengor/web/src/book/closedBookLayout.js';
import {buildVideoCatalog} from '../../channels/birdesengor/web/src/camera/videoCatalog.js';
import {validateScenePresentation} from '../../packages/effect-engine/src/model/scene-presentation.mjs';

export const BIRDESENGOR_SITE=resolve(dirname(fileURLToPath(import.meta.url)),'../../channels/birdesengor/web');
export const SITE_SCENE='src/effects/birdesengor-effects.v2.json';
const MANIFEST='src/scene/data/study.scene.json';
const PRESENTATION='src/scene/data/scene-presentation.v1.json';
const ADAPTER='src/effects/effectsAdapter.js';
const PREVIEW='public'+ROOM_BACKGROUND_ASSET;
const INDEPENDENT_ROOM_MATERIAL_IDS=Object.freeze(['water-basin','guardian-sword-left','guardian-sword-right','candle','incense-holder']);
const ROOT='src/scene/SceneRoot.jsx';
const STAGE_CSS='src/scene/study-foundation.css';
const LANGUAGE_CSS='src/language/language.css';
// The book/camera/workshop presentation contract depends on these authored
// styles. Include them in the optimistic source revision before staging.
const PRESENTATION_STYLES=Object.freeze([
 'src/book/universe-tome.css','src/book/book-ribbons.css',
 'src/book/journal-pages.css','src/book/physical-books.css',
 'src/book/scene-closed-books.css',
 'src/book/reading-controls.css','src/community/community-journal.css',
 'src/camera/camera-artwork.css','src/camera/camera-single-view.css',
 'src/vefk/physical-vefk.css',
]);
const CANDLE_HOST='src/effects/CandleEffects.jsx';
const PASSIVE_HOST='src/effects/PassiveObjectEffects.jsx';
const HOVER_HOST='src/effects/HoverObjectEffects.jsx';
const EFFECT_HOOK='src/effects/useObjectEffects.js';
const EFFECT_CALL_SITES=new Set([CANDLE_HOST,PASSIVE_HOST,EFFECT_HOOK,HOVER_HOST]);

/** A reviewed static mount contract, not merely a module on disk. The actual
 * browser animation/interaction contract is covered by site Chromium tests.
 * Unknown effect call sites or removed CSS/hosts invalidate staging. */
function verifiedMounts(entries){
 const code=file=>entries.get(file)?.toString('utf8')??'';
 const scene=code(ROOT),candle=code(CANDLE_HOST),passive=code(PASSIVE_HOST),hover=code(HOVER_HOST),hook=code(EFFECT_HOOK),css=code(STAGE_CSS),language=code('src/language/LanguageSwitch.jsx'),languageCss=code(LANGUAGE_CSS);
 const checks={
  'V2 has positioned passive hosts':scene.includes("AMBIENT_EFFECT_IDS.has(object.id) ? 'study-effect-host'")
    && scene.includes('ambientHostStyle(object)') && scene.includes('normalizedRoomPose(object)'),
  'Candle component mounted in room':/<CandleEffects\s+mode=\{candleEffectMode\(candleState\)\}/.test(scene)
    && scene.includes("from '../effects/CandleEffects.jsx'"),
  'Passive allowlist mounted in room':scene.includes('PASSIVE_EFFECT_IDS.map(objectId => (')
    && /<PassiveObjectEffects\s+key=\{objectId\}\s+objectId=\{objectId\}/.test(scene)
    && scene.includes("from '../effects/PassiveObjectEffects.jsx'"),
  'Hover overlays are mounted over photographed targets and use original focus controls':scene.includes('<HoverObjectEffects enabled={state.phase===\'room\'}')
    && scene.includes('study-hover-host') && scene.includes('HOVER_OBJECT_EFFECT_GROUPS')
    && scene.includes("from '../effects/HoverObjectEffects.jsx'")
    && hover.includes('useHoverObjectEffects({enabled,reducedMotion})')
    && hook.includes('sceneForHoverObjectEffects(scene,objectId)')
    && hook.includes('interactionTarget:input')
    && hook.includes('bindObjectScene(compiled,()=>host')
    && css.includes('.study-hover-host { pointer-events:none;'),
  'Pulse buttons and short-lived canonical mounts are wired':scene.includes("usePulseObjectEffects({enabled:state.phase==='room',reducedMotion})")
    && scene.includes('data-pulse-object-id={object.id}') && scene.includes('onClick={()=>pulse(object.id)}')
    && scene.includes('study-pulse-host') && hook.includes('sceneForPulseObjectEffects(scene,id)')
    && hook.includes('bindObjectScene(compiled,()=>motion?element:host') && hook.includes('handle.destroy();host.remove()')
    && hook.includes("from './pulseController.js'"),
  'Inactive scene effects publish no transparent click/hover targets':
    scene.includes('ACTIVE_PULSE_IDS.has(object.id)')
    && scene.includes('ACTIVE_HOVER_INPUT_IDS.has(object.id)')
    && scene.includes("CANDLE_EFFECT_ACTIVE && roomObjectVisible('candle') && <button")
    && scene.includes("INCENSE_EFFECT_ACTIVE && roomObjectVisible('incense-holder') && <button")
    && scene.includes('[...ACTIVE_HOVER_IDS].filter')
    && scene.includes("hoverEnabled={ACTIVE_HOVER_IDS.has('camera')}")
    && scene.includes('if(!roomObjectVisible(object.id))return null;')
    && hook.includes('if(!roomObjectVisible(objectId))continue;')
    && hook.includes('allowed:id=>roomObjectVisible(id)')
    && hook.includes("if(!selection.effects.some(effect=>effect.enabled))continue;")
    && hook.includes('...(interactive ? {interactive:true,interactionTarget:input} : {})'),
  'Motion slot mounts the declared visual layer':scene.includes('object.visual.layers.map')
    && scene.includes('data-effect-layer={layer.id}') && scene.includes('study-metal-fixed')
    && hook.includes('bindObjectScene(compiled,()=>motion?element:host'),
  'Candle uses canonical hook':candle.includes('useObjectEffects({') && candle.includes("objectId: 'candle'")
    && candle.includes('enabled,'),
  'Passive uses canonical hook':passive.includes('useObjectEffects({') && passive.includes('effectGroup: objectId'),
  'Runtime compiles and binds canonical scene':hook.includes('compileObjectScene(selected)')
    && hook.includes('bindObjectScene(compiled, () => element')
    && hook.includes('assertAuthoredScene(scene, SCENE_MANIFEST)'),
  'Physical language switch is presentation-driven but locale-owned':
    language.includes('languageSwitchStyle(scenePresentation.controls.languageSwitch)')
    &&language.includes('requestLanguageChange(')
    &&scene.includes('<LanguageSwitch/>:<LanguagePlate/>')
    &&languageCss.includes('var(--switch-desktop-x')
    &&languageCss.includes('var(--switch-mobile-bottom'),
  'Photo-space effect hosts are positioned and non-interactive':/\.study-effect-host\s*\{[^}]*position:\s*absolute;[^}]*pointer-events:\s*none;/.test(css)
    && css.includes('.study-effect-host .object-effect-overlay { pointer-events: none !important; }'),
 };
 const unreviewedPulses=[...entries].filter(([file,bytes])=>/\.(?:js|jsx)$/.test(file)
   && /\busePulseObjectEffects\s*\(/.test(bytes.toString('utf8')) && ![ROOT,EFFECT_HOOK].includes(file)).map(([file])=>file);
 const unreviewedHover=[...entries].filter(([file,bytes])=>/\.(?:js|jsx)$/.test(file)
   && /\buseHoverObjectEffects\s*\(/.test(bytes.toString('utf8'))
   && ![EFFECT_HOOK,HOVER_HOST].includes(file)).map(([file])=>file);
 const unreviewed=[...entries].filter(([file,bytes])=>/\.(?:js|jsx)$/.test(file)
   && /\buseObjectEffects\s*\(/.test(bytes.toString('utf8')) && !EFFECT_CALL_SITES.has(file)).map(([file])=>file);
 const failures=Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name);
 unreviewed.push(...unreviewedPulses,...unreviewedHover);
 if(unreviewed.length)failures.push('unreviewed effect call sites: '+unreviewed.join(', '));
 return {ready:failures.length===0,failures};
}
const digest=entries=>createHash('sha256').update(JSON.stringify(entries)).digest('hex');

// root is injectable for isolated filesystem tests only. The Admin dispatcher
// always uses BIRDESENGOR_SITE; no environment/registry can redirect this writer.
export function siteSceneSource(root=BIRDESENGOR_SITE){
 const path=relative=>join(root,relative);
 const read=relative=>{
  const file=path(relative);
  if(realpathSync(file)!==resolve(file)||!statSync(file).isFile())throw Error('Site kaynağı normal yerel dosya olmalı: '+relative);
  return readFileSync(file);
 };
 async function snapshot(){
  const entries=new Map();
  for(const file of [SITE_SCENE,MANIFEST,PRESENTATION,ADAPTER,PREVIEW,STAGE_CSS,LANGUAGE_CSS,...PRESENTATION_STYLES])entries.set(file,read(file));
  // Follow the actual scene's relative JS imports. Dormant effect components
  // elsewhere in src are NOT proof of a mounted runtime slot. A newly wired
  // hook requires a reviewed mount contract before this writer can admit it.
  function visit(file){
   if(entries.has(file))return;
   const bytes=read(file);entries.set(file,bytes);
   const code=bytes.toString('utf8');
   for(const match of code.matchAll(/(?:import|export)\s+(?:[^;'"\n]+?\s+from\s*)?['"](\.[^'"]+\.(?:js|jsx))['"]/g)){
    const dependency=join(dirname(file),match[1]);
    if(!dependency.startsWith('src/'))throw Error('Site modülü src/ dışına çıkamaz.');
    visit(dependency);
   }
  }
  visit(ROOT);
  const sourceManifest=JSON.parse(entries.get(MANIFEST));
  for(const object of (sourceManifest.objects??[]).filter(o=>o.motionLayers?.length||INDEPENDENT_ROOM_MATERIAL_IDS.includes(o.id))){
    for(const asset of [object.visual.asset,...(object.visual.layers??[]).map(layer=>layer.asset)]){
      if(!/^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(asset))throw Error('Geçersiz hareket görsel yolu.');
      const file='public'+asset;entries.set(file,read(file));
    }
  }
  // Approved foreground art belongs to independent mounted sources, not to
  // the background scene photo. Track every byte in optimistic revision hash.
  for(const asset of ALL_PHYSICAL_ART_PATHS){
    if(!/^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(asset))
      throw Error('Sahne görsel kataloğunda geçersiz kaynak yolu.');
    entries.set('public'+asset,read('public'+asset));
  }
  const draft=JSON.parse(entries.get(SITE_SCENE).toString('utf8'));
  for(const object of draft.objects??[]){
    if(object.kind!=='artwork')continue;
    for(const asset of [object.visual?.asset,...(object.visual?.layers??[]).map(layer=>layer.asset)]){
      if(!/^\/scene-assets\/custom\/[a-z0-9-]+\.webp$/.test(asset??''))
        throw Error('Geçersiz bağımsız görsel yolu.');
      const file='public'+asset;
      if(!entries.has(file))entries.set(file,read(file));
    }
  }
  const chestGlowMask='public/scene-assets/chest/interior-light-mask.webp';
  entries.set(chestGlowMask,read(chestGlowMask));
  const daggerMask='public/scene-assets/dagger/dagger-blade-mask.webp';
  entries.set(daggerMask,read(daggerMask));
  const mounted=verifiedMounts(entries);
  const adapter=await import('data:text/javascript;base64,'+entries.get(ADAPTER).toString('base64'));
  const manifest=JSON.parse(entries.get(MANIFEST).toString('utf8'));
  const scene=importProject(entries.get(SITE_SCENE).toString('utf8'));
  const presentation=validateScenePresentation(JSON.parse(entries.get(PRESENTATION).toString('utf8')));
  const sourceHash=digest([...entries].map(([file,bytes])=>[file,bytes.toString('base64')]));
  const state={scene,presentation,manifest,adapter,sourceHash,entries,mounted};
  validate(scene,state);
  return state;
 }
 function slots(state,scene=state.scene){
  const {adapter}=state;
  const result=new Map();
  for(const id of new Set(Object.values(adapter.CANDLE_EFFECT_IDS).flat())){
   const effect=scene.effects.find(item=>item.id===id);
   if(!effect||effect.target.objectId!=='candle')throw Error('Site mum efekt yuvası geçersiz: '+id);
   result.set(id,{id,type:effect.type,objectId:'candle',anchorId:effect.target.anchorId});
  }
  for(const [objectId,group] of Object.entries(adapter.PASSIVE_OBJECT_EFFECT_GROUPS)){
   adapter.sceneForObjectEffects(scene,objectId);
   for(const entry of group)result.set(entry.id,{...entry,objectId});
  }
  for(const [objectId,group] of Object.entries(adapter.HOVER_OBJECT_EFFECT_GROUPS)){
   adapter.sceneForHoverObjectEffects(scene,objectId);
   for(const entry of group)result.set(entry.id,{...entry,objectId});
  }
  for(const [objectId,group] of Object.entries(adapter.PULSE_OBJECT_EFFECT_GROUPS)){
   adapter.sceneForPulseObjectEffects(scene,objectId);
   for(const entry of group)result.set(entry.id,{...entry,objectId});
  }
  const artworkIds=new Set(scene.objects.filter(o=>o.kind==='artwork').map(o=>o.id));
  for(const item of scene.effects.filter(e=>artworkIds.has(e.target.objectId)))
    result.set(item.id,{id:item.id,type:item.type,objectId:item.target.objectId,
      anchorId:item.target.anchorId,layerId:item.target.layerId});
  return result;
 }
 function validate(scene,state,presentation=state.presentation){
  validateProject(scene);compileObjectScene(scene);
  validateScenePresentation(presentation);
  state.adapter.assertAuthoredScene(scene,state.manifest);
  return scene;
 }
 function readiness(scene,state,presentation=state.presentation){
  const problems=[];
  try{validate(scene,state,presentation);}catch(error){problems.push(error.message);}
  const allowed=slots(state,scene);
  for(const effect of scene.effects){
   const slot=allowed.get(effect.id);
   if(!slot||effect.type!==slot.type||effect.target.objectId!==slot.objectId||effect.target.anchorId!==slot.anchorId)
    problems.push(`Desteklenmeyen site efekt yuvası: ${effect.id}. Yeni efekt eklemek siteye bağlamaz.`);
  }
  for(const id of allowed.keys())if(!scene.effects.some(effect=>effect.id===id))problems.push('Eksik site efekt yuvası: '+id);
  const enabledCount=scene.effects.filter(effect=>effect.enabled).length;
  if(!state.mounted.ready)problems.push('Site efekt bağlama sözleşmesi doğrulanamadı: '+state.mounted.failures.join('; '));
  const mountedCount=state.mounted.ready?allowed.size:0;
  if(state.mounted.ready && enabledCount>mountedCount)problems.push('Etkin efekt sayısı doğrulanmış site yuvalarını aşıyor.');
  return {ready:problems.length===0,effectCount:scene.effects.length,enabledCount,mountedCount,problems};
 }
 /** Read-only room composition from the same coordinates that the actual
  * React runtime uses: closedBookLayout for books, canonical study manifest
  * for the two physical devices. Never copy these positions into the editor.
  */
 function roomObjects(state){
  const books=closedBooksFor(state.presentation).map(book=>{
    if(!state.manifest.objects.some(o=>o.id===book.id))
      throw Error('Önizleme kitabı manifestte eksik: '+book.id);
    if(!PHYSICAL_ART_SLOTS[book.id]?.some(slot=>slot.path===book.src))
      throw Error('Önizleme kitap kaynağı görsel kataloğunda yok: '+book.src);
    return {id:book.id,kind:'book',src:book.src,
      x:book.x,y:book.y,width:book.width,angle:book.angle,
      surfaceScaleY:book.surfaceScaleY??1};
  });
  const devices=['camera','vefk-stand'].map(id=>{
    const item=state.manifest.objects.find(o=>o.id===id);
    if(!item?.foundation)throw Error('Önizleme donanımı manifestte eksik: '+id);
    return {id,kind:'device',foundation:item.foundation};
  });
  return [...books,...devices];
 }
 // Preview-only catalog metadata; outside the scene source revision and never
 // written to the site. An isolated clone with no local export returns null.
 function cameraCover(){
   const filename=resolve(root,'../.local-data/studio/public-export/content/publication.json');
   try{
     if(realpathSync(filename)!==filename||statSync(filename).size>12*1024*1024)return null;
     const published=JSON.parse(readFileSync(filename,'utf8'));
     const item=buildVideoCatalog(published).videos.find(video=>video.thumbnailUrl);
     return item?{url:item.thumbnailUrl,videoId:item.videoId,publishedAt:item.publishedAt}:null;
   }catch{return null;}
 }
 function focusTargets(state){return state.manifest.objects.filter(o=>['research-journal','community-journal','camera','vefk-stand'].includes(o.id))
   .map(o=>({id:o.id,foundation:o.foundation}));}
 function validateAssets(assets,state,scene=state.scene){
  const prepared=validateAssetOverrides(assets,state.manifest,state.entries,scene);
  const uploaded=new Set(prepared.map(item=>item.path));
  for(const item of scene.objects.filter(o=>o.kind==='artwork')){
    for(const asset of [item.visual.asset,...(item.visual.layers??[]).map(layer=>layer.asset)]){
      if(!state.entries.has('public'+asset)&&!uploaded.has(asset))
        throw Error('Yeni görsel katmanı için WebP dosyası eksik: '+asset);
    }
  }
  return prepared;
 }
 function previewArt(state){
  return Object.entries(PHYSICAL_ART_SLOTS).flatMap(([objectId,slots])=>{
    if(!state.manifest.objects.some(o=>o.id===objectId))
      throw Error('Sahne görseli için nesne bulunamadı: '+objectId);
    return slots.map(slot=>{
      const bytes=state.entries.get('public'+slot.path);
      if(!bytes||bytes.length>8*1024*1024||
        bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')
        throw Error('Ana nesne görseli geçersiz: '+slot.path);
      return {objectId,path:slot.path,label:slot.label,
        warning:slot.warning??'',
        image:'data:image/webp;base64,'+bytes.toString('base64')};
    });
  });
 }
 function objectVisuals(state){
  return state.manifest.objects.map(object=>({
    id:object.id,kind:object.visual?.kind??'unknown',
    auxiliaryAssets:[
      ...(PHYSICAL_ART_SLOTS[object.id]??[]).map(slot=>slot.path),
      ...(object.id==='archive-chest'?['/scene-assets/chest/interior-light-mask.webp']:[]),
      ...(object.id==='ceremonial-dagger'?['/scene-assets/dagger/dagger-blade-mask.webp']:[]),
    ],
    asset:object.visual?.asset??null,
    layers:(object.visual?.layers??[]).map(layer=>({id:layer.id,asset:layer.asset}))
  }));
 }
 function previewObjects(state){
  const image=asset=>{
    const bytes=state.entries.get('public'+asset);
    if(!bytes||bytes.length>8*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Geçersiz nesne önizlemesi.');
    return 'data:image/webp;base64,'+bytes.toString('base64');
  };
  return [
    ...state.manifest.objects.filter(o=>o.motionLayers?.length).map(o=>({objectId:o.id,image:image(o.visual.asset),asset:o.visual.asset,layers:o.visual.layers.map(layer=>({id:layer.id,image:image(layer.asset),asset:layer.asset,box:layer.box})),...(o.id==='ceremonial-dagger'?{bladeMask:image('/scene-assets/dagger/dagger-blade-mask.webp')}:{}) , ...(o.id==='archive-chest'?{lightMask:image('/scene-assets/chest/interior-light-mask.webp')}:{}),...(o.id==='stone-specimen'?{dropper:image('/scene-assets/stone/copper-drip-arm.webp')}:{})})),
    ...state.manifest.objects.filter(o=>INDEPENDENT_ROOM_MATERIAL_IDS.includes(o.id)).map(o=>({
      objectId:o.id,image:image(o.visual.asset),asset:o.visual.asset,layers:[]
    })),
    ...state.scene.objects.filter(o=>o.kind==='artwork').map(o=>({
      objectId:o.id,image:image(o.visual.asset),asset:o.visual.asset,
      layers:(o.visual.layers??[]).map(layer=>({...layer,image:image(layer.asset)}))
    })),
  ];
 }
 async function preview(state){
  const bytes=state.entries.get(PREVIEW);
  if(bytes.length>16*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Site oda önizlemesi geçerli bir WebP olmalı.');
  return 'data:image/webp;base64,'+bytes.toString('base64');
 }
 function backgroundInfo(state){
  const bytes=state.entries.get(PREVIEW);
  const {width,height}=webpDimensions(bytes);
  if(width!==2*height||!/\.study-frame\s*\{[^}]*aspect-ratio:\s*2\s*;/s.test(state.entries.get(STAGE_CSS).toString('utf8'))
    ||!state.entries.get(ROOT).toString('utf8').includes("const ROOM_PLATE = '"+ROOM_BACKGROUND_ASSET+"';"))
    throw Error('Oda görselinin 2:1 kadrajı veya gerçek web kaynak yolu eşleşmiyor.');
  return {asset:ROOM_BACKGROUND_ASSET,width,height,bytes:bytes.length,aspect:2,
    layout:'contain',note:'Oda normal görünümünde kenarlar kesilmez; sahne 2:1 olarak ekrana sığdırılır.'};
 }
 async function stage(scene,expectedSourceHash,assets=[],presentation=null){
  const state=await snapshot();
  if(!expectedSourceHash||expectedSourceHash!==state.sourceHash)
    throw Error('Site kaynağı değişmiş; güncel sahneyi yeniden açın. Eski taslak aktarılmadı.');
  const targetPresentation=presentation??state.presentation;
  const report=readiness(scene,state,targetPresentation);
  if(!report.ready)throw Error('Site hazırlığı geçersiz: '+report.problems.join('\n'));
  const uploaded=validateAssets(assets,state,scene);
  const contents=exportProject(scene);
  const updates=new Map([[SITE_SCENE,Buffer.from(contents)],
    [PRESENTATION,Buffer.from(JSON.stringify(targetPresentation,null,2)+'\n')],
    ...uploaded.map(item=>['public'+item.path,item.bytes])]);
  const changedFiles=[...updates].filter(([file,bytes])=>!state.entries.has(file)||!bytes.equals(state.entries.get(file)));
  const assetsFor=objects=>objects.filter(o=>o.kind==='artwork')
    .flatMap(o=>[o.visual.asset,...(o.visual.layers??[]).map(layer=>layer.asset)]);
  const remaining=new Set(assetsFor(scene.objects));
  const removedFiles=[...new Set(assetsFor(state.scene.objects).filter(asset=>!remaining.has(asset)))]
    .map(asset=>'public'+asset);
  const checkRevision=()=>digest([...state.entries.keys()].map(file=>[file,read(file).toString('base64')]));
  const nonce=randomUUID();
  const temporary=[];
  const committed=[];
  let rollbackFailed=false;
  try{
    // Prepare every replacement first. Nothing is installed until the entire
    // reviewed source inventory still matches the exact loaded revision.
    for(const [file,bytes] of changedFiles){
      const destination=path(file),existed=existsSync(destination);
      if(!existed&&!/^public\/scene-assets\/custom\/[a-z0-9-]+\.webp$/.test(file))throw Error('Yeni dosya yalnız sahne görseli olabilir.');
      if(!existed)mkdirSync(dirname(destination),{recursive:true});
      const mode=existed?statSync(destination).mode & 0o777:0o644;
      const temp=destination+'.'+nonce+'.tmp',backup=destination+'.'+nonce+'.bak';
      temporary.push({destination,temp,backup,existed});
      await writeFile(temp,bytes,{flag:'wx',mode});
      await chmod(temp,mode);
      if(existed)copyFileSync(destination,backup);
    }
    for(const file of removedFiles){
      if(!/^public\/scene-assets\/custom\/[a-z0-9-]+\.webp$/.test(file))
        throw Error('Silinecek sahne görseli geçersiz.');
      const destination=path(file),backup=destination+'.'+nonce+'.bak';
      if(!existsSync(destination))throw Error('Silinecek sahne görseli bulunamadı.');
      copyFileSync(destination,backup);
      temporary.push({destination,temp:null,backup,existed:true,remove:true});
    }
    if(checkRevision()!==expectedSourceHash)
      throw Error('Site kaynağı hazırlık sırasında değişmiş; hiçbir kaynak dosya değiştirilmedi.');
    try{
      // Synchronous rename sequence, with original bytes kept for rollback.
      for(const entry of temporary){
        if(entry.remove)unlinkSync(entry.destination);
        else renameSync(entry.temp,entry.destination);
        committed.push(entry);
      }
    }catch(error){
      const failures=[];
      for(const entry of [...committed].reverse()){
        try{if(entry.existed)renameSync(entry.backup,entry.destination);else unlinkSync(entry.destination);}
        catch(rollbackError){failures.push(rollbackError.message);}
      }
      if(failures.length){rollbackFailed=true;throw Error('Kaynak geri alma başarısız: '+failures.join('; ')+' / '+error.message);}
      throw error;
    }
  }finally{
    for(const entry of temporary){
      if(entry.temp)await unlink(entry.temp).catch(()=>{});
      if(!rollbackFailed)await unlink(entry.backup).catch(()=>{});
    }
  }
  const after=await snapshot();
  return {changed:changedFiles.length+removedFiles.length>0,
    changedFiles:[...changedFiles.map(([file])=>file),...removedFiles],
    sourceHash:after.sourceHash,readiness:report};
 }
 return {snapshot,validate,validateAssets,readiness,preview,backgroundInfo,previewObjects,objectVisuals,previewArt,roomObjects,focusTargets,cameraCover,stage};
}
