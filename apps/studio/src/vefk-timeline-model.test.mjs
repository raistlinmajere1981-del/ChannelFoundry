import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { applyStrokeTempoCurve, balanceStrokeDurations, changeDrawPlan, previewFraction, reconcileDrawPlan, timelineRows } from "./vefk-timeline-model.ts";
import { createVefkPlayer } from "../../../docs/contracts/vefk-site-consumer.mjs";
const require = createRequire(import.meta.url);
const core = require("../vefk-core/index.cjs");
const store = require("../vefk-store.cjs");
const { DatabaseSync } = require("node:sqlite");

function starting() {
  return core.createVefk({
    id: "timeline-s4", title: "Vefk çizim sırası",
    kind: "manualPaths", geometry: {
      coordinateSpace: "svg-viewBox", viewBox: [0, 0, 1000, 1000],
      inkStyles: { glyph: { width: 8, cap: "round" }, grid: { width: 7, cap: "round" } },
      paths: [
        { id: "grid.outer", ink: "grid", d: "M 0 0 L 100 100" },
        { id: "symbol.left", ink: "glyph", d: "M 100 100 L 200 200" },
        { id: "symbol.right", ink: "glyph", d: "M 200 100 L 300 200" },
      ],
    },
  });
}
function toCore(doc, newPlan) {
  return core.createVefk({
    id: doc.id, title: doc.title, revision: doc.revision,
    kind: "manualPaths", geometry: doc.geometry, drawPlan: newPlan,
  });
}

test("unchanged geometry does not regenerate or drop S1 approved timing", () => {
  const source = starting();
  assert.equal(reconcileDrawPlan(source.geometry, source.drawPlan), source.drawPlan);
  const rows = timelineRows(source.geometry, source.drawPlan);
  assert.deepEqual(rows.map(item => item.pathId), source.geometry.paths.map(p => p.id));
  assert.equal(rows[0].gapBeforeMs, 0);
  assert.equal(rows[1].gapBeforeMs, 140);
});

test("S4 per-stroke duration, pre-move gap, hold and ordering remain canonical and valid", () => {
  const doc = starting();
  let plan = changeDrawPlan(doc.geometry, doc.drawPlan, {
    kind: "duration", pathId: "symbol.left", valueMs: 2300,
  });
  plan = changeDrawPlan(doc.geometry, plan, { kind: "gap", pathId: "symbol.left", valueMs: 525 });
  plan = changeDrawPlan(doc.geometry, plan, { kind: "move", pathId: "symbol.right", delta: -1 });
  plan = changeDrawPlan(doc.geometry, plan, { kind: "hold", valueMs: 2500 });
  const result = toCore(doc, plan);
  assert.equal(result.drawPlan.durationMs, plan.durationMs);
  assert.deepEqual(result.drawPlan.strokes.map(s => s.pathId), [
    "grid.outer", "symbol.right", "symbol.left",
  ]);
  assert.equal(result.drawPlan.strokes.at(-1).durationMs, 2300);
  assert.equal(result.drawPlan.strokes.at(-1).startMs - (
    result.drawPlan.strokes.at(-2).startMs + result.drawPlan.strokes.at(-2).durationMs), 525);
  assert.equal(result.drawPlan.durationMs - (
    result.drawPlan.strokes.at(-1).startMs + result.drawPlan.strokes.at(-1).durationMs), 2500);
  assert.equal(result.drawPlan.markers.at(-1).id, "hold");
  assert.equal(core.validateVefk(result).ok, true);
  assert.equal(previewFraction(result.drawPlan.strokes.at(-1), result.drawPlan.strokes.at(-1).startMs), 0);
  assert.equal(previewFraction(result.drawPlan.strokes.at(-1), result.drawPlan.strokes.at(-1).startMs + 1150), 0.5);
});

test("structural path edits retain existing edited strokes and add/remove deterministic entries", () => {
  const doc = starting();
  const customized = changeDrawPlan(doc.geometry, doc.drawPlan, {
    kind: "duration", pathId: "symbol.left", valueMs: 1625,
  });
  const addedGeometry = {
    ...doc.geometry,
    paths: [...doc.geometry.paths, { id: "symbol.new", ink: "glyph", d: "M 200 200 L 220 280" }],
  };
  const reconciled = reconcileDrawPlan(addedGeometry, customized);
  assert.equal(reconciled.strokes.at(-1).pathId, "symbol.new");
  assert.equal(reconciled.strokes.find(s => s.pathId === "symbol.left").durationMs, 1625);
  assert.equal(new Set(reconciled.strokes.map(s => s.id)).size, reconciled.strokes.length);
  const trimmedGeometry = {
    ...doc.geometry, paths: doc.geometry.paths.filter(p => p.id !== "symbol.right"),
  };
  const trimmed = reconcileDrawPlan(trimmedGeometry, customized);
  assert.equal(trimmed.strokes.length, 2);
  assert.equal(toCore({ ...doc, geometry: trimmedGeometry }, trimmed).contentHash.length, 64);
});

test("S4 revised plan survives SQLite save/reload, approval and publication selection unchanged", () => {
  const doc = starting();
  const plan = changeDrawPlan(doc.geometry, doc.drawPlan, {
    kind: "duration", pathId: "symbol.right", valueMs: 1847,
  });
  const edited = toCore(doc, plan);
  assert.notEqual(edited.contentHash, doc.contentHash, "Motion timing changes semantic content.");
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  try {
    store.saveDraft(db, { document: edited });
    assert.deepEqual(store.getDocument(db, doc.id).document.drawPlan, plan);
    store.setReviewState(db, {
      id: edited.id, revision: 1, status: "checked", expectedContentHash: edited.contentHash,
    });
    store.setReviewState(db, {
      id: edited.id, revision: 1, status: "approved", expectedContentHash: edited.contentHash,
    });
    assert.equal(store.listApproved(db)[0].contentHash, edited.contentHash);
  } finally { db.close(); }
});

test("invalid editing cannot silently truncate, overlap or introduce non-integer seconds", () => {
  const doc = starting();
  const changes = [
    { kind: "duration", pathId: "symbol.right", valueMs: 0 },
    { kind: "duration", pathId: "symbol.right", valueMs: Number.NaN },
    { kind: "duration", pathId: "symbol.right", valueMs: 17.5 },
    { kind: "gap", pathId: "symbol.right", valueMs: -1 },
    { kind: "hold", valueMs: 3_600_000 },
    { kind: "move", pathId: "not-there", delta: -1 },
  ];
  for (const edit of changes) assert.throws(() => changeDrawPlan(doc.geometry, doc.drawPlan, edit));
  assert.throws(() => previewFraction(doc.drawPlan.strokes[0], Number.POSITIVE_INFINITY));
});

test("S4 opt-in ink pacing gives short marks less time while preserving gaps, hold and order",()=>{
  const geo={
    coordinateSpace:"svg-viewBox",viewBox:[0,0,1000,1000],
    inkStyles:{glyph:{width:5,cap:"round"}},
    paths:[
      {id:"mark.short",ink:"glyph",d:"M 10 10 L 18 10"},
      {id:"mark.long",ink:"glyph",d:"M 20 50 L 320 50"},
      {id:"mark.multi",ink:"glyph",d:"M 10 90 L 60 90 M 160 90 L 210 90"},
    ],
  };
  const original=core.createVefk({id:"s4-pace-test",title:"Süre önerisi",kind:"manualPaths",geometry:geo});
  const before=timelineRows(geo,original.drawPlan);
  const proposed=balanceStrokeDurations(geo,original.drawPlan,180);
  const after=timelineRows(geo,proposed);
  assert.equal(after.length,3);
  assert.ok(after[0].durationMs>=180&&after[0].durationMs<after[2].durationMs);
  assert.ok(after[1].durationMs>after[2].durationMs);
  assert.deepEqual(after.map(x=>x.pathId),before.map(x=>x.pathId));
  assert.deepEqual(after.map(x=>x.gapBeforeMs),before.map(x=>x.gapBeforeMs));
  const hold=plan=>plan.durationMs-plan.strokes.at(-1).startMs-plan.strokes.at(-1).durationMs;
  assert.equal(hold(proposed),hold(original.drawPlan));
  const checked=core.createVefk({id:original.id,title:original.title,kind:"manualPaths",
    geometry:original.geometry,drawPlan:proposed});
  assert.ok(core.validateVefk(checked).ok);
  assert.notEqual(checked.contentHash,original.contentHash);
  assert.deepEqual(balanceStrokeDurations(geo,original.drawPlan,180),proposed);
  assert.equal(original.drawPlan.strokes[0].durationMs,950,"original untouched");
});
test("S4 pace suggestions are bounded and never invent invalid times",()=>{
  const doc=starting();
  for(const invalid of [-1,0,50,650,NaN,Infinity])
    assert.throws(()=>balanceStrokeDurations(doc.geometry,doc.drawPlan,invalid),/hızı/);
  const malformed={...doc.geometry,paths:[{...doc.geometry.paths[0],d:"M 0 0 Q 1 2"}]};
  assert.throws(()=>balanceStrokeDurations(malformed,doc.drawPlan),/M\/L\/Z/);
});

test("S4 tempo envelopes preserve total duration, all gaps, IDs, hold and source paths",()=>{
  const doc=starting();
  const original=structuredClone(doc.drawPlan);
  const budget=original.strokes.reduce((sum,s)=>sum+s.durationMs,0);
  const holds=plan=>plan.durationMs-plan.strokes.at(-1).startMs-plan.strokes.at(-1).durationMs;
  const gaps=plan=>timelineRows(doc.geometry,plan).map(row=>row.gapBeforeMs);
  const outputs=[];
  for(const curve of ["slow-opening","slow-ending","ceremony"]){
    const plan=applyStrokeTempoCurve(doc.geometry,doc.drawPlan,curve);
    const checked=toCore(doc,plan);
    assert.ok(core.validateVefk(checked).ok,curve);
    assert.equal(plan.durationMs,original.durationMs);
    assert.equal(holds(plan),holds(original));
    assert.equal(plan.strokes.reduce((sum,s)=>sum+s.durationMs,0),budget);
    assert.deepEqual(gaps(plan),gaps(original));
    assert.deepEqual(plan.strokes.map(s=>[s.id,s.pathId,s.ink,s.pen]),
      original.strokes.map(s=>[s.id,s.pathId,s.ink,s.pen]));
    assert.deepEqual(checked.geometry,doc.geometry);
    assert.ok(plan.strokes.every(s=>Number.isSafeInteger(s.durationMs)&&s.durationMs>0));
    assert.deepEqual(applyStrokeTempoCurve(doc.geometry,doc.drawPlan,curve),plan);
    outputs.push(plan);
  }
  assert.ok(outputs[0].strokes[0].durationMs>original.strokes[0].durationMs,"slow opening");
  assert.ok(outputs[1].strokes.at(-1).durationMs>original.strokes.at(-1).durationMs,"slow ending");
  assert.notDeepEqual(outputs[2].strokes.map(s=>s.durationMs),
    original.strokes.map(s=>s.durationMs),"ceremonial tempo must change schedule");
  assert.deepEqual(doc.drawPlan,original,"approved input untouched");
});

test("S4 prescribed tempo plays identically in V2 canonical player without new schema fields",()=>{
  const doc=starting();
  const plan=applyStrokeTempoCurve(doc.geometry,doc.drawPlan,"slow-opening");
  const edited=toCore(doc,plan);
  const player=createVefkPlayer(edited);
  assert.equal(player.durationMs,doc.drawPlan.durationMs);
  for(const stroke of edited.drawPlan.strokes){
    const halfway=stroke.startMs+stroke.durationMs/2;
    const frame=player.frameAt(halfway);
    const same=player.frameAt(halfway);
    assert.deepEqual(frame,same);
    assert.equal(frame.pen.pathId,stroke.pathId);
    assert.equal(frame.pen.phase,"drawing");
    assert.ok(frame.visibility.find(item=>item.pathId===stroke.pathId).fraction>0);
  }
  assert.deepEqual(player.frameAt(edited.drawPlan.durationMs).visibility.map(v=>v.fraction),
    [1,1,1]);
  assert.equal(player.frameAt(edited.drawPlan.durationMs).pen.phase,"hold");
  assert.deepEqual(player.frameAt(0),player.frameAt(-1));
});

test("S4 tempo envelope validates curve and safely handles single/very short strokes",()=>{
  const doc=starting();
  assert.throws(()=>applyStrokeTempoCurve(doc.geometry,doc.drawPlan,"unknown"),/tempo eğrisi/);
  const single=core.createVefk({
    id:"one-stroke-tempo",title:"Single stroke",kind:"manualPaths",
    geometry:{...doc.geometry,paths:doc.geometry.paths.slice(0,1)},
  });
  assert.equal(applyStrokeTempoCurve(single.geometry,single.drawPlan,"ceremony"),single.drawPlan);
  let plan=doc.drawPlan;
  for(const stroke of doc.drawPlan.strokes){
    plan=changeDrawPlan(doc.geometry,plan,{kind:"duration",pathId:stroke.pathId,valueMs:1});
  }
  for(const curve of ["slow-opening","slow-ending","ceremony"]){
    const next=applyStrokeTempoCurve(doc.geometry,plan,curve);
    assert.equal(next.durationMs,plan.durationMs);
    assert.deepEqual(next.strokes.map(s=>s.durationMs),[1,1,1]);
    assert.ok(core.validateVefk(toCore(doc,next)).ok);
  }
});

test("reapplying S4 tempo preset is idempotent rather than accumulating acceleration",()=>{
  const doc=starting();
  for(const curve of ["slow-opening","slow-ending","ceremony"]){
    const first=applyStrokeTempoCurve(doc.geometry,doc.drawPlan,curve);
    const second=applyStrokeTempoCurve(doc.geometry,first,curve);
    assert.deepEqual(second,first,curve+" must be safe to click twice");
  }
  const a=applyStrokeTempoCurve(doc.geometry,doc.drawPlan,"slow-opening");
  const b=applyStrokeTempoCurve(doc.geometry,a,"ceremony");
  const direct=applyStrokeTempoCurve(doc.geometry,doc.drawPlan,"ceremony");
  assert.deepEqual(b,direct,"switching a preset never accumulates an old one");
});

test("S4 tempo curves handle several pen-up subpaths and closed contours without schema change",()=>{
  const geometry={
    coordinateSpace:"svg-viewBox",viewBox:[0,0,1331.295,1000],
    inkStyles:{trace:{width:4,cap:"round"}},
    paths:[
      {id:"arabic.multi",ink:"trace",d:"M 50 100 L 180 100 M 200 170 L 280 175"},
      {id:"seal.ring",ink:"trace",d:"M 550 200 L 620 200 L 620 270 L 550 270 Z"},
      {id:"dot.right",ink:"trace",d:"M 700 310 L 705 310"},
    ],
  };
  const doc=core.createVefk({id:"s4-nonsquare-tempo",title:"Kaligrafi hız testi",kind:"manualPaths",geometry});
  const plan=applyStrokeTempoCurve(doc.geometry,doc.drawPlan,"ceremony");
  const updated=toCore(doc,plan);
  const player=createVefkPlayer(updated);
  assert.deepEqual(updated.geometry.viewBox,[0,0,1331.295,1000]);
  assert.equal(updated.drawPlan.strokes.length,3);
  assert.equal(updated.drawPlan.durationMs,doc.drawPlan.durationMs);
  assert.deepEqual(player.frameAt(player.durationMs).visibility.map(x=>x.fraction),[1,1,1]);
  assert.ok(core.validateVefk(updated).ok);
});
