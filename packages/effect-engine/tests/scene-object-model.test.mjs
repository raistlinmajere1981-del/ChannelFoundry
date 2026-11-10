import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importProject,exportProject,validateProject} from '../src/model/project.mjs';
import {compileObjectScene} from '../src/runtime/object-compile.mjs';
import {anchorScenePoint,effectLocalPoint,effectScenePoint,effectCanvasStyle,depthZIndex,sortByDepth} from '../src/runtime/object-scene.mjs';

const readScene=name=>readFileSync(new URL(`../examples/${name}`,import.meta.url),'utf8');
const fixture=()=>importProject(readScene('birdesengor-v2.scene.json'));
const v1Fixture=()=>importProject(readScene('gideros.scene.json'));
const rejects=(label,edit)=>{
  const scene=fixture();edit(scene);
  assert.throws(()=>validateProject(scene),undefined,label);
};

test('v1 JSON remains strict and never accepts v2-only effect types',()=>{
  const scene=v1Fixture();
  assert.deepEqual(importProject(exportProject(scene)),scene);
  const withFlame=structuredClone(scene);
  withFlame.effects[0].type='flame';
  assert.throws(()=>validateProject(withFlame),/Bilinmeyen efekt türü/);
  for(const type of ['metal-glint','water-ripple']){
    const invalid=structuredClone(scene);invalid.effects[0].type=type;
    assert.throws(()=>validateProject(invalid),/Bilinmeyen efekt türü/);
  }
  const fakeV2=structuredClone(scene);
  fakeV2.version=2;
  assert.throws(()=>validateProject(fakeV2),/Nesne sahnesi|bilinmeyen alan/i);
});

test('v2 object scene imports and roundtrips without migration',()=>{
  const scene=fixture();
  assert.equal(scene.version,2);
  assert.equal(scene.kind,'objectScene');
  assert.equal(scene.objects.length,5);
  assert.ok(!scene.objects.some(object=>object.id==='quill'));
  assert.ok(!scene.objects.flatMap(object=>object.anchors).some(anchor=>anchor.id==='quill.tip'));
  assert.equal(scene.effects.length,3);
  assert.deepEqual(importProject(exportProject(scene)),scene);
  assert.deepEqual(importProject(JSON.stringify(scene)),scene);
});

test('v2 rejects duplicate ids, unknown references and unknown effects',()=>{
  rejects('duplicate object id',s=>{s.objects[1].id=s.objects[0].id;});
  rejects('duplicate effect id',s=>{s.effects[1].id='glow-1';});
  rejects('effect id collides with object id',s=>{s.effects[0].id='candle';});
  rejects('duplicate anchor id',s=>{s.objects[0].anchors.push({...s.objects[0].anchors[0]});});
  rejects('unknown object',s=>{s.effects[0].target.objectId='missing';});
  rejects('unknown anchor',s=>{s.effects[0].target.anchorId='missing';});
  rejects('old water effect in v2',s=>{s.effects[0].type='sunlight';});
  rejects('unknown effect type',s=>{s.effects[0].type='spark';});
  rejects('non-object target kind',s=>{s.effects[0].target.kind='image';});
});

test('v2 rejects out-of-range poses, anchors, scale, offsets and depth',()=>{
  rejects('negative pose x',s=>{s.objects[0].pose.x=-0.01;});
  rejects('object overflows scene width',s=>{s.objects[0].pose.width=0.95;});
  rejects('object overflows scene height',s=>{s.objects[1].pose.y=0.9;});
  rejects('zero pose width',s=>{s.objects[0].pose.width=0;});
  rejects('anchor x above one',s=>{s.objects[0].anchors[0].x=1.01;});
  rejects('anchor y below zero',s=>{s.objects[0].anchors[0].y=-0.01;});
  rejects('rotation out of range',s=>{s.objects[0].pose.rotation=361;});
  rejects('non-finite object depth',s=>{s.objects[0].pose.depth=Infinity;});
  rejects('zero scale',s=>{s.effects[0].target.scale=0;});
  rejects('non-finite offset',s=>{s.effects[0].target.offset.x=Infinity;});
  rejects('effect depth out of range',s=>{s.effects[0].target.depth=101;});
});

test('v2 rejects malformed shape, version/kind and unknown fields',()=>{
  rejects('version 1 object scene',s=>{s.version=1;});
  rejects('version 3 object scene',s=>{s.version=3;});
  rejects('wrong kind',s=>{s.kind='imageScene';});
  rejects('missing kind',s=>{delete s.kind;});
  rejects('missing viewport',s=>{delete s.viewport;});
  rejects('bad viewport',s=>{s.viewport.width=0;});
  rejects('non-integer viewport',s=>{s.viewport.height=900.5;});
  rejects('missing objects',s=>{delete s.objects;});
  rejects('missing effects',s=>{delete s.effects;});
  rejects('missing format',s=>{delete s.format;});
  rejects('missing sceneId',s=>{delete s.sceneId;});
  rejects('unknown root field',s=>{s.extra=true;});
  rejects('unknown object field',s=>{s.objects[0].extra=true;});
  rejects('missing pose field',s=>{delete s.objects[0].pose.rotation;});
  rejects('missing anchor field',s=>{delete s.objects[0].anchors[0].y;});
  rejects('unknown effect field',s=>{s.effects[0].extra=true;});
  rejects('missing target field',s=>{delete s.effects[0].target.anchorId;});
  rejects('unknown target field',s=>{s.effects[0].target.extra=true;});
  rejects('missing params key',s=>{delete s.effects[0].params.pulse;});
  rejects('unknown params key',s=>{s.effects[0].params.extra=1;});
  rejects('non-integer smoke count',s=>{s.effects[2].params.count=1.5;});
  rejects('missing enabled',s=>{delete s.effects[0].enabled;});
  rejects('missing seed',s=>{delete s.effects[0].seed;});
});

test('object compiler preserves order, resolves anchors and filters visibility',()=>{
  const scene=fixture();
  const compiled=compileObjectScene(scene);
  assert.equal(compiled.sceneId,'birdesengor-study-v2');
  assert.deepEqual(compiled.viewport,{width:1600,height:900});
  assert.equal(compiled.objects.length,5);
  assert.deepEqual(compiled.effects.map(effect=>effect.id),['glow-1','flame-1','smoke-1']);
  const flame=compiled.effects[1];
  assert.equal(flame.objectId,'candle');
  assert.deepEqual(flame.anchor,{x:0.5,y:0.205});
  assert.deepEqual(flame.offset,{x:0,y:0});
  assert.equal(flame.placement,'bottom');
  assert.equal(flame.seed,'flame-1:flame-a');
  assert.equal(typeof flame.create,'function');
  assert.equal(flame.params.width,0.12);
  assert.equal(flame.params.height,0.3);
  assert.equal(compiled.effects[0].placement,'center');
  assert.equal(compiled.effects[0].params.width,0.35);
  assert.deepEqual(compiled,compileObjectScene(scene));
  scene.objects.find(object=>object.id==='candle').visible=false;
  assert.equal(compileObjectScene(scene).effects.length,0);
  scene.objects.find(object=>object.id==='candle').visible=true;
  scene.effects[1].enabled=false;
  assert.deepEqual(compileObjectScene(scene).effects.map(effect=>effect.id),['glow-1','smoke-1']);
});

test('object projection maps local anchors and offsets into scene space',()=>{
  const scene=fixture();
  const candle=scene.objects.find(object=>object.id==='candle');
  const glow=scene.effects.find(effect=>effect.id==='glow-1');
  const flame=scene.effects.find(effect=>effect.id==='flame-1');
  assert.deepEqual(anchorScenePoint(candle,'candle.flame-base'),{x:0.795,y:0.4702});
  assert.deepEqual(effectLocalPoint(candle,flame),{x:0.5,y:0.205});
  assert.deepEqual(effectLocalPoint(candle,glow),{x:0.5,y:0.175});
  assert.deepEqual(effectScenePoint(candle,glow),{x:0.795,y:0.457});
  assert.throws(()=>anchorScenePoint(candle,'missing'),/Bağlantı noktası/);
});

test('object canvas styles use normalized anchor percentages and depth stacking',()=>{
  const center=effectCanvasStyle({anchor:{x:0.5,y:0.08},offset:{x:0,y:-0.03},width:0.35,height:0.35,placement:'center'});
  assert.deepEqual(center,{left:'50%',top:'5%',width:'35%',height:'35%',transform:'translate(-50%, -50%)'});
  const bottom=effectCanvasStyle({anchor:{x:0.25,y:0.75},offset:{x:0.1,y:0},width:0.12,height:0.3,placement:'bottom'});
  assert.deepEqual(bottom,{left:'35%',top:'75%',width:'12%',height:'30%',transform:'translate(-50%, -100%)'});
  assert.equal(depthZIndex(0),'1000');
  assert.equal(depthZIndex(-1),'999');
  assert.deepEqual(sortByDepth([{id:'a',depth:1},{id:'b',depth:-1},{id:'c',depth:1}]).map(item=>item.id),['b','a','c']);
});

test('object compiler refuses v1 input instead of guessing',()=>{
  assert.throws(()=>compileObjectScene(v1Fixture()),/version 2|objectScene/i);
});

test('malformed JSON is rejected without mutation',()=>{
  assert.throws(()=>importProject('{'),/JSON okunamadı/);
  const scene=fixture();
  const before=JSON.stringify(scene);
  assert.throws(()=>validateProject({...scene,objects:null}));
  assert.equal(JSON.stringify(scene),before);
});
