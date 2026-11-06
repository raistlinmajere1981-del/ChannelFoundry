"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { DatabaseSync } = require("node:sqlite");
const sources = require("./vefk-sources.cjs");
const { registerVefkSourceIpc } = require("./vefk-source-ipc.cjs");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=", "base64");

test("source IPC end-to-end: pick, list, load, analyze metadata, review and live refresh", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-source-ipc-"));
  const file = path.join(root, "mystery.png");
  fs.writeFileSync(file, PNG);
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const handlers = new Map();
  let refresh = 0;
  const runtime = {
    database: () => db, vefkUserDataPath: () => root,
    pickVefkSource: async () => ({ canceled: false, source: sources.importSource(db, root, file) }),
    refreshMainWindow: () => { refresh += 1; },
  };
  registerVefkSourceIpc({ handle(name, fn) { assert.ok(!handlers.has(name)); handlers.set(name, fn); } }, runtime);
  const call = (name, arg) => {
    assert.ok(handlers.has(name));
    return handlers.get(name)({}, arg);
  };
  try {
    assert.deepEqual([...handlers.keys()], [
      "studio:vefk-source-list", "studio:vefk-source-get", "studio:vefk-source-pick",
      "studio:vefk-source-prepare", "studio:vefk-vision-support", "studio:vefk-source-analysis",
      "studio:vefk-source-analyze", "studio:vefk-source-review",
    ]);
    const picked = await call("studio:vefk-source-pick");
    assert.equal(picked.canceled, false);
    assert.equal(refresh, 1);
    assert.equal(call("studio:vefk-source-list").length, 1);
    assert.match(call("studio:vefk-source-get", picked.source.id).imageDataUrl, /^data:image\/png;base64,/);
    assert.equal(call("studio:vefk-source-analysis", picked.source.id), null);

    const proposal = {
      schema: "vefk.source-analysis.v1", orientation: "unknown", note: "",
      regions: [{ kind: "number", box: [10, 10, 40, 40], label: "?", confidence: 0.3 }],
    };
    const ai = sources.appendAnalysis(db, {
      sourceId: picked.source.id, origin: "ai", provider: "test-provider",
      model: "test-model", result: proposal,
    });
    const latest = call("studio:vefk-source-analysis", picked.source.id);
    assert.equal(latest.id, ai.id);
    const edited = structuredClone(latest.result);
    edited.regions[0].label = "7";
    edited.regions[0].reviewed = true;
    const updated = call("studio:vefk-source-review", {
      sourceId: picked.source.id, expectedAnalysisId: latest.id, result: edited,
    });
    assert.equal(updated.status, "reviewed");
    assert.equal(updated.result.regions[0].label, "7");
    assert.equal(updated.result.regions[0].needsReview, false);
    assert.equal(refresh, 2);
    assert.throws(() => call("studio:vefk-source-review", {
      sourceId: picked.source.id, expectedAnalysisId: latest.id, result: edited,
    }), /güncel değil/);
    assert.equal(refresh, 2);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Studio source UI keeps visual import primary and routes reviews to one canonical S2 store", () => {
  const read = name => fs.readFileSync(path.join(__dirname, name), "utf8");
  const workshop = read("src/VefkWorkshop.tsx");
  const sourceUI = read("src/VefkSourceWorkbench.tsx");
  const preload = read("preload.cjs");
  const ipc = read("studio-ipc.cjs");
  assert.match(workshop, /Görselden oluştur/);
  assert.match(workshop, /<VefkSourceWorkbench/);
  assert.match(sourceUI, /vefkSourceAnalyze/);
  assert.match(sourceUI, /vefkSourceReview/);
  assert.match(sourceUI, /Sayısal kareyi SVG'ye aktar/);
  assert.match(sourceUI, /İzlenen çizgileri SVG'ye aktar/);
  assert.match(ipc, /registerVefkSourceIpc/);
  for (const method of ["vefkSourcePick","vefkSourceList","vefkSourceGet","vefkSourcePrepare","vefkSourceAnalysis",
    "vefkSourceAnalyze","vefkSourceReview","vefkVisionSupport"]) assert.match(preload, new RegExp(method));
  assert.doesNotMatch(read("publication-v2.cjs"), /vefk_source/);
});
