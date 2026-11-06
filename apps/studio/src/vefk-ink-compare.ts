import {classifyInk, type InkMode} from "./vefk-ink-mask.ts";
import {excludeInkFromMask, type InkBox} from "./vefk-ink-exclusions.ts";

export type InkCandidate={
  level:number;
  inkPixels:number;
  density:number;
  edgeDensity:number;
  excludedPixels:number;
  mask:Uint8Array;
};
/** Side-by-side diagnostics only. Does not select thresholds or mutate a saved trace. */
export function compareInkMasks(
  image:{width:number;height:number;data:Uint8ClampedArray},
  region:InkBox,
  settings:{
    inkMode:InkMode;
    threshold:number;
    localContrast:number;
    invert?:boolean;
    excludedAreas?:ReadonlyArray<InkBox>;
  },
):InkCandidate[]{
  const {width,height}=image;
  const adaptive=settings.inkMode==="adaptive";
  const current=adaptive?settings.localContrast:settings.threshold;
  // Match the bounds selectable in the Studio controls (not broader core bounds).
  const min=adaptive?8:35,max=adaptive?55:220,step=adaptive?8:20;
  const levels=[Math.max(min,current-step),current,Math.min(max,current+step)]
    .filter((value,index,array)=>array.indexOf(value)===index).sort((a,b)=>a-b);
  return levels.map(level=>{
    const classified=classifyInk(image,{
      threshold:adaptive?settings.threshold:level,
      localContrast:adaptive?level:settings.localContrast,
      inkMode:settings.inkMode,
      invert:settings.invert,
    });
    const {mask,excludedPixels}=excludeInkFromMask(
      classified.mask,width,height,region,settings.excludedAreas,
    );
    const inkPixels=classified.count-excludedPixels;
    const boundary=Math.max(2,Math.min(5,Math.floor(Math.min(width,height)/12)));
    let edgePixels=0,edgeInk=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(x<boundary||y<boundary||x>=width-boundary||y>=height-boundary){
        edgePixels++;
        edgeInk+=mask[y*width+x];
      }
    }
    return {
      level,inkPixels,
      density:Number((100*inkPixels/(width*height)).toFixed(1)),
      edgeDensity:Number((100*edgeInk/edgePixels).toFixed(1)),
      excludedPixels,mask,
    };
  });
}
