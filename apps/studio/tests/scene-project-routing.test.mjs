import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import workshop from '../scene-workshop.cjs';
const {registerSceneWorkshopIpc}=workshop;

test('project-specific IPC routes site and local scenes without cross-writing or publishing',async()=>{
 const root=mkdtempSync(join(tmpdir(),'scene-ipc-isolation-'));
 try{
  const calls=new Map();
  const ipcMain={handle:(channel,handler)=>{assert.ok(!calls.has(channel));calls.set(channel,handler);}};
  await registerSceneWorkshopIpc(ipcMain,{getPath:key=>key==='userData'?root:''});
  const invoke=(name,input)=>calls.get('studio:scene-'+name)({sender:{isDestroyed:()=>false,send:()=>{}}},input);
  const initial=await invoke('projects');
  assert.equal(initial.length,1);
  assert.equal(initial[0].id,'birdesengor');
  const site=await invoke('load',{projectId:'birdesengor'});
  assert.equal(site.siteSource,true);
  assert.equal(site.canPublish,true);
  const created=await invoke('create',{name:'Özel Sahne'});
  assert.equal(created.siteBound,false);
  const list=await invoke('projects');
  assert.equal(list.length,2);
  assert.ok(list.some(item=>item.id===created.id));
  const local=await invoke('load',{projectId:created.id});
  assert.equal(local.canPublish,false);
  assert.equal(local.scene.sceneId,'local-'+created.id);
  assert.notEqual(local.sourceHash,site.sourceHash);
  assert.throws(()=>invoke('load',{projectId:'../x'}),/Sahne projesi bulunamadı/);
  assert.throws(()=>invoke('load',{projectId:'not-listed'}),/Sahne projesi bulunamadı/);
  const saved=await invoke('save',{projectId:created.id,scene:local.scene,
    presentation:local.presentation,assets:[],expectedSourceHash:local.sourceHash});
  assert.equal(saved.ok,true);
  const prepared=await invoke('prepare',{projectId:created.id});
  assert.equal(prepared.changed,false);
  await assert.rejects(invoke('preflight',{projectId:created.id}),/yayın bağlantısı/);
  await assert.rejects(invoke('deploy',{projectId:created.id,token:'fake'}),/yayın bağlantısı/);
  const siteAfter=await invoke('load',{projectId:'birdesengor'});
  assert.equal(siteAfter.sourceHash,site.sourceHash);
 }finally{rmSync(root,{recursive:true,force:true});}
});
