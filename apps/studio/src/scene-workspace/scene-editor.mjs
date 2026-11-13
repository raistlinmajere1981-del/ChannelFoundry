// Studio-owned scene editor. The shared effect-engine remains a runtime/model dependency,
// but no longer owns the desktop editing UI or its lifecycle.
import {el,button,field,download,readFile} from './dom.mjs';
import {sceneProfiles,profileForEffect,applySceneProfile,basicControls,assertSiteStructure} from './scene-ux.mjs';
import {History} from './history.mjs';
import {validateProject,importProject,exportProject,MAX_FILE_BYTES} from '../../../../packages/effect-engine/src/model/project.mjs';
import {objectEffectRegistry,defaultObjectParams,effectTrigger,allowedEffectTriggers} from '../../../../packages/effect-engine/src/registry/effects.mjs';
import {anchorScenePoint,effectScenePoint} from '../../../../packages/effect-engine/src/runtime/object-scene.mjs';
import {bindObjectScene} from '../../../../packages/effect-engine/src/runtime/object-overlay.mjs';
import {drawRefractedSilhouette} from '../../../../packages/effect-engine/src/runtime/robe-refraction.mjs';
import {canCropVisual,visualClipStyle,EMPTY_CROP} from '../../../../packages/effect-engine/src/model/visual-crop.mjs';
import {roomFrameGeometry} from '../../../../packages/effect-engine/src/model/room-frame.mjs';
import {defaultScenePresentation,validateScenePresentation,FOCUS_OBJECT_IDS,BOOK_OBJECT_IDS,PHYSICAL_DEVICE_IDS} from '../../../../packages/effect-engine/src/model/scene-presentation.mjs';

export function mountSceneEditor(root,options={}){
const $=selector=>root.querySelector(selector);
const surface=root===document?document.body:root;
const disposers=[];
let scene=null,objectId=null,effectId=null,anchorId=null,playing=true;
let presentation=defaultScenePresentation(),presentationDevice='desktop';
let focusTargets=new Map(),focusPreview=false,roomObjects=new Map(),showRoomObjects=true;
let previewHandle=null,previewFrame=null;
let previewObjects=new Map(),assetReplacements=new Map(),assetChoices=new Map(),artworkSlots=new Map();
let siteSource=false,sourceScene=null,showPhoto=true,showEffects=true,objectFilter='all';
let zoom=1,visualMode=false,linkVisual=true,previewRobeVeiled=false;
let backgroundMeta=null,backgroundOriginal='',screenPreset='room',
  screenWidth=390,screenHeight=844;
const screenPresets={'1920x1080':[1920,1080],'1366x768':[1366,768],
  '768x1024':[768,1024],'390x844':[390,844]};
function syncBackgroundPhoto(){
  if(!backgroundMeta)return;
  const photo=$('#scene-photo'),src=replacementSource(backgroundMeta.asset,backgroundOriginal);
  if(src&&photo.getAttribute('src')!==src)photo.src=src;
}
function screenPreviewGeometry(){
  if(!backgroundMeta)return null;
  if(screenPreset==='room')return roomFrameGeometry(backgroundMeta.aspect*1000,1000,backgroundMeta.aspect);
  return roomFrameGeometry(screenWidth,screenHeight,backgroundMeta.aspect);
}
const editableVisual=item=>canCropVisual(item)&&(!siteSource||previewObjects.has(item?.id));
const visualBase=item=>sourceScene?.objects.find(entry=>entry.id===item?.id)?.pose??item.pose;
const replacementSource=(asset,original)=>assetReplacements.get(asset)?.dataUrl??original;
function visualAssetSlots(item){
  const artwork=previewObjects.get(item?.id);
  const detached=artwork
    ?[{path:artwork.asset,label:'Temel görsel',image:artwork.image,warning:''},
      ...(artwork.layers??[]).filter(layer=>item?.kind!=='artwork'||item.motionLayers?.includes(layer.id))
        .sort((a,b)=>item?.kind!=='artwork'?0:item.motionLayers.indexOf(a.id)-item.motionLayers.indexOf(b.id)).map(layer=>({
        path:layer.asset,label:'Hareketli katman · '+layer.id,image:layer.image,warning:''
      }))]
    :[];
  return [...detached,...(artworkSlots.get(item?.id)??[])];
}
function selectedVisualAsset(item){
  const slots=visualAssetSlots(item);
  const path=assetChoices.get(item?.id);
  return slots.find(entry=>entry.path===path)??slots.find(entry=>entry.label.startsWith('Hareketli'))??slots[0];
}

// Binary data is stored once per revision. History snapshots retain only
// lightweight references so thirty undo steps do not copy every WebP.
const assetPayloads=new Map();
function setAssetReplacement(path,dataUrl){
  const version=uid();
  assetPayloads.set(version,dataUrl);
  assetReplacements.set(path,{path,dataUrl,version});
}
function currentAssetRefs(){
  const activeCustom=new Set((scene?.objects??[]).filter(o=>o.kind==='artwork')
    .flatMap(o=>[o.visual.asset,...(o.visual.layers??[]).map(layer=>layer.asset)]));
  return [...assetReplacements].filter(([path])=>
    !path.startsWith('/scene-assets/custom/')||activeCustom.has(path))
    .map(([path,entry])=>[path,entry.version]);
}
function restoreAssetRefs(refs){
  assetReplacements=new Map((refs??[]).map(([path,version])=>{
    const dataUrl=assetPayloads.get(version);
    if(!dataUrl)throw Error('Görsel geçmişi bulunamadı: '+path);
    return [path,{path,dataUrl,version}];
  }));
}
const objectElements=new Map(),markerElements=new Map();
const history=new History();
function pruneArtworkHistory(){
  const states=[...history.past,...history.future];
  const activeIds=new Set((scene?.objects??[]).map(o=>o.id));
  for(const entry of states)for(const o of entry.scene?.objects??[])activeIds.add(o.id);
  for(const id of previewObjects.keys())
    if(id.startsWith('artwork-')&&!activeIds.has(id))previewObjects.delete(id);
  const activeVersions=new Set([
    ...currentAssetRefs().map(([,version])=>version),
    ...states.flatMap(entry=>(entry.assets??[]).map(([,version])=>version)),
  ]);
  for(const version of assetPayloads.keys())
    if(!activeVersions.has(version))assetPayloads.delete(version);
  const activePaths=new Set([
    ...currentAssetRefs().map(([path])=>path),
    ...states.flatMap(entry=>(entry.assets??[]).map(([path])=>path)),
  ]);
  for(const [path] of assetReplacements)
    if(path.startsWith('/scene-assets/custom/')&&!activePaths.has(path))
      assetReplacements.delete(path);
}
// This controller has no window-message transport; only the React host owns dirty state.
const standalone=root===document;
const embedded=!standalone;
const notify=(type)=>{if(type==='studio:dirty')options.onDirty?.();};
const changed=()=>notify('studio:dirty');
const status=(message,isError=false)=>{const node=$('#status');node.textContent=message;node.classList.toggle('error',isError);};
const error=e=>{const message=e?.message||String(e);status(message,true);};
const object=()=>scene?.objects.find(item=>item.id===objectId);
const effect=()=>scene?.effects.find(item=>item.id===effectId);
const anchor=()=>object()?.anchors.find(item=>item.id===anchorId);
const effectsForObject=()=>scene?.effects.filter(item=>item.target.objectId===objectId)??[];
const uid=()=>crypto.randomUUID();
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const round=value=>Math.round(value*1e4)/1e4;
const isObjectScene=value=>value?.version===2&&value?.kind==='objectScene';

function validateScene(next){
  validateProject(next);
  if(!isObjectScene(next))throw new Error('Bu düzenleyici yalnız version 2 objectScene sahnelerini açar.');
  if(siteSource&&sourceScene)assertSiteStructure(next,sourceScene);
  return next;
}

function uniqueEffectId(type){
  for(let i=0;i<100;i++){
    const id=`${type}-${uid().slice(0,8)}`;
    if(!scene.objects.some(item=>item.id===id)&&!scene.effects.some(item=>item.id===id))return id;
  }
  throw new Error('Benzersiz efekt kimliği üretilemedi.');
}
function selectObject(id){
  if(id===objectId){draw();return;}
  objectId=id;
  const target=object();
  anchorId=target?.anchors[0]?.id??null;
  effectId=scene.effects.find(item=>item.target.objectId===id)?.id??null;
  draw();if($('#object-search'))setInspectorTab(focusTargets.has(id)?'focus':'visual');
}
function selectEffect(id){
  const next=scene.effects.find(item=>item.id===id);
  if(!next)return;
  effectId=next.id;objectId=next.target.objectId;anchorId=next.target.anchorId;
  draw();if($('#object-search'))setInspectorTab('effect');
}
function selectForDrag(next){
  effectId=next.id;objectId=next.target.objectId;anchorId=next.target.anchorId;
  renderLists();renderObjectInspector();renderEffectInspector();renderStageSelection();
}
function recordHistory(before,key=null,assets=currentAssetRefs()){history.record({scene:before,presentation,assets},key);}
function mutatePresentation(action,key=null){
  if(!siteSource||!presentation)return false;
  try{
    const next=structuredClone(presentation);
    action(next);validateScenePresentation(next);
    recordHistory(scene,key);presentation=next;draw();
    status('Odak görünümü güncellendi; ayarlar taslakta.');changed();return true;
  }catch(e){error(e);draw();return false;}
}
function mutate(action,key=null,assetsBefore=null){
  if(!scene)return false;
  try{
    const next=structuredClone(scene);
    action(next);
    validateScene(next);
    recordHistory(scene,key,assetsBefore??currentAssetRefs());
    scene=next;
    draw();
    pruneArtworkHistory();
    status(embedded?'Değişiklik yapıldı.':'Değişiklik uygulandı. JSON dışa aktararak kaydedin.');
    changed();
    return true;
  }catch(e){error(e);draw();return false;}
}
function numberInput(label,value,change,attrs={}){
  const input=el('input',{type:'number',value,onchange:event=>change(event.target.valueAsNumber),...attrs});
  return field(label,input);
}
function checkField(label,checked,change,attrs={}){
  return field(label,el('input',{type:'checkbox',checked,onchange:event=>change(event.target.checked),...attrs}));
}

// Studio V3: hierarchical view derived from canonical records, never saved into the scene JSON.
const treeExpanded=new Map();
let inspectorTab='effect';
function setInspectorTab(tab){
  if(!$('#scene-inspector-tabs')&&!root.querySelector('[data-inspector-tab]'))return;
  inspectorTab=tab;
  for(const button of root.querySelectorAll('[data-inspector-tab]')){
    const active=button.dataset.inspectorTab===tab;
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    if(button.dataset.inspectorTab==='focus')button.hidden=!focusTargets.has(objectId);
  }
  for(const page of root.querySelectorAll('[data-inspector-page]'))page.hidden=page.dataset.inspectorPage!==tab;
  const name=$('#selected-object-name');
  if(name)name.textContent=tab==='background'?(siteSource?'Oda arka planı':'Sahne arka planı'):object()?.name??'Bir nesne seçin';
  if($('#open-background'))$('#open-background').setAttribute('aria-pressed',String(tab==='background'));
  if(tab==='background')renderBackgroundInspector();
}
function groupFor(item){
  return item.group?.trim()||'Nesneler';
}
function renderTreeLists(){
  const host=$('#object-list'),term=$('#object-search').value.toLocaleLowerCase('tr').trim();
  const groups=new Map();
  for(const item of scene.objects){
    const effects=scene.effects.filter(e=>e.target.objectId===item.id);
    if(objectFilter==='effects'&&!effects.length)continue;
    if(term&&!item.name.toLocaleLowerCase('tr').includes(term)&&!effects.some(e=>objectEffectRegistry[e.type]?.label.toLocaleLowerCase('tr').includes(term)))continue;
    const group=groupFor(item);
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push({item,effects});
  }
  const order=[...groups.keys()].sort((a,b)=>a==='Nesneler'?-1:b==='Nesneler'?1:a.localeCompare(b,'tr'));
  const children=[];
  for(const name of order){
    if(!groups.has(name))continue;
    const entries=groups.get(name),group=el('details',{class:'scene-tree-group','data-tree-group':name});
    group.open=term?true:(treeExpanded.get(name)??true);
    group.addEventListener('toggle',()=>{if(group.isConnected&&!term)treeExpanded.set(name,group.open);});
    group.append(el('summary',{},el('span',{text:name}),el('span',{class:'scene-count',text:String(entries.length)})));
    for(const {item,effects} of entries){
      const groupNode=el('div',{class:'scene-tree-object'+(item.id===objectId?' is-current':'')});
      const active=effects.filter(e=>e.enabled).length;
      const row=el('div',{class:'scene-tree-object-head','data-tree-object':item.id},
        el('button',{type:'button',id:'object-select-'+item.id,class:'scene-tree-select',text:item.name,'aria-current':String(item.id===objectId),onclick:()=>{selectObject(item.id);setInspectorTab(focusTargets.has(item.id)?'focus':'visual');}}),
        el('span',{class:'scene-tree-meta',text:effects.length?active+'/'+effects.length:'—'}));
      groupNode.append(row);
      if(effects.length){
        const children=el('div',{class:'scene-tree-effects'});
        for(const eff of effects){
          const entry=el('div',{class:'scene-tree-effect'+(eff.id===effectId?' is-current':'')+'','data-tree-effect':eff.id},
            el('button',{type:'button',class:'scene-tree-effect-select',text:'✦ '+objectEffectRegistry[eff.type].label,onclick:()=>{selectEffect(eff.id);setInspectorTab('effect');}}),
            el('input',{type:'checkbox',checked:eff.enabled,'aria-label':objectEffectRegistry[eff.type].label+' etkin',onchange:e=>mutate(s=>{s.effects.find(entry=>entry.id===eff.id).enabled=e.target.checked;})}));
          children.append(entry);
        }
        groupNode.append(children);
      }
      group.append(groupNode);
    }
    children.push(group);
  }
  host.replaceChildren(...(children.length?children:[el('p',{class:'scene-empty',text:'Eşleşen nesne bulunamadı.'})]));
  // Focus controls only exist for supported room objects. Keep the user's selected page when possible.
  if(inspectorTab==='focus'&&!focusTargets.has(objectId))inspectorTab='visual';
  setInspectorTab(inspectorTab);
}
function renderLists(){
  if(!scene)return;
  $('#object-count').textContent=String(scene.objects.length);
  const rows=scene.objects.filter(item=>objectFilter==='all'||scene.effects.some(entry=>entry.target.objectId===item.id)).map(item=>{
    const effects=scene.effects.filter(entry=>entry.target.objectId===item.id),enabled=effects.filter(entry=>entry.enabled).length;
    const state=effects.length?`${effects.length} efekt · ${enabled?`${enabled} açık`:'kapalı'}`:'Efekt yok';
    return el('div',{class:`scene-list-row ${item.id===objectId?'selected':''}`},
      el('button',{type:'button',id:`object-select-${item.id}`,class:'scene-row-select','aria-pressed':String(item.id===objectId),onclick:()=>selectObject(item.id)},
        el('span',{text:item.name}),el('span',{class:'scene-row-meta',text:`${state}${item.visible?'':' · gizli'}`})));
  });
  $('#object-list').replaceChildren(...(rows.length?rows:[el('p',{class:'scene-empty',text:'Filtreye uygun nesne yok.'})]));
  const effects=effectsForObject();
  if($('#effect-count'))$('#effect-count').textContent=String(effects.length);
  $('#selected-object-name').textContent=object()?.name??'Bir nesne seçin';
  const effectRows=effects.map(item=>el('div',{class:`scene-list-row ${item.id===effectId?'selected':''}`},
    button(objectEffectRegistry[item.type].label,()=>selectEffect(item.id),{id:`effect-select-${item.id}`,class:'scene-row-select','aria-pressed':String(item.id===effectId)}),
    el('label',{class:'scene-row-check',title:`${objectEffectRegistry[item.type].label} etkin`},
      el('input',{type:'checkbox',id:`effect-list-enabled-${item.id}`,checked:item.enabled,'aria-label':`${objectEffectRegistry[item.type].label} etkin`,onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).enabled=event.target.checked;})}))
  ));
  $('#effect-list').replaceChildren(...(effectRows.length?effectRows:[el('p',{class:'scene-empty',text:siteSource?'Bu nesneye bağlı site efekti yok.':'Bu nesnede efekt yok; desteklenen bir tür ekleyin.'})]));
  $('#add-effect-controls').hidden=siteSource&&object()?.kind!=='artwork';
  const permitted=Object.entries(objectEffectRegistry).filter(([,info])=>
    info.output!=='motion'||(object()?.motionLayers?.length??0)>0);
  const typeControl=$('#add-effect-type'),currentType=typeControl.value;
  typeControl.replaceChildren(...permitted.map(([type,info])=>
    el('option',{value:type,text:info.label,selected:type===currentType})));
  $('#add-effect').disabled=!object()?.anchors.length;
  $('#source-note').hidden=true;
  $('#site-effects-note').hidden=true;
  const badge=root.querySelector('.scene-local-badge');if(badge)badge.textContent=siteSource?'Site kaynağı':'Yerel';
  if($('#object-search'))renderTreeLists();
}
function moveVisual(sceneCopy,id,nextPose,linked=linkVisual){
  const target=sceneCopy.objects.find(o=>o.id===id);
  if(!target||!editableVisual(target))throw Error('Bu nesnede bağımsız görsel yerleşimi yok.');
  const before={...target.pose};
  const pose={...before,...nextPose};
  pose.x=round(clamp(pose.x,0,1-pose.width));
  pose.y=round(clamp(pose.y,0,1-pose.height));
  if(linked&&target.hitArea){
    const hit=target.hitArea,ratioX=pose.width/before.width,ratioY=pose.height/before.height;
    const width=round(hit.width*ratioX),height=round(hit.height*ratioY);
    hit.x=round(clamp(pose.x+(hit.x-before.x)*ratioX,0,1-width));
    hit.y=round(clamp(pose.y+(hit.y-before.y)*ratioY,0,1-height));
    hit.width=width;hit.height=height;
  }
  if(!linked){
    for(const fx of sceneCopy.effects.filter(e=>e.target.objectId===id)){
      const point=effectScenePoint(target,fx);
      const a=target.anchors.find(entry=>entry.id===fx.target.anchorId);
      fx.target.offset.x=round((point.x-pose.x)/pose.width-a.x);
      fx.target.offset.y=round((point.y-pose.y)/pose.height-a.y);
    }
  }
  target.pose=pose;
}
function renderVisualInspector(){
  const root=$('#visual-placement-settings'),host=$('#visual-inspector'),item=object();
  root.hidden=!editableVisual(item);host.replaceChildren();
  if(!editableVisual(item))return;
  const base=visualBase(item);
  const adjust=(fields,key)=>mutate(s=>moveVisual(s,item.id,fields),key);
  host.title='Taşı modunda sürükleyin. Ok tuşları: %0,1; Shift+ok: %1.';
  for(const [key,label] of [['x','Sol X (%)'],['y','Üst Y (%)']]){
    host.append(numberInput(label,round(item.pose[key]*100),value=>adjust({[key]:round(value/100)},'visual:'+item.id+':'+key),
      {id:'visual-'+key,min:0,max:100,step:.1,'data-testid':'visual-'+key}));
  }
  const scale=round(item.pose.width/base.width*100);
  host.append(numberInput('Görsel ölçeği (%)',scale,value=>{
    const factor=clamp(value,30,250)/100,width=round(base.width*factor),height=round(base.height*factor);
    const cx=item.pose.x+item.pose.width/2,cy=item.pose.y+item.pose.height/2;
    adjust({width,height,x:round(cx-width/2),y:round(cy-height/2)},'visual:'+item.id+':scale');
  },{id:'visual-scale',min:30,max:250,step:1,'data-testid':'visual-scale'}));
  if(item.kind==='artwork'){
    host.append(numberInput('Dönüş (°)',item.pose.rotation,
      value=>adjust({rotation:value},'visual:'+item.id+':rotation'),
      {id:'visual-rotation',min:-360,max:360,step:1}));
    host.append(numberInput('Katman derinliği',item.pose.depth,
      value=>adjust({depth:value},'visual:'+item.id+':depth'),
      {id:'visual-depth',min:-100,max:100,step:1}));
    for(const [key,label] of [['width','Genişlik (%)'],['height','Yükseklik (%)']])
      host.append(numberInput(label,round(item.pose[key]*100),value=>{
        adjust({[key]:round(value/100)},'visual:'+item.id+':'+key);
      },{id:'visual-'+key,min:.1,max:100,step:.1}));
  }
  if(item.kind==='artwork'){
    host.append(numberInput('Dönüş (°)',item.pose.rotation,
      value=>adjust({rotation:value},'visual:'+item.id+':rotation'),
      {id:'visual-rotation',min:-360,max:360,step:1}));
    host.append(numberInput('Katman derinliği',item.pose.depth,
      value=>adjust({depth:value},'visual:'+item.id+':depth'),
      {id:'visual-depth',min:-100,max:100,step:1}));
    for(const [key,label] of [['width','Genişlik (%)'],['height','Yükseklik (%)']])
      host.append(numberInput(label,round(item.pose[key]*100),value=>{
        adjust({[key]:round(value/100)},'visual:'+item.id+':'+key);
      },{id:'visual-'+key,min:.1,max:100,step:.1}));
  }
  host.append(el('label',{class:'scene-visual-check'},
    el('input',{type:'checkbox',id:'visual-linked',checked:linkVisual,
      onchange:event=>{linkVisual=event.target.checked;}}),
    el('span',{text:'Efekt ve tıklama alanını birlikte taşı'})));
  host.append(el('div',{class:'scene-visual-actions'},
    button('−0,1% Y',()=>adjust({y:round(item.pose.y-.001)},'visual:'+item.id+':y'),{id:'visual-up'}),
    button('+0,1% Y',()=>adjust({y:round(item.pose.y+.001)},'visual:'+item.id+':y'),{id:'visual-down'})));
  host.append(button('Yerleşimi sıfırla',()=>adjust({...base},'visual:'+item.id+':reset'),{id:'visual-reset'}));
}
function renderPresentationInspector(){
  const item=object(),parent=$('#focus-presentation-settings'),host=$('#focus-presentation-inspector');
  parent.hidden=!(siteSource&&presentation&&FOCUS_OBJECT_IDS.includes(item?.id));
  // Re-rendering a control value must not collapse the currently edited group.
  const expanded=new Map(host.dataset.activeObject===item?.id
    ?[...host.querySelectorAll('details[data-panel-key]')].map(node=>[node.dataset.panelKey,node.open])
    :[]);
  host.dataset.activeObject=item?.id??'';
  host.replaceChildren();
  if(parent.hidden)return;
  const details=(key,label,open=true)=>el('details',{
    class:'scene-book-controls','data-panel-key':key,
    open:expanded.has(key)?expanded.get(key):open,
  },el('summary',{text:label}));
  const id=item.id,profile=presentation.objects[id],view=profile[presentationDevice];
  const set=(key,value,device=null)=>mutatePresentation(data=>{
    if(device)data.objects[id][device][key]=value;
    else data.objects[id][key]=value;
  },'presentation:'+id+':'+(device??'time')+':'+key);
  host.append(field('Cihaz görünümü',el('select',{
    id:'presentation-device','aria-label':'Sunum cihaz görünümü',
    onchange:event=>{presentationDevice=event.target.value;renderPresentationInspector();}
  },...[['desktop','Masaüstü'],['mobile','Mobil']].map(([value,label])=>
    el('option',{value,text:label,selected:value===presentationDevice})))));
  const transitions=details('focus-transitions','Geçiş süreleri');
  for(const [key,label] of [
    ['focusMs','Yaklaşma süresi (ms)'],['returnMs','Odaya dönüş (ms)'],
    ['detailMs',id==='camera'?'LCD açılışı (ms)':id==='vefk-stand'?'Katalog geçişi (ms)':'Kapak açılışı (ms)']
  ])transitions.append(numberInput(label,profile[key],value=>set(key,value),
    {id:'presentation-'+key,min:key==='detailMs'?100:300,max:key==='detailMs'?2000:1800,step:20}));
  host.append(transitions);
  const framing=details('focus-framing','Kadraj ve yakınlık');
  for(const [key,label,min,max] of [
    ['roomZoom','Oda yakınlığı (%)',75,160],['nearZoom','Nesne yakınlığı (%)',70,140]
  ])framing.append(numberInput(label,round(view[key]*100),value=>set(key,round(value/100),presentationDevice),
    {id:'presentation-'+key,min,max,step:1}));
  for(const [key,label] of [
    ['roomShiftX','Oda kaydırma X (%)'],['roomShiftY','Oda kaydırma Y (%)'],
    ['nearShiftX','Nesne kaydırma X (%)'],['nearShiftY','Nesne kaydırma Y (%)']
  ])framing.append(numberInput(label,view[key],value=>set(key,round(value),presentationDevice),
    {id:'presentation-'+key,min:-15,max:15,step:.1}));
  host.append(framing);
  if(BOOK_OBJECT_IDS.includes(id)){
    const book=profile.book,device=presentationDevice;
    const editBook=(key,value,child=null)=>mutatePresentation(data=>{
      const target=data.objects[id].book;
      if(child)target[child][key]=value;
      else target[key]=value;
    },'book:'+id+':'+(child??'paper')+':'+key);
    const physical=details('book-cover','Kapak ve sayfalar');
    for(const [key,label,min,max,step] of [
      ['turnMs','Sayfa çevirme (ms)',300,1600,20],
      ['thickness','Grabfold yaprak kalınlığı',10,50,1],
      ['pageRatio','Masaüstü sayfa oranı (%)',70,93,1],
      ['mobilePageRatio','Mobil sayfa oranı (%)',50,68,1],
      ['depthDesktop','Masaüstü kapak derinliği (px)',32,72,1],
      ['depthMobile','Mobil kapak derinliği (px)',14,30,1],
    ]){
      const ratio=key.includes('Ratio');
      physical.append(numberInput(label,ratio?round(book[key]*100):book[key],
        value=>editBook(key,ratio?round(value/100):value),{
          id:'book-'+key,min,max,step,
        }));
    }
    host.append(physical);
    const reading=details('book-reading','Okuma alanı · '+(device==='desktop'?'Masaüstü':'Mobil'));
    for(const [axis,label,min,max] of [
      ['X','Yatay iç boşluk (%)',5,13],
      ['Y','Dikey iç boşluk (%)',device==='mobile'?5:4,device==='mobile'?12:11]
    ]){
      const key='readingPad'+axis+(device==='desktop'?'Desktop':'Mobile');
      reading.append(numberInput(label,book[key],value=>editBook(key,round(value)),{
        id:'book-'+key,min,max,step:.5,
      }));
    }
    host.append(reading);
    const adornment=details('book-adornment',id==='research-journal'?'Yeşil/kırmızı ayraçlar':'Deri kenar indeksleri');
    if(id==='research-journal'){
      const key=device==='desktop'?'Desktop':'Mobile';
      for(const [name,label,min,max,step] of [
        ['offset'+key,'Yatay konum farkı (px)',-20,20,1],
        ['width'+key,'Kumaş genişliği (px)',device==='desktop'?42:35,device==='desktop'?60:48,1],
      ])adornment.append(numberInput(label,book.ribbon[name],value=>editBook(name,value,'ribbon'),{
        id:'book-ribbon-'+name,min,max,step,
      }));
    }else{
      const key=device==='desktop'?'Desktop':'Mobile';
      for(const [name,label,min,max,step] of [
        ['top'+key,'Üstten yerleşim (%)',device==='desktop'?8:2,device==='desktop'?42:30,.5],
        ['gap'+key,'İndeks aralığı (px)',device==='desktop'?4:6,device==='desktop'?24:28,1],
      ])adornment.append(numberInput(label,book.indexes[name],value=>editBook(name,value,'indexes'),{
        id:'book-index-'+name,min,max,step,
      }));
    }
    host.append(adornment);
  }
  if(PHYSICAL_DEVICE_IDS.includes(id)){
    const device=presentationDevice,physical=profile.physical[device];
    const setPhysical=(key,value)=>mutatePresentation(data=>{
      data.objects[id].physical[device][key]=value;
    },'physical:'+id+':'+device+':'+key);
    const group=(name,settings,opened=false)=>{
      const section=details('physical-'+name,name,opened);
      for(const [key,label,min,max,step,percent] of settings){
        section.append(numberInput(label,percent?round(physical[key]*100):physical[key],
          value=>setPhysical(key,percent?round(value/100):value),
          {id:'physical-'+key,min,max,step}));
      }
      host.append(section);
    };
    if(id==='camera'){
      group('LCD gövdeye yerleşim',[
        ['offsetX','Yatay kaydır (px)',-24,24,1,false],
        ['offsetY','Dikey kaydır (px)',-18,18,1,false],
        ['widthScale','LCD genişliği (%)',94,106,1,true],
        ['heightScale','LCD yüksekliği (%)',94,106,1,true],
      ],true);
      group('LCD iç boşluklar',[
        ['bezelPaddingX','Çerçeve yan boşluğu (px)',8,40,1,false],
        ['bezelPaddingY','Çerçeve üst boşluğu (px)',12,40,1,false],
        ['contentPadding','İçerik kenar boşluğu (px)',7,22,1,false],
      ]);
      group('Arşiv ve oynatıcı',[
        ['archiveWidth','Arşiv paneli genişliği (px)',250,420,5,false],
        ['videoMinHeight','Video asgari yüksekliği (px)',180,275,5,false],
      ]);
    }else{
      group('Parşömen ve mürekkep',[
        ['paperX','Parşömen X (px)',-28,28,1,false],
        ['paperY','Parşömen Y (px)',-28,28,1,false],
        ['paperScale','Parşömen ölçeği (%)',92,108,1,true],
      ],true);
      group('Donanım yerleşimi',[
        ['inkwellX','Mürekkep kabı X (px)',-28,28,1,false],
        ['inkwellY','Mürekkep kabı Y (px)',-28,28,1,false],
        ['topRailX','Üst düğmeler X (px)',-22,22,1,false],
        ['topRailY','Üst düğmeler Y (px)',-18,18,1,false],
        ['rulerX','Zaman cetveli X (px)',-22,22,1,false],
        ['rulerY','Zaman cetveli Y (px)',-18,18,1,false],
      ]);
      group('Katalog kapağı',[
        ['catalogX','Katalog X (px)',-24,24,1,false],
        ['catalogY','Katalog Y (px)',-24,24,1,false],
      ]);
    }
  }
  host.append(el('div',{class:'scene-visual-actions'},
    button(focusPreview?'2B önizlemeyi kapat':'2B oda yaklaşmasını göster',()=>{
      focusPreview=!focusPreview;draw();
    },{id:'presentation-preview',disabled:!focusTargets.has(id),'aria-pressed':String(focusPreview)})));
  host.append(el('div',{class:'scene-visual-actions'},
    button('Bu nesneyi sıfırla',()=>mutatePresentation(s=>{
      s.objects[id]=structuredClone(defaultScenePresentation().objects[id]);
    },'presentation:'+id+':reset'),{id:'presentation-reset'})));
}
function exportSelectedAsset(slot,data,suffix=''){
  if(!slot||!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(data??''))throw Error('Dışa aktarılabilir WebP kaynağı bulunamadı.');
  const basename=(slot.path.split('/').pop()??'nesne').replace(/\.webp$/,'');
  const link=el('a',{href:data,download:basename+suffix+'.webp'});
  root.append(link);link.click();link.remove();
  status('WebP kaynak görsel dışa aktarıldı.');
}
function renderSourceInspector(){
  const item=object(),parent=$('#visual-source-settings'),host=$('#visual-source-inspector');
  parent.hidden=!visualAssetSlots(item).length;
  host.replaceChildren();
  if(parent.hidden)return;
  const slots=visualAssetSlots(item),chosen=selectedVisualAsset(item);
  host.append(field('Kaynak katman',el('select',{id:'visual-source-slot',
    'aria-label':'Değiştirilecek görsel katmanı',
    onchange:event=>{assetChoices.set(item.id,event.target.value);renderSourceInspector();}},
    ...slots.map(entry=>el('option',{value:entry.path,text:entry.label,selected:entry.path===chosen.path})))));
  host.append(el('p',{class:'scene-visual-tip',text:chosen.path}));
  const source=replacementSource(chosen.path,chosen.image);
  if(source&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(source)){
    host.append(el('div',{class:'scene-source-preview'},
      el('img',{src:source,alt:chosen.label,decoding:'async',draggable:false})));
  }
  if(chosen.warning)host.append(el('p',{class:'scene-source-warning',text:chosen.warning}));
  if(['archive-chest','ceremonial-dagger'].includes(item.id))parent.title='Bu görselin efekt maskesi ayrıdır; yeni siluette maske de güncellenmelidir.';
  const modified=assetReplacements.has(chosen.path);
  host.dataset.modified=String(modified);
  host.append(el('div',{class:'scene-visual-actions'},
    button('Resim seç…',()=>$('#visual-source-file').click(),{id:'visual-source-import',title:'PNG, JPEG veya WebP içe aktar'}),
    button('Aktifi dışa aktar',()=>exportSelectedAsset(chosen,source,modified?'-taslak':''),{id:'visual-source-export',title:'Atölyede seçili WebP görselini dışa aktar'}),
    button('Orijinali dışa aktar',()=>exportSelectedAsset(chosen,chosen.image),{id:'visual-source-export-original',title:'Kaydedilmiş WebP görselini dışa aktar'}),
    button('Taslak değişimini kaldır',()=>{
      if(assetReplacements.has(chosen.path)){
        recordHistory(scene,'asset:'+chosen.path+':restore');
        assetReplacements.delete(chosen.path);
        changed();draw();pruneArtworkHistory();
        status('Kaynak değişikliği taslaktan kaldırıldı.');
      }
    },{id:'visual-source-restore',disabled:!modified})));
}
function renderLayerInspector(){
  const item=object(),panel=$('#visual-layers-settings'),host=$('#visual-layers-inspector');
  if(!panel||!host)return;
  panel.hidden=item?.kind!=='artwork';
  host.replaceChildren();
  if(panel.hidden)return;
  const layers=item.visual.layers??[];
  host.append(button('＋ Hareketli katman ekle',()=>$('#visual-layer-file').click(),
    {id:'add-visual-layer',title:'İkinci WebP görselini ayrı hareket/efekt katmanı olarak ekle',disabled:layers.length>=8}));
  for(const [index,layer] of layers.entries()){
    const entry=el('div',{class:'scene-layer-entry'});
    entry.append(el('div',{class:'scene-layer-heading'},
      el('strong',{text:layer.id}),
      ...[-1,1].map(delta=>button(delta===-1?'↑':'↓',()=>{
        mutate(s=>{
          const target=s.objects.find(o=>o.id===item.id),list=target.visual.layers;
          const other=index+delta;
          [list[index],list[other]]=[list[other],list[index]];
          target.motionLayers=list.map(l=>l.id);
        },'layer:'+item.id+':order');
      },{disabled:index+delta<0||index+delta>=layers.length,
         'aria-label':delta===-1?'Katmanı üste taşı':'Katmanı alta taşı',
         title:'Görsel katmanının çizim sırasını değiştir'})),
      button('Sil',()=>{
        const id=layer.id,path=layer.asset;
        const ok=mutate(s=>{
          const target=s.objects.find(o=>o.id===item.id);
          target.motionLayers=target.motionLayers.filter(v=>v!==id);
          target.visual.layers=target.visual.layers.filter(l=>l.id!==id);
          s.effects=s.effects.filter(e=>e.target.objectId!==item.id||e.target.layerId!==id);
          if(effectId&&!s.effects.some(e=>e.id===effectId))effectId=null;
        },'layer:'+item.id+':delete');
        if(!ok)return;
        // Keep deleted artwork in the temporary registry so Undo can restore
        // its pixels; snapshot() filters unreachable sources.
        if(assetChoices.get(item.id)===path)assetChoices.delete(item.id);
        draw();
      },{class:'scene-danger',title:'Katman ve ona bağlı hareket efektlerini kaldır'})));
    for(const [key,label] of [['x','Sol X'],['y','Üst Y'],['width','Genişlik'],['height','Yükseklik']]){
      entry.append(numberInput(label+' (%)',round(layer.box[key]*100),value=>{
        const ok=mutate(s=>{
          const target=s.objects.find(o=>o.id===item.id);
          target.visual.layers.find(l=>l.id===layer.id).box[key]=round(value/100);
        },'layer:'+item.id+':'+layer.id+':'+key);
        if(ok){
          const preview=previewObjects.get(item.id)?.layers.find(l=>l.id===layer.id);
          if(preview)preview.box[key]=round(value/100);
          draw();
        }
      },{min:key==='width'||key==='height'?.1:0,max:100,step:.1,
         'data-layer':layer.id,'data-field':key}));
    }
    host.append(entry);
  }
}
function renderBackgroundInspector(){
  const host=$('#scene-background-inspector');
  if(!host||inspectorTab!=='background')return;
  host.replaceChildren();
  if(!backgroundMeta){
    host.append(el('p',{class:'scene-empty',text:'Bu sahnede arka plan kaynağı bağlı değil.'}));
    return;
  }
  const {asset,aspect}=backgroundMeta;
  const photo=$('#scene-photo'),original=backgroundMeta;
  const source=replacementSource(asset,backgroundOriginal);
  const modified=assetReplacements.has(asset);
  const originalText=original.width+' × '+original.height;
  const currentText=photo.naturalWidth&&photo.naturalHeight
    ?photo.naturalWidth+' × '+photo.naturalHeight:originalText;
  host.append(el('div',{class:'scene-background-stats'},
    el('div',{class:'scene-background-stat'},'Orijinal kaynak',
      el('strong',{id:'background-original-dimensions',text:originalText+' px'})),
    el('div',{class:'scene-background-stat'},'Etkin görsel',
      el('strong',{id:'background-active-dimensions',text:currentText+' px'})),
    el('div',{class:'scene-background-stat'},'Oda kadrajı',
      el('strong',{id:'background-ratio',text:aspect+':1'})),
    el('div',{class:'scene-background-stat'},'Normal odada görünen',
      el('strong',{id:'background-visible-fraction',text:'%100'}))));
  host.append(el('div',{class:'scene-source-preview scene-background-source-preview'},
    el('img',{src:source,alt:'Odanın kırpılmamış kaynak görseli',draggable:false,decoding:'async'})));
  host.append(el('p',{class:'scene-background-source',text:asset+' · kaynak '+Math.round(original.bytes/1024)+' KB'}));
  host.append(el('div',{class:'scene-background-controls'},
    button('Görsel seç',()=>$('#scene-background-file').click(),{
      id:'background-import',title:'Yeni resim 2:1 oranında olmalı.'}),
    button('Etkin görseli indir',()=>exportSelectedAsset({path:asset},source,modified?'-taslak':''),{
      id:'background-export',title:'Önizlemede kullanılan kırpılmamış WebP dosyası'})));
  host.append(el('div',{class:'scene-background-controls'},
    button('Orijinali indir',()=>exportSelectedAsset({path:asset},backgroundOriginal,'-orijinal'),
      {id:'background-original-export'}),
    button('Taslağı kaldır',()=>{
      if(!assetReplacements.has(asset))return;
      recordHistory(scene,'asset:'+asset+':restore');
      assetReplacements.delete(asset);
      syncBackgroundPhoto();draw();pruneArtworkHistory();changed();
      status('Oda arka planı orijinal kaynağa döndü.');
    },{id:'background-restore',disabled:!modified})));
  host.append(el('h3',{text:'Ekran önizlemesi'}));
  const options=[['room','2:1 · Yalnız oda'],
    ['1920x1080','1920 × 1080 · Masaüstü'],['1366x768','1366 × 768 · Laptop'],
    ['768x1024','768 × 1024 · Tablet'],['390x844','390 × 844 · Telefon'],['custom','Özel çözünürlük']];
  host.append(field('Cihaz / çözünürlük',el('select',{id:'background-screen-preset',
    onchange:event=>{
      screenPreset=event.target.value;
      if(screenPresets[screenPreset])[screenWidth,screenHeight]=screenPresets[screenPreset];
      fitStage();renderBackgroundInspector();
    }},...options.map(([key,name])=>el('option',{value:key,text:name,selected:screenPreset===key})))));
  if(screenPreset==='custom')host.append(el('div',{class:'scene-background-dimensions'},
    numberInput('Ekran genişliği',screenWidth,value=>{
      if(value<240||value>4096||!Number.isFinite(value))return;
      screenWidth=Math.round(value);fitStage();renderBackgroundInspector();
    },{id:'background-screen-width',min:240,max:4096,step:1}),
    numberInput('Ekran yüksekliği',screenHeight,value=>{
      if(value<240||value>4096||!Number.isFinite(value))return;
      screenHeight=Math.round(value);fitStage();renderBackgroundInspector();
    },{id:'background-screen-height',min:240,max:4096,step:1})));
  const geometry=screenPreviewGeometry();
  if(geometry){
    const fmt=value=>Number.isInteger(value)?String(value):value.toFixed(1);
    const g=geometry;
    host.append(el('div',{class:'scene-background-stats'},
      el('div',{class:'scene-background-stat'},'Ekranda oda',
        el('strong',{id:'background-room-geometry',text:fmt(g.room.width)+' × '+fmt(g.room.height)+' px'})),
      el('div',{class:'scene-background-stat'},'Görüntü dışındaki alan',
        el('strong',{id:'background-letterbox',text:g.empty.top>0
          ?'Üst/alt '+fmt(g.empty.top)+' px':g.empty.left>0
          ?'Sol/sağ '+fmt(g.empty.left)+' px':'Yok'})),
      el('div',{class:'scene-background-stat'},'Ekrana uyarlama ölçeği',
        el('strong',{id:'background-image-scale',text:screenPreset==='room'?'—'
          :Math.round(g.room.width/(photo.naturalWidth||original.width)*100)+'%'}))));
  }
  host.append(el('p',{class:'scene-help',text:'Normal oda görünümünde resmin tamamı gösterilir. Koyu alan ekranın kullanılmayan kısmıdır. Kitap ve cihaz yakınlaşmaları ayrı geçişlerle çalışır.'}));
}
function renderCropInspector(){
  const item=object(),parent=$('#visual-crop-settings'),host=$('#visual-crop-inspector');
  parent.hidden=!editableVisual(item);host.replaceChildren();
  if(parent.hidden)return;
  const crop=item.crop??EMPTY_CROP;
  const update=(key,value)=>mutate(s=>{
    const target=s.objects.find(o=>o.id===item.id);
    target.crop={...EMPTY_CROP,...target.crop,[key]:value};
  },'crop:'+item.id+':'+key);
  parent.title='Görselin kenarlarını tahribatsız kırpın. Örtme sınırı sahne koordinatını izler.';
  for(const [key,label] of [['top','Üstten'],['right','Sağdan'],['bottom','Alttan'],['left','Soldan']]){
    host.append(numberInput(label+' (%)',Math.round(crop[key]*1000)/10,
      value=>update(key,round(value/100)),{id:'visual-crop-'+key,min:0,max:95,step:.5}));
  }
  host.append(checkField('Örtme sınırı (Y)',crop.cutoffY!==null,
    checked=>update('cutoffY',checked?round(Math.min(1,item.pose.y+item.pose.height)):null),{id:'visual-crop-cutoff-enabled',title:'Nesnenin bu sahne çizgisinin altında kalan kısmını gizler.'}));
  if(crop.cutoffY!==null)host.append(numberInput('Sahne Y (%)',
    round(crop.cutoffY*100),value=>update('cutoffY',round(value/100)),
    {id:'visual-crop-cutoff-y',min:0,max:100,step:.5,title:'Sahne yüksekliğinin yüzdesi.'}));
  host.append(button('Kırpmayı sıfırla',()=>mutate(s=>{
    delete s.objects.find(o=>o.id===item.id).crop;
  },'crop:'+item.id+':reset'),{id:'visual-crop-reset'}));
}
function renderVeilInspector(){
  const item=object(),host=$('#robe-veil-inspector'),parent=$('#robe-veil-settings');
  parent.hidden=!(siteSource&&item?.id==='ceremonial-robe');
  host.replaceChildren();
  if(parent.hidden)return;
  const settings=item.veil;
  host.append(el('label',{class:'scene-visual-check'},
    el('input',{type:'checkbox',id:'robe-veil-enabled',checked:settings.enabled,
      onchange:event=>mutate(s=>{s.objects.find(o=>o.id===item.id).veil.enabled=event.target.checked;})}),
    el('span',{text:'Tıklama ile görünmezlik etkin'})));
  for(const [key,label,min,max,step] of [
    ['transitionMs','Geçiş süresi (ms)',0,3000,50],
    ['residualOpacity','Kumaş izi (0–0,30)',0,.3,.005],
    ['distortionPx','Optik kırılma (piksel)',0,7,.1],
    ['edgeOpacity','Siluet kenarı (0–0,35)',0,.35,.01]
  ])host.append(numberInput(label,settings[key],
      value=>mutate(s=>{s.objects.find(o=>o.id===item.id).veil[key]=value;},'robe:veil:'+key),
      {id:'robe-veil-'+key,min,max,step}));
  host.append(button(previewRobeVeiled?'Görünür durumu dene':'Görünmezliği dene',
    ()=>{previewRobeVeiled=!previewRobeVeiled;draw();},
    {id:'robe-veil-preview'}));
  host.append(el('p',{class:'scene-visual-tip',text:'Önizleme durumu kayda girmez. Askı ve masa fotoğrafı sabit kalır.'}));
}
function duplicateArtwork(item){
  if(item?.kind!=='artwork')return false;
  const original=previewObjects.get(item.id);
  if(!original)throw Error('Kopyalanacak görsel bulunamadı.');
  const copy=structuredClone(item);
  copy.id='artwork-'+uid().replaceAll('-','').slice(0,12);
  copy.name=(item.name+' kopyası').slice(0,160);
  copy.pose.x=round(clamp(copy.pose.x+.025,0,1-copy.pose.width));
  copy.pose.y=round(clamp(copy.pose.y+.025,0,1-copy.pose.height));
  const beforeAssets=currentAssetRefs();
  const replicated={objectId:copy.id,asset:'/scene-assets/custom/'+copy.id+'.webp',layers:[]};
  for(const [originalPath,newPath] of [
    [item.visual.asset,replicated.asset],
    ...(item.visual.layers??[]).map(layer=>[layer.asset,'/scene-assets/custom/'+copy.id+'-'+layer.id+'.webp']),
  ]){
    const slot=[original,...original.layers].find(entry=>entry.asset===originalPath);
    const dataUrl=replacementSource(originalPath,slot?.image);
    if(!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(dataUrl??''))
      throw Error('Nesnenin kopyalanabilir WebP kaynağı eksik.');
    setAssetReplacement(newPath,dataUrl);
    if(originalPath===item.visual.asset)replicated.image=dataUrl;
    else {
      const sourceLayer=item.visual.layers.find(layer=>layer.asset===originalPath);
      replicated.layers.push({...structuredClone(sourceLayer),asset:newPath,image:dataUrl});
    }
  }
  copy.visual.asset=replicated.asset;
  copy.visual.layers=replicated.layers.map(({id,asset,box})=>({id,asset,box}));
  const effects=scene.effects.filter(fx=>fx.target.objectId===item.id)
    .map(fx=>{const next=structuredClone(fx);next.id=fx.type+'-'+uid().slice(0,8);
      next.seed=fx.seed+'-copy';next.target.objectId=copy.id;return next;});
  previewObjects.set(copy.id,replicated);
  const ok=mutate(next=>{
    next.objects.push(copy);next.effects.push(...effects);
    objectId=copy.id;effectId=effects[0]?.id??null;anchorId=copy.anchors[0]?.id??null;
  },'object:'+copy.id+':duplicate',beforeAssets);
  if(!ok){
    previewObjects.delete(copy.id);
    for(const path of [replicated.asset,...replicated.layers.map(layer=>layer.asset)])
      assetReplacements.delete(path);
    return false;
  }
  setInspectorTab('visual');
  status('Bağımsız görsel nesnesi, katmanları ve efektleri çoğaltıldı.');
  return true;
}
function renderObjectInspector(){
  const host=$('#object-inspector'),hitHost=$('#hit-inspector'),item=object();
  host.replaceChildren();
  hitHost.replaceChildren();
  $('#hit-area-settings').hidden=!(item?.hitArea||item?.kind==='artwork');
  if(!item)return;
  if(item.kind==='artwork'){
    hitHost.append(checkField('Özel tıklama alanı',Boolean(item.hitArea),
      enabled=>mutate(s=>{
        const target=s.objects.find(o=>o.id===item.id);
        if(enabled)target.hitArea={
          x:target.pose.x,y:target.pose.y,width:target.pose.width,height:target.pose.height};
        else delete target.hitArea;
      },'hit:'+item.id+':toggle'),
      {id:'artwork-hit-enabled',title:'Kapatılırsa görselin tamamı etkileşim alanıdır.'}));
  }
  if(item.hitArea){
    $('#hit-area-settings').title='Kesikli alanı sürükleyerek yerleştirin; efekt hedefi ayrı taşınır.';
    for(const [key,label] of [['x','Sol X %'],['y','Üst Y %'],['width','Genişlik %'],['height','Yükseklik %']]){
      hitHost.append(numberInput(label,round(item.hitArea[key]*100),value=>mutate(s=>{
        const area=s.objects.find(entry=>entry.id===item.id).hitArea;
        area[key]=round(value/100);
      },'hit:'+item.id+':'+key),{min:key==='x'||key==='y'?0:.1,max:100,step:.1,'data-testid':'scene-hit-'+key}));
    }
  }
  host.append(field('Grup',el('input',{id:'object-group',value:item.group??'',maxLength:80,
    placeholder:'Nesneler',title:'Boş bırakılırsa Nesneler grubunda görünür.',
    onchange:event=>mutate(s=>{const target=s.objects.find(o=>o.id===item.id),value=event.target.value.trim();
      if(value)target.group=value;else delete target.group;},'group:'+item.id)})));
  if(siteSource&&item.kind!=='artwork')return;
  host.append(
    field('Nesne adı',el('input',{value:item.name,maxlength:160,onchange:event=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).name=event.target.value;},`object:${item.id}:name`)})),
    checkField('Görünür',item.visible,value=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).visible=value;},`object:${item.id}:visible`))
  );
  if(item.kind!=='artwork')for(const [key,label,min,max,step] of [['x','X',0,1,.001],['y','Y',0,1,.001],['width','Genişlik',.001,1,.001],['height','Yükseklik',.001,1,.001],['rotation','Dönüş (derece)',-360,360,1],['depth','Derinlik',-100,100,1]]){
    host.append(numberInput(label,item.pose[key],value=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).pose[key]=value;},`object:${item.id}:${key}`),{min,max,step}));
  }
  if(!siteSource&&item.kind!=='artwork')host.append(field('Hareketli katman kimlikleri',el('input',{value:(item.motionLayers??[]).join(','),'aria-label':'Hareketli katman kimlikleri',onchange:event=>mutate(s=>{s.objects.find(o=>o.id===item.id).motionLayers=event.target.value.split(',').map(v=>v.trim()).filter(Boolean);})})));
  if(item.kind==='artwork')host.append(button('Nesneyi çoğalt',
    ()=>duplicateArtwork(item),{id:'duplicate-artwork',title:'Bağımsız kaynak görselleri ve bağlı efektleriyle kopyala'}));
  if(item.kind==='artwork')host.append(button('Nesneyi sil',()=>{
    const removed=item.id,path=item.visual.asset;
    const ok=mutate(s=>{
      s.objects=s.objects.filter(o=>o.id!==removed);
      s.effects=s.effects.filter(effect=>effect.target.objectId!==removed);
      objectId=null;effectId=null;
    },'object:'+removed+':delete');
    if(ok){
      // Keep the detached image in the temporary registry for Undo.
      // The serialized draft excludes deleted art and unused custom files.
      draw();
    }
  },{class:'scene-danger',id:'delete-artwork',title:'Nesne ve bağlı efektlerini kaldır'}));
  if(!item.anchors.length)return;
  host.append(field('Bağlantı noktası',el('select',{'aria-label':'Adlandırılmış bağlantı noktası',onchange:event=>{anchorId=event.target.value;renderObjectInspector();}},
    ...item.anchors.map(entry=>el('option',{value:entry.id,text:entry.id,selected:entry.id===anchorId})))));
  const current=anchor();
  if(current){
    for(const key of ['x','y'])host.append(numberInput(`Bağlantı ${key.toUpperCase()}`,current[key],value=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).anchors.find(entry=>entry.id===current.id)[key]=value;},`anchor:${item.id}:${current.id}:${key}`),{min:0,max:1,step:.001}));
    const point=anchorScenePoint(item,current.id);
    host.append(el('p',{class:'scene-location',text:`Görsel konum: ${Math.round(point.x*scene.viewport.width)} × ${Math.round(point.y*scene.viewport.height)} px (${scene.viewport.width} × ${scene.viewport.height})`}));
  }
}
function renderEffectInspector(){
  const host=$('#effect-inspector'),advanced=$('#effect-advanced'),item=effect();
  host.replaceChildren(el('h2',{text:'Efekt'}));advanced.replaceChildren();
  if(!item){host.append(el('p',{class:'scene-empty',text:'Bağlı efekt yok.'}));return;}
  const info=objectEffectRegistry[item.type];
  host.append(el('p',{class:'scene-effect-title',text:info.label,title:info.description}),
    checkField('Etkin',item.enabled,value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).enabled=value;},`effect:${item.id}:enabled`),{id:'effect-enabled'}),
    el('div',{class:'scene-section-title'},el('h3',{text:'Parametre profili'}),el('span',{id:'effect-profile',class:'scene-profile-state',text:profileForEffect(item)})),
    el('div',{class:'scene-profiles'},...sceneProfiles.map(profile=>button(profile.label,()=>mutate(s=>applySceneProfile(s.effects.find(entry=>entry.id===item.id),profile.key)),{id:`profile-${profile.key}`,'aria-pressed':String(profileForEffect(item)===profile.label)})))
  );
  const selectedTrigger=effectTrigger(item);
  const availableTriggers=allowedEffectTriggers(item.type);
  const labels={ambient:'Sürekli',click:'OnClick · Tıklama',hover:'OnHover · Üzerine gelme'};
  host.append(field('Tetikleme',el('select',{
    id:'effect-trigger','aria-label':'Tetikleme',title:'Efekt ne zaman çalışır: sürekli, tıklama veya üzerine gelme.',disabled:availableTriggers.length===1,
    onchange:event=>mutate(s=>{
      const target=s.effects.find(entry=>entry.id===item.id);
      target.trigger=event.target.value;
      if(event.target.value==='ambient')delete target.interaction;
    }),
  },...availableTriggers.map(trigger=>el('option',{value:trigger,text:labels[trigger],selected:trigger===selectedTrigger})))));
  if(['hover','click'].includes(selectedTrigger)&&item.type==='glow'){
    host.title=selectedTrigger==='hover'?'Hover: üstüne gelince çalışır, ayrılınca geri döner.':'Click: tıklanınca çalışır.';
    for(const [key,label,fallback] of [['enterMs','İleri hareket (ms)',240],['leaveMs','Geri hareket (ms)',190]]){
      host.append(numberInput(label,item.interaction?.[key]??fallback,value=>mutate(s=>{
        const target=s.effects.find(entry=>entry.id===item.id);
        target.interaction={enterMs:240,leaveMs:190,...target.interaction,[key]:value};
      }),{id:'interaction-'+key,min:80,max:2000,step:10}));
    }
  }
  for(const control of basicControls(item.type)){
    const id=`basic-${control.key}`,value=item.params[control.key];
    const format=value=>control.key==='amplitude'?`${Number(value).toFixed(1)}°`:control.key==='frequency'?`${Number(value).toFixed(1)} Hz`:control.key==='damping'?`${Number(value).toFixed(1)} s⁻¹`:control.key==='duration'?`${Number(value).toFixed(2)} s`:control.key==='speed'?`${Number(value).toFixed(2)} ×`:`${Math.round(Number(value)*100)} %`;
    const output=el('output',{htmlFor:id,text:format(value)});
    const input=el('input',{id,type:'range',min:control.min,max:control.max,step:control.step,value,'aria-label':control.label,
      oninput:event=>{output.textContent=format(event.target.value);},
      onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).params[control.key]=event.target.valueAsNumber;})});
    host.append(el('div',{class:'scene-slider'},el('div',{class:'scene-slider-title'},el('label',{htmlFor:id,text:control.label}),output),input));
  }
  if(info.trigger==='pulse')host.append(button('Efekti dene',()=>bindPreview(item.id),{id:'preview-pulse',disabled:!item.enabled,title:'Kısa süreli efekti önizle'}));
  if(item.type==='glow'&&selectedTrigger==='click')host.append(button('Efekti dene',()=>previewHandle?.triggerEffect(item.id),{id:'preview-interaction-click',disabled:!item.enabled}));
  if(item.type==='glow'&&selectedTrigger==='hover')host.title='Üzerine gelerek efekti deneyin.';
  if(!siteSource||object()?.kind==='artwork'){
    advanced.append(field('Tür',el('select',{'aria-label':'Efekt türü',onchange:event=>mutate(s=>{const target=s.effects.find(entry=>entry.id===item.id);target.type=event.target.value;target.params=defaultObjectParams(target.type);if(objectEffectRegistry[target.type].output==='motion'){target.target.layerId=object().motionLayers?.[0];}else delete target.target.layerId;})},
      ...Object.entries(objectEffectRegistry).filter(([type,entry])=>
        type===item.type||entry.output!=='motion'||object().motionLayers?.length
      ).map(([type,entry])=>el('option',{value:type,text:entry.label,selected:type===item.type})))),
      field('Hedef bağlantı',el('select',{'aria-label':'Efekt hedef bağlantısı',onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target.anchorId=event.target.value;})},
      ...object().anchors.map(entry=>el('option',{value:entry.id,text:entry.id,selected:entry.id===item.target.anchorId})))));
  }
  if(info.output==='motion')advanced.append(field('Hareketli katman',el('select',{'aria-label':'Hareketli katman',disabled:Boolean(siteSource&&object()?.kind!=='artwork'),onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target.layerId=event.target.value;})},...object().motionLayers.map(id=>el('option',{value:id,text:id,selected:id===item.target.layerId})))));
  advanced.title='Hedef kaydırması nesne boyutuna göre normalize edilir.';
  for(const [key,label,min,max,step] of [['x','Kaydırma X',-5,5,.01],['y','Kaydırma Y',-5,5,.01]])advanced.append(numberInput(label,item.target.offset[key],value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target.offset[key]=value;}),{id:`effect-offset-${key}`,min,max,step}));
  for(const [key,label,min,max,step] of [['scale','Ölçek',.01,10,.01],['depth','Efekt derinliği',-100,100,1]])advanced.append(numberInput(label,item.target[key],value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target[key]=value;}),{min,max,step}));
  advanced.append(field('Efekt tohumu',el('input',{value:item.seed,maxlength:120,onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).seed=event.target.value;})})));
  for(const control of info.controls)advanced.append(numberInput(control.label,item.params[control.key],value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).params[control.key]=value;}),{min:control.min,max:control.max,step:control.step,'aria-label':control.label}));
  if(!siteSource||object()?.kind==='artwork')advanced.append(el('div',{class:'scene-button-row'},
    button('Kopyala',()=>mutate(s=>{const copy=structuredClone(item);copy.id=uniqueEffectId(copy.type);copy.seed=`${copy.seed}-copy`;s.effects.push(copy);effectId=copy.id;})),
    button('Sil',()=>mutate(s=>{s.effects=s.effects.filter(entry=>entry.id!==item.id);effectId=null;}),{class:'scene-danger'})));
}

function buildObject(item){
  const node=el('div',{
    id:`stage-object-${item.id}`,class:`scene-object ${item.id===objectId?'selected':''} ${item.visible?'':'is-hidden'}`,
    'data-scene-object':item.id,'data-scene-object-id':item.id,'data-object-id':item.id,'data-scene-id':scene.sceneId,
    role:'button',tabindex:0,'aria-label':`${item.name} nesnesi`,
    title:`${item.name} · ${item.id}`
  });
  Object.assign(node.style,{
    left:`${item.pose.x*100}%`,top:`${item.pose.y*100}%`,width:`${item.pose.width*100}%`,height:`${item.pose.height*100}%`,
    transform:`rotate(${item.pose.rotation}deg)`,zIndex:String(100+Math.round(item.pose.depth))
  });
  node.dataset.visualEditable=String(editableVisual(item));
  if(item.id==='ceremonial-robe')Object.assign(node.style,visualClipStyle(item));
  node.addEventListener('pointerdown',event=>{
    if(visualMode&&editableVisual(item)&&event.button===0)beginVisualDrag(event,item,node);
  });
  const artwork=previewObjects.get(item.id);
  if(artwork && item.id==='ceremonial-robe'){
    const veil=item.veil;
    const lens=el('canvas',{class:'scene-robe-preview-refraction','aria-hidden':'true'});
    Object.assign(lens.style,{position:'absolute',inset:0,width:'100%',height:'100%',
      pointerEvents:'none',opacity:previewRobeVeiled?'1':'0',
      filter:'drop-shadow(0 0 1.2px rgba(177,207,207,'+veil.edgeOpacity+'))'});
    node.append(lens);
  }
  if(artwork){
    const fixed=el('img',{src:replacementSource(artwork.asset,artwork.image),alt:'',class:'scene-motion-fixed'});
    Object.assign(fixed.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',
      filter:item.kind==='artwork'?'none':'brightness(.72) saturate(.72)',
      ...(item.kind==='artwork'?visualClipStyle(item):{}),
      ...(item.id==='archive-chest'?{width:'150%',zIndex:'1',...visualClipStyle(item)}:{})});node.append(fixed);
  }
  for(const id of item.motionLayers??[]){
    const layer=el('span',{'data-effect-layer':id,'aria-hidden':'true'});
    Object.assign(layer.style,{position:'absolute',inset:0,width:item.id==='archive-chest'?'150%':'100%',
      height:'100%',pointerEvents:'none',...(item.id==='archive-chest'?{zIndex:'3',transformStyle:'preserve-3d'}:{}),...(item.id==='ceremonial-robe'?{}:visualClipStyle(item))});
    const picture=artwork?.layers.find(entry=>entry.id===id);
    if(item.kind==='artwork')Object.assign(layer.style,visualClipStyle(item));
    if(picture){const image=el('img',{src:replacementSource(picture.asset,picture.image),alt:''});
      const b=item.kind==='artwork'?item.visual.layers.find(entry=>entry.id===id)?.box??picture.box:picture.box;Object.assign(image.style,{position:'absolute',left:`${b.x*100}%`,top:`${b.y*100}%`,width:`${b.width*100}%`,height:`${b.height*100}%`,filter:item.kind==='artwork'?'none':'brightness(.7) saturate(.7)'});layer.append(image);}
    else {const sample=el('span');Object.assign(sample.style,{position:'absolute',left:'49%',top:'10%',width:'2%',height:'50%',background:'#b68d4b',borderRadius:'50%'});layer.append(sample);}
    node.append(layer);
  }
  node.append(el('span',{class:'scene-object-label',text:item.name}));
  for(const point of item.anchors){
    const dot=el('span',{class:`scene-object-anchor ${point.id===anchorId?'is-selected':''}`,'data-anchor-id':point.id,'aria-hidden':'true'});
    dot.style.left=`${point.x*100}%`;dot.style.top=`${point.y*100}%`;node.append(dot);
  }
  node.addEventListener('click',()=>selectObject(item.id));
  node.addEventListener('keydown',event=>{
    if(visualMode&&editableVisual(item)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();
      const step=event.shiftKey?.01:.001;
      const dx=(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0);
      const dy=(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0);
      mutate(s=>moveVisual(s,item.id,{x:round(item.pose.x+dx),y:round(item.pose.y+dy)}),'visual:'+item.id+':keyboard');
    }else if(event.key==='Enter'||event.key===' '){event.preventDefault();selectObject(item.id);}
  });
  return node;
}
function renderMarkers(){
  $('#scene-markers').replaceChildren();
  markerElements.clear();
  if(!scene)return;
  scene.effects.forEach((item,index)=>{
    const owner=scene.objects.find(entry=>entry.id===item.target.objectId);
    if(!owner)return;
    const point=effectScenePoint(owner,item);
    const marker=el('button',{type:'button',id:`marker-${item.id}`,class:`scene-marker ${item.id===effectId?'is-selected':''} ${item.enabled&&owner.visible?'':'is-off'}`,text:String(index+1),
      title:`${objectEffectRegistry[item.type].label} · ${owner.name} → ${item.target.anchorId}`,'aria-label':`${objectEffectRegistry[item.type].label} hedefini sürükle`});
    marker.dataset.effectId=item.id;
    Object.assign(marker.style,{left:`${point.x*100}%`,top:`${point.y*100}%`});
    marker.addEventListener('pointerdown',event=>beginDrag(event,item));
    marker.addEventListener('click',()=>selectEffect(item.id));
    marker.addEventListener('keydown',event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight'&&event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
      event.preventDefault();
      const step=event.shiftKey?.05:.01;
      mutate(s=>{const target=s.effects.find(entry=>entry.id===item.id);target.target.offset.x=round(clamp(target.target.offset.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),-5,5));target.target.offset.y=round(clamp(target.target.offset.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0),-5,5));},`effect:${item.id}:offset`);
    });
    markerElements.set(item.id,marker);
    $('#scene-markers').append(marker);
  });
}
function renderStageSelection(){
  for(const [id,node] of objectElements)node.classList.toggle('selected',id===objectId);
  for(const [id,node] of markerElements)node.classList.toggle('is-selected',id===effectId);
}
function bindPreview(pulseId=null){
  previewHandle?.destroy();previewHandle=null;
  if(!scene)return;
  try{
    const selected={...scene,effects:scene.effects.filter(item=>objectEffectRegistry[item.type].trigger!=='pulse'||item.id===pulseId)};
    previewHandle=bindObjectScene(selected,id=>objectElements.get(id),{expectedSceneId:scene.sceneId,interactive:true});
    const bladeMask=previewObjects.get('ceremonial-dagger')?.bladeMask;
    if(bladeMask){
      for(const canvas of objectElements.get('ceremonial-dagger')?.querySelectorAll('canvas.object-effect-overlay')??[]){
        canvas.style.maskImage='url("'+bladeMask+'")';
        canvas.style.webkitMaskImage='url("'+bladeMask+'")';
        canvas.style.maskSize='100% 100%';
        canvas.style.webkitMaskSize='100% 100%';
        canvas.style.maskRepeat='no-repeat';
        canvas.style.maskMode='alpha';
      }
    }
    const chestMask=previewObjects.get('archive-chest')?.lightMask;
    if(chestMask){
      for(const canvas of objectElements.get('archive-chest')?.querySelectorAll('canvas.object-effect-overlay')??[]){
        canvas.style.maskImage='url("'+chestMask+'")';
        canvas.style.webkitMaskImage='url("'+chestMask+'")';
        canvas.style.maskSize='100% 100%';
        canvas.style.webkitMaskSize='100% 100%';
        canvas.style.maskRepeat='no-repeat';
        canvas.style.maskMode='alpha';
        canvas.style.zIndex='2';
      }
    }
    if(!playing)previewHandle.setPaused(true);
    previewHandle.setEnabled(showEffects);
  }catch(e){previewHandle=null;error(e);}
}
function refreshRobePreview(){
  const item=scene?.objects.find(o=>o.id==='ceremonial-robe');
  if(!item)return;
  const node=objectElements.get(item.id);
  const canvas=node?.querySelector('.scene-robe-preview-refraction');
  const image=node?.querySelector('[data-effect-layer="fabric"] img');
  if(!node||!image)return;
  image.style.opacity=previewRobeVeiled?String(item.veil.residualOpacity):'1';
  if(!previewRobeVeiled||!canvas)return;
  const photo=$('#scene-photo');
  Promise.all([photo.decode(),image.decode()]).then(()=>{
    if(canvas.isConnected)drawRefractedSilhouette(canvas,photo,image,item.pose,item.veil.distortionPx);
  }).catch(()=>{});
}
/** Source-aligned room composition. These pixels are read from the exact
 * reviewed WebP assets already supplied for source editing. This is a static
 * room preview, never a second React/Grabfold/LCD/playback instance.
 */
function renderRoomObjects(){
  const host=$('#scene-room-objects');
  host.replaceChildren();
  host.hidden=!siteSource||!showRoomObjects||!roomObjects.size;
  if(host.hidden)return;
  const asset=(id,path)=>{
    const source=artworkSlots.get(id)?.find(entry=>entry.path===path);
    return source?replacementSource(path,source.image):null;
  };
  for(const [id,record] of roomObjects){
    const owner=scene.objects.find(entry=>entry.id===id);
    if(!owner)continue;
    const visualKind=record.kind==='device'?(id==='camera'?'camera':'vefk'):record.kind;
    const node=el('button',{type:'button',class:'scene-room-figure scene-room-figure--'+visualKind,
      'data-room-object':id,'data-selected':String(objectId===id),
      'aria-label':owner.name+' · oda görünümünde seç',
      onclick:()=>selectObject(id)});
    const coords=record.kind==='book'
      ?{x:record.x,y:record.y,width:record.width,height:record.width*2/1.5}
      :{x:record.foundation.x,y:record.foundation.y,width:record.foundation.width,height:record.foundation.height};
    Object.assign(node.style,{
      left:coords.x*100+'%',top:coords.y*100+'%',
      width:coords.width*100+'%',height:coords.height*100+'%',
      transform:'translate(-50%, -50%)'+(record.kind==='book'
        ?' rotate('+record.angle+'deg) scaleY('+record.surfaceScaleY+')'
        :id==='vefk-stand'?' perspective(800px) rotateY(-9deg)':''),
    });
    const append=(path,cls,styling={})=>{
      const source=asset(id,path);
      if(!source)return;
      const image=el('img',{src:source,class:cls,alt:'',decoding:'async',draggable:false});
      Object.assign(image.style,styling);
      node.append(image);
    };
    if(record.kind==='book')append(record.src,'scene-room-cover');
    else if(id==='camera')append('/scene-assets/camera/research/camera-body.webp','scene-room-camera');
    else if(id==='vefk-stand'){
      const paper=presentation.objects[id].physical.desktop;
      append('/scene-assets/vefk/vellum.webp','scene-room-paper',{
        left:(115+paper.paperX)/1024*100+'%',top:(170+paper.paperY)/1536*100+'%',
        transform:'scale('+paper.paperScale+')',
      });
      append('/scene-assets/vefk/chassis-no-nameplate.webp','scene-room-chassis');
      append('/scene-assets/vefk/quill.webp','scene-room-quill');
      append('/scene-assets/vefk/inkwell.webp','scene-room-inkwell',{
        left:(80+paper.inkwellX)/1024*100+'%',top:(951+paper.inkwellY)/1536*100+'%',
      });
    }
    if(node.childElementCount)host.append(node);
  }
}
function renderStage(){
  previewHandle?.destroy();previewHandle=null;
  renderRoomObjects();
  const host=$('#scene-objects');host.replaceChildren();objectElements.clear();
  if(!scene)return;
  for(const item of scene.objects){
    const node=buildObject(item);objectElements.set(item.id,node);host.append(node);
    if(item.hitArea){
      const area=el('span',{class:'scene-hit-area'+(item.id===objectId?' selected':''),
        'data-hit-object':item.id,'aria-hidden':'true'});
      Object.assign(area.style,{left:item.hitArea.x*100+'%',top:item.hitArea.y*100+'%',
        width:item.hitArea.width*100+'%',height:item.hitArea.height*100+'%'});
      if(item.id===objectId)area.addEventListener('pointerdown',event=>beginHitDrag(event,item,area));
      host.append(area);
    }
  }
  bindPreview();
  renderMarkers();
  refreshRobePreview();
}
function applyFocusPreview(){
  const target=focusTargets.get(objectId);
  const show=Boolean(focusPreview&&siteSource&&target&&presentation);
  let transform='';
  if(show){
    const view=presentation.objects[objectId][presentationDevice];
    const weight=2/14;
    const scale=1.025+(.06+weight*.003)*view.roomZoom;
    const x=(.5-target.x)*(5.4+weight*.3)+view.roomShiftX;
    const y=(.5-target.y)*(3+weight*.2)+view.roomShiftY;
    transform=`translate(${x}%, ${y}%) scale(${scale})`;
  }
  const root=$('#scene-viewport');
  root.classList.toggle('presentation-preview',show);
  for(const selector of ['#scene-photo','#scene-room-objects','#scene-objects','#scene-markers']){
    const node=$(selector);
    node.style.transform=transform;
    node.style.transformOrigin='50% 50%';
    node.style.transition=show?'transform 450ms cubic-bezier(.22,.72,.22,1)':'transform 220ms ease';
    if(selector!=='#scene-photo')node.style.pointerEvents=show?'none':'';
  }
  $('#coordinate-help').textContent=show
    ?'2B oda kadraj denemesi · gerçekte kitap, LCD ve Çizim Atölyesi ön planda ayrı hareket eder. Değişiklikler yalnız Kaydet ile taslak olur.'
    :siteSource
      ?'Görsel Taşı: bağımsız taş, kaftan, hançer ve sandık katmanlarını yerleştir. Yakınlaştırma yalnız önizlemeyi büyütür.'
      :'Yerel önizleme; yakınlaştırma kaynak pozisyonlarını değiştirmez.';
}
function draw(){
  if(!scene)return;
  const focusId=document.activeElement?.id;
  const scrolls=[...root.querySelectorAll('.scene-panel')].map(node=>[node,node.scrollTop]);
  if(!object())objectId=scene.objects[0]?.id??null;
  const owner=object();
  if(!owner)objectId=scene.objects[0]?.id??null;
  if(anchorId&&!anchor())anchorId=owner?.anchors[0]?.id??null;
  if(!anchorId)anchorId=owner?.anchors[0]?.id??null;
  if(effectId&&!effectsForObject().some(item=>item.id===effectId))effectId=null;
  if(!effectId)effectId=effectsForObject()[0]?.id??null;
  if(effect()&&anchorId!==effect().target.anchorId)anchorId=effect().target.anchorId;
  $('#scene-name').value=scene.name;
  $('#scene-id-line').textContent=`sceneId: ${scene.sceneId} · ${scene.viewport.width} × ${scene.viewport.height}`;
  $('#scene-seed').value=scene.seed;
  renderLists();
  renderObjectInspector();
  renderVisualInspector();
  renderPresentationInspector();
  renderSourceInspector();
  renderCropInspector();
  renderLayerInspector();
  syncBackgroundPhoto();
  renderBackgroundInspector();
  renderVeilInspector();
  renderEffectInspector();
  renderStage();
  applyFocusPreview();
  updateHistoryButtons();
  if(focusId)root.querySelector('#'+CSS.escape(focusId))?.focus({preventScroll:true});
  for(const [node,top] of scrolls)node.scrollTop=top;
}
function updateHistoryButtons(){
  $('#undo').disabled=!history.past.length;
  $('#redo').disabled=!history.future.length;
}
let drag=null,hitDrag=null,visualDrag=null;
function beginVisualDrag(event,item,node){
  if(visualDrag)return;
  event.preventDefault();event.stopPropagation();
  objectId=item.id;effectId=scene.effects.find(e=>e.target.objectId===item.id)?.id??null;
  const rect=$('#scene-viewport').getBoundingClientRect();
  visualDrag={id:item.id,pointerId:event.pointerId,original:structuredClone(item.pose),
    startX:event.clientX,startY:event.clientY,width:rect.width,height:rect.height,
    changed:false,before:structuredClone(scene),node};
  node.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove',moveVisualDrag);
  window.addEventListener('pointerup',endVisualDrag);
  window.addEventListener('pointercancel',endVisualDrag);
}
function moveVisualDrag(event){
  if(!visualDrag||event.pointerId!==visualDrag.pointerId)return;
  const d=visualDrag,dx=(event.clientX-d.startX)/d.width,dy=(event.clientY-d.startY)/d.height;
  const next=structuredClone(d.before);
  try{
    moveVisual(next,d.id,{x:round(d.original.x+dx),y:round(d.original.y+dy)});
    validateScene(next);
  }catch(e){error(e);return;}
  if(JSON.stringify(next)===JSON.stringify(scene))return;
  scene=next;d.changed=true;
  const pose=next.objects.find(o=>o.id===d.id).pose;
  Object.assign(d.node.style,{left:pose.x*100+'%',top:pose.y*100+'%'});
  status('Görsel: '+Math.round(pose.x*1000)/10+'% / '+Math.round(pose.y*1000)/10+'%');
}
function endVisualDrag(event){
  if(!visualDrag||event.pointerId!==visualDrag.pointerId)return;
  const d=visualDrag;visualDrag=null;
  window.removeEventListener('pointermove',moveVisualDrag);
  window.removeEventListener('pointerup',endVisualDrag);
  window.removeEventListener('pointercancel',endVisualDrag);
  if(d.changed){recordHistory(d.before,'visual:'+d.id+':drag');changed();}
  draw();
}
function beginHitDrag(event,item,node){
  if(event.button!==undefined&&event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  const viewport=$('#scene-viewport').getBoundingClientRect();
  hitDrag={id:item.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
    original:structuredClone(item.hitArea),before:structuredClone(scene),changed:false,
    width:viewport.width,height:viewport.height,node};
  node.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove',moveHitDrag);
  window.addEventListener('pointerup',endHitDrag);
  window.addEventListener('pointercancel',endHitDrag);
}
function moveHitDrag(event){
  if(!hitDrag||event.pointerId!==hitDrag.pointerId)return;
  const {id,original,width,height,node}=hitDrag;
  const x=round(clamp(original.x+(event.clientX-hitDrag.startX)/width,0,1-original.width));
  const y=round(clamp(original.y+(event.clientY-hitDrag.startY)/height,0,1-original.height));
  const old=scene.objects.find(item=>item.id===id).hitArea;
  if(old.x===x&&old.y===y)return;
  const next=structuredClone(scene);
  next.objects.find(item=>item.id===id).hitArea={...original,x,y};
  try{validateScene(next);}catch(e){error(e);return;}
  scene=next;hitDrag.changed=true;
  node.style.left=x*100+'%';node.style.top=y*100+'%';
  status('Tıklanabilir alan: '+Math.round(x*100)+'% / '+Math.round(y*100)+'%');
}
function endHitDrag(event){
  if(!hitDrag||event.pointerId!==hitDrag.pointerId)return;
  window.removeEventListener('pointermove',moveHitDrag);
  window.removeEventListener('pointerup',endHitDrag);
  window.removeEventListener('pointercancel',endHitDrag);
  if(hitDrag.changed){recordHistory(hitDrag.before);changed();}
  hitDrag=null;draw();
}
function beginDrag(event,item){
  if(event.button!==undefined&&event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  selectForDrag(item);
  const owner=object(),element=objectElements.get(owner.id),marker=markerElements.get(item.id),rect=element?.getBoundingClientRect();
  if(!rect)return;
  drag={id:item.id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
    offsetX:item.target.offset.x,offsetY:item.target.offset.y,
    width:Math.max(1,rect.width),height:Math.max(1,rect.height),before:structuredClone(scene),changed:false,marker};
  marker?.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove',moveDrag);
  window.addEventListener('pointerup',endDrag);
  window.addEventListener('pointercancel',endDrag);
}
function moveDrag(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  const x=round(clamp(drag.offsetX+(event.clientX-drag.startX)/drag.width,-5,5));
  const y=round(clamp(drag.offsetY+(event.clientY-drag.startY)/drag.height,-5,5));
  const current=effect();
  if(!current||(current.target.offset.x===x&&current.target.offset.y===y))return;
  const next=structuredClone(scene);
  const target=next.effects.find(entry=>entry.id===drag.id);
  target.target.offset={x,y};
  try{validateScene(next);}catch(e){error(e);return;}
  scene=next;drag.changed=true;
  const owner=next.objects.find(entry=>entry.target?.id===drag.id)??next.objects.find(entry=>entry.id===target.target.objectId);
  const point=effectScenePoint(owner,target);
  drag.marker.style.left=`${point.x*100}%`;drag.marker.style.top=`${point.y*100}%`;
  const ox=$('#effect-offset-x'),oy=$('#effect-offset-y');
  if(ox)ox.value=String(x);if(oy)oy.value=String(y);
  status(`Kaydırma: ${x.toFixed(2)} / ${y.toFixed(2)}`);
  if(!previewFrame)previewFrame=requestAnimationFrame(()=>{previewFrame=null;bindPreview();});
}
function endDrag(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  window.removeEventListener('pointermove',moveDrag);
  window.removeEventListener('pointerup',endDrag);
  window.removeEventListener('pointercancel',endDrag);
  if(drag.changed){recordHistory(drag.before);changed();status('Efekt hedef kaydırması güncellendi.');}
  drag=null;
  draw();
}
function install(next,message,{resetHistory=false}={}){
  validateScene(next);
  if(scene)recordHistory(scene);
  scene=next;
  if(resetHistory){history.past.length=0;history.future.length=0;}
  objectId=scene.objects[0]?.id??null;
  anchorId=scene.objects[0]?.anchors[0]?.id??null;
  effectId=scene.effects.find(item=>item.target.objectId===objectId)?.id??null;
  draw();
  status(message);
}
function installPreview(packet){
  const preview=packet.previewImage;
  backgroundMeta=packet.background??null;
  backgroundOriginal=preview??'';
  screenPreset='room';
  if(backgroundMeta&&(!/^\/scene-assets\/approved\/[a-z0-9-]+\.webp$/.test(backgroundMeta.asset)
    ||backgroundMeta.aspect!==2||backgroundMeta.width!==2*backgroundMeta.height))
    throw Error('Arka plan fotoğrafının kaynak bilgileri geçersiz.');
  previewObjects=new Map();
  for(const artwork of packet.previewObjects??[]){
    const owner=packet.scene.objects.find(o=>o.id===artwork.objectId);
    const validImage=value=>typeof value==='string'&&value.length<12*1024*1024&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value);
    if(!owner||previewObjects.has(owner.id)||!validImage(artwork.image)||!Array.isArray(artwork.layers)||!/^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(artwork.asset))throw Error('Geçersiz nesne görseli.');
    const ids=new Set();
    for(const layer of artwork.layers){
      const b=layer.box;
      if(!owner.motionLayers?.includes(layer.id)||ids.has(layer.id)||!validImage(layer.image)||!/^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(layer.asset)||!b||Object.keys(b).length!==4||!['x','y','width','height'].every(k=>Number.isFinite(b[k])&&b[k]>=0&&b[k]<=1)||b.x+b.width>1||b.y+b.height>1)throw Error('Geçersiz hareket görseli.');
      ids.add(layer.id);
    }
    previewObjects.set(owner.id,artwork);
  }
  if(preview!==undefined&&(typeof preview!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(preview)))throw new Error('Site önizleme görseli geçersiz.');
  assetReplacements=new Map();assetPayloads.clear();assetChoices=new Map();
  artworkSlots=new Map();
  const approvedSources=new Set([...(backgroundMeta?[backgroundMeta.asset]:[]),
    ...[...previewObjects].filter(([id])=>canCropVisual(
      packet.scene.objects.find(o=>o.id===id))).flatMap(([,art])=>[
      art.asset,...art.layers.map(layer=>layer.asset)
    ])]);
  const usedArtPaths=new Set();
  for(const record of packet.previewArt??[]){
    const validImage=value=>typeof value==='string'&&value.length<12*1024*1024
      &&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value);
    if(!record||!FOCUS_OBJECT_IDS.includes(record.objectId)||
      !packet.scene.objects.some(o=>o.id===record.objectId)||
      typeof record.path!=='string'||
      !/^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(record.path)||
      usedArtPaths.has(record.path)||approvedSources.has(record.path)||
      typeof record.label!=='string'||record.label.length>100||
      typeof record.warning!=='string'||record.warning.length>300||
      !validImage(record.image))
      throw Error('Geçersiz ana görsel önizleme kaynağı.');
    usedArtPaths.add(record.path);approvedSources.add(record.path);
    const list=artworkSlots.get(record.objectId)??[];
    list.push({path:record.path,label:record.label,warning:record.warning,image:record.image});
    artworkSlots.set(record.objectId,list);
  }
  for(const replacement of packet.assets??[]){
    if(!replacement||typeof replacement.path!=='string'||!approvedSources.has(replacement.path)
      ||typeof replacement.dataUrl!=='string'
      ||!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(replacement.dataUrl)
      ||replacement.dataUrl.length>12*1024*1024||assetReplacements.has(replacement.path))
      throw Error('Geçersiz kaynak görsel taslağı.');
    setAssetReplacement(replacement.path,replacement.dataUrl);
  }
  siteSource=packet.siteSource===true;
  sourceScene=siteSource?structuredClone(packet.scene):null;
  presentation=validateScenePresentation(structuredClone(packet.presentation??defaultScenePresentation()));
  previewRobeVeiled=false;
  focusPreview=false;
  focusTargets=new Map();
  for(const target of packet.focusTargets??[]){
    if(!FOCUS_OBJECT_IDS.includes(target.id)||focusTargets.has(target.id)||
      !Number.isFinite(target.foundation?.x)||!Number.isFinite(target.foundation?.y)||
      target.foundation.x<0||target.foundation.x>1||target.foundation.y<0||target.foundation.y>1)
      throw Error('Geçersiz odak önizleme hedefi.');
    focusTargets.set(target.id,target.foundation);
  }
  roomObjects=new Map();
  for(const record of packet.roomObjects??[]){
    if(!record||!FOCUS_OBJECT_IDS.includes(record.id)||roomObjects.has(record.id)||
       !packet.scene.objects.some(item=>item.id===record.id)||
       !['book','device'].includes(record.kind))throw Error('Geçersiz oda nesnesi.');
    if(record.kind==='book'){
      const values=[record.x,record.y,record.width,record.angle,record.surfaceScaleY];
      if(!['research-journal','community-journal'].includes(record.id)||
         typeof record.src!=='string'||!artworkSlots.get(record.id)?.some(slot=>slot.path===record.src)||
         !values.every(Number.isFinite)||record.x<0||record.x>1||record.y<0||record.y>1||
         record.width<=0||record.width>.6||Math.abs(record.angle)>45||
         record.surfaceScaleY<.65||record.surfaceScaleY>1.35)
        throw Error('Geçersiz kitap önizleme konumu.');
    }else{
      const f=record.foundation;
      if(!['camera','vefk-stand'].includes(record.id)||
         !f||!['x','y','width','height'].every(key=>Number.isFinite(f[key]))||
         f.x<0||f.x>1||f.y<0||f.y>1||f.width<=0||f.width>1||f.height<=0||f.height>1)
        throw Error('Geçersiz donanım önizleme konumu.');
    }
    roomObjects.set(record.id,record);
  }
  if(siteSource&&packet.roomObjects!==undefined&&roomObjects.size!==4)
    throw Error('Oda önizlemesi dört ana nesneyi içermeli.');
  $('#show-room-objects').disabled=!siteSource||!roomObjects.size;
  $('#advanced-settings').open=false;
  const photo=$('#scene-photo');
  photo.alt=(packet.scene?.name??'Sahne')+' arka plan görseli';
  photo.onload=()=>{
    $('#scene-viewport').style.aspectRatio=String(photo.naturalWidth/photo.naturalHeight);
    fitStage();renderBackgroundInspector();
  };
  if(!preview)$('#scene-viewport').style.aspectRatio='';
  if(preview)photo.src=backgroundMeta?replacementSource(backgroundMeta.asset,preview):preview;
  else photo.removeAttribute('src');
  photo.hidden=!preview||!showPhoto;
  $('#scene-viewport').classList.toggle('has-photo',Boolean(preview)&&showPhoto);
  $('#visual-edit-mode').disabled=!siteSource&&!packet.genericEditable;
  $('#show-photo').disabled=!preview;
  $('#visual-edit-mode').title='Bağımsız görsel katmanlarını sürükleyerek konumlandır. Efekt hedeflerini ayrıca değiştirebilirsin.';
}
function loadText(text,message,options){
  const next=importProject(text);
  if(!isObjectScene(next))throw new Error('Bu düzenleyici yalnız version 2 objectScene sahnelerini açar; v1 fotoğraf dosyası kabul edilmez.');
  install(next,message,options);
}
function travel(direction){
  if(!scene)return;
  const next=history[direction]({scene,presentation,assets:currentAssetRefs()});
  scene=validateScene(next.scene);
  presentation=validateScenePresentation(next.presentation);
  restoreAssetRefs(next.assets);
  if(!scene.objects.some(o=>o.id===objectId))objectId=scene.objects[0]?.id??null;
  if(!scene.effects.some(e=>e.id===effectId))effectId=scene.effects.find(e=>e.target.objectId===objectId)?.id??null;
  anchorId=scene.objects.find(o=>o.id===objectId)?.anchors[0]?.id??null;
  draw();
  pruneArtworkHistory();
  status(direction==='undo'?'Geri alındı.':'Yinelendi.');
  changed();
}

for(const [type,info]of Object.entries(objectEffectRegistry)){
  $('#add-effect-type').append(el('option',{value:type,text:info.label}));
}
$('#add-effect').onclick=()=>{
  const owner=object(),point=anchor();
  if((siteSource&&owner?.kind!=='artwork')||!owner||!point)return;
  const type=$('#add-effect-type').value;
  mutate(s=>{
    const id=uniqueEffectId(type);
    if(objectEffectRegistry[type].output==='motion'&&!owner.motionLayers?.length)throw Error('Nesnede önce hareketli katman kimliği tanımlayın.');
    s.effects.push({id,type,target:{kind:'sceneObject',objectId:owner.id,anchorId:point.id,...(objectEffectRegistry[type].output==='motion'?{layerId:owner.motionLayers[0]}:{}),offset:{x:0,y:0},scale:1,depth:0},enabled:true,seed:`${type}-${uid().slice(0,8)}`,params:defaultObjectParams(type)});
    effectId=id;
  });
};
async function localImageToWebp(file,selected){
  if(!file||file.size>30*1024*1024||(!/^image\/(png|jpeg|webp)$/.test(file.type)
    && !/\.(png|jpe?g|webp)$/i.test(file.name)))
    throw Error('Yalnız 30 MB altındaki PNG, JPEG veya WebP resimleri seçilebilir.');
  const bitmap=await createImageBitmap(file);
  try{
    if(bitmap.width<1||bitmap.height<1)throw Error('Resmin ölçüleri geçersiz.');
    const fixedBook=/^\/scene-assets\/books\/scene-closed\/(?:evren|topluluk)-master-closed(?:-en)?\.webp$/.test(selected?.path??'');
    if(fixedBook&&Math.abs(bitmap.width/bitmap.height-1.5)>.018)
      throw Error('Kapalı kitap görseli 3:2 oranında olmalı; eski saydam siluet ve tıklama bölgesi aynı kalmalı.');
    if(!fixedBook&&selected?.image&&/^\/scene-assets\/(?:books|camera|vefk)\//.test(selected.path)){
      const reference=new Image();
      reference.src=selected.image;
      await reference.decode();
      const drift=Math.abs((bitmap.width/bitmap.height)/(reference.naturalWidth/reference.naturalHeight)-1);
      if(drift>.1)throw Error('Bu fiziksel görselin en/boy oranı orijinal dosyayla uyumlu olmalı.');
    }
    const factor=Math.min(1,4096/bitmap.width,4096/bitmap.height,
      Math.sqrt(12e6/(bitmap.width*bitmap.height)));
    const canvas=document.createElement('canvas');
    canvas.width=fixedBook?1536:Math.max(1,Math.round(bitmap.width*factor));
    canvas.height=fixedBook?1024:Math.max(1,Math.round(bitmap.height*factor));
    canvas.getContext('2d',{alpha:true}).drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.94));
    canvas.width=canvas.height=0;
    if(!blob||blob.type!=='image/webp'||blob.size>8*1024*1024)
      throw Error('WebP dönüşümü başarısız veya çıktı 8 MB sınırını aşıyor.');
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(Error('Resim okunamadı.'));
      reader.onload=()=>resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }finally{bitmap.close();}
}
if($('#add-artwork')&&$('#new-artwork-file')){
$('#add-artwork').onclick=()=>$('#new-artwork-file').click();
$('#new-artwork-file').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  try{
    const dataUrl=await localImageToWebp(file,null);
    const image=new Image();image.src=dataUrl;await image.decode();
    const id='artwork-'+uid().replaceAll('-','').slice(0,12);
    const asset='/scene-assets/custom/'+id+'.webp';
    const aspect=image.naturalWidth/image.naturalHeight;
    const width=.16,height=round(clamp(width*scene.viewport.width/scene.viewport.height/aspect,.03,.45));
    const name=file.name.replace(/\.[^.]+$/,'').trim().slice(0,80)||'Görsel nesne';
    const item={id,name,kind:'artwork',visible:true,visual:{asset},
      pose:{x:round(.5-width/2),y:round(.5-height/2),width,height,rotation:0,depth:15},
      motionLayers:[],anchors:[{id:'center',x:.5,y:.5}]};
    const beforeAssets=currentAssetRefs();
    previewObjects.set(id,{objectId:id,asset,image:dataUrl,layers:[]});
    setAssetReplacement(asset,dataUrl);
    const ok=mutate(s=>{s.objects.push(item);objectId=id;effectId=null;},'object:create:'+id,beforeAssets);
    if(!ok){previewObjects.delete(id);assetReplacements.delete(asset);return;}
    selectObject(id);setInspectorTab('visual');
    status('Yeni görsel nesne taslağa eklendi. Kaydet → Siteye hazırla.');
  }catch(e){error(e);}
};
}
if($('#visual-layer-file'))$('#visual-layer-file').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';
  const item=object();
  if(!file||item?.kind!=='artwork')return;
  try{
    if((item.visual.layers??[]).length>=8)throw Error('En fazla sekiz katman eklenebilir.');
    const dataUrl=await localImageToWebp(file,null);
    const id='layer-'+uid().replaceAll('-','').slice(0,8);
    const asset='/scene-assets/custom/'+item.id+'-'+id+'.webp';
    const box={x:0,y:0,width:1,height:1};
    const preview=previewObjects.get(item.id);
    if(!preview)throw Error('Görsel önizlemesi bulunamadı.');
    const beforeAssets=currentAssetRefs();
    preview.layers.push({id,asset,box:{...box},image:dataUrl});
    setAssetReplacement(asset,dataUrl);
    const ok=mutate(s=>{
      const target=s.objects.find(o=>o.id===item.id);
      target.visual.layers??=[];
      target.visual.layers.push({id,asset,box});
      target.motionLayers.push(id);
    },'layer:'+item.id+':create',beforeAssets);
    if(!ok){preview.layers.pop();assetReplacements.delete(asset);return;}
    $('#visual-layers-settings').open=true;
    status('Görsel alt katmanı eklendi. Hareket efektleri artık seçilebilir.');
  }catch(e){error(e);}
};
if($('#scene-background-file'))$('#scene-background-file').onchange=async event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  try{
    if(!backgroundMeta)throw Error('Arka plan kaynağı bağlı değil.');
    const bitmap=await createImageBitmap(file);
    try{
      if(bitmap.width!==bitmap.height*2||bitmap.width<1024)
        throw Error('Oda fotoğrafı 2:1 oranında ve en az 1024 piksel genişliğinde olmalı. Nesne koordinatları böyle korunur.');
    }finally{bitmap.close();}
    const dataUrl=await localImageToWebp(file,null);
    const img=new Image();img.src=dataUrl;await img.decode();
    if(img.naturalWidth!==img.naturalHeight*2||img.naturalWidth<1024)
      throw Error('WebP dönüşümü sonrası fotoğrafın 2:1 oranı korunmalı.');
    recordHistory(scene,'asset:'+backgroundMeta.asset+':import');
    setAssetReplacement(backgroundMeta.asset,dataUrl);
    syncBackgroundPhoto();draw();pruneArtworkHistory();changed();
    status('Arka plan görseli taslağa alındı. Kaydet → Yerelde hazırla ile dosya güncellenir.');
  }catch(e){error(e);}
};
$('#visual-source-file').onchange=async event=>{
  const file=event.target.files?.[0],selected=selectedVisualAsset(object());
  event.target.value='';
  if(!file)return;
  try{
    if(!selected)throw Error('Değiştirilebilir bir görsel seçin.');
    const dataUrl=await localImageToWebp(file,selected);
    recordHistory(scene,'asset:'+selected.path+':import');
    setAssetReplacement(selected.path,dataUrl);
    changed();draw();pruneArtworkHistory();
    status('Görsel taslakta değiştirildi. Kaydet → Siteye hazırla ile kaynak dosyaya aktarın.');
  }catch(e){error(e);}
};
$('#object-filter').onchange=event=>{objectFilter=event.target.value;renderLists();};
if($('#object-search')){
  $('#object-search').addEventListener('input',renderLists);
  for(const tab of root.querySelectorAll('[data-inspector-tab]'))tab.addEventListener('click',()=>setInspectorTab(tab.dataset.inspectorTab));
  const toggleSide=(side)=>{root.classList.toggle('scene-'+side+'-collapsed');fitStage();};
  $('#scene-toggle-tree').onclick=()=>toggleSide('tree');
  $('#scene-toggle-inspector').onclick=()=>toggleSide('inspector');
  const menu=$('#scene-context-menu');
  const closeMenu=()=>{menu.hidden=true;menu.replaceChildren();};
  const addMenuAction=(label,action)=>menu.append(el('button',{type:'button',role:'menuitem',text:label,onclick:()=>{closeMenu();action();}}));
  root.addEventListener('contextmenu',event=>{
    if(!event.target.closest('.scene-stage-well, #object-list'))return;
    if(event.target.closest('input,textarea,select'))return;
    event.preventDefault();closeMenu();
    const objectHit=event.target.closest('[data-tree-object],[data-room-object],[data-hit-object],.scene-object');
    const effectHit=event.target.closest('[data-tree-effect],.scene-marker');
    const selectedEffect=effectHit?.dataset.treeEffect??(effectHit?.classList.contains('scene-marker')?effectHit.id.slice('marker-'.length):null);
    const selectedObject=objectHit?.dataset.treeObject??objectHit?.dataset.roomObject??objectHit?.dataset.hitObject??(objectHit?.classList.contains('scene-object')?objectHit.id.slice('stage-object-'.length):null);
    const selected=selectedEffect?scene.effects.find(e=>e.id===selectedEffect):null;
    const owner=selected?scene.objects.find(o=>o.id===selected.target.objectId):scene.objects.find(o=>o.id===selectedObject);
    if(selected){
      addMenuAction('Efekti seç',()=>{selectEffect(selected.id);setInspectorTab('effect');});
      addMenuAction(selected.enabled?'Efekti kapat':'Efekti aç',()=>mutate(s=>{s.effects.find(e=>e.id===selected.id).enabled=!selected.enabled;}));
      addMenuAction('Efekti dene',()=>{selectEffect(selected.id);if(effectTrigger(selected)==='pulse')bindPreview(selected.id);else previewHandle?.triggerEffect(selected.id);});
    }else if(owner){
      addMenuAction(owner.name+' · Özellikler',()=>{selectObject(owner.id);setInspectorTab('visual');});
      if(editableVisual(owner)){
        addMenuAction('Görseli taşı',()=>{selectObject(owner.id);setInspectorTab('visual');if(!visualMode)$('#visual-edit-mode').click();});
        if(owner.hitArea)addMenuAction('Tıklama alanını düzenle',()=>{selectObject(owner.id);setInspectorTab('visual');$('#hit-area-settings').open=true;});
        if(visualAssetSlots(owner).length)addMenuAction('Kaynak görsel',()=>{selectObject(owner.id);setInspectorTab('visual');$('#visual-source-settings').open=true;});
      }
      if(owner.kind==='artwork'){
        addMenuAction('Nesneyi çoğalt',()=>duplicateArtwork(owner));
        addMenuAction('Nesneyi sil',()=>{
          selectObject(owner.id);
          $('#delete-artwork')?.click();
        });
      }
      if(!siteSource||owner.kind==='artwork')
        addMenuAction(owner.visible?'Nesneyi gizle':'Nesneyi göster',
          ()=>mutate(s=>{s.objects.find(o=>o.id===owner.id).visible=!owner.visible;}));
    }else{
      addMenuAction('Sahneye sığdır',()=>setZoom(1));
      addMenuAction('Efekt hedeflerini göster/gizle',()=>$('#show-markers').click());
      addMenuAction('Tıklama alanlarını göster/gizle',()=>$('#show-hit-areas').click());
    }
    const bounds=root.getBoundingClientRect();
    menu.hidden=false;
    const left=Math.min(event.clientX-bounds.left,Math.max(0,bounds.width-menu.offsetWidth-8));
    const top=Math.min(event.clientY-bounds.top,Math.max(0,bounds.height-menu.offsetHeight-8));
    Object.assign(menu.style,{left:left+'px',top:top+'px'});
    menu.querySelector('button')?.focus({preventScroll:true});
  });
  root.addEventListener('pointerdown',event=>{if(!menu.hidden&&!menu.contains(event.target))closeMenu();});
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();closeMenu();}});
}

const panelTabs=[...root.querySelectorAll('[data-mobile-panel]')];
for(const tab of panelTabs){
  tab.onclick=()=>{
    surface.dataset.panel=tab.dataset.mobilePanel;
    for(const item of panelTabs){item.setAttribute('aria-selected',String(item===tab));item.tabIndex=item===tab?0:-1;}
  };
  tab.onkeydown=event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=panelTabs[event.key==='Home'?0:event.key==='End'?panelTabs.length-1:(panelTabs.indexOf(tab)+1)%panelTabs.length];
    next.click();next.focus();
  };
}
$('#scene-name').onchange=event=>mutate(s=>{s.name=event.target.value;});
$('#scene-seed').onchange=event=>mutate(s=>{s.seed=event.target.value;});
$('#undo').onclick=()=>travel('undo');
$('#redo').onclick=()=>travel('redo');
$('#play').onclick=()=>{
  playing=!playing;
  previewHandle?.setPaused(!playing);
  $('#play').textContent=playing?'Ⅱ Duraklat':'▶ Oynat';
  $('#play').setAttribute('aria-pressed',String(playing));
  status(playing?'Önizleme oynatılıyor.':'Önizleme duraklatıldı; sahne değişiklikleri yine doğrulanır.');
};
if($('#open-background'))$('#open-background').onclick=()=>{
  setInspectorTab('background');
  if(root.classList.contains('scene-inspector-collapsed')){
    root.classList.remove('scene-inspector-collapsed');
    fitStage();
  }
};
$('#show-photo').onclick=()=>{
  showPhoto=!showPhoto;
  $('#scene-photo').hidden=!showPhoto;
  $('#scene-viewport').classList.toggle('has-photo',showPhoto);
  $('#show-photo').setAttribute('aria-pressed',String(showPhoto));
};
$('#show-room-objects').onclick=()=>{
  showRoomObjects=!showRoomObjects;
  $('#show-room-objects').setAttribute('aria-pressed',String(showRoomObjects));
  renderRoomObjects();
};
$('#show-object-areas').onclick=()=>{
  const hidden=$('#scene-viewport').classList.toggle('hide-object-areas');
  $('#show-object-areas').setAttribute('aria-pressed',String(!hidden));
};
$('#show-hit-areas').onclick=()=>{
  const hidden=$('#scene-viewport').classList.toggle('hide-hit-areas');
  $('#show-hit-areas').setAttribute('aria-pressed',String(!hidden));
};
$('#show-effects').onclick=()=>{
  showEffects=!showEffects;previewHandle?.setEnabled(showEffects);
  $('#show-effects').setAttribute('aria-pressed',String(showEffects));
};
$('#show-markers').onclick=()=>{
  const hidden=$('#scene-viewport').classList.toggle('hide-effect-markers');
  $('#show-markers').setAttribute('aria-pressed',String(!hidden));
};
$('#visual-edit-mode').onclick=()=>{
  visualMode=!visualMode;
  $('#scene-viewport').classList.toggle('visual-edit-mode',visualMode);
  $('#visual-edit-mode').setAttribute('aria-pressed',String(visualMode));
};
function setZoom(value){
  zoom=clamp(value,.5,3);
  $('#zoom-fit').textContent=Math.round(zoom*100)+'%';
  $('#zoom-out').disabled=zoom<=.5;
  $('#zoom-in').disabled=zoom>=3;
  fitStage();
}
$('#zoom-out').onclick=()=>setZoom(round(zoom-.25));
$('#zoom-in').onclick=()=>setZoom(round(zoom+.25));
$('#zoom-fit').onclick=()=>setZoom(1);
root.querySelector('.scene-stage-well').addEventListener('wheel',event=>{
  if(!(event.ctrlKey||event.metaKey))return;
  event.preventDefault();setZoom(round(zoom+(event.deltaY<0?.25:-.25)));
},{passive:false});
function fitStage(){
  const well=root.querySelector('.scene-stage-well');
  const photo=$('#scene-photo'),frame=$('#scene-screen-preview');
  const ratio=backgroundMeta?.aspect??(!photo.hidden&&photo.naturalWidth
    ?photo.naturalWidth/photo.naturalHeight:(scene?.viewport.width??1600)/(scene?.viewport.height??900));
  const simulation=Boolean(backgroundMeta&&screenPreset!=='room');
  const geometry=simulation?roomFrameGeometry(screenWidth,screenHeight,ratio)
    :roomFrameGeometry(ratio*1000,1000,ratio);
  const widthAvailable=Math.max(1,well.clientWidth-12),heightAvailable=Math.max(1,well.clientHeight-12);
  const scale=Math.min(widthAvailable/geometry.screen.width,
    heightAvailable/geometry.screen.height)*zoom;
  const screenW=geometry.screen.width*scale,screenH=geometry.screen.height*scale;
  const width=geometry.room.width*scale,height=geometry.room.height*scale;
  if(frame){
    Object.assign(frame.style,{width:screenW+'px',height:screenH+'px'});
    frame.dataset.simulated=String(simulation);
  }
  Object.assign($('#scene-viewport').style,{width:width+'px',height:height+'px'});
}
const stageResizeObserver=new ResizeObserver(fitStage);stageResizeObserver.observe(root.querySelector('.scene-stage-well'));
disposers.push(()=>stageResizeObserver.disconnect());
if(standalone){
$('#export').onclick=()=>{
  try{
    if(!scene)throw new Error('Önce sahne yükleyin.');
    const text=exportProject(validateScene(scene));
    if(new TextEncoder().encode(text).length>MAX_FILE_BYTES)throw new Error('Dışa aktarım 25 MB sınırını aşıyor.');
    download(text,'birdesengor-study-v2.scene.json');
    status('V2 JSON indirildi.');
  }catch(e){error(e);}
};
$('#open-project').onclick=()=>$('#project-file').click();
$('#project-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>MAX_FILE_BYTES)throw new Error('Dosya 25 MB sınırını aşıyor.');
    loadText(await readFile(file),'V2 proje açıldı.');
  }catch(e){error(e);}finally{event.target.value='';}
};
$('#reset').onclick=async()=>{
  try{
    const response=await fetch('/examples/birdesengor-v2.scene.json');
    if(!response.ok)throw new Error('Yerel V2 fikstürü okunamadı.');
    loadText(await response.text(),'Yerel V2 fikstürü yüklendi.');
  }catch(e){error(e);}
};
}
const onEditorKeydown=event=>{
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z'||event.target.matches('input,select,textarea'))return;
  event.preventDefault();travel(event.shiftKey?'redo':'undo');
};
document.addEventListener('keydown',onEditorKeydown);disposers.push(()=>document.removeEventListener('keydown',onEditorKeydown));
const statusInterval=setInterval(()=>{
  const info=previewHandle?.inspect();
  const overlays=info?.overlays??[];
  const running=overlays.some(item=>item.running);
  const frames=overlays.reduce((sum,item)=>sum+item.frames,0);
  const pixels=overlays.reduce((sum,item)=>sum+item.pixelCount,0);
  $('#preview-status').textContent=!scene?'Sahne yok':info?.unresolved?.length?`Eksik nesne: ${info.unresolved.join(', ')}`:`${running?'Çalışıyor':'Duraklatıldı'} · ${frames} kare · ${Math.round(pixels/1000)}k piksel`;
},600);disposers.push(()=>clearInterval(statusInterval));

// Small read-only surface for local browser smoke tests; never part of the JSON.
const sceneSnapshot=()=>{
  validateScene(scene);
  return {scene:structuredClone(scene),
    assets:currentAssetRefs().map(([path,version])=>({path,dataUrl:assetPayloads.get(version)})),
    presentation:structuredClone(presentation)};
};
window.__sceneEditor={
  getScene:()=>scene?structuredClone(scene):null,
  snapshot:sceneSnapshot,
  inspect:()=>previewHandle?.inspect()??null,
  selectObject,
  selectEffect,
  zoom:()=>zoom,
};

return {
  load(packet){
    const next=importProject(JSON.stringify(packet.scene));
    if(!isObjectScene(next))throw Error('Bu düzenleyici yalnız V2 sahnelerini açar.');
    installPreview(packet);
    loadText(JSON.stringify(packet.scene),'Sahne hazır.',{resetHistory:true});
  },
  snapshot(){
    validateScene(scene);
    const assets=currentAssetRefs().map(([path,version])=>({path,dataUrl:assetPayloads.get(version)}));
    return {scene:structuredClone(scene),assets,presentation:structuredClone(presentation)};
  },
  destroy(){
    previewHandle?.destroy();previewHandle=null;
    if(previewFrame)cancelAnimationFrame(previewFrame);
    window.removeEventListener('pointermove',moveDrag);window.removeEventListener('pointerup',endDrag);window.removeEventListener('pointercancel',endDrag);
    window.removeEventListener('pointermove',moveVisualDrag);window.removeEventListener('pointerup',endVisualDrag);window.removeEventListener('pointercancel',endVisualDrag);
    window.removeEventListener('pointermove',moveHitDrag);window.removeEventListener('pointerup',endHitDrag);window.removeEventListener('pointercancel',endHitDrag);
    for(const dispose of disposers)dispose();
    if(window.__sceneEditor?.getScene)delete window.__sceneEditor;
  },
};
}
