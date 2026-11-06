"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { repairBox, sanitizeAiAnalysis } = require("./vefk-ai-region-sanitizer.cjs");
const sources = require("./vefk-sources.cjs");
const vision = require("./vefk-vision.cjs");

function region(box, options = {}) {
  return { kind: "symbol", box, label: "mühür", confidence: .95, needsReview: false, ...options };
}
function proposal(regions) {
  return { schema: "vefk.source-analysis.v1", regions, grid: null, note: "AI önerisi" };
}

test("small model overflows are clipped to 0..1000 and forced into review", () => {
  const result = sources.normalizeAnalysis(sanitizeAiAnalysis(proposal([
    region([988, 20, 20, 70]), region([-8, 890, 68, 125]), region([10, 20, 100, 110]),
  ])));
  assert.deepEqual(result.regions[0].box, [988, 20, 12, 70]);
  assert.deepEqual(result.regions[1].box, [0, 890, 60, 110]);
  assert.equal(result.regions[0].needsReview, true);
  assert.equal(result.regions[0].reviewed, false);
  assert.equal(result.regions[0].confidence, .5);
  assert.equal(result.coordinateWarnings.length, 2);
  assert.deepEqual(result.coordinateWarnings[0].originalBox, [988, 20, 20, 70]);
  assert.equal(result.coordinateWarnings[0].regionIndex, 1);
  assert.equal(result.regions[2].needsReview, true);
  assert.match(result.note, /2 kutu sınırda düzeltildi/);
});

test("one very wrong Gemini box is omitted without dropping a valid region or grid", () => {
  const cleaned = sanitizeAiAnalysis({
    ...proposal([region([20, 30, 100, 100]), region([910, 100, 300, 700]),
      region([-200, -100, 10, 50]), region([70, 40, 90, 90])]),
    grid: { rows: 2, columns: 2, cells: [{ row: 0, column: 0, text: "٥", confidence: .95 }] },
  });
  const data = sources.normalizeAnalysis(cleaned);
  assert.equal(data.regions.length, 2);
  assert.equal(data.grid.cells[0].text, "٥");
  assert.equal(data.coordinateWarnings.length, 2);
  assert.equal(data.coordinateWarnings[0].action, "skipped");
  assert.deepEqual(data.coordinateWarnings[0].originalBox, [910, 100, 300, 700]);
  assert.match(data.coordinateWarnings[0].reason, /biçimi belirsiz/);
  assert.match(data.note, /2 kutu atlandı/);
});

test("malformed boxes, unknown kinds and nonnumeric confidence become explicit uncertain proposals", () => {
  const normalized = sources.normalizeAnalysis(sanitizeAiAnalysis(proposal([
    region([1, 2, "NaN", 20]),
    region([20, 20, 40, 50], { kind: "planetaryGlyph", confidence: "high" }),
    region([12, 22, 0, 15]),
    region([22, 33, 15, 16], { confidence: 1, label: "known" }),
  ])));
  assert.equal(normalized.regions.length, 2);
  assert.equal(normalized.regions[0].kind, "unknown");
  assert.equal(normalized.regions[0].needsReview, true);
  assert.equal(normalized.regions[0].confidence, 0);
  assert.equal(normalized.regions[1].confidence, 1);
  assert.equal(normalized.coordinateWarnings.filter(w => w.action === "skipped").length, 2);
  assert.equal(normalized.coordinateWarnings.filter(w => w.action === "kind-unknown").length, 1);
});

test("strict source/review validation is NOT weakened", () => {
  assert.throws(() => sources.normalizeAnalysis(proposal([
    region([995, 100, 20, 30]),
  ])), /Bölge görsel koordinatları dışında/);
  assert.deepEqual(repairBox([980, 980, 21, 21]).box, [980, 980, 20, 20]);
  assert.equal(repairBox([1200, 30, 30, 30]).action, "skipped");
  assert.throws(() => sanitizeAiAnalysis({ regions: new Array(251).fill(region([1, 2, 3, 4])) }), /250/);
});

test("AI proposal with no usable boxes can still be saved for manual area selection", () => {
  const data = sources.normalizeAnalysis(sanitizeAiAnalysis(proposal([
    region([1400, 1400, 30, 30]), region([20, 30, -5, 10]),
  ])));
  assert.equal(data.regions.length, 0);
  assert.equal(data.coordinateWarnings.length, 2);
  assert.equal(data.grid, null);
});

test("end-to-end mocked Gemini: recovery details survive SQLite and human-review revisions", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-box-fix-"));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON;");
  try {
    const file = path.join(root, "manuscript.png");
    fs.writeFileSync(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=", "base64"));
    const source = sources.importSource(db, root, file);
    fs.writeFileSync(path.join(root, "ai-config.json"), JSON.stringify({
      provider: "openai-compatible", endpoint: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-test-model", apiKey: "dummy",
    }));
    const result = await vision.analyze(db, root, source.id, {
      transport: async (_config, messages) => {
        assert.equal(messages[1].content[1].type, "image_url");
        return { model: "gemini-test-model", content: JSON.stringify(proposal([
          region([990, 50, 23, 70], { reviewed: true }),
          region([100, 100, 200, 210]),
          region([600, 500, 900, 900]),
        ])) };
      },
    });
    assert.equal(result.status, "proposed");
    assert.equal(result.result.regions.length, 2);
    assert.equal(result.result.regions[0].needsReview, true);
    assert.equal(result.result.regions[0].reviewed, false);
    assert.equal(result.result.coordinateWarnings.length, 2);
    const stored = sources.latestAnalysis(db, source.id);
    assert.deepEqual(stored.result.coordinateWarnings, result.result.coordinateWarnings);
    const reviewed = structuredClone(stored.result);
    reviewed.regions[0].reviewed = true;
    reviewed.regions[0].needsReview = false;
    const savedReview = sources.appendAnalysis(db, {
      sourceId: source.id, origin: "review", provider: stored.provider,
      model: stored.model, result: reviewed, expectedAnalysisId: stored.id,
    });
    assert.equal(savedReview.status, "reviewed");
    assert.equal(savedReview.result.regions[0].reviewed, true);
    assert.equal(savedReview.result.coordinateWarnings.length, 2);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("prompt specifies xywh rather than coordinate corners", () => {
  assert.match(vision.SYSTEM_PROMPT, /LEFT, TOP, WIDTH, HEIGHT/);
  assert.match(vision.SYSTEM_PROMPT, /x\+width <= 1000/);
});
