"use strict";

/**
 * Canonical Studio -> V2 site publication bridge. Explicit opt-in, immutable
 * approved revisions only. No scene renderer, effects or live transport here.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const store = require("./vefk-store.cjs");
const core = require("./vefk-core/index.cjs");

const FORMAT = "birdesengor.vefk-catalog";
const SCHEMA_VERSION = 1;
const MAX_ENTRIES = 32;
const MAX_CATALOG_BYTES = 5 * 1024 * 1024;
const BINDING = Object.freeze({
  bindingVersion: 2,
  sceneId: "birdesengor-study-v2",
  surface: { objectId: "vefk-stand", anchorId: "vefk-stand.ink-plane" },
  pen: { objectId: "quill", anchorId: "quill.tip" },
  coordinateSpace: "svg-viewBox",
  fit: "contain",
});
const BINDING_V2 = Object.freeze({
  ...BINDING,
  bindingVersion: 3,
  motion: Object.freeze({ strokeEasing: "v2" }),
});

function checkKeys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key))) {
    throw new Error("Vefk site yayın sözleşmesi geçersiz.");
  }
}

function fingerprint(data) {
  return crypto.createHash("sha256").update(core.canonicalString(data)).digest("hex");
}
function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function ensureSchema(db) {
  store.ensureSchema(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS vefk_publication_selection (
      document_id TEXT PRIMARY KEY REFERENCES vefk_documents(id),
      revision INTEGER NOT NULL CHECK(revision >= 1),
      content_hash TEXT NOT NULL CHECK(length(content_hash) = 64),
      sort_order INTEGER NOT NULL CHECK(sort_order BETWEEN 0 AND 10000),
      selected_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_vefk_publication_sort
      ON vefk_publication_selection(sort_order, document_id);
  `);
}
function selected(db) {
  ensureSchema(db);
  return db.prepare(`
    SELECT document_id AS id, revision, content_hash AS contentHash,
           sort_order AS sortOrder, selected_at AS selectedAt
    FROM vefk_publication_selection ORDER BY sort_order, document_id
  `).all();
}
function select(db, input) {
  ensureSchema(db);
  const id = String(input?.id ?? "");
  const enabled = input?.enabled === true;
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,119}$/.test(id)) throw new Error("Geçersiz vefk kimliği.");
  if (typeof input?.enabled !== "boolean") throw new Error("Katalog seçimi açıkça belirtilmeli.");
  const result = db.prepare("SELECT * FROM vefk_publication_selection WHERE document_id=?").get(id);
  if (!enabled) {
    db.prepare("DELETE FROM vefk_publication_selection WHERE document_id=?").run(id);
    return { id, selected: false };
  }
  const revision = input?.revision;
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Katalog için onaylı revizyon seçilmeli.");
  const record = store.getDocument(db, id, revision);
  if (!record || !["approved", "published"].includes(record.status)) {
    throw new Error("Site kataloğuna yalnız onaylanmış vefk revizyonu eklenebilir.");
  }
  if (input?.contentHash !== record.contentHash) {
    throw new Error("Katalog seçimi için vefk revizyonunun içerik hash'i eşleşmiyor.");
  }
  const sortOrder = input?.sortOrder ?? result?.sort_order ?? 0;
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    throw new RangeError("Katalog sırası 0..10000 arasında olmalı.");
  }
  if (!result && selected(db).length >= MAX_ENTRIES) {
    throw new RangeError("Bir site kataloğuna en fazla 32 vefk eklenebilir.");
  }
  const selectedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO vefk_publication_selection(document_id,revision,content_hash,sort_order,selected_at)
    VALUES(?,?,?,?,?)
    ON CONFLICT(document_id) DO UPDATE SET
      revision=excluded.revision,content_hash=excluded.content_hash,
      sort_order=excluded.sort_order,selected_at=excluded.selected_at
  `).run(id, revision, record.contentHash, sortOrder, selectedAt);
  return { id, revision, selected: true, contentHash: record.contentHash, sortOrder, selectedAt };
}

function buildCatalog(db) {
  const entries = selected(db).map(item => {
    const record = store.getDocument(db, item.id, item.revision);
    if (!record || !["approved", "published"].includes(record.status) ||
        record.contentHash !== item.contentHash) {
      throw new Error(`Site kataloğundaki onaylı vefk değişmiş: ${item.id} r${item.revision}`);
    }
    const document = record.document;
    core.validateVefk(document);
    const serialized = core.serializeVefk(document, document.schemaVersion);
    const fileSha = sha256(serialized);
    const filename = `${document.id}-r${document.revision}-${fileSha.slice(0,16)}.json`;
    return {
      id: document.id,
      revision: document.revision,
      order: item.sortOrder,
      title: document.title,
      contentHash: document.contentHash,
      url: `vefk/documents/${filename}`,
      sha256: fileSha,
      document,
    };
  });
  const hasV2 = entries.some(entry => entry.document.schemaVersion === 2);
  const logical = { format: FORMAT, schemaVersion: hasV2 ? 2 : SCHEMA_VERSION,
    binding: hasV2 ? BINDING_V2 : BINDING, entries };
  const catalog = { ...logical, fingerprint: fingerprint(logical) };
  if (Buffer.byteLength(JSON.stringify(catalog)) > MAX_CATALOG_BYTES) {
    throw new RangeError("Vefk kataloğu 5 MB yayın sınırını aşıyor. Sayıyı veya çizim karmaşıklığını azalt.");
  }
  return catalog;
}

function validateCatalog(catalog) {
  checkKeys(catalog, ["format", "schemaVersion", "binding", "entries", "fingerprint"]);
  if (catalog.format !== FORMAT || ![1, 2].includes(catalog.schemaVersion) ||
      !Array.isArray(catalog.entries) || catalog.entries.length > MAX_ENTRIES ||
      core.canonicalString(catalog.binding) !== core.canonicalString(catalog.schemaVersion === 2 ? BINDING_V2 : BINDING)) {
    throw new Error("Vefk site yayın sözleşmesi geçersiz.");
  }
  if (Buffer.byteLength(JSON.stringify(catalog)) > MAX_CATALOG_BYTES) throw new RangeError("Vefk kataloğu boyutu aşıldı.");
  const ids = new Set(), files = new Set();
  let previous = null;
  for (const entry of catalog.entries) {
    checkKeys(entry, ["id", "revision", "order", "title", "contentHash", "url", "sha256", "document"]);
    if (!entry || typeof entry !== "object" || ids.has(entry.id) ||
        !Number.isSafeInteger(entry.order) || entry.order < 0 || entry.order > 10000) {
      throw new Error("Tekrarlanan veya sırası geçersiz vefk katalog girdisi.");
    }
    ids.add(entry.id);
    const doc = entry.document;
    core.validateVefk(doc);
    if (catalog.schemaVersion === 1 && doc.schemaVersion !== 1) {
      throw new Error("Vefk katalog v1 yalnız belge v1 kabul eder.");
    }
    if (previous && (entry.order < previous.order ||
        (entry.order === previous.order && entry.id <= previous.id))) {
      throw new Error("Vefk katalog sırası deterministik değil.");
    }
    previous = entry;
    const body = core.serializeVefk(doc, doc.schemaVersion);
    const fileSha = sha256(body);
    const file = `vefk/documents/${doc.id}-r${doc.revision}-${fileSha.slice(0,16)}.json`;
    if (entry.id !== doc.id || entry.revision !== doc.revision ||
        entry.title !== doc.title || entry.contentHash !== doc.contentHash ||
        entry.sha256 !== fileSha || entry.url !== file || files.has(file)) {
      throw new Error(`Vefk katalog hash'i, belge yolu veya revizyonu uyuşmuyor: ${doc.id}`);
    }
    files.add(file);
  }
  const { fingerprint: saved, ...logical } = catalog;
  const expected = fingerprint(logical);
  if (saved !== expected) throw new Error("Vefk katalog fingerprint'i bozulmuş.");
  return { ok: true, fingerprint: expected, count: catalog.entries.length };
}

/** Separate static JSON documents for local preview; publication.json embeds
 * the same validated catalog so existing PHP image-only uploader is unchanged.
 */
function exportCatalog(db, userDataPath, catalogInput) {
  const catalog = catalogInput || buildCatalog(db);
  validateCatalog(catalog);
  const root = path.resolve(userDataPath);
  const content = path.join(root, "public-export", "content");
  const target = path.join(content, "vefk");
  const temporary = path.join(content, `.vefk-export-${process.pid}-${Date.now()}`);
  fs.mkdirSync(content, { recursive: true });
  fs.mkdirSync(path.join(temporary, "documents"), { recursive: true });
  try {
    for (const entry of catalog.entries) {
      const body = core.serializeVefk(entry.document, entry.document.schemaVersion);
      if (sha256(body) !== entry.sha256) throw new Error("Vefk dosya hash'i uyuşmuyor.");
      fs.writeFileSync(path.join(temporary, "documents", path.basename(entry.url)), body, { flag: "wx" });
    }
    fs.writeFileSync(path.join(temporary, "vefk_catalog.json"),
      JSON.stringify(core.canonical(catalog), null, 2) + "\n", { flag: "wx" });
    // The next publication build can regenerate the export from SQLite safely.
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(temporary, target);
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
  return {
    file: path.join(target, "vefk_catalog.json"),
    directory: target,
    count: catalog.entries.length,
    fingerprint: catalog.fingerprint,
    ready: true,
  };
}

module.exports = {
  FORMAT, BINDING, BINDING_V2, SCHEMA_VERSION, MAX_ENTRIES, MAX_CATALOG_BYTES,
  ensureSchema, selected, select, buildCatalog, validateCatalog, exportCatalog,
};
