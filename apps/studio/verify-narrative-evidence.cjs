"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { deriveEvidenceLedger } = require("./narrative-evidence-ledger.cjs");
const service = require("./narrative-service.cjs"), store = require("./narrative-store.cjs");
const quality = require("./narrative-quality.cjs"), generation = require("./narrative-ai-generation.cjs");
const { createFixture, permission, videos } = require("./tests/fixtures/narrative-evidence.cjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "narrative-evidence-"));
const connections = [];
const digest = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rows = db => ["narrative_runs", "narrative_run_sources", "narrative_sections", "narrative_section_revisions", "universe_workspace_nodes"].map(table => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all());
try {
  const a = createFixture(root); connections.push(a.db);
  const b = createFixture(root, "other-channel", "Autre canal"); connections.push(b.db);
  assert.equal(a.runId, 6);
  const originalRows = rows(a.db), frozenRequest = service.buildRequest(a.db, a.runId);
  const snapshot = store.runSourceMap(a.db, a.runId), serializedSnapshot = JSON.stringify([...snapshot]);
  const ledger = deriveEvidenceLedger(snapshot, ["story", "summary", "story", "missing"]);
  assert.equal(ledger.recordCount, 2); assert.equal(ledger.videoCount, 4);
  assert.deepEqual(ledger.missingSourceKeys, ["missing"]);
  const story = ledger.nodes.find(node => node.sourceKey === "story");
  assert.deepEqual(story.sourceVideoIds, videos);
  assert.equal(story.evidence.find(entry => entry.text === permission).kind, "detail");
  assert.deepEqual(story.evidence.find(entry => entry.text === permission).sourceVideoIds, ["I8ec5jhbTH4"], "Permission is actual fixture evidence, not a hallucination assumption");
  assert.deepEqual(story.evidence.filter(entry => entry.kind === "sequence").map(entry => entry.sourceVideoIds), [[videos[1]], [videos[0]]]);
  assert.deepEqual(story.evidence.at(-1).sourceVideoIds, [], "Never fill missing detail IDs from coarse node provenance");
  assert.deepEqual(ledger.nodes.find(node => node.sourceKey === "summary").evidence, []);
  assert.doesNotMatch(JSON.stringify(ledger), /OLAY DEĞİLDİR|TASLAĞA AİT OLMAYAN/);
  assert.equal(JSON.stringify([...snapshot]), serializedSnapshot, "Pure derivation must not mutate frozen sources");
  assert.deepEqual(deriveEvidenceLedger(frozenRequest.input.allowedSources, ["story", "summary", "missing"]), ledger);
  const detail = { text: "Ayrıntı", sourceVideoIds: ["v1", "", "v1", null, {}] };
  const dirty = { sourceType: "node", sourceKey: "dirty", snapshot: JSON.stringify({ kind: "story", payload: JSON.stringify({ details: [detail, detail, {}, null, "unsupported legacy text", { text: " " }], sequence: "{broken" }) }), sourceVideoIds: ["v1", "v1", {}, ""] };
  const clean = deriveEvidenceLedger([null, "broken", dirty, dirty, { sourceType: "relation", sourceKey: "rel" }], ["dirty", "dirty"]);
  assert.equal(clean.recordCount, 1); assert.equal(clean.videoCount, 1);
  assert.deepEqual(clean.nodes[0].evidence, [{ kind: "detail", ...detail, sourceVideoIds: ["v1"] }]);
  assert.equal(deriveEvidenceLedger([{ sourceType: "node", sourceKey: "bad", snapshot: "{broken" }], ["bad"]).nodes[0].evidence.length, 0);
  assert.equal(deriveEvidenceLedger("{broken", "{broken").recordCount, 0);
  assert.equal(deriveEvidenceLedger(snapshot, []).recordCount, 0);
  const exactOnly = deriveEvidenceLedger([{ sourceType: "node", sourceKey: "exact-only", sourceVideoIds: ["general"], kind: "story", payload: {
    details: [{ text: "Aynı metin", sourceVideoIds: ["specific-a"] }, { text: "Aynı metin", sourceVideoIds: ["specific-b"] }],
  } }], ["exact-only"]);
  assert.equal(exactOnly.videoCount, 3);
  assert.deepEqual(exactOnly.nodes[0].evidence.map(entry => entry.sourceVideoIds), [["specific-a"], ["specific-b"]], "Do not discard distinct attributions or constrain them to the coarse video list");

  const detailA = service.getRun(a.db, a.runId);
  assert.deepEqual(detailA.drafts.map(draft => draft.evidenceLedger.nodes.map(node => node.sourceKey)), [["story"], ["summary"], ["owner", "story"]]);
  assert.equal(detailA.drafts[0].body, permission);
  assert.ok(detailA.drafts[0].qualityNotes.some(note => note.code === "cross_video"));
  assert.ok(detailA.drafts[0].qualityNotes.every(note => !/hallucinat|uydurma/i.test(note.code + note.message)));
  assert.equal(service.getRun(b.db, b.runId).drafts[0].evidenceLedger.nodes[0].name, "Autre canal");
  assert.equal(service.getRun(a.db, a.runId).drafts[0].evidenceLedger.nodes[0].name, "Mor sıvı kaydı");
  assert.deepEqual(rows(a.db), originalRows, "Editor detail/status derivation cannot alter stored run, sources or three drafts");
  assert.equal(JSON.stringify(service.buildRequest(a.db, a.runId)), JSON.stringify(frozenRequest));
  assert.equal(detailA.run.inputFingerprint, a.prepared.run.inputFingerprint);
  assert.equal(JSON.stringify(frozenRequest).includes("evidenceLedger"), false);

  const review = body => quality.analyzeDraft({ body, sourceKeys: ["story"], sourceVideoIds: videos }).filter(note => note.code === "editorial_source_report");
  for (const body of ["Bu geçişin nasıl gerçekleştiğine dair kaynakta bundan fazla ayrıntı yer almıyor.", "Kaynakta daha fazla ayrıntı yok.", "Bu bilgilerin anlatıcı tarafından izleyicilere aktarıldığı belirtilmiştir.", "Kaynakta açıklanmamaktadır."]) {
    assert.equal(review(body).length, 1, body); assert.equal(review(body)[0].severity, "warning");
  }
  for (const body of [permission, "Ne olduğunu bilmiyordum.", "Olayın tarihi bilinmiyor.", "Kaynağa göre o gece gitmiş.", "“Kaynakta açıklanmamaktadır” diye yazmıştı.", "'Kaynakta daha fazla ayrıntı yok' dedi.", "«Kaynakta bundan fazla ayrıntı yer almıyor» cümlesini okudum.", '"Bu bilgilerin anlatıcı tarafından izleyicilere aktarıldığı belirtilmiştir" ifadesini alıntıladım.', "— Kaynakta açıklanmamaktadır."]) assert.equal(review(body).length, 0, body);
  const prompt = generation.buildMessages(frozenRequest);
  for (const pattern of [/Okuyucu paragrafına editoryal kaynak raporu koyma/, /olay gerçekten belirsizse/, /yalnız aynı öğenin sourceVideoIds/, /visual, attributes, prompt ve negativePrompt olay kanıtı değildir/, /sourceEntityKeys/, /mapped ID/, /Paragraf, sözcük veya uzunluk kotası yoktur/, /ortak bir sahne kurma/]) assert.match(prompt[0].content, pattern);
  assert.equal(prompt[1].content, `INPUT_JSON:\n${JSON.stringify(frozenRequest)}`);

  // Both historical policies: repeated editor reads leave frozen request bytes,
  // input fingerprints, references and persisted data exactly unchanged.
  const compatibility = {};
  for (const policy of ["narrative-records-v2", "narrative-records-v1"]) {
    if (policy.endsWith("v1")) {
      const input = { ...detailA.run.input, evidencePolicy: policy };
      delete input.narratorSourceEntities; input.narrator = { ...input.narrator }; delete input.narrator.sourceEntityKeys;
      a.db.prepare("UPDATE narrative_runs SET input_json=? WHERE id=?").run(JSON.stringify(input), a.runId);
    }
    const before = rows(a.db), request = service.buildRequest(a.db, a.runId), bytes = JSON.stringify(request);
    service.status(a.db); service.getRun(a.db, a.runId); service.runDrafts(a.db, a.runId);
    assert.equal(JSON.stringify(service.buildRequest(a.db, a.runId)), bytes);
    assert.deepEqual(rows(a.db), before);
    compatibility[policy] = digest(request);
  }
  // Request hashes are pinned against the pre-4.3 contract using this fixture.
  // See the evidence report for the independent baseline comparison.
  assert.deepEqual(compatibility, {
    "narrative-records-v2": "8839e832c182b5043eb2aa35199978774a31fb004f0a693f1077f5da90a79cf7",
    "narrative-records-v1": "951253ca6f0bba9a73da0d6ca98a12e3ecc3001db24e87ca1ddc1f848b16ff5a",
  });

  // Stale review still uses run snapshots after live approved content changes.
  a.db.prepare("UPDATE universe_workspace_nodes SET summary='CHANGED LIVE',payload_json='{}' WHERE key='story'").run();
  const stale = service.getRun(a.db, a.runId);
  assert.equal(stale.request, null);
  assert.equal(stale.drafts[0].evidenceLedger.nodes[0].evidence.find(entry => entry.text === permission).sourceVideoIds[0], videos[0]);
  assert.equal(stale.drafts[0].body, permission);
  assert.equal(stale.drafts.length, 3);
  assert.equal(service.status(a.db).counts.applied, 0);
  console.log("PASS Stage4.3 evidence granularity, permission detail fixture, malformed/duplicate inputs, channel isolation, frozen v1/v2 compatibility, report warnings and quote/uncertainty false positives (memory/tmp only)");
} finally {
  for (const db of connections) db.close();
  fs.rmSync(root, { recursive: true, force: true });
}
