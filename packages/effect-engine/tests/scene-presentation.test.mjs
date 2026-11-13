import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultScenePresentation,validateScenePresentation,focusProfile,FOCUS_OBJECT_IDS} from '../src/model/scene-presentation.mjs';
test('four-object presentation remains valid after live Studio calibration',()=>{
 const current=JSON.parse(readFileSync(new URL('../../../channels/birdesengor/web/src/scene/data/scene-presentation.v1.json',import.meta.url),'utf8'));
 const defaults=defaultScenePresentation();
 assert.equal(validateScenePresentation(current),current);
 assert.equal(validateScenePresentation(defaults),defaults);
 assert.deepEqual(Object.keys(current.objects).sort(),[...FOCUS_OBJECT_IDS].sort());
 for(const id of FOCUS_OBJECT_IDS)assert.equal(typeof current.objects[id].roomVisible,'boolean');
 for(const id of ['research-journal','community-journal']){
   assert.deepEqual(Object.keys(current.objects[id].closedBook).sort(),['x','y','width','angle','surfaceScaleY'].sort());
 }
 assert.equal(typeof focusProfile(current,'camera',true).nearZoom,'number');
 assert.equal(typeof focusProfile(current,'research-journal',false).roomShiftX,'number');
});
test('presentation rejects unknown ids, malformed devices, unknown controls and unsafe durations',()=>{
 const source=defaultScenePresentation();
 const changes=[
  value=>{value.sceneId='unknown';},
  value=>{value.objects.rogue=structuredClone(value.objects.camera);},
  value=>{delete value.objects.camera;},
  value=>{value.objects.camera.focusMs=100;},
  value=>{value.objects.camera.returnMs=500.4;},
  value=>{value.objects.camera.detailMs=4000;},
  value=>{value.objects['research-journal'].desktop.nearZoom=3;},
  value=>{value.objects['vefk-stand'].mobile.roomShiftY=99;},
  value=>{value.objects.camera.desktop.inject=true;},
  value=>{value.objects.camera.mobile.nearShiftX=NaN;},
  value=>{value.objects.camera.book={};},
  value=>{delete value.objects['research-journal'].book;},
  value=>{value.objects['research-journal'].book.pageRatio=1.1;},
  value=>{value.objects['research-journal'].book.mobilePageRatio=.42;},
  value=>{value.objects['research-journal'].book.depthDesktop=-1;},
  value=>{value.objects['community-journal'].book.indexes.topMobile=35;},
  value=>{value.objects['research-journal'].book.ribbon.widthMobile=100;},
  value=>{value.objects['research-journal'].book.ribbon.injected=1;},
  value=>{value.objects['community-journal'].book.turnMs=270.3;},
  value=>{value.objects['community-journal'].book.readingPadXMobile=2;},
  value=>{delete value.objects.camera.physical;},
  value=>{value.objects['vefk-stand'].physical.desktop.paperScale=1.6;},
  value=>{value.objects['vefk-stand'].physical.mobile.paperX=120;},
  value=>{value.objects.camera.physical.desktop.widthScale=1.5;},
  value=>{value.objects.camera.physical.mobile.archiveWidth=600;},
  value=>{value.objects.camera.physical.desktop.videoMinHeight=NaN;},
  value=>{value.objects.camera.physical.mobile.inject=true;},
  value=>{value.objects['vefk-stand'].physical.desktop.catalogY=-200;},
  value=>{value.objects.camera.physical.desktop.hingeAngle=45;},
  value=>{value.objects['vefk-stand'].physical.mobile.quillDockX=99;},
  value=>{value.objects['vefk-stand'].physical.desktop.quillRestAngle=-8;},
  value=>{value.objects['research-journal'].roomVisible='false';},
  value=>{value.objects.camera.roomVisible=0;},
  value=>{value.objects['research-journal'].closedBook.x=-1;},
  value=>{value.objects['research-journal'].closedBook.width=.9;},
  value=>{value.objects['community-journal'].closedBook.angle=90;},
  value=>{value.objects['community-journal'].closedBook.injected=true;},
  value=>{value.objects.camera.closedBook={};},
 ];
 for(const change of changes){
  const invalid=structuredClone(source);change(invalid);
  assert.throws(()=>validateScenePresentation(invalid));
 }
});
