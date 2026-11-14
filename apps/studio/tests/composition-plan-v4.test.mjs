import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSITION_FRAME,COMPOSITION_GUIDE,COMPOSITION_MODES,validateCompositionGuide} from '../src/scene-workspace/composition-plan-v4.mjs';

test('V4 authoring plan has correct 2:1 coordinates and only noninteractive studio zones',()=>{
  assert.equal(COMPOSITION_FRAME.width/COMPOSITION_FRAME.height,2);
  assert.deepEqual([...COMPOSITION_MODES],['off','fixed','focus','details']);
  assert.equal(validateCompositionGuide(),COMPOSITION_GUIDE);
  assert.equal(COMPOSITION_GUIDE.fixed.length,5);
  assert.equal(COMPOSITION_GUIDE.focus.length,4);
  assert.equal(COMPOSITION_GUIDE.details.length,7);
  assert.equal(COMPOSITION_GUIDE.fixed.find(z=>z.id==='hook').x,.405);
  assert.equal(COMPOSITION_GUIDE.fixed.find(z=>z.id==='language').y,.842);
});
test('V4 guide validation rejects duplicate and out-of-frame zones',()=>{
  const bad=structuredClone(COMPOSITION_GUIDE);
  bad.focus[0].x=.99;
  assert.throws(()=>validateCompositionGuide(bad),/kadrajını aşan/);
  bad.focus[0].x=.253;
  bad.details[0].id='community';
  assert.throws(()=>validateCompositionGuide(bad),/Tekrarlanan/);
});
