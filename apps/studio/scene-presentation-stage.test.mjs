import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {siteSceneSource} from './scene-workshop-site.mjs';
const CONFIG='src/scene/data/scene-presentation.v1.json';
test('presentation stages independently of effect scene in an isolated site copy',async()=>{
 const actual=siteSceneSource(),original=await actual.snapshot();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bdsg-presentation-stage-'));
 try{
  for(const [rel,bytes] of original.entries){
   const file=path.join(dir,rel);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,bytes);
  }
  const isolated=siteSceneSource(dir),source=await isolated.snapshot();
  const edited=structuredClone(source.presentation);
  edited.objects.camera.desktop.nearZoom=1.13;
  edited.objects.camera.mobile.nearShiftY=-2.3;
  edited.objects['research-journal'].detailMs=1020;
  edited.objects['vefk-stand'].focusMs=830;
  edited.objects.camera.physical.mobile.offsetX=12;
  edited.objects.camera.physical.desktop.archiveWidth=350;
  edited.objects['vefk-stand'].physical.desktop.paperScale=1.04;
  edited.objects['vefk-stand'].physical.mobile.catalogY=-7;
  assert.equal(isolated.readiness(source.scene,source,edited).ready,true);
  const result=await isolated.stage(source.scene,source.sourceHash,[],edited);
  assert.equal(result.changed,true);
  assert.deepEqual(result.changedFiles,[CONFIG]);
  const after=await isolated.snapshot();
  assert.deepEqual(after.presentation,edited);
  assert.equal(result.sourceHash,after.sourceHash);
  assert.deepEqual(after.scene,source.scene);
  await assert.rejects(isolated.stage(source.scene,source.sourceHash,[],edited),/Site kaynağı değişmiş/);
  const invalid=structuredClone(edited);
  invalid.objects.camera.mobile.nearZoom=9;
  await assert.rejects(isolated.stage(source.scene,after.sourceHash,[],invalid),/Site hazırlığı geçersiz/);
  assert.equal((await isolated.snapshot()).sourceHash,after.sourceHash);
  assert.deepEqual((await actual.snapshot()).entries.get(CONFIG),original.entries.get(CONFIG));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('book style changes invalidate stale presentation drafts',async()=>{
 const source=await siteSceneSource().snapshot();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bdsg-style-drift-'));
 try{
  for(const [relative,bytes] of source.entries){
   const file=path.join(dir,relative);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,bytes);
  }
  const site=siteSceneSource(dir),before=await site.snapshot();
  fs.appendFileSync(path.join(dir,'src/book/book-ribbons.css'),'\n/* concurrent visual edit */\n');
  await assert.rejects(site.stage(before.scene,before.sourceHash,[],before.presentation),/Site kaynağı değişmiş/);
  assert.notEqual((await site.snapshot()).sourceHash,before.sourceHash);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('camera and workshop geometry CSS changes invalidate saved drafts',async()=>{
 const source=await siteSceneSource().snapshot();
 for(const relative of ['src/camera/camera-single-view.css','src/vefk/physical-vefk.css']){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bdsg-device-style-'));
  try{
   for(const [name,bytes] of source.entries){
    const file=path.join(dir,name);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,bytes);
   }
   const site=siteSceneSource(dir),before=await site.snapshot();
   fs.appendFileSync(path.join(dir,relative),'\n/* test concurrent edit */\n');
   await assert.rejects(site.stage(before.scene,before.sourceHash,[],before.presentation),/Site kaynağı değişmiş/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});
