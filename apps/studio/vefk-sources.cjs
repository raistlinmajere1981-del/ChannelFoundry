"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { normalizeGeometry } = require("./vefk-core/geometry.cjs");
const preparations = require("./vefk-preparations.cjs");

const MIME = Object.freeze({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" });
const MAX_BYTES = 12 * 1024 * 1024;
const SOURCE_ID = /^source-[a-f0-9]{32}$/;

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vefk_sources (
      id TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL CHECK(length(sha256)=64),
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 12582912),
      relative_path TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS vefk_source_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL REFERENCES vefk_sources(id),
      origin TEXT NOT NULL CHECK(origin IN ('ai','review')),
      status TEXT NOT NULL CHECK(status IN ('proposed','reviewed')),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_vefk_source_analyses_source
      ON vefk_source_analyses(source_id, id DESC);
  `);
  preparations.ensureSchema(db);
}

function validateId(value) {
  if (typeof value !== "string" || !SOURCE_ID.test(value)) throw new TypeError("Geçersiz kaynak görsel kimliği.");
  return value;
}

function signature(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  throw new TypeError("Kaynak görsel PNG, JPEG veya WebP biçiminde olmalı.");
}

function rootFolder(userData) {
  if (typeof userData !== "string" || !path.isAbsolute(userData)) throw new TypeError("Geçersiz Studio veri kökü.");
  return path.resolve(userData, "vefk-sources");
}

function readRow(db, id) {
  schema(db);
  return db.prepare("SELECT id, sha256, filename, mime, bytes, relative_path AS relativePath, created_at AS createdAt FROM vefk_sources WHERE id=?").get(validateId(id)) ?? null;
}

function metadata(row) {
  if (!row) return null;
  const { relativePath, ...rest } = row;
  return rest;
}

function importSource(db, userData, file) {
  schema(db);
  if (typeof file !== "string" || !path.isAbsolute(file)) throw new TypeError("Kaynak dosya yolu gerekli.");
  const extension = path.extname(file).toLowerCase();
  if (!MIME[extension]) throw new TypeError("Yalnız PNG, JPG/JPEG ve WebP destekleniyor.");
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size < 12 || stat.size > MAX_BYTES) throw new RangeError("Kaynak görsel en fazla 12 MB olabilir.");
  const buffer = fs.readFileSync(file);
  const mime = signature(buffer);
  if (mime !== MIME[extension]) throw new TypeError("Dosya uzantısı ve görsel biçimi uyuşmuyor.");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const id = "source-" + sha256.slice(0, 32);
  const existing = readRow(db, id);
  if (existing) return { ...metadata(existing), duplicate: true };
  const relative = sha256 + (mime === "image/png" ? ".png" : mime === "image/jpeg" ? ".jpg" : ".webp");
  const folder = rootFolder(userData);
  fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, relative);
  try {
    fs.writeFileSync(target, buffer, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const current = fs.readFileSync(target);
    if (crypto.createHash("sha256").update(current).digest("hex") !== sha256) throw new Error("Kaynak dosya hash kontrolü başarısız.");
  }
  const filename = path.basename(file).slice(0, 200);
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO vefk_sources(id,sha256,filename,mime,bytes,relative_path,created_at)
    VALUES(?,?,?,?,?,?,?)`).run(id, sha256, filename, mime, buffer.byteLength, relative, createdAt);
  return { id, sha256, filename, mime, bytes: buffer.byteLength, createdAt, duplicate: false };
}

function listSources(db) {
  schema(db);
  return db.prepare(`
    SELECT s.id,s.sha256,s.filename,s.mime,s.bytes,s.created_at AS createdAt,
           (SELECT MAX(a.id) FROM vefk_source_analyses a WHERE a.source_id=s.id
             AND COALESCE(json_extract(a.result_json, '$.preparationRevision'),0) =
                 COALESCE((SELECT MAX(p.revision) FROM vefk_source_preparations p WHERE p.source_id=s.id),0)
           ) AS lastAnalysisId
    FROM vefk_sources s ORDER BY s.created_at DESC, s.id ASC LIMIT 300
  `).all();
}

function loadSource(db, userData, id, { includeImage = true, preparationRevision } = {}) {
  const row = readRow(db, id);
  if (!row) return null;
  if (!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(row.relativePath)) throw new Error("Geçersiz kaynak depolama yolu.");
  const file = path.join(rootFolder(userData), row.relativePath);
  const buffer = fs.readFileSync(file);
  if (crypto.createHash("sha256").update(buffer).digest("hex") !== row.sha256) throw new Error("Orijinal görsel içerik hash'i bozulmuş.");
  if (preparationRevision !== undefined && (!Number.isSafeInteger(preparationRevision) || preparationRevision < 0)) throw new Error("Hazırlık revizyonu geçersiz.");
  const preparation = preparationRevision === 0 ? null : preparations.latest(db, id, preparationRevision);
  if (preparationRevision && !preparation) throw new Error("Hazırlık revizyonu bulunamadı.");
  const originalImageDataUrl = `data:${row.mime};base64,${buffer.toString("base64")}`;
  return {
    ...metadata(row),
    preparation: preparations.publicMetadata(preparation),
    ...(includeImage ? {
      originalImageDataUrl,
      imageDataUrl: preparation ? preparations.readPrepared(userData, preparation) : originalImageDataUrl,
    } : {}),
  };
}

function nonemptyString(value, label, max = 240) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TypeError(label + " geçersiz.");
  return value.trim();
}

const KINDS = new Set(["grid","number","text","symbol","line","seal","unknown"]);
function normalizeAnalysis(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("AI çözümleme çıktısı nesne olmalı.");
  if (input.schema !== "vefk.source-analysis.v1") throw new Error("Görsel analiz sözleşmesi uyumsuz.");
  const preparationRevision = input.preparationRevision ?? 0;
  if (!Number.isSafeInteger(preparationRevision) || preparationRevision < 0) {
    throw new RangeError("Görsel hazırlığı revizyonu geçersiz.");
  }
  const width = 1000;
  if (!Array.isArray(input.regions) || input.regions.length > 250) throw new Error("Bölge sayısı geçersiz.");
  const regions = input.regions.map((region, i) => {
    if (!region || typeof region !== "object") throw new Error("Bölge nesnesi eksik.");
    const kind = nonemptyString(region.kind, "Bölge tipi", 20);
    if (!KINDS.has(kind)) throw new Error("Desteklenmeyen kaynak bölgesi: " + kind);
    if (!Array.isArray(region.box) || region.box.length !== 4 ||
        !region.box.every(n => typeof n === "number" && Number.isFinite(n))) {
      throw new Error("Bölge sınırları [x,y,w,h] olmalı.");
    }
    const [x,y,w,h] = region.box;
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x+w > width || y+h > width) throw new RangeError("Bölge görsel koordinatları dışında.");
    const confidence = Number(region.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new RangeError("Güven skoru 0..1 olmalı.");
    const label = typeof region.label === "string" ? region.label.trim().slice(0, 250) : "";
    const reviewed = region.reviewed === true && kind !== "unknown" && (Boolean(label) || kind === "line" || kind === "grid");
    const needsReview = !reviewed;
    return { id: `region-${String(i+1).padStart(3,"0")}`, kind, box: region.box.map(n => Number(n.toFixed(2))), label, confidence, reviewed, needsReview };
  });
  const note = typeof input.note === "string" ? input.note.slice(0, 2000) : "";
  const orientation = ["ltr","rtl","mixed","unknown"].includes(input.orientation) ? input.orientation : "unknown";
  const warningsInput = input.coordinateWarnings ?? [];
  if (!Array.isArray(warningsInput) || warningsInput.length > 500) {
    throw new RangeError("AI koordinat uyarıları sınırı aşıldı.");
  }
  const coordinateWarnings = warningsInput.map(warning => {
    if (!warning || !Number.isInteger(warning.regionIndex) ||
        warning.regionIndex < 1 || warning.regionIndex > 250 ||
        !["clipped", "skipped", "kind-unknown"].includes(warning.action)) {
      throw new TypeError("Geçersiz AI koordinat uyarısı.");
    }
    const boxOrNull = value => value === null ? null :
      Array.isArray(value) && value.length === 4 &&
      value.every(n => typeof n === "number" && Number.isFinite(n))
        ? [...value] : null;
    return {
      regionIndex: warning.regionIndex, action: warning.action,
      originalBox: boxOrNull(warning.originalBox),
      box: boxOrNull(warning.box),
      reason: typeof warning.reason === "string" ? warning.reason.slice(0, 160) : "",
    };
  });
  let grid = null;
  if (input.grid !== undefined && input.grid !== null) {
    const rows = input.grid?.rows, columns = input.grid?.columns;
    if (![rows, columns].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 9)) throw new Error("AI kare boyutları geçersiz.");
    if (!Array.isArray(input.grid.cells) || input.grid.cells.length > 81) throw new Error("AI hücre listesi geçersiz.");
    const cellsByKey = new Map();
    for (const cell of input.grid.cells) {
      const row = cell?.row, column = cell?.column;
      if (!Number.isInteger(row) || row < 0 || row >= rows || !Number.isInteger(column) || column < 0 || column >= columns) throw new Error("Hücre koordinatları geçersiz.");
      const key = row + ":" + column;
      if (cellsByKey.has(key)) throw new Error("Aynı AI hücresi tekrarlanmış.");
      const text = typeof cell.text === "string" ? cell.text.trim().slice(0, 120) : "";
      const confidence = Number(cell.confidence);
      if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error("Hücre güveni 0..1 olmalı.");
      const reviewed = cell.reviewed === true && Boolean(text);
      cellsByKey.set(key, { row, column, text, confidence, reviewed,
        needsReview: !reviewed });
    }
    const cells = [];
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      cells.push(cellsByKey.get(row + ":" + column) ?? { row, column, text: "", confidence: 0, reviewed: false, needsReview: true });
    }
    grid = { rows, columns, cells };
  }
  // Editable pen-centerlines are review records, not automatically accepted AI text.
  // Every path is validated by the S1 SVG geometry boundary before it reaches SQLite.
  const proposedTraces = input.traces ?? [];
  if (!Array.isArray(proposedTraces) || proposedTraces.length > regions.length || proposedTraces.length > 250) {
    throw new Error("Kaynak vektör grupları geçersiz.");
  }
  const existing = new Set(), tracePaths = [];
  const traces = proposedTraces.map(group => {
    if (!group || typeof group !== "object") throw new TypeError("Geçersiz kontur grubu.");
    const regionId = String(group.regionId ?? "");
    if (!regions.some(region => region.id === regionId) || existing.has(regionId)) {
      throw new Error("Kontur grubu var olmayan veya yinelenen bölgeye bağlı.");
    }
    existing.add(regionId);
    if (!Array.isArray(group.paths) || !group.paths.length || group.paths.length > 250) {
      throw new Error("Her kontur grubu 1–250 mürekkep yolu içermeli.");
    }
    const paths = group.paths.map((item, i) => {
      const expectedId = "trace." + regionId + "." + String(i + 1).padStart(3, "0");
      if (item?.id !== expectedId || typeof item?.d !== "string") {
        throw new TypeError("Mürekkep yolu kimliği sıralı ve bölgeye bağlı olmalı.");
      }
      const normalized = { id: expectedId, d: item.d, ink: "trace" };
      tracePaths.push(normalized);
      return { id: expectedId, d: item.d };
    });
    return { regionId, reviewed: group.reviewed === true, paths };
  });
  if (tracePaths.length > 850) throw new RangeError("Bir görselde en fazla 850 kontur yolu saklanabilir.");
  if (tracePaths.length) {
    const checked = normalizeGeometry({
      coordinateSpace: "svg-viewBox", viewBox: [0, 0, 1000, 1000],
      paths: tracePaths, inkStyles: { trace: { width: 5, cap: "round" } },
    });
    const dById = new Map(checked.paths.map(path => [path.id, path.d]));
    for (const group of traces) {
      const box = regions.find(region => region.id === group.regionId).box;
      const [x0, y0, bw, bh] = box;
      for (const line of group.paths) {
        line.d = dById.get(line.id);
        const tokens = line.d.split(" ");
        for (let index = 0; index < tokens.length;) {
          const operation = tokens[index++];
          if (operation === "Z") continue;
          const x = Number(tokens[index++]), y = Number(tokens[index++]);
          if (x < x0 - .01 || x > x0 + bw + .01 || y < y0 - .01 || y > y0 + bh + .01) {
            throw new RangeError("Mürekkep yolu bağlı olduğu görsel bölgesinin dışına çıkamaz.");
          }
        }
      }
    }
  }
  return { schema: "vefk.source-analysis.v1", coordinateSpace: "normalized-1000", preparationRevision, orientation, note, coordinateWarnings, regions, grid, traces };
}

function latestAnalysis(db, sourceId) {
  schema(db);
  const row = db.prepare(`
    SELECT id,source_id AS sourceId,origin,status,provider,model,result_json AS resultJson,created_at AS createdAt
    FROM vefk_source_analyses WHERE source_id=?
      AND COALESCE(json_extract(result_json, '$.preparationRevision'),0)=?
    ORDER BY id DESC LIMIT 1
  `).get(validateId(sourceId), preparations.latest(db, sourceId)?.revision ?? 0);
  if (!row) return null;
  const { resultJson, ...info } = row;
  return { ...info, result: normalizeAnalysis(JSON.parse(resultJson)) };
}

function appendAnalysis(db, { sourceId, origin, provider, model, result, expectedAnalysisId, expectedPreparationRevision }) {
  schema(db);
  if (!readRow(db, sourceId)) throw new Error("Kaynak görsel bulunamadı.");
  if (origin !== "ai" && origin !== "review") throw new TypeError("Kaynak analiz değişikliği türü geçersiz.");
  const normalized = normalizeAnalysis(origin === "ai" ? { ...result,
    regions: result.regions?.map(region => ({ ...region, reviewed: false, needsReview: true })),
    grid: result.grid ? { ...result.grid, cells: result.grid.cells?.map(cell => ({ ...cell, reviewed: false, needsReview: true })) } : null,
    traces: result.traces?.map(trace => ({ ...trace, reviewed: false })),
  } : result);
  const preparationRevision = preparations.latest(db, sourceId)?.revision ?? 0;
  if (expectedPreparationRevision !== undefined && expectedPreparationRevision !== preparationRevision) {
    throw new Error("AI çalışırken kaynak görsel hazırlığı değişti; eski çözümleme kaydedilmedi.");
  }
  if (origin === "review" && normalized.preparationRevision !== preparationRevision) {
    throw new Error("Düzeltme farklı bir görsel hazırlığına ait.");
  }
  normalized.preparationRevision = preparationRevision;
  const last = latestAnalysis(db, sourceId);
  if (origin === "review" && !last) throw new Error("İncelenecek AI sonucu yok.");
  if (origin === "review" && !["ai", "review"].includes(last.origin)) throw new Error("Geçersiz inceleme kökeni.");
  if (origin === "review" && (!Number.isSafeInteger(expectedAnalysisId) || expectedAnalysisId !== last.id))
    throw new Error("Düzenlenen analiz artık en güncel değil; son çözümlemeyi aç.");
  const status = origin === "review" ? "reviewed" : "proposed";
  db.prepare(`
    INSERT INTO vefk_source_analyses(source_id,origin,status,provider,model,result_json,created_at)
    VALUES(?,?,?,?,?,?,?)
  `).run(sourceId, origin, status, nonemptyString(provider, "Sağlayıcı", 100),
    nonemptyString(model, "Model", 200), JSON.stringify(normalized), new Date().toISOString());
  return latestAnalysis(db, sourceId);
}

module.exports = {
  schema, signature, importSource, listSources, loadSource, latestAnalysis, appendAnalysis,
  normalizeAnalysis, MAX_BYTES,
};
