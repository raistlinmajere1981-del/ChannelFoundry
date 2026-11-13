const test = require("node:test");
const assert = require("node:assert/strict");
const {buildUpdatePublication,valid,compareCoverage} = require("./publication-updates.cjs");
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

test('coverage requires full publishing for new narratives, relationships, sponsors and drawing revisions',()=>{
 const live=snap(),current=structuredClone(live);
 assert.equal(compareCoverage(current,live).requiresFull,false);
 current.journal.sections.push({...current.journal.sections[0],sectionId:'s2'});
 current.archive.entities.push({...current.archive.entities[0],entityId:'e2',name:'Yeni'});
 current.archive.relations.push({relationId:'r2',fromEntityId:'e1',toEntityId:'e2'});
 current.youtubeAnalysis.videos.push({videoId:'video2'});
 current.support.sponsors.push({name:'Sponsor'});
 current.vefkCatalog={entries:[{id:'vefk1',revision:2}]};
 const diff=compareCoverage(current,live);
 assert.equal(diff.newSections,1);assert.equal(diff.newEntities,1);assert.equal(diff.newRelations,1);assert.equal(diff.newVideos,1);
 assert.equal(diff.drawingsChanged,true);assert.equal(diff.supportChanged,true);
 assert.equal(diff.requiresFull,true);assert(diff.reasons.length>=6);
});
test('new outline chapter triggers full publication even when original series key remains the same',()=>{
 const live=snap(),current=structuredClone(live);
 live.journal.outline.series=[{key:'series1',chapters:[{key:'chapter1'}]}];
 current.journal.outline.series=[{key:'series1',chapters:[{key:'chapter1'},{key:'chapter2'}]}];
 assert.equal(compareCoverage(current,live).outlineChanged,true);
 assert.equal(compareCoverage(current,live).requiresFull,true);
});
test('simple visual update does not force full publication and missing baseline does',()=>{
 const live=snap(),current=structuredClone(live);
 current.archive.entities[0].visual={assetId:'portrait'};
 assert.equal(compareCoverage(current,live).requiresFull,false);
 assert.equal(compareCoverage(current,null).requiresFull,true);
});

test('a Vefk translation, camera metadata or removed relationship requires full publication',()=>{
 const live=snap(),current=structuredClone(live);
 live.vefkLanguages={vefk1:{en:{status:'approved',title:'Old'}}};
 current.vefkLanguages={vefk1:{en:{status:'approved',title:'New'}}};
 assert.equal(compareCoverage(current,live).vefkLanguageChanged,true);
 current.vefkLanguages=structuredClone(live.vefkLanguages);
 live.archive.relations=[{relationId:'old',fromEntityId:'e1',toEntityId:'e1'}];
 assert.equal(compareCoverage(current,live).relationRemoved,true);
 current.archive.relations=structuredClone(live.archive.relations);
 live.youtubeAnalysis.videos=[{videoId:'video1',thumbnailUrl:'old',locales:pair('Old')}];
 current.youtubeAnalysis.videos=[{videoId:'video1',thumbnailUrl:'new',locales:pair('Old')}];
 assert.equal(compareCoverage(current,live).videoMetadataChanged,true);
 assert.equal(compareCoverage(current,live).requiresFull,true);
});

test('single-language modifications on an existing entity require full publication, not silent overlay omission',()=>{
 const baseline=snap(),current=structuredClone(baseline);
 delete current.archive.entities[0].locales.en;
 current.archive.entities[0].locales.tr.title='Güncel Türkçe';
 const coverage=compareCoverage(current,baseline);
 assert.equal(coverage.partialLocaleChanges,true);
 assert.equal(coverage.requiresFull,true);
 assert(coverage.reasons.some(reason=>reason.includes('Tek dil')));
});
