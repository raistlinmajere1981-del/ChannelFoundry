import {test} from 'node:test';
import assert from 'node:assert/strict';
import {objectEffectRegistry,defaultObjectParams} from '../src/registry/effects.mjs';

test('stone tremor stays still until drop impact and returns exactly to rest',()=>{
  const type='stone-tremor',entry=objectEffectRegistry[type],params=defaultObjectParams(type);
  assert.equal(entry.output,'motion');
  assert.equal(entry.trigger,'pulse');
  assert.deepEqual(Object.keys(entry.presets),['Sakin','Doğal','Canlı']);
  const fx=entry.create({params});
  assert.equal(fx.motion().angle,0);
  fx.update(params.duration*.4);
  assert.equal(fx.motion().angle,0,'no physical movement before water contact');
  const samples=[];
  for(let i=0;i<30;i++){fx.update(.02);samples.push(fx.motion().angle);}
  assert.ok(samples.some(a=>Math.abs(a)>.08),'impact creates visible, bounded movement');
  assert.ok(samples.every(a=>Math.abs(a)<=params.amplitude),'motion obeys amplitude');
  fx.update(10);
  assert.equal(fx.motion().angle,0,'no resting drift');
  assert.equal(fx.isComplete(),true);
  fx.destroy();assert.equal(fx.inspect().disposed,true);
});
