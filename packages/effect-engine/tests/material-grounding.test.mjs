import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_CONTACT_SHADOWS,materialGroundingStyle,materialToneForStudio}
  from '../src/model/material-grounding.mjs';
test('desk contact shadows are unit-safe object-local shapes, never baked pixel coordinates',()=>{
  assert.deepEqual(Object.keys(ROOM_CONTACT_SHADOWS).sort(),
    ['candle','stone-specimen','incense-holder','water-basin','metal-pendulum','ceremonial-dagger'].sort());
  for(const [id,p] of Object.entries(ROOM_CONTACT_SHADOWS)){
    assert.ok(Object.isFrozen(p),id);
    for(const key of ['x','y','width','height','opacity'])assert.ok(p[key]>=0&&p[key]<=1,id+': '+key);
    assert.ok(p.x+p.width<=1&&p.y+p.height<=1,id+' stays inside object');
    const style=materialGroundingStyle(id);
    assert.match(style.background,/radial-gradient/);
    assert.equal(style.pointerEvents,'none');
    assert.equal(style.left,p.x*100+'%');
    assert.equal(style.top,p.y*100+'%');
    assert.equal(style.width,p.width*100+'%');
  }
  assert.equal(materialGroundingStyle('research-journal'),null);
  assert.equal(materialGroundingStyle('ceremonial-robe'),null);
});
test('Studio material grade uses same per-object photograph-preserving ranges as web',()=>{
  assert.match(materialToneForStudio('candle'),/\.86/);
  assert.match(materialToneForStudio('incense-holder'),/\.83/);
  assert.match(materialToneForStudio('stone-specimen'),/\.86/);
  assert.match(materialToneForStudio('stone-specimen','motion'),/\.78/);
  assert.match(materialToneForStudio('water-basin'),/\.86/);
  assert.match(materialToneForStudio('archive-chest'),/\.73/);
  assert.ok(!materialToneForStudio('candle').includes('url('));
});
