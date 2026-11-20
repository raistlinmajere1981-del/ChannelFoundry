// Studio-only projection of physical device geometry. The website owns the
// canonical hitArea and the independent room presentation; editing overlays
// are derived from those records rather than stored as a third coordinate.
import {
  defaultRoomDevicePlacement,
  roomDevicePlacement,
  placedDeviceHitArea,
  PHYSICAL_DEVICE_IDS,
} from '../../../../packages/effect-engine/src/model/scene-presentation.mjs';

const isDevice = id => PHYSICAL_DEVICE_IDS.includes(id);
const snap = value => Math.round(value * 1e9) / 1e9;
// The Vefk desk cutout still uses its historical 1024×1536 canvas, but the
// actual chassis alpha ends at pixel row 1203. All paper/pen/ink layers are
// inside this bound. The remaining bottom 333px are transparent, not a device.
// Keep the native full frame for site effects and source artwork. Studio's
// selection geometry must refer to the VISIBLE device, not the padding.
const visibleRegion = id => id === 'vefk-stand'
  ? {x:0,y:0,width:1,height:1203/1536}
  : {x:0,y:0,width:1,height:1};

export function deviceVisibleFoundation(id,foundation) {
  const region=visibleRegion(id);
  return {width:foundation.width*region.width,height:foundation.height*region.height};
}
export function deviceVisibleBox(presentation,id,roomObjects) {
  const outer=deviceRoomBox(presentation,id,roomObjects);
  if(!outer)return null;
  const region=visibleRegion(id);
  return {x:outer.x+outer.width*region.x,y:outer.y+outer.height*region.y,
    width:outer.width*region.width,height:outer.height*region.height};
}
export function devicePlacementFromVisibleBox(presentation,id,visible,roomObjects) {
  const record=roomObjects?.get(id);
  if(record?.kind!=='device')throw Error('Cihazın görsel alanı bulunamadı: '+id);
  const foundation=record.foundation,region=visibleRegion(id);
  const scale=visible.width/(foundation.width*region.width);
  const outerWidth=foundation.width*scale,outerHeight=foundation.height*scale;
  return {...roomDevicePlacement(presentation,id),
    x:snap(visible.x-outerWidth*region.x+outerWidth/2),
    y:snap(visible.y-outerHeight*region.y+outerHeight/2),
    scale:snap(scale)};
}


// The room figure is positioned by its CENTER, native geometry boxes by their
// upper-left corner. Convert them once for all Studio overlay layers.
export function deviceRoomBox(presentation, id, roomObjects) {
  if (!isDevice(id)) return null;
  const record = roomObjects?.get(id);
  if (!record || record.kind !== 'device') return null;
  const placement = roomDevicePlacement(presentation, id);
  const width = record.foundation.width * placement.scale;
  const height = record.foundation.height * placement.scale;
  return { x: placement.x - width / 2, y: placement.y - height / 2, width, height };
}

export function deviceStageHit(presentation, id, hitArea) {
  return hitArea && isDevice(id)
    ? placedDeviceHitArea(presentation, id, hitArea)
    : hitArea;
}

export function deviceNativeHit(presentation, id, stageArea) {
  if (!stageArea || !isDevice(id)) return stageArea;
  const {x,y,scale} = roomDevicePlacement(presentation,id);
  const home = defaultRoomDevicePlacement(id);
  return {
    x:snap(home.x + (stageArea.x-x)/scale),
    y:snap(home.y + (stageArea.y-y)/scale),
    width:snap(stageArea.width/scale),
    height:snap(stageArea.height/scale),
  };
}

export function deviceStagePoint(presentation, id, point) {
  if (!isDevice(id)) return point;
  const {x,y,scale} = roomDevicePlacement(presentation,id);
  const home = defaultRoomDevicePlacement(id);
  return { x:x+(point.x-home.x)*scale,y:y+(point.y-home.y)*scale };
}
