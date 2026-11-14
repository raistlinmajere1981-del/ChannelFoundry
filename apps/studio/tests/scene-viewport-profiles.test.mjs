import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENE_SCREEN_PRESETS,SCENE_SCREEN_OPTIONS,sceneScreenProfile}
  from '../src/scene-workspace/scene-viewport-profiles.mjs';

test('all screen profiles are explicit, deterministic and in the same centralized menu',()=>{
  assert.deepEqual(Object.keys(SCENE_SCREEN_PRESETS),
    ['1920x1080','1366x768','2560x1080','768x1024','390x844']);
  assert.deepEqual(SCENE_SCREEN_OPTIONS.map(([key])=>key),
    ['room',...Object.keys(SCENE_SCREEN_PRESETS).slice(0,5),'custom']);
});
test('room source uses full photo and no screen padding',()=>{
  const profile=sceneScreenProfile('room',390,844,2);
  assert.equal(profile.visibleFraction,1);
  assert.equal(profile.screenFillFraction,1);
  assert.deepEqual(profile.padding,{left:0,right:0,top:0,bottom:0});
  assert.deepEqual(profile.geometry.room,{width:2000,height:1000,x:0,y:0});
});
test('portrait and ultrawide screens preserve 2:1 source without cropping',()=>{
  const phone=sceneScreenProfile('390x844');
  assert.equal(phone.device,'mobile');
  assert.deepEqual(phone.padding,{left:0,right:0,top:324.5,bottom:324.5});
  assert.equal(phone.geometry.room.width,390);
  assert.equal(phone.geometry.room.height,195);
  assert.equal(phone.visibleFraction,1);
  assert.ok(phone.screenFillFraction<.25);
  const ultrawide=sceneScreenProfile('2560x1080');
  assert.equal(ultrawide.device,'desktop');
  assert.deepEqual(ultrawide.padding,{left:200,right:200,top:0,bottom:0});
  assert.equal(ultrawide.geometry.room.width,2160);
  assert.equal(ultrawide.geometry.room.height,1080);
});
test('custom dimensions remain bounds checked and never infer cropping',()=>{
  const custom=sceneScreenProfile('custom',2560,720);
  assert.deepEqual(custom.padding,{left:560,right:560,top:0,bottom:0});
  assert.equal(custom.visibleFraction,1);
  for(const [key,width,height] of [
    ['wrong',1920,1080],['custom',239,1080],['custom',1920,4097],
    ['custom',390.5,844],['custom',0,0],
  ]) assert.throws(()=>sceneScreenProfile(key,width,height),/Geçersiz|240–4096/);
});
