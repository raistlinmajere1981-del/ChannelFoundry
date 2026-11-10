import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import core from './vefk-core/index.cjs';
import s6Fixtures from './vefk-s6-fixtures.cjs';
import phpRunner from './vefk-s6-php-runner.cjs';
import * as canonical from '../../docs/contracts/vefk-site-consumer.mjs';
import * as site from '../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs';
import {warpStrokeFraction, createIntraStrokePreviewPlayer} from './src/vefk-intrastroke-preview.ts';

const curves = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];
const squareInput = {id:'s4a-frozen-3x3',title:'S4a frozen square',parameters:{order:3}};
const manualInput = {id:'s4a-frozen-manual',title:'S4a frozen manual',kind:'manualPaths',
  geometry:{coordinateSpace:'svg-viewBox',viewBox:[0,0,1000,1000],
    inkStyles:{glyph:{width:5,cap:'round'}},paths:[
      {id:'mark.multi',ink:'glyph',d:'M 100 100 L 200 100 M 400 100 L 500 100'},
      {id:'mark.closed',ink:'glyph',d:'M 700 200 L 800 200 L 800 300 Z M 900 400 L 950 400'},
    ]}};
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function times(doc) {
  return [-100,0,1,...Array.from({length:401},(_,i)=>doc.drawPlan.durationMs*i/400),
    ...doc.drawPlan.strokes.flatMap(s=>[s.startMs,s.startMs+1,
      s.startMs+s.durationMs*.45,s.startMs+s.durationMs*.55,
      s.startMs+s.durationMs-1,s.startMs+s.durationMs,s.startMs+s.durationMs+140/3]),
    doc.drawPlan.durationMs+100];
}
function optIn(input, easings) {
  const plan = structuredClone(core.createVefk(input).drawPlan);
  for (const [i, stroke] of plan.strokes.entries()) {
    const easing = Array.isArray(easings) ? easings[i % easings.length] : easings;
    if (easing !== undefined) stroke.easing = easing;
  }
  return core.createVefk({...input,schemaVersion:2,drawPlan:plan});
}
function nearFrame(actual, expected) {
  assert.deepEqual(actual.visibility.map(x=>x.pathId),expected.visibility.map(x=>x.pathId));
  for (let i=0;i<actual.visibility.length;i++) {
    assert.ok(Math.abs(actual.visibility[i].fraction-expected.visibility[i].fraction)<1e-10);
  }
  for (const key of ['x','y']) assert.ok(Math.abs(actual.pen.position[key]-expected.pen.position[key])<1e-9);
  assert.ok(Math.abs(actual.pen.fraction-expected.pen.fraction)<1e-10);
  for (const key of ['phase','penDown','pathId']) assert.equal(actual.pen[key],expected.pen[key]);
  for (const key of ['timeMs','durationMs','complete']) assert.equal(actual[key],expected[key]);
}

// Captured from the unchanged v1 implementation BEFORE S4a. These digests cover
// exact JSON bytes and every frame field, including non-integer travel positions.
for (const [input,contentHash,serializedHash,framesHash] of [
  [squareInput,'41ffe2ba930d4e25c48bee0cfebd9297a0a233ec3b84a77af0640b34402e7d4a',
    'f29c76d1daac2ab300622cea215ec874b196adfa06aeed49c04156495cbd1787',
    'ee66d9b24c8943eb554a92e14688e4d0dd2b3d2967e1d657b19bf1337d764c12'],
  [manualInput,'07610c4f45472f78da46ba129d4729a0f3f2b8500c1e8e719ac298cc79e12f39',
    '153e5b7d9902458e33655997a924f54df823bb81794b06863c23a588f82437ca',
    '44e194eef265531a335014ef57d3433901b148a4caa2eae8350cfbf8ccaadd9b'],
]) {
  test(`S4a frozen v1 bytes, SHA and exact frames: ${input.id}`,()=>{
    const doc=core.createVefk(input);
    assert.equal(doc.contentHash,contentHash);
    assert.equal(sha(core.serializeVefk(doc)),serializedHash);
    for (const consumer of [canonical,site]) {
      const player=consumer.createVefkPlayer(doc);
      assert.equal(sha(JSON.stringify(times(doc).map(t=>player.frameAt(t)))),framesHash);
    }
  });
}

test('S4a v1 mathematical mid-travel coordinates stay exact',()=>{
  const player=canonical.createVefkPlayer(core.createVefk(manualInput));
  assert.deepEqual(player.frameAt(950*.45).pen.position,{x:256.6666666666667,y:100});
  assert.deepEqual(player.frameAt(950+140/3).pen.position,{x:566.6666666666666,y:133.33333333333331});
});

test('S4a v2 linear and omitted easing equal v1 at every sampled frame, on both consumers',()=>{
  for (const input of [squareInput,manualInput]) {
    const v1=core.createVefk(input), base=canonical.createVefkPlayer(v1);
    for (const curve of ['linear',undefined]) {
      const v2=optIn(input,curve);
      assert.equal(core.validateVefk(v2).ok,true);
      assert.deepEqual(v2.drawPlan.markers,v1.drawPlan.markers);
      assert.equal(v2.drawPlan.durationMs,v1.drawPlan.durationMs);
      for (const consumer of [canonical,site]) {
        const player=consumer.createVefkPlayer(v2);
        for (const t of times(v1)) assert.deepEqual(player.frameAt(t),base.frameAt(t));
      }
    }
  }
});

test('S4a curve math matches Studio exactly, is finite/monotone and fixes 0 and 1',()=>{
  for (const curve of curves) {
    let prev=-1;
    for(let i=0;i<=1000;i++) {
      const value=core.easedProgress(i/1000,curve);
      assert.equal(value,warpStrokeFraction(i/1000,curve));
      assert.ok(Number.isFinite(value)&&value>=prev&&value<=1);
      prev=value;
    }
    assert.equal(core.easedProgress(0,curve),0);
    assert.equal(core.easedProgress(1,curve),1);
  }
  assert.equal(core.easedProgress(.5,'ease-in'),.25);
  assert.equal(core.easedProgress(.5,'ease-out'),.75);
  assert.equal(core.easedProgress(.5,'ease-in-out'),.5);
  assert.equal(core.easedProgress(.25,'ease-in-out'),.15625);
});

test('S4a all v2 curves match experimental Studio ink/nib/phase on fresh 3x3 and multi-M/Z',()=>{
  for (const input of [squareInput,manualInput]) {
    const v1=core.createVefk(input);
    for (const curve of curves) {
      const v2=optIn(input,curve), preview=createIntraStrokePreviewPlayer(v1,curve);
      for (const consumer of [canonical,site]) {
        const player=consumer.createVefkPlayer(v2);
        for (const t of times(v1)) nearFrame(player.frameAt(t),preview.frameAt(t));
      }
    }
  }
});

test('S4a each stroke owns one easing; its ink and nib use one shared progress',()=>{
  const v1=core.createVefk(squareInput),v2=optIn(squareInput,curves);
  const base=canonical.createVefkPlayer(v1),player=canonical.createVefkPlayer(v2);
  let differences=0;
  for (const [i,stroke] of v2.drawPlan.strokes.entries()) {
    for (const u of [.25,.5,.75]) {
      const real=stroke.startMs+u*stroke.durationMs;
      const warped=stroke.startMs+core.easedProgress(u,curves[i%curves.length])*stroke.durationMs;
      nearFrame(player.frameAt(real),{...base.frameAt(warped),timeMs:real});
      if (JSON.stringify(player.frameAt(real).pen)!==JSON.stringify(base.frameAt(real).pen)) differences++;
    }
  }
  assert.ok(differences>0);
});

test('S4a multi-M and Z→M travel deposits no ink for any easing',()=>{
  for (const curve of curves) {
    const doc=optIn(manualInput,curve),player=canonical.createVefkPlayer(doc);
    for (const [index,stroke] of doc.drawPlan.strokes.entries()) {
      let travelCount=0,previous=null;
      for(let i=0;i<2000;i++) {
        const frame=player.frameAt(stroke.startMs+stroke.durationMs*i/2000);
        assert.equal(frame.pen.fraction,frame.visibility[index].fraction);
        if (frame.pen.phase==='travel') {
          travelCount++;
          assert.equal(frame.pen.penDown,false);
          if (previous?.pen.phase==='travel') {
            assert.equal(frame.visibility[index].fraction,previous.visibility[index].fraction);
          }
        }
        previous=frame;
      }
      assert.ok(travelCount>5,`${curve}, stroke ${index} must preserve travel`);
    }
  }
});

test('S4a start/end, initial ready, gaps, markers and hold remain exact; seek/pause/reduced model is stable',()=>{
  const original=core.createVefk(manualInput),plan=structuredClone(original.drawPlan);
  for (const stroke of plan.strokes) stroke.startMs+=50;
  for (const marker of plan.markers) marker.atMs+=50;
  plan.durationMs+=50;
  const v1=core.createVefk({...manualInput,drawPlan:plan});
  for(const curve of curves) {
    for(const stroke of plan.strokes) stroke.easing=curve;
    const v2=core.createVefk({...manualInput,schemaVersion:2,drawPlan:plan});
    const before=core.serializeVefk(v2,2),base=canonical.createVefkPlayer(v1);
    const player=canonical.createVefkPlayer(v2);
    for(const [i,stroke] of v2.drawPlan.strokes.entries()) {
      assert.deepEqual(player.frameAt(stroke.startMs),base.frameAt(stroke.startMs));
      const end=stroke.startMs+stroke.durationMs;
      assert.deepEqual(player.frameAt(end),base.frameAt(end));
      assert.equal(player.frameAt(end).visibility[i].fraction,1);
      assert.deepEqual(player.frameAt(end+140/3),base.frameAt(end+140/3));
    }
    assert.deepEqual(player.frameAt(0),base.frameAt(0));
    assert.equal(player.frameAt(0).pen.phase,'ready');
    for(const marker of v2.drawPlan.markers) assert.deepEqual(player.frameAt(marker.atMs),base.frameAt(marker.atMs));
    const reduced=player.frameAt(player.durationMs);
    assert.deepEqual(reduced,base.frameAt(player.durationMs));
    assert.ok(reduced.visibility.every(x=>x.fraction===1));
    const at=437.125,paused=player.frameAt(at);
    for(const t of [player.durationMs,0,1800,at,at,70,player.durationMs+100,-100]) player.frameAt(t);
    assert.deepEqual(player.frameAt(at),paused);
    assert.deepEqual(player.frameAt(player.durationMs),reduced);
    assert.equal(core.serializeVefk(v2,2),before);
  }
});

test('S4a direct players strictly reject malformed easing, v1 injection, unknown fields and versions',()=>{
  for (const consumer of [canonical,site]) {
    for (const easing of ['bogus','Linear',' linear','',null,undefined,0,false,['linear'],{}]) {
      const doc=structuredClone(optIn(manualInput,'linear'));
      doc.drawPlan.strokes[0].easing=easing;
      doc.contentHash=core.documentHash(doc);
      assert.throws(()=>consumer.createVefkPlayer(doc),/easing/);
    }
    for (const mutate of [
      d=>{d.schemaVersion=1;},d=>{d.schemaVersion=3;},d=>{d.schemaVersion='2';},
      d=>{d.easing='linear';},d=>{d.drawPlan.easing='linear';},
      d=>{d.drawPlan.strokes[0].curve='linear';},d=>{d.drawPlan.markers[0].easing='linear';},
      d=>{d.geometry.paths[0].easing='linear';},d=>{d.geometry.inkStyles.glyph.easing='linear';},
    ]) {
      const doc=structuredClone(optIn(manualInput,'linear'));
      mutate(doc);doc.contentHash=core.documentHash(doc);
      assert.throws(()=>consumer.createVefkPlayer(doc));
    }
    const doc=optIn(manualInput,curves),player=consumer.createVefkPlayer(doc);
    for(const time of [NaN,Infinity,-Infinity,'350',null]) assert.throws(()=>player.frameAt(time));
  }
});

test('S4a reference/site consumers remain byte-identical',()=>{
  assert.deepEqual(fs.readFileSync(new URL('../../docs/contracts/vefk-site-consumer.mjs',import.meta.url)),
    fs.readFileSync(new URL('../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs',import.meta.url)));
});

test('S4b PHP handler rejects doc2 catalog1 and catalog2 with legacy binding2, with zero writes',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vefk-s4a-php-'));
  const storage=path.join(root,'storage'),content=path.join(storage,'content');
  const assets=path.join(content,'assets');
  const shipped=path.join(root,'site/api/studio');
  const env={...process.env,CHANNEL_FOUNDRY_COMMUNITY_DB:path.join(storage,'community.sqlite'),
    CHANNEL_FOUNDRY_PUBLICATION_CONTENT_DIR:content,CHANNEL_FOUNDRY_PUBLICATION_ASSET_DIR:assets};
  function php(args,input) {
    const result=phpRunner.runPhp(args,{env,input,encoding:'utf8',timeout:10000});
    assert.ifError(result.error);
    assert.equal(result.status,0,result.stderr);
    assert.equal(result.stderr,'');
    return result.stdout;
  }
  function snapshot() {
    return fs.readdirSync(storage,{recursive:true,withFileTypes:true}).filter(x=>x.isFile())
      .map(x=>{const name=path.join(x.parentPath,x.name);return [name,sha(fs.readFileSync(name))];});
  }
  try {
    fs.cpSync(new URL('../../channels/birdesengor/web/public/api/studio',import.meta.url),shipped,{recursive:true});
    fs.cpSync(new URL('../../channels/birdesengor/web/public/api/analytics',import.meta.url),path.join(shipped,'../analytics'),{recursive:true});
    fs.mkdirSync(assets,{recursive:true});
    fs.writeFileSync(path.join(content,'publication.json'),'{"previous":"publication"}\n');
    fs.writeFileSync(path.join(content,'community-credits.json'),'{"previous":"credits"}\n');
    fs.writeFileSync(path.join(assets,'kept.png'),'synthetic asset bytes');
    php(['-r',`
      $db=new PDO('sqlite:'.getenv('CHANNEL_FOUNDRY_COMMUNITY_DB'));
      $db->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, display_name TEXT, password_hash TEXT, role TEXT, status TEXT)');
      $q=$db->prepare('INSERT INTO users VALUES (1, ?, ?, ?, ?, ?)');
      $q->execute(['admin','admin',password_hash('s4a-test-password',PASSWORD_DEFAULT),'admin','active']);
    `],'');
    for(const version of [1,2]) {
      const raw=s6Fixtures.fixture();
      raw.vefkCatalog.entries[0].document=structuredClone(core.createVefk({...squareInput,schemaVersion:2}));
      raw.vefkCatalog.schemaVersion=version;
      s6Fixtures.rehash(raw);
      // Reach the Vefk gate through today's bilingual publication envelope.
      Object.assign(raw, {languageVersion:1, languages:['tr','en'], vefkLanguages:{}});
      raw.archive.entities.forEach(entity => { entity.locales = {}; });
      const {publication, ...meaning} = raw;
      publication.contentFingerprint = sha(core.canonicalString(meaning));
      const before=snapshot(),body=JSON.stringify({publication:raw});
      const resultFile=path.join(root,'response.json');
      const output=php([fileURLToPath(new URL('./vefk-s6-endpoint-harness.php',import.meta.url))],JSON.stringify({
        body,server:{REQUEST_METHOD:'POST',CONTENT_LENGTH:String(Buffer.byteLength(body)),
          HTTP_AUTHORIZATION:'Basic '+Buffer.from('admin:s4a-test-password').toString('base64')},
        query:{action:'publish'},handler:path.join(shipped,'index.php'),resultFile,
      }));
      const response=JSON.parse(output),status=JSON.parse(fs.readFileSync(resultFile,'utf8'));
      assert.equal(status.status,422,output);
      assert.equal(response.error,'invalid_vefk_publication',output);
      assert.deepEqual(snapshot(),before,'PHP rejection must preserve all temporary storage bytes');
    }
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
