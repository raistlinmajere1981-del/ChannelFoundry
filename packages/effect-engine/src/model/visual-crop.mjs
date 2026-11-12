/**
 * Non-destructive, normalized image clipping. Geometry is always based on the
 * authored scene object, so the wall/desk boundary stays fixed while it moves.
 * Crop affects artwork; effect mounts keep their own coordinates.
 */
export const CROPPABLE_OBJECTS = Object.freeze({
  'stone-specimen': 'rock',
  'ceremonial-robe': 'fabric',
  'ceremonial-dagger': 'blade',
  'archive-chest': 'lid',
});
export const DEFAULT_ROBE_DESK_Y = .57;
export const EMPTY_CROP = Object.freeze({top:0,right:0,bottom:0,left:0,deskY:null});
export function canCropVisual(item) {
  return Boolean(item && item.motionLayers?.includes(CROPPABLE_OBJECTS[item.id]));
}
export function clipInsets(item, defaultDeskY = null) {
  const crop = item?.crop;
  const top = crop?.top ?? 0, right = crop?.right ?? 0,
    bottom = crop?.bottom ?? 0, left = crop?.left ?? 0;
  const deskY = crop ? crop.deskY : defaultDeskY;
  const pose = item?.pose;
  const deskBottom = Number.isFinite(deskY) && pose?.height > 0
    ? Math.max(0,Math.min(1,(pose.y + pose.height - deskY) / pose.height)) : 0;
  return {top,right,bottom:Math.max(bottom,deskBottom),left};
}
export function visualClipStyle(item,defaultDeskY=null) {
  const {top,right,bottom,left} = clipInsets(item,defaultDeskY);
  if(!(top||right||bottom||left))return {};
  return {clipPath:`inset(${top*100}% ${right*100}% ${bottom*100}% ${left*100}%)`};
}
export function validateVisualCrop(crop) {
  if(!crop || typeof crop!=='object' || Array.isArray(crop) ||
    Object.keys(crop).some(key=>!['top','right','bottom','left','deskY'].includes(key)))
    throw Error('Görsel kırpma: bilinmeyen alan.');
  for(const edge of ['top','right','bottom','left'])
    if(!Number.isFinite(crop[edge])||crop[edge]<0||crop[edge]>.95)
      throw Error('Görsel kırpma kenarları 0–95% arasında olmalı.');
  if(crop.top+crop.bottom>=.99||crop.left+crop.right>=.99)
    throw Error('Görsel kırpma tüm resmi gizleyemez.');
  if(crop.deskY!==null && (!Number.isFinite(crop.deskY)||crop.deskY<0||crop.deskY>1))
    throw Error('Masa örtme çizgisi 0–100% arasında olmalı veya kapalı olmalı.');
  return crop;
}
