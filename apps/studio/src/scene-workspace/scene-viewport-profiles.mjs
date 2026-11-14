import {roomFrameGeometry} from '../../../../packages/effect-engine/src/model/room-frame.mjs';

// Studio-only profiles. The site uses its own responsive layout; this model
// displays exactly the same contained 2:1 room geometry as the web runtime.
export const SCENE_SCREEN_PRESETS=Object.freeze({
  '1920x1080':Object.freeze([1920,1080]),
  '1366x768':Object.freeze([1366,768]),
  '2560x1080':Object.freeze([2560,1080]),
  '768x1024':Object.freeze([768,1024]),
  '390x844':Object.freeze([390,844]),
});
export const SCENE_SCREEN_OPTIONS=Object.freeze([
  ['room','Oda · kaynak oranı'],
  ['1920x1080','1920 × 1080 · Masaüstü'],
  ['1366x768','1366 × 768 · Laptop'],
  ['2560x1080','2560 × 1080 · Ultra geniş'],
  ['768x1024','768 × 1024 · Tablet'],
  ['390x844','390 × 844 · Telefon'],
  ['custom','Özel çözünürlük'],
]);
export function sceneScreenProfile(key,width=1920,height=1080,aspect=2){
  if(key!=='room'&&key!=='custom'&&!Object.hasOwn(SCENE_SCREEN_PRESETS,key))
    throw new Error('Geçersiz ekran profili.');
  if(!Number.isFinite(aspect)||aspect<=0)throw new Error('Geçersiz oda oranı.');
  let size=SCENE_SCREEN_PRESETS[key];
  if(key==='room')size=[aspect*1000,1000];
  if(key==='custom'){
    if(!Number.isInteger(width)||!Number.isInteger(height)||
      width<240||height<240||width>4096||height>4096)
      throw new RangeError('Özel ekran ölçüsü 240–4096 px olmalı.');
    size=[width,height];
  }
  const geometry=roomFrameGeometry(size[0],size[1],aspect);
  const visible=geometry.room.width*geometry.room.height;
  const total=geometry.screen.width*geometry.screen.height;
  const fraction=visible/total;
  return {
    key,width:size[0],height:size[1],geometry,
    device: size[0]<760?'mobile':'desktop',
    visibleFraction:1, // Photo is entirely shown; this is not the screen fill ratio.
    screenFillFraction:fraction,
    padding:geometry.empty,
    letterboxFraction:1-fraction,
  };
}
