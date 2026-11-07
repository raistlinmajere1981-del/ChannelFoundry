import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {editorInput, persistentMotionInput, createEditorPreviewPlayer} from './vefk-motion-editor.ts';
import {timelineRows, reconcileDrawPlan, changeDrawPlan, balanceStrokeDurations,
  applyStrokeTempoCurve, setStrokeEasing} from './vefk-timeline-model.ts';
import {createVefkPlayer} from '../../../docs/contracts/vefk-site-consumer.mjs';
const require=createRequire(import.meta.url), core=require('../vefk-core/index.cjs'), store=require('../vefk-store.cjs');
const curves=['linear','ease-in','ease-out','ease-in-out'];
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
function sample() {
  return core.createVefk({id:'s4c1-frozen',title:'Kalıcı eğri testi',kind:'manualPaths',geometry:{
    coordinateSpace:'svg-viewBox',viewBox:[0,0,1000,1000],
    inkStyles:{grid:{width:7,cap:'round'},glyph:{width:8,cap:'round'}},paths:[
      {id:'grid.outer',ink:'grid',d:'M 0 0 L 100 100'},
      {id:'symbol.left',ink:'glyph',d:'M 100 100 L 200 200 M 300 200 L 400 200'},
      {id:'symbol.right',ink:'glyph',d:'M 200 100 L 300 200 Z'},
    ]}});
}
function edits(geometry,original,version) {
  let plan=original;
  for(const edit of [
    {kind:'duration',pathId:'symbol.left',valueMs:2345},
    {kind:'gap',pathId:'symbol.left',valueMs:525},
    {kind:'move',pathId:'symbol.right',delta:-1},
    {kind:'hold',valueMs:2310},
  ]) plan=changeDrawPlan(geometry,plan,edit,version);
  return plan;
}
const hold=p=>p.durationMs-p.strokes.at(-1).startMs-p.strokes.at(-1).durationMs;
const easingByPath=p=>Object.fromEntries(p.strokes.map(s=>[s.pathId,s.easing??'linear']));
function curved() {
  const doc=core.createVefk(persistentMotionInput(sample(),'new'));
  let plan=doc.drawPlan;
  doc.geometry.paths.forEach((path,i)=>{plan=setStrokeEasing(doc.geometry,plan,path.id,curves[i+1],2);});
  return core.createVefk({...editorInput(doc),drawPlan:plan});
}

test('S4c1 frozen pre-edit v1 bytes: rows, edits, balance, tempo, reconcile and save',()=>{
  // Digests captured from the original S4b model before this slice, not computed expectations.
  const doc=sample(),plan=edits(doc.geometry,doc.drawPlan,1);
  assert.equal(sha(timelineRows(doc.geometry,doc.drawPlan)), 'ba7a0b2b5900d33023ebd6f785b7546e0c4d3e078c115a2f2c4242cf8aa2ace6');
  assert.equal(sha(plan),'f60edcdd1bad2a184f6323499f1e38195c965fb6c70284956177c8f4f639651a');
  assert.equal(sha(balanceStrokeDurations(doc.geometry,plan)),'f862d32257caeb5f4195cb46d2d657c5cfbf9e03902df5928c020cfe967aa90a');
  for(const [curve,digest] of Object.entries({
    'slow-opening':'b4027a6a164dd4b675d023c456c54d33818920de36bad2e6fed2e0c0c970722d',
    'slow-ending':'4891bc03dfb53db6199c120c51b03b16ae034b1e924112fe48649d3b6e407a4d',
    ceremony:'b926c9e5e92cd5d8177437998bb76c531bbe2d73c8657f611aca51cc3b7a135b',
  })) assert.equal(sha(applyStrokeTempoCurve(doc.geometry,plan,curve)),digest);
  const geometry={...doc.geometry,paths:[...doc.geometry.paths.filter(p=>p.id!=='symbol.right'),
    {id:'symbol.new',ink:'glyph',d:'M 200 200 L 220 280'}]};
  assert.equal(sha(reconcileDrawPlan(geometry,plan)),'5725e44df452b06b60a8dd1487aad76f1fa18300e3f8fc669f8e3584a8dd3227');
  assert.equal(editorInput(doc).schemaVersion,1);
  assert.equal(core.createVefk(editorInput(doc)).contentHash,'f1fec1ea2c848b4a471cf5201a030459e8d03fa375c2da795a8ece45783d992f');
  assert.equal(sha(core.serializeVefk(core.createVefk(editorInput(doc)))),'166149125462c9db51fafbe215ff2f86580311169a85156b817031a673576f1a');
  assert.equal(JSON.stringify(plan).includes('easing'),false);
});

test('S4c1 v1 save hashes also remain exact for algorithmic and manual square inputs',()=>{
  for(const input of [{kind:'magicSquare',parameters:{order:3,first:4,step:2}},
    {kind:'manualSquare',grid:[[1,2,3],[4,5,6],[7,8,9]]}]) {
    const doc=core.createVefk({id:'s4c1-square',title:'Kare',...input});
    const before=core.serializeVefk(doc);
    assert.equal(core.serializeVefk(core.createVefk(editorInput(doc))),before);
    assert.equal(editorInput(doc).drawPlan,doc.drawPlan);
  }
});

test('S4c1 explicit opt-in preserves identity, timing, markers and source; rejects locked/already-v2',()=>{
  const old=sample(),before=core.serializeVefk(old);
  for(const status of ['new','draft']) {
    const input=persistentMotionInput(old,status),doc=core.createVefk(input);
    assert.equal(doc.schemaVersion,2);
    assert.equal(doc.id,old.id);assert.equal(doc.revision,old.revision);
    assert.deepEqual(doc.drawPlan.markers,old.drawPlan.markers);
    assert.deepEqual(doc.drawPlan.strokes.map(({easing,...s})=>s),old.drawPlan.strokes);
    assert.ok(doc.drawPlan.strokes.every(s=>s.easing==='linear'));
    assert.notEqual(doc.contentHash,old.contentHash);
    assert.deepEqual(core.createVefk(editorInput(doc)),doc);
  }
  for(const status of ['checked','approved','published']) assert.throws(()=>persistentMotionInput(old,status),/taslak|revizyon/);
  assert.throws(()=>persistentMotionInput(curved(),'draft'),/zaten v2/);
  assert.equal(core.serializeVefk(old),before);
});

test('S4c1 v2 per-path curves survive every timing edit, pacing and all tempo presets',()=>{
  const doc=curved(),before=core.serializeVefk(doc,2),expected=easingByPath(doc.drawPlan);
  const plan=edits(doc.geometry,doc.drawPlan,2);
  assert.deepEqual(easingByPath(plan),expected);
  assert.equal(plan.strokes.at(-1).durationMs,2345);
  assert.equal(hold(plan),2310);
  assert.equal(plan.strokes.at(-1).startMs-plan.strokes.at(-2).startMs-plan.strokes.at(-2).durationMs,525);
  assert.deepEqual(plan.markers,[{id:'outline',atMs:0},{id:'inscriptions',atMs:840},
    {id:'hold',atMs:4660}]);
  const gaps=p=>timelineRows(doc.geometry,p,2).map(r=>r.gapBeforeMs);
  for(const changed of [balanceStrokeDurations(doc.geometry,plan,180,2),
    ...['slow-opening','slow-ending','ceremony'].map(c=>applyStrokeTempoCurve(doc.geometry,plan,c,2))]) {
    assert.deepEqual(easingByPath(changed),expected);
    assert.deepEqual(gaps(changed),gaps(plan));assert.equal(hold(changed),hold(plan));
    assert.equal(core.validateVefk(core.createVefk({...editorInput(doc),drawPlan:changed})).ok,true);
  }
  assert.equal(core.serializeVefk(doc,2),before);
});

test('S4c1 v2 geometry reorder/add/remove/ink/coordinates retain curves by path with linear new paths',()=>{
  const doc=curved();
  assert.equal(reconcileDrawPlan(doc.geometry,doc.drawPlan,2),doc.drawPlan);
  const geometry={...doc.geometry,paths:[doc.geometry.paths[2],
    {...doc.geometry.paths[0],ink:'glyph',d:'M 0 0 L 80 50'},
    {id:'symbol.new',ink:'glyph',d:'M 200 200 L 220 280'}]};
  const plan=reconcileDrawPlan(geometry,doc.drawPlan,2);
  assert.deepEqual(easingByPath(plan),{'grid.outer':'ease-in','symbol.right':'ease-in-out','symbol.new':'linear'});
  assert.equal(plan.strokes[0].ink,'glyph');
  assert.equal(hold(plan),hold(doc.drawPlan));
  assert.equal(new Set(plan.strokes.map(s=>s.id)).size,3);
  assert.ok(core.validateVefk(core.createVefk({...editorInput(doc),geometry,drawPlan:plan})).ok);
  const reordered={...doc.geometry,paths:[...doc.geometry.paths].reverse()};
  assert.equal(reconcileDrawPlan(reordered,doc.drawPlan,2),doc.drawPlan,'geometry order is distinct from authored stroke order');
});

test('S4c1 v2 missing easing resolves linear without mutating source; setter preserves authored markers/gaps',()=>{
  const old=sample(),doc=core.createVefk({...editorInput(old),schemaVersion:2});
  const before=core.serializeVefk(doc,2);
  assert.ok(timelineRows(doc.geometry,doc.drawPlan,2).every(s=>s.easing==='linear'));
  assert.ok(doc.drawPlan.strokes.every(s=>!Object.hasOwn(s,'easing')));
  const plan=setStrokeEasing(doc.geometry,doc.drawPlan,'symbol.left','ease-out',2);
  assert.deepEqual(plan.markers,doc.drawPlan.markers);
  assert.equal(plan.durationMs,doc.drawPlan.durationMs);
  assert.deepEqual(plan.strokes.map(({easing,...s})=>s),doc.drawPlan.strokes);
  for(const curve of curves) {
    const updated=setStrokeEasing(doc.geometry,plan,'symbol.left',curve,2);
    assert.equal(updated.strokes[1].easing,curve);
  }
  assert.throws(()=>setStrokeEasing(doc.geometry,plan,'symbol.left','bounce',2),/Bilinmeyen/);
  assert.throws(()=>setStrokeEasing(doc.geometry,plan,'missing','linear',2),/bulunamadı/);
  assert.equal(core.serializeVefk(doc,2),before);
});

test('S4c1 v1 injection is rejected by editor model, canonical core and store; no silent stripping',()=>{
  const doc=sample(),db=new DatabaseSync(':memory:');
  try {
    store.saveDraft(db,{document:doc});
    for(const curve of curves) {
      assert.throws(()=>setStrokeEasing(doc.geometry,doc.drawPlan,'symbol.left',curve,1),/yalnız v2/);
      const injected=structuredClone(doc);injected.drawPlan.strokes[0].easing=curve;
      injected.contentHash=core.documentHash(injected);
      assert.throws(()=>editorInput(injected),/yalnız v2/);
      assert.throws(()=>reconcileDrawPlan(doc.geometry,injected.drawPlan,1),/yalnız v2/);
      assert.throws(()=>core.createVefk({...editorInput(doc),drawPlan:injected.drawPlan}),/easing/);
      assert.throws(()=>store.saveDraft(db,{document:injected,expectedContentHash:doc.contentHash}),/easing/);
    }
    assert.deepEqual(store.getDocument(db,doc.id).document,doc);
  } finally {db.close();}
});

test('S4c1 v2 curves survive draft edit, SQLite reload, review, immutable approval and explicit revision',()=>{
  const doc=curved(),db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  try {
    store.saveDraft(db,{document:doc});
    const plan=edits(doc.geometry,doc.drawPlan,2);
    const edited=core.createVefk({...editorInput(doc),drawPlan:plan});
    store.saveDraft(db,{document:edited,expectedContentHash:doc.contentHash});
    for(const status of ['checked','approved']) {
      const row=store.setReviewState(db,{id:doc.id,revision:1,status,expectedContentHash:edited.contentHash});
      assert.equal(row.document.schemaVersion,2);assert.deepEqual(row.document.drawPlan,plan);
    }
    const loaded=store.getDocument(db,doc.id);
    assert.deepEqual(loaded.document,edited);assert.ok(Object.isFrozen(loaded.document.drawPlan));
    const changed=core.createVefk({...editorInput(loaded.document),drawPlan:setStrokeEasing(doc.geometry,plan,'symbol.left','linear',2)});
    assert.throws(()=>store.saveDraft(db,{document:changed,expectedContentHash:edited.contentHash}),/değiştirilemez/);
    const next=core.createVefk({...editorInput(loaded.document),revision:2});
    store.saveDraft(db,{document:next});
    assert.equal(store.getDocument(db,doc.id).document.schemaVersion,2);
    assert.deepEqual(store.getDocument(db,doc.id,1).document,edited);
  } finally {db.close();}
});

test('S4c1 approved v1 requires a new revision before explicit opt-in; original stays frozen',()=>{
  const doc=sample(),db=new DatabaseSync(':memory:');
  try {
    store.saveDraft(db,{document:doc});
    for(const status of ['checked','approved']) store.setReviewState(db,{id:doc.id,revision:1,status,expectedContentHash:doc.contentHash});
    assert.throws(()=>persistentMotionInput(doc,'approved'),/revizyon/);
    const revision=core.createVefk({...editorInput(doc),revision:2});
    assert.equal(revision.schemaVersion,1);
    const v2=core.createVefk(persistentMotionInput(revision,'new'));
    store.saveDraft(db,{document:v2});
    assert.equal(v2.revision,2);assert.equal(v2.schemaVersion,2);
    assert.deepEqual(store.getDocument(db,doc.id,1).document,doc);
  } finally {db.close();}
});

test('S4c1 v2 preview always equals canonical including seek/gaps/pen-up/hold, ignoring all lab state',()=>{
  const doc=curved(),base=createVefkPlayer(doc);
  const times=new Set([0,base.durationMs,-10,base.durationMs+10]);
  for(const marker of doc.drawPlan.markers)times.add(marker.atMs);
  for(let i=0;i<=300;i++)times.add(base.durationMs*i/300);
  for(const curve of curves) {
    const preview=createEditorPreviewPlayer(doc,curve);
    for(const t of times)assert.deepEqual(preview.frameAt(t),base.frameAt(t));
    const frame=preview.frameAt(1250);preview.frameAt(base.durationMs);preview.frameAt(0);
    assert.deepEqual(preview.frameAt(1250),frame);
  }
  const old=sample(),before=core.serializeVefk(old),t=old.drawPlan.strokes[0].durationMs/2;
  assert.notDeepEqual(createEditorPreviewPlayer(old,'ease-in').frameAt(t),createVefkPlayer(old).frameAt(t));
  assert.equal(core.serializeVefk(old),before,'v1 experiment is never persisted');
});

test('S4c1 Workshop wires explicit opt-in through validation/history and versioned save, with locked native controls',()=>{
  const read=n=>fs.readFileSync(new URL(n,import.meta.url),'utf8');
  const workshop=read('VefkWorkshop.tsx'),dock=read('VefkTimelineEditor.tsx');
  assert.match(workshop,/!canEdit \|\| working.schemaVersion !== 1/);
  assert.match(workshop,/await bridge.vefkGenerate\(persistentMotionInput\(working, status\)\);\s+apply\(next\)/);
  assert.match(workshop,/const input = editorInput\(working\)/);
  assert.match(workshop,/vefkGenerate\(input\)/);
  assert.match(workshop,/setHistory\(stack => \[\.\.\.stack.slice\(-39\), working\]\)/);
  assert.match(workshop,/setWorking\(history\[history.length - 1\]\)/);
  assert.match(workshop,/setWorking\(future\[future.length - 1\]\)/);
  assert.match(dock,/document.schemaVersion === 1 \? <div/);
  assert.match(dock,/disabled=\{disabled\} onClick=\{onEnablePersistentMotion\}/);
  assert.match(dock,/document.schemaVersion === 2 && <label>Kalıcı çizgi içi eğri/);
  assert.match(dock,/value=\{row.easing \?\? "linear"\} disabled=\{disabled\}/);
  assert.doesNotMatch(dock,/site henüz doğrusal/);
});
