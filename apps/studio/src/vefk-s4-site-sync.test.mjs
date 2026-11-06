import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createVefkPlayer as canonicalPlayer} from "../../../docs/contracts/vefk-site-consumer.mjs";
import {createVefkPlayer as sitePlayer} from "../../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs";
import {
  fitContainViewBox,mapSvgPointToNormalized,
  normalizedPointToScreen,strokeDashForFraction,
} from "../../../channels/birdesengor/web/src/vefk/geometry.js";
const require=createRequire(import.meta.url);
const core=require("../vefk-core/index.cjs");
const root=new URL("./",import.meta.url);
function manual(){
  return core.createVefk({
    id:"s4-synthetic-scroll",title:"S4 · Divit / mürekkep eşzamanlılık testi",
    kind:"manualPaths",
    geometry:{
      coordinateSpace:"svg-viewBox",viewBox:[0,0,1331.295,1000],
      inkStyles:{glyph:{width:5,cap:"round"}},
      paths:[
        {id:"arabic.multi",ink:"glyph",d:"M 10 50 L 260 50 M 390 50 L 520 70"},
        {id:"seal.closed",ink:"glyph",d:"M 630 80 L 980 80 L 980 430 L 630 430 Z"},
        {id:"diacritic",ink:"glyph",d:"M 1050 150 L 1060 160"},
      ],
    },
  });
}
function testsForDocument(doc){
  const a=canonicalPlayer(doc),b=sitePlayer(doc);
  const times=new Set([0,a.durationMs,a.durationMs+100,-10]);
  for(let i=0;i<=240;i++)times.add(a.durationMs*i/240);
  for(const stroke of doc.drawPlan.strokes){
    times.add(stroke.startMs);
    times.add(stroke.startMs+stroke.durationMs*.25);
    times.add(stroke.startMs+stroke.durationMs*.75);
    times.add(stroke.startMs+stroke.durationMs);
  }
  for(const t of times){
    const left=a.frameAt(t),right=b.frameAt(t);
    assert.deepEqual(right,left,"Studio/site player drift at "+t);
    assert.equal(left.visibility.length,doc.geometry.paths.length);
    for(const path of doc.geometry.paths){
      const progress=left.visibility.find(v=>v.pathId===path.id);
      assert.ok(progress&&progress.fraction>=0&&progress.fraction<=1);
      const dash=strokeDashForFraction(progress.fraction);
      assert.equal(Number(dash.dashOffset),1-progress.fraction);
    }
    const p=left.pen.position,box=doc.geometry.viewBox;
    for(const [width,height] of [[760,430],[360,280],[900,900],[481,210]]){
      const fit=fitContainViewBox(box,width,height);
      const normalized=mapSvgPointToNormalized(p,box,width,height);
      const screen=normalizedPointToScreen(normalized,{left:41,top:73,width,height});
      assert.ok(Math.abs(screen.x-(41+fit.offsetX+(p.x-box[0])*fit.scale))<1e-7);
      assert.ok(Math.abs(screen.y-(73+fit.offsetY+(p.y-box[1])*fit.scale))<1e-7);
    }
    if(left.pen.penDown)assert.equal(left.pen.phase,"drawing");
    if(left.pen.phase==="travel")assert.equal(left.pen.penDown,false);
  }
  const end=a.frameAt(a.durationMs);
  assert.equal(end.complete,true);
  assert.ok(end.visibility.every(v=>v.fraction===1));
  assert.equal(end.pen.penDown,false);
  assert.deepEqual(b.frameAt(a.durationMs),end);
  const probe=doc.drawPlan.strokes[0].startMs+doc.drawPlan.strokes[0].durationMs*.47;
  const before=a.frameAt(probe);
  a.frameAt(a.durationMs);a.frameAt(0);a.frameAt(probe+.5);
  assert.deepEqual(a.frameAt(probe),before,"seek is deterministic");
  return times.size;
}
test("S4 canonical consumer and site copy remain byte-identical",()=>{
  const canonical=fs.readFileSync(new URL("../../../docs/contracts/vefk-site-consumer.mjs",import.meta.url),"utf8");
  const site=fs.readFileSync(new URL("../../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs",import.meta.url),"utf8");
  assert.equal(site,canonical);
});
test("S4 Studio/site synchronization over synthetic 3x3 (no archived demo)",()=>{
  const doc=core.createVefk({id:"s4-new-3x3",title:"Yeni test 3×3",
    kind:"magicSquare",parameters:{order:3}});
  assert.equal(doc.geometry.paths.length,14);
  assert.ok(testsForDocument(doc)>240);
});
test("S4 site quill + ink match a non-square seal, multi-M travel and diacritic",()=>{
  const doc=manual(),player=sitePlayer(doc);
  assert.ok(testsForDocument(doc)>240);
  const stroke=doc.drawPlan.strokes[0];
  const travel=[];
  for(let n=1;n<400;n++){
    const frame=player.frameAt(stroke.startMs+stroke.durationMs*n/400);
    if(frame.pen.phase==="travel")travel.push(frame);
  }
  assert.ok(travel.length>0,"multi-M pen-up travel must be represented");
  const first=travel[0].visibility[0].fraction;
  assert.ok(first>0&&first<1);
  assert.ok(travel.every(f=>!f.pen.penDown&&Math.abs(f.visibility[0].fraction-first)<1e-12),
    "no ink may appear during travel");
});
test("S4 site scene has a single frame source and quill CSS does not add timing",()=>{
  const scene=fs.readFileSync(new URL(
    "../../../channels/birdesengor/web/src/vefk/useVefkExperience.js",import.meta.url),"utf8");
  assert.match(scene,/selectedEntry\.player\.frameAt\(playback\.timeMs\)/);
  assert.match(scene,/transitionMs: 0/);
  assert.match(scene,/frame\.pen\.position/);
  assert.match(scene,/frame\.pen\.penDown/);
  assert.doesNotMatch(scene,/setTimeout\([^\n]*frame\.pen\.position/);
});
