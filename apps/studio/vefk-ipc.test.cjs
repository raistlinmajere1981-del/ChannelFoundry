"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { registerVefkIpc } = require("./vefk-ipc.cjs");
const { ensureSchema } = require("./vefk-store.cjs");

test("Vefk IPC exposes independent generate, storage, review and read-only endpoints", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  ensureSchema(db);
  const handlers = new Map();
  const ipcMain = {
    handle(channel, handler) {
      assert.ok(!handlers.has(channel), `Duplicate IPC channel: ${channel}`);
      handlers.set(channel, handler);
    },
  };
  let refreshCount = 0;
  const runtime = { database: () => db, refreshMainWindow: () => { refreshCount += 1; } };
  registerVefkIpc(ipcMain, runtime);
  const names = [...handlers.keys()];
  assert.deepEqual(names, [
    "studio:vefk-generate", "studio:vefk-validate", "studio:vefk-list",
    "studio:vefk-get", "studio:vefk-revisions", "studio:vefk-save-draft",
    "studio:vefk-review", "studio:vefk-source-review-info", "studio:vefk-delete", "studio:vefk-copy", "studio:vefk-approved",
    "studio:vefk-package-status", "studio:vefk-catalog-list", "studio:vefk-catalog-select",
  ]);
  const call = (name, input) => {
    assert.ok(handlers.has(name), `IPC handler missing: ${name}`);
    return handlers.get(name)({}, input);
  };

  const generated = call("studio:vefk-generate", {
    id: "vefk-ipc-demo", title: "IPC denemesi", parameters: { order: 3 },
  });
  assert.equal(call("studio:vefk-validate", generated).ok, true);
  assert.equal(refreshCount, 0, "Generating does not write to storage.");

  const saved = call("studio:vefk-save-draft", { document: generated });
  assert.equal(saved.status, "draft");
  assert.equal(refreshCount, 1);
  assert.equal(call("studio:vefk-get", { id: generated.id }).contentHash, generated.contentHash);
  assert.equal(call("studio:vefk-list", { query: "denemesi" }).length, 1);
  assert.equal(call("studio:vefk-revisions", generated.id).length, 1);
  assert.equal(call("studio:vefk-approved").length, 0);
  assert.equal(refreshCount, 1, "Read APIs do not refresh the renderer.");

  assert.equal(call("studio:vefk-review", {
    id: generated.id, revision: 1, status: "checked", expectedContentHash: generated.contentHash,
  }).status, "checked");
  assert.equal(call("studio:vefk-review", {
    id: generated.id, revision: 1, status: "approved", expectedContentHash: generated.contentHash,
  }).status, "approved");
  assert.equal(refreshCount, 3);
  assert.equal(call("studio:vefk-approved")[0].id, generated.id);
  assert.deepEqual(call("studio:vefk-catalog-list"), []);
  assert.equal(call("studio:vefk-catalog-select", {
    id: generated.id, revision: 1, enabled: true, contentHash: generated.contentHash,
  }).selected, true);
  assert.equal(call("studio:vefk-catalog-list")[0].revision, 1);

  const changed = call("studio:vefk-generate", {
    id: "vefk-ipc-demo", revision: 2, title: "Düzeltilmiş IPC", parameters: { order: 5 },
  });
  call("studio:vefk-save-draft", { document: changed });
  assert.equal(refreshCount, 5);
  assert.equal(call("studio:vefk-catalog-list")[0].revision, 1, "Pinned catalog baseline survives new draft.");
  assert.equal(call("studio:vefk-approved")[0].revision, 1, "Old approved baseline survives new draft.");
  db.close();
});

test("Main process, preload and TypeScript contract expose S2 wiring without publishing or UI coupling", () => {
  const studioRoot = __dirname;
  const read = (file) => fs.readFileSync(path.join(studioRoot, file), "utf8");
  const mainIpc = read("studio-ipc.cjs");
  const runtime = read("studio-runtime.cjs");
  const preload = read("preload.cjs");
  const typeContract = read("src/studio-api.d.ts");
  assert.match(mainIpc, /registerVefkIpc\(ipcMain, runtime\)/);
  assert.match(runtime, /vefkStore\.ensureSchema\(studioDatabase\)/);
  for (const name of ["vefkGenerate", "vefkValidate", "vefkList", "vefkGet",
    "vefkRevisions", "vefkSaveDraft", "vefkReview", "vefkApproved"]) {
    assert.match(preload, new RegExp(`${name}:`), `Missing preload method ${name}`);
    assert.match(typeContract, new RegExp(`${name}\\(`), `Missing TS API method ${name}`);
  }
  assert.match(read("publication-v2.cjs"), /vefkCatalog/);
  assert.match(read("publication-v2.cjs"), /vefkCatalog.entries.length/);
  assert.match(preload, /vefkCatalogSelect/);
  assert.match(typeContract, /vefkCatalogList/);
  assert.match(read("src/StudioPipeline.tsx"), /Vefk Atölyesi/, "S3 editörü Studio navigasyonuna bağlı olmalı.");
});
