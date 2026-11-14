import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chestPulseProgress,createChestLid,createChestLight} from '../src/runtime/effects/chest-opening.mjs';
import {defaultObjectParams,objectEffectRegistry,effectTrigger} from '../src/registry/effects.mjs';
const lidType='chest-lid-open',lightType='chest-light-leak';
function fakeContext(){
  const calls={fills:0,strokes:0};
  return {calls,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},
    stroke(){calls.strokes++},fillRect(){calls.fills++},
    createRadialGradient(){return {addColorStop(){}};},
    set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){}};
}
test('archive lid and amber light share a finite opening envelope',()=>{
  const lidParams=defaultObjectParams(lidType),lightParams=defaultObjectParams(lightType);
  assert.equal(effectTrigger({type:lidType}),'click');
  assert.equal(effectTrigger({type:lightType}),'click');
  assert.equal(objectEffectRegistry[lidType].output,'motion');
  for(const type of [lidType,lightType])
    assert.deepEqual(Object.keys(objectEffectRegistry[type].presets),['Sakin','Doğal','Canlı']);
  assert.equal(chestPulseProgress(0,lidParams),0);
  assert.equal(chestPulseProgress(2.2,lidParams),0);
  const lid=createChestLid({params:lidParams}),light=createChestLight({params:lightParams});
  const ctx=fakeContext();
  assert.equal(lid.motion().tilt,0);
  light.render(ctx,{width:200,height:130});
  assert.equal(ctx.calls.fills,0,'no light at rest');
  lid.update(.8);light.update(.8);
  const m=lid.motion();
  assert.ok(m.tilt<0&&m.tilt>=-lidParams.openAngle);
  assert.equal('lift' in m,false,'hinged lid does not stretch or fake vertical translation');
  assert.ok(objectEffectRegistry[lidType].controls.find(c=>c.key==='openAngle').max>=75,'full hinge sweep supported');
  assert.equal(objectEffectRegistry[lidType].controls.some(c=>c.key==='lift'),false,'no fake lid stretch control');
  assert.ok(Math.abs(lid.inspect().progress-light.inspect().progress)<1e-9);
  light.render(ctx,{width:200,height:130});
  assert.ok(ctx.calls.fills>0&&ctx.calls.strokes>0,'glow follows opening');
  lid.update(20);light.update(20);
  assert.equal(lid.motion().tilt,0);
  assert.equal('lift' in lid.motion(),false);
  assert.ok(lid.isComplete()&&light.isComplete());
  const fills=ctx.calls.fills;
  light.render(ctx,{width:200,height:130});
  assert.equal(ctx.calls.fills,fills,'completed pulse cannot paint');
  lid.destroy();light.destroy();
  assert.equal(lid.inspect().disposed,true);
  assert.equal(light.inspect().disposed,true);
});
