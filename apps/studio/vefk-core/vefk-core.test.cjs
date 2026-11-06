"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  createVefk, validateVefk, serializeVefk, parseVefk, documentHash,
  siameseSquare, magicSquareChecks, squareGeometry, normalizeGeometry,
  geometrySvg, validateDrawPlan, drawPlanFor, progressAt, canonicalString,
  SCHEMA_VERSION, easedProgress,
} = require("./index.cjs");

function magic(order = 3, overrides = {}) {
  return createVefk({
    id: `vefk-${order}`,
    revision: 1,
    title: "Example square",
    kind: "magicSquare",
    parameters: { order, first: 1, step: 1 },
    ...overrides,
  });
}

function plain(value) { return structuredClone(value); }
function alteration(fn, source = magic()) {
  const copy = plain(source);
  fn(copy);
  return copy;
}
function freePathGeometry() {
  return {
    coordinateSpace: "svg-viewBox", viewBox: [0, 0, 100, 100],
    paths: [
      { id: "symbol.outer", ink: "glyph", d: "M 10 10 L 90 10 L 90 90 L 10 90 Z" },
      { id: "symbol.diagonal", ink: "glyph", d: "M 10 10 L 90 90" },
    ],
    inkStyles: { glyph: { width: 3, cap: "round" } },
  };
}

test("S4a v2 is explicit, immutable and canonically hashed; v1 remains the default", () => {
  const v1 = magic(), v2 = magic(3, { schemaVersion: 2 });
  assert.equal(SCHEMA_VERSION, 1);
  assert.equal(v1.schemaVersion, 1);
  assert.ok(v1.drawPlan.strokes.every(stroke => !Object.hasOwn(stroke, "easing")));
  assert.equal(v2.schemaVersion, 2);
  assert.ok(v2.drawPlan.strokes.every(stroke => stroke.easing === "linear"));
  assert.ok(Object.isFrozen(v2) && Object.isFrozen(v2.drawPlan.strokes[0]));
  assert.notEqual(v1.contentHash, v2.contentHash);
  assert.equal(validateVefk(v2).ok, true);
  assert.throws(() => serializeVefk(v2), /explicit matching schema/);
  assert.equal(serializeVefk(parseVefk(serializeVefk(v2, 2)), 2), serializeVefk(v2, 2));
  assert.throws(() => serializeVefk(v1, 2), /explicit matching schema/);
  assert.throws(() => serializeVefk(v2, "2"), /explicit matching schema/);
  assert.deepEqual(validateDrawPlan(v1.drawPlan, v1.geometry), v1.drawPlan);
  assert.throws(() => validateDrawPlan(v2.drawPlan, v2.geometry), /Unknown stroke field/);
  assert.deepEqual(drawPlanFor(v1.geometry), v1.drawPlan);
  for (const schemaVersion of [0, 3, "2", null, undefined, true]) {
    assert.throws(() => magic(3, { schemaVersion }), /schema/);
    const doc = plain(v2); doc.schemaVersion = schemaVersion; doc.contentHash = documentHash(doc);
    assert.throws(() => validateVefk(doc), /schema/);
  }
});

test("S4a only v2 strokes allow the exact easing enum, with omission meaning linear", () => {
  const base = magic(3, { schemaVersion: 2 });
  for (const easing of ["linear", "ease-in", "ease-out", "ease-in-out"]) {
    const doc = plain(base); doc.drawPlan.strokes[0].easing = easing;
    doc.contentHash = documentHash(doc);
    assert.equal(validateVefk(doc).ok, true);
    assert.notEqual(documentHash({ ...doc, schemaVersion: 1 }), doc.contentHash);
    assert.equal(progressAt(doc.drawPlan, 350, 2)[0].fraction, easedProgress(.5, easing));
    doc.schemaVersion = 1; doc.contentHash = documentHash(doc);
    assert.throws(() => validateVefk(doc), /Unknown stroke field/);
  }
  const omitted = plain(base); delete omitted.drawPlan.strokes[0].easing;
  omitted.contentHash = documentHash(omitted);
  assert.equal(validateVefk(omitted).ok, true);
  assert.deepEqual(createVefk({id: omitted.id, title: omitted.title, schemaVersion: 2,
    drawPlan: omitted.drawPlan}).drawPlan, omitted.drawPlan);
  for (const easing of ["ease", "LINEAR", " linear", "", null, undefined, 0, false, ["linear"], {}]) {
    const doc = plain(base); doc.drawPlan.strokes[0].easing = easing;
    doc.contentHash = documentHash(doc);
    assert.throws(() => validateVefk(doc), /easing/);
    assert.throws(() => createVefk({id: doc.id, title: doc.title, schemaVersion: 2,
      drawPlan: doc.drawPlan}), /easing/);
  }
  for (const mutate of [
    d => { d.easing = "linear"; },
    d => { d.drawPlan.easing = "linear"; },
    d => { d.drawPlan.strokes[0].curve = "linear"; },
    d => { d.drawPlan.markers[0].easing = "linear"; },
  ]) {
    const doc = plain(base); mutate(doc); doc.contentHash = documentHash(doc);
    assert.throws(() => validateVefk(doc));
  }
  const tampered = plain(base); tampered.drawPlan.strokes[0].easing = "ease-in";
  assert.throws(() => validateVefk(tampered), /contentHash/);
});

test("Siamese 3×3 orientation matches the independently authored fixture", () => {
  assert.deepEqual(siameseSquare({ order: 3 }), [[6, 1, 8], [7, 5, 3], [2, 9, 4]]);
  assert.equal(magicSquareChecks(siameseSquare({ order: 3 }), { order: 3 }).expectedSum, 15);
});

for (const [order, expected] of [[3, 15], [5, 65], [7, 175]]) {
  test(`${order}×${order} square: sums, geometry, strokes, immutability`, () => {
    const document = magic(order);
    assert.equal(document.construction.checks.expectedSum, expected);
    assert.equal(document.construction.checks.passed, true);
    assert.deepEqual(document.construction.checks.rowSums, Array(order).fill(expected));
    assert.deepEqual(document.construction.checks.columnSums, Array(order).fill(expected));
    assert.deepEqual(document.construction.checks.diagonalSums, [expected, expected]);
    assert.equal(new Set(document.construction.grid.flat()).size, order * order);
    assert.equal(document.geometry.paths.length, 1 + 2 * (order - 1) + order * order);
    assert.equal(document.drawPlan.strokes.length, document.geometry.paths.length);
    assert.equal(validateVefk(document).ok, true);
    assert.ok(Object.isFrozen(document.geometry.paths[0]));
    assert.match(geometrySvg(document.geometry), /^<svg /);
  });
}

test("Parameter variants: positive/negative step and a non-unit first", () => {
  const pos = magic(3, { parameters: { order: 3, first: 11, step: 3 } });
  assert.deepEqual(pos.construction.grid, [[26, 11, 32], [29, 23, 17], [14, 35, 20]]);
  assert.equal(pos.construction.checks.expectedSum, 69);
  const neg = magic(3, { parameters: { order: 3, first: 50, step: -2 } });
  assert.equal(neg.construction.checks.expectedSum, 126);
  assert.equal(neg.construction.checks.passed, true);
});

test("Invalid order, step and unsafe numeric values fail without truncation", () => {
  for (const parameters of [
    { order: 2 }, { order: 9 }, { order: 3, step: 0 },
    { order: 3, first: Number.MAX_SAFE_INTEGER }, { order: 3, first: 1.5 },
    { order: 5, step: Infinity }, { order: 3, step: "2" },
  ]) assert.throws(() => magic(3, { parameters }), /./);
});

test("Manual numeric square does not pretend to be a mathematically valid magic square", () => {
  const grid = [[0, 1, 2], [3, 4, 5], [-6, -7, -8]];
  const doc = createVefk({ id: "manual-square", title: "Manual arrangement",
    kind: "manualSquare", grid });
  assert.deepEqual(doc.construction.grid, grid);
  assert.deepEqual(doc.construction.checks, { passed: true, verification: "structure-only" });
  assert.equal(doc.geometry.paths.find(p => p.id === "cell.r2c0").semanticValue, "-6");
  assert.equal(validateVefk(doc).ok, true);
});

test("Manual SVG-path construction is independent of a numeric grid and uses safe M/L/Z", () => {
  const doc = createVefk({
    id: "manual-symbol", title: "Free geometry", kind: "manualPaths",
    geometry: freePathGeometry(), provenance: {
      kind: "traditional-reference", references: ["local-reference"], notes: "Manually reconstructed",
    },
  });
  assert.equal(doc.construction.kind, "manualPaths");
  assert.equal(doc.geometry.paths.length, 2);
  assert.equal(doc.drawPlan.strokes.length, 2);
  assert.equal(doc.provenance.kind, "traditional-reference");
  assert.equal(validateVefk(doc).ok, true);
  assert.match(geometrySvg(doc.geometry), /symbol.diagonal/);
});

test("Canonical document and hash are deterministic; transient input has no effect", () => {
  const a = magic(5, { generatedAt: "2026-11-03T12:00:00Z", editorState: { zoom: 10 } });
  const b = magic(5, { generatedAt: "2039-10-01T12:00:00Z", editorState: { zoom: 1 } });
  assert.equal(a.contentHash, b.contentHash);
  assert.equal(serializeVefk(a), serializeVefk(b));
  assert.equal(documentHash(a), a.contentHash);
  assert.equal(magic(5, { title: "A different title" }).contentHash === a.contentHash, false);
});

test("Serialization is stable across JSON round trips, including JSON key ordering", () => {
  const original = magic();
  const decoded = parseVefk(serializeVefk(original));
  assert.equal(decoded.contentHash, original.contentHash);
  assert.equal(serializeVefk(decoded), serializeVefk(original));
  assert.equal(canonicalString({ b: 2, a: 1 }), canonicalString({ a: 1, b: 2 }));
});

test("Independent example document from planning phase validates unchanged", () => {
  const fixture = path.resolve(__dirname, "../../../docs/contracts/vefk-v1.example.json");
  const doc = parseVefk(fs.readFileSync(fixture, "utf8"));
  assert.equal(doc.construction.checks.expectedSum, 15);
  assert.equal(doc.geometry.paths.length, 14);
  assert.equal(doc.drawPlan.strokes.length, 14);
});

test("Changing a matrix cell, checks or algorithm version is rejected", () => {
  assert.throws(() => validateVefk(alteration(doc => { doc.construction.grid[0][0] = 7; })), /./);
  assert.throws(() => validateVefk(alteration(doc => { doc.construction.checks.expectedSum = 99; })), /./);
  assert.throws(() => validateVefk(alteration(doc => { doc.construction.algorithmVersion = "2"; })), /./);
});

test("Missing/duplicate IDs, inaccurate semantics or out-of-bounds coordinates fail", () => {
  assert.throws(() => validateVefk(alteration(doc => { doc.geometry.paths[1].id = "grid.outer"; })), /duplicate/i);
  assert.throws(() => validateVefk(alteration(doc => { doc.geometry.paths[5].semanticValue = "123"; })), /Grid cell/);
  assert.throws(() => validateVefk(alteration(doc => { doc.geometry.paths.shift(); })), /./);
  assert.throws(() => validateVefk(alteration(doc => { doc.geometry.paths[0].d = "M 0 0 L 1200 0"; })), /viewBox/);
  assert.throws(() => validateVefk(alteration(doc => { doc.geometry.viewBox[2] = Infinity; })), /finite/);
});

test("Unsafe SVG source, invalid path syntax and script injection fail", () => {
  for (const d of [
    "M 0 0 L 2 2 <script>alert(1)</script>",
    "M 0 0 C 3 3 4 4 8 8",
    "M 0 0 L NaN 5",
    "M 0 0 L 0 0 onload=alert(1)",
    "L 0 0", "M 1 1", "M 0 0 L 10",
  ]) assert.throws(() => normalizeGeometry({
    ...freePathGeometry(),
    paths: [{ id: "shape", ink: "glyph", d }],
  }), /./);
  assert.throws(() => normalizeGeometry({
    ...freePathGeometry(),
    paths: [{ id: "shape", ink: "glyph", d: "M 0 0 L 1 1", script: "alert(1)" }],
  }), /Unsupported/);
});

test("Timeline rejects overlap, invalid duration, duplicate or unknown path IDs", () => {
  assert.throws(() => validateVefk(alteration(doc => { doc.drawPlan.strokes[1].startMs = 0; })), /overlap/);
  assert.throws(() => validateVefk(alteration(doc => { doc.drawPlan.strokes[0].durationMs = -1; })), /milliseconds/);
  assert.throws(() => validateVefk(alteration(doc => { doc.drawPlan.strokes[1].pathId = "missing.path"; })), /pathId/);
  assert.throws(() => validateVefk(alteration(doc => { doc.drawPlan.strokes[1].pathId = "grid.outer"; })), /repeated pathId/);
  assert.throws(() => validateVefk(alteration(doc => { doc.drawPlan.durationMs = 1; })), /duration/);
  assert.throws(() => validateVefk(alteration(doc => { doc.drawPlan.markers[1].atMs = -1; })), /milliseconds/);
});

test("Seek/rewind uses a pure fraction of relative time and is repeatable", () => {
  const doc = magic();
  const start = progressAt(doc.drawPlan, 0);
  const mid = progressAt(doc.drawPlan, 500);
  const end = progressAt(doc.drawPlan, doc.drawPlan.durationMs);
  assert.equal(start[0].fraction, 0);
  assert.ok(mid[0].fraction > 0 && mid[0].fraction < 1);
  assert.ok(end.every(s => s.fraction === 1));
  assert.deepEqual(progressAt(doc.drawPlan, 500), mid);
  assert.deepEqual(progressAt(doc.drawPlan, 0), start);
  assert.throws(() => progressAt(doc.drawPlan, NaN), /finite/);
});

test("Hash mismatch is rejected and generatedAt is deliberately excluded from hash", () => {
  assert.throws(() => validateVefk(alteration(doc => { doc.title = "Tampered"; })), /contentHash mismatch/);
  const doc = magic();
  const copy = plain(doc);
  copy.generatedAt = "2026-11-03T00:00:00Z";
  assert.equal(documentHash(copy), doc.contentHash);
  assert.equal(validateVefk(copy).ok, true);
  copy.generatedAt = "invalid";
  assert.throws(() => validateVefk(copy), /generatedAt/);
});

test("BigInt intermediates preserve mathematically valid large safe-integer squares", () => {
  const document = magic(7, {
    parameters: { order: 7, first: -8400000000000000, step: 350000000000000 },
  });
  assert.equal(document.construction.checks.expectedSum, 0);
  assert.equal(document.construction.checks.passed, true);
  assert.equal(validateVefk(document).ok, true);
  assert.equal(document.geometry.paths.length, 62);
});

test("Duplicate manual paths and invalid style keys are rejected early", () => {
  const geometry = freePathGeometry();
  geometry.paths[1].id = "symbol.outer";
  assert.throws(() => createVefk({ id: "symbol", title: "Symbol", kind: "manualPaths", geometry }), /duplicate/);
  const other = freePathGeometry();
  other.inkStyles.glyph.width = -1;
  assert.throws(() => createVefk({ id: "symbol", title: "Symbol", kind: "manualPaths", geometry: other }), /finite/);
});
