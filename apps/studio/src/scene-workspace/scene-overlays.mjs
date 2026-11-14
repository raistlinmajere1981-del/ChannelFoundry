// Studio-only geometric guides and effect marker DOM. Not serialized.
import {el} from './dom.mjs';
import {COMPOSITION_GUIDE} from './composition-plan-v4.mjs';
import {effectScenePoint} from '../../../../packages/effect-engine/src/runtime/object-scene.mjs';
import {objectEffectRegistry} from '../../../../packages/effect-engine/src/registry/effects.mjs';

const LABELS=Object.freeze({off:'Kapalı',fixed:'Sabitler',focus:'Ana nesneler',details:'Detaylar'});
export function renderCompositionOverlay({host,toggle,mode,available}){
  if(!host||!toggle)return mode;
  toggle.disabled=!available;
  if(!available)mode='off';
  toggle.textContent='Plan: '+LABELS[mode];
  toggle.setAttribute('aria-pressed',String(mode!=='off'));
  host.replaceChildren();
  host.hidden=mode==='off';
  if(host.hidden)return mode;
  host.dataset.mode=mode;
  for(const z of COMPOSITION_GUIDE[mode]){
    const element=el('div',{class:'scene-plan-zone',title:z.help,
      'data-plan-zone':z.id,'aria-hidden':'true'});
    Object.assign(element.style,{left:z.x*100+'%',top:z.y*100+'%',
      width:z.width*100+'%',height:z.height*100+'%'});
    element.append(el('span',{class:'scene-plan-label',text:z.label}));
    host.append(element);
  }
  return mode;
}

export function renderEffectMarkerOverlay({host,scene,selectedEffectId,hiddenInRoom,
    editMode,legacyMode=false,stagePoint=(_owner,point)=>point,onDrag,onSelect,onArrow}){
  const markerElements=new Map();
  host.replaceChildren();
  if(!scene)return markerElements;
  scene.effects.forEach((item,index)=>{
    const owner=scene.objects.find(entry=>entry.id===item.target.objectId);
    if(!owner||hiddenInRoom(owner.id))return;
    const point=stagePoint(owner,effectScenePoint(owner,item)),
      label=objectEffectRegistry[item.type].label;
    const marker=el('button',{type:'button',id:`marker-${item.id}`,
      class:`scene-marker ${item.id===selectedEffectId?'is-selected':''} ${item.enabled&&owner.visible?'':'is-off'}`,
      text:String(index+1),title:`${label} · ${owner.name} → ${item.target.anchorId}`,
      'aria-label':`${label} hedefini sürükle`});
    marker.dataset.effectId=item.id;
    Object.assign(marker.style,{left:point.x*100+'%',top:point.y*100+'%'});
    marker.addEventListener('pointerdown',event=>{
      if(!legacyMode&&editMode!=='effect')return;
      onDrag(event,item);
    });
    marker.addEventListener('click',()=>onSelect(item));
    marker.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      onArrow(item,event);
    });
    markerElements.set(item.id,marker);
    host.append(marker);
  });
  return markerElements;
}
