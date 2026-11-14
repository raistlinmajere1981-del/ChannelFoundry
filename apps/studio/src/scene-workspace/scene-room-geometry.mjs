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
