import {defaultLanguageSwitchLayout,validateLanguageSwitchLayout} from './language-switch-layout.mjs';

/** One validated, versioned contract for the physical focus objects.
 * These are presentation knobs only: publication, auth, effects and Grabfold
 * state remain owned by their existing modules.
 */
export const PRESENTATION_SCENE_ID='birdesengor-study-v2';
export const FOCUS_OBJECT_IDS=Object.freeze([
  'research-journal','community-journal','camera','vefk-stand',
]);
export const BOOK_OBJECT_IDS=Object.freeze(['research-journal','community-journal']);
export const PHYSICAL_DEVICE_IDS=Object.freeze(['camera','vefk-stand']);
const DEVICE_FIELDS=Object.freeze(['roomZoom','roomShiftX','roomShiftY','nearZoom','nearShiftX','nearShiftY']);
const VALUE_LIMITS=Object.freeze({
  roomZoom:[.75,1.6],nearZoom:[.7,1.4],
  roomShiftX:[-15,15],roomShiftY:[-15,15],
  nearShiftX:[-15,15],nearShiftY:[-15,15],
});
const BOOK_LIMITS=Object.freeze({
  turnMs:[300,1600],thickness:[10,50],
  pageRatio:[.7,.93],mobilePageRatio:[.5,.68],
  depthDesktop:[32,72],depthMobile:[14,30],
  readingPadXDesktop:[5,13],readingPadYDesktop:[4,11],
  readingPadXMobile:[5,13],readingPadYMobile:[5,12],
});
const RIBBON_LIMITS=Object.freeze({
  offsetDesktop:[-20,20],offsetMobile:[-20,20],
  widthDesktop:[42,60],widthMobile:[35,48],
});
const INDEX_LIMITS=Object.freeze({
  topDesktop:[8,42],topMobile:[2,30],
  gapDesktop:[4,24],gapMobile:[6,28],
});
const CAMERA_LIMITS=Object.freeze({
  offsetX:[-24,24],offsetY:[-18,18],
  widthScale:[.94,1.06],heightScale:[.94,1.06],
  bezelPaddingX:[8,40],bezelPaddingY:[12,40],
  contentPadding:[7,22],archiveWidth:[250,420],
  videoMinHeight:[180,275],
});
const WORKSHOP_LIMITS=Object.freeze({
  paperX:[-28,28],paperY:[-28,28],paperScale:[.92,1.08],
  inkwellX:[-28,28],inkwellY:[-28,28],
  catalogX:[-24,24],catalogY:[-24,24],
  topRailX:[-22,22],topRailY:[-18,18],
  rulerX:[-22,22],rulerY:[-18,18],
});
export function defaultPhysicalPresentation(id){
  if(id==='camera')return {
    desktop:{offsetX:0,offsetY:0,widthScale:1,heightScale:1,
      bezelPaddingX:24,bezelPaddingY:30,contentPadding:14,archiveWidth:330,videoMinHeight:200},
    mobile:{offsetX:0,offsetY:0,widthScale:1,heightScale:1,
      bezelPaddingX:12,bezelPaddingY:22,contentPadding:11,archiveWidth:330,videoMinHeight:226},
  };
  if(id==='vefk-stand')return {
    desktop:Object.fromEntries(Object.keys(WORKSHOP_LIMITS).map(key=>[key,key==='paperScale'?1:0])),
    mobile:Object.fromEntries(Object.keys(WORKSHOP_LIMITS).map(key=>[key,key==='paperScale'?1:0])),
  };
  throw Error('Bu nesnede bağımsız donanım ayarı yok.');
}
const neutralDevice=()=>({roomZoom:1,roomShiftX:0,roomShiftY:0,nearZoom:1,nearShiftX:0,nearShiftY:0});
export function defaultBookPresentation(id){
  const community=id==='community-journal';
  if(!BOOK_OBJECT_IDS.includes(id))throw Error('Bu nesnenin fiziksel kitabı yok.');
  return {
    turnMs:community?760:840,thickness:community?22:28,
    pageRatio:.82,mobilePageRatio:.58,
    depthDesktop:community?44:56,depthMobile:community?20:22,
    readingPadXDesktop:community?6.5:8,readingPadYDesktop:community?5.5:6,
    readingPadXMobile:community?7:8,readingPadYMobile:community?6:8,
    ...(community?{indexes:{topDesktop:23,topMobile:5,gapDesktop:12,gapMobile:18}}
      :{ribbon:{offsetDesktop:0,offsetMobile:0,widthDesktop:52,widthMobile:44}}),
  };
}
export function defaultScenePresentation(){
  return {
    version:1,sceneId:PRESENTATION_SCENE_ID,
    controls:{languageSwitch:defaultLanguageSwitchLayout()},
    objects:Object.fromEntries(FOCUS_OBJECT_IDS.map(id=>[id,{
      focusMs:620,returnMs:520,detailMs:
        id==='camera'?520:id==='vefk-stand'?650:880,
      desktop:neutralDevice(),mobile:neutralDevice(),
      ...(BOOK_OBJECT_IDS.includes(id)?{book:defaultBookPresentation(id)}:{}),
      ...(PHYSICAL_DEVICE_IDS.includes(id)?{physical:defaultPhysicalPresentation(id)}:{}),
    }])),
  };
}
const exactKeys=(value,expected,label)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).sort().join('|')!==[...expected].sort().join('|'))
    throw Error(label+' alanları eksik veya tanınmıyor.');
};
const within=(value,range,label,whole=false)=>{
  if(!Number.isFinite(value)||(whole&&!Number.isInteger(value))||value<range[0]||value>range[1])
    throw Error(label+': '+range.join('–')+(whole?' tam sayı':' sayı')+' gerekli.');
};
export function validateScenePresentation(input){
  exactKeys(input,['version','sceneId','objects','controls'],'Sahne sunumu');
  if(input.version!==1||input.sceneId!==PRESENTATION_SCENE_ID)
    throw Error('Sahne sunumunun sürümü veya sahne kimliği geçersiz.');
  exactKeys(input.controls,['languageSwitch'],'Sahne kontrolleri');
  validateLanguageSwitchLayout(input.controls.languageSwitch);
  exactKeys(input.objects,FOCUS_OBJECT_IDS,'Odak nesneleri');
  for(const id of FOCUS_OBJECT_IDS){
    const entry=input.objects[id],isBook=BOOK_OBJECT_IDS.includes(id),isPhysical=PHYSICAL_DEVICE_IDS.includes(id);
    exactKeys(entry,['focusMs','returnMs','detailMs','desktop','mobile',...(isBook?['book']:[]),...(isPhysical?['physical']:[])],id);
    for(const key of ['focusMs','returnMs','detailMs']){
      within(entry[key],key==='detailMs'?[100,2000]:[300,1800],id+'.'+key,true);
    }
    for(const device of ['desktop','mobile']){
      const values=entry[device];
      exactKeys(values,DEVICE_FIELDS,id+'.'+device);
      for(const key of DEVICE_FIELDS)within(values[key],VALUE_LIMITS[key],id+'.'+device+'.'+key);
    }
    if(isPhysical){
      const defaults=defaultPhysicalPresentation(id);
      exactKeys(entry.physical,['desktop','mobile'],id+'.physical');
      const limits=id==='camera'?CAMERA_LIMITS:WORKSHOP_LIMITS;
      for(const device of ['desktop','mobile']){
        const values=entry.physical[device];
        exactKeys(values,Object.keys(defaults[device]),id+'.physical.'+device);
        for(const [key,range] of Object.entries(limits))
          within(values[key],range,id+'.physical.'+device+'.'+key);
      }
    }
    if(isBook){
      const book=entry.book,reference=defaultBookPresentation(id);
      exactKeys(book,Object.keys(reference),id+'.book');
      for(const [key,range] of Object.entries(BOOK_LIMITS))
        within(book[key],range,id+'.book.'+key,['turnMs','thickness','depthDesktop','depthMobile'].includes(key));
      const detail=id==='research-journal'?book.ribbon:book.indexes;
      const limits=id==='research-journal'?RIBBON_LIMITS:INDEX_LIMITS;
      exactKeys(detail,Object.keys(limits),id+'.book '+(isBook?'detay':''));
      for(const [key,range] of Object.entries(limits))
        within(detail[key],range,id+'.book.'+key);
    }
  }
  return input;
}
export function focusProfile(presentation,id,mobile=false){
  return presentation.objects[id]?.[mobile?'mobile':'desktop']??neutralDevice();
}
