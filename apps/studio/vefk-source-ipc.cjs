"use strict";

const management = require("./vefk-management.cjs");
const sources = require("./vefk-sources.cjs");
const vision = require("./vefk-vision.cjs");
const preparations = require("./vefk-preparations.cjs");

function registerVefkSourceIpc(ipcMain, runtime) {
  for (const [channel, action] of [
    ["studio:vefk-source-delete", input => management.deleteSource(runtime.database(), runtime.vefkUserDataPath(), input)],
    ["studio:vefk-analysis-delete", input => management.deleteAnalyses(runtime.database(), input)],
    ["studio:vefk-source-rename", input => management.renameSource(runtime.database(), input)],
    ["studio:vefk-source-cleanup", input => {
      if (input?.confirmed !== true) throw new Error("Temizlik için açık onay gerekli.");
      return management.cleanup(runtime.database(), runtime.vefkUserDataPath());
    }],
  ]) ipcMain.handle(channel, (_event, input) => { const result = action(input); runtime.refreshMainWindow(); return result; });
  ipcMain.handle("studio:vefk-source-list", () => sources.listSources(runtime.database()));
  ipcMain.handle("studio:vefk-source-get", (_event, id) =>
    sources.loadSource(runtime.database(), runtime.vefkUserDataPath(), typeof id === "string" ? id : id?.id, { preparationRevision: typeof id === "string" ? undefined : id?.preparationRevision }));
  ipcMain.handle("studio:vefk-source-pick", async () => {
    const result = await runtime.pickVefkSource();
    if (!result.canceled) runtime.refreshMainWindow();
    return result;
  });
  ipcMain.handle("studio:vefk-source-prepare", (_event, input) => {
    const result = preparations.prepare(runtime.database(), runtime.vefkUserDataPath(), input ?? {});
    runtime.refreshMainWindow();
    return result;
  });
  ipcMain.handle("studio:vefk-vision-support", () => vision.support(runtime.vefkUserDataPath()));
  ipcMain.handle("studio:vefk-source-analysis", (_event, id) =>
    sources.latestAnalysis(runtime.database(), id));
  ipcMain.handle("studio:vefk-source-analyze", async (_event, id) => {
    const result = await vision.analyze(runtime.database(), runtime.vefkUserDataPath(), id);
    runtime.refreshMainWindow();
    return result;
  });
  ipcMain.handle("studio:vefk-source-review", (_event, input) => {
    const last = sources.latestAnalysis(runtime.database(), input?.sourceId);
    if (!last) throw new Error("Düzenlenecek analiz bulunamadı.");
    const result = sources.appendAnalysis(runtime.database(), {
      sourceId: input.sourceId,
      origin: "review",
      provider: last.provider,
      model: last.model,
      result: input.result,
      expectedAnalysisId: input.expectedAnalysisId,
    });
    runtime.refreshMainWindow();
    return result;
  });
}

module.exports = { registerVefkSourceIpc };
