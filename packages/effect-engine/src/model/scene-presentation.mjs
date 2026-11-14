import {defaultLanguageSwitchLayout,validateLanguageSwitchLayout} from './language-switch-layout.mjs';
import {defaultSceneAppearance,validateSceneAppearance} from './scene-appearance.mjs';

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
// Room-only placement for the actual physical camera and drawing instrument.
// Independent of device-specific focus projection or the source photo/anchors.
const ROOM_DEVICE_DEFAULTS=Object.freeze({
  camera:Object.freeze({x:.895,y:.832,scale:1}),
  'vefk-stand':Object.freeze({x:.776,y:.478,scale:1}),
});
const ROOM_DEVICE_LIMITS=Object.freeze({x:[.05,.96],y:[.04,.96],scale:[.55,1.75]});
export function defaultRoomDevicePlacement(id){
  if(!Object.hasOwn(ROOM_DEVICE_DEFAULTS,id))throw Error('Odada taşınabilir cihaz yok: '+id);
  return {...ROOM_DEVICE_DEFAULTS[id]};
}
export function roomDevicePlacement(presentation,id){
  return presentation?.objects?.[id]?.roomPlacement??defaultRoomDevicePlacement(id);
}
export function placedDeviceHitArea(presentation,id,area){
  if(!area || !PHYSICAL_DEVICE_IDS.includes(id))return area;
  const home=defaultRoomDevicePlacement(id),next=roomDevicePlacement(presentation,id);
  const factor=next.scale;
  return {
    x:next.x+(area.x+area.width/2-home.x)*factor-area.width*factor/2,
    y:next.y+(area.y+area.height/2-home.y)*factor-area.height*factor/2,
    width:area.width*factor,height:area.height*factor,
  };
}

const BOOK_PLACEMENT_LIMITS=Object.freeze({
  x:[.08,.92],y:[.18,.95],width:[.1,.5],angle:[-30,30],
  surfaceScaleY:[.7,1.25],
});
export function defaultClosedBookPlacement(id){
  if(id==='research-journal')return {x:.572,y:.795,width:.272,angle:2,surfaceScaleY:.975};
  if(id==='community-journal')return {x:.329,y:.815,width:.218,angle:-4,surfaceScaleY:.975};
  throw Error('Kapalı kitap yerleşimi bulunamadı.');
}
const DEVICE_FIELDS=Object.freeze(['roomZoom','roomShiftX','roomShiftY','nearZoom','nearShiftX','nearShiftY']);
const VALUE_LIMITS=Object.freeze({
  roomZoom:[.75,1.6],nearZoom:[.7,1.4],
  roomShiftX:[-15,15],roomShiftY:[-15,15],
  nearShiftX:[-15,15],nearShiftY:[-15,15],
});
const BOOK_LIMITS=Object.freeze({
  turnMs:[300,1600],thickness:[10,50],
  pageRatio:[.7,.93],mobilePageRatio:[.5,.68],
  coverBrightness:[.52,1.05],
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
  videoMinHeight:[180,275],hingeAngle:[-12,12],
  coverX:[0,100],coverY:[0,100],coverScale:[1,1.35],coverBrightness:[.7,1.2],
});
const WORKSHOP_LIMITS=Object.freeze({
  paperX:[-28,28],paperY:[-28,28],paperScale:[.92,1.08],
  inkwellX:[-28,28],inkwellY:[-28,28],
  catalogX:[-24,24],catalogY:[-24,24],
  topRailX:[-22,22],topRailY:[-18,18],
  rulerX:[-22,22],rulerY:[-18,18],
  quillDockX:[-24,24],quillDockY:[-24,24],quillRestAngle:[0,30],
});
export function defaultPhysicalPresentation(id){
  if(id==='camera')return {
    desktop:{offsetX:0,offsetY:0,widthScale:1,heightScale:1,
      bezelPaddingX:24,bezelPaddingY:30,contentPadding:14,archiveWidth:330,videoMinHeight:200,hingeAngle:0,coverX:50,coverY:50,coverScale:1,coverBrightness:.93},
    mobile:{offsetX:0,offsetY:0,widthScale:1,heightScale:1,
      bezelPaddingX:12,bezelPaddingY:22,contentPadding:11,archiveWidth:330,videoMinHeight:226,hingeAngle:0,coverX:50,coverY:50,coverScale:1,coverBrightness:.93},
  };
  if(id==='vefk-stand')return {
    desktop:Object.fromEntries(Object.keys(WORKSHOP_LIMITS).map(key=>[key,key==='paperScale'?1:key==='quillRestAngle'?14:0])),
    mobile:Object.fromEntries(Object.keys(WORKSHOP_LIMITS).map(key=>[key,key==='paperScale'?1:key==='quillRestAngle'?14:0])),
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
    coverBrightness:community?1:.79,
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
    appearance:defaultSceneAppearance(),
    objects:Object.fromEntries(FOCUS_OBJECT_IDS.map(id=>[id,{
      roomVisible:true,
      ...(BOOK_OBJECT_IDS.includes(id)?{closedBook:defaultClosedBookPlacement(id)}:{}),
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
  exactKeys(input,['version','sceneId','objects','controls',
    ...(input?.appearance!==undefined?['appearance']:[])],'Sahne sunumu');
  if(input.appearance!==undefined)validateSceneAppearance(input.appearance);
  if(input.version!==1||input.sceneId!==PRESENTATION_SCENE_ID)
    throw Error('Sahne sunumunun sürümü veya sahne kimliği geçersiz.');
  exactKeys(input.controls,['languageSwitch'],'Sahne kontrolleri');
  validateLanguageSwitchLayout(input.controls.languageSwitch);
  exactKeys(input.objects,FOCUS_OBJECT_IDS,'Odak nesneleri');
  for(const id of FOCUS_OBJECT_IDS){
    const entry=input.objects[id],isBook=BOOK_OBJECT_IDS.includes(id),isPhysical=PHYSICAL_DEVICE_IDS.includes(id);
    // The two new presentation keys are optional for older authored V1 snapshots.
    exactKeys(entry,['focusMs','returnMs','detailMs','desktop','mobile',
      ...(entry.roomVisible!==undefined?['roomVisible']:[]),
      ...(isBook?['book']:[]),...(isBook&&entry.closedBook!==undefined?['closedBook']:[]),
      ...(isPhysical?['physical']:[]),...(isPhysical&&entry.roomPlacement!==undefined?['roomPlacement']:[])],id);
    if(entry.roomVisible!==undefined&&typeof entry.roomVisible!=='boolean')
      throw Error(id+'.roomVisible boolean olmalı.');
    if(isBook&&entry.closedBook!==undefined){
      exactKeys(entry.closedBook,Object.keys(BOOK_PLACEMENT_LIMITS),id+'.closedBook');
      for(const [key,range] of Object.entries(BOOK_PLACEMENT_LIMITS))
        within(entry.closedBook[key],range,id+'.closedBook.'+key);
    }
    for(const key of ['focusMs','returnMs','detailMs']){
      within(entry[key],key==='detailMs'?[100,2000]:[300,1800],id+'.'+key,true);
    }
    for(const device of ['desktop','mobile']){
      const values=entry[device];
      exactKeys(values,DEVICE_FIELDS,id+'.'+device);
      for(const key of DEVICE_FIELDS)within(values[key],VALUE_LIMITS[key],id+'.'+device+'.'+key);
    }
    if(isPhysical){
      if(entry.roomPlacement!==undefined){
        exactKeys(entry.roomPlacement,Object.keys(ROOM_DEVICE_LIMITS),id+'.roomPlacement');
        for(const [key,range] of Object.entries(ROOM_DEVICE_LIMITS))
          within(entry.roomPlacement[key],range,id+'.roomPlacement.'+key);
      }
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
