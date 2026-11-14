// Scene-wide colour management. Only the room and independent physical materials
// consume these numbers; text, interactive surfaces and publication data do not.
export const APPEARANCE_LIMITS=Object.freeze({
  brightness:[.6,1.3],contrast:[.75,1.35],saturation:[.4,1.3],
  coolTint:[0,.3],vignette:[0,.5],materialBrightness:[.7,1.2],
});
export const SCENE_APPEARANCE_PRESETS=Object.freeze({
  neutral:Object.freeze({brightness:1,contrast:1,saturation:1,coolTint:0,vignette:0,materialBrightness:1}),
  coolClear:Object.freeze({brightness:.8,contrast:1.09,saturation:.82,coolTint:.12,vignette:.2,materialBrightness:.87}),
});
export const defaultSceneAppearance=()=>({...SCENE_APPEARANCE_PRESETS.neutral});
export function validateSceneAppearance(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).sort().join('|')!==Object.keys(APPEARANCE_LIMITS).sort().join('|'))
    throw Error('Sahne ışık/ton alanları eksik veya bilinmiyor.');
  for(const [key,[min,max]] of Object.entries(APPEARANCE_LIMITS)){
    const number=value[key];
    if(!Number.isFinite(number)||number<min||number>max)
      throw Error('Sahne ışık/ton '+key+' '+min+'–'+max+' aralığında olmalı.');
  }
  return value;
}
export function sceneAppearanceStyle(value){
  const a=validateSceneAppearance(value??defaultSceneAppearance());
  return {
    '--scene-room-brightness':a.brightness,
    '--scene-room-contrast':a.contrast,
    '--scene-room-saturation':a.saturation,
    '--scene-cool-tint':a.coolTint,
    '--scene-vignette':a.vignette,
    '--scene-material-brightness':a.materialBrightness,
  };
}
