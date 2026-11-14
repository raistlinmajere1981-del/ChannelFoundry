// Scene edit tools stay local to Studio. These normalized geometric helpers
// never change scene JSON until the caller validates and commits the result.
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const round=value=>Math.round(value*100000)/100000;
export const SCENE_EDIT_MODES=Object.freeze(['select','visual','hit','effect']);
export function sceneEditMode(value){
  return SCENE_EDIT_MODES.includes(value)?value:'select';
}
export function sceneBoxMove(box,dx,dy){
  return {...box,x:round(clamp(box.x+dx,0,1-box.width)),
    y:round(clamp(box.y+dy,0,1-box.height))};
}
export function sceneBoxResize(box,corner,dx,dy,{aspectLock=false,minSize=.003}={}){
  if(!['nw','ne','sw','se'].includes(corner))throw Error('Geçersiz köşe tutamacı.');
  const west=corner.includes('w'),north=corner.includes('n');
  const right=box.x+box.width,bottom=box.y+box.height;
  let left=west?clamp(box.x+dx,0,right-minSize):box.x;
  let top=north?clamp(box.y+dy,0,bottom-minSize):box.y;
  let width=west?right-left:clamp(box.width+dx,minSize,1-box.x);
  let height=north?bottom-top:clamp(box.height+dy,minSize,1-box.y);
  if(aspectLock){
    const horizontal=west?-dx:dx,vertical=north?-dy:dy;
    const factor=1+(Math.abs(horizontal/box.width)>Math.abs(vertical/box.height)
      ?horizontal/box.width:vertical/box.height);
    const maxWidth=west?right:1-box.x,maxHeight=north?bottom:1-box.y;
    const maximum=Math.min(maxWidth/box.width,maxHeight/box.height);
    const minimum=Math.max(minSize/box.width,minSize/box.height);
    const locked=clamp(factor,minimum,maximum);
    width=box.width*locked;height=box.height*locked;
    left=west?right-width:box.x;top=north?bottom-height:box.y;
  }
  const result={...box,x:round(left),y:round(top),width:round(width),height:round(height)};
  // Floating rounding must never produce x+width > 1 (validator is strict).
  result.width=Math.min(result.width,round(1-result.x));
  result.height=Math.min(result.height,round(1-result.y));
  return result;
}
