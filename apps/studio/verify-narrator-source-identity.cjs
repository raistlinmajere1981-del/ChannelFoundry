"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const projects = require("./channel-projects.cjs");
const workspace = require("./universe-workspace.cjs");
const store = require("./narrative-store.cjs");
const service = require("./narrative-service.cjs");
const quality = require("./narrative-quality.cjs");
const { buildMessages } = require("./narrative-ai-generation.cjs");
const { POLICY, LEGACY_POLICY } = require("./narrative-evidence.cjs");
const { resolveSourceEntities } = require("./narrator-source-identity.cjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "narrator-identity-"));
const connections = [];
const owner = "universe-character-096793ce1a67a7", announcer = "universe-character-2801a15b283310";
const profile = { displayName: "Ömer", mode: "source_bound_first_person", editorialNote: "", sourceEntityKeys: [] };
function open(id) {
  projects.createProject({ id, displayName: id, narrator: profile }, root);
  const db = new DatabaseSync(":memory:"); connections.push(db);
  workspace.ensureSchema(db); projects.bindDatabaseProject(db, id, root);
  const insert = db.prepare(`INSERT INTO universe_workspace_nodes
    (key,run_id,kind,name,summary,source_video_ids_json,state) VALUES(?,1,?,?,?,'["video-1"]',?)`);
  insert.run(owner, "character", id === "alpha" ? "Ömer" : "Başka kanaldaki kişi", "Kaynakta kapıya gitti.", "approved");
  insert.run(announcer, "character", "Anlatıcı", "Bir başkasının aktardığı iddia.", "approved");
  insert.run("story", "story", "Ömer", "Ayrı bir olay kaydı.", "approved");
  insert.run("draft-person", "character", "Taslak kişi", "Henüz onaylanmadı.", "draft");
  return db;
}
function response(body, blocks) {
  return { contractVersion: 1, sections: [{ order: 0, title: "Günlük", sourceKeys: [owner, announcer, "story"],
    blocks: blocks ?? [{ type: "paragraph", spans: [{ type: "text", text: body }] }], media: [], retire: false }] };
}
const paragraph = spans => [{ type: "paragraph", spans }];
try {
  const a = open("alpha"), b = open("bravo"); projects.setActiveProject("alpha", root);
  const handlers = new Map(); let liveDb = a;
  projects.registerChannelProjectIpc({ handle: (key, fn) => handlers.set(key, fn) }, {
    database: () => liveDb, refreshMainWindow() {}, workersBusy: () => false,
  }, { projectRoot: root, onSelect() {} });
  const call = (name, input) => handlers.get("studio:" + name)({}, input);
  const beforeNodes = a.prepare("SELECT * FROM universe_workspace_nodes ORDER BY key").all();
  const options = call("channel-narrator-sources", { id: "alpha" });
  assert.deepEqual(options.map(source => source.name).sort(), ["Anlatıcı", "Ömer"]);
  assert.deepEqual(projects.readProject("alpha", root).narrator.sourceEntityKeys, [], "Names must never auto-map either identity");
  b.prepare("INSERT INTO universe_workspace_nodes(key,run_id,kind,name,state) VALUES('bravo-only',1,'character','Yalnız ikinci kanalda','approved')").run();
  assert.throws(() => call("channel-project-update", { id: "alpha", narrator: { sourceEntityKeys: ["bravo-only"] } }), /çözümlenemiyor/);
  assert.throws(() => call("channel-narrator-sources", { id: "bravo" }), /kanalı aç/);
  liveDb = b;
  assert.throws(() => call("channel-narrator-sources", { id: "alpha" }), /veritabanı/);
  assert.throws(() => call("channel-project-update", { id: "alpha", narrator: { sourceEntityKeys: [owner] } }), /veritabanı/);
  liveDb = a;
  for (const bad of ["missing", "story", "draft-person", "relation-key"]) {
    assert.throws(() => call("channel-project-update", { id: "alpha", narrator: { sourceEntityKeys: [bad] } }), /çözümlenemiyor/);
  }
  for (const bad of [null, "owner", [7], [""], ["x".repeat(221)]]) {
    assert.throws(() => projects.normalizeNarrator({ sourceEntityKeys: bad }), /kaynak kimlikleri/);
  }
  const unmapped = service.prepare(a);
  assert.deepEqual(unmapped.request.input.narratorSourceEntities, []);

  // Synthetic historical #5 with exactly five pending third-person drafts.
  // No production DB is opened; no historical input is migrated on read.
  const historicalInput = structuredClone(unmapped.run.input);
  historicalInput.evidencePolicy = LEGACY_POLICY;
  delete historicalInput.narratorSourceEntities; delete historicalInput.narrator.sourceEntityKeys;
  a.prepare(`INSERT INTO narrative_runs(id,state,baseline_run_id,universe_fingerprint,input_fingerprint,input_json,model)
    VALUES(5,'prepared',NULL,?,?,?,'historical-fixture')`).run(unmapped.run.universeFingerprint, "historical-fingerprint", JSON.stringify(historicalInput));
  a.prepare(`INSERT INTO narrative_run_sources(run_id,source_type,source_key,change_kind,is_current,source_fingerprint,source_video_ids_json,snapshot_json)
    SELECT 5,source_type,source_key,change_kind,is_current,source_fingerprint,source_video_ids_json,snapshot_json FROM narrative_run_sources WHERE run_id=?`).run(unmapped.run.id);
  store.saveDraftSections(a, 5, Array.from({ length: 5 }, (_, index) => ({ key: "historical-" + index, title: "Eski taslak " + index,
    body: "Ömer kapıya gitti.", sourceKeys: [owner], position: index })));
  const historicalRequest = service.buildRequest(a, 5);
  const historicalRows = JSON.stringify(a.prepare("SELECT * FROM narrative_runs WHERE id=5").get());
  const historicalDrafts = JSON.stringify(a.prepare("SELECT * FROM narrative_section_revisions WHERE run_id=5 ORDER BY id").all());
  assert.equal(historicalRequest.input.evidencePolicy, LEGACY_POLICY);
  assert.equal(Object.hasOwn(historicalRequest.input, "narratorSourceEntities"), false);
  assert.equal(Object.hasOwn(historicalRequest.input.narrator, "sourceEntityKeys"), false);
  assert.ok(quality.inlineReferenceFindings(paragraph([{ type: "text", text: "Kaynakta " }, { type: "reference", entityId: announcer, label: "Anlatıcı" }, { type: "text", text: " aktardı." }]), historicalInput.narrator, LEGACY_POLICY).some(note => note.severity === "blocker"), "Historical v1 reference gate remains active");
  assert.equal(service.getRun(a, 5).drafts.length, 5);
  assert.ok(service.getRun(a, 5).drafts.every(draft => draft.state === "draft"));
  assert.match(buildMessages(historicalRequest)[0].content, /varsayılan özne olarak Anlatıcı, sunucu/);

  call("channel-project-update", { id: "alpha", narrator: { sourceEntityKeys: [owner, announcer, owner] } });
  assert.deepEqual(projects.readProject("alpha", root).narrator.sourceEntityKeys, [owner, announcer].sort());
  call("channel-project-update", { id: "alpha", narrator: { sourceEntityKeys: [owner] } });
  const prepared = service.prepare(a);
  assert.equal(prepared.run.input.evidencePolicy, POLICY);
  assert.deepEqual(prepared.request.input.narratorSourceEntities, [{ sourceKey: owner, name: "Ömer" }]);
  assert.notEqual(prepared.run.inputFingerprint, unmapped.run.inputFingerprint);
  assert.equal(service.prepare(a).run.id, prepared.run.id, "Same frozen evidence is idempotent");
  const frozen = JSON.stringify(prepared.request);
  const frozenInput = JSON.stringify(prepared.run.input);
  call("channel-project-update", { id: "alpha", narrator: { displayName: "Yeni görünen ad", sourceEntityKeys: [] } });
  assert.equal(JSON.stringify(service.buildRequest(a, prepared.run.id)), frozen);
  assert.equal(JSON.stringify(store.getRun(a, prepared.run.id).input), frozenInput);
  assert.deepEqual(service.buildRequest(a, 5), historicalRequest);
  assert.equal(JSON.stringify(a.prepare("SELECT * FROM narrative_runs WHERE id=5").get()), historicalRows);
  assert.equal(JSON.stringify(a.prepare("SELECT * FROM narrative_section_revisions WHERE run_id=5 ORDER BY id").all()), historicalDrafts);

  // Owner checks use ID, even under a different label and neutral perspective.
  const selfLink = paragraph([{ type: "text", text: "Kaynakta " }, { type: "reference", entityId: owner, label: "Başka etiket" }, { type: "text", text: " kapıya gitti." }]);
  assert.throws(() => service.saveDraftResponse(a, { runId: prepared.run.id, response: response("", selfLink) }), /bağlantı doğrulaması/);
  assert.ok(quality.inlineReferenceFindings(selfLink, { ...prepared.request.input.narrator, mode: "neutral" }, POLICY).some(note => note.severity === "blocker"));
  const thirdPartyLink = paragraph([{ type: "text", text: "Kaynakta " }, { type: "reference", entityId: announcer, label: "Anlatıcı" }, { type: "text", text: " bir iddia aktardı." }]);
  service.saveDraftResponse(a, { runId: prepared.run.id, response: response("", thirdPartyLink) });
  const saved = service.saveDraftResponse(a, { runId: prepared.run.id, response: response("Ömer kapıya gitti.\n\nAnlatıcı bir iddia aktardı.") });
  assert.ok(saved.drafts[0].qualityNotes.some(note => note.code === "named_third_person" && note.severity === "warning"));
  assert.ok(saved.drafts[0].qualityNotes.every(note => note.severity !== "blocker"), "POV is only an editorial warning");
  const context = { evidencePolicy: POLICY, narratorSourceEntities: prepared.request.input.narratorSourceEntities };
  const warn = (body, blocks, extra = {}) => quality.analyzeDraft({ body, blocks, sourceKeys: [owner], sourceVideoIds: ["video-1"] }, prepared.request.input.narrator, { ...context, ...extra }).some(note => note.code === "named_third_person");
  for (const body of ["Ömer gitti.", "Ömer davetliyi çağırır.", "Ömer mor sıvıyı içti.", "Ömer kapıya gidiyor.", "Ömer kitapla ilgili konuşup geri döndü.", '“Bir söz.” Ömer kapıya gitti.']) assert.ok(warn(body), body);
  for (const body of ['“Ömer kapıya gitti.” diye aktardı.', '"Ömer gitti" sözünü duydum.', "«Ömer gitti.» ifadesi kaynakta var.", "'Ömer gitti.' dedi.", "— Ömer gitti.", "Ömer, kapıya git dediler.", "Ömer'e kapıyı sordum.", "Anlatıcı belirtiyor.", "Ömer ile görüştüm.", "Ömer ile Poyraz görüştü.", "Ömer için Poyraz gitti."]) assert.equal(warn(body), false, body);
  assert.equal(warn("Ömer gitti.", paragraph([{ type: "reference", entityId: "other-omer", label: "Ömer" }, { type: "text", text: " gitti." }])), false);
  assert.equal(warn("Ömer gitti.", undefined, { otherCharacterNames: ["Ömer"] }), false, "Ambiguous same-name subject must not warn");
  assert.equal(quality.analyzeDraft({ body: "Ömer gitti." }, { ...profile }, context).some(note => note.code === "named_third_person"), false);
  assert.equal(quality.analyzeDraft({ body: "Ömer gitti." }, { ...prepared.request.input.narrator, mode: "neutral" }, context).some(note => note.code === "named_third_person"), false);
  // Multi-paragraph factual prose survives the response and store unchanged.
  const journal = "Kapıya gittim.\n\nKayda göre Anlatıcı ayrı bir bilgi aktardı.\n\nAynı kaynakta bir kitaptan söz edildi.";
  const journalBlocks = journal.split("\n\n").map(text => ({ type: "paragraph", spans: [{ type: "text", text }] }));
  assert.equal(service.saveDraftResponse(a, { runId: prepared.run.id, response: response(journal, journalBlocks) }).drafts[0].body, journal);
  const detached = paragraph([{ type: "text", text: "Kaydı okudum." }, { type: "reference", entityId: announcer, label: "Anlatıcı" }]);
  assert.throws(() => service.saveDraftResponse(a, { runId: prepared.run.id, response: response("", detached) }), /bağlantı doğrulaması/);
  const draft = service.getRun(a, prepared.run.id).drafts[0];
  a.prepare("UPDATE narrative_section_revisions SET blocks_json=? WHERE id=?").run(JSON.stringify(detached), draft.id);
  assert.throws(() => store.applyRun(a, prepared.run.id), /onayı engellendi/);
  a.prepare("UPDATE narrative_section_revisions SET blocks_json=? WHERE id=?").run(JSON.stringify(selfLink), draft.id);
  assert.throws(() => store.applyRun(a, prepared.run.id), /onayı engellendi/);

  const prompt = buildMessages(prepared.request)[0].content;
  for (const rule of [/sourceEntityKeys/, /narratorSourceEntities/, /mapped ID/, /Eşleme boşsa/, /Anlatıcı adlı node mapped değilse/, /birkaç doğal paragrafta/, /kaynak sınırlıysa kısa kal/, /tasvir, diyalog, duygu, tarih veya olay uydurma/, /hangi videoda anlatıldığı/, /kendisini anlatırken reference verme/]) assert.match(prompt, rule);
  // Invalid persisted mapping must fail at prepare, never silently fall back.
  const file = path.join(root, "channels/alpha/channel.json");
  for (const invalid of ["missing", "story", "draft-person"]) {
    const raw = JSON.parse(fs.readFileSync(file)); raw.narrator.sourceEntityKeys = [invalid]; fs.writeFileSync(file, JSON.stringify(raw));
    assert.throws(() => service.prepare(a), /çözümlenemiyor/);
  }
  assert.throws(() => resolveSourceEntities(a, ["missing"]), /missing/);
  assert.deepEqual(a.prepare("SELECT * FROM universe_workspace_nodes ORDER BY key").all(), beforeNodes, "Settings and preparation must never mutate source nodes");
  projects.setActiveProject("bravo", root); liveDb = b;
  call("channel-project-update", { id: "bravo", narrator: { sourceEntityKeys: [owner] } });
  assert.equal(service.prepare(b).request.input.narratorSourceEntities[0].name, "Başka kanaldaki kişi");
  assert.equal(JSON.stringify(service.buildRequest(a, prepared.run.id)), frozen, "Active channel and invalid live settings cannot change frozen requests");
  assert.deepEqual(service.buildRequest(a, 5), historicalRequest);
  const c = open("charlie");
  projects.updateProject({ id: "charlie", narrator: { sourceEntityKeys: [owner] } }, root, c);
  const current = service.prepare(c);
  c.prepare("UPDATE universe_workspace_nodes SET state='draft' WHERE key=?").run(owner);
  assert.throws(() => service.prepare(c), /çözümlenemiyor/, "A previously mapped approved character becoming draft is rejected");
  assert.deepEqual(store.getRun(c, current.run.id).input.narratorSourceEntities, [{ sourceKey: owner, name: "Başka kanaldaki kişi" }]);
  c.prepare("DELETE FROM universe_workspace_nodes WHERE key=?").run(owner);
  assert.throws(() => service.prepare(c), /çözümlenemiyor/, "A deleted mapped source cannot resolve to a similarly named node");
  assert.equal(a.prepare("SELECT COUNT(*) AS n FROM narrative_section_revisions WHERE state='approved'").get().n, 0);
  console.log("PASS Stage4.2: explicit multi-identity settings/IPC, current DB isolation, invalid IDs, v2 fingerprint/freeze, historical #5 five drafts, owner ID reference gates, POV warnings and journal prompt (tmp/in-memory only)");
} finally {
  for (const db of connections) db.close();
  fs.rmSync(root, { recursive: true, force: true });
}
