"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const core = require("./vefk-core/index.cjs");
const store = require("./vefk-store.cjs");

function openDb(file = ":memory:") {
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec("PRAGMA foreign_keys = ON;");
  store.ensureSchema(db);
  return db;
}
function fixture({ id = "square-alpha", revision = 1, title = "Üçlü kare", order = 3 } = {}) {
  return core.createVefk({ id, revision, title, parameters: { order } });
}
function reviewed(db, doc) {
  let version = store.setReviewState(db, {
    id: doc.id, revision: doc.revision, status: "checked", expectedContentHash: doc.contentHash,
  });
  assert.equal(version.status, "checked");
  version = store.setReviewState(db, {
    id: doc.id, revision: doc.revision, status: "approved", expectedContentHash: doc.contentHash,
  });
  assert.equal(version.status, "approved");
  return version;
}

test("new database creates dedicated STRICT tables and no unrelated Studio tables", () => {
  const db = openDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
  assert.deepEqual(tables, ["vefk_document_sources", "vefk_documents", "vefk_revisions"]);
  const strict = db.prepare("PRAGMA table_list").all().filter(r => tables.includes(r.name));
  assert.equal(strict.length, 3);
  assert.ok(strict.every(r => r.strict === 1));
  assert.ok(store.listDocuments(db).length === 0);
  store.ensureSchema(db);
  db.close();
});

test("save/retrieve/list and filter return canonical immutable S1 data", () => {
  const db = openDb();
  const first = fixture();
  const saved = store.saveDraft(db, { document: first });
  assert.equal(saved.status, "draft");
  assert.deepEqual(saved.document, first);
  assert.equal(store.getDocument(db, first.id).contentHash, first.contentHash);
  assert.equal(store.getDocument(db, first.id, 1).status, "draft");
  assert.deepEqual(store.listDocuments(db, { status: "draft", query: "üçlü" }).map(r => r.id), ["square-alpha"]);
  assert.equal(store.listDocuments(db, { status: "approved" }).length, 0);
  assert.equal(store.listRevisions(db, first.id).length, 1);
  assert.equal(store.getDocument(db, "missing-id"), null);
  db.close();
});

test("same draft can be updated only using its current expected content hash", () => {
  const db = openDb(), original = fixture();
  store.saveDraft(db, { document: original });
  const changed = fixture({ title: "Yeni açıklama" });
  assert.notEqual(changed.contentHash, original.contentHash);
  assert.throws(() => store.saveDraft(db, { document: changed }), /başka bir işlemde/);
  assert.throws(() => store.saveDraft(db, { document: changed, expectedContentHash: "0".repeat(64) }), /eşleşmiyor/);
  const updated = store.saveDraft(db, { document: changed, expectedContentHash: original.contentHash });
  assert.equal(updated.contentHash, changed.contentHash);
  assert.equal(store.getDocument(db, changed.id).document.title, "Yeni açıklama");
  assert.equal(store.listRevisions(db, changed.id).length, 1);
  db.close();
});

test("draft -> checked -> draft -> checked -> approved lifecycle is explicit", () => {
  const db = openDb(), doc = fixture();
  store.saveDraft(db, { document: doc });
  const checked = store.setReviewState(db, {
    id: doc.id, revision: 1, status: "checked", expectedContentHash: doc.contentHash,
  });
  assert.ok(checked.checkedAt);
  assert.equal(checked.approvedAt, null);
  assert.throws(() => store.saveDraft(db, { document: doc, expectedContentHash: doc.contentHash }), /değiştirilemez/);
  assert.throws(() => store.setReviewState(db, {
    id: doc.id, revision: 1, status: "approved", expectedContentHash: "0".repeat(64),
  }), /eşleşmiyor/);
  const reopened = store.setReviewState(db, {
    id: doc.id, revision: 1, status: "draft", expectedContentHash: doc.contentHash,
  });
  assert.equal(reopened.checkedAt, null);
  const edited = fixture({ title: "Kontrol sonrası düzeltme" });
  store.saveDraft(db, { document: edited, expectedContentHash: doc.contentHash });
  const final = reviewed(db, edited);
  assert.equal(final.document.title, edited.title);
  assert.ok(final.approvedAt);
  assert.ok(final.checkedAt);
  assert.equal(store.listDocuments(db, { status: "approved" }).length, 1);
  db.close();
});

test("approved revision is immutable, new draft increments revision and approved baseline stays visible", () => {
  const db = openDb(), initial = fixture();
  store.saveDraft(db, { document: initial });
  reviewed(db, initial);
  assert.throws(() => store.saveDraft(db, { document: initial, expectedContentHash: initial.contentHash }), /değiştirilemez/);
  const next = fixture({ revision: 2, title: "Düzeltilmiş kare" });
  const draft = store.saveDraft(db, { document: next });
  assert.equal(draft.revision, 2);
  assert.equal(draft.status, "draft");
  assert.equal(store.getDocument(db, initial.id).revision, 2);
  assert.equal(store.getDocument(db, initial.id, 1).document.title, "Üçlü kare");
  assert.deepEqual(store.listRevisions(db, initial.id).map(row => row.revision), [2, 1]);
  const approved = store.listApproved(db);
  assert.equal(approved.length, 1);
  assert.equal(approved[0].revision, 1, "new draft must not hide the last approved publication candidate");
  reviewed(db, next);
  assert.equal(store.listApproved(db)[0].revision, 2);
  db.close();
});

test("invalid revisions, forbidden state transitions and premature published state fail atomically", () => {
  const db = openDb(), initial = fixture();
  store.saveDraft(db, { document: initial });
  assert.throws(() => store.saveDraft(db, { document: fixture({ revision: 3 }) }), /sıralı/);
  assert.throws(() => store.setReviewState(db, {
    id: initial.id, revision: 1, status: "approved", expectedContentHash: initial.contentHash,
  }), /eşleşmiyor/);
  assert.throws(() => store.setReviewState(db, {
    id: initial.id, revision: 1, status: "published", expectedContentHash: initial.contentHash,
  }), /yalnız/);
  assert.equal(store.getDocument(db, initial.id).status, "draft");
  assert.equal(store.listRevisions(db, initial.id).length, 1);
  db.close();
});

test("missing and tampered document hashes never reach persistent storage", () => {
  const db = openDb();
  const doc = fixture();
  const altered = structuredClone(doc);
  altered.title = "An invalid edited title";
  assert.throws(() => store.saveDraft(db, { document: altered }), /contentHash mismatch/);
  assert.equal(store.listDocuments(db).length, 0);
  store.saveDraft(db, { document: doc });
  db.prepare("UPDATE vefk_revisions SET content_hash = ? WHERE document_id = ?").run("0".repeat(64), doc.id);
  assert.throws(() => store.getDocument(db, doc.id), /hash\/kimlik/);
  db.close();
});

test("multiple vefks, deterministic ordering, filtering and pagination", () => {
  const db = openDb();
  for (const [id, title] of [
    ["vefk-a", "Ay"], ["vefk-b", "Güneş"], ["vefk-c", "Yıldız"],
  ]) store.saveDraft(db, { document: fixture({ id, title }) });
  assert.equal(store.listDocuments(db).length, 3);
  assert.equal(store.listDocuments(db, { query: "Güneş" }).length, 1);
  assert.equal(store.listDocuments(db, { limit: 1, offset: 1 }).length, 1);
  assert.throws(() => store.listDocuments(db, { limit: 501 }), /1–500/);
  db.close();
});

test("two database files remain isolated after close and reopen", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "birdesengor-vefk-"));
  const firstFile = path.join(directory, "channel-one.sqlite");
  const otherFile = path.join(directory, "channel-two.sqlite");
  try {
    let db = openDb(firstFile);
    const doc = fixture({ id: "only-channel-one" });
    store.saveDraft(db, { document: doc });
    reviewed(db, doc);
    db.close();
    db = openDb(otherFile);
    assert.equal(store.listDocuments(db).length, 0);
    db.close();
    db = openDb(firstFile);
    assert.equal(store.getDocument(db, doc.id).status, "approved");
    assert.equal(store.listApproved(db).length, 1);
    db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
