"use strict";

const vefkCore = require("./vefk-core/index.cjs");
const store = require("./vefk-store.cjs");
const publication = require("./vefk-publication.cjs");

/**
 * Vefk IPC stays isolated from the narrative/publication route.
 * This boundary can be tested with a fake ipcMain + an in-memory database.
 */
function registerVefkIpc(ipcMain, runtime) {
  const register = (channel, handler, { mutates = false } = {}) =>
    ipcMain.handle(channel, (_event, input) => {
      const result = handler(runtime.database(), input);
      if (mutates) runtime.refreshMainWindow();
      return result;
    });

  register("studio:vefk-generate", (_db, input) => vefkCore.createVefk(input));
  register("studio:vefk-validate", (_db, document) => vefkCore.validateVefk(document));
  register("studio:vefk-list", (db, input) => store.listDocuments(db, input));
  register("studio:vefk-get", (db, input) => store.getDocument(db, input?.id, input?.revision));
  register("studio:vefk-revisions", (db, id) => store.listRevisions(db, id));
  register("studio:vefk-save-draft", (db, input) => store.saveDraft(db, input), { mutates: true });
  register("studio:vefk-review", (db, input) => store.setReviewState(db, input), { mutates: true });
  register("studio:vefk-approved", (db) => store.listApproved(db));
  register("studio:vefk-catalog-list", (db) => publication.selected(db));
  register("studio:vefk-catalog-select", (db, input) => publication.select(db, input), { mutates: true });
}

module.exports = { registerVefkIpc };
