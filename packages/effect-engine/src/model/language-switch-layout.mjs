// Validated visual placement of a CSS-native room control, independent of
// object effects and of the language/transition engine.
export const LANGUAGE_SWITCH_CONTROL='languageSwitch';
const LIMITS=Object.freeze({
  x:[5,85],y:[60,96],bottom:[22,90],plateScale:[.45,2.25],
  hitWidth:[1,1.7],hitHeight:[1,1.7],skew:[-55,15],
});
export function defaultLanguageSwitchLayout(){
  return {desktop:{x:22,y:90.5,plateScale:1,hitWidth:1,hitHeight:1,skew:-23},
    mobile:{x:14,bottom:28,plateScale:1,hitWidth:1,hitHeight:1,skew:-23}};
}
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateLanguageSwitchLayout(value){
  if(!isRecord(value)||Object.keys(value).sort().join(',')!=='desktop,mobile')
    throw Error('Dil anahtarı masaüstü/mobil yerleşimi geçersiz.');
  for(const device of ['desktop','mobile']){
    const entry=value[device],keys=device==='desktop'
      ?['x','y','plateScale','hitWidth','hitHeight','skew']
      :['x','bottom','plateScale','hitWidth','hitHeight','skew'];
    if(!isRecord(entry)||Object.keys(entry).sort().join(',')!==keys.sort().join(','))
      throw Error('Dil anahtarı '+device+' kontrolleri eksik.');
    for(const [key,field] of Object.entries(entry)){
      const limits=LIMITS[key];
      if(!limits||!Number.isFinite(field)||field<limits[0]||field>limits[1])
        throw Error('Dil anahtarı '+device+'.'+key+' '+limits?.join('–')+' aralığında olmalı.');
    }
  }
  return value;
}
// Values are CSS custom properties, never event handlers or user-provided CSS.
export function languageSwitchStyle(layout){
  validateLanguageSwitchLayout(layout);
  const a=layout.desktop,b=layout.mobile;
  return {
    '--switch-desktop-x':a.x+'%',
    '--switch-desktop-y':a.y+'%',
    '--switch-desktop-plate-scale':String(a.plateScale),
    '--switch-desktop-hit-width':String(a.hitWidth),
    '--switch-desktop-hit-height':String(a.hitHeight),
    '--switch-desktop-skew':a.skew+'deg',
    '--switch-mobile-x':b.x+'%',
    '--switch-mobile-bottom':b.bottom+'px',
    '--switch-mobile-plate-scale':String(b.plateScale),
    '--switch-mobile-hit-width':String(b.hitWidth),
    '--switch-mobile-hit-height':String(b.hitHeight),
    '--switch-mobile-skew':b.skew+'deg',
  };
}
