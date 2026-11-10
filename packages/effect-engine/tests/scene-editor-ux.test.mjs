import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {objectEffectRegistry,defaultObjectParams} from '../src/registry/effects.mjs';
import {importProject,exportProject,validateProject} from '../src/model/project.mjs';
import {sceneProfiles,profileForEffect,applySceneProfile,basicControls,assertSiteStructure} from '../src/editor/scene-ux.mjs';
const fixture=()=>importProject(readFileSync(new URL('../examples/birdesengor-v2.scene.json',import.meta.url),'utf8'));

test('all daily profiles use exact canonical presets, are deterministic and preserve target/seed/state',()=>{
  for(const type of Object.keys(objectEffectRegistry))for(const profile of sceneProfiles){
    const scene=fixture(),effect=scene.effects[0];
    effect.type=type;effect.params={...defaultObjectParams(type),...objectEffectRegistry[type].presets.Doğal};
    if(type==='pendulum-sway'){scene.objects.find(o=>o.id===effect.target.objectId).motionLayers=['pendant'];effect.target.layerId='pendant';}
    const before=structuredClone(effect);
    applySceneProfile(effect,profile.key);
    assert.deepEqual(effect.params,{...before.params,...objectEffectRegistry[type].presets[profile.key]});
    assert.deepEqual(effect.target,before.target);
    assert.equal(effect.enabled,before.enabled);assert.equal(effect.seed,before.seed);
    assert.equal(profileForEffect(effect),profile.label);
    const first=exportProject(scene);applySceneProfile(effect,profile.key);
    assert.equal(exportProject(scene),first,'reapplying never compounds parameter values');
    assert.deepEqual(importProject(first),scene);
    effect.params[type==='pendulum-sway'?'amplitude':'opacity']-=.013;
    assert.equal(profileForEffect(effect),'Özel');
  }
});
test('daily controls reference only real type-specific canonical parameters and ranges',()=>{
  for(const type of Object.keys(objectEffectRegistry)){
    const controls=basicControls(type),canonical=objectEffectRegistry[type].controls;
    assert.ok(controls.some(control=>control.key===(type==='pendulum-sway'?'amplitude':'opacity')));
    for(const control of controls){
      const expected=canonical.find(item=>item.key===control.key);
      assert.ok(expected);assert.equal(control.min,expected.min);assert.equal(control.max,expected.max);assert.equal(control.step,expected.step);
    }
  }
  assert.ok(basicControls('smoke').some(control=>control.key==='spread'));
  assert.ok(!basicControls('flame').some(control=>control.key==='spread'));
});
test('site source allows parameter/offset edits but rejects invented slots, types, anchors, poses and visibility',()=>{
  const source=fixture();
  const edit=structuredClone(source);applySceneProfile(edit.effects[0],'Sakin');
  edit.effects[0].target.offset.x=.11;edit.effects[0].enabled=false;edit.effects[0].seed='edited';
  assert.doesNotThrow(()=>assertSiteStructure(edit,source));validateProject(edit);
  for(const change of [
    scene=>scene.effects.push({...structuredClone(scene.effects[0]),id:'fake-site-slot'}),
    scene=>scene.effects.pop(),
    scene=>{scene.effects[0].type='flame';},
    scene=>{scene.effects[0].target.anchorId='other';},
    scene=>{scene.objects[0].pose.x+=.01;},
    scene=>{scene.objects[0].anchors[0].x+=.01;},
    scene=>{scene.objects[0].visible=false;},
    scene=>{scene.viewport.width=1920;},
  ]){
    const invalid=structuredClone(source);change(invalid);
    assert.throws(()=>assertSiteStructure(invalid,source),/site|Site/);
  }
});
