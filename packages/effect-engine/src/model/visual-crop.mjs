/**
 * Universal visual crop for independent artwork. Values are normalized to the
 * source object frame, except cutoffY, which uses absolute scene coordinates.
 * Cutting the artwork never shifts its interaction or effect anchors.
 */
export const EMPTY_CROP = Object.freeze({top:0,right:0,bottom:0,left:0,cutoffY:null});
export function canCropVisual(item) {
  return Boolean(item && (item.visual?.asset ||
    (Array.isArray(item.motionLayers) && item.motionLayers.length>0)));
}
export function clipInsets(item) {
  const crop=item?.crop;
  const top=crop?.top??0,right=crop?.right??0,bottom=crop?.bottom??0,left=crop?.left??0;
  const cutoffY=crop?.cutoffY;
  const pose=item?.pose;
  const sceneBottom=Number.isFinite(cutoffY)&&pose?.height>0
    ?Math.max(0,Math.min(1,(pose.y+pose.height-cutoffY)/pose.height)):0;
  return {top,right,bottom:Math.max(bottom,sceneBottom),left};
}
export function visualClipStyle(item) {
  const {top,right,bottom,left}=clipInsets(item);
  if(!(top||right||bottom||left))return {};
  return {clipPath:`inset(${top*100}% ${right*100}% ${bottom*100}% ${left*100}%)`};
}
export function validateVisualCrop(crop) {
  if(!crop||typeof crop!=='object'||Array.isArray(crop)||
    Object.keys(crop).some(key=>!['top','right','bottom','left','cutoffY'].includes(key)))
    throw Error('Görsel kırpma: bilinmeyen alan.');
  for(const edge of ['top','right','bottom','left'])
    if(!Number.isFinite(crop[edge])||crop[edge]<0||crop[edge]>.95)
      throw Error('Görsel kırpma kenarları 0–95% arasında olmalı.');
  if(crop.top+crop.bottom>=.99||crop.left+crop.right>=.99)
    throw Error('Görsel kırpma tüm resmi gizleyemez.');
  if(crop.cutoffY!==null&&(!Number.isFinite(crop.cutoffY)||crop.cutoffY<0||crop.cutoffY>1))
    throw Error('Sahne örtme sınırı 0–100% arasında olmalı veya kapalı olmalı.');
  return crop;
}
