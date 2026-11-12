import assert from 'node:assert/strict';
import {test} from 'node:test';
import authored from '../../../channels/birdesengor/web/src/effects/birdesengor-effects.v2.json' with {type:'json'};
import manifest from '../../../channels/birdesengor/web/src/scene/data/study.scene.json' with {type:'json'};
import {validateProject} from '../src/model/project.mjs';
import {validateAuthoredScene} from '../../../channels/birdesengor/web/src/effects/effectsAdapter.js';

const clone=value=>structuredClone(value);
const robe=scene=>scene.objects.find(o=>o.id==='ceremonial-robe');

test('visible robe has a bounded two-state, site-only invisibility schema',()=>{
  assert.equal(validateProject(authored),authored);
  const a=robe(authored);
  assert.equal(a.motionLayers[0],'fabric');
  assert.equal(a.veil.enabled,true);
  assert.equal(validateAuthoredScene(authored,manifest).ok,true);
  const b=clone(authored);
  robe(b).veil.distortionPx=4.2;
  robe(b).veil.residualOpacity=.1;
  robe(b).pose.y+=.015;
  assert.equal(validateProject(b),b);
  assert.equal(validateAuthoredScene(b,manifest).ok,true);
  const invalid=clone(b);
  robe(invalid).veil.distortionPx=8;
  assert.throws(()=>validateProject(invalid),/Optik kırılma/);
  const intrusion=clone(b);
  intrusion.objects.find(o=>o.id==='archive-chest').veil={...robe(b).veil};
  assert.equal(validateAuthoredScene(intrusion,manifest).ok,false);
  const dragged=clone(b);
  dragged.objects.find(o=>o.id==='archive-chest').pose.x+=.04;
  assert.equal(validateAuthoredScene(dragged,manifest).ok,false);
});
