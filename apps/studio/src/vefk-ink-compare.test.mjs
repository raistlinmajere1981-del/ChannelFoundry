import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {compareInkMasks} from "./vefk-ink-compare.ts";
function photo(){
  const width=120,height=75;
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const paper=200+(x%5)*2;
    const ink=(x>=15&&x<=18&&y>=12&&y<=65)||(x>=80&&x<=84&&y>=20&&y<=50);
    const scratch=x>=110&&x<=116;
    const dot=(x>=25&&x<=26&&y>=28&&y<=29);
    const v=ink?30:dot?55:scratch?95:paper;
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  return {width,height,data};
}
test("contrast comparison preserves input and orders conservative/current/aggressive candidates",()=>{
  const image=photo(),original=Uint8ClampedArray.from(image.data);
  const result=compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"adaptive",threshold:135,localContrast:22,
  });
  assert.deepEqual(result.map(r=>r.level),[14,22,30]);
  assert.ok(result[0].inkPixels>=result[1].inkPixels);
  assert.ok(result[1].inkPixels>=result[2].inkPixels);
  assert.deepEqual(image.data,original);
  assert.deepEqual(result,compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"adaptive",threshold:135,localContrast:22,
  }));
});
test("preview diagnostics and tracing apply identical non-mutating exclusion coordinates",()=>{
  const image=photo();
  const original=compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"adaptive",threshold:135,localContrast:22,
  });
  const masked=compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"adaptive",threshold:135,localContrast:22,
    excludedAreas:[[900,0,100,1000]],
  });
  const mid=masked.find(x=>x.level===22);
  assert.ok(mid.excludedPixels>0);
  assert.equal(original[1].inkPixels-mid.inkPixels,mid.excludedPixels);
  assert.equal(mid.mask.length,image.width*image.height);
});
test("global threshold and clamp endpoints remain bounded and unique",()=>{
  const image=photo();
  assert.deepEqual(compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"global",threshold:35,localContrast:22,
  }).map(c=>c.level),[35,55]);
  assert.deepEqual(compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"adaptive",threshold:135,localContrast:55,
  }).map(c=>c.level),[47,55]);
  assert.throws(()=>compareInkMasks(image,[0,0,1000,1000],{
    inkMode:"adaptive",threshold:135,localContrast:22,
    excludedAreas:[[990,0,20,200]],
  }),/koordinatları/);
});

test("Studio only shows opt-in comparison and never changes approved paths on level selection",()=>{
  const url=new URL("./VefkSourceWorkbench.tsx",import.meta.url);
  const source=fs.readFileSync(url,"utf8");
  assert.match(source,/compareSelectedMasks\(/);
  assert.match(source,/compareInkMasks\(image,selectedRegion\.box/);
  assert.match(source,/3 maskeyi karşılaştır/);
  assert.match(source,/maskComparison\.candidates\.map/);
  assert.match(source,/setLocalContrast\(candidate\.level\)/);
  assert.match(source,/setThreshold\(candidate\.level\)/);
  assert.match(source,/Seçimden sonra konturları yeniden izle/);
});
