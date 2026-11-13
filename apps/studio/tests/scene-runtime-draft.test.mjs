import test from 'node:test';
import assert from 'node:assert/strict';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {captureSceneRuntime} from '../scene-runtime-preview.mjs';
import {ROOM_BACKGROUND_ASSET} from '../scene-asset-overrides.mjs';

test('unsaved effects and WebP overrides appear in real site, never written to source', {timeout:85000},async()=>{
  const site=siteSceneSource(),source=await site.snapshot();
  const base={scene:source.scene,presentation:source.presentation,assets:[],
    expectedSourceHash:source.sourceHash,objectId:'research-journal',stage:'room',device:'desktop'};
  const original=await captureSceneRuntime(base,{site});
  assert.equal(original.candleButtonCount,1,'site has enabled candle slots');
  assert.deepEqual(original.draftAssetLoads,[]);
  const scene=structuredClone(source.scene);
  for(const effect of scene.effects){
    if(['flame-1','glow-1','smoke-1'].includes(effect.id))effect.enabled=false;
  }
  const room=await site.preview(source);
  const assets=[{path:ROOM_BACKGROUND_ASSET,dataUrl:room}];
  const edited=await captureSceneRuntime({...base,scene,assets},{site});
  assert.equal(edited.candleButtonCount,0,'real React room uses in-memory disabled draft effects');
  assert.equal(edited.draftEffectsApplied,true);
  assert.equal(edited.draftAssetsApplied,1);
  assert.deepEqual(edited.draftAssetLoads,[ROOM_BACKGROUND_ASSET],
    'real site background request served the WebP from Studio memory');
  assert.equal((await site.snapshot()).sourceHash,source.sourceHash,
    'effects, image bytes and web manifest are never written during capture');
  assert.equal(source.scene.effects.find(effect=>effect.id==='flame-1').enabled,true);
  assert.equal(scene.effects.find(effect=>effect.id==='flame-1').enabled,false);
});
