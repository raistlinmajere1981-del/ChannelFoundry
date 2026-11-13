import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSceneRuntime,interactSceneRuntime,closeSceneRuntimeSession} from '../scene-runtime-preview.mjs';
import {siteSceneSource} from '../scene-workshop-site.mjs';

test('actual isolated website responds to click/keys, closes session and preserves source', {timeout:90000},async()=>{
  const site=siteSceneSource(),source=await site.snapshot();
  const request={scene:source.scene,presentation:source.presentation,assets:[],
    expectedSourceHash:source.sourceHash,objectId:'research-journal',stage:'room',
    device:'desktop',keepOpen:true};
  const frame=await captureSceneRuntime(request,{site});
  assert.equal(frame.phase,'room');
  assert.equal(typeof frame.sessionId,'string');
  assert.ok(frame.targetBounds?.width>5);
  const sessionId=frame.sessionId;
  try{
    await assert.rejects(interactSceneRuntime({sessionId,action:'click',x:-1,y:10}),/dışındaki/);
    await assert.rejects(interactSceneRuntime({sessionId,action:'key',key:'F12'}),/Yalnız/);
    const b=frame.targetBounds;
    const clicked=await interactSceneRuntime({sessionId,action:'click',
      x:Math.floor(b.x+b.width/2),y:Math.floor(b.y+b.height/2)});
    assert.equal(clicked.sessionId,sessionId);
    assert.ok(['focusing','active'].includes(clicked.phase),'actual click opens the book');
    assert.ok(clicked.image.startsWith('data:image/jpeg;base64,'));
    const returned=await interactSceneRuntime({sessionId,action:'key',key:'Escape'});
    assert.ok(['focusing','returning','room','active'].includes(returned.phase));
    const refreshed=await interactSceneRuntime({sessionId,action:'refresh'});
    assert.equal(refreshed.sessionId,sessionId);
  }finally{
    await closeSceneRuntimeSession({sessionId});
  }
  await assert.rejects(interactSceneRuntime({sessionId,action:'refresh'}),/süresi doldu/);
  assert.equal((await site.snapshot()).sourceHash,source.sourceHash,
    'clicks/keyboard stay confined to ephemeral browser');
});
