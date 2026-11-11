"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const here=__dirname;
const source=file=>fs.readFileSync(path.join(here,file),"utf8");

test("Translation edits are available only from the publishing surface",()=>{
  const publisher=source("src/PublishCenter.tsx");
  assert.match(publisher,/PublicationTranslationCenter/);
  assert.match(publisher,/Dil ve çeviri/);
  assert.match(publisher,/Paket ve canlı yayın/);
  const languageCenter=source("src/PublicationTranslationCenter.tsx");
  assert.match(languageCenter,/PublicationLanguageEditor/);
  for(const screen of ["NarrativeWorkbench.tsx","VideoAnalysisWorkbench.tsx","EditorialRecordDetail.tsx","VefkWorkshop.tsx"]){
    assert.doesNotMatch(source(path.join("src",screen)),/PublicationLanguageEditor|languagesGenerate\(/,screen);
  }
});

test("Source analysis no longer schedules automatic translation",()=>{
  const runtime=source("studio-runtime.cjs");
  assert.doesNotMatch(runtime,/languageStore\.generate\(/);
  assert.doesNotMatch(runtime,/languageStore\.sync\(/);
  assert.match(runtime,/aiAnalysis\.complete\(/);
  const ipc=source("studio-ipc.cjs");
  assert.match(ipc,/studio:languages-generate/);
  assert.match(ipc,/studio:languages-save/);
});

test("Publishing translations retain separate modes for content and delivery",()=>{
  const publisher=source("src/PublishCenter.tsx");
  assert.match(publisher,/activePublishView === "languages"/);
  assert.match(publisher,/activePublishView === "delivery"/);
  assert.match(publisher,/exportPublicSnapshot\(/);
  assert.match(publisher,/publishPublicSnapshot\(/);
  const center=source("src/PublicationTranslationCenter.tsx");
  for(const kind of ["section","video","entity","outline","vefk"])
    assert.match(center,new RegExp('kind: "'+kind+'"'));
});
