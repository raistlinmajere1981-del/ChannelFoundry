"use strict";

const crypto = require("node:crypto");
const {
  requireParameters, siameseSquare, validateNumericGrid, assertMagicSquare,
} = require("./squares.cjs");
const { normalizeGeometry, squareGeometry } = require("./geometry.cjs");
const { drawPlanFor, validateDrawPlan } = require("./timeline.cjs");

const FORMAT = "birdesengor.vefk";
const SCHEMA_VERSION = 1;
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,119}$/;
const PROVENANCE_KINDS = new Set(["manual", "traditional-reference", "algorithmic"]);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

function canonicalString(value) { return JSON.stringify(canonical(value)); }

function text(value, field, max, { required = false } = {}) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new TypeError(`${field} must be a string of at most ${max} characters.`);
  }
  return value;
}

function identifier(value, field) {
  if (typeof value !== "string" || !ID.test(value)) throw new TypeError(`Invalid ${field}.`);
  return value;
}

function provenanceFor(input, method) {
  const raw = input ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Invalid provenance.");
  for (const key of Object.keys(raw)) if (!["kind", "references", "notes"].includes(key)) {
    throw new TypeError(`Unsupported provenance field: ${key}`);
  }
  const kind = raw.kind ?? (method === "magicSquare" ? "algorithmic" : "manual");
  if (!PROVENANCE_KINDS.has(kind)) throw new TypeError("Unknown provenance kind.");
  const references = raw.references ?? [];
  if (!Array.isArray(references) || references.length > 100) throw new TypeError("Invalid provenance references.");
  return { kind, references: references.map((ref, index) =>
    text(ref, `references[${index}]`, 400, { required: true })), notes: text(raw.notes ?? "", "notes", 4000) };
}

function accessibilityFor(value, grid) {
  const defaultSummary = grid
    ? `${grid.length} × ${grid.length} numeric square.`
    : "Vefk vector diagram.";
  const raw = value ?? {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Invalid accessibility.");
  for (const key of Object.keys(raw)) if (!["summary", "matrixText"].includes(key)) {
    throw new TypeError(`Unsupported accessibility field: ${key}`);
  }
  return {
    summary: text(raw.summary ?? defaultSummary, "accessibility.summary", 2000, { required: true }),
    matrixText: text(raw.matrixText ?? (grid ? grid.map(row => row.join(" ")).join(" / ") : ""), "matrixText", 5000),
  };
}

function structureChecks(grid) {
  if (grid) validateNumericGrid(grid);
  return { passed: true, verification: grid ? "structure-only" : "geometry-only" };
}

function makeConstruction(kind, params, grid) {
  if (kind === "magicSquare") {
    const validated = requireParameters(params ?? {});
    const cells = grid === undefined ? siameseSquare(validated) : validateNumericGrid(grid, {
      minOrder: validated.order, maxOrder: validated.order,
    });
    const checks = assertMagicSquare(cells, validated);
    return {
      kind, algorithmId: "siamese-odd", algorithmVersion: "1",
      parameters: validated, grid: cells, checks,
    };
  }
  if (kind === "manualSquare") {
    const cells = validateNumericGrid(grid);
    return { kind, algorithmId: "manual", algorithmVersion: "1",
      parameters: { order: cells.length }, grid: cells, checks: structureChecks(cells) };
  }
  if (kind === "manualPaths") {
    return { kind, algorithmId: "manual", algorithmVersion: "1",
      parameters: {}, checks: structureChecks(null) };
  }
  throw new TypeError(`Unsupported construction method: ${kind}`);
}

function createVefk(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Document input is required.");
  const schemaVersion = Object.hasOwn(input, "schemaVersion") ? input.schemaVersion : SCHEMA_VERSION;
  if (schemaVersion !== 1 && schemaVersion !== 2) throw new Error("Unsupported vefk schema.");
  const kind = input.kind ?? "magicSquare";
  const construction = makeConstruction(kind, input.parameters, input.grid);
  const geometry = normalizeGeometry(input.geometry ??
    (kind === "manualPaths" ? null : squareGeometry(construction.grid)));
  const doc = {
    format: FORMAT,
    schemaVersion,
    id: identifier(input.id, "id"),
    revision: input.revision ?? 1,
    title: text(input.title, "title", 300, { required: true }),
    description: text(input.description ?? "", "description", 4000),
    language: text(input.language ?? "tr", "language", 20, { required: true }),
    provenance: provenanceFor(input.provenance, kind),
    construction,
    geometry,
    drawPlan: input.drawPlan
      ? validateDrawPlan(input.drawPlan, geometry, schemaVersion)
      : drawPlanFor(geometry, input.timing ?? {}, schemaVersion),
    accessibility: accessibilityFor(input.accessibility, construction.grid),
  };
  if (!Number.isSafeInteger(doc.revision) || doc.revision < 1) throw new RangeError("revision must be a positive safe integer.");
  doc.contentHash = documentHash(doc);
  validateVefk(doc);
  return deepFreeze(doc);
}

function documentHash(input) {
  if (!input || typeof input !== "object") throw new TypeError("Cannot fingerprint empty document.");
  // The published semantics are intentionally isolated from runtime and editor state.
  const semantic = {
    format: input.format, schemaVersion: input.schemaVersion,
    id: input.id, revision: input.revision, title: input.title,
    description: input.description, language: input.language,
    provenance: input.provenance, construction: input.construction,
    geometry: input.geometry, drawPlan: input.drawPlan, accessibility: input.accessibility,
  };
  return crypto.createHash("sha256").update(canonicalString(semantic)).digest("hex");
}

function validateVefk(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid vefk document.");
  for (const key of Object.keys(input)) if (![
    "format", "schemaVersion", "id", "revision", "title", "description", "language",
    "provenance", "construction", "geometry", "drawPlan", "accessibility", "contentHash",
    "generatedAt",
  ].includes(key)) throw new TypeError(`Unexpected document field: ${key}`);
  if (input.format !== FORMAT || ![1, 2].includes(input.schemaVersion)) throw new Error("Unsupported vefk schema.");
  identifier(input.id, "id");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) throw new RangeError("Invalid revision.");
  text(input.title, "title", 300, { required: true });
  text(input.description, "description", 4000);
  text(input.language, "language", 20, { required: true });
  const provenance = provenanceFor(input.provenance, input.construction?.kind);
  if (canonicalString(provenance) !== canonicalString(input.provenance)) throw new Error("Non-normalized provenance.");
  const source = input.construction;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Missing construction.");
  for (const key of Object.keys(source)) if (![
    "kind", "algorithmId", "algorithmVersion", "parameters", "grid", "checks",
  ].includes(key)) throw new Error(`Unexpected construction field: ${key}`);
  const expected = makeConstruction(source.kind, source.parameters, source.grid);
  if (canonicalString(source) !== canonicalString(expected)) throw new Error("Construction or its checks do not match the specified method.");
  const geometry = normalizeGeometry(input.geometry);
  if (canonicalString(input.geometry) !== canonicalString(geometry)) throw new Error("Non-normalized geometry.");
  if (source.grid) {
    for (let r = 0; r < source.grid.length; r++) for (let c = 0; c < source.grid.length; c++) {
      const path = geometry.paths.find(item => item.id === `cell.r${r}c${c}`);
      if (!path || path.semanticValue !== String(source.grid[r][c])) {
        throw new Error(`Grid cell r${r}c${c} has no matching vector path/semantic value.`);
      }
    }
  }
  const plan = validateDrawPlan(input.drawPlan, geometry, input.schemaVersion);
  if (canonicalString(plan) !== canonicalString(input.drawPlan)) throw new Error("Non-normalized draw plan.");
  const a11y = accessibilityFor(input.accessibility, source.grid);
  if (canonicalString(a11y) !== canonicalString(input.accessibility)) throw new Error("Non-normalized accessibility.");
  if (input.generatedAt !== undefined && (typeof input.generatedAt !== "string" || !Number.isFinite(Date.parse(input.generatedAt)))) {
    throw new Error("Invalid generatedAt metadata.");
  }
  const hash = documentHash(input);
  if (typeof input.contentHash !== "string" || input.contentHash !== hash) {
    throw new Error("Vefk contentHash mismatch.");
  }
  return { ok: true, contentHash: hash, pathCount: geometry.paths.length, strokeCount: plan.strokes.length };
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function serializeVefk(input, schemaVersion = SCHEMA_VERSION) {
  validateVefk(input);
  // S4a: existing storage/publication callers remain doc1-only. Serializing a
  // candidate doc2 requires explicit opt-in; S4b must review each publisher.
  if (![1, 2].includes(schemaVersion) || input.schemaVersion !== schemaVersion) {
    throw new Error("Vefk serialization requires an explicit matching schema version.");
  }
  return JSON.stringify(canonical(input), null, 2) + "\n";
}

function parseVefk(textValue) {
  if (typeof textValue !== "string" || textValue.length > 2 * 1024 * 1024) throw new RangeError("Invalid JSON document size.");
  const document = JSON.parse(textValue);
  validateVefk(document);
  return deepFreeze(document);
}

module.exports = {
  FORMAT, SCHEMA_VERSION, canonical, canonicalString, documentHash, createVefk,
  validateVefk, serializeVefk, parseVefk,
};
