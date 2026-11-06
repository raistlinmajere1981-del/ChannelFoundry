"use strict";

const { validateVefk, parseVefk, serializeVefk } = require("./vefk-core/index.cjs");

const STATUSES = Object.freeze(["draft", "checked", "approved", "published"]);
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,119}$/;

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vefk_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_search TEXT NOT NULL,
      current_revision INTEGER NOT NULL CHECK(current_revision >= 1),
      status TEXT NOT NULL CHECK(status IN ('draft','checked','approved','published')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS vefk_revisions (
      document_id TEXT NOT NULL REFERENCES vefk_documents(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision >= 1),
      document_json TEXT NOT NULL,
      content_hash TEXT NOT NULL CHECK(length(content_hash) = 64),
      status TEXT NOT NULL CHECK(status IN ('draft','checked','approved','published')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      checked_at TEXT,
      approved_at TEXT,
      published_at TEXT,
      PRIMARY KEY (document_id, revision)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS vefk_document_sources (
      document_id TEXT PRIMARY KEY REFERENCES vefk_documents(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL,
      analysis_id INTEGER NOT NULL,
      preparation_revision INTEGER NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('traced','grid')),
      partial_accepted INTEGER NOT NULL CHECK(partial_accepted IN (0,1)),
      omitted_regions_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_vefk_documents_status ON vefk_documents(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_vefk_documents_search ON vefk_documents(title_search);
    CREATE INDEX IF NOT EXISTS idx_vefk_revisions_status ON vefk_revisions(status, document_id, revision);
  `);
}

function requireId(id) {
  if (typeof id !== "string" || !ID.test(id)) throw new TypeError("Geçersiz vefk kimliği.");
  return id;
}

function requireRevision(revision) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new RangeError("Geçersiz revizyon.");
  return revision;
}

function transaction(db, callback) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const value = callback();
    db.exec("COMMIT;");
    return value;
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function sourceReview(db, id) {
  ensureSchema(db);
  const row = db.prepare("SELECT * FROM vefk_document_sources WHERE document_id=?").get(requireId(id));
  return row ? { sourceId: row.source_id, analysisId: row.analysis_id,
    preparationRevision: row.preparation_revision, method: row.method,
    partialAccepted: Boolean(row.partial_accepted), omittedRegions: JSON.parse(row.omitted_regions_json) } : null;
}
function validateSourceReview(db, document, input) {
  const refs = document.provenance.references.filter(id => /^source-[a-f0-9]{32}$/.test(id));
  if (!refs.length || sourceReview(db, document.id)) return null;
  // Copying is explicit, local and preserves the original human decision even
  // if its source/analysis has since been deleted.
  const inherited = input.copyFrom ? sourceReview(db, input.copyFrom) : null;
  if (inherited && refs.includes(inherited.sourceId)) return inherited;
  const evidence = input.sourceReview;
  if (!evidence || !refs.includes(evidence.sourceId)) throw new Error("Kaynak inceleme kaydı gerekli.");
  const analysis = require("./vefk-sources.cjs").latestAnalysis(db, evidence.sourceId);
  if (!analysis || analysis.id !== evidence.analysisId || analysis.origin !== "review")
    throw new Error("Kaynak incelemesi değişti; son incelemeyi kaydet.");
  const result = analysis.result;
  if ([...result.regions, ...(result.grid?.cells ?? [])].some(item => !item.reviewed))
    throw new Error("Tüm hücre ve bölgeler insan onayı bekliyor.");
  if (!["traced", "grid"].includes(evidence.method)) throw new Error("Üretim yöntemi gerekli.");
  const omittedRegions = result.regions.filter(region => !result.traces.some(trace => trace.regionId === region.id)).map(region => region.id);
  if (evidence.method === "traced") {
    if (!result.traces.length || result.traces.some(trace => !trace.reviewed)) throw new Error("Konturlar onay bekliyor.");
    if (omittedRegions.length && evidence.partialAccepted !== true) throw new Error("İzlenmemiş bölgeler için kısmi çizim kararı gerekli.");
  } else if (document.construction.kind !== "manualSquare" || !result.grid || result.grid.rows < 3 || result.grid.rows > 9 || result.grid.rows !== result.grid.columns ||
    result.grid.cells.some(cell => !/^[+-]?\d+$/.test(cell.text.trim().replace(/[−–]/g, "-")) || !Number.isSafeInteger(Number(cell.text.trim().replace(/[−–]/g, "-"))))) {
    throw new Error("Sayısal kare yalnız doğrulanmış sayılardan oluşturulabilir; semboller özgün çizimde korunmalı.");
  }
  return { sourceId: evidence.sourceId, analysisId: analysis.id, preparationRevision: result.preparationRevision,
    method: evidence.method, partialAccepted: evidence.method === "traced" && omittedRegions.length > 0,
    omittedRegions: evidence.method === "traced" ? omittedRegions : [] };
}
function stamp() { return new Date().toISOString(); }
function searchKey(value) { return String(value).normalize("NFC").toLocaleLowerCase("tr-TR"); }

function getDocumentRow(db, id) {
  return db.prepare("SELECT * FROM vefk_documents WHERE id = ?").get(requireId(id)) ?? null;
}

function getRevisionRow(db, id, revision) {
  return db.prepare("SELECT * FROM vefk_revisions WHERE document_id = ? AND revision = ?")
    .get(requireId(id), requireRevision(revision)) ?? null;
}

function unpackRevision(row) {
  if (!row) return null;
  const document = parseVefk(row.document_json);
  if (document.contentHash !== row.content_hash || document.id !== row.document_id || document.revision !== row.revision) {
    throw new Error("Kaydedilen vefk revizyonu hash/kimlik uyuşmazlığı taşıyor.");
  }
  return {
    id: row.document_id,
    revision: row.revision,
    status: row.status,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checkedAt: row.checked_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    document,
  };
}

function getDocument(db, id, revision) {
  ensureSchema(db);
  const record = getDocumentRow(db, id);
  if (!record) return null;
  const requestedRevision = revision === undefined || revision === null
    ? record.current_revision : requireRevision(revision);
  return unpackRevision(getRevisionRow(db, id, requestedRevision));
}

function listDocuments(db, input = {}) {
  ensureSchema(db);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Geçersiz liste filtresi.");
  const { status, query = "", limit = 200, offset = 0 } = input;
  if (status !== undefined && !STATUSES.includes(status)) throw new TypeError("Geçersiz vefk durum filtresi.");
  if (typeof query !== "string" || query.length > 200) throw new TypeError("Geçersiz arama metni.");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new RangeError("Liste sınırı 1–500 olmalı.");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new RangeError("Geçersiz liste konumu.");
  const where = [];
  const bindings = [];
  if (status) { where.push("d.status = ?"); bindings.push(status); }
  if (query.trim()) { where.push("instr(d.title_search, ?) > 0"); bindings.push(searchKey(query.trim())); }
  const condition = where.length ? "WHERE " + where.join(" AND ") : "";
  const rows = db.prepare(`
    SELECT d.id, d.title, d.current_revision AS currentRevision, d.status,
           d.created_at AS createdAt, d.updated_at AS updatedAt,
           r.content_hash AS contentHash
    FROM vefk_documents d
    JOIN vefk_revisions r ON r.document_id = d.id AND r.revision = d.current_revision
    ${condition}
    ORDER BY d.updated_at DESC, d.id ASC
    LIMIT ? OFFSET ?
  `).all(...bindings, limit, offset);
  return rows;
}

function listRevisions(db, id) {
  ensureSchema(db);
  requireId(id);
  return db.prepare(`
    SELECT document_id AS id, revision, status, content_hash AS contentHash,
           created_at AS createdAt, updated_at AS updatedAt,
           checked_at AS checkedAt, approved_at AS approvedAt, published_at AS publishedAt
    FROM vefk_revisions WHERE document_id = ? ORDER BY revision DESC
  `).all(id);
}

/**
 * New id: revision=1.
 * Current draft: revision stays fixed; an optimistic expectedContentHash is required.
 * Current approved: exactly one new draft revision may be created.
 * Checked drafts must explicitly return to draft before editing.
 */
function saveDraft(db, input) {
  ensureSchema(db);
  const document = input?.document;
  const expectedHash = input?.expectedContentHash;
  validateVefk(document);
  if (expectedHash !== undefined && (typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedHash))) {
    throw new TypeError("Geçersiz beklenen içerik hash'i.");
  }
  // The document's explicit, validated schema opts in; never upgrade a draft.
  const json = serializeVefk(document, document.schemaVersion);
  if (Buffer.byteLength(json, "utf8") > 2 * 1024 * 1024) throw new RangeError("Vefk belge boyutu sınırı aşıldı.");
  return transaction(db, () => {
    const existing = getDocumentRow(db, document.id);
    const now = stamp();
    const evidence = validateSourceReview(db, document, input);
    if (!existing) {
      if (document.revision !== 1 || expectedHash !== undefined) {
        throw new Error("Yeni vefk belge revizyonu 1 olmalı.");
      }
      db.prepare(`
        INSERT INTO vefk_documents (id, title, title_search, current_revision, status, created_at, updated_at)
        VALUES (?, ?, ?, 1, 'draft', ?, ?)
      `).run(document.id, document.title, searchKey(document.title), now, now);
      db.prepare(`
        INSERT INTO vefk_revisions (document_id, revision, document_json, content_hash,
                                    status, created_at, updated_at)
        VALUES (?, 1, ?, ?, 'draft', ?, ?)
      `).run(document.id, json, document.contentHash, now, now);
    } else {
      const active = getRevisionRow(db, document.id, existing.current_revision);
      if (!active) throw new Error("Etkin vefk revizyonu bulunamadı.");
      if (document.revision === existing.current_revision) {
        if (active.status !== "draft") throw new Error("Onay kontrolünden geçmiş vefk revizyonu değiştirilemez.");
        if (expectedHash !== active.content_hash) {
          throw new Error("Vefk taslağı başka bir işlemde güncellenmiş; içerik hash'i eşleşmiyor.");
        }
        db.prepare(`
          UPDATE vefk_revisions SET document_json = ?, content_hash = ?, updated_at = ?
          WHERE document_id = ? AND revision = ? AND status = 'draft'
        `).run(json, document.contentHash, now, document.id, document.revision);
      } else if (document.revision === existing.current_revision + 1) {
        if (!["approved", "published"].includes(active.status) || expectedHash !== undefined) {
          throw new Error("Yeni taslak yalnız onaylı son revizyondan açılabilir.");
        }
        db.prepare(`
          INSERT INTO vefk_revisions (document_id, revision, document_json, content_hash,
                                      status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'draft', ?, ?)
        `).run(document.id, document.revision, json, document.contentHash, now, now);
      } else {
        throw new Error("Vefk revizyonları sıralı ve tek kopya olmalı.");
      }
      db.prepare(`
        UPDATE vefk_documents SET title = ?, title_search = ?, current_revision = ?, status = 'draft', updated_at = ?
        WHERE id = ?
      `).run(document.title, searchKey(document.title), document.revision, now, document.id);
    }
    if (evidence) db.prepare(`INSERT INTO vefk_document_sources
      (document_id,source_id,analysis_id,preparation_revision,method,partial_accepted,omitted_regions_json)
      VALUES(?,?,?,?,?,?,?)`).run(document.id,evidence.sourceId,evidence.analysisId,evidence.preparationRevision,
        evidence.method,evidence.partialAccepted ? 1 : 0,JSON.stringify(evidence.omittedRegions));
    return unpackRevision(getRevisionRow(db, document.id, document.revision));
  });
}

/**
 * draft -> checked -> approved
 * checked -> draft reopens for corrections.
 * published is reserved for the later publication workflow.
 */
function setReviewState(db, input) {
  ensureSchema(db);
  const id = requireId(input?.id);
  const revision = requireRevision(input?.revision);
  const target = input?.status;
  if (!["draft", "checked", "approved"].includes(target)) throw new Error("Bu aşamada yalnız taslak, kontrol ve onay kullanılabilir.");
  if (typeof input?.expectedContentHash !== "string" || !/^[a-f0-9]{64}$/.test(input.expectedContentHash)) {
    throw new Error("Durum değişikliği için beklenen içerik hash'i gerekli.");
  }
  return transaction(db, () => {
    const record = getDocumentRow(db, id);
    if (!record || record.current_revision !== revision) throw new Error("Etkin vefk revizyonu eşleşmiyor.");
    const current = getRevisionRow(db, id, revision);
    const allowed = { draft: ["checked"], checked: ["draft", "approved"], approved: [], published: [] };
    if (!current || current.content_hash !== input.expectedContentHash ||
        !allowed[current.status].includes(target)) {
      throw new Error("Vefk revizyonunun hash'i veya izin verilen durum geçişi eşleşmiyor.");
    }
    parseVefk(current.document_json); // Re-validate before review and approval.
    const now = stamp();
    const checkedAt = target === "checked" ? now : target === "draft" ? null : current.checked_at;
    const approvedAt = target === "approved" ? now : null;
    db.prepare(`
      UPDATE vefk_revisions SET status = ?, checked_at = ?, approved_at = ?, updated_at = ?
      WHERE document_id = ? AND revision = ?
    `).run(target, checkedAt, approvedAt, now, id, revision);
    db.prepare("UPDATE vefk_documents SET status = ?, updated_at = ? WHERE id = ?")
      .run(target, now, id);
    return unpackRevision(getRevisionRow(db, id, revision));
  });
}

/** The most recent approved revision of each id remains eligible while a newer draft is edited. */
function listApproved(db) {
  ensureSchema(db);
  return db.prepare(`
    SELECT r.* FROM vefk_revisions r
    JOIN (
      SELECT document_id, MAX(revision) AS approved_revision
      FROM vefk_revisions WHERE status IN ('approved', 'published') GROUP BY document_id
    ) last ON last.document_id = r.document_id AND last.approved_revision = r.revision
    ORDER BY r.document_id ASC
  `).all().map(unpackRevision);
}

module.exports = {
  ensureSchema, sourceReview, getDocument, listDocuments, listRevisions, saveDraft, setReviewState, listApproved,
};
