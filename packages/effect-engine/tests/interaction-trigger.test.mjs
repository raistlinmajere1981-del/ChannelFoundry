import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importProject,exportProject,validateProject} from '../src/model/project.mjs';
import {compileObjectScene} from '../src/runtime/object-compile.mjs';
import {effectTrigger,allowedEffectTriggers} from '../src/registry/effects.mjs';
import {createInteractionProgress} from '../src/runtime/interaction-progress.mjs';

const source=()=>importProject(readFileSync(new URL('../examples/birdesengor-v2.scene.json',import.meta.url),'utf8'));

test('legacy objectScene effects preserve ambient or pulse defaults with no JSON migration',()=>{
  const scene=source();
  for(const effect of scene.effects)assert.equal(effectTrigger(effect),effect.type==='pendulum-sway'||effect.type==='metal-glint'||effect.type==='water-ripple'?'click':'ambient');
  assert.ok(scene.effects.every(effect=>!Object.hasOwn(effect,'trigger')));
  assert.deepEqual(importProject(exportProject(scene)),scene);
});

test('hover and click are editable only for the reversible glow; invalid schema is rejected',()=>{
  const scene=source(),glow=scene.effects.find(effect=>effect.type==='glow');
  assert.deepEqual(allowedEffectTriggers('glow'),['ambient','hover','click']);
  assert.deepEqual(allowedEffectTriggers('flame'),['ambient']);
  assert.deepEqual(allowedEffectTriggers('metal-glint'),['click']);
  glow.trigger='hover';glow.interaction={enterMs:240,leaveMs:180};
  validateProject(scene);
  assert.deepEqual(importProject(exportProject(scene)),scene);
  const compiled=compileObjectScene(scene).effects.find(effect=>effect.id===glow.id);
  assert.equal(compiled.trigger,'hover');
  assert.deepEqual(compiled.interaction,glow.interaction);
  for(const mutate of [
    e=>{e.trigger='invalid';},
    e=>{e.interaction={enterMs:0,leaveMs:200};},
    e=>{e.interaction={enterMs:240,leaveMs:5000};},
    e=>{e.interaction={enterMs:240.5,leaveMs:180};},
    e=>{e.interaction={enterMs:240,leaveMs:180,other:1};}
  ]){
    const copy=structuredClone(scene),changed=copy.effects.find(e=>e.id===glow.id);mutate(changed);
    assert.throws(()=>validateProject(copy));
  }
  const bad=structuredClone(scene);bad.effects.find(e=>e.type==='flame').trigger='hover';
  assert.throws(()=>validateProject(bad));
});

test('reversible progress changes direction without jumping and click returns to rest',()=>{
  const hover=createInteractionProgress({enterMs:250,leaveMs:200});
  hover.enter();assert.equal(hover.tick(.1).progress,.4);
  hover.leave();assert.ok(Math.abs(hover.tick(.04).progress-.2)<1e-8);
  hover.enter();assert.ok(Math.abs(hover.tick(.1).progress-.6)<1e-8);
  hover.leave();assert.equal(hover.tick(.4).progress,0);
  assert.equal(hover.state().active,false);
  const click=createInteractionProgress({trigger:'click',enterMs:100,leaveMs:100});
  click.click();assert.equal(click.tick(.1).progress,1);
  assert.equal(click.tick(.1).progress,0);
  assert.equal(click.state().active,false);
  assert.throws(()=>createInteractionProgress({trigger:'unknown'}));
  assert.throws(()=>createInteractionProgress({enterMs:0}));
});
