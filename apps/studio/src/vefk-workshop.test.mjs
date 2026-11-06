import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { nextPathId, movePath, scalePath, shapePath } from "./vefk-editor-model.ts";

const require = createRequire(import.meta.url);
const core = require("../vefk-core/index.cjs");
const store = require("../vefk-store.cjs");
const root = path.dirname(fileURLToPath(import.meta.url));

test("S3 drawing -> S1 validated contract -> S2 saved/approved revision", () => {
  const first = core.createVefk({ id: "s3-integration", title: "Görsel kare", kind: "magicSquare", parameters: { order: 3 } });
  const paths = first.geometry.paths;
  const id = nextPathId(paths);
  const newPath = shapePath("diamond", { x: 395, y: 395 }, { x: 605, y: 605 });
  const translated = movePath(newPath, 50, 0, first.geometry.viewBox);
  const adjusted = scalePath(translated, .9, first.geometry.viewBox);
  const geometry = { ...first.geometry, paths: [...paths, { id, ink: "glyph", d: adjusted }] };
  const edited = core.createVefk({
    id: first.id, title: "Görsel kare", kind: "magicSquare",
    parameters: { order: 3 }, geometry,
  });
  assert.equal(edited.geometry.paths.length, first.geometry.paths.length + 1);
  assert.equal(edited.geometry.paths.at(-1).id, id);
  assert.equal(edited.construction.checks.expectedSum, 15);
  assert.equal(core.validateVefk(edited).ok, true);
  assert.equal(edited.drawPlan.strokes.length, edited.geometry.paths.length);
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  try {
    store.saveDraft(db, { document: edited });
    const checked = store.setReviewState(db, {
      id: edited.id, revision: 1, status: "checked", expectedContentHash: edited.contentHash,
    });
    assert.equal(checked.status, "checked");
    const approved = store.setReviewState(db, {
      id: edited.id, revision: 1, status: "approved", expectedContentHash: edited.contentHash,
    });
    assert.equal(approved.contentHash, edited.contentHash);
    assert.equal(store.listApproved(db).length, 1);
  } finally { db.close(); }
});

test("S3 new manual path document can be serialized into a self-contained immutable bundle", () => {
  const geometry = {
    coordinateSpace: "svg-viewBox", viewBox: [0, 0, 1000, 1000],
    paths: [{ id: "mark.001", d: shapePath("rectangle", { x: 100, y: 100 }, { x: 900, y: 900 }), ink: "glyph" }],
    inkStyles: { glyph: { width: 7, cap: "round" } },
  };
  const manual = core.createVefk({ id: "s3-manual", title: "Manuel diyagram", kind: "manualPaths", geometry });
  assert.equal(core.parseVefk(core.serializeVefk(manual)).contentHash, manual.contentHash);
});

test("Studio sidebar, loader and S2 preload expose S3 as a local-only production surface", () => {
  const pipeline = fs.readFileSync(path.join(root, "StudioPipeline.tsx"), "utf8");
  const icons = fs.readFileSync(path.join(root, "StudioIcon.tsx"), "utf8");
  const workshop = fs.readFileSync(path.join(root, "VefkWorkshop.tsx"), "utf8");
  const preload = fs.readFileSync(path.join(root, "../preload.cjs"), "utf8");
  assert.match(pipeline, /"Vefk Atölyesi"/);
  assert.match(pipeline, /import\("\.\/VefkWorkshop"\)/);
  assert.match(pipeline, /<VefkWorkshop\/>/);
  assert.match(icons, /case "vefk"/);
  assert.match(workshop, /vefkSaveDraft/);
  assert.match(workshop, /vefkReview/);
  assert.match(workshop, /Geri al/);
  assert.match(workshop, /vefk-editor-model/);
  assert.match(preload, /studio:vefk-save-draft/);
  assert.doesNotMatch(workshop, /publishPublicSnapshot|communityAdmin|http:/);
});

test("S4 keeps the same site renderer, a single Studio timeline and persistent drawPlan on save", () => {
  const read = name => fs.readFileSync(path.join(root, name), "utf8");
  const workshop = read("VefkWorkshop.tsx");
  const dock = read("VefkTimelineEditor.tsx");
  const model = read("vefk-timeline-model.ts");
  const consumer = fs.readFileSync(path.join(root, "../../../docs/contracts/vefk-site-consumer.mjs"), "utf8");
  assert.match(workshop, /<VefkTimelineEditor/);
  const motion = read("vefk-motion-editor.ts");
  assert.match(motion, /drawPlan: reconcileDrawPlan\(doc.geometry, doc.drawPlan, doc.schemaVersion\)/);
  assert.match(workshop, /reconcileDrawPlan\(next.geometry, next.drawPlan, next.schemaVersion\)/);
  assert.match(workshop, /createEditorPreviewPlayer\(working, experimentalCurve\)/);
  assert.match(motion, /createVefkPlayer\(doc\)/);
  assert.match(workshop, /strokeDashoffset=\{timelineFrame/);
  assert.match(dock, /Çizim zaman çizelgesi/);
  assert.match(dock, /Kalem geçişi|kalem geçişi/);
  assert.match(dock, /aria-label="Çizim zamanında ileri geri sar"/);
  assert.match(dock, /requestAnimationFrame/);
  assert.match(model, /export function changeDrawPlan/);
  assert.match(consumer, /phase: "travel"/);
  assert.doesNotMatch(dock, /fetch\(|publishPublicSnapshot|<iframe/);
  assert.doesNotMatch(workshop, /publishPublicSnapshot|communityAdmin|http:/);
});
