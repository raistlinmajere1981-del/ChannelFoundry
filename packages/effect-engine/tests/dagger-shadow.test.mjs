import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectEffectRegistry,defaultObjectParams,effectTrigger} from '../src/registry/effects.mjs';
const type='dagger-shadow';
function mockContext(){
  const calls={fills:0,ellipse:0,clipped:0};
  const colors={addColorStop(){}};
  return {calls,save(){},restore(){},translate(){},rotate(){},scale(){},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){calls.clipped++},
    ellipse(){calls.ellipse++},quadraticCurveTo(){},fill(){calls.fills++},
    createRadialGradient(){return colors;},
    set fillStyle(v){},set globalAlpha(v){}};
}
test('dagger reflection is finite, clipped and has three Studio presets',()=>{
  const info=objectEffectRegistry[type];
  assert.equal(info.trigger,'pulse');
  assert.equal(effectTrigger({type}),'click');
  assert.deepEqual(Object.keys(info.presets),['Sakin','Doğal','Canlı']);
  const params=defaultObjectParams(type);
  assert.equal(params.width,1);assert.equal(params.height,1);
  const fx=info.create({params}),ctx=mockContext();
  fx.render(ctx,{width:200,height:140});
  assert.equal(ctx.calls.fills,0);
  fx.update(params.duration*.38);
  fx.render(ctx,{width:200,height:140});
  assert.ok(ctx.calls.fills>0);
  assert.ok(ctx.calls.ellipse>0);
  assert.equal(ctx.calls.clipped,1);
  assert.equal(fx.inspect().painted,true);
  fx.update(12);
  const before=ctx.calls.fills;
  fx.render(ctx,{width:200,height:140});
  assert.equal(ctx.calls.fills,before,'no residue after completion');
  assert.equal(fx.isComplete(),true);
  fx.destroy();
  assert.equal(fx.inspect().disposed,true);
});
