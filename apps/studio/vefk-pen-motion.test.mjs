import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createVefkPlayer, vefkFrameAt } from "../../docs/contracts/vefk-site-consumer.mjs";
const require = createRequire(import.meta.url);
const core = require("./vefk-core/index.cjs");

function make(paths) {
  return core.createVefk({
    id: "multi-m-s4", title: "Two-subpath calligraphy",
    kind: "manualPaths",
    geometry: {
      coordinateSpace: "svg-viewBox", viewBox: [0, 0, 1000, 1000],
      inkStyles: { glyph: {width:5, cap:"round"} },
      paths: paths.map((d,i)=>({id:`mark.${i+1}`,ink:"glyph",d})),
    },
  });
}
test("multi-M stroke lifts without depositing ink; same visible fraction survives travel", () => {
  const doc=make(["M 100 100 L 200 100 M 400 100 L 500 100"]);
  const player=createVefkPlayer(doc);
  const duration=doc.drawPlan.strokes[0].durationMs;
  const t45=player.frameAt(duration*.45), t55=player.frameAt(duration*.55);
  for(const frame of [t45,t55]){
    assert.equal(frame.pen.phase,"travel");
    assert.equal(frame.pen.penDown,false);
    assert.equal(frame.pen.position.y,100);
    assert.ok(frame.pen.position.x>200 && frame.pen.position.x<400);
    assert.ok(Math.abs(frame.visibility[0].fraction-.5)<1e-8);
  }
  assert.ok(t55.pen.position.x>t45.pen.position.x);
  assert.equal(player.frameAt(0).pen.phase,"drawing");
  assert.equal(player.frameAt(0).pen.penDown,true);
  assert.equal(player.frameAt(duration*.2).pen.phase,"drawing");
  assert.equal(player.frameAt(duration*.8).pen.phase,"drawing");
  assert.equal(player.frameAt(duration).pen.penDown,false);
  assert.equal(player.frameAt(duration).visibility[0].fraction,1);
});

test("between-path gap interpolates quill with pen-up and finished ink",()=>{
  const doc=make(["M 50 50 L 150 50", "M 750 850 L 850 850"]);
  const player=createVefkPlayer(doc);
  const [one,two]=doc.drawPlan.strokes;
  const time=one.startMs+one.durationMs+(two.startMs-one.startMs-one.durationMs)/2;
  const frame=player.frameAt(time);
  assert.equal(frame.pen.phase,"travel");
  assert.equal(frame.pen.penDown,false);
  assert.deepEqual(frame.pen.position,{x:450,y:450});
  assert.deepEqual(frame.visibility.map(item=>item.fraction),[1,0]);
  assert.equal(player.frameAt(two.startMs).pen.penDown,true);
  assert.deepEqual(player.frameAt(doc.drawPlan.durationMs).visibility.map(item=>item.fraction),[1,1]);
  assert.equal(player.frameAt(doc.drawPlan.durationMs).pen.phase,"hold");
});

test("same t is deterministic after forward, reverse, pause and instant seek",()=>{
  const doc=make(["M 10 10 L 110 10 M 300 300 L 400 400", "M 500 500 L 600 600"]);
  const player=createVefkPlayer(doc), at=doc.drawPlan.durationMs*.35;
  const baseline=player.frameAt(at);
  player.frameAt(doc.drawPlan.durationMs);
  player.frameAt(0);
  player.frameAt(doc.drawPlan.durationMs*.8);
  assert.deepEqual(player.frameAt(at),baseline);
  assert.deepEqual(vefkFrameAt(doc,at),baseline);
  assert.deepEqual(player.frameAt(-100).visibility,player.frameAt(0).visibility);
  assert.equal(player.frameAt(doc.drawPlan.durationMs+1000).complete,true);
  assert.throws(()=>player.frameAt(Number.NaN),/geçersiz/);
});
