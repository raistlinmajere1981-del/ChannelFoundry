"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto"),path=require("node:path");
const {runPhp}=require("./vefk-s6-php-runner.cjs");
const core=require("./vefk-core/index.cjs");
const pub=require("./vefk-publication.cjs");
const gate=path.resolve(__dirname,"../../docs/contracts/vefk-s6-php-gate.php");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const php=`
require getenv('BDG_S6_GATE_FILE');
try {
  $typed=json_decode(stream_get_contents(STDIN),false,512,JSON_THROW_ON_ERROR);
  vefk_s6_validate_publication($typed);
  echo json_encode(['ok'=>true]);
} catch (Throwable $error) {
  echo json_encode(['ok'=>false,'error'=>$error->getMessage()]);
}
`;
function check(raw){
  const result=runPhp(["-r",php],{
    input:JSON.stringify(raw),encoding:"utf8",timeout:9000,
    env:{...process.env,BDG_S6_GATE_FILE:gate},
  });
  if(result.error||result.status!==0)throw new Error(String(result.stderr||result.error?.message||result.status));
  return JSON.parse(result.stdout);
}
function fixture(){
  const doc=structuredClone(core.createVefk({id:"s6-unit-new-3x3",title:"Yeni Vefk · تعويذة",
    kind:"magicSquare",parameters:{order:3}}));
  const fileHash=sha(core.serializeVefk(doc));
  const entry={id:doc.id,revision:doc.revision,order:0,title:doc.title,
    contentHash:doc.contentHash,url:`vefk/documents/${doc.id}-r${doc.revision}-${fileHash.slice(0,16)}.json`,
    sha256:fileHash,document:doc};
  const logical={format:"birdesengor.vefk-catalog",schemaVersion:1,binding:structuredClone(pub.BINDING),entries:[entry]};
  const publication={
    schemaVersion:2,
    publication:{id:"pub-"+("a".repeat(24)),generatedAt:"2026-11-04T09:00:00.000Z",contentFingerprint:""},
    journal:{sections:[]},
    archive:{entities:[{entityId:"test-entity",kind:"person",name:"Ebru",visual:{}}],relations:[]},
    assets:[],youtubeAnalysis:{},support:{sponsors:[],contributors:[]},
    vefkCatalog:{...logical,fingerprint:sha(core.canonicalString(logical))},
  };
  rehashTop(publication);
  return publication;
}
function rehashTop(raw){
  const snapshot={schemaVersion:2,journal:raw.journal,archive:raw.archive,
    assets:raw.assets,youtubeAnalysis:raw.youtubeAnalysis,support:raw.support,
    ...(raw.vefkCatalog!=null?{vefkCatalog:raw.vefkCatalog}:{})};
  raw.publication.contentFingerprint=sha(core.canonicalString(snapshot));
}
function rehashEverything(raw){
  const c=raw.vefkCatalog,e=c.entries[0],d=e.document;
  d.contentHash=core.documentHash(d);
  e.id=d.id;e.revision=d.revision;
  e.contentHash=d.contentHash;e.title=d.title;
  e.sha256=sha(JSON.stringify(core.canonical(d),null,2)+String.fromCharCode(10));
  e.url=`vefk/documents/${d.id}-r${d.revision}-${e.sha256.slice(0,16)}.json`;
  const {fingerprint,...logical}=c;
  c.fingerprint=sha(core.canonicalString(logical));
  rehashTop(raw);
}
test("S6 typed PHP gate accepts a brand-new 3x3 publication including empty JSON objects",()=>{
  const document=fixture();
  const result=check(document);
  assert.deepEqual(result,{ok:true},JSON.stringify(result));
});
test("S6 gate leaves publications without vefkCatalog untouched",()=>{
  const document=fixture();delete document.vefkCatalog;rehashTop(document);
  assert.equal(check(document).ok,true);
});
test("S6 gate accepts valid revised titles only when all hash levels are recomputed",()=>{
  const doc=fixture();doc.vefkCatalog.entries[0].document.title="Yeni test · خط";rehashEverything(doc);
  assert.equal(check(doc).ok,true);
});
for(const [name,mutate] of [
  ["unsafe SVG despite fully consistent fingerprints",d=>{d.geometry.paths[0].d="M 0 0 L 3 4 onclick=bad";}],
  ["SVG command in x coordinate despite fully consistent fingerprints",d=>{d.geometry.paths[0].d="M L 0 L 1 1";}],
  ["SVG command in y coordinate despite fully consistent fingerprints",d=>{d.geometry.paths[0].d="M 0 Z L 1 1";}],
  ["out-of-bounds SVG despite fully consistent fingerprints",d=>{d.geometry.paths[0].d="M 0 0 L 5000 8000";}],
  ["overlapping strokes despite fully consistent fingerprints",d=>{d.drawPlan.strokes[1].startMs=0;}],
  ["forged stroke pen mode despite fully consistent fingerprints",d=>{d.drawPlan.strokes[0].pen="up";}],
  ["unknown intra-stroke easing field despite fully consistent fingerprints",d=>{d.drawPlan.strokes[0].easing="ease-in";}],
  ["undefined ink style despite fully consistent fingerprints",d=>{d.geometry.paths[0].ink="foreign";d.drawPlan.strokes[0].ink="foreign";}],
]){
  test("S6 rejects "+name,()=>{
    const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
    mutate(doc);rehashEverything(raw);
    assert.equal(check(raw).ok,false,name);
  });
}
test("S6 rejects a correctly rehashed but invalid scene binding",()=>{
  const raw=fixture();raw.vefkCatalog.binding.pen.anchorId="fabricated.anchor";
  const {fingerprint,...logical}=raw.vefkCatalog;
  raw.vefkCatalog.fingerprint=sha(core.canonicalString(logical));rehashTop(raw);
  assert.equal(check(raw).ok,false);
});

test("S6 accepts the optional generatedAt metadata without counting it in contentHash",()=>{
  const raw=fixture();
  raw.vefkCatalog.entries[0].document.generatedAt="2026-11-04T11:15:00.000Z";
  rehashEverything(raw);
  const result=check(raw);
  assert.equal(result.ok,true,JSON.stringify(result));
});
test("S6 rejects repeated stroke IDs even if their path IDs differ",()=>{
  const raw=fixture(),plan=raw.vefkCatalog.entries[0].document.drawPlan;
  plan.strokes[1].id=plan.strokes[0].id;
  rehashEverything(raw);assert.equal(check(raw).ok,false);
});
test("S6 rejects repeated marker IDs with all hash levels recomputed",()=>{
  const raw=fixture(),plan=raw.vefkCatalog.entries[0].document.drawPlan;
  plan.markers[1].id=plan.markers[0].id;
  rehashEverything(raw);assert.equal(check(raw).ok,false);
});
test("S6 rejects nonstring titles despite consistent recomputed hashes",()=>{
  const raw=fixture();raw.vefkCatalog.entries[0].document.title=["false","title"];
  rehashEverything(raw);assert.equal(check(raw).ok,false);
});
test("S6 rejects numeric-string ink widths despite consistent recomputed hashes",()=>{
  const raw=fixture();raw.vefkCatalog.entries[0].document.geometry.inkStyles.glyph.width="11";
  rehashEverything(raw);assert.equal(check(raw).ok,false);
});

test("S6 rejects a magic-square grid with one falsified cell even after full rehash",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.construction.grid[0][0]=42;
  doc.geometry.paths.find(p=>p.id==="cell.r0c0").semanticValue="42";
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,false);
});
test("S6 rejects a coherent forged check report on an invalid magic square",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  const temp=doc.construction.grid[0][0];
  doc.construction.grid[0][0]=doc.construction.grid[0][1];
  doc.construction.grid[0][1]=temp;
  doc.geometry.paths.find(p=>p.id==="cell.r0c0").semanticValue=String(doc.construction.grid[0][0]);
  doc.geometry.paths.find(p=>p.id==="cell.r0c1").semanticValue=String(doc.construction.grid[0][1]);
  doc.construction.checks.passed=true;
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,false);
});
test("S6 rejects a forged construction algorithm even when all hashes match",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.construction.algorithmId="invented";
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,false);
});
test("S6 rejects unnormalized SVG path text despite a valid path grammar and hashes",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  const first=doc.geometry.paths[0];
  first.d="  "+first.d+"  ";
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,false);
});
test("S6 rejects semantic digit mismatch even with untouched grid numbers",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.geometry.paths.find(p=>p.id==="cell.r0c0").semanticValue="not-a-number";
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,false);
});
test("S6 rejects unknown extra fields inside ink style when all hashes match",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.geometry.inkStyles.grid.opacity=0.3;
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,false);
});
test("S6 accepts a custom accessibility matrix when all hashes match S1",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.accessibility.matrixText="Kullanıcı tarafından düzenlenen erişilebilir açıklama";
  rehashEverything(raw);
  assert.doesNotThrow(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,true);
});

for(const [name,params] of [
  ["standard 5x5",{order:5}],
  ["negative sequence 3x3",{order:3,first:-17,step:2}],
  ["decreasing sequence 5x5",{order:5,first:90,step:-3}],
  ["non-unit step 7x7",{order:7,first:-12,step:4}],
]){
  test("S6 accepts independent S1 "+name+" construction",()=>{
    const raw=fixture(),entry=raw.vefkCatalog.entries[0];
    entry.document=structuredClone(core.createVefk({
      id:"s6-valid-"+name.replace(/[^a-z0-9]/gi,"-"),
      title:"Bağımsız kare "+name,kind:"magicSquare",parameters:params,
    }));
    rehashEverything(raw);
    assert.doesNotThrow(()=>core.validateVefk(entry.document));
    const result=check(raw);
    assert.equal(result.ok,true,JSON.stringify(result));
  });
}
test("S6 accepts an S1 manualSquare with a deliberately non-magic grid",()=>{
  const raw=fixture(),entry=raw.vefkCatalog.entries[0];
  entry.document=structuredClone(core.createVefk({
    id:"s6-valid-manual-square",title:"El ile kare",kind:"manualSquare",
    grid:[[12,7,11],[4,3,9],[8,2,6]],
  }));
  rehashEverything(raw);
  assert.doesNotThrow(()=>core.validateVefk(entry.document));
  assert.equal(check(raw).ok,true);
});
test("S6 accepts a manualPaths calligraphy sample with multiple pen-up segments",()=>{
  const raw=fixture(),entry=raw.vefkCatalog.entries[0];
  entry.document=structuredClone(core.createVefk({
    id:"s6-valid-manual-paths",title:"Kaligrafi",kind:"manualPaths",
    geometry:{
      coordinateSpace:"svg-viewBox",viewBox:[0,0,1400,880],
      inkStyles:{script:{width:3.5,cap:"round"}},
      paths:[
        {id:"letter.01",ink:"script",d:"M 20 25 L 300 45 M 320 60 L 430 75"},
        {id:"seal.01",ink:"script",d:"M 720 90 L 820 90 L 820 250 L 720 250 Z"},
      ],
    },
  }));
  rehashEverything(raw);
  assert.doesNotThrow(()=>core.validateVefk(entry.document));
  const result=check(raw);
  assert.equal(result.ok,true,JSON.stringify(result));
});

test("S6 checks Unicode title length in UTF-16 units like the JS S1 core",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.title="😀".repeat(151); // 151 code points, 302 UTF-16 units
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc),/title/);
  assert.equal(check(raw).ok,false);
});

test("S6 rejects path coordinates beyond S1 absolute coordinate limits",()=>{
  const raw=fixture(),entry=raw.vefkCatalog.entries[0];
  const doc=structuredClone(core.createVefk({
    id:"s6-viewbox-upper-bound",title:"High origin valid case",kind:"manualPaths",
    geometry:{coordinateSpace:"svg-viewBox",viewBox:[90000,0,20000,1000],
      inkStyles:{glyph:{width:4,cap:"round"}},
      paths:[{id:"pen.001",ink:"glyph",d:"M 90000 10 L 99999 100"}]},
  }));
  entry.document=doc;
  rehashEverything(raw);
  assert.doesNotThrow(()=>core.validateVefk(doc));
  assert.equal(check(raw).ok,true,"valid endpoint just below +100000");
  entry.document.geometry.paths[0].d="M 90000 10 L 100050 100";
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(entry.document));
  assert.equal(check(raw).ok,false,"absolute coordinate above S1 limit must reject");
});
test("S6 rejects an entirely Unicode-whitespace required title just like S1",()=>{
  const raw=fixture(),doc=raw.vefkCatalog.entries[0].document;
  doc.title="\u00a0\u2003\uFEFF"; // JS trim() -> empty
  rehashEverything(raw);
  assert.throws(()=>core.validateVefk(doc),/title/);
  assert.equal(check(raw).ok,false);
});

for (const version of [1, 2]) {
  test(`P7.5 PHP rejects retired parchment binding even after full rehash (v${version})`, () => {
    const raw = fixture();
    raw.vefkCatalog.binding.bindingVersion = version;
    raw.vefkCatalog.binding.surface = {objectId: "parchment", anchorId: "parchment.ink-plane"};
    rehashEverything(raw);
    assert.equal(check(raw).ok, false);
  });
}
