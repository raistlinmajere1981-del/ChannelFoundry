"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=__dirname;
const read=name=>fs.readFileSync(path.join(base,name),"utf8");
const runtime=read("studio-runtime.cjs");
const done="aiAnalysis.complete(database(), job.videoId, result.config?.model ?? config.model, result);";
const after=runtime.split(done);
assert.equal(after.length,2,"Analysis completion point must be unique");
const completion=after[1].split("aiActivity.finishSession(activitySession.id, {")[0];
assert.doesNotMatch(completion,/languageStore\.|publicationLanguages\.|generate\(|studio:languages-|for\s*\(const language/, "Source analysis must not run translation or sync languages");
assert.match(runtime,/Source analysis finishes here\./);
for(const filename of [
  "src/VideoAnalysisWorkbench.tsx",
  "src/NarrativeWorkbench.tsx",
  "src/EditorialRecordDetail.tsx",
  "src/VefkWorkshop.tsx",
]){
  const code=read(filename);
  assert.doesNotMatch(code,/PublicationLanguageEditor|languagesGenerate|languagesSave|languagesOverview/,filename+" must be translation-free");
}
assert.doesNotMatch(read("src/NarrativeWorkbench.tsx"),/\["languages",/,"Hikâyeleştir translation tab is obsolete");
const records=read("src/EditorialWorkspaceV3.tsx");
assert.match(records,/PublicationTranslationCenter/,"Kayıt Dosyaları yayın metinleri ve AI çeviriyi içermeli");
assert.match(records,/translationMode/,"Kayıt editörü ve TR\/EN çeviri tek çalışma alanından açılmalı");
assert.doesNotMatch(read("src/PublishCenter.tsx"),/PublicationTranslationCenter|languagesGenerate/,"Yayın Merkezi dil editörü taşımamalı");
assert.match(read("src/PublicationTranslationCenter.tsx"),/languagesOverview|languagesBatchEnqueue|PublicationLanguageEditor/,"Toplu AI çeviri kayıt hazırlığına bağlı kalmalı");
const ipc=read("studio-ipc.cjs");
const pubHandler=ipc.slice(ipc.indexOf("function registerPublishingHandlers()"),ipc.indexOf("function registerStudioIpc()"));
for(const endpoint of ["studio:languages-overview","studio:languages-get","studio:languages-save","studio:languages-generate","studio:languages-batch-enqueue","studio:languages-batch-status"]){
  assert(pubHandler.includes(endpoint),endpoint+" must be registered in publishing");
}
const dashboard=read("src/TranslationStatus.tsx");
assert.match(dashboard,/onNavigate\('Kayıt Dosyaları'\)/);
console.log("PASS: AI analysis stays translation-free; records own bilingual editorial review and batch queue, publishing only deploys.");
