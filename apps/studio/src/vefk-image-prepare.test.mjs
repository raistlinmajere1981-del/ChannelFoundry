import test from "node:test";
import assert from "node:assert/strict";
import {
  FULL_CORNERS,validatePreparation,rotateCorners,preparedDimensions,
  squareToQuad,prepareRgba,
} from "./vefk-image-prepare.ts";

function image(w=100,h=60) {
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=4*(y*w+x);
    data[p]=x*255/(w-1);data[p+1]=y*255/(h-1);
    data[p+2]=0;data[p+3]=255;
  }
  return {width:w,height:h,data};
}
const rgb=(img,x,y)=>Array.from(img.data.slice(4*(y*img.width+x),4*(y*img.width+x)+3));
test("full-image identity transform preserves source pixels and dimensions",()=>{
  const input=image();
  const settings={corners:FULL_CORNERS,contrast:1,brightness:0};
  assert.deepEqual(preparedDimensions(input.width,input.height,FULL_CORNERS),{width:100,height:60});
  const result=prepareRgba(input,settings);
  assert.deepEqual(result.data,input.data);
});
test("single square-to-quad perspective correctly maps all four control points",()=>{
  const corners=[
    {x:100,y:200},{x:920,y:130},{x:825,y:925},{x:180,y:835},
  ];
  const transform=squareToQuad(corners);
  const coords=[[0,0],[1,0],[1,1],[0,1]];
  for(let i=0;i<4;i++){
    const p=transform(...coords[i]);
    assert.ok(Math.abs(p.x-corners[i].x)<1e-7);
    assert.ok(Math.abs(p.y-corners[i].y)<1e-7);
  }
  const center=transform(.5,.5);
  assert.ok(center.x>250&&center.x<700&&center.y>300&&center.y<700);
});
test("crop and 90-degree rotation preserve intrinsic proportions",()=>{
  const crop=[{x:200,y:250},{x:800,y:250},{x:800,y:750},{x:200,y:750}];
  assert.deepEqual(preparedDimensions(200,100,crop),{width:120,height:50});
  const clockwise=rotateCorners(crop);
  assert.deepEqual(preparedDimensions(200,100,clockwise),{width:50,height:120});
  const input=image(100,60);
  const rotated=prepareRgba(input,{corners:rotateCorners(FULL_CORNERS),contrast:1,brightness:0});
  assert.equal(rotated.width,60);assert.equal(rotated.height,100);
  // new top left is original bottom left; should be green, not red
  const topLeft=rgb(rotated,0,0),bottomRight=rgb(rotated,59,99);
  assert.ok(topLeft[1]>240&&topLeft[0]<15);
  assert.ok(bottomRight[0]>240&&bottomRight[1]<15);
});
test("contrast brightness apply to prepared output but never mutate source",()=>{
  const input=image(),copy=Uint8ClampedArray.from(input.data);
  const result=prepareRgba(input,{corners:FULL_CORNERS,contrast:1.3,brightness:15});
  assert.equal(result.width,input.width);
  assert.ok(rgb(result,50,30)[0]>rgb(input,50,30)[0]);
  assert.deepEqual(input.data,copy);
});
test("rejects crossed corners, tiny crop, invalid brightness, excessive raster",()=>{
  const cross=[
    {x:0,y:0},{x:1000,y:1000},{x:1000,y:0},{x:0,y:1000},
  ];
  assert.throws(()=>validatePreparation({corners:cross,contrast:1,brightness:0}),/kesişemez|küçük/);
  assert.throws(()=>validatePreparation({corners:[
    {x:4,y:4},{x:8,y:4},{x:8,y:8},{x:4,y:8},
  ],contrast:1,brightness:0}),/küçük/);
  assert.throws(()=>validatePreparation({corners:FULL_CORNERS,contrast:10,brightness:0}),/Kontrast/);
  assert.throws(()=>prepareRgba(image(),{corners:FULL_CORNERS,contrast:1,brightness:0},{width:1900,height:1900}),/boyutları/);
});
