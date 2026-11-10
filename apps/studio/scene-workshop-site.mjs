import {writeFile,unlink,chmod} from 'node:fs/promises';
import {readFileSync,renameSync,statSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {importProject,validateProject,exportProject} from '../../packages/effect-engine/src/model/project.mjs';
import {compileObjectScene} from '../../packages/effect-engine/src/runtime/object-compile.mjs';

export const BIRDESENGOR_SITE=resolve(dirname(fileURLToPath(import.meta.url)),'../../channels/birdesengor/web');
export const SITE_SCENE='src/effects/birdesengor-effects.v2.json';
const MANIFEST='src/scene/data/study.scene.json';
const ADAPTER='src/effects/effectsAdapter.js';
const PREVIEW='public/scene-assets/approved/room-natural-sash-2to1.webp';
const ROOT='src/scene/SceneRoot.jsx';
const STAGE_CSS='src/scene/study-foundation.css';
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
 const scene=code(ROOT),candle=code(CANDLE_HOST),passive=code(PASSIVE_HOST),hover=code(HOVER_HOST),hook=code(EFFECT_HOOK),css=code(STAGE_CSS);
 const checks={
  'V2 has positioned passive hosts':scene.includes("className={AMBIENT_EFFECT_IDS.has(object.id) ? 'study-effect-host'")
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
  'Motion slot mounts the declared visual layer':scene.includes('object.visual.layers.map')
    && scene.includes('data-effect-layer={layer.id}') && scene.includes('study-metal-fixed')
    && hook.includes('bindObjectScene(compiled,()=>motion?element:host'),
  'Candle uses canonical hook':candle.includes('useObjectEffects({') && candle.includes("objectId: 'candle'")
    && candle.includes('enabled,'),
  'Passive uses canonical hook':passive.includes('useObjectEffects({') && passive.includes('effectGroup: objectId'),
  'Runtime compiles and binds canonical scene':hook.includes('compileObjectScene(selected)')
    && hook.includes('bindObjectScene(compiled, () => element')
    && hook.includes('assertAuthoredScene(scene, SCENE_MANIFEST)'),
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
  for(const file of [SITE_SCENE,MANIFEST,ADAPTER,PREVIEW,STAGE_CSS])entries.set(file,read(file));
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
  for(const object of (sourceManifest.objects??[]).filter(o=>o.motionLayers?.length)){
    for(const asset of [object.visual.asset,...object.visual.layers.map(layer=>layer.asset)]){
      if(!/^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(asset))throw Error('Geçersiz hareket görsel yolu.');
      const file='public'+asset;entries.set(file,read(file));
    }
  }
  const mounted=verifiedMounts(entries);
  const adapter=await import('data:text/javascript;base64,'+entries.get(ADAPTER).toString('base64'));
  const manifest=JSON.parse(entries.get(MANIFEST).toString('utf8'));
  const scene=importProject(entries.get(SITE_SCENE).toString('utf8'));
  const sourceHash=digest([...entries].map(([file,bytes])=>[file,bytes.toString('base64')]));
  const state={scene,manifest,adapter,sourceHash,entries,mounted};
  validate(scene,state);
  return state;
 }
 function slots(state){
  const {adapter,scene}=state;
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
  return result;
 }
 function validate(scene,state){
  validateProject(scene);compileObjectScene(scene);
  state.adapter.assertAuthoredScene(scene,state.manifest);
  return scene;
 }
 function readiness(scene,state){
  const problems=[];
  try{validate(scene,state);}catch(error){problems.push(error.message);}
  const allowed=slots(state);
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
 function previewObjects(state){
  const image=asset=>{
    const bytes=state.entries.get('public'+asset);
    if(!bytes||bytes.length>8*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Geçersiz nesne önizlemesi.');
    return 'data:image/webp;base64,'+bytes.toString('base64');
  };
  return state.manifest.objects.filter(o=>o.motionLayers?.length).map(o=>({objectId:o.id,image:image(o.visual.asset),layers:o.visual.layers.map(layer=>({id:layer.id,image:image(layer.asset),box:layer.box}))}));
 }
 async function preview(state){
  const bytes=state.entries.get(PREVIEW);
  if(bytes.length>16*1024*1024||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('Site oda önizlemesi geçerli bir WebP olmalı.');
  return 'data:image/webp;base64,'+bytes.toString('base64');
 }
 async function stage(scene,expectedSourceHash){
  const state=await snapshot();
  if(!expectedSourceHash||expectedSourceHash!==state.sourceHash)throw Error('Site kaynağı değişmiş; güncel sahneyi yeniden açın. Eski taslak aktarılmadı.');
  const report=readiness(scene,state);
  if(!report.ready)throw Error('Site hazırlığı geçersiz: '+report.problems.join('\n'));
  const contents=exportProject(scene),destination=path(SITE_SCENE);
  const changed=contents!==state.entries.get(SITE_SCENE).toString('utf8');
  if(changed){
   const temp=destination+'.'+randomUUID()+'.tmp';
   try{
    const mode=statSync(destination).mode&0o777;
    await writeFile(temp,contents,{mode,flag:'wx'});
    await chmod(temp,mode);
    // Final revision check and rename are synchronous: no yielded operation
    // between checking all source inputs and replacing the one approved file.
    const current=digest([...state.entries.keys()].map(file=>[file,read(file).toString('base64')]));
    if(current!==expectedSourceHash)throw Error('Site kaynağı hazırlık sırasında değişmiş; dosya yazılmadı.');
    renameSync(temp,destination);
   }finally{await unlink(temp).catch(()=>{});}
  }else{
   // No-op staging must still reject a parallel source edit. Otherwise Admin
   // could report an unchanged revision as prepared after its source drifted.
   const current=digest([...state.entries.keys()].map(file=>[file,read(file).toString('base64')]));
   if(current!==expectedSourceHash)throw Error('Site kaynağı hazırlık sırasında değişmiş; dosya yazılmadı.');
  }
  // Return OUR revision, never adopt a parallel writer's later revision as
  // this draft's base. A subsequent save/stage/load will detect that drift.
  const nextEntries=[...state.entries].map(([file,bytes])=>[file,file===SITE_SCENE&&changed?Buffer.from(contents):bytes]);
  return {changed,sourceHash:digest(nextEntries.map(([file,bytes])=>[file,bytes.toString('base64')])),readiness:report};
 }
 return {snapshot,validate,readiness,preview,previewObjects,stage};
}
