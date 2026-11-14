import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSceneAppearance,SCENE_APPEARANCE_PRESETS,sceneAppearanceStyle,validateSceneAppearance} from '../src/model/scene-appearance.mjs';
import {defaultScenePresentation,validateScenePresentation} from '../src/model/scene-presentation.mjs';

test('scene atmosphere is versioned presentation, not an effect or publication record',()=>{
  const presentation=defaultScenePresentation();
  assert.deepEqual(validateScenePresentation(presentation),presentation);
  assert.deepEqual(presentation.appearance,defaultSceneAppearance());
  const legacy=structuredClone(presentation);
  delete legacy.appearance;
  assert.deepEqual(validateScenePresentation(legacy),legacy,'existing V1 files remain valid');
  const next=structuredClone(presentation);
  next.appearance={...SCENE_APPEARANCE_PRESETS.coolClear};
  assert.deepEqual(validateScenePresentation(next),next);
  const style=sceneAppearanceStyle(next.appearance);
  assert.equal(style['--scene-room-brightness'],.8);
  assert.equal(style['--scene-cool-tint'],.12);
  assert.deepEqual(sceneAppearanceStyle(undefined),sceneAppearanceStyle(defaultSceneAppearance()));
});
test('atmosphere rejects unexpected fields, injection and invalid ranges',()=>{
  const reference=defaultSceneAppearance();
  for(const extra of [
    {...reference,css:'body{display:none}'},{...reference,brightness:'0.8'},
    {...reference,brightness:Infinity},{...reference,contrast:.1},
    {...reference,coolTint:.4},{...reference,vignette:-1}
  ])assert.throws(()=>validateSceneAppearance(extra));
  const invalid=defaultScenePresentation();
  invalid.appearance={...reference,brightness:'var(--hack)'};
  assert.throws(()=>validateScenePresentation(invalid));
  assert.equal(validateSceneAppearance(reference),reference);
});
