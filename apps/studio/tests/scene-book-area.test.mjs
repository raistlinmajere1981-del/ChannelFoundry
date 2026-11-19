import test from 'node:test';
import assert from 'node:assert/strict';
import {bookStageArea,bookPlacementFromArea,linkedArea,bookMarkerPoint} from '../src/scene-workspace/scene-book-area.mjs';
test('closed book visual bounds round trip into its physical room placement',()=>{
 const pose={x:.392,y:.806,width:.252,angle:-4,surfaceScaleY:.975};
 const area=bookStageArea(pose);
 assert.equal(area.width,.252);
 const next=bookPlacementFromArea(pose,area);
 for(const key of ['x','y','width','surfaceScaleY'])assert.ok(Math.abs(next[key]-pose[key])<1e-8,key);
 assert.equal(next.angle,pose.angle);
});
test('linked hit area follows transformed cover without changing its relative spacing',()=>{
 const original={x:.2,y:.3,width:.25,height:.35},changed={x:.25,y:.32,width:.3,height:.3};
 const hit={x:.22,y:.34,width:.2,height:.28};
 const linked=linkedArea(original,changed,hit);
 assert.ok(Math.abs(linked.x-.274)<1e-6);
 assert.ok(Math.abs(linked.width-.24)<1e-6);
 assert.ok(Math.abs(linked.height-.24)<1e-6);
});
test('effect marker from canonical book-local coordinates follows actual cover placement',()=>{
 const photo={x:.392,y:.806,width:.252,surfaceScaleY:.975};
 const authored={x:.245,y:.668,width:.163,height:.295};
 const p=bookMarkerPoint(photo,authored,{x:.245+.57*.163,y:.668+.62*.295});
 const visible=bookStageArea(photo);
 assert.ok(Math.abs(p.x-(visible.x+.57*visible.width))<1e-6);
 assert.ok(Math.abs(p.y-(visible.y+.62*visible.height))<1e-6);
});
