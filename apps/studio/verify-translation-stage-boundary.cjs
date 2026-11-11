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
const publishing=read("src/PublishCenter.tsx");
assert.match(publishing,/import PublicationTranslationCenter from "\.\/PublicationTranslationCenter"/);
assert.match(publishing,/<PublicationTranslationCenter\/>/,"Publishing must expose the dedicated language workspace");
assert.match(read("src/PublicationTranslationCenter.tsx"),/languagesOverview|PublicationLanguageEditor|languagesGet/,"Publishing must retain translation management");
const ipc=read("studio-ipc.cjs");
const pubHandler=ipc.slice(ipc.indexOf("function registerPublishingHandlers()"),ipc.indexOf("function registerStudioIpc()"));
for(const endpoint of ["studio:languages-overview","studio:languages-get","studio:languages-save","studio:languages-generate"]){
  assert(pubHandler.includes(endpoint),endpoint+" must be registered in publishing");
}
const dashboard=read("src/TranslationStatus.tsx");
assert.match(dashboard,/onNavigate\('Yayınlama'\)/);
console.log("PASS: Source analysis only analyzes; translations are edited and generated from Yayınlama, including status navigation.");
