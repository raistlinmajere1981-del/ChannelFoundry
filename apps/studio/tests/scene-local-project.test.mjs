import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,rmSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalScene,localSceneSource,listLocalScenes,LOCAL_BACKGROUND} from '../scene-workshop-local.mjs';
import {defaultObjectParams} from '../../../packages/effect-engine/src/registry/effects.mjs';
import {validateProject} from '../../../packages/effect-engine/src/model/project.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import workshop from '../scene-workshop.cjs';
const {SceneWorkshop}=workshop;
const encoded=bytes=>'data:image/webp;base64,'+bytes.toString('base64');

test('independent local project can be created, drafted, staged, reloaded and never published',async()=>{
  const originalSource=siteSceneSource(),original=await originalSource.snapshot();
  const workspace=mkdtempSync(join(tmpdir(),'studio-independent-scene-'));
  try{
    assert.deepEqual(listLocalScenes(workspace),[]);
    assert.throws(()=>createLocalScene(workspace,'    '),/1–90/);
    const created=createLocalScene(workspace,'Bağımsız Deney Sahnesi');
    assert.equal(created.canPublish,false);
    assert.equal(created.siteBound,false);
    assert.equal(listLocalScenes(workspace)[0].id,created.id);
    const source=localSceneSource(workspace,created.id);
    const service=new SceneWorkshop({
      userDataDir:workspace,site:source,runner:null,identity:source.identity,
      draftFilename:created.id+'.json',canPublish:false,
    });
    const loaded=await service.load();
    assert.equal(loaded.siteSource,false);
    assert.equal(loaded.canPublish,false);
    assert.deepEqual(loaded.scene.objects,[]);
    assert.deepEqual(loaded.scene.effects,[]);
    assert.equal(loaded.background.aspect,2);
    const scene=structuredClone(loaded.scene);
    const asset='/scene-assets/custom/test-prop.webp';
    scene.objects.push({id:'test-prop',name:'Özel Nesne',kind:'artwork',group:'Bağımsız',
      visible:true,visual:{asset},motionLayers:[],
      anchors:[{id:'center',x:.5,y:.5}],
      pose:{x:.2,y:.2,width:.25,height:.35,rotation:0,depth:10}});
    scene.effects.push({id:'test-glow',type:'glow',enabled:true,seed:'glow-1',
      target:{kind:'sceneObject',objectId:'test-prop',anchorId:'center',offset:{x:0,y:0},scale:1,depth:0},
      params:defaultObjectParams('glow')});
    assert.equal(validateProject(scene),scene);
    const image=readFileSync(new URL('./fixtures/room-2x1.webp',import.meta.url));
    const upload=[{path:asset,dataUrl:encoded(image)}];
    await assert.rejects(service.save({scene,assets:[],expectedSourceHash:loaded.sourceHash}),/WebP dosyası gerekli/);
    assert.equal((await service.save({scene,assets:upload,expectedSourceHash:loaded.sourceHash})).ok,true);
    const draft=await service.load();
    assert.equal(draft.origin,'draft');
    assert.equal(draft.assets.length,1);
    assert.equal(draft.scene.effects.length,1);
    assert.equal(draft.previewObjects.length,1);
    await assert.rejects(service.preflight(),/yayın bağlantısı/i);
    await assert.rejects(service.deploy({token:'fake'}),/yayın bağlantısı/i);
    const staged=await service.prepare();
    assert.equal(staged.changed,true);
    assert.equal(staged.changedFiles.includes(asset),true);
    assert.deepEqual(readFileSync(join(workspace,'scene-workshop','projects',created.id,'custom','test-prop.webp')),image);
    const active=await service.load();
    assert.equal(active.scene.objects.length,1);
    assert.equal(active.scene.effects.length,1);
    assert.equal((await source.snapshot()).sourceHash,staged.sourceHash);
    const changed=structuredClone(active.scene);
    changed.effects=[];
    changed.objects=[];
    const backgroundBytes=readFileSync(new URL('./fixtures/room-2x1-alt.webp',import.meta.url));
    const update=[{path:LOCAL_BACKGROUND,dataUrl:encoded(backgroundBytes)}];
    await service.save({scene:changed,assets:update,expectedSourceHash:active.sourceHash});
    const after=await service.prepare();
    assert.equal(after.changedFiles.includes(asset),true);
    assert.equal(after.changedFiles.includes(LOCAL_BACKGROUND),true);
    assert.equal(existsSync(join(workspace,'scene-workshop','projects',created.id,'custom','test-prop.webp')),false);
    await assert.rejects(source.stage(scene,active.sourceHash,upload),/değişmiş/);
    assert.equal((await originalSource.snapshot()).sourceHash,original.sourceHash);
  }finally{rmSync(workspace,{recursive:true,force:true});}
});

test('local project inputs never redirect filesystem paths or accept foreign assets',async()=>{
  const workspace=mkdtempSync(join(tmpdir(),'studio-scene-guard-'));
  try{
    const project=createLocalScene(workspace,'Local');
    assert.throws(()=>localSceneSource(workspace,'../outside'),/kimliği/);
    assert.throws(()=>localSceneSource(workspace,'birdesengor'),/ENOENT/);
    const source=localSceneSource(workspace,project.id),state=await source.snapshot();
    const bytes=readFileSync(new URL('./fixtures/room-2x1.webp',import.meta.url));
    assert.throws(()=>source.validateAssets([{path:'/scene-assets/custom/not-attached.webp',dataUrl:encoded(bytes)}],state),/ait olmayan/);
    assert.throws(()=>source.validateAssets([{path:'../../outside.webp',dataUrl:encoded(bytes)}],state),/ait olmayan/);
    const altered=structuredClone(state.scene);
    altered.sceneId='birdesengor-study-v2';
    assert.throws(()=>source.validate(altered,state),/kimliği/);
    altered.sceneId=state.scene.sceneId;
    altered.viewport.width=1700;
    assert.throws(()=>source.validate(altered,state),/2:1/);
    altered.viewport.width=1600;
    altered.objects=[{id:'legacy',name:'Eski nesne',visible:true,
      pose:{x:0,y:0,width:.1,height:.1,rotation:0,depth:0},anchors:[]}];
    assert.throws(()=>source.validate(altered,state),/kaynak görselli/);
  }finally{rmSync(workspace,{recursive:true,force:true});}
});
