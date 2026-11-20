import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMPOSITION_FRAME,COMPOSITION_MODES,FOCUS_IDS,validateCompositionGuide,compositionGuideForScene}
  from '../src/scene-workspace/composition-plan-v4.mjs';

const make=(id,name,x,y,width,height)=>({id,name,pose:{x,y,width,height},visible:true});
test('Studio composition guide is driven by current scene, not obsolete hard-coded slots',()=>{
  assert.equal(COMPOSITION_FRAME.width/COMPOSITION_FRAME.height,2);
  assert.deepEqual([...COMPOSITION_MODES],['off','focus','details','all']);
  assert.equal(FOCUS_IDS.length,4);
  const scene={objects:[
    make('research-journal','Evren kitabı',.10,.20,.20,.22),
    make('ceremonial-robe','Kaftan',.61,.31,.09,.15),
    make('guardian-sword-left','Sol kılıç',.24,.44,.04,.11),
  ]};
  const areaFor=item=>item.editorArea??item.pose;
  const first=compositionGuideForScene(scene,'details',{areaFor});
  assert.deepEqual(first.map(x=>x.id),['ceremonial-robe','guardian-sword-left']);
  assert.equal(first[0].x,.61);
  scene.objects[1].editorArea={x:.72,y:.40,width:.04,height:.07};
  const second=compositionGuideForScene(scene,'details',{areaFor});
  assert.deepEqual(second[0],{id:'ceremonial-robe',label:'Kaftan',x:.72,y:.40,width:.04,height:.07});
  assert.equal(compositionGuideForScene(scene,'focus',{areaFor})[0].id,'research-journal');
  assert.equal(compositionGuideForScene(scene,'all',{areaFor}).length,3);
  assert.deepEqual(compositionGuideForScene(scene,'off',{areaFor}),[]);
  scene.objects[2].visible=false;
  assert.equal(compositionGuideForScene(scene,'all',{areaFor}).length,2);
});
test('live guide validation rejects duplicate and out-of-frame coordinates',()=>{
  const a=[{id:'a',x:.21,y:.35,width:.1,height:.1}];
  assert.equal(validateCompositionGuide(a),a);
  assert.throws(()=>validateCompositionGuide([...a,{...a[0]}]),/Tekrarlanan/);
  assert.throws(()=>validateCompositionGuide([{...a[0],x:.97}]),/kadrajını aşan/);
});
