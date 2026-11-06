"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const sources = require("./vefk-sources.cjs");
const vision = require("./vefk-vision.cjs");
const client = require("./ai-client.cjs");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=", "base64");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-source-test-"));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  const file = path.join(root, "vefk-source.png");
  fs.writeFileSync(file, PNG);
  const saved = sources.importSource(db, root, file);
  return { db, root, file, saved, close() { db.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}
function analysis() {
  return {
    schema: "vefk.source-analysis.v1", orientation: "rtl", note: "Orijinal kare",
    grid: {
      rows: 2, columns: 2,
      cells: [
        { row: 0, column: 0, text: "6", confidence: 0.99, needsReview: false },
        { row: 0, column: 1, text: "?", confidence: 0.2, needsReview: true },
      ],
    },
    regions: [
      { kind: "grid", box: [20, 40, 850, 840], label: "", confidence: 0.95, needsReview: false },
      { kind: "number", box: [100, 200, 150, 110], label: "6", confidence: 0.9, needsReview: false },
      { kind: "unknown", box: [500, 500, 75, 60], label: "", confidence: 0.2, needsReview: true },
    ],
  };
}

test("local source import deduplicates, hashes and never mutates original bytes", () => {
  const fx = fixture();
  try {
    assert.ok(/^source-[a-f0-9]{32}$/.test(fx.saved.id));
    assert.equal(fx.saved.duplicate, false);
    assert.equal(sources.importSource(fx.db, fx.root, fx.file).duplicate, true);
    assert.equal(sources.listSources(fx.db).length, 1);
    const loaded = sources.loadSource(fx.db, fx.root, fx.saved.id);
    assert.equal(loaded.sha256, fx.saved.sha256);
    assert.equal(Buffer.from(loaded.imageDataUrl.split(",")[1], "base64").equals(PNG), true);
    assert.deepEqual(fs.readFileSync(fx.file), PNG);
    assert.equal(sources.loadSource(fx.db, fx.root, "source-" + "f".repeat(32)), null);
  } finally { fx.close(); }
});

test("source input rejects MIME spoofing, invalid size and identifier paths", () => {
  const fx = fixture();
  try {
    const bad = path.join(fx.root, "fake.png");
    fs.writeFileSync(bad, Buffer.from("invalid file masquerading as image"));
    assert.throws(() => sources.importSource(fx.db, fx.root, bad), /PNG/);
    assert.throws(() => sources.loadSource(fx.db, fx.root, "../etc/passwd"), /kimliği/);
    const huge = path.join(fx.root, "large.png");
    fs.writeFileSync(huge, Buffer.alloc(sources.MAX_BYTES + 1));
    assert.throws(() => sources.importSource(fx.db, fx.root, huge), /12 MB/);
  } finally { fx.close(); }
});

test("normalization preserves uncertainty and fills missing grid cells", () => {
  const data = sources.normalizeAnalysis(analysis());
  assert.equal(data.regions.length, 3);
  assert.equal(data.grid.cells.length, 4);
  assert.equal(data.grid.cells[1].needsReview, true);
  assert.equal(data.grid.cells[3].needsReview, true);
  assert.equal(data.regions[2].needsReview, true);
  assert.equal(data.regions[0].needsReview, true);
  assert.equal(data.orientation, "rtl");
});

test("malformed coordinates and unbounded grid text are rejected", () => {
  const data = analysis();
  data.regions[0].box[2] = 1000;
  assert.throws(() => sources.normalizeAnalysis(data), /dışında/);
  const wrong = analysis();
  wrong.grid.cells.push({ row: 0, column: 0, text: "x", confidence: 1 });
  assert.throws(() => sources.normalizeAnalysis(wrong), /tekrarlanmış/);
});

test("AI output is a proposal; human review appends immutable runs and rejects stale updates", () => {
  const fx = fixture();
  try {
    const ai = sources.appendAnalysis(fx.db, {
      sourceId: fx.saved.id, origin: "ai", provider: "openai-compatible", model: "test-model",
      result: analysis(),
    });
    assert.equal(ai.status, "proposed");
    const updated = structuredClone(ai.result);
    updated.grid.cells[1] = { ...updated.grid.cells[1], text: "8", reviewed: true, needsReview: false };
    const review = sources.appendAnalysis(fx.db, {
      sourceId: fx.saved.id, origin: "review", provider: "openai-compatible", model: "test-model",
      result: updated, expectedAnalysisId: ai.id,
    });
    assert.equal(review.status, "reviewed");
    assert.equal(review.result.grid.cells[1].needsReview, false);
    assert.throws(() => sources.appendAnalysis(fx.db, {
      sourceId: fx.saved.id, origin: "review", provider: "openai-compatible", model: "test-model",
      result: updated, expectedAnalysisId: ai.id,
    }), /güncel değil/);
    assert.ok(review.id > ai.id);
    assert.equal(sources.listSources(fx.db)[0].lastAnalysisId, review.id);
  } finally { fx.close(); }
});

test("vision uses configured AI transport and never accepts its self-assigned reviewed flags", async () => {
  const fx = fixture();
  try {
    fs.writeFileSync(path.join(fx.root, "ai-config.json"), JSON.stringify({
      provider: "openai-compatible", endpoint: "https://vision.local/v1",
      model: "vision-test", apiKey: "dummy",
    }));
    const run = await vision.analyze(fx.db, fx.root, fx.saved.id, {
      transport: async (cfg, messages, options) => {
        assert.equal(cfg.model, "vision-test");
        assert.equal(messages[1].content[1].type, "image_url");
        assert.match(messages[1].content[1].image_url.url, /^data:image\/png;base64,/);
        assert.equal(options.temperature, 0);
        const proposal = analysis();
        proposal.regions[2].reviewed = true;
        return { content: JSON.stringify(proposal), model: "vision-test" };
      },
    });
    assert.equal(run.origin, "ai");
    assert.equal(run.result.regions[2].reviewed, false);
    assert.equal(run.result.regions[2].needsReview, true);
    assert.equal(run.result.grid.cells[1].needsReview, true);
    assert.equal(sources.latestAnalysis(fx.db, fx.saved.id).id, run.id);
  } finally { fx.close(); }
});

test("vision support clearly distinguishes OpenCode text transport and compatible API transport", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-vision-provider-"));
  try {
    fs.writeFileSync(path.join(root, "ai-config.json"), JSON.stringify({
      provider: "opencode-cli", model: "provider/model", apiKey: "dummy",
    }));
    const rejected = vision.support(root);
    assert.equal(rejected.supported, false);
    assert.match(rejected.reason, /metin/);
    fs.writeFileSync(path.join(root, "ai-config.json"), JSON.stringify({
      provider: "openai-compatible", model: "vision-model", endpoint: "https://vision.test/v1",
    }));
    assert.equal(vision.support(root).supported, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Gemini existing AI client transports inline images rather than silently stripping them", async () => {
  const payload = vision.buildMessages("data:image/png;base64," + PNG.toString("base64"));
  let received = false;
  const answer = await client.requestGeminiContent({
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "dummy", model: "gemini-vision-test",
  }, payload, {
    fetcher: async (url, req) => {
      const body = JSON.parse(req.body);
      assert.match(url, /generateContent$/);
      assert.equal(body.contents[0].parts[0].text.includes("Analyze"), true);
      assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/png");
      assert.equal(body.contents[0].parts[1].inlineData.data, PNG.toString("base64"));
      received = true;
      return { ok: true, text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }],
      }) };
    },
  });
  assert.equal(received, true);
  assert.match(answer.content, /"ok"/);
});

test("source trace groups persist as append-only reviewed S1-safe pen paths", () => {
  const { createVefk, validateVefk } = require("./vefk-core/index.cjs");
  const store = require("./vefk-store.cjs");
  const fx=fixture();
  try {
    const initial=sources.appendAnalysis(fx.db,{
      sourceId:fx.saved.id,origin:"ai",provider:"openai-compatible",model:"vision",
      result:analysis(),
    });
    const result=structuredClone(initial.result);
    result.traces=[{
      regionId:"region-002",reviewed:false,
      paths:[{id:"trace.region-002.001",d:"M 110 220 L 130 270 L 195 295"}],
    }];
    const preview=sources.appendAnalysis(fx.db,{
      sourceId:fx.saved.id,origin:"review",provider:"openai-compatible",model:"vision",
      expectedAnalysisId:initial.id,result,
    });
    assert.equal(preview.result.traces.length,1);
    assert.equal(preview.result.traces[0].reviewed,false);
    const accepted=structuredClone(preview.result);
    accepted.traces[0].reviewed=true;
    accepted.regions.forEach(region => { region.reviewed = true; region.kind = region.kind === "unknown" ? "symbol" : region.kind; region.label ||= "İşaret"; });
    accepted.grid.cells.forEach(cell => { cell.reviewed = true; cell.text ||= "Sembol"; });
    const reviewed=sources.appendAnalysis(fx.db,{
      sourceId:fx.saved.id,origin:"review",provider:"openai-compatible",model:"vision",
      expectedAnalysisId:preview.id,result:accepted,
    });
    assert.ok(reviewed.id>preview.id);
    assert.equal(reviewed.result.traces[0].reviewed,true);
    assert.equal(sources.latestAnalysis(fx.db,fx.saved.id).result.traces[0].reviewed,true);
    const paths=reviewed.result.traces.flatMap(t=>t.paths.map(p=>({...p,ink:"trace"})));
    const doc=createVefk({
      id:"source-trace-end-to-end",title:"Kaynak çizgisinden vefk",kind:"manualPaths",
      provenance:{kind:"traditional-reference",references:[fx.saved.id]},
      geometry:{coordinateSpace:"svg-viewBox",viewBox:[0,0,1000,1000],
        paths,inkStyles:{trace:{width:5,cap:"round"}}},
    });
    assert.equal(validateVefk(doc).ok,true);
    store.saveDraft(fx.db,{document:doc, sourceReview: { sourceId: fx.saved.id, analysisId: reviewed.id, method: "traced", partialAccepted: true }});
    const saved=store.getDocument(fx.db,doc.id);
    assert.equal(saved.document.geometry.paths[0].d,paths[0].d);
    assert.equal(saved.document.contentHash,doc.contentHash);
    assert.equal(saved.status,"draft");
  } finally {fx.close();}
});

test("untrusted traced SVG and orphan/duplicate strokes are never stored",()=>{
  const sample=analysis();
  const group={
    regionId:"region-001",reviewed:true,
    paths:[{id:"trace.region-001.001",d:"M 25 50 L 40 60"}],
  };
  const fine=sources.normalizeAnalysis({...sample,traces:[group]});
  assert.equal(fine.traces[0].paths[0].id,group.paths[0].id);
  const script=structuredClone(group);
  script.paths[0].d="M 30 30 L 40 40 onclick=alert(1)";
  assert.throws(()=>sources.normalizeAnalysis({...sample,traces:[script]}),/Unsafe|Malformed/);
  const badId=structuredClone(group);
  badId.paths[0].id="evil";
  assert.throws(()=>sources.normalizeAnalysis({...sample,traces:[badId]}),/kimliği/);
  const escaped=structuredClone(group);
  escaped.paths[0].d="M 25 50 L 900 900";
  assert.throws(()=>sources.normalizeAnalysis({...sample,traces:[escaped]}),/dışına/);
  const orphan=structuredClone(group);
  orphan.regionId="region-250";
  assert.throws(()=>sources.normalizeAnalysis({...sample,traces:[orphan]}),/bölgeye/);
  assert.throws(()=>sources.normalizeAnalysis({...sample,traces:[group,group]}),/bölgeye/);
});
