"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=__dirname;
const read=(file)=>fs.readFileSync(path.join(root,"src",file),"utf8");
const frame=read("studio-fixed-viewport.css");
const pipeline=read("StudioPipeline.tsx");
const main=read("main.tsx");
const research=read("SubtitleResearch.tsx");
const analysisStyles=read("ai-production-workbench.css");
const analysisLabels=read("video-analysis-utils.ts");
const curation=read("AnalysisCurationWorkbench.tsx");
const curationStyles=read("analysis-curation.css");

assert.match(main,/import "\.\/studio-fixed-viewport\.css";/);
assert.ok(main.indexOf("studio-fixed-viewport.css") > main.indexOf("studio-workspace-system.css"),"fixed frame should load after shared design layer");
assert.match(pipeline,/<section className="studio-content pipeline-content" aria-label="Çalışma alanı"/);
assert.match(pipeline,/data-workspace-section=\{active\}/);
assert.match(pipeline,/studio-workspace-error/);

for(const rule of [
  /\.studio-shell\.pipeline-shell\{[\s\S]*?height:100dvh;[\s\S]*?overflow:hidden;/,
  /\.studio-content\.pipeline-content\{[\s\S]*?flex:1 1 auto;[\s\S]*?overflow:hidden;/,
  /\.pipeline-content>\.ops-dashboard\{[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\);/,
  /\.pipeline-content>\.video-archive-page\{[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\);/,
  /\.pipeline-content>\.subtitle-research-page\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\);/,
  /\.pipeline-content>\.ai-workbench-shell\.ai-production-workbench\{[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\);/,
  /\.pipeline-content>\.settings-page\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\);/,
  /\.pipeline-content>\.publish-center\{[\s\S]*?grid-template-rows:minmax\(0,1fr\);/,
  /\.editorial-workspace\s*\.editorial-list\{[\s\S]*?overflow-y:auto;/,
  /\.ai-stage-content \.ai-source-rows\{[\s\S]*?overflow-y:auto;/,
  /\.ai-stage-content \.analysis-curation-detail\{[\s\S]*?overflow-y:auto;/,
  /\.settings-page>\.studio-settings-surface\{[\s\S]*?overflow-y:auto;/,
  /\.community-admin-view :where\(\.community-forum-thread-list,\.community-forum-thread-detail\)/,
])assert.match(frame,rule);
assert.ok(!/overflow-y\s*:\s*auto/.test(frame.match(/\.studio-content\.pipeline-content\{[^}]+\}/)[0]),"outer workspace must never own scrolling");
assert.ok(frame.includes('grid-template-areas:"selection pagination view submit"'),"AI toolbar actions must fit one row");
assert.match(frame,/\.ai-stage-content \.ai-analysis-selection-toolbar\{[\s\S]*?overflow-x:auto;/,"AI toolbar must avoid overlaps on compact panes");
assert.match(frame,/\.ai-stage-content \.ai-source-list>\.ai-source-toolbar,[\s\S]*?flex:0 0 auto;/,"AI list headers must not shrink into each other");
assert.match(frame,/@container \(max-width:540px\)/,"AI toolbar must adapt to the list pane width");
assert.match(frame,/\.ai-stage-content \.ai-source-rows\{[^}]*overflow-x:hidden;/,"AI video list must not horizontally scroll");
assert.match(analysisStyles,/\.ai-source-table-head\s*\{[^}]*grid-template-columns:\s*20px minmax\(0, 1fr\) 88px 100px/,"List header must reserve width for retry action");
assert.match(analysisStyles,/\.ai-source-rows:not\(\.grid-view\) article\s*\{[^}]*grid-template-columns:\s*20px minmax\(0, 1fr\) 88px 100px/,"List rows must align with header");
assert.match(analysisStyles,/\.ai-analysis-row-action\s*\{[^}]*white-space:\s*normal;/,"Retry action must wrap instead of widening the row");
assert.match(analysisLabels,/if \(video\.hasAnalysis\) return "Hazır";/,"Ready label must be concise");
assert.ok(curation.indexOf('className="analysis-curation-actions"') < curation.indexOf('className="analysis-curation-scroll"'),"Curation controls must precede scroll content");
assert.match(curationStyles,/\.analysis-curation-actions\{[\s\S]*?flex:0 0 auto;/,"Curation action bar must never shrink into scroll content");
assert.match(frame,/\.ai-stage-content \.analysis-curation-detail\{[\s\S]*?overflow:hidden;/,"Curation detail must own fixed and scrolling regions");
assert.match(frame,/\.ai-stage-content \.analysis-curation-scroll\{[\s\S]*?overflow-y:auto;/,"Only the curation detail content should scroll");
assert.ok(frame.includes('.ops-dashboard .ops-task-list,') && frame.includes('overflow-x:hidden'));
assert.match(research,/className="subtitle-results-region"/);
assert.match(research,/className="subtitle-results-empty"/);
assert.match(frame,/\.subtitle-research-page>\.subtitle-results-region\{[\s\S]*?overflow-y:auto;/);
const pageTypes=[
 "ops-dashboard","video-archive-page","subtitle-research-page",
 "ai-workbench-shell","editorial-workspace","community-admin-view",
 "publish-center","settings-page",
];
for(const page of pageTypes) assert.ok(frame.includes(page),"missing frame mapping: "+page);
console.log("Fixed Studio viewport: single no-scroll page canvas, eight workspaces, independent scroll areas PASS");
