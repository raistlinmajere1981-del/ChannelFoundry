import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {excludeInkFromMask} from "./vefk-ink-exclusions.ts";
import {traceInk} from "./vefk-image-trace.ts";
function sample(width,height,draw){
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++){data[i*4]=255;data[i*4+1]=255;data[i*4+2]=255;data[i*4+3]=255;}
  const dot=(x,y)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;};
  draw(dot);
  return {width,height,data};
}
test("manual exclusion removes only selected pixels, does not mutate classifier output",()=>{
  const input=new Uint8Array(100*100);
  for(let y=10;y<90;y++){input[y*100+20]=1;input[y*100+70]=1;}
  const original=Uint8Array.from(input);
  const out=excludeInkFromMask(input,100,100,[0,0,1000,1000],[[600,0,200,1000]]);
  assert.equal(out.excludedPixels,80);
  assert.equal(out.mask.reduce((s,n)=>s+n,0),80);
  assert.deepEqual(input,original);
  const repeat=excludeInkFromMask(input,100,100,[0,0,1000,1000],
    [[600,0,200,1000],[650,0,100,1000]]);
  assert.equal(repeat.excludedPixels,80,"overlapping areas do not double-count ink");
});
test("source subregion projection clips exclusions and preserves detached Arabic dots outside it",()=>{
  const input=new Uint8Array(80*80);
  input[20*80+10]=1;input[20*80+50]=1;
  const region=[200,400,400,200];
  const first=excludeInkFromMask(input,80,80,region,[[450,430,80,80]]);
  assert.equal(first.excludedPixels,1);
  assert.equal(first.mask[20*80+10],1);
  assert.equal(first.mask[20*80+50],0);
  const beyond=excludeInkFromMask(input,80,80,region,[[650,430,50,50]]);
  assert.deepEqual(beyond.mask,input);
});
test("actual SVG trace excludes only a user-marked false stroke and never patches gaps",()=>{
  const image=sample(100,100,dot=>{
    for(let y=15;y<=85;y++){dot(20,y);dot(70,y);}
    dot(26,40);dot(27,40);
  });
  const before=traceInk(image,[0,0,1000,1000],"region-086",
    {preserveDots:true});
  const excluded=traceInk(image,[0,0,1000,1000],"region-086",
    {preserveDots:true,excludedAreas:[[600,0,180,1000]]});
  assert.equal(before.quality.excludedPixels,0);
  assert.equal(excluded.quality.excludedPixels,71);
  assert.ok(excluded.paths.length<before.paths.length);
  assert.equal(excluded.quality.preservedDots,1,"diacritic near retained stroke survives");
  assert.deepEqual(excluded,traceInk(image,[0,0,1000,1000],"region-086",
    {preserveDots:true,excludedAreas:[[600,0,180,1000]]}));
});
test("malformed, oversize or inverted paper mask commands fail closed",()=>{
  const mask=new Uint8Array(50*50);
  assert.throws(()=>excludeInkFromMask(mask,50,50,[0,0,1000,1000],[[990,0,20,20]]),/koordinatları/);
  assert.throws(()=>excludeInkFromMask(mask,50,50,[0,0,1000,1000],[[10,10,-5,5]]),/koordinatları/);
  assert.throws(()=>excludeInkFromMask(mask,50,50,[0,0,1000,1000],Array(25).fill([0,0,10,10])),/24/);
  assert.throws(()=>excludeInkFromMask(mask,512,50,[0,0,1000,1000],[]),/boyutları/);
});
test("Studio mask preview and exclusion changes invalidate paths without touching site handoff",()=>{
  const source=fs.readFileSync(new URL("./VefkSourceWorkbench.tsx",import.meta.url),"utf8");
  assert.match(source,/function previewSelectedMask\(/);
  assert.match(source,/classifyInk\(image/);
  assert.match(source,/excludeInkFromMask\(/);
  assert.match(source,/function changeExcludedAreas\(/);
  assert.match(source,/traces:working\.traces\.filter\(group=>group\.regionId!==regionId\)/);
  assert.match(source,/maskPreview\.dataUrl/);
  assert.match(source,/excludedAreas:selectedExclusions/);

});
