import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {siteSceneSource} from './scene-workshop-site.mjs';
import {validateProject} from '../../packages/effect-engine/src/model/project.mjs';

test('crop is saved in the authored scene without changing unrelated objects',async()=>{
 const real=siteSceneSource(),source=await real.snapshot();
 const next=structuredClone(source.scene);
 next.objects.find(o=>o.id==='stone-specimen').crop={top:.08,right:0,bottom:0,left:0,deskY:.57};
 next.objects.find(o=>o.id==='ceremonial-robe').crop={top:0,right:.04,bottom:0,left:0,deskY:null};
 assert.equal(validateProject(next),next);
 assert.equal(real.readiness(next,source).ready,true);
 assert.doesNotThrow(()=>real.validate(next,source));
 const invalid=structuredClone(next);
 invalid.objects.find(o=>o.id==='metal-pendulum').crop={top:0,right:0,bottom:0,left:0,deskY:null};
 assert.throws(()=>validateProject(invalid),/kırpma/i);
});
test('an image source stages with scene through a verified isolated working tree',async()=>{
 const real=siteSceneSource(),snapshot=await real.snapshot();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cf-scene-asset-stage-'));
 try{
  for(const [rel,bytes] of snapshot.entries){
   const dest=path.join(dir,rel);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,bytes);
  }
  const isolated=siteSceneSource(dir),before=await isolated.snapshot();
  const target='/scene-assets/stone/jade-rock.webp';
  const replacement=snapshot.entries.get('public/scene-assets/robe/ceremonial-kaftan.webp');
  const input=[{path:target,dataUrl:'data:image/webp;base64,'+replacement.toString('base64')}];
  const scene=structuredClone(before.scene);
  scene.objects.find(o=>o.id==='stone-specimen').crop={top:.08,right:0,bottom:0,left:0,deskY:.6};
  const result=await isolated.stage(scene,before.sourceHash,input);
  assert.equal(result.changed,true);
  assert.ok(result.changedFiles.includes('public'+target));
  assert.deepEqual(fs.readFileSync(path.join(dir,'public'+target)),replacement);
  const after=await isolated.snapshot();
  assert.equal(result.sourceHash,after.sourceHash);
  assert.equal(after.scene.objects.find(o=>o.id==='stone-specimen').crop.deskY,.6);
  await assert.rejects(isolated.stage(scene,before.sourceHash,input),/Site kaynağı değişmiş/);
  await assert.rejects(isolated.stage(scene,after.sourceHash,[{path:'/scene-assets/approved/room-effects-v4-2to1.webp',dataUrl:input[0].dataUrl}]),/kaynağı|Görsel/i);
  assert.equal((await isolated.snapshot()).sourceHash,after.sourceHash);
  // Only the temporary mirror was changed.
  assert.deepEqual((await real.snapshot()).entries.get('public'+target),snapshot.entries.get('public'+target));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('three independent book, camera and workshop sources stage atomically in an isolated site tree',async()=>{
 const real=siteSceneSource(),original=await real.snapshot();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bdsg-physical-art-stage-'));
 const book='/scene-assets/books/scene-closed/evren-master-closed.webp';
 const camera='/scene-assets/camera/research/camera-body.webp';
 const vellum='/scene-assets/vefk/vellum.webp';
 const art=[
  [book,'/scene-assets/books/scene-closed/evren-master-closed-en.webp'],
  [camera,'/scene-assets/books/scene-closed/topluluk-master-closed-en.webp'],
  [vellum,'/scene-assets/vefk/inkwell.webp'],
 ];
 try{
  for(const [relative,bytes] of original.entries){
   const target=path.join(dir,relative);
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.writeFileSync(target,bytes);
  }
  const site=siteSceneSource(dir),before=await site.snapshot();
  const assets=art.map(([target,source])=>({
   path:target,dataUrl:'data:image/webp;base64,'+original.entries.get('public'+source).toString('base64'),
  }));
  assert.equal(site.validateAssets(assets,before).length,3);
  assert.equal(site.readiness(before.scene,before,before.presentation).ready,true);
  const result=await site.stage(before.scene,before.sourceHash,assets,before.presentation);
  assert.equal(result.changed,true);
  assert.equal(result.changedFiles.length,3,'only the three image source bytes should change');
  assert.deepEqual(new Set(result.changedFiles),new Set(art.map(([target])=>'public'+target)));
  const after=await site.snapshot();
  assert.equal(after.sourceHash,result.sourceHash);
  assert.deepEqual(after.scene,before.scene);
  assert.deepEqual(after.presentation,before.presentation);
  for(const [target,source] of art)
   assert.deepEqual(after.entries.get('public'+target),original.entries.get('public'+source));
  await assert.rejects(site.stage(before.scene,before.sourceHash,assets,before.presentation),/Site kaynağı değişmiş/);
  const bad=[{path:book,dataUrl:'data:image/webp;base64,'+original.entries.get('public'+vellum).toString('base64')}];
  await assert.rejects(site.stage(after.scene,after.sourceHash,bad,after.presentation),/1536|Kapalı kitap/);
  assert.equal((await site.snapshot()).sourceHash,after.sourceHash,'an invalid draft must not alter staged files');
  const unchanged=await real.snapshot();
  assert.equal(unchanged.sourceHash,original.sourceHash,'the actual site source was never staged');
  for(const [target] of art)assert.deepEqual(unchanged.entries.get('public'+target),original.entries.get('public'+target));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
