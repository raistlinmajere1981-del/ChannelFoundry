import test from "node:test";
import assert from "node:assert/strict";
import {studioPenPose} from "./vefk-pen-pose.ts";
const at={x:220,y:240};
test("drawing nib follows motion with true ink contact",()=>{
  const stroke=studioPenPose({phase:"drawing",penDown:true,position:at},
    {x:180,y:240},{x:260,y:240});
  assert.deepEqual(stroke,{angleDeg:90,lift:0,contact:true,phase:"drawing"});
  const vertical=studioPenPose({phase:"drawing",penDown:true,position:at},
    {x:220,y:200},{x:220,y:280});
  assert.equal(vertical.angleDeg,180);
});
test("quill lifts at inter-path travel without falsely depositing ink",()=>{
  const moved=studioPenPose({phase:"travel",penDown:false,position:at},
    {x:150,y:210},{x:300,y:270});
  assert.equal(moved.contact,false);
  assert.equal(moved.lift,11);
  assert.ok(moved.angleDeg>90&&moved.angleDeg<125);
  for(const phase of ["ready","hold"]){
    const idle=studioPenPose({phase,penDown:false,position:at},at,at);
    assert.equal(idle.contact,false);
    assert.equal(idle.lift,16);
    assert.equal(idle.angleDeg,0);
  }
});
test("pose stays deterministic and rejects invalid positions",()=>{
  const pen={phase:"drawing",penDown:true,position:{x:10,y:20}};
  const start={x:9,y:19},end={x:11,y:21};
  const before=structuredClone([pen,start,end]);
  assert.deepEqual(studioPenPose(pen,start,end),studioPenPose(pen,start,end));
  assert.deepEqual([pen,start,end],before);
  assert.throws(()=>studioPenPose(pen,{x:NaN,y:1},end),/sonlu/);
  assert.throws(()=>studioPenPose({phase:"mystery",penDown:false,position:at},at,at),/geçersiz/);
});
