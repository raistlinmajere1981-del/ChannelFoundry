import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {siteSceneSource,SITE_SCENE} from '../scene-workshop-site.mjs';
import {roomVisibleIn} from '../../../channels/birdesengor/web/src/scene/roomVisibility.js';
import {assertSiteStructure} from '../src/scene-workspace/scene-ux.mjs';

test('Studio can publish physical visibility without moving art or changing effect identities',async()=>{
  const live=siteSceneSource();
  const initial=await live.snapshot();
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'bdsg-visibility-stage-'));
  try{
    for(const [relative,bytes] of initial.entries){
      const destination=path.join(scratch,relative);
      fs.mkdirSync(path.dirname(destination),{recursive:true});
      fs.writeFileSync(destination,bytes);
    }
    const isolated=siteSceneSource(scratch),before=await isolated.snapshot();
    const originalSource=fs.readFileSync(path.join(scratch,SITE_SCENE));
    const scene=structuredClone(before.scene);
    const hidden=['ceremonial-robe','stone-specimen','incense-holder','guardian-sword-left',
      'research-journal','camera'];
    for(const id of hidden){
      const object=scene.objects.find(item=>item.id===id);
      assert.ok(object,'native visual exists: '+id);
      object.visible=false;
      assert.equal(roomVisibleIn(scene,before.presentation,id),false,
        id+' will disappear with its touch target and effect host');
    }
    assert.doesNotThrow(()=>assertSiteStructure(scene,before.scene));
    assert.equal(isolated.readiness(scene,before).ready,true,
      'Studio approval should accept persisted visibility without new slots');
    const prepared=await isolated.stage(scene,before.sourceHash);
    assert.equal(prepared.changed,true);
    assert.deepEqual(prepared.changedFiles,[SITE_SCENE],
      'visibility-only change cannot rewrite photo, book, lighting, overlay or publication');
    const after=await isolated.snapshot();
    for(const id of hidden){
      assert.equal(after.scene.objects.find(item=>item.id===id).visible,false,
        'stored visibility persists: '+id);
      assert.equal(roomVisibleIn(after.scene,after.presentation,id),false);
    }
    assert.deepEqual(scene.effects,before.scene.effects,'effect definitions remain untouched');
    const other=before.scene.objects.find(item=>item.id==='water-basin');
    assert.deepEqual(after.scene.objects.find(item=>item.id==='water-basin'),other,
      'unrelated physical object is preserved');
    assert.notDeepEqual(fs.readFileSync(path.join(scratch,SITE_SCENE)),originalSource);
    await assert.rejects(isolated.stage(scene,before.sourceHash),/Site kaynağı değişmiş/);
    const liveAfter=await live.snapshot();
    assert.equal(liveAfter.sourceHash,initial.sourceHash,'real project has not been staged or deployed');
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
});
