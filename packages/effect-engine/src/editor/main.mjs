import {effectActionRow} from './effect-actions.mjs';
import {$,el,button,field,download,readFile} from './dom.mjs';
import {createPreview} from './preview.mjs';
import {History} from './history.mjs';
import {validateProject,importProject,exportProject,createEffect,deleteZone,MAX_FILE_BYTES} from '../model/project.mjs';
import {insertPoint,clamp} from './geometry.mjs';
import {effectRegistry,defaultParams} from '../registry/effects.mjs';
let soloId=null;
let scene,zoneId,effectId,vertex=0,playing=true,compare=false,loading=0;
const embedded=new URLSearchParams(location.search).get("embedded")==="1";
const notify=(type,extra={})=>{if(embedded)window.parent.postMessage({type,...extra},"*");};
const changed=()=>notify("studio:dirty");
const inspect=(part)=>{
 if(!embedded)return;
 document.body.dataset.inspector=part;
 document.querySelector('#inspect-zone')?.setAttribute('aria-pressed',String(part==='zone'));
 document.querySelector('#inspect-effect')?.setAttribute('aria-pressed',String(part==='effect'));
};


const history=new History();
const status=(message,error=false)=>{ $('#status').textContent=message;$('#status').classList.toggle('error',error);$('#status').title=message; };
const error=e=>status(e.message||String(e),true);
const preview=createPreview({host:$('#preview-host'),image:$('#photo'),svg:$('#guides-svg'),stats:$('#stats'),onError:error});
const zone=()=>scene?.zones.find(z=>z.id===zoneId);
const effect=()=>scene?.effects.find(e=>e.id===effectId);
const uid=()=>crypto.randomUUID();
function mutate(action,key=null,render=true){
  if(!scene)return false;
  try {const next=structuredClone(scene);action(next);validateProject(next);history.record(scene,key);scene=next;preview.update(scene);if(render)draw();else{guides();historyButtons();}status(embedded?'Değişiklik yapıldı.':'Değişiklik uygulandı. JSON dışa aktararak kaydedin.');changed();return true;}catch(e){if(render)draw();error(e);return false;}
}
function historyButtons(){
  $('#undo').disabled=!history.past.length;$('#redo').disabled=!history.future.length;
  $('#undo').title=history.past.length?'Geri al (Ctrl/⌘ Z)':'Geri alınacak değişiklik yok.';
  $('#redo').title=history.future.length?'Yinele (Ctrl/⌘ Shift Z)':'Yinelenecek değişiklik yok.';
}
function input(label,value,change,attrs={}){return field(label,el('input',{value,...attrs,onchange:e=>change(e.target.type==='checkbox'?e.target.checked:e.target.type==='number'?e.target.valueAsNumber:e.target.value)}));}
function draw(){
  if(!scene)return;
  if(!zone())zoneId=scene.zones[0]?.id;
  if(!effect()||(embedded&&effect().zoneId!==zoneId))effectId=scene.effects.find(e=>e.zoneId===zoneId)?.id;
  if(soloId&&!scene.effects.some(e=>e.id===soloId)){soloId=null;preview.setSolo(null);}
  $('#solo-status').hidden=!soloId;
  $('#solo-status').textContent=soloId?'YALNIZ · '+effectRegistry[scene.effects.find(e=>e.id===soloId).type].label:'';
  $('#solo-status').title=$('#solo-status').textContent;
  $('#scene-name').value=scene.name;$('#scene-seed').value=scene.seed;
  $('#photo').alt=scene.photo.name;$('#gideros-license').hidden=scene.photo.src!=='assets/gideros-1-1818.webp';$('#photo-name').textContent=scene.photo.name;$('#dimensions').textContent=`${scene.photo.width} × ${scene.photo.height} · Orijinal koordinatlar`;
  $('#credit-text').textContent=scene.photo.credit||'Kullanıcı tarafından açılan fotoğraf. Kullanım hakkını ve kaynak bilgisini kendiniz koruyun.';
  const visibleEffects=embedded?scene.effects.filter(e=>e.zoneId===zoneId):scene.effects;
  $('#zone-count').textContent=scene.zones.length;$('#effect-count').textContent=visibleEffects.length;
  $('#zones').replaceChildren(...scene.zones.map(z=>el('div',{class:`list-row ${z.id===zoneId?'selected':''}`},button(z.name,()=>{zoneId=z.id;effectId=scene.effects.find(e=>e.zoneId===z.id)?.id;vertex=0;inspect("zone");draw();},{class:'row-select',title:z.name,'aria-pressed':String(z.id===zoneId)}),el('input',{type:'checkbox',checked:z.visible,'aria-label':`${z.name} görünür`,onchange:e=>mutate(s=>{s.zones.find(x=>x.id===z.id).visible=e.target.checked;})}))));
  $('#effects').replaceChildren(...visibleEffects.map(e=>el('div',{class:`list-row ${e.id===effectId?'selected':''}`},button(effectRegistry[e.type].label,()=>{effectId=e.id;zoneId=e.zoneId;vertex=0;inspect("effect");draw();},{class:'row-select',title:effectRegistry[e.type].label,'aria-pressed':String(e.id===effectId)}),el('input',{type:'checkbox',checked:e.enabled,'aria-label':`${effectRegistry[e.type].label} etkin`,onchange:event=>mutate(s=>{s.effects.find(x=>x.id===e.id).enabled=event.target.checked;})}))));
  if(embedded&&!visibleEffects.length)$('#effects').append(el('p',{class:'empty',role:'status',text:zone()?'Bu alanda efekt yok.':'Önce bir alan ekleyin.'}));
  $('#add-effect').disabled=!zone();
  $('#add-effect').title=zone()?'Seçili alana efekt ekle':'Önce bir alan ekleyin.';
  const z=zone(),zi=$('#zone-inspector');zi.replaceChildren(el('h2',{text:embedded?'Alan':'Bölge'}));
  if(z){
    vertex=clamp(vertex,0,z.points.length-1);
    zi.append(input(embedded?'Alan adı':'Bölge adı',z.name,value=>mutate(s=>{s.zones.find(x=>x.id===zoneId).name=value;}),{maxlength:160}),el('p',{class:'help',text:`${z.points.length} köşe · Seçili köşe: ${vertex+1}` }));
    const choices=el('select',{'aria-label':'Köşe seç',onchange:e=>{vertex=Number(e.target.value);draw();}},...z.points.map((p,i)=>el('option',{value:i,text:`${i+1}: ${p[0]}, ${p[1]}`,selected:i===vertex})));
    zi.append(field('Köşe',choices));
    for(const [i,label] of ['X','Y'].entries())zi.append(input(label,z.points[vertex][i],value=>mutate(s=>{s.zones.find(x=>x.id===zoneId).points[vertex][i]=value;}),{type:'number',min:0,max:i?scene.photo.height:scene.photo.width,step:.01}));
    zi.append(el('div',{class:'button-row'},button('Köşe ekle',()=>mutate(s=>{const target=s.zones.find(x=>x.id===zoneId);target.points=insertPoint(target.points,vertex);vertex++;}),{disabled:z.points.length>=200,title:z.points.length>=200?'Bir alanda en fazla 200 köşe olabilir.':'Seçili köşeden sonra köşe ekle'}),button('Köşe sil',removeVertex,{disabled:z.points.length<=3,title:z.points.length<=3?'Bir alanın en az 3 köşesi olmalı.':'Seçili köşeyi sil'})),button(embedded?'Alanı sil':'Bölgeyi sil',()=>mutate(s=>Object.assign(s,deleteZone(s,zoneId))),{class:'danger full'}));
  }else zi.append(el('p',{class:'empty',text:embedded?'Bir alan ekleyin.':'Bir bölge ekleyin.'}));
  const e=effect(),ei=$('#effect-inspector');ei.replaceChildren(el('h2',{text:'Efekt'}));
  if(e){
    ei.append(effectActionRow(scene,e,soloId,{mutate,setSolo:id=>{soloId=id;preview.setSolo(id);draw();}}));
    $('#effect-up').title=scene.effects[0].id===e.id?'Efekt zaten ilk sırada.':'Efekti çizim sırasında yukarı taşı';
    $('#effect-down').title=scene.effects.at(-1).id===e.id?'Efekt zaten son sırada.':'Efekti çizim sırasında aşağı taşı';
    const change=(key,value)=>mutate(s=>{s.effects.find(x=>x.id===effectId)[key]=value;});
    ei.append(field('Tür',el('select',{onchange:event=>mutate(s=>{const target=s.effects.find(x=>x.id===effectId);target.type=event.target.value;target.params=defaultParams(target.type);})},...Object.entries(effectRegistry).map(([type,info])=>el('option',{value:type,text:info.label,selected:type===e.type})))),field(embedded?'Alan':'Bölge',el('select',{onchange:event=>{zoneId=event.target.value;change('zoneId',zoneId);}},...scene.zones.map(z=>el('option',{value:z.id,text:z.name,selected:z.id===e.zoneId})))),input('Efekt tohumu',e.seed,value=>change('seed',value),{maxlength:120}));
    for(const c of effectRegistry[e.type].controls){
      const set=value=>mutate(s=>{s.effects.find(x=>x.id===e.id).params[c.key]=value;},`param:${e.id}:${c.key}`,false);
      if(c.kind==='boolean')ei.append(field(c.label,el('input',{type:'checkbox',checked:e.params[c.key],onchange:event=>set(event.target.checked)})));
      else {
        const number=el('input',{type:'number',value:e.params[c.key],min:c.min,max:c.max,step:c.step,'aria-label':c.label});
        const range=el('input',{type:'range',value:e.params[c.key],min:c.min,max:c.max,step:c.step,'aria-label':`${c.label} sürgü`});
        number.addEventListener('change',()=>{if(set(number.valueAsNumber))range.value=number.value;else number.value=effect().params[c.key];});
        range.addEventListener('input',()=>{if(set(range.valueAsNumber))number.value=range.value;});
        ei.append(el('div',{class:'param'},el('div',{class:'param-line'},el('label',{text:c.label}),number),range));
      }
    }
    ei.append(el('div',{class:'button-row'},button('Kopyala',()=>mutate(s=>{const copy=structuredClone(e);copy.id=uid();s.effects.push(copy);effectId=copy.id;})),button(e.enabled?'Devre dışı':'Etkinleştir',()=>change('enabled',!e.enabled)),button('Sil',()=>mutate(s=>{s.effects=s.effects.filter(x=>x.id!==effectId);effectId=null;}),{class:'danger'})));
  }else ei.append(el('p',{class:'empty',text:'Bir efekt seçin veya ekleyin.'}));
  guides();historyButtons();
}
function removeVertex(){if(zone()?.points.length>3)mutate(s=>{s.zones.find(x=>x.id===zoneId).points.splice(vertex,1);});}
const ns='http://www.w3.org/2000/svg';
function svgNode(tag,attrs){const node=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;}
let drag=null;
function guides(){
  const svg=$('#guides-svg');svg.style.display=$('#guides').checked?'':'none';svg.replaceChildren();if(!scene)return;
  for(const z of scene.zones){if(!z.visible)continue;
    const polygon=svgNode('polygon',{points:z.points.map(p=>preview.project(p).join(',')).join(' '),class:`zone-polygon ${z.id===zoneId?'is-selected':''}`});
    polygon.addEventListener('click',()=>{zoneId=z.id;effectId=scene.effects.find(e=>e.zoneId===z.id)?.id;vertex=0;inspect('zone');draw();});svg.append(polygon);
  }
  const z=zone();if(!z?.visible)return;
  z.points.forEach((p,i)=>{const [cx,cy]=preview.project(p);const circle=svgNode('circle',{cx,cy,r:6,class:`vertex ${i===vertex?'selected':''}`,tabindex:0,role:'button','aria-label':`Köşe ${i+1}`});
    circle.addEventListener('pointerdown',event=>{event.preventDefault();vertex=i;drag={id:event.pointerId,before:structuredClone(scene),changed:false};$('#preview-host').setPointerCapture(event.pointerId);guides();});
    circle.addEventListener('focus',()=>{vertex=i;});
    circle.addEventListener('keydown',event=>{if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeVertex();return;}const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[event.key])return;event.preventDefault();const delta=moves[event.key],step=event.shiftKey?10:1;mutate(s=>{const point=s.zones.find(x=>x.id===zoneId).points[i];point[0]=clamp(point[0]+delta[0]*step,0,s.photo.width);point[1]=clamp(point[1]+delta[1]*step,0,s.photo.height);},`vertex:${zoneId}:${i}`,false);$('#guides-svg').querySelectorAll('.vertex')[i]?.focus();});svg.append(circle);
  });
}
$('#preview-host').addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const next=structuredClone(scene);next.zones.find(z=>z.id===zoneId).points[vertex]=preview.point(event);try{validateProject(next);scene=next;drag.changed=true;preview.update(scene);guides();}catch(e){error(e);}});
function endDrag(event){if(!drag||event.pointerId!==drag.id)return;if(drag.changed){history.record(drag.before);changed();status('Köşe fotoğraf koordinatlarında taşındı.');}drag=null;draw();}
$('#preview-host').addEventListener('pointerup',endDrag);$('#preview-host').addEventListener('pointercancel',endDrag);
new ResizeObserver(guides).observe($('#preview-host'));
$('#photo').addEventListener('load',guides);
async function install(next,message){const token=++loading;await preview.loadPhoto(next.photo);if(token!==loading)return;if(scene)history.record(scene);scene=next;soloId=null;preview.setSolo(null);zoneId=next.zones[0]?.id;effectId=embedded?next.effects.find(e=>e.zoneId===zoneId)?.id:next.effects[0]?.id;vertex=0;inspect('effect');preview.update(scene,{immediate:true});draw();status(message);}
async function example(){try{const response=await fetch(new URLSearchParams(location.search).get('example')==='blacksea'?'examples/blacksea.scene.json':'examples/gideros.scene.json');if(!response.ok)throw new Error('Örnek proje okunamadı.');await install(importProject(await response.text()),(new URLSearchParams(location.search).get('example')==='blacksea'?'BlackSea':'Gideros')+' örneği hazır. Bölgeleri ve efektleri düzenleyebilirsiniz.');}catch(e){error(e);}}
for(const [type,info]of Object.entries(effectRegistry))$('#effect-type').append(el('option',{value:type,text:info.label}));
$('#add-zone').onclick=()=>mutate(s=>{const w=s.photo.width,h=s.photo.height;const z={id:uid(),name:`${embedded?'Alan':'Bölge'} ${s.zones.length+1}`,visible:true,points:[[w*.3,h*.3],[w*.7,h*.3],[w*.7,h*.7],[w*.3,h*.7]]};s.zones.push(z);zoneId=z.id;effectId=null;vertex=0;inspect('zone');});
$('#add-effect').onclick=()=>{if(zone())mutate(s=>{const e=createEffect($('#effect-type').value,zoneId,uid());s.effects.push(e);effectId=e.id;inspect('effect');});};
$('#scene-name').onchange=e=>mutate(s=>{s.name=e.target.value;});$('#scene-seed').onchange=e=>mutate(s=>{s.seed=e.target.value;});
for(const kind of ['photo','project']){
  $(`#open-${kind}`).onclick=()=>$(`#${kind}-file`).click();
  $(`#${kind}-file`).onchange=async event=>{const file=event.target.files[0];if(!file)return;try{
    if(file.size>MAX_FILE_BYTES)throw new Error('Dosya 25 MB sınırını aşıyor.');
    if(kind==='project')await install(importProject(await readFile(file)),'Proje açıldı.');
    else {const src=await readFile(file,true);const probe=new Image();probe.src=src;await probe.decode();const next=structuredClone(scene);const sx=probe.naturalWidth/next.photo.width,sy=probe.naturalHeight/next.photo.height;next.photo={src,width:probe.naturalWidth,height:probe.naturalHeight,name:file.name.slice(0,160),credit:''};for(const z of next.zones)z.points=z.points.map(([x,y])=>[x*sx,y*sy]);validateProject(next);await install(next,'Fotoğraf açıldı; bölgeler yeni boyuta ölçeklendi.');}
  }catch(e){error(e);}finally{event.target.value='';}};
}
$('#export').onclick=()=>{try{if(!scene)throw new Error('Önce proje yükleyin.');const text=exportProject(scene);if(new TextEncoder().encode(text).length>MAX_FILE_BYTES)throw new Error('Dışa aktarım 25 MB sınırını aşıyor; daha küçük fotoğraf seçin.');download(text,'efekt-atolyesi.scene.json');status('JSON indirildi. Gömülü fotoğraflar proje dosyasına dahildir.');}catch(e){error(e);}};
function travel(direction){if(!scene)return;scene=history[direction](scene);preview.update(scene,{immediate:true});draw();status(direction==='undo'?'Geri alındı.':'Yinelendi.');changed();}
$('#undo').onclick=()=>travel('undo');$('#redo').onclick=()=>travel('redo');
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z'||e.target.matches('input,select,textarea'))return;e.preventDefault();travel(e.shiftKey?'redo':'undo');});
$('#play').onclick=()=>{playing=!playing;preview.setPlaying(playing);$('#play').textContent=playing?'Ⅱ Duraklat':'▶ Oynat';$('#play').setAttribute('aria-pressed',String(playing));};
$('#compare').onclick=()=>{compare=!compare;preview.setCompare(compare);$('#compare').setAttribute('aria-pressed',String(compare));$('#comparison-badge').hidden=!compare;};
$('#guides').onchange=guides;$('#fit').onchange=e=>{preview.setFit(e.target.value);guides();};
$('#restart').onclick=()=>{preview.rebuild();status('Önizleme aynı tohumla başlatıldı.');};$('#reset').onclick=example;

if(embedded){
  document.body.classList.add("embedded");
  inspect("effect");
  $("#inspect-effect").onclick=()=>inspect("effect");
  $("#inspect-zone").onclick=()=>inspect("zone");
  window.addEventListener("message",async event=>{
    if(event.source!==window.parent||!event.data||typeof event.data!=="object")return;
    if(event.data.type==="studio:hello"){notify("studio:ready");return;}
    if(event.data.type==="studio:load"){
      try{
        const next=importProject(JSON.stringify(event.data.scene));
        await install(next,"Sahne hazır.");
        history.past.length=0;history.future.length=0;historyButtons();
        notify("studio:loaded",{requestId:event.data.requestId});
      }catch(e){error(e);notify("studio:error",{message:String(e.message||e),requestId:event.data.requestId});}
    }
    if(event.data.type==="studio:get"){
      try{notify("studio:data",{requestId:event.data.requestId,scene:structuredClone(scene)});}
      catch(e){notify("studio:error",{requestId:event.data.requestId,message:String(e.message||e)});}
    }
  });
  notify("studio:ready");
}else await example();
