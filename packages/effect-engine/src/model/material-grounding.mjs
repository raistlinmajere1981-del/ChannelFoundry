// A single geometry source for physical material-to-surface shadows.
// Coordinates are fractions of each scene object's canonical pose, never
// fixed pixels on the room master. The floor cast travels with its object.
const shadow=(x,y,width,height,rotation,opacity)=>Object.freeze({x,y,width,height,rotation,opacity});
export const ROOM_CONTACT_SHADOWS=Object.freeze({
  'candle':shadow(.08,.79,.79,.18,0,.61),
  'stone-specimen':shadow(.10,.84,.83,.12,0,.60),
  'incense-holder':shadow(.11,.38,.82,.34,-39,.39),
  'water-basin':shadow(.06,.77,.88,.20,0,.55),
  'metal-pendulum':shadow(.18,.86,.65,.13,0,.50),
  'ceremonial-dagger':shadow(.05,.74,.88,.15,-25,.35),
});
export function materialGroundingStyle(id){
  const p=ROOM_CONTACT_SHADOWS[id];
  if(!p)return null;
  return {
    position:'absolute',
    left:(p.x*100)+'%',top:(p.y*100)+'%',
    width:(p.width*100)+'%',height:(p.height*100)+'%',
    transform:'rotate('+p.rotation+'deg)',borderRadius:'50%',
    background:'radial-gradient(ellipse at 50% 50%, rgba(1,4,8,'+p.opacity+') 0%, rgba(2,5,10,'+(p.opacity*.65).toFixed(3)+') 26%, transparent 76%)',
    pointerEvents:'none',userSelect:'none',
    zIndex:0,
  };
}
export function materialToneForStudio(id,role='body'){
  if(role==='motion')return id==='stone-specimen'
    ?'brightness(calc(.78 * var(--scene-material-brightness,1))) saturate(.78)'
    :'brightness(calc(.7 * var(--scene-material-brightness,1))) saturate(.7)';
  const profiles={
    candle:[.86,.65],'incense-holder':[.83,.67],
    'water-basin':[.86,.86],
    'guardian-sword-left':[.83,.77],'guardian-sword-right':[.83,.77],
    'stone-specimen':[.86,.7],
    'ceremonial-robe':[.82,.8],
    'ceremonial-dagger':[.78,.86],
    'archive-chest':[.73,.78],
  };
  const [brightness,saturation]=profiles[id]??[.72,.72];
  return 'brightness(calc('+brightness+' * var(--scene-material-brightness,1))) saturate('+saturation+')';
}
