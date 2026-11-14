// The same contained room geometry used by the published web study.
// This module only applies Studio viewport dimensions, never source assets.
import {roomFrameGeometry} from '../../../../packages/effect-engine/src/model/room-frame.mjs';

export function layoutSceneViewport({well,photo,frame,viewport,backgroundMeta,
    scene,screenPreset,screenWidth,screenHeight,zoom=1}){
  const ratio=backgroundMeta?.aspect??(!photo.hidden&&photo.naturalWidth
    ?photo.naturalWidth/photo.naturalHeight
    :(scene?.viewport.width??1600)/(scene?.viewport.height??900));
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
  Object.assign(viewport.style,{width:width+'px',height:height+'px'});
  return {simulation,geometry,scale,width,height,screenW,screenH};
}

export function renderViewportControls({get,profile,screenPreset,presentationDevice,
    languageAvailable,siteSource,captureEnabled}){
  const select=get('#scene-global-screen-preset');
  if(!select)return;
  select.disabled=!profile;
  select.value=screenPreset;
  const focusDevice=get('#focus-preview-device');
  if(focusDevice)focusDevice.value=presentationDevice;
  const info=get('#scene-screen-brief'),metrics=get('#scene-screen-padding');
  if(profile){
    const {geometry}=profile;
    const fmt=value=>Number.isInteger(value)?String(value):value.toFixed(1);
    if(info)info.textContent=screenPreset==='room'?'Doğal oda'
      :fmt(profile.width)+' × '+fmt(profile.height);
    const pad=geometry.empty;
    if(metrics)metrics.textContent=screenPreset==='room'?'Görsel %100'
      :pad.top>0?'Üst/alt '+fmt(pad.top)+' px · resim %100'
      :pad.left>0?'Yanlar '+fmt(pad.left)+' px · resim %100'
      :'Tam ekran · resim %100';
  }else{
    if(info)info.textContent='Yerel sahne';
    if(metrics)metrics.textContent='';
  }
  const language=get('#scene-control-quick');
  if(language)language.hidden=!languageAvailable;
  const web=get('#scene-real-quick');
  if(web){
    web.hidden=!siteSource;
    web.disabled=!captureEnabled;
    web.title=web.disabled?'Gerçek web karşılaştırması için kitap, kamera veya çizim atölyesini seç'
      :'Seçili nesnenin gerçek web bileşenini izole tarayıcıda aç';
  }
}
