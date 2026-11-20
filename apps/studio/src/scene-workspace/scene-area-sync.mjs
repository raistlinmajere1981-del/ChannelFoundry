// One-shot visual/hit geometry alignment. Preserve fixed-aspect artwork.
const round=value=>Math.round(value*1e9)/1e9;
export const areaFromPose=pose=>({x:pose.x,y:pose.y,width:pose.width,height:pose.height});
export function areaFitInside(target,ratio){
  if(!target||![target.x,target.y,target.width,target.height,ratio].every(Number.isFinite)
    ||target.width<=0||target.height<=0||ratio<=0)throw Error('Alan ölçüleri geçersiz.');
  const width=Math.min(target.width,target.height*ratio),height=width/ratio;
  return {x:round(target.x+(target.width-width)/2),y:round(target.y+(target.height-height)/2),
    width:round(width),height:round(height)};
}
export function devicePlacementInside(target,foundation,{minScale=.55,maxScale=1.75}={}){
  if(!foundation?.width||!foundation?.height)throw Error('Cihazın temel görsel alanı bulunamadı.');
  const scale=Math.min(target.width/foundation.width,target.height/foundation.height,maxScale);
  if(scale<minScale-1e-9)throw Error('Tıklama alanı cihazın en küçük ölçeğinden daha dar. Önce tıklama alanını büyütün.');
  const box={x:round(target.x+(target.width-foundation.width*scale)/2),
    y:round(target.y+(target.height-foundation.height*scale)/2),
    width:round(foundation.width*scale),height:round(foundation.height*scale)};
  return {box,placement:{x:round(box.x+box.width/2),y:round(box.y+box.height/2),scale:round(scale)},
    exact:Math.abs(box.width-target.width)<.00001&&Math.abs(box.height-target.height)<.00001};
}
