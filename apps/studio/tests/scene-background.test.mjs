import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {ROOM_BACKGROUND_ASSET,webpDimensions} from '../scene-asset-overrides.mjs';
import workshop from '../scene-workshop.cjs';
const {SceneWorkshop}=workshop;

test('V5 background photo is a first-class staged asset; 2:1 ratio and atomic source revision remain protected',async()=>{
 const real=siteSceneSource(),source=await real.snapshot();
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'cf-v5-background-'));
 try{
  for(const [relative,bytes] of source.entries){
   const target=path.join(scratch,relative);
   fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
  }
  const site=siteSceneSource(scratch),before=await site.snapshot();
  const meta=site.backgroundInfo(before);
  assert.equal(meta.asset,ROOM_BACKGROUND_ASSET);
  assert.deepEqual([meta.width,meta.height],[1774,887]);
  assert.equal(meta.aspect,2);
  assert.match(meta.note,/kesilmez/);
  const replaced=fs.readFileSync(new URL('./fixtures/room-2x1.webp',import.meta.url));
  assert.deepEqual(webpDimensions(replaced),{width:1024,height:512});
  const assets=[{path:ROOM_BACKGROUND_ASSET,dataUrl:'data:image/webp;base64,'+replaced.toString('base64')}];
  const invalid=fs.readFileSync(new URL('./fixtures/room-invalid-ratio.webp',import.meta.url));
  assert.throws(()=>site.validateAssets([{path:ROOM_BACKGROUND_ASSET,
   dataUrl:'data:image/webp;base64,'+invalid.toString('base64')}],before),/2:1/);
  assert.equal(site.validateAssets(assets,before).length,1);
  assert.equal(site.readiness(before.scene,before).ready,true);
  const service=new SceneWorkshop({userDataDir:path.join(scratch,'studio-local'),site,runner:{}});
  const loaded=await service.load();
  assert.equal(loaded.background.asset,ROOM_BACKGROUND_ASSET);
  await service.save({scene:before.scene,presentation:before.presentation,
    assets,expectedSourceHash:before.sourceHash});
  const localDraft=await service.load();
  assert.equal(localDraft.origin,'draft');
  assert.equal(localDraft.assets[0].path,ROOM_BACKGROUND_ASSET);
  assert.equal(localDraft.assets[0].dataUrl,assets[0].dataUrl);
  const stage=await site.stage(before.scene,before.sourceHash,assets);
  assert.equal(stage.changed,true);
  assert.ok(stage.changedFiles.includes('public'+ROOM_BACKGROUND_ASSET));
  const after=await site.snapshot();
  assert.notEqual(after.sourceHash,before.sourceHash);
  assert.deepEqual(fs.readFileSync(path.join(scratch,'public'+ROOM_BACKGROUND_ASSET)),replaced);
  assert.equal(site.backgroundInfo(after).width,1024);
  assert.equal(site.backgroundInfo(after).height,512);
  assert.notEqual(await site.preview(after),await site.preview(before));
  await assert.rejects(()=>site.stage(before.scene,before.sourceHash,assets),/değişmiş/);
  const realAfter=await real.snapshot();
  assert.equal(realAfter.sourceHash,source.sourceHash,'original project source was never modified');
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
});
