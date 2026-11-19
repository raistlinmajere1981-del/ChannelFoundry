// One source of truth for the closed photographic book's Studio edit box.
// The image is 3:2, the room is 2:1: source height in room units is 4/3 width.
const ratio=4/3;
const round=x=>Math.round(x*1e9)/1e9;
export function bookStageArea(placement){
  const width=placement.width,height=width*ratio*(placement.surfaceScaleY??1);
  return {x:round(placement.x-width/2),y:round(placement.y-height/2),width:round(width),height:round(height)};
}
export function bookPlacementFromArea(original,area){
  return {...original,x:round(area.x+area.width/2),y:round(area.y+area.height/2),
    width:round(area.width),surfaceScaleY:round(area.height/(area.width*ratio))};
}
// Keep the existing relative hit padding when the actual book art moves or resizes.
export function linkedArea(original,updated,box){
  const sx=updated.width/original.width,sy=updated.height/original.height;
  return {x:round(updated.x+(box.x-original.x)*sx),
    y:round(updated.y+(box.y-original.y)*sy),
    width:round(box.width*sx),height:round(box.height*sy)};
}
export function bookMarkerPoint(placement,pose,point){
  const area=bookStageArea(placement);
  return {x:round(area.x+(point.x-pose.x)/pose.width*area.width),
    y:round(area.y+(point.y-pose.y)/pose.height*area.height)};
}
