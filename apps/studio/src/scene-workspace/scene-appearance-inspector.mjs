// Pure inspector DOM for scene appearance; changes are performed only through
// the editor's validated presentation mutation callback.
import {el,button} from './dom.mjs';
import {numberInput} from './scene-inspector-controls.mjs';
import {APPEARANCE_LIMITS,SCENE_APPEARANCE_PRESETS,defaultSceneAppearance}
  from '../../../../packages/effect-engine/src/model/scene-appearance.mjs';

export function renderSceneAppearanceInspector(host,{appearance,mutatePresentation,round}){
  const current={...defaultSceneAppearance(),...appearance};
  host.append(el('h3',{text:'Sahne ışığı ve ton'}));
  const presets=el('div',{class:'scene-background-controls'});
  for(const [id,label] of [['coolClear','Soğuk · berrak'],['neutral','Nötr']]){
    presets.append(button(label,()=>mutatePresentation(next=>{
      next.appearance={...SCENE_APPEARANCE_PRESETS[id]};
    },'appearance:preset'),{id:'scene-tone-preset-'+id}));
  }
  host.append(presets);
  for(const [key,label] of [
    ['brightness','Oda parlaklığı (×)'],
    ['contrast','Oda kontrastı (×)'],
    ['saturation','Oda doygunluğu (×)'],
    ['coolTint','Soğuk ışık katkısı'],
    ['vignette','Kenar gölgesi'],
    ['materialBrightness','Bağımsız malzeme parlaklığı (×)'],
  ]){
    const [min,max]=APPEARANCE_LIMITS[key];
    host.append(numberInput(label,current[key],value=>{
      mutatePresentation(next=>{
        next.appearance={...defaultSceneAppearance(),...next.appearance,[key]:round(value)};
      },'appearance:'+key);
    },{id:'scene-tone-'+key,min,max,step:.01}));
  }
}
