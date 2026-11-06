import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { traceInk, thinInkMask, projectTracedGeometry } from "./vefk-image-trace.ts";
const require=createRequire(import.meta.url);
const {normalizeGeometry}=require("../vefk-core/geometry.cjs");
const {createVefk}=require("../vefk-core/document.cjs");
import {createVefkPlayer} from "../../../docs/contracts/vefk-site-consumer.mjs";

function pixels(w,h,draw){
  const data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){data[i*4]=255;data[i*4+1]=255;data[i*4+2]=255;data[i*4+3]=255;}
  const dark=(x,y)=>{
    const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=0;
  };
  draw(dark,w,h);
  return {width:w,height:h,data};
}
function validate(lines){
  const paths=lines.map(item=>({id:item.id,d:item.d,ink:"trace"}));
  return normalizeGeometry({coordinateSpace:"svg-viewBox",viewBox:[0,0,1000,1000],
    paths,inkStyles:{trace:{width:5,cap:"round"}}});
}

test("a 5px vertical ink stroke is thinned to a single centerline in S1 M/L geometry",()=>{
  const img=pixels(80,80,(dot)=>{for(let y=12;y<=65;y++)for(let x=37;x<=41;x++)dot(x,y);});
  const result=traceInk(img,[150,80,500,700],"region-001");
  assert.ok(result.paths.length>0&&result.paths.length<=3);
  const geom=validate(result.paths);
  assert.ok(geom.paths[0].d.includes("M "));
  assert.ok(geom.paths[0].d.includes("L "));
  assert.ok(result.thinnedPixels<result.inkPixels);
  const result2=traceInk(img,[150,80,500,700],"region-001");
  assert.deepEqual(result.paths,result2.paths,"Same source must always yield identical path IDs and coordinates");
});

test("two strokes stay distinct and speckle noise is rejected",()=>{
  const img=pixels(90,90,(dot)=>{
    for(let x=12;x<38;x++)dot(x,19);
    for(let y=35;y<74;y++)dot(65,y);
    dot(80,80);dot(80,81);
  });
  const result=traceInk(img,[0,0,1000,1000],"region-025");
  assert.equal(result.paths.length,2);
  assert.equal(new Set(result.paths.map(p=>p.id)).size,2);
  validate(result.paths);
});

test("closed ink outline survives thinning and trace, and coordinates map to cropped source box",()=>{
  const img=pixels(100,100,dot=>{
    for(let x=15;x<=83;x++)for(let k=0;k<3;k++){dot(x,15+k);dot(x,83-k);}
    for(let y=15;y<=83;y++)for(let k=0;k<3;k++){dot(15+k,y);dot(83-k,y);}
  });
  const out=traceInk(img,[200,200,500,500],"region-002",{simplify:1.2});
  assert.ok(out.paths.length>=1);
  const g=validate(out.paths);
  for(const path of g.paths)for(const match of path.d.matchAll(/[ML] ([+-]?\d+(?:\.\d+)?) ([+-]?\d+(?:\.\d+)?)/g)){
    assert.ok(Number(match[1])>=200&&Number(match[1])<=700);
    assert.ok(Number(match[2])>=200&&Number(match[2])<=700);
  }
});

test("invalid region, empty image, black field and too strict path limit fail safely",()=>{
  const white=pixels(70,70,()=>{});
  assert.throws(()=>traceInk(white,[0,0,1000,1000],"region-001"),/bulunamadı/);
  assert.throws(()=>traceInk(white,[0,0,1000,1000],"abc"),/kimliği/);
  assert.throws(()=>traceInk(white,[-1,0,100,100],"region-001"),/sınır/);
  const black=pixels(70,70,dot=>{for(let y=0;y<70;y++)for(let x=0;x<70;x++)dot(x,y);});
  assert.throws(()=>traceInk(black,[0,0,1000,1000],"region-001"),/çoğu/);
  const many=pixels(90,90,dot=>{
    for(let x=10;x<=70;x+=20)for(let y=10;y<=70;y++)dot(x,y);
  });
  assert.throws(()=>traceInk(many,[0,0,1000,1000],"region-001",{maxPaths:1}),/fazla/);
});

test("thinning does not mutate input mask",()=>{
  const width=25,height=25,input=new Uint8Array(width*height);
  for(let y=4;y<20;y++)for(let x=10;x<=14;x++)input[y*width+x]=1;
  const original=Uint8Array.from(input);
  const out=thinInkMask(input,width,height);
  assert.deepEqual(input,original);
  assert.ok(out.reduce((a,b)=>a+b,0)<original.reduce((a,b)=>a+b,0));
});

test("aged paper gradient is separated from dark ink using bounded adaptive contrast",()=>{
  const width=120,height=100;
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const shade=152+Math.round(90*x/(width-1));
    const stroke=((x>=15&&x<=17)||(x>=92&&x<=94))&&y>=12&&y<=87;
    const v=stroke?28:shade,i=(y*width+x)*4;
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  const image={width,height,data};
  const adaptive=traceInk(image,[0,0,1000,1000],"region-003",
    {inkMode:"adaptive",localContrast:24,minLength:5});
  assert.equal(adaptive.quality.mode,"adaptive");
  assert.ok(adaptive.quality.inkFraction<.09,
    "Local threshold should not interpret the dark side of old parchment as a stroke.");
  assert.ok(adaptive.paths.length>=2 && adaptive.paths.length<=4);
  validate(adaptive.paths);
  assert.deepEqual(
    adaptive.paths,traceInk(image,[0,0,1000,1000],"region-003",
      {inkMode:"adaptive",localContrast:24,minLength:5}).paths);
});

test("optional small Arabic-style dots near a major stroke are saved while distant noise is discarded",()=>{
  const img=pixels(100,100,dot=>{
    for(let y=15;y<=80;y++)for(let x=35;x<=37;x++)dot(x,y);
    dot(42,36);dot(43,36);
    dot(82,86);dot(83,86);
    dot(60,90);
  });
  const quiet=traceInk(img,[0,0,1000,1000],"region-008",{preserveDots:false});
  const detailed=traceInk(img,[0,0,1000,1000],"region-008",{preserveDots:true});
  assert.equal(quiet.quality.preservedDots,0);
  assert.equal(detailed.quality.preservedDots,1);
  assert.equal(detailed.paths.length,quiet.paths.length+1);
  assert.ok(detailed.quality.removedSpeckles>=2);
  assert.ok(detailed.paths.some(item=>/L \d+(?:\.\d+)? \d+(?:\.\d+)?$/.test(item.d)));
  validate(detailed.paths);
});

test("local classifier parameters are range-checked and unsupported modes fail safely",()=>{
  const img=pixels(60,60,dot=>{for(let y=10;y<40;y++)dot(20,y);});
  assert.throws(()=>traceInk(img,[0,0,1000,1000],"region-014",
    {inkMode:"adaptive",localContrast:0}),/kontrast/);
  assert.throws(()=>traceInk(img,[0,0,1000,1000],"region-014",
    {inkMode:"adaptive",localContrast:500}),/kontrast/);
  assert.throws(()=>traceInk(img,[0,0,1000,1000],"region-014",
    {inkMode:"magic"}),/yöntemi/);
});

test("Studio visual tracing presents adaptive/standard methods, high resolution, and explicit review gate",()=>{
  const studioSource=fs.readFileSync(new URL("./VefkSourceWorkbench.tsx", import.meta.url),"utf8");
  assert.match(studioSource,/Yerel kontrast/);
  assert.match(studioSource,/Sabit eşik/);
  assert.match(studioSource,/480 px/);
  assert.match(studioSource,/Noktaları koru/);
  assert.match(studioSource,/traceInk\(/);
  assert.match(studioSource,/localContrast,preserveDots/);
  assert.match(studioSource,/reviewTrace\(selected, true\)/);

});

test("inverted polarity rejects parchment foreground instead of overwriting reviewed traces",()=>{
  const paper=pixels(90,90,dot=>{for(let y=8;y<=80;y++)for(let x=37;x<=40;x++)dot(x,y);});
  const normal=traceInk(paper,[0,0,1000,1000],"region-034",{
    inkMode:"adaptive",localContrast:22,invert:false
  });
  assert.ok(normal.paths.length>=1);
  assert.throws(()=>traceInk(paper,[0,0,1000,1000],"region-034",{
    inkMode:"adaptive",localContrast:22,invert:true
  }),/Ters renk.*açık kâğıt/);
});

test("inverted polarity still works for real white ink on dark ground",()=>{
  const width=90,height=90,data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const light=x>=25&&x<=29&&y>=15&&y<=75;
    const value=light?240:26;
    const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  const result=traceInk({width,height,data},[0,0,1000,1000],"region-035",{
    invert:true,inkMode:"adaptive",localContrast:22
  });
  assert.ok(result.paths.length>0);
  validate(result.paths);
});

test("T junction preserves its side arm but joins the straight calligraphy baseline",()=>{
  const img=pixels(110,110,dot=>{
    for(let x=18;x<=90;x++)dot(x,42);
    for(let y=42;y<=90;y++)dot(53,y);
  });
  const result=traceInk(img,[0,0,1000,1000],"region-040");
  assert.equal(result.paths.length,2);
  assert.ok(result.quality.joinedSegments>=1);
  validate(result.paths);
  assert.deepEqual(result.paths,traceInk(img,[0,0,1000,1000],"region-040").paths);
});

test("crossing ink lines pair opposite tangents instead of breaking into four strokes",()=>{
  const img=pixels(100,100,dot=>{
    for(let x=15;x<=85;x++)dot(x,50);
    for(let y=15;y<=85;y++)dot(50,y);
  });
  const result=traceInk(img,[0,0,1000,1000],"region-041");
  assert.equal(result.paths.length,2);
  assert.ok(result.quality.joinedSegments>=2);
  validate(result.paths);
});

test("Y-shaped handwriting keeps three distinct branches and never bridges a detached mark",()=>{
  const img=pixels(110,110,dot=>{
    for(let y=14;y<=49;y++)dot(52,y);
    for(let n=0;n<=25;n++){dot(52-n,49+n);dot(52+n,49+n);}
    for(let x=16;x<=39;x++)dot(x,92);
    for(let x=43;x<=85;x++)dot(x,92); // explicit blank gap
  });
  const result=traceInk(img,[0,0,1000,1000],"region-042");
  assert.ok(result.paths.length>=5,"Y branches plus both detached lines must remain independent");
  validate(result.paths);
});

test("closed seal contour stays two-dimensional after loop-aware simplification",()=>{
  const img=pixels(110,110,dot=>{
    for(let x=22;x<=87;x++){dot(x,22);dot(x,87);}
    for(let y=22;y<=87;y++){dot(22,y);dot(87,y);}
  });
  const result=traceInk(img,[0,0,1000,1000],"region-043",{simplify:3});
  assert.ok(result.paths.length>=1);
  validate(result.paths);
  const points=[...result.paths[0].d.matchAll(/[ML] (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g)]
    .map(match=>({x:Number(match[1]),y:Number(match[2])}));
  assert.ok(new Set(points.map(p=>p.x+","+p.y)).size>=4);
  assert.ok(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))>400);
  assert.ok(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))>400);
});

test("source aspect is restored only in the exported geometry, including landscape and portrait",()=>{
  const reviewed=[{id:"trace.region-001.001",d:"M 100 250 L 500 750"}];
  const before=structuredClone(reviewed);
  const wide=projectTracedGeometry(reviewed,2400,1200);
  const tall=projectTracedGeometry(reviewed,900,1800);
  assert.deepEqual(wide.viewBox,[0,0,2000,1000]);
  assert.deepEqual(tall.viewBox,[0,0,500,1000]);
  assert.equal(wide.paths[0].d,"M 200 250 L 1000 750");
  assert.equal(tall.paths[0].d,"M 50 250 L 250 750");
  assert.deepEqual(reviewed,before,"saved normalized review paths must be untouched");
  for(const entry of [wide,tall]){
    const normalized=normalizeGeometry({coordinateSpace:"svg-viewBox",...entry,
      inkStyles:{trace:{width:5,cap:"round"}}});
    assert.deepEqual(normalized.viewBox,entry.viewBox);
  }
  assert.throws(()=>projectTracedGeometry(reviewed,0,1200),/genişliği/);
  assert.throws(()=>projectTracedGeometry(reviewed,1200,0),/yüksekliği/);
  assert.throws(()=>projectTracedGeometry([{id:"bad",d:"M 1 2 Q 3 4"}],1200,1200),/M\/L\/Z/);
});

test("region correction invalidates stale traces and the Studio SVG editor honors the viewBox aspect",()=>{
  const source=fs.readFileSync(new URL('./VefkSourceWorkbench.tsx',import.meta.url),'utf8');
  const editor=fs.readFileSync(new URL('./VefkWorkshop.tsx',import.meta.url),'utf8');
  assert.match(source,/function updateRegionBox\(/);
  assert.match(source,/traces: working\.traces\.filter\(group => group\.regionId !== regionId\)/);
  assert.match(source,/needsReview: true/);
  assert.match(source,/projectTracedGeometry\(/);
  assert.match(editor,/aspect=\{reviewing \? sourceProgress\?\.aspect \?\? 1 : stageWidth\/stageHeight\}/);
  assert.match(editor,/width=\{stageWidth\} height=\{stageHeight\}/);
});

test("portrait trace geometry survives S1 document hash and site draw-plan player unchanged",()=>{
  const projection=projectTracedGeometry([
    {id:"trace.region-001.001",d:"M 100 100 L 200 500 L 700 900"},
  ],900,1800);
  const document=createVefk({id:"qa-portrait-trace",title:"Portrait source QA",revision:1,
    kind:"manualPaths",geometry:{coordinateSpace:"svg-viewBox",...projection,
      inkStyles:{trace:{width:5,cap:"round"}}}});
  assert.deepEqual(document.geometry.viewBox,[0,0,500,1000]);
  assert.equal(document.geometry.paths[0].d,"M 50 100 L 100 500 L 350 900");
  assert.match(document.contentHash,/^[a-f0-9]{64}$/);
  const player=createVefkPlayer(document);
  const frame=player.frameAt(document.drawPlan.durationMs);
  assert.ok(frame.visibility.some(item=>item.pathId==="trace.region-001.001"&&item.fraction===1));
  assert.ok(frame.pen.position.x>=0&&frame.pen.position.x<=500);
  assert.ok(frame.pen.position.y>=0&&frame.pen.position.y<=1000);
});
