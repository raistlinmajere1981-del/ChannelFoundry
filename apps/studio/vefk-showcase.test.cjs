"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const core=require("./vefk-core/index.cjs");
const {showcaseDocument,ID}=require("./seed-vefk-showcase.cjs");
test("observatory showcase is a deterministic, verifiable, original V2 example",()=>{
  const doc=showcaseDocument(),again=showcaseDocument();
  assert.equal(doc.id,ID);
  assert.equal(doc.schemaVersion,2);
  assert.equal(doc.provenance.kind,"manual");
  assert.deepEqual(doc.provenance.references,[]);
  assert.equal(doc.construction.kind,"manualPaths");
  assert.equal(doc.construction.checks.passed,true);

  assert.equal(doc.geometry.paths.length,109);
  assert.equal(doc.drawPlan.strokes.length,109);
  assert.deepEqual(doc.drawPlan.markers.map(x=>x.id),
    ["outline","grid","arabic-letters","seals","finish","hold"]);
  assert.deepEqual(new Set(doc.drawPlan.strokes.map(x=>x.easing)),
    new Set(["linear","ease-in-out","ease-out"]));
  assert.equal(core.validateVefk(doc).ok,true);
  assert.equal(core.serializeVefk(doc,2),core.serializeVefk(again,2));
  assert.equal(doc.geometry.paths.filter(x=>x.id.startsWith("cell.")).length,46);
  assert.equal(doc.geometry.paths.some(x=>x.id==="seal.north.eye"),true);
  assert.equal(doc.geometry.paths.some(x=>x.id==="seal.south.star"),true);
  assert.equal(doc.drawPlan.durationMs>60000&&doc.drawPlan.durationMs<90000,true);
  assert.equal(Buffer.byteLength(core.serializeVefk(doc,2))<2*1024*1024,true);
});
test("canonical and site players agree at every visual chapter and pen phase",async()=>{
  const doc=showcaseDocument();
  const canonical=await import("../../docs/contracts/vefk-site-consumer.mjs");
  const site=await import("../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs");
  const a=canonical.createVefkPlayer(doc),b=site.createVefkPlayer(doc);
  const samples=[
    0,1200,4000,
    ...doc.drawPlan.markers.map(m=>m.atMs),
    ...doc.drawPlan.strokes.filter((_,i)=>i%12===0).map(s=>s.startMs+s.durationMs/2),
    doc.drawPlan.durationMs
  ];
  for(const at of samples){
    assert.deepEqual(a.frameAt(at),b.frameAt(at),"Studio/site playback drift at "+at+"ms");
  }
  const before=a.frameAt(0),after=a.frameAt(doc.drawPlan.durationMs);
  assert.equal(before.complete,false);
  assert.ok(before.visibility.every(x=>x.fraction===0));
  assert.equal(after.complete,true);
  assert.ok(after.visibility.every(x=>x.fraction===1));
  assert.equal(after.pen.penDown,false);
});
test('Arabic cells preserve RTL order, independent dot strokes and phase boundaries',()=>{
  const doc=showcaseDocument();
  const letters=['ا ب ج د ه','و ز ح ط ي','ك ل م ن س','ع ف ص ق ر','ش ت ث خ ذ'];
  assert.equal(doc.accessibility.matrixText,letters.join(' / '));
  for(let r=0;r<5;r++) for(let c=0;c<5;c++){
    const paths=doc.geometry.paths.filter(p=>p.id.startsWith(`cell.r${r}c${c}.`));
    assert.ok(paths.length>=1);
    assert.ok(paths.every(p=>p.semanticValue===letters[r].split(' ')[c]));
    assert.ok(paths.every(p=>(p.d.match(/M /g)||[]).length===1));
  }
  assert.equal(doc.geometry.paths.filter(p=>p.id.startsWith('cell.r4c2.')).length,4);
  const phases=doc.drawPlan.markers;
  assert.ok(phases.every((m,i)=>!i||m.atMs>phases[i-1].atMs));
  assert.match(doc.provenance.notes,/tarihî belge/);
  assert.match(doc.title,/Arapça Harf/);
});
