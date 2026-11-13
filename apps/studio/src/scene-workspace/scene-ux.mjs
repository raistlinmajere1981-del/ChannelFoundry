import {objectEffectRegistry} from '../../../../packages/effect-engine/src/registry/effects.mjs';
import {canCropVisual} from '../../../../packages/effect-engine/src/model/visual-crop.mjs';

// UI labels alias the canonical presets; never derive values from current state.
export const sceneProfiles = Object.freeze([
  {label:'Hafif',key:'Sakin'}, {label:'Doğal',key:'Doğal'}, {label:'Belirgin',key:'Canlı'},
]);
export function profileForEffect(effect) {
  return sceneProfiles.find(profile => {
    const preset=objectEffectRegistry[effect.type].presets[profile.key];
    return Object.keys(preset).every(key=>effect.params[key]===preset[key]);
  })?.label??'Özel';
}
export function applySceneProfile(effect,key) {
  const preset=objectEffectRegistry[effect.type]?.presets[key];
  if(!preset)throw new Error('Bilinmeyen efekt profili.');
  effect.params={...effect.params,...preset};
}
export function basicControls(type) {
  const keys={'pendulum-sway':['amplitude','frequency','damping','duration','speed'],flame:['opacity','speed','sway'],glow:['opacity','speed','pulse','width'],smoke:['opacity','speed','spread'],'metal-glint':['opacity','speed','band','duration'],'water-ripple':['opacity','speed','spread','duration'],'stone-drop':['opacity','duration','dropSize','tremor','speed'],'stone-tremor':['amplitude','frequency','damping','duration','speed'],'dagger-shadow':['opacity','duration','figureScale','speed'],'chest-lid-open':['openAngle','lift','duration','speed','hold'],'chest-light-leak':['opacity','spread','duration','speed','hold']}[type];
  return keys.map(key=>{
    const control=objectEffectRegistry[type].controls.find(item=>item.key===key);
    return {...control,label:key==='opacity'?'Şiddet':key==='width'?'Yayılım (genişlik)':control.label};
  });
}
// Native site elements keep their integration contracts. Independent artwork
// is data-driven and may be created, edited, grouped or removed.
export function assertSiteStructure(next,source) {
  const native=scene=>scene.objects.filter(item=>item.kind!=='artwork').map(({id,pose,visible,anchors,motionLayers,crop})=>({
    id,...(canCropVisual({motionLayers})?{}:{pose,crop}),visible,anchors,motionLayers
  }));
  const appearance=scene=>scene.objects.filter(o=>o.id!=='ceremonial-robe'&&o.kind!=='artwork').map(o=>[o.id,o.veil]);
  if(JSON.stringify(appearance(next))!==JSON.stringify(appearance(source)))throw new Error('Görünmezlik yalnız kaftanda düzenlenebilir.');
  if(next.sceneId!==source.sceneId||JSON.stringify(next.viewport)!==JSON.stringify(source.viewport)
    ||JSON.stringify(native(next))!==JSON.stringify(native(source)))
    throw new Error('Nesne yerleşimi, görünürlüğü ve bağlantıları site kaynağına aittir.');
  const nativeSlots=scene=>scene.effects.filter(effect=>!scene.objects.some(o=>o.id===effect.target.objectId&&o.kind==='artwork'))
    .map(({id,type,target})=>({id,type,objectId:target.objectId,anchorId:target.anchorId,layerId:target.layerId}))
    .sort((a,b)=>a.id.localeCompare(b.id));
  if(JSON.stringify(nativeSlots(next))!==JSON.stringify(nativeSlots(source)))
    throw new Error('Siteye bağlı efekt yuvaları değiştirilemez. Bağımsız görsel efektleri düzenlenebilir.');
}
