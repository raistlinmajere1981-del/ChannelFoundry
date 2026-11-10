import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importProject} from '../src/model/project.mjs';
import {objectEffectRegistry,defaultObjectParams} from '../src/registry/effects.mjs';
import {compileObjectScene} from '../src/runtime/object-compile.mjs';
import {createObjectOverlay,bindObjectScene} from '../src/runtime/object-overlay.mjs';
import {seededRandom} from '../src/runtime/random.mjs';

const fixture=()=>importProject(readFileSync(new URL('../examples/birdesengor-v2.scene.json',import.meta.url),'utf8'));
const make=(type,seed='fixed',overrides={})=>objectEffectRegistry[type].create({
  random:seededRandom(seed),
  params:{...defaultObjectParams(type),...overrides},
});
function fakeContext(width=120,height=180){
  const calls={fill:0,stroke:0};
  const gradient={addColorStop(){}};
  const ctx={canvas:{width,height},calls,save(){},restore(){},rotate(){},clip(){},clearRect(){},setTransform(){},
    beginPath(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},closePath(){},
    fill(){calls.fill++;},stroke(){calls.stroke++;},arc(){},ellipse(){},fillRect(){calls.fill++;},translate(){},scale(){},
    createRadialGradient(){return gradient;},createLinearGradient(){return gradient;}};
  return ctx;
}

function fakeEventTarget(){
  const listeners=new Map();
  return {
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    dispatch(type,event={}){for(const fn of [...(listeners.get(type)||[])])fn(event);},
    listenerCount(type){return listeners.get(type)?.size||0;},
  };
}
function fakeTicker(){
  const clients=new Map();
  return {
    add(callback,fps){clients.set(callback,fps);return()=>clients.delete(callback);},
    tick(dt){for(const callback of [...clients.keys()])callback(dt);},
    get activeCount(){return clients.size;},
    get fps(){return [...clients.values()][0];},
  };
}
function fakeElement(id='candle'){
  const element=fakeEventTarget();
  element.nodeType=1;element.tagName='DIV';element.isConnected=true;
  element.dataset={objectId:id};element.style={};element.children=[];element.className='';element.hidden=false;
  element.clientWidth=400;element.clientHeight=300;
  element.appendChild=child=>{element.children.push(child);child.parentElement=element;child.isConnected=true;return child;};
  element.contains=child=>element.children.includes(child);
  element.getBoundingClientRect=()=>({left:0,top:0,width:element.clientWidth,height:element.clientHeight});
  return element;
}
function installEnvironment({reducedMotion=false,hidden=false,position='static'}={}){
  const keys=['document','window','getComputedStyle','matchMedia','IntersectionObserver','ResizeObserver','MutationObserver','devicePixelRatio','navigator'];
  const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const documentRef=fakeEventTarget();
  documentRef.hidden=hidden;
  documentRef.createElement=tag=>{
    if(tag!=='canvas')throw new Error(`Unexpected element ${tag}`);
    const canvas=fakeEventTarget();
    canvas.tagName='CANVAS';canvas.className='';canvas.style={};canvas.width=0;canvas.height=0;
    canvas.setAttribute=()=>{};
    canvas.getContext=()=>overlayContext(canvas);
    canvas.remove=()=>{if(canvas.parentElement){canvas.parentElement.children=canvas.parentElement.children.filter(child=>child!==canvas);canvas.parentElement=null;}canvas.removed=true;};
    return canvas;
  };
  const windowRef=fakeEventTarget();
  const intersections=[],resizes=[],mutations=[];
  const media={matches:reducedMotion,addEventListener(type,fn){if(type==='change')media.listener=fn;},removeEventListener(){media.listener=null;}};
  Object.defineProperty(globalThis,'document',{value:documentRef,configurable:true,writable:true});
  Object.defineProperty(globalThis,'window',{value:windowRef,configurable:true,writable:true});
  Object.defineProperty(globalThis,'getComputedStyle',{value:node=>({
    position:node.style?.position||position,
    display:node.style?.display,
    visibility:node.className?.includes('is-css-hidden')?'hidden':node.style?.visibility,
  }),configurable:true,writable:true});
  Object.defineProperty(globalThis,'matchMedia',{value:()=>media,configurable:true,writable:true});
  Object.defineProperty(globalThis,'IntersectionObserver',{value:class{
    constructor(callback){this.callback=callback;this.elements=[];intersections.push(this);}
    observe(element){this.elements.push(element);}
    disconnect(){this.disconnected=true;}
    trigger(isIntersecting=true){this.callback([{isIntersecting,target:this.elements[0]}]);}
  },configurable:true,writable:true});
  Object.defineProperty(globalThis,'ResizeObserver',{value:class{
    constructor(callback){this.callback=callback;this.elements=[];resizes.push(this);}
    observe(element){this.elements.push(element);}
    disconnect(){this.disconnected=true;}
    trigger(){this.callback();}
  },configurable:true,writable:true});
  Object.defineProperty(globalThis,'MutationObserver',{value:class{
    constructor(callback){this.callback=callback;this.observed=[];mutations.push(this);}
    observe(element,options){this.observed.push({element,options});}
    disconnect(){this.disconnected=true;}
    trigger(){this.callback([]);}
  },configurable:true,writable:true});
  Object.defineProperty(globalThis,'devicePixelRatio',{value:2,configurable:true,writable:true});
  Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:8,deviceMemory:8,connection:{saveData:false}},configurable:true,writable:true});
  const object=fakeElement(),parent=fakeElement('parent');
  parent.dataset={};object.parentElement=parent;
  return {
    document:documentRef,window:windowRef,object,parent,intersections,resizes,mutations,
    ticker:fakeTicker(),
    setReducedMotion(value){media.matches=value;media.listener?.({matches:value});},
    restore(){for(const key of keys){const descriptor=previous.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}},
  };
}
function overlayContext(canvas,width=120,height=180){
  const ctx=fakeContext(width,height);
  ctx.canvas=canvas;
  return ctx;
}

test('object effect registry exposes bounded controls and presets for scene objects only',()=>{
  assert.deepEqual(Object.keys(objectEffectRegistry).sort(),['flame','glow','metal-glint','pendulum-sway','smoke','water-ripple']);
  for(const [type,entry] of Object.entries(objectEffectRegistry)){
    assert.deepEqual(entry.targetKinds,['sceneObject']);
    assert.ok(['bottom','center'].includes(entry.placement));
    assert.equal(typeof entry.create,'function');
    assert.equal(typeof entry.compile,'function');
    const defaults=defaultObjectParams(type);
    assert.deepEqual(Object.keys(defaults).sort(),entry.controls.map(control=>control.key).sort());
    for(const control of entry.controls){
      assert.ok(control.min<control.max,`${type}.${control.key} range`);
      assert.ok(defaults[control.key]>=control.min&&defaults[control.key]<=control.max,`${type}.${control.key} default`);
    }
    assert.ok(entry.presets&&Object.keys(entry.presets).length>0,`${type} presets`);
  }
  assert.equal(objectEffectRegistry.smoke.controls.find(control=>control.key==='count').step,1);
});

test('flame and glow are seeded, deterministic and advance shared time',()=>{
  for(const type of ['flame','glow']){
    const a=make(type,'same'),b=make(type,'same'),c=make(type,'different');
    assert.deepEqual(a.inspect(),b.inspect(),`${type} initial determinism`);
    assert.notDeepEqual(a.inspect(),c.inspect(),`${type} seed changes state`);
    const before=a.inspect();
    for(const dt of [0.016,0.05,0.12]){a.update(dt);b.update(dt);}
    assert.deepEqual(a.inspect(),b.inspect(),`${type} update determinism`);
    assert.notDeepEqual(a.inspect(),before,`${type} time advances`);
    const ctx=fakeContext();
    a.render(ctx);
    assert.ok(ctx.calls.fill>0,`${type} draws`);
    a.destroy();b.destroy();c.destroy();
    assert.equal(a.inspect().active,0);
  }
});

test('smoke caps particle count, stays deterministic and renders transparent puffs',()=>{
  const a=make('smoke','same'),b=make('smoke','same');
  assert.equal(a.inspect().particles.length,defaultObjectParams('smoke').count);
  assert.deepEqual(a.inspect(),b.inspect());
  for(let i=0;i<240;i++){a.update(1/24);b.update(1/24);}
  assert.deepEqual(a.inspect(),b.inspect(),'smoke remains seeded after many updates');
  assert.equal(a.inspect().particles.length,defaultObjectParams('smoke').count);
  for(const particle of a.inspect().particles){
    assert.ok(particle.x>=0&&particle.x<=1,`smoke x ${particle.x}`);
    assert.ok(particle.y>=0&&particle.y<=1,`smoke y ${particle.y}`);
    assert.ok(particle.alpha>0&&particle.alpha<=1,`smoke alpha ${particle.alpha}`);
    assert.ok(particle.size>0);
  }
  const ctx=fakeContext();
  a.render(ctx);
  assert.ok(ctx.calls.fill>=defaultObjectParams('smoke').count/2);
  a.destroy();
  assert.deepEqual(a.inspect().particles,[]);
});

test('object effect destroy is idempotent and disable stops rendering',()=>{
  const effect=make('flame');
  effect.destroy();effect.destroy();
  assert.equal(effect.inspect().disposed,true);
  effect.update(1);
  assert.equal(effect.inspect().active,0);
});

test('object overlay creates anchor-positioned descendant canvases and honours lifecycle gates',()=>{
  const env=installEnvironment();
  try{
    const overlay=createObjectOverlay(env.object,compileObjectScene(fixture()),{objectId:'candle',ticker:env.ticker});
    assert.equal(env.object.children.length,3);
    const [glow,flame,smoke]=env.object.children;
    for(const canvas of env.object.children){
      assert.equal(canvas.style.position,'absolute');
      assert.equal(canvas.style.pointerEvents,'none');
      assert.equal(canvas.style.display,'none');
    }
    assert.deepEqual([glow.style.left,glow.style.top,glow.style.width,glow.style.height,glow.style.transform,glow.style.zIndex],
      ['50%','17.5%','35%','35%','translate(-50%, -50%)','999']);
    assert.deepEqual([flame.style.left,flame.style.top,flame.style.width,flame.style.height,flame.style.transform,flame.style.zIndex],
      ['50%','20.5%','12%','30%','translate(-50%, -100%)','1000']);
    assert.equal(smoke.style.zIndex,'1001');
    assert.equal(env.object.style.position,'relative');
    assert.equal(overlay.inspect().running,false);
    assert.equal(overlay.inspect().ready,true);
    assert.equal(overlay.inspect().effects.length,3);
    env.intersections[0].trigger(true);
    assert.equal(overlay.inspect().running,true);
    assert.equal(env.ticker.activeCount,1);
    assert.ok(env.object.children.every(canvas=>canvas.style.display==='block'));
    env.ticker.tick(.1);
    assert.equal(overlay.inspect().frames,1);
    assert.ok(overlay.inspect().elapsed>=.1);
    env.document.hidden=true;env.document.dispatch('visibilitychange');
    assert.equal(overlay.inspect().running,false);
    assert.equal(env.ticker.activeCount,0);
    env.document.hidden=false;env.document.dispatch('visibilitychange');
    assert.equal(overlay.inspect().running,true);
    env.window.dispatch('pagehide');
    assert.equal(overlay.inspect().running,false);
    env.window.dispatch('pageshow');
    assert.equal(overlay.inspect().running,true);
    overlay.destroy();
    assert.equal(overlay.inspect().disposed,true);
    assert.equal(env.object.children.length,0);
    assert.equal(env.ticker.activeCount,0);
    assert.equal(env.object.style.position,'');
    assert.ok(env.intersections.every(observer=>observer.disconnected));
    assert.ok(env.resizes.every(observer=>observer.disconnected));
    assert.ok(env.mutations.every(observer=>observer.disconnected));
    assert.equal(env.document.listenerCount('visibilitychange'),0);
    assert.equal(env.window.listenerCount('pagehide'),0);
  }finally{env.restore();}
});

test('CSS-hidden objects and parents stop the ticker even when still intersecting',()=>{
  const env=installEnvironment();
  try{
    const overlay=createObjectOverlay(env.object,compileObjectScene(fixture()),{objectId:'candle',ticker:env.ticker});
    env.intersections[0].trigger(true);
    assert.equal(overlay.inspect().running,true);
    assert.equal(env.ticker.activeCount,1);
    assert.ok(env.mutations.length===1,'one mutation observer per overlay');
    const observed=env.mutations[0].observed.map(entry=>entry.element);
    assert.ok(observed.includes(env.object)&&observed.includes(env.parent),'object and parent are observed');

    const checks=[
      ['object visibility hidden',()=>{env.object.style.visibility='hidden';},()=>{env.object.style.visibility='';}],
      ['parent visibility hidden',()=>{env.parent.style.visibility='hidden';},()=>{env.parent.style.visibility='';}],
      ['object display none',()=>{env.object.style.display='none';},()=>{env.object.style.display='';}],
      ['parent hidden attribute',()=>{env.parent.hidden=true;},()=>{env.parent.hidden=false;}],
      ['parent class hides',()=>{env.parent.className='is-css-hidden';},()=>{env.parent.className='';}],
    ];
    for(const [label,hide,show] of checks){
      hide();env.mutations[0].trigger();
      assert.equal(overlay.inspect().running,false,`${label} stops ticker`);
      assert.equal(overlay.inspect().styleVisible,false,`${label} reports css visibility`);
      assert.equal(env.ticker.activeCount,0,`${label} removes subscription`);
      env.intersections[0].trigger(true);
      assert.equal(overlay.inspect().running,false,`${label} stays stopped while intersecting`);
      show();env.mutations[0].trigger();
      assert.equal(overlay.inspect().running,true,`${label} resumes when visible`);
      assert.equal(env.ticker.activeCount,1);
    }
    overlay.destroy();
  }finally{env.restore();}
});

test('bindObjectScene rejects mismatched scene and object identity',()=>{
  const env=installEnvironment();
  try{
    const wrong=fakeElement('camera');
    assert.throws(()=>bindObjectScene(fixture(),()=>wrong,{ticker:env.ticker}),/Object binding mismatch/);
    delete wrong.dataset.objectId;wrong.dataset.sceneObject='camera';
    assert.throws(()=>bindObjectScene(fixture(),()=>wrong,{ticker:env.ticker}),/Object binding mismatch/);
    const viaSceneObjectId=fakeElement();delete viaSceneObjectId.dataset.objectId;viaSceneObjectId.dataset.sceneObjectId='candle';
    const ok=bindObjectScene(fixture(),()=>viaSceneObjectId,{ticker:env.ticker});
    assert.equal(ok.overlays.size,1);
    ok.destroy();
    assert.throws(()=>bindObjectScene(fixture(),()=>fakeElement('candle'),{ticker:env.ticker,expectedSceneId:'other-scene'}),/Scene binding mismatch/);
    const wrongScene=fakeElement('candle');wrongScene.dataset.sceneId='other-scene';
    assert.throws(()=>bindObjectScene(fixture(),()=>wrongScene,{ticker:env.ticker}),/Scene binding mismatch/);
  }finally{env.restore();}
});

test('reduced motion and offscreen objects never start the shared ticker',()=>{
  const env=installEnvironment({reducedMotion:true});
  try{
    const overlay=createObjectOverlay(env.object,compileObjectScene(fixture()),{objectId:'candle',ticker:env.ticker});
    env.intersections[0].trigger(true);
    assert.equal(overlay.inspect().reducedMotion,true);
    assert.equal(overlay.inspect().running,false);
    assert.equal(env.ticker.activeCount,0);
    env.setReducedMotion(false);
    assert.equal(overlay.inspect().running,true);
    env.intersections[0].trigger(false);
    assert.equal(overlay.inspect().running,false);
    assert.equal(env.ticker.activeCount,0);
    overlay.destroy();
  }finally{env.restore();}
});

test('detached objects release canvases on the next scheduled frame',()=>{
  const env=installEnvironment();
  try{
    const overlay=createObjectOverlay(env.object,compileObjectScene(fixture()),{objectId:'candle',ticker:env.ticker});
    env.intersections[0].trigger(true);
    env.object.isConnected=false;
    env.ticker.tick(.1);
    assert.equal(overlay.inspect().disposed,true);
    assert.equal(env.object.children.length,0);
    assert.equal(env.ticker.activeCount,0);
  }finally{env.restore();}
});

test('object overlay respects its canvas pixel budget and seeks deterministically',()=>{
  const env=installEnvironment();
  try{
    const config=compileObjectScene(fixture());
    const a=createObjectOverlay(env.object,config,{objectId:'candle',ticker:env.ticker,performance:{maxPixels:60000,maxDpr:2}});
    const b=createObjectOverlay(env.object,config,{objectId:'candle',ticker:env.ticker,performance:{maxPixels:60000,maxDpr:2}});
    assert.ok(a.inspect().pixelCount<=60000+10,`pixel budget ${a.inspect().pixelCount}`);
    a.renderAt(1);b.renderAt(1);
    assert.deepEqual(a.inspect().effects,b.inspect().effects);
    assert.equal(a.inspect().frames,b.inspect().frames);
    a.destroy();b.destroy();
  }finally{env.restore();}
});

test('bindObjectScene resolves effect objects and reports unresolved object ids',()=>{
  const env=installEnvironment();
  try{
    const candle=fakeElement('candle');
    const handle=bindObjectScene(fixture(),id=>id==='candle'?candle:null,{ticker:env.ticker});
    assert.deepEqual([...handle.overlays.keys()],['candle']);
    assert.equal(candle.children.length,3);
    assert.deepEqual(handle.inspect().unresolved,[]);
    const missing=bindObjectScene(fixture(),()=>null,{ticker:env.ticker});
    assert.deepEqual(missing.inspect().unresolved,['candle']);
    assert.equal(missing.overlays.size,0);
    const viaMap=bindObjectScene(fixture(),new Map([['candle',fakeElement('candle')]]),{ticker:env.ticker});
    assert.equal(viaMap.overlays.size,1);
    handle.destroy();missing.destroy();viaMap.destroy();
  }finally{env.restore();}
});

test('v2 fixture remains independently importable',()=>{
  assert.equal(fixture().effects[1].type,'flame');
});

test('finite metal/ripple render seeded paths, expire by time and unsubscribe canonical ticker',()=>{
  for(const type of ['metal-glint','water-ripple']){
    const a=make(type,'same'),b=make(type,'same'),other=make(type,'other');
    assert.deepEqual(a.inspect(),b.inspect());assert.notDeepEqual(a.inspect(),other.inspect());
    a.update(.5);for(let i=0;i<5;i++)b.update(.1);
    assert.deepEqual(a.inspect(),b.inspect(),'elapsed time determines the frame');
    const ctx=fakeContext();a.render(ctx,{width:120,height:180});
    assert.ok(ctx.calls.fill+ctx.calls.stroke>0);a.update(2);a.render(ctx,{width:120,height:180});
    assert.equal(a.inspect().active,0);assert.equal(a.isComplete(),true);a.destroy();a.destroy();
    const env=installEnvironment();
    try{
      const scene=fixture();scene.effects=[{...scene.effects[0],type,params:defaultObjectParams(type)}];
      const overlay=createObjectOverlay(env.object,compileObjectScene(scene),{objectId:'candle',ticker:env.ticker});
      env.intersections[0].trigger(true);assert.equal(env.ticker.activeCount,1);
      for(let i=0;i<40;i++)env.ticker.tick(.05);
      assert.equal(env.ticker.activeCount,0);assert.equal(overlay.inspect().effects[0].complete,true);
      overlay.refresh();assert.equal(env.ticker.activeCount,0,'completed burst never restarts on resize');
      overlay.destroy();assert.equal(env.object.children.length,0);
      assert.ok(env.intersections.every(observer=>observer.disconnected));
    }finally{env.restore();}
    const reduced=installEnvironment({reducedMotion:true});
    try{
      const scene=fixture();scene.effects=[{...scene.effects[0],type,params:defaultObjectParams(type)}];
      const overlay=createObjectOverlay(reduced.object,compileObjectScene(scene),{objectId:'candle',ticker:reduced.ticker});
      reduced.intersections[0].trigger(true);
      assert.equal(reduced.ticker.activeCount,0);assert.equal(overlay.inspect().frames,0);
      assert.ok(overlay.inspect().fps<=24);overlay.destroy();assert.equal(reduced.object.children.length,0);
    }finally{reduced.restore();}
  }
});

function motionFixture(){
  const scene=fixture(),object=scene.objects.find(o=>o.id==='candle');
  object.motionLayers=['pendant'];
  const effect={...scene.effects.find(e=>e.target.objectId==='candle'),id:'motion',type:'pendulum-sway',params:defaultObjectParams('pendulum-sway')};
  effect.target={...effect.target,layerId:'pendant',offset:{x:0,y:0},scale:1};scene.effects=[effect];return scene;
}
test('pendulum follows damped angular motion, both directions, exact rest and speed scaling',()=>{
  const a=make('pendulum-sway'),b=make('pendulum-sway','fixed',{speed:2});
  a.update(.125);b.update(.0625);
  assert.equal(a.inspect().angle,b.inspect().angle);
  assert.ok(a.inspect().angle>0&&a.inspect().angle<3);
  a.update(.25);assert.ok(a.inspect().angle<0);
  a.update(1.415);const near=a.inspect().angle;
  assert.ok(Math.abs(near)<.001,'terminal envelope settles with no final snap');
  a.update(.02);assert.equal(a.inspect().angle,0);assert.equal(a.isComplete(),true);
  a.destroy();a.update(10);assert.equal(a.motion().angle,0);
});
test('motion layers use canonical ticker without canvas and restore styles on all lifecycle gates',()=>{
  for(const gate of ['completion','disable','hidden','reduced','pagehide','destroy','detached','unmount']){
    const env=installEnvironment();
    try{
      const child=fakeElement('pendant');child.dataset={effectLayer:'pendant'};child.style={rotate:'0deg',transformOrigin:'50% 10%'};env.object.appendChild(child);
      const fixed=fakeElement('fixed');env.object.appendChild(fixed);
      const compiled=compileObjectScene(motionFixture());
      const overlay=createObjectOverlay(env.object,compiled,{ticker:env.ticker,objectId:'candle'});
      assert.equal(overlay.canvases.length,0);assert.equal(child.style.transformOrigin,'50% 20.5%');
      env.intersections[0].trigger(true);env.ticker.tick(.125);
      assert.notEqual(child.style.rotate,'0deg');assert.equal(fixed.style.rotate,undefined);assert.equal(env.ticker.activeCount,1);
      if(gate==='completion')env.ticker.tick(2);
      if(gate==='disable')overlay.setEnabled(false);
      if(gate==='hidden'){env.document.hidden=true;env.document.dispatch('visibilitychange');}
      if(gate==='reduced')env.setReducedMotion(true);
      if(gate==='pagehide')env.window.dispatch('pagehide');
      if(gate==='destroy')overlay.destroy();
      if(gate==='detached'){child.isConnected=false;env.ticker.tick(.1);}
      if(gate==='unmount'){env.object.isConnected=false;env.ticker.tick(.1);}
      assert.equal(child.style.rotate,'0deg',gate);assert.equal(env.ticker.activeCount,0,gate);
      overlay.destroy();overlay.destroy();assert.equal(child.style.transformOrigin,'50% 10%');
      assert.equal(env.object.children.length,2,'consumer-owned image stays mounted');
    }finally{env.restore();}
  }
});
test('motion binding rejects missing, duplicate and already claimed layers with rollback',()=>{
  const env=installEnvironment();
  try{
    const compiled=compileObjectScene(motionFixture());
    assert.throws(()=>createObjectOverlay(env.object,compiled,{objectId:'candle'}),/layer/);
    const child=fakeElement();child.dataset={effectLayer:'pendant'};env.object.appendChild(child);
    const overlay=createObjectOverlay(env.object,compiled,{objectId:'candle',ticker:env.ticker});
    assert.throws(()=>createObjectOverlay(env.object,compiled,{objectId:'candle'}),/already bound/);
    overlay.destroy();
    const duplicate=fakeElement();duplicate.dataset={effectLayer:'pendant'};env.object.appendChild(duplicate);
    assert.throws(()=>createObjectOverlay(env.object,compiled,{objectId:'candle'}),/ambiguous/);
  }finally{env.restore();}
});
test('motion JSON validates layer identity, duplicates, finite parameters and persisted profiles',()=>{
  const scene=motionFixture();assert.deepEqual(importProject(JSON.stringify(scene)),scene);
  const invalid=[s=>{delete s.effects[0].target.layerId;},s=>s.effects[0].target.layerId='fixed',s=>s.objects.find(o=>o.id==='candle').motionLayers.push('pendant'),s=>s.effects.push({...structuredClone(s.effects[0]),id:'another-motion'})];
  for(const change of invalid){const copy=structuredClone(scene);change(copy);assert.throws(()=>importProject(JSON.stringify(copy)));}
  for(const control of objectEffectRegistry['pendulum-sway'].controls){
    for(const value of [control.min-.1,control.max+.1,NaN,Infinity]){
      const copy=structuredClone(scene);copy.effects[0].params[control.key]=value;assert.throws(()=>compileObjectScene(copy),control.key);
    }
  }
});

test('reversible hover glow: interrupt, reverse, focus, reduced motion and cleanup',()=>{
  const env=installEnvironment();
  try{
    const scene=fixture();
    scene.effects=scene.effects.filter(effect=>effect.id==='glow-1');
    scene.effects[0].trigger='hover';
    scene.effects[0].interaction={enterMs:300,leaveMs:200};
    const overlay=createObjectOverlay(env.object,compileObjectScene(scene),{objectId:'candle',ticker:env.ticker,interactive:true});
    env.intersections[0].trigger(true);
    assert.equal(env.ticker.activeCount,0,'idle hover has no ticker');
    assert.equal(overlay.inspect().interactions[0].progress,0);
    env.object.dispatch('pointerenter');
    assert.equal(env.ticker.activeCount,1);
    env.ticker.tick(.12);
    const middle=overlay.inspect().interactions[0].progress;
    assert.ok(middle>.35&&middle<.45);
    env.object.dispatch('pointerleave');
    env.ticker.tick(.05);
    const reversed=overlay.inspect().interactions[0].progress;
    assert.ok(reversed<middle&&reversed>0,'reversal starts at current intermediate position');
    env.object.dispatch('pointerenter');
    env.ticker.tick(.3);
    assert.equal(overlay.inspect().interactions[0].progress,1);
    env.object.dispatch('pointerleave');
    env.ticker.tick(.21);
    assert.equal(overlay.inspect().interactions[0].progress,0);
    assert.equal(env.ticker.activeCount,0,'hover completion releases shared ticker');
    env.object.dispatch('focusin');
    env.ticker.tick(.1);
    assert.ok(overlay.inspect().interactions[0].progress>0,'keyboard focus triggers glow');
    env.setReducedMotion(true);
    assert.equal(env.ticker.activeCount,0);
    assert.equal(overlay.inspect().interactions[0].progress,0);
    env.setReducedMotion(false);
    env.object.dispatch('focusout');
    assert.equal(env.ticker.activeCount,0);
    overlay.destroy();
    assert.equal(env.object.listenerCount('pointerenter'),0);
    assert.equal(env.object.listenerCount('focusin'),0);
  }finally{env.restore();}
});

test('click-selected glow produces one forward-and-back pulse without replacing the object action',()=>{
  const env=installEnvironment();
  try{
    const scene=fixture();
    scene.effects=scene.effects.filter(effect=>effect.id==='glow-1');
    scene.effects[0].trigger='click';
    const compiled=compileObjectScene(scene);
    const handle=bindObjectScene(compiled,()=>env.object,{ticker:env.ticker,interactive:true});
    env.intersections[0].trigger(true);
    assert.equal(env.ticker.activeCount,0);
    assert.equal(handle.triggerEffect('glow-1'),true);
    env.ticker.tick(.25);
    const overlay=[...handle.overlays.values()][0];
    assert.equal(overlay.inspect().interactions[0].progress,1);
    env.ticker.tick(.2);
    assert.equal(overlay.inspect().interactions[0].progress,0);
    assert.equal(env.ticker.activeCount,0);
    assert.equal(handle.triggerEffect('nonexistent'),false);
    handle.destroy();
  }finally{env.restore();}
});

test('hover can listen on a distinct focus button while drawing in a non-interactive photo host',()=>{
  const env=installEnvironment();
  try{
    const scene=fixture();
    scene.effects=scene.effects.filter(effect=>effect.id==='glow-1');
    scene.effects[0].trigger='hover';
    const original=env.object,button=fakeElement('focus-button');
    const overlay=createObjectOverlay(original,compileObjectScene(scene),{
      objectId:'candle',ticker:env.ticker,interactive:true,interactionTarget:button,
    });
    env.intersections[0].trigger(true);
    original.dispatch('pointerenter');
    assert.equal(env.ticker.activeCount,0,'visual host never drives hover itself');
    button.dispatch('pointerenter');
    env.ticker.tick(.09);
    assert.ok(overlay.inspect().interactions[0].progress>0);
    button.dispatch('pointerleave');
    env.ticker.tick(.25);
    assert.equal(overlay.inspect().interactions[0].progress,0);
    assert.equal(env.ticker.activeCount,0);
    assert.equal(button.listenerCount('pointerenter'),1);
    overlay.destroy();
    assert.equal(button.listenerCount('pointerenter'),0);
    assert.equal(button.listenerCount('click'),0);
  }finally{env.restore();}
});
