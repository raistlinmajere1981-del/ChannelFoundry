import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {createVefkPlayer} from "../../../docs/contracts/vefk-site-consumer.mjs";
import {createIntraStrokePreviewPlayer,warpStrokeFraction} from "./vefk-intrastroke-preview.ts";
const require=createRequire(import.meta.url);
const core=require("../vefk-core/index.cjs");

function sample(){
  return core.createVefk({id:"s4-easing-lab",title:"Preview only",kind:"manualPaths",
    geometry:{coordinateSpace:"svg-viewBox",viewBox:[0,0,1300,1000],
      inkStyles:{glyph:{width:6,cap:"round"}},
      paths:[
        {id:"arabic.multi",ink:"glyph",d:"M 40 100 L 150 100 M 320 100 L 430 100"},
        {id:"seal.closed",ink:"glyph",d:"M 700 200 L 900 200 L 900 400 L 700 400 Z"},
        {id:"diacritic",ink:"glyph",d:"M 1100 300 L 1110 300"},
      ]},
  });
}
test("easing functions are bounded, monotone and exact at both ends",()=>{
  const names=["linear","ease-in","ease-out","ease-in-out"];
  for(const curve of names){
    let previous=-1;
    for(let i=0;i<=1000;i++){
      const value=warpStrokeFraction(i/1000,curve);
      assert.ok(value>=previous&&value<=1,curve+" at "+i);
      previous=value;
    }
    assert.equal(warpStrokeFraction(0,curve),0);
    assert.equal(warpStrokeFraction(1,curve),1);
    assert.equal(warpStrokeFraction(-20,curve),0);
    assert.equal(warpStrokeFraction(20,curve),1);
  }
  assert.equal(warpStrokeFraction(.5,"ease-in-out"),.5);
  assert.ok(warpStrokeFraction(.25,"ease-in")<.25);
  assert.ok(warpStrokeFraction(.25,"ease-out")>.25);
  assert.throws(()=>warpStrokeFraction(NaN,"linear"),/sonlu/);
  assert.throws(()=>warpStrokeFraction(.5,"unknown"),/Bilinmeyen/);
});
test("linear experimental mode is exactly identical to existing canonical site player",()=>{
  const doc=sample(),original=structuredClone(doc);
  const existing=createVefkPlayer(doc);
  const preview=createIntraStrokePreviewPlayer(doc,"linear");
  for(let i=0;i<=300;i++){
    const t=doc.drawPlan.durationMs*i/300;
    assert.deepEqual(preview.frameAt(t),existing.frameAt(t));
  }
  assert.deepEqual(doc,original,"preview did not add a persisted easing field");
});
test("curve preview uses canonical nib, ink and pen-up phases at the same warped point",()=>{
  const doc=sample();
  const base=createVefkPlayer(doc);
  const eased=createIntraStrokePreviewPlayer(doc,"ease-in");
  const first=doc.drawPlan.strokes[0],real=first.startMs+first.durationMs*.4;
  const mapped=first.startMs+first.durationMs*.16;
  const source=base.frameAt(mapped),frame=eased.frameAt(real);
  assert.equal(frame.pen.pathId,source.pen.pathId);
  assert.equal(frame.pen.phase,source.pen.phase);
  assert.equal(frame.pen.penDown,source.pen.penDown);
  assert.deepEqual(frame.pen.position,source.pen.position);
  assert.ok(Math.abs(frame.pen.fraction-source.pen.fraction)<1e-12);
  assert.ok(Math.abs(frame.visibility[0].fraction-source.visibility[0].fraction)<1e-12);
  assert.equal(frame.timeMs,real);
  // Multi-M travel is not drawn: the same canonical player decides phase.
  const travelPoint=first.startMs+first.durationMs*.5;
  for(const curve of ["linear","ease-in","ease-out","ease-in-out"]){
    const preview=createIntraStrokePreviewPlayer(doc,curve);
    let foundTravel=false;
    for(let i=1;i<100;i++){
      const state=preview.frameAt(first.startMs+first.durationMs*i/100);
      if(state.pen.phase==="travel"){
        foundTravel=true;assert.equal(state.pen.penDown,false);
        assert.equal(state.visibility[0].fraction,.5);
      }
    }
    assert.ok(foundTravel,curve+" must preserve air-travel on multi-M stroke");
    const after=preview.frameAt(first.startMs+first.durationMs);
    assert.equal(after.visibility[0].fraction,1);
  }
  assert.equal(eased.frameAt(travelPoint).timeMs,travelPoint);
});
test("gaps, end hold, seek and replay stay unchanged regardless of preview profile",()=>{
  const doc=sample(),canonical=createVefkPlayer(doc);
  for(const curve of ["ease-in","ease-out","ease-in-out"]){
    const preview=createIntraStrokePreviewPlayer(doc,curve);
    const first=doc.drawPlan.strokes[0],second=doc.drawPlan.strokes[1];
    const gap=(first.startMs+first.durationMs+second.startMs)/2;
    assert.deepEqual(preview.frameAt(gap),canonical.frameAt(gap));
    assert.deepEqual(preview.frameAt(doc.drawPlan.durationMs),canonical.frameAt(doc.drawPlan.durationMs));
    assert.deepEqual(preview.frameAt(-200),canonical.frameAt(-200));
    assert.deepEqual(preview.frameAt(doc.drawPlan.durationMs+700),canonical.frameAt(doc.drawPlan.durationMs+700));
    let previous=0;
    for(let i=0;i<100;i++){
      const frame=preview.frameAt(first.startMs+first.durationMs*i/100);
      assert.ok(frame.visibility[0].fraction>=previous-1e-12);
      previous=frame.visibility[0].fraction;
    }
    const at=doc.drawPlan.durationMs*.43,baseline=preview.frameAt(at);
    preview.frameAt(doc.drawPlan.durationMs);preview.frameAt(0);
    assert.deepEqual(preview.frameAt(at),baseline);
  }
});
test("no unknown curve or invalid timestamp enters preview",()=>{
  const doc=sample();
  assert.throws(()=>createIntraStrokePreviewPlayer(doc,"ritual"),/Bilinmeyen/);
  const preview=createIntraStrokePreviewPlayer(doc,"ease-in-out");
  assert.throws(()=>preview.frameAt(Infinity),/sonlu/);
});
test("experimental Studio UI is explicitly transient and never changes a saved drawPlan",()=>{
  const editor=fs.readFileSync(new URL("./VefkTimelineEditor.tsx",import.meta.url),"utf8");
  const workshop=fs.readFileSync(new URL("./VefkWorkshop.tsx",import.meta.url),"utf8");
  assert.match(editor,/Deneysel çizgi içi hız eğrisi/);
  assert.match(editor,/Yalnız Studio önizlemesi · kaydedilmez/);
  const motion=fs.readFileSync(new URL("./vefk-motion-editor.ts",import.meta.url),"utf8");
  assert.match(workshop,/createEditorPreviewPlayer\(working, experimentalCurve\)/);
  assert.match(motion,/doc.schemaVersion === 2 \|\| curve === "linear"/);
  assert.match(motion,/createIntraStrokePreviewPlayer\(doc, curve\)/);
  assert.match(workshop,/setExperimentalCurve\("linear"\)/);
  assert.doesNotMatch(editor,/drawPlan:\s*.*previewCurve/);
  assert.doesNotMatch(editor,/publishPublicSnapshot/);
});
