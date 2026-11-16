const narrativeService = require("./narrative-service.cjs");
const narrativeGeneration = require("./narrative-ai-generation.cjs");
const narrativeOutline = require("./narrative-outline.cjs");
const invitationNumbers = require("./narrative-invitation-numbers.cjs");
const invitationDrafts = require("./invitation-draft-service.cjs");
const { registerVisualCompletionIpc } = require("./visual-completion-ipc.cjs");

function registerNarrativeIpc(ipcMain, runtime) {
  if (!ipcMain?.handle) throw new Error("Narrative IPC için ipcMain.handle gerekli.");
  if (!runtime?.database) throw new Error("Narrative IPC için Studio runtime database erişimi gerekli.");
  const db = () => runtime.database();
  const mutate = (callback) => {
    const result = callback();
    runtime.refreshMainWindow?.();
    return result;
  };
  const mutateAsync = async (callback) => {
    const result = await callback();
    runtime.refreshMainWindow?.();
    return result;
  };

  ipcMain.handle("studio:narrative-status", () => narrativeService.status(db()));
  ipcMain.handle("studio:narrative-prepare", (_event, input) => mutate(() => narrativeService.prepare(db(), input)));
  ipcMain.handle("studio:narrative-run", (_event, runId) => narrativeService.getRun(db(), runId));
  ipcMain.handle("studio:narrative-request", (_event, runId) => narrativeService.buildRequest(db(), runId));
  ipcMain.handle("studio:narrative-save-draft-response", (_event, input) => mutate(() => narrativeService.saveDraftResponse(db(), input)));
  ipcMain.handle("studio:narrative-generate-draft", (_event, input) => mutateAsync(() => {
    const database = db();
    return narrativeGeneration.generateDraft(narrativeGeneration.userDataPathFromDb(database), database, input);
  }));
  ipcMain.handle("studio:narrative-apply", (_event, runId) => mutate(() => narrativeService.apply(db(), runId)));
  ipcMain.handle("studio:narrative-discard", (_event, runId) => mutate(() => narrativeService.discard(db(), runId)));
  ipcMain.handle("studio:narrative-outline-status", () => narrativeOutline.status(db()));
  ipcMain.handle("studio:narrative-invitation-save", (_event, input) => mutate(() => invitationNumbers.save(db(), input)));
  ipcMain.handle("studio:invitation-drafts-list", () => invitationDrafts.listing(db()));
  ipcMain.handle("studio:invitation-drafts-detail", (_event, number) => invitationDrafts.detail(db(), Number(number)));
  ipcMain.handle("studio:invitation-drafts-generate", (_event, number) => mutateAsync(() => {
    const database = db();
    return invitationDrafts.generate(database, narrativeGeneration.userDataPathFromDb(database), Number(number));
  }));
  ipcMain.handle("studio:invitation-drafts-update", (_event, input) => mutate(() => invitationDrafts.update(db(),input)));
  ipcMain.handle("studio:invitation-drafts-review", (_event, input) => mutate(() => invitationDrafts.review(db(),input)));

  ipcMain.handle("studio:narrative-outline-series", (_event, input) => mutate(() => narrativeOutline.saveSeries(db(), input)));
  ipcMain.handle("studio:narrative-outline-chapter", (_event, input) => mutate(() => narrativeOutline.saveChapter(db(), input)));
  ipcMain.handle("studio:narrative-outline-place", (_event, input) => mutate(() => narrativeOutline.placeSection(db(), input)));
  ipcMain.handle("studio:narrative-outline-move", (_event, input) => mutate(() => narrativeOutline.moveNode(db(), input)));

  ipcMain.handle("studio:narrative-outline-suggestions", () => narrativeOutline.suggestions(db()));

  // The deterministic narrative IPC verifier uses a minimal runtime without visual generation.
  // Real Studio runtime exposes generateVisualImage, so the next editorial stage registers there
  // without widening the provider-independent narrative-only test surface.
  if (typeof runtime.generateVisualImage === "function") registerVisualCompletionIpc(ipcMain, runtime);
}

module.exports = { registerNarrativeIpc };
