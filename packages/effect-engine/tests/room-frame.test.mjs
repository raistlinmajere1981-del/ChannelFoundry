import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roomFrameGeometry} from '../src/model/room-frame.mjs';

test('web room frame preserves entire 2:1 plate on laptop and portrait displays',()=>{
  assert.deepEqual(roomFrameGeometry(1920,1080).room,{width:1920,height:960,x:0,y:60});
  assert.deepEqual(roomFrameGeometry(390,844).empty,{left:0,right:0,top:324.5,bottom:324.5});
  assert.deepEqual(roomFrameGeometry(768,1024).room,{width:768,height:384,x:0,y:320});
  assert.deepEqual(roomFrameGeometry(2560,720).room,{width:1440,height:720,x:560,y:0});
  assert.equal(roomFrameGeometry(390,844).visibleFraction,1);
  assert.throws(()=>roomFrameGeometry(390,0));
});
