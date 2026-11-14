import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSealTrace,sealTracePoint} from '../src/runtime/effects/seal-trace.mjs';
import {objectEffectRegistry,defaultObjectParams} from '../src/registry/effects.mjs';
test('Evren seal keeps all points on the photographed cover compass and has canonical Studio controls',()=>{
  const type='seal-trace',fx=objectEffectRegistry[type];
  assert.equal(fx.placement,'center');
  assert.deepEqual(fx.allowedTriggers,['hover','click']);
  assert.deepEqual(Object.keys(fx.presets),['Sakin','Doğal','Canlı']);
  assert.deepEqual(fx.controls.map(c=>c.key),['width','height','opacity','speed','stroke']);
  for(let i=0;i<=120;i++){
    const p=sealTracePoint(i/120);
    assert.ok(p.x>.38&&p.x<.68&&p.y>.39&&p.y<.64);
  }
  const a=sealTracePoint(0),b=sealTracePoint(1);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'compass lock path closes');
});
test('hovered compass paints bounded luminous strokes, leaves zero paint at rest',()=>{
  const p=defaultObjectParams('seal-trace'),tracker={strokes:0,fills:0,segments:0,arcs:0};
  const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){tracker.segments++},
    stroke(){tracker.strokes++},arc(){tracker.arcs++},fill(){tracker.fills++}};
  const fx=createSealTrace({params:p});
  fx.render(ctx,{width:400,height:265});
  assert.equal(tracker.strokes,0);
  fx.setProgress(1);fx.update(.35);fx.render(ctx,{width:400,height:265});
  assert.ok(tracker.strokes>0&&tracker.segments>100&&tracker.fills>0);
  const first=fx.inspect();assert.equal(first.active,1);
  fx.update(4);fx.render(ctx,{width:400,height:265});
  assert.ok(fx.inspect().time>first.time);
  fx.setProgress(0);
  assert.equal(fx.inspect().time,0,'the next hover must start another complete unlocking circuit');
  const before=tracker.strokes;fx.render(ctx,{width:400,height:265});
  assert.equal(tracker.strokes,before);
  fx.destroy();fx.setProgress(1);fx.render(ctx,{width:400,height:265});
  assert.equal(tracker.strokes,before,'destroy leaves no hidden animation or new paint');
});
