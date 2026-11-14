import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deviceRoomBox,deviceStageHit,deviceNativeHit,deviceStagePoint,
} from '../src/scene-workspace/scene-room-geometry.mjs';
import {
  defaultRoomDevicePlacement,placedDeviceHitArea,
} from '../../../packages/effect-engine/src/model/scene-presentation.mjs';

const epsilon = (a,b,label) => assert.ok(Math.abs(a-b)<1e-8,label+': '+a+' != '+b);

for(const id of ['camera','vefk-stand']){
  test(id+' canonical room placement drives all Studio boxes, hit areas and targets',()=>{
    const home=defaultRoomDevicePlacement(id);
    const next={x:.62,y:.66,scale:1.12};
    const presentation={objects:{[id]:{roomPlacement:next}}};
    const roomObjects=new Map([[id,{kind:'device',
      foundation:{x:.85,y:.7,width:.16,height:.2}}]]);
    const visual=deviceRoomBox(presentation,id,roomObjects);
    epsilon(visual.x+visual.width/2,next.x,'image center X');
    epsilon(visual.y+visual.height/2,next.y,'image center Y');
    epsilon(visual.width,.16*next.scale,'physical image scale');
    const original={x:home.x-.055,y:home.y-.09,width:.12,height:.17};
    const stageHit=deviceStageHit(presentation,id,original);
    assert.deepEqual(stageHit,placedDeviceHitArea(presentation,id,original));
    const restored=deviceNativeHit(presentation,id,stageHit);
    for(const key of ['x','y','width','height'])epsilon(restored[key],original[key],'inverse '+key);
    const moved={...stageHit,x:stageHit.x+.03,y:stageHit.y+.02};
    const nativeMoved=deviceNativeHit(presentation,id,moved);
    const drawn=deviceStageHit(presentation,id,nativeMoved);
    for(const key of ['x','y','width','height'])epsilon(drawn[key],moved[key],'stage update '+key);
    const anchor=deviceStagePoint(presentation,id,home);
    epsilon(anchor.x,next.x,'effect anchor follows X');
    epsilon(anchor.y,next.y,'effect anchor follows Y');
    assert.deepEqual(deviceRoomBox(presentation,'candle',roomObjects),null);
    assert.deepEqual(deviceStageHit(presentation,'candle',original),original);
  });
}
