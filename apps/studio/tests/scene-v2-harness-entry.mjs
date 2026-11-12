// Deliberately test-only: translates the historical browser-test postMessage
// fixture into direct calls. No production Studio editor ever uses this protocol.
import {mountSceneEditor} from '../src/scene-workspace/scene-editor.mjs';
const editor=mountSceneEditor(document,{onDirty:()=>window.postMessage({type:'studio:dirty'},'*')});
const notify=(type,fields={})=>window.postMessage({type,...fields},'*');
if(new URLSearchParams(location.search).get('embedded')==='1'){
  document.body.classList.add('embedded');
  window.addEventListener('message',event=>{
    if(event.source!==window||!event.data||typeof event.data!=='object')return;
    const packet=event.data;
    if(packet.type==='studio:hello')notify('studio:ready');
    if(packet.type==='studio:load'){
      try{editor.load(packet);notify('studio:loaded',{requestId:packet.requestId});}
      catch(e){notify('studio:error',{message:e.message||String(e),requestId:packet.requestId});}
    }
    if(packet.type==='studio:get'){
      try{notify('studio:data',{requestId:packet.requestId,...editor.snapshot()});}
      catch(e){notify('studio:error',{message:e.message||String(e),requestId:packet.requestId});}
    }
  });
  notify('studio:ready');
}else{
  fetch('/examples/birdesengor-v2.scene.json').then(r=>{
    if(!r.ok)throw Error('Test fixture not found');return r.json();
  }).then(scene=>editor.load({scene})).catch(e=>console.error(e));
}
