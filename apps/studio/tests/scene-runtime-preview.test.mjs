import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSceneRuntime} from '../scene-runtime-preview.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';

const site=siteSceneSource();
test('readonly real runtime capture renders actual book, validates draft and preserves source', {timeout:95000},async()=>{
 const source=await site.snapshot();
 const input={scene:source.scene,presentation:source.presentation,
   assets:[],expectedSourceHash:source.sourceHash,
   objectId:'research-journal',stage:'open',device:'mobile'};
 const frame=await captureSceneRuntime(input,{site});
 assert.equal(frame.width,390);
 assert.equal(frame.height,844);
 assert.equal(frame.phase,'active');
 assert.equal(frame.stage,'open');
 assert.equal(frame.object,'research-journal');
 assert.equal(frame.syntheticContent,true);
 assert.ok(frame.image.startsWith('data:image/jpeg;base64,'));
 const bytes=Buffer.from(frame.image.slice('data:image/jpeg;base64,'.length),'base64');
 assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
 assert.ok(bytes.length>7000,'real website renders pixels');
 assert.deepEqual((await site.snapshot()).sourceHash,source.sourceHash,
   'rendering never staged, saved, or touched the web source');
 // A published-hidden focus object is revealed only in disposable capture memory.
 const presentation=structuredClone(source.presentation);
 presentation.objects['research-journal'].roomVisible=false;
 const hidden=await captureSceneRuntime({...input,presentation},{site});
 assert.equal(hidden.temporarilyRevealed,true);
 assert.equal(hidden.phase,'active');
 assert.equal(presentation.objects['research-journal'].roomVisible,false);
 assert.equal((await site.snapshot()).sourceHash,source.sourceHash);
 const approaching=await captureSceneRuntime({...input,stage:'approach',device:'desktop'},{site});
 assert.equal(approaching.phase,'focusing');
 assert.equal(approaching.stage,'approaching');
 assert.equal(approaching.timingSlowed,true);
 const returning=await captureSceneRuntime({...input,stage:'return',objectId:'camera',device:'desktop'},{site});
 assert.ok(['returning','active'].includes(returning.phase),
   'camera may remain active while the physical LCD closes');
 assert.equal(returning.timingSlowed,true);
 for(const invalid of [
   {...input,expectedSourceHash:'stale'},
   {...input,objectId:'../../../secret'},
   {...input,device:'nonsense'},
   {...input,stage:'publish'},
   {...input,presentation:{...input.presentation,objects:{}}},
   {...input,scene:{version:2}},
 ])await assert.rejects(captureSceneRuntime(invalid,{site}));
});
