import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_EDIT_MODES,sceneEditMode,sceneBoxMove,sceneBoxResize} from '../src/scene-workspace/scene-editing.mjs';

test('editing modes are exclusive and unknown values are safe',()=>{
  assert.deepEqual([...SCENE_EDIT_MODES],['select','visual','hit','effect']);
  assert.equal(sceneEditMode('hit'),'hit');
  assert.equal(sceneEditMode('unknown'),'select');
});
test('dragged boxes stay inside normalized scene and preserve dimensions',()=>{
  assert.deepEqual(sceneBoxMove({x:.8,y:.7,width:.15,height:.2},.6,.6),
    {x:.85,y:.8,width:.15,height:.2});
  assert.deepEqual(sceneBoxMove({x:.1,y:.12,width:.15,height:.2},-.6,-.4),
    {x:0,y:0,width:.15,height:.2});
});
test('all four resize handles anchor the opposite edges',()=>{
  const a={x:.25,y:.2,width:.2,height:.1};
  assert.deepEqual(sceneBoxResize(a,'se',.05,.04),{x:.25,y:.2,width:.25,height:.14});
  assert.deepEqual(sceneBoxResize(a,'nw',-.05,-.03),{x:.2,y:.17,width:.25,height:.13});
  assert.deepEqual(sceneBoxResize(a,'ne',.05,-.02),{x:.25,y:.18,width:.25,height:.12});
  assert.deepEqual(sceneBoxResize(a,'sw',-.06,.02),{x:.19,y:.2,width:.26,height:.12});
});
test('Shift lock preserves aspect, anchors and boundaries',()=>{
  const a={x:.82,y:.74,width:.16,height:.20};
  const after=sceneBoxResize(a,'se',.2,.35,{aspectLock:true});
  assert.ok(after.x+after.width<=1&&after.y+after.height<=1);
  assert.ok(Math.abs(after.width/after.height-a.width/a.height)<.001);
  const shrinking=sceneBoxResize({x:.1,y:.1,width:.2,height:.2},'nw',1,1,{aspectLock:true});
  assert.ok(shrinking.width>=.003&&shrinking.height>=.003);
  assert.throws(()=>sceneBoxResize(a,'bad',.1,.1),/köşe/);
});
