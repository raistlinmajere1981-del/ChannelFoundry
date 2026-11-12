import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectEffectRegistry,defaultObjectParams,effectTrigger} from '../src/registry/effects.mjs';
const type='stone-drop';
const ctx=()=>{
  const draw={fill:0,stroke:0};
  return {draw,save(){},restore(){},beginPath(){},ellipse(){},moveTo(){},lineTo(){},
    fill(){draw.fill++},stroke(){draw.stroke++},set globalAlpha(v){},set fillStyle(v){},
    set strokeStyle(v){},set lineWidth(v){}};
};
test('single drop creates only a finite authored pulse with three matching Studio profiles',()=>{
  const info=objectEffectRegistry[type];
  assert.equal(info.trigger,'pulse');
  assert.equal(effectTrigger({type}),'click');
  assert.deepEqual(Object.keys(info.presets),['Sakin','Doğal','Canlı']);
  const params=defaultObjectParams(type);
  assert.equal(params.duration,1.55);
  const effect=info.create({params});
  const image=ctx();
  effect.render(image,{width:90,height:65});
  assert.equal(image.draw.fill,0,'idle does not draw anything');
  effect.update(.4);
  effect.render(image,{width:90,height:65});
  assert.equal(effect.inspect().phase,'falling');
  assert.ok(image.draw.fill>0,'droplet is visible during fall');
  effect.update(.65);
  effect.render(image,{width:90,height:65});
  assert.equal(effect.inspect().phase,'impact');
  assert.ok(image.draw.stroke>0,'impact rings are visible');
  effect.update(2);
  const before={...image.draw};
  effect.render(image,{width:90,height:65});
  assert.deepEqual(image.draw,before,'completed effect stops drawing');
  assert.equal(effect.isComplete(),true);
  effect.destroy();assert.equal(effect.inspect().disposed,true);
});
