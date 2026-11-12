import {$,el,button,field,download,readFile} from './dom.mjs';
import {sceneProfiles,profileForEffect,applySceneProfile,basicControls,assertSiteStructure} from './scene-ux.mjs';
import {History} from './history.mjs';
import {validateProject,importProject,exportProject,MAX_FILE_BYTES} from '../model/project.mjs';
import {objectEffectRegistry,defaultObjectParams,effectTrigger,allowedEffectTriggers} from '../registry/effects.mjs';
import {anchorScenePoint,effectScenePoint} from '../runtime/object-scene.mjs';
import {bindObjectScene} from '../runtime/object-overlay.mjs';
import {drawRefractedSilhouette} from '../runtime/robe-refraction.mjs';
import {canCropVisual,visualClipStyle,EMPTY_CROP,DEFAULT_ROBE_DESK_Y} from '../model/visual-crop.mjs';
import {defaultScenePresentation,validateScenePresentation,FOCUS_OBJECT_IDS,BOOK_OBJECT_IDS,PHYSICAL_DEVICE_IDS} from '../model/scene-presentation.mjs';

let scene=null,objectId=null,effectId=null,anchorId=null,playing=true;
let presentation=defaultScenePresentation(),presentationDevice='desktop';
let focusTargets=new Map(),focusPreview=false,roomObjects=new Map(),showRoomObjects=true;
let previewHandle=null,previewFrame=null;
let previewObjects=new Map(),assetReplacements=new Map(),assetChoices=new Map(),artworkSlots=new Map();
let siteSource=false,sourceScene=null,showPhoto=true,showEffects=true,objectFilter='all';
let zoom=1,visualMode=false,linkVisual=true,previewRobeVeiled=false;
const editableVisual=item=>siteSource&&canCropVisual(item);
const visualBase=item=>sourceScene?.objects.find(entry=>entry.id===item?.id)?.pose??item.pose;
const replacementSource=(asset,original)=>assetReplacements.get(asset)?.dataUrl??original;
function visualAssetSlots(item){
  const artwork=previewObjects.get(item?.id);
  const detached=artwork
    ?[{path:artwork.asset,label:'Temel görsel',image:artwork.image,warning:''},
      ...(artwork.layers??[]).map(layer=>({
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

const objectElements=new Map(),markerElements=new Map();
const history=new History();
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
const notify=(type,extra={})=>{if(embedded)window.parent.postMessage({type,...extra},'*');};
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
  draw();
}
function selectEffect(id){
  const next=scene.effects.find(item=>item.id===id);
  if(!next)return;
  effectId=next.id;objectId=next.target.objectId;anchorId=next.target.anchorId;
  draw();
}
function selectForDrag(next){
  effectId=next.id;objectId=next.target.objectId;anchorId=next.target.anchorId;
  renderLists();renderObjectInspector();renderEffectInspector();renderStageSelection();
}
function recordHistory(before,key=null){history.record({scene:before,presentation},key);}
function mutatePresentation(action,key=null){
  if(!siteSource||!presentation)return false;
  try{
    const next=structuredClone(presentation);
    action(next);validateScenePresentation(next);
    recordHistory(scene,key);presentation=next;draw();
    status('Odak görünümü güncellendi; ayarlar taslakta.');changed();return true;
  }catch(e){error(e);draw();return false;}
}
function mutate(action,key=null){
  if(!scene)return false;
  try{
    const next=structuredClone(scene);
    action(next);
    validateScene(next);
    recordHistory(scene,key);
    scene=next;
    draw();
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
  $('#effect-count').textContent=String(effects.length);
  $('#selected-object-name').textContent=object()?.name??'Bir nesne seçin';
  const effectRows=effects.map(item=>el('div',{class:`scene-list-row ${item.id===effectId?'selected':''}`},
    button(objectEffectRegistry[item.type].label,()=>selectEffect(item.id),{id:`effect-select-${item.id}`,class:'scene-row-select','aria-pressed':String(item.id===effectId)}),
    el('label',{class:'scene-row-check',title:`${objectEffectRegistry[item.type].label} etkin`},
      el('input',{type:'checkbox',id:`effect-list-enabled-${item.id}`,checked:item.enabled,'aria-label':`${objectEffectRegistry[item.type].label} etkin`,onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).enabled=event.target.checked;})}))
  ));
  $('#effect-list').replaceChildren(...(effectRows.length?effectRows:[el('p',{class:'scene-empty',text:siteSource?'Bu nesneye bağlı site efekti yok.':'Bu nesnede efekt yok; desteklenen bir tür ekleyin.'})]));
  $('#add-effect-controls').hidden=siteSource;
  $('#add-effect').disabled=!object()?.anchors.length;
  $('#source-note').textContent=siteSource?'Taş, kaftan, hançer ve sandık katmanları taşınabilir. Kitap, kamera ve Çizim Atölyesi görselleri Kaynak görsel alanından değiştirilebilir; oda fotoğrafı sabit kalır.':'Yerel sahne: görünürlük ve yerleşim İnce ayarlar bölümündedir.';
  $('#site-effects-note').hidden=!siteSource;
  document.querySelector('.scene-local-badge').textContent=siteSource?'Site kaynağı':'Yerel';
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
  host.append(el('p',{class:'scene-visual-tip',text:'Görsel Taşı modunda fareyle sürükle; ok tuşları 0,1%, Shift+ok 1% hareket ettirir.'}));
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
  host.append(el('p',{class:'scene-visual-tip',text:'Bu ayarlar ziyaretçi hareketini yönetir; efekt ve içerik verilerinden ayrıdır.'}));
  host.append(field('Cihaz görünümü',el('select',{
    id:'presentation-device','aria-label':'Sunum cihaz görünümü',
    onchange:event=>{presentationDevice=event.target.value;renderPresentationInspector();}
  },...[['desktop','Masaüstü'],['mobile','Mobil']].map(([value,label])=>
    el('option',{value,text:label,selected:value===presentationDevice})))));
  for(const [key,label] of [
    ['focusMs','Yaklaşma süresi (ms)'],['returnMs','Odaya dönüş (ms)'],
    ['detailMs',id==='camera'?'LCD açılışı (ms)':id==='vefk-stand'?'Katalog geçişi (ms)':'Kapak açılışı (ms)']
  ])host.append(numberInput(label,profile[key],value=>set(key,value),
    {id:'presentation-'+key,min:key==='detailMs'?100:300,max:key==='detailMs'?2000:1800,step:20}));
  host.append(el('p',{class:'scene-visual-tip',text:'Oda yaklaşması ve öne çıkan nesne ayrı katmanlardır. Yakınlık ölçeği gerçek kamera / kitap / çizim yüzeyine uygulanır.'}));
  for(const [key,label,min,max] of [
    ['roomZoom','Oda yakınlığı (%)',75,160],['nearZoom','Nesne yakınlığı (%)',70,140]
  ])host.append(numberInput(label,round(view[key]*100),value=>set(key,round(value/100),presentationDevice),
    {id:'presentation-'+key,min,max,step:1}));
  for(const [key,label] of [
    ['roomShiftX','Oda kaydırma X (%)'],['roomShiftY','Oda kaydırma Y (%)'],
    ['nearShiftX','Nesne kaydırma X (%)'],['nearShiftY','Nesne kaydırma Y (%)']
  ])host.append(numberInput(label,view[key],value=>set(key,round(value),presentationDevice),
    {id:'presentation-'+key,min:-15,max:15,step:.1}));
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
    host.append(el('p',{class:'scene-visual-tip',text:'Kapak derinliği 3B izdüşümü, sayfa oranı gerçek Grabfold ölçülerini değiştirir. Kitap, ayraç ve indeksleri webin yakın görünümünde kontrol etmek gerekir.'}));
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
      host.append(el('p',{class:'scene-visual-tip',text:'Menteşe ve LCD yerleşimi ortak hesaplanır. Arşiv panelinin genişliği yalnız masaüstündeki yan yana görünümü etkiler.'}));
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
      host.append(el('p',{class:'scene-visual-tip',text:'Parşömen, çizim ve okuma yüzeyi aynı dönüşümü kullanır. Divitin dinlenme ucu mürekkep kabını, maske ise katalog çerçevesini izler.'}));
    }
  }
  host.append(el('div',{class:'scene-visual-actions'},
    button(focusPreview?'2B önizlemeyi kapat':'2B oda yaklaşmasını göster',()=>{
      focusPreview=!focusPreview;draw();
    },{id:'presentation-preview',disabled:!focusTargets.has(id),'aria-pressed':String(focusPreview)})));
  host.append(el('p',{class:'scene-visual-tip',text:'Bu yalnız oda fotoğrafının 2B kadraj denemesidir; kitap, LCD ve parşömen gerçek açılma önizlemesi değildir.'}));
  host.append(el('div',{class:'scene-visual-actions'},
    button('Bu nesneyi sıfırla',()=>mutatePresentation(s=>{
      s.objects[id]=structuredClone(defaultScenePresentation().objects[id]);
    },'presentation:'+id+':reset'),{id:'presentation-reset'})));
  host.append(el('p',{class:'scene-visual-tip',text:'Masaüstü ve mobil bağımsız kaydedilir. Azaltılmış hareket seçimi bu süreleri kullanmaz; açılma/geri dönüş güvenli kalır.'}));
}
function renderSourceInspector(){
  const item=object(),parent=$('#visual-source-settings'),host=$('#visual-source-inspector');
  parent.hidden=!siteSource||!visualAssetSlots(item).length;
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
  if(['archive-chest','ceremonial-dagger'].includes(item.id))host.append(el('p',{class:'scene-visual-tip',
    text:'Bu nesnede efekt için ayrı bir maske dosyası var. Yeni resim farklı şekilli ise mevcut efekt maskesi ayrıca güncellenmelidir.'}));
  const modified=assetReplacements.has(chosen.path);
  host.append(el('p',{class:'scene-visual-tip',text:modified
    ?'Yeni kaynak taslakta · Kaydet ve Siteye hazırla işlemleriyle yerel kaynak değişecek.'
    :'Orijinal dosya kullanılıyor. PNG/JPEG/WebP seçimi şeffaf WebP kaynağına dönüştürülür.'}));
  host.append(el('div',{class:'scene-visual-actions'},
    button('Resim seç…',()=>$('#visual-source-file').click(),{id:'visual-source-import'}),
    button('Taslak değişimini kaldır',()=>{
      if(assetReplacements.delete(chosen.path)){changed();draw();status('Kaynak değişikliği taslaktan kaldırıldı. Webdeki mevcut dosya korunur.');}
    },{id:'visual-source-restore',disabled:!modified})));
}
function renderCropInspector(){
  const item=object(),parent=$('#visual-crop-settings'),host=$('#visual-crop-inspector');
  parent.hidden=!editableVisual(item);host.replaceChildren();
  if(parent.hidden)return;
  const defaultDesk=item.id==='ceremonial-robe'?DEFAULT_ROBE_DESK_Y:null;
  const crop=item.crop??{...EMPTY_CROP,deskY:defaultDesk};
  const update=(key,value)=>mutate(s=>{
    const target=s.objects.find(o=>o.id===item.id);
    target.crop={...EMPTY_CROP,deskY:defaultDesk,...target.crop,[key]:value};
  },'crop:'+item.id+':'+key);
  host.append(el('p',{class:'scene-visual-tip',text:'Kaynak fotoğrafı değiştirmeden görünür kenarları kırpar. Masa çizgisi seçiliyse nesne taşınırken örtülen alan otomatik güncellenir.'}));
  for(const [key,label] of [['top','Üstten'],['right','Sağdan'],['bottom','Alttan'],['left','Soldan']]){
    host.append(numberInput(label+' (%)',Math.round(crop[key]*1000)/10,
      value=>update(key,round(value/100)),{id:'visual-crop-'+key,min:0,max:95,step:.5}));
  }
  host.append(checkField('Masanın arkasını gizle',crop.deskY!==null,
    checked=>update('deskY',checked?(defaultDesk??.57):null),{id:'visual-crop-desk-enabled'}));
  if(crop.deskY!==null)host.append(numberInput('Masa sınırı · sahne Y (%)',
    round(crop.deskY*100),value=>update('deskY',round(value/100)),
    {id:'visual-crop-desk-y',min:0,max:100,step:.5}));
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
function renderObjectInspector(){
  const host=$('#object-inspector'),hitHost=$('#hit-inspector'),item=object();
  host.replaceChildren(el('h3',{text:'Nesne ve bağlantı'}));
  hitHost.replaceChildren();
  $('#hit-area-settings').hidden=!item?.hitArea;
  if(!item)return;
  if(item.hitArea){
    hitHost.append(el('p',{class:'scene-help',text:'Alan çerçevesinin kenarından sürükleyin; yuvarlak turuncu nokta yalnız efekt hedefini taşır. Genişliği ve yüksekliği aşağıdan ayarlayın.'}));
    for(const [key,label] of [['x','Sol X %'],['y','Üst Y %'],['width','Genişlik %'],['height','Yükseklik %']]){
      hitHost.append(numberInput(label,round(item.hitArea[key]*100),value=>mutate(s=>{
        const area=s.objects.find(entry=>entry.id===item.id).hitArea;
        area[key]=round(value/100);
      },'hit:'+item.id+':'+key),{min:key==='x'||key==='y'?0:.1,max:100,step:.1,'data-testid':'scene-hit-'+key}));
    }
  }
  if(siteSource){
    host.append(el('p',{class:'scene-help',text:'Bağımsız taş ve kaftan görselleri üstteki yerleşim alanından taşınabilir. Bağlantılar sabit kalır.'}));
    return;
  }
  host.append(
    field('Nesne adı',el('input',{value:item.name,maxlength:160,onchange:event=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).name=event.target.value;},`object:${item.id}:name`)})),
    checkField('Görünür',item.visible,value=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).visible=value;},`object:${item.id}:visible`))
  );
  for(const [key,label,min,max,step] of [['x','X',0,1,.001],['y','Y',0,1,.001],['width','Genişlik',.001,1,.001],['height','Yükseklik',.001,1,.001],['rotation','Dönüş (derece)',-360,360,1],['depth','Derinlik',-100,100,1]]){
    host.append(numberInput(label,item.pose[key],value=>mutate(s=>{s.objects.find(entry=>entry.id===item.id).pose[key]=value;},`object:${item.id}:${key}`),{min,max,step}));
  }
  if(!siteSource)host.append(field('Hareketli katman kimlikleri',el('input',{value:(item.motionLayers??[]).join(','),'aria-label':'Hareketli katman kimlikleri',onchange:event=>mutate(s=>{s.objects.find(o=>o.id===item.id).motionLayers=event.target.value.split(',').map(v=>v.trim()).filter(Boolean);})})));
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
  if(!item){host.append(el('p',{class:'scene-empty',text:siteSource?'Bu nesnenin siteye bağlı efekti bulunmuyor. Bu kaynakta yeni efekt ekleme desteklenmiyor.':'Bir efekt seçin veya ekleyin.'}));return;}
  const info=objectEffectRegistry[item.type];
  host.append(el('p',{class:'scene-effect-title',text:info.label}),
    checkField('Etkin',item.enabled,value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).enabled=value;},`effect:${item.id}:enabled`),{id:'effect-enabled'}),
    el('p',{class:'scene-help',text:info.description}),
    el('div',{class:'scene-section-title'},el('h3',{text:'Parametre profili'}),el('span',{id:'effect-profile',class:'scene-profile-state',text:profileForEffect(item)})),
    el('div',{class:'scene-profiles'},...sceneProfiles.map(profile=>button(profile.label,()=>mutate(s=>applySceneProfile(s.effects.find(entry=>entry.id===item.id),profile.key)),{id:`profile-${profile.key}`,'aria-pressed':String(profileForEffect(item)===profile.label)})))
  );
  const selectedTrigger=effectTrigger(item);
  const availableTriggers=allowedEffectTriggers(item.type);
  const labels={ambient:'Sürekli',click:'OnClick · Tıklama',hover:'OnHover · Üzerine gelme'};
  host.append(field('Tetikleme',el('select',{
    id:'effect-trigger','aria-label':'Tetikleme',disabled:availableTriggers.length===1,
    onchange:event=>mutate(s=>{
      const target=s.effects.find(entry=>entry.id===item.id);
      target.trigger=event.target.value;
      if(event.target.value==='ambient')delete target.interaction;
    }),
  },...availableTriggers.map(trigger=>el('option',{value:trigger,text:labels[trigger],selected:trigger===selectedTrigger})))));
  if(['hover','click'].includes(selectedTrigger)&&item.type==='glow'){
    host.append(el('p',{class:'scene-help',text:selectedTrigger==='hover'
      ?'Nesneye gelince 0→1, ayrılınca bulunduğu noktadan 1→0. Klavye odağı da çalışır.'
      :'Tıklanınca 0→1→0; mevcut nesne tıklamasını engellemez.'}));
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
  if(info.trigger==='pulse')host.append(el('p',{class:'scene-help',text:'Tıklayınca · kısa süreli efekt'}),button('Efekti dene',()=>bindPreview(item.id),{id:'preview-pulse',disabled:!item.enabled}));
  if(item.type==='glow'&&selectedTrigger==='click')host.append(button('Efekti dene',()=>previewHandle?.triggerEffect(item.id),{id:'preview-interaction-click',disabled:!item.enabled}));
  if(item.type==='glow'&&selectedTrigger==='hover')host.append(el('p',{class:'scene-help',text:'Önizleme: Görselde nesneye gelin ve ayrılın.'}));
  if(!item.enabled)host.append(el('p',{class:'scene-help',text:'Efekt kapalı. Önizlemede görmek için Etkin seçeneğini açın.'}));
  if(!siteSource){
    advanced.append(field('Tür',el('select',{'aria-label':'Efekt türü',onchange:event=>mutate(s=>{const target=s.effects.find(entry=>entry.id===item.id);target.type=event.target.value;target.params=defaultObjectParams(target.type);if(objectEffectRegistry[target.type].output==='motion'){target.target.layerId=object().motionLayers?.[0];}else delete target.target.layerId;})},
      ...Object.entries(objectEffectRegistry).map(([type,entry])=>el('option',{value:type,text:entry.label,selected:type===item.type})))),
      field('Hedef bağlantı',el('select',{'aria-label':'Efekt hedef bağlantısı',onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target.anchorId=event.target.value;})},
      ...object().anchors.map(entry=>el('option',{value:entry.id,text:entry.id,selected:entry.id===item.target.anchorId})))));
  }
  if(info.output==='motion')advanced.append(field('Hareketli katman',el('select',{'aria-label':'Hareketli katman',disabled:Boolean(siteSource),onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target.layerId=event.target.value;})},...object().motionLayers.map(id=>el('option',{value:id,text:id,selected:id===item.target.layerId})))));
  advanced.append(el('p',{class:'scene-help',text:`Hedef: ${object().name} → ${item.target.anchorId}. Kaydırma nesne boyutuna göredir; profiller hizalamayı değiştirmez.`}));
  for(const [key,label,min,max,step] of [['x','Kaydırma X',-5,5,.01],['y','Kaydırma Y',-5,5,.01]])advanced.append(numberInput(label,item.target.offset[key],value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target.offset[key]=value;}),{id:`effect-offset-${key}`,min,max,step}));
  for(const [key,label,min,max,step] of [['scale','Ölçek',.01,10,.01],['depth','Efekt derinliği',-100,100,1]])advanced.append(numberInput(label,item.target[key],value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).target[key]=value;}),{min,max,step}));
  advanced.append(field('Efekt tohumu',el('input',{value:item.seed,maxlength:120,onchange:event=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).seed=event.target.value;})})));
  for(const control of info.controls)advanced.append(numberInput(control.label,item.params[control.key],value=>mutate(s=>{s.effects.find(entry=>entry.id===item.id).params[control.key]=value;}),{min:control.min,max:control.max,step:control.step,'aria-label':control.label}));
  if(!siteSource)advanced.append(el('div',{class:'scene-button-row'},
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
  if(item.id==='ceremonial-robe')Object.assign(node.style,visualClipStyle(item,DEFAULT_ROBE_DESK_Y));
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
    Object.assign(fixed.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',filter:'brightness(.72) saturate(.72)',...(item.id==='archive-chest'?{width:'150%',zIndex:'1',...visualClipStyle(item)}:{})});node.append(fixed);
  }
  for(const id of item.motionLayers??[]){
    const layer=el('span',{'data-effect-layer':id,'aria-hidden':'true'});
    Object.assign(layer.style,{position:'absolute',inset:0,width:item.id==='archive-chest'?'150%':'100%',
      height:'100%',pointerEvents:'none',...(item.id==='archive-chest'?{zIndex:'3',transformStyle:'preserve-3d'}:{}),...(item.id==='ceremonial-robe'?{}:visualClipStyle(item))});
    const picture=artwork?.layers.find(entry=>entry.id===id);
    if(picture){const image=el('img',{src:replacementSource(picture.asset,picture.image),alt:''});const b=picture.box;Object.assign(image.style,{position:'absolute',left:`${b.x*100}%`,top:`${b.y*100}%`,width:`${b.width*100}%`,height:`${b.height*100}%`,filter:'brightness(.7) saturate(.7)'});layer.append(image);}
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
    const node=el('button',{type:'button',class:'scene-room-figure scene-room-figure--'+record.kind,
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
  const scrolls=[...document.querySelectorAll('.scene-panel')].map(node=>[node,node.scrollTop]);
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
  renderVeilInspector();
  renderEffectInspector();
  renderStage();
  applyFocusPreview();
  updateHistoryButtons();
  if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
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
  assetReplacements=new Map();assetChoices=new Map();
  artworkSlots=new Map();
  const approvedSources=new Set([...previewObjects].filter(([id])=>canCropVisual(
    packet.scene.objects.find(o=>o.id===id))).flatMap(([,art])=>[
      art.asset,...art.layers.map(layer=>layer.asset)
    ]));
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
    assetReplacements.set(replacement.path,replacement);
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
  if(packet.roomObjects!==undefined&&roomObjects.size!==4)
    throw Error('Oda önizlemesi dört ana nesneyi içermeli.');
  $('#show-room-objects').disabled=!siteSource||!roomObjects.size;
  $('#advanced-settings').open=false;
  const photo=$('#scene-photo');
  photo.onload=()=>{$('#scene-viewport').style.aspectRatio=String(photo.naturalWidth/photo.naturalHeight);fitStage();};
  if(!preview)$('#scene-viewport').style.aspectRatio='';
  if(preview)photo.src=preview;else photo.removeAttribute('src');
  photo.hidden=!preview||!showPhoto;
  $('#scene-viewport').classList.toggle('has-photo',Boolean(preview)&&showPhoto);
  $('#visual-edit-mode').disabled=!siteSource;
  $('#show-photo').disabled=!preview;
  $('#coordinate-help').textContent=siteSource?'Görsel Taşı: bağımsız taş, kaftan, hançer ve sandık katmanlarını yerleştir. Yakınlaştırma yalnız önizlemeyi büyütür.':'Yerel önizleme; yakınlaştırma kaynak pozisyonlarını değiştirmez.';
}
function loadText(text,message,options){
  const next=importProject(text);
  if(!isObjectScene(next))throw new Error('Bu düzenleyici yalnız version 2 objectScene sahnelerini açar; v1 fotoğraf dosyası kabul edilmez.');
  install(next,message,options);
}
function travel(direction){
  if(!scene)return;
  const next=history[direction]({scene,presentation});
  scene=validateScene(next.scene);
  presentation=validateScenePresentation(next.presentation);
  draw();
  status(direction==='undo'?'Geri alındı.':'Yinelendi.');
  changed();
}

for(const [type,info]of Object.entries(objectEffectRegistry)){
  $('#add-effect-type').append(el('option',{value:type,text:info.label}));
}
$('#add-effect').onclick=()=>{
  const owner=object(),point=anchor();
  if(siteSource||!owner||!point)return;
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
$('#visual-source-file').onchange=async event=>{
  const file=event.target.files?.[0],selected=selectedVisualAsset(object());
  event.target.value='';
  if(!file)return;
  try{
    if(!siteSource||!selected)throw Error('Değiştirilebilir bir görsel seçin.');
    const dataUrl=await localImageToWebp(file,selected);
    assetReplacements.set(selected.path,{path:selected.path,dataUrl});
    changed();draw();
    status('Görsel taslakta değiştirildi. Kaydet → Siteye hazırla ile kaynak dosyaya aktarın.');
  }catch(e){error(e);}
};
$('#object-filter').onchange=event=>{objectFilter=event.target.value;renderLists();};
const panelTabs=[...document.querySelectorAll('[data-mobile-panel]')];
for(const tab of panelTabs){
  tab.onclick=()=>{
    document.body.dataset.panel=tab.dataset.mobilePanel;
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
document.querySelector('.scene-stage-well').addEventListener('wheel',event=>{
  if(!(event.ctrlKey||event.metaKey))return;
  event.preventDefault();setZoom(round(zoom+(event.deltaY<0?.25:-.25)));
},{passive:false});
function fitStage(){
  const well=document.querySelector('.scene-stage-well');
  const photo=$('#scene-photo');
  const ratio=!photo.hidden&&photo.naturalWidth?photo.naturalWidth/photo.naturalHeight:(scene?.viewport.width??1600)/(scene?.viewport.height??900);
  const width=Math.min(well.clientWidth,well.clientHeight*ratio)*zoom;
  Object.assign($('#scene-viewport').style,{width:`${width}px`,height:`${width/ratio}px`});
}
new ResizeObserver(fitStage).observe(document.querySelector('.scene-stage-well'));
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
    const response=await fetch('examples/birdesengor-v2.scene.json');
    if(!response.ok)throw new Error('Yerel V2 fikstürü okunamadı.');
    loadText(await response.text(),'Yerel V2 fikstürü yüklendi.');
  }catch(e){error(e);}
};
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z'||event.target.matches('input,select,textarea'))return;
  event.preventDefault();travel(event.shiftKey?'redo':'undo');
});
setInterval(()=>{
  const info=previewHandle?.inspect();
  const overlays=info?.overlays??[];
  const running=overlays.some(item=>item.running);
  const frames=overlays.reduce((sum,item)=>sum+item.frames,0);
  const pixels=overlays.reduce((sum,item)=>sum+item.pixelCount,0);
  $('#preview-status').textContent=!scene?'Sahne yok':info?.unresolved?.length?`Eksik nesne: ${info.unresolved.join(', ')}`:`${running?'Çalışıyor':'Duraklatıldı'} · ${frames} kare · ${Math.round(pixels/1000)}k piksel`;
},600);

if(embedded){
  document.body.classList.add('embedded');
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||!event.data||typeof event.data!=='object')return;
    if(event.data.type==='studio:hello'){notify('studio:ready');return;}
    if(event.data.type==='studio:load'){
      try{
        const next=importProject(JSON.stringify(event.data.scene));
        if(!isObjectScene(next))throw new Error('Bu düzenleyici yalnız version 2 objectScene sahnelerini açar.');
        installPreview(event.data);
        loadText(JSON.stringify(event.data.scene),'Sahne hazır.',{resetHistory:true});
        notify('studio:loaded',{requestId:event.data.requestId});
      }catch(e){error(e);notify('studio:error',{message:e.message||String(e),requestId:event.data.requestId});}
    }
    if(event.data.type==='studio:get'){
      try{validateScene(scene);notify('studio:data',{requestId:event.data.requestId,scene:structuredClone(scene),assets:[...assetReplacements.values()],presentation:structuredClone(presentation)});}
      catch(e){notify('studio:error',{requestId:event.data.requestId,message:e.message||String(e)});}
    }
  });
  notify('studio:ready');
}else{
  (async()=>{
    try{
      const response=await fetch('examples/birdesengor-v2.scene.json');
      if(!response.ok)throw new Error('Yerel V2 fikstürü okunamadı.');
      loadText(await response.text(),'Yerel V2 fikstürü yüklendi. Yerel sözleşme önizlemesidir; gerçek V2 bağlantısı değildir.');
    }catch(e){error(e);}
  })();
}

// Small read-only surface for local browser smoke tests; never part of the JSON.
window.__sceneEditor={
  getScene:()=>scene?structuredClone(scene):null,
  inspect:()=>previewHandle?.inspect()??null,
  selectObject,
  selectEffect,
  zoom:()=>zoom,
};
