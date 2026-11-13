import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {validateProject} from '../../../packages/effect-engine/src/model/project.mjs';
import {defaultObjectParams} from '../../../packages/effect-engine/src/registry/effects.mjs';
import {assertSiteStructure} from '../src/scene-workspace/scene-ux.mjs';

test('V4 independent artwork and attached effect stage atomically into an isolated site tree',async()=>{
  const real=siteSceneSource(),source=await real.snapshot();
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cf-v4-artwork-'));
  try{
    for(const [relative,bytes] of source.entries){
      const target=path.join(tmp,relative);
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,bytes);
    }
    const site=siteSceneSource(tmp),before=await site.snapshot();
    const scene=structuredClone(before.scene);
    const id='artwork-v4-specimen',asset='/scene-assets/custom/artwork-v4-specimen.webp';
    const item={id,name:'V4 bağımsız nesne',group:'Özel nesneler',kind:'artwork',
      visual:{asset},visible:true,motionLayers:[],anchors:[{id:'center',x:.5,y:.5}],
      pose:{x:.42,y:.44,width:.16,height:.2,rotation:0,depth:17},
      crop:{top:.03,right:0,bottom:0,left:0,cutoffY:.68}};
    const layerAsset='/scene-assets/custom/artwork-v4-motion.webp';
    item.visual.layers=[{id:'motion',asset:layerAsset,box:{x:.1,y:.05,width:.8,height:.9}}];
    item.motionLayers=['motion'];
    const effect={id:'artwork-v4-glow',type:'glow',enabled:true,seed:'v4-test',
      trigger:'hover',params:defaultObjectParams('glow'),
      target:{kind:'sceneObject',objectId:id,anchorId:'center',offset:{x:0,y:0},scale:1,depth:0}};
    const motion={id:'artwork-v4-sway',type:'pendulum-sway',enabled:true,seed:'motion-v4',
      params:defaultObjectParams('pendulum-sway'),
      target:{kind:'sceneObject',objectId:id,anchorId:'center',layerId:'motion',
        offset:{x:0,y:0},scale:1,depth:0}};
    scene.objects.push(item);scene.effects.push(effect,motion);
    assert.equal(validateProject(scene),scene);
    const invalidLayers=structuredClone(scene);
    invalidLayers.objects.at(-1).visual.layers[0].box.width=1;
    assert.throws(()=>validateProject(invalidLayers),/Katman görsel alanı/);
    const invalidIdentity=structuredClone(scene);
    invalidIdentity.objects.at(-1).visual.layers[0].id='other';
    assert.throws(()=>validateProject(invalidIdentity),/katman/i);
    assert.doesNotThrow(()=>assertSiteStructure(scene,before.scene));
    assert.equal(site.readiness(scene,before).ready,true,site.readiness(scene,before).problems.join('; '));
    const original=source.entries.get('public/scene-assets/stone/jade-rock.webp');
    const assets=[asset,layerAsset].map(path=>({path,dataUrl:'data:image/webp;base64,'+original.toString('base64')}));
    assert.equal(site.validateAssets(assets,before,scene).length,2);
    assert.throws(()=>site.validateAssets(assets.slice(0,1),before,scene),/WebP dosyası eksik/);
    const stage=await site.stage(scene,before.sourceHash,assets);
    assert.equal(stage.changed,true);
    assert.ok(stage.changedFiles.includes('public'+asset));
    assert.ok(stage.changedFiles.includes('public'+layerAsset));
    const after=await site.snapshot();
    assert.equal(stage.sourceHash,after.sourceHash,'staged source hash must include new binary');
    assert.equal(after.scene.objects.length,before.scene.objects.length+1);
    assert.equal(after.scene.effects.length,before.scene.effects.length+2);
    assert.equal(after.scene.objects.at(-1).crop.cutoffY,.68);
    assert.equal(site.previewObjects(after).find(o=>o.objectId===id)?.layers[0].id,'motion');
    assert.deepEqual(fs.readFileSync(path.join(tmp,'public'+asset)),original);
    assert.deepEqual(fs.readFileSync(path.join(tmp,'public'+layerAsset)),original);
    await assert.rejects(site.stage(scene,before.sourceHash,assets),/Site kaynağı değişmiş/);
    const removed=structuredClone(after.scene);
    removed.objects=removed.objects.filter(o=>o.id!==id);
    removed.effects=removed.effects.filter(e=>e.target.objectId!==id);
    const cleanup=await site.stage(removed,after.sourceHash,[]);
    assert.ok(cleanup.changedFiles.includes('public'+asset),'unused artwork is removed with the scene object');
    assert.ok(cleanup.changedFiles.includes('public'+layerAsset));
    assert.equal(fs.existsSync(path.join(tmp,'public'+asset)),false);
    assert.equal(fs.existsSync(path.join(tmp,'public'+layerAsset)),false);
    const clean=await site.snapshot();
    assert.equal(clean.sourceHash,cleanup.sourceHash);
    assert.equal(clean.scene.objects.length,before.scene.objects.length);
    assert.equal((await real.snapshot()).sourceHash,source.sourceHash,'live working tree was not staged');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
