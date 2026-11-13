import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clipInsets,visualClipStyle,validateVisualCrop,EMPTY_CROP} from '../src/model/visual-crop.mjs';
const pose = {x:.2,y:.3,width:.2,height:.4};
test('manual edges and wall/desk occlusion are combined without moving the effect target',()=>{
  const item={pose,crop:{top:.05,right:.1,bottom:.15,left:.02,cutoffY:.57}};
  assert.deepEqual(clipInsets(item),{top:.05,right:.1,bottom:.325,left:.02});
  assert.match(visualClipStyle(item).clipPath,/inset\(5% 10% 32\.5/);
  assert.deepEqual(pose,{x:.2,y:.3,width:.2,height:.4});
});
test('cutoff comes from scene data, never a hardcoded desk boundary',()=>{
  const item={pose};
  assert.deepEqual(visualClipStyle(item),{});
  item.crop={...EMPTY_CROP,cutoffY:.57};
  assert.ok(visualClipStyle(item).clipPath.includes('32.5'));
  item.crop={...EMPTY_CROP};
  assert.deepEqual(visualClipStyle(item),{});
});
test('crop excludes invalid or total trims',()=>{
  assert.doesNotThrow(()=>validateVisualCrop({...EMPTY_CROP,left:.25,right:.25,cutoffY:.57}));
  for(const c of [{...EMPTY_CROP,left:.96},{...EMPTY_CROP,left:.5,right:.5},{...EMPTY_CROP,cutoffY:2},{...EMPTY_CROP,extra:1}])
    assert.throws(()=>validateVisualCrop(c),/kırpma|örtme/i);
});
