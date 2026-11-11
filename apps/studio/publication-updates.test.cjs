const test = require("node:test");
const assert = require("node:assert/strict");
const {buildUpdatePublication,valid} = require("./publication-updates.cjs");
const {fingerprint} = require("./publication-v2.cjs");
function resign(value) {
  const {publication: old,...logical} = value;
  const fp=fingerprint(logical);
  value.publication={...old,id:"pub-"+fp.slice(0,24),contentFingerprint:fp};
  return value;
}
const pair = text => ({tr:{status:"approved",title:text},en:{status:"approved",title:text}});
function snap() {
  const logical = {
    schemaVersion:2,languageVersion:1,languages:["tr","en"],vefkLanguages:{},
    journal:{sections:[{sectionId:"s1",revision:1,locales:pair("Başlangıç")}],outline:{series:[],ungroupedSectionIds:["s1"]}},
    archive:{entities:[{entityId:"e1",kind:"character",name:"Tuji",aliases:[],relations:[],visual:{},locales:pair("Tuji")}],relations:[]},
    assets:[],youtubeAnalysis:{videos:[]},support:{sponsors:[],contributors:[]},
  };
  const fp = fingerprint(logical);
  return {...logical,publication:{id:"pub-"+fp.slice(0,24),contentFingerprint:fp,generatedAt:"2026-11-11T00:00:00Z"}};
}
test("updates a published portrait without admitting new approved content", () => {
  const baseline=snap(), current=structuredClone(baseline);
  current.archive.entities[0].visual={assetId:"portrait-e1"};
  current.archive.entities.push({...current.archive.entities[0],entityId:"unpublished-new",name:"New"});
  current.journal.sections.push({...current.journal.sections[0],sectionId:"new-section"});
  current.assets.push({assetId:"portrait-e1",entityId:"e1",url:"assets/portrait-e1-abc.png",sha256:"a".repeat(64),bytes:10});
  resign(current);
  const out=buildUpdatePublication(baseline,{snapshot:current,assetSources:[{assetId:"portrait-e1",file:"/tmp/portrait.png",filename:"portrait-e1-abc.png"}],readiness:{readyForTheme:false}});
  assert.equal(out.readiness.readyForTheme,false);
  assert.equal(out.changed,true);
  assert.equal(out.snapshot.archive.entities.length,1);
  assert.equal(out.snapshot.journal.sections.length,1);
  assert.equal(out.snapshot.assets.length,1);
  assert.equal(out.assetSources.length,1);
  assert.deepEqual(out.snapshot.archive.entities[0].locales,baseline.archive.entities[0].locales);
  valid(out.snapshot);
});
test("unapproved language edits cannot replace published bilingual text", () => {
  const baseline=snap(), current=structuredClone(baseline);
  current.archive.entities[0].locales.en.status="draft";
  current.archive.entities[0].locales.tr.title="Yeni";
  resign(current);
  const out=buildUpdatePublication(baseline,{snapshot:current,assetSources:[],readiness:{readyForTheme:false}});
  assert.equal(out.changed,false);
  assert.deepEqual(out.snapshot.archive.entities[0].locales,baseline.archive.entities[0].locales);
});
test("approved TR/EN changes can be published independently", () => {
  const baseline=snap(),current=structuredClone(baseline);
  current.archive.entities[0].locales=pair("Güncel");
  resign(current);
  const out=buildUpdatePublication(baseline,{snapshot:current,assetSources:[],readiness:{readyForTheme:false}});
  assert.equal(out.changed,true);
  assert.equal(out.snapshot.archive.entities[0].locales.en.title,"Güncel");
  valid(out.snapshot);
});

test("missing local records remain live unless explicitly hidden", () => {
  const baseline=snap(), current=structuredClone(baseline);
  current.archive.entities=[];
  current.journal.sections=[];
  resign(current);
  const ordinary=buildUpdatePublication(baseline,{snapshot:current,assetSources:[],readiness:{}});
  assert.equal(ordinary.changed,false);
  assert.equal(ordinary.changes.hidden,0);
  assert.equal(ordinary.snapshot.archive.entities.length,1);
  assert.equal(ordinary.snapshot.journal.sections.length,1);
  const withdrawn=buildUpdatePublication(baseline,{snapshot:current,assetSources:[],readiness:{}},{
    hiddenEntityIds:["e1"],hiddenSectionIds:["s1"],
  });
  assert.equal(withdrawn.changes.hidden,2);
  assert.equal(withdrawn.snapshot.archive.entities.length,0);
  assert.equal(withdrawn.snapshot.journal.sections.length,0);
  valid(withdrawn.snapshot);
});
