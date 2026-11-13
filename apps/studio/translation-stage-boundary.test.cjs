"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const here=__dirname;
const source=file=>fs.readFileSync(path.join(here,file),"utf8");

test("Translation editing and batch AI generation belong to Records, not Publishing",()=>{
 const records=source("src/EditorialWorkspaceV3.tsx"),publisher=source("src/PublishCenter.tsx");
 assert.match(records,/PublicationTranslationCenter/);
 assert.match(records,/translationMode/);
 assert.doesNotMatch(publisher,/PublicationTranslationCenter|languagesGenerate/);
 const languageCenter=source("src/PublicationTranslationCenter.tsx");
 assert.match(languageCenter,/PublicationLanguageEditor/);
 assert.match(languageCenter,/languagesBatchEnqueue/);
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

test("Publishing offers one automatic mode with separate safe update and full publication support",()=>{
 const publisher=source("src/PublishCenter.tsx");
 assert.match(publisher,/modeFor/);
 assert.match(publisher,/publishPublicSnapshot\(actualMode\)/);
 assert.doesNotMatch(publisher,/exportPublicSnapshot\(/);
 const center=source("src/PublicationTranslationCenter.tsx");
 for(const kind of ["section","video","entity","outline","vefk"])
   assert.match(center,new RegExp("kind:'"+kind+"'"));
});
