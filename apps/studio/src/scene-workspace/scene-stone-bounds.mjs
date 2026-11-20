// Studio-only alpha-tight bounds for the two-layer stone specimen.
// Source images: hammered-copper-plate.webp (600x548, alpha y=370..518),
// jade-rock.webp (512x512, alpha y=43..506), on moving layer
// {x:.29,y:.45,width:.52,height:.48}; contact shadow ends near .96.
// Margins contain the physical shadow. No source asset, effect anchor, crop,
// or website presentation geometry is rewritten by these calculations.
export const STONE_VISIBLE_REGION=Object.freeze({
  x:.075,y:.475,width:.86,height:.505
});
const round=(n)=>Math.round(n*1e9)/1e9;
export function stoneVisibleArea(pose){
  const r=STONE_VISIBLE_REGION;
  return {x:round(pose.x+pose.width*r.x),y:round(pose.y+pose.height*r.y),
    width:round(pose.width*r.width),height:round(pose.height*r.height)};
}
export function stonePoseFromVisibleArea(pose,visible){
  const r=STONE_VISIBLE_REGION;
  if(!visible||!['x','y','width','height'].every(k=>Number.isFinite(visible[k]))
      ||visible.width<=0||visible.height<=0)throw Error('Görünür taş alanı geçersiz.');
  const width=visible.width/r.width,height=visible.height/r.height;
  return {...pose,x:round(visible.x-width*r.x),y:round(visible.y-height*r.y),
    width:round(width),height:round(height)};
}
