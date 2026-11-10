import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEffect,importProject,exportProject} from '../src/model/project.mjs';
import {compileScene} from '../src/runtime/compile.mjs';
import {effectRegistry} from '../src/registry/effects.mjs';
import {reorderEffect,applyPreset,previewScene} from '../src/editor/effect-actions.mjs';
import {History} from '../src/editor/history.mjs';
import {seededRandom} from '../src/runtime/random.mjs';
const fixture=()=>importProject(readFileSync(new URL('../examples/gideros.scene.json',import.meta.url),'utf8'));
test('sunlight compiles original polygon bounds, supports multiple instances and v1 roundtrip',()=>{
  const s=fixture();s.zones[0].points=[[100,200],[700,200],[700,440],[100,440]];
  s.effects.push(createEffect('sunlight',s.zones[0].id,'sun1'),createEffect('sunlight',s.zones[1].id,'sun2'));
  const config=compileScene(s),p=config.effects[2].params;
  assert.equal(p.enabled,true);assert.deepEqual(p.waterArea,s.zones[0].points);
  assert.deepEqual(p.regions[0].center,[400,320]);assert.deepEqual(p.regions[0].radius,[600/Math.SQRT2,240/Math.SQRT2]);assert.deepEqual(p.regions[0].length,[5,18]);
  assert.deepEqual(importProject(exportProject(s)),s);assert.deepEqual(config,compileScene(s));
  assert.notDeepEqual(config.effects[2].params,config.effects[3].params);
});
test('sunlight seeded spawn is deterministic and within translated concave polygon',()=>{
  const Original=globalThis.Path2D;
  globalThis.Path2D=class {moveTo(){} lineTo(){} closePath(){} quadraticCurveTo(){}};
  try{
    const z={points:[[50,80],[650,80],[650,150],[200,150],[200,400],[50,400]]};
    const params=effectRegistry.sunlight.compile(z,createEffect('sunlight','z','e').params);
    const spawn=()=>effectRegistry.sunlight.create({params,random:seededRandom('fixed')});
    const a=spawn(),b=spawn();assert.deepEqual(a.inspect(),b.inspect());assert.equal(a.inspect().count,110);
    for(const p of a.inspect().glints){assert.ok(p.x>=50&&p.x<=650&&p.y>=80&&p.y<=400);assert.ok(p.x<=200||p.y<=150);}
    a.update(.25);b.update(.25);assert.deepEqual(a.inspect(),b.inspect());a.destroy();b.destroy();
  }finally{if(Original===undefined)delete globalThis.Path2D;else globalThis.Path2D=Original;}
});
test('reorder swaps adjacent layers both ways, preserves IDs, history and JSON',()=>{
  const s=fixture(),before=structuredClone(s),id=s.effects[1].id,h=new History();h.record(s);
  assert.ok(reorderEffect(s,id,-1));assert.equal(s.effects[0].id,id);assert.equal(reorderEffect(s,id,-1),false);
  assert.deepEqual(importProject(exportProject(s)),s);assert.deepEqual(h.undo(s),before);assert.deepEqual(h.redo(before),s);
  assert.ok(reorderEffect(s,id,1));assert.deepEqual(s,before);assert.equal(reorderEffect(s,id,1),false);
});
test('solo projects only selected enabled visible effect without mutating persisted JSON',()=>{
  const s=fixture(),before=exportProject(s),id=s.effects[1].id;
  assert.deepEqual(compileScene(previewScene(s,id)).effects.map(e=>e.id),[id]);assert.equal(exportProject(s),before);
  assert.equal(compileScene(previewScene(s,null)).effects.length,2);
  s.effects[1].enabled=false;assert.equal(compileScene(previewScene(s,id)).effects.length,0);
});
test('type-specific presets preserve seed, zone, enabled, booleans and neighbors',()=>{
  for(const type of Object.keys(effectRegistry))for(const [name,count,opacity] of [['Sakin',type==='offshore'?75:type==='shimmer'?65:55,.65],['Doğal',type==='offshore'?155:type==='shimmer'?140:110,type==='sunlight'?1.1:1.15],['Canlı',type==='offshore'?230:type==='shimmer'?220:180,type==='sunlight'?1.5:1.4]]){
    const s=fixture(),e=createEffect(type,s.zones[0].id,'preset');e.seed='keep';if(type==='offshore'){e.params.breaking=false;e.params.crestLines=false;}
    e.params.count=1;s.effects.push(e);const old=structuredClone(s),before=compileScene(s);
    assert.ok(applyPreset(s,e.id,name));assert.equal(e.params.count,count);assert.equal(e.params.opacity,opacity);assert.equal(e.params.length,name==='Sakin'?.7:name==='Doğal'?1:type==='offshore'?1.25:1.3);
    assert.equal(e.seed,'keep');assert.equal(e.zoneId,old.effects[2].zoneId);assert.equal(e.enabled,true);assert.deepEqual(s.effects.slice(0,2),old.effects.slice(0,2));
    if(type==='offshore'){assert.equal(e.params.breaking,false);assert.equal(e.params.crestLines,false);assert.equal(e.params.speed,name==='Sakin'?1:name==='Doğal'?2.85:3.5);}
    assert.notDeepEqual(compileScene(s),before);assert.deepEqual(importProject(exportProject(s)),s);
    e.enabled=false;applyPreset(s,e.id,name);assert.equal(e.enabled,false);
  }
});
test('polygon sampling covers narrow, clockwise and collinear-edged zones deterministically',async()=>{
  const {polygonSampler}=await import('../src/runtime/polygon-sampling.mjs');
  for(const points of [[[10,10],[300,200],[299,202],[9,12]],[[0,0],[100,0],[200,0],[200,100],[0,100]],[[0,100],[200,100],[200,0],[0,0]]]){
    const sample=polygonSampler(points),a=seededRandom('sampling'),b=seededRandom('sampling');
    const inside=([x,y])=>{let value=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const p=points[i],q=points[j];if((p[1]>y)!==(q[1]>y)&&x<(q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0])value=!value;}return value;};
    for(let i=0;i<200;i++){const point=sample(a);assert.deepEqual(point,sample(b));assert.ok(inside(point));}
  }
});
