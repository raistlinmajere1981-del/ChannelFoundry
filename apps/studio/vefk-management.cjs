"use strict";
const fs = require("node:fs");
const path = require("node:path");
const core = require("./vefk-core/index.cjs");
const store = require("./vefk-store.cjs");
const sources = require("./vefk-sources.cjs");
const publication = require("./vefk-publication.cjs");

function confirmed(input) {
  if (input?.confirmed !== true) throw new Error("Silme işlemi için açık onay gerekli.");
}
function transaction(db, action) {
  db.exec("BEGIN IMMEDIATE");
  try { const value = action(); db.exec("COMMIT"); return value; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
function title(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 300) throw new Error("Ad 1–300 karakter olmalı.");
  return value.trim();
}
/** Only hash-named regular files inside the Vefk folder, unreferenced by BOTH
 * source and preparation records. Never traverse symlinks or public-export. */
function cleanup(db, userData) {
  sources.schema(db);
  const folder = path.join(path.resolve(userData), "vefk-sources");
  const referenced = new Set([
    ...db.prepare("SELECT relative_path FROM vefk_sources").all(),
    ...db.prepare("SELECT relative_path FROM vefk_source_preparations").all(),
  ].map(row => row.relative_path));
  let removed = 0;
  const folderInfo = fs.lstatSync(folder, { throwIfNoEntry: false });
  if (!folderInfo) return { removed };
  if (!folderInfo.isDirectory()) throw new Error("Vefk kaynak klasörü gerçek bir dizin olmalı.");
  for (const file of fs.readdirSync(folder, { withFileTypes: true })) {
    if (file.isFile() && /^[a-f0-9]{64}\.(png|jpg|webp)$/.test(file.name) && !referenced.has(file.name)) {
      fs.unlinkSync(path.join(folder, file.name)); removed++;
    }
  }
  return { removed };
}
function deleteSource(db, userData, input) {
  confirmed(input); sources.schema(db);
  const source = sources.listSources(db).find(source => source.id === input.id);
  if (!source) throw new Error("Kaynak görsel bulunamadı.");
  const result = transaction(db, () => {
    const analyses = db.prepare("DELETE FROM vefk_source_analyses WHERE source_id=?").run(input.id).changes;
    const preparations = db.prepare("DELETE FROM vefk_source_preparations WHERE source_id=?").run(input.id).changes;
    db.prepare("DELETE FROM vefk_sources WHERE id=?").run(input.id);
    return { id: input.id, analyses, preparations };
  });
  try { return { ...result, ...cleanup(db, userData) }; }
  catch { return { ...result, removed: 0, cleanupPending: true }; }
}
function deleteAnalyses(db, input) {
  confirmed(input); sources.schema(db);
  if (!sources.listSources(db).some(source => source.id === input.id)) throw new Error("Kaynak bulunamadı.");
  return { id: input.id, removed: db.prepare("DELETE FROM vefk_source_analyses WHERE source_id=?").run(input.id).changes };
}
function deleteDocument(db, input) {
  confirmed(input); publication.ensureSchema(db);
  if (!db.prepare("SELECT id FROM vefk_documents WHERE id=?").get(input.id)) throw new Error("Belge bulunamadı.");
  return transaction(db, () => {
    const catalogRemoved = Boolean(db.prepare("DELETE FROM vefk_publication_selection WHERE document_id=?").run(input.id).changes);
    db.prepare("DELETE FROM vefk_document_sources WHERE document_id=?").run(input.id);
    const revisions = db.prepare("DELETE FROM vefk_revisions WHERE document_id=?").run(input.id).changes;
    db.prepare("DELETE FROM vefk_documents WHERE id=?").run(input.id);
    return { id: input.id, revisions, catalogRemoved };
  });
}
function renameSource(db, input) {
  sources.schema(db);
  const filename = title(input?.title).slice(0, 200);
  const found = sources.listSources(db).find(source => source.id === input.id);
  if (!found) throw new Error("Kaynak bulunamadı.");
  db.prepare("UPDATE vefk_sources SET filename=? WHERE id=?").run(filename, input.id);
  return { ...found, filename };
}
function documentInput(doc) {
  return { ...doc, kind: doc.construction.kind, parameters: doc.construction.parameters,
    grid: doc.construction.grid, contentHash: undefined, construction: undefined };
}
function copyDocument(db, input) {
  const record = store.getDocument(db, input?.id);
  if (!record) throw new Error("Belge bulunamadı.");
  const document = core.createVefk({ ...documentInput(record.document), id: input.newId,
    revision: 1, title: title(input.title ?? record.document.title + " · Kopya") });
  const evidence = store.sourceReview(db, record.id);
  return store.saveDraft(db, { document, sourceReview: evidence, copyFrom: record.id });
}
module.exports = { cleanup, deleteSource, deleteAnalyses, deleteDocument, renameSource, copyDocument };
