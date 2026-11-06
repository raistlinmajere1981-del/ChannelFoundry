"use strict";

const { normalizeGeometry } = require("./geometry.cjs");

const MAX_MS = 3600000;
const STROKE_EASINGS = Object.freeze(["linear", "ease-in", "ease-out", "ease-in-out"]);

function requireSchemaVersion(schemaVersion) {
  if (schemaVersion !== 1 && schemaVersion !== 2) throw new Error("Unsupported vefk schema.");
}

function easedProgress(value, easing = "linear") {
  if (!Number.isFinite(value)) throw new TypeError("Stroke progress must be finite.");
  if (!STROKE_EASINGS.includes(easing)) throw new TypeError("Unknown stroke easing.");
  const u = Math.max(0, Math.min(1, value));
  if (easing === "ease-in") return u * u;
  if (easing === "ease-out") return u * (2 - u);
  if (easing === "ease-in-out") return u * u * (3 - 2 * u);
  return u;
}

function requireMs(value, label, { allowZero = true } = {}) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_MS) {
    throw new RangeError(`${label} must be a non-negative bounded integer in milliseconds.`);
  }
  return value;
}

function drawPlanFor(input, settings = {}, schemaVersion = 1) {
  requireSchemaVersion(schemaVersion);
  const geometry = normalizeGeometry(input);
  const gridMs = requireMs(settings.gridMs ?? 700, "gridMs", { allowZero: false });
  const glyphMs = requireMs(settings.glyphMs ?? 950, "glyphMs", { allowZero: false });
  const gapMs = requireMs(settings.gapMs ?? 140, "gapMs");
  const holdMs = requireMs(settings.holdMs ?? 600, "holdMs");
  let cursor = 0;
  let inscriptionsAt = null;
  const strokes = geometry.paths.map((path, index) => {
    const durationMs = path.ink === "grid" ? gridMs : glyphMs;
    if (path.ink !== "grid" && inscriptionsAt === null) inscriptionsAt = cursor;
    const stroke = {
      id: `stroke.${String(index + 1).padStart(3, "0")}`,
      pathId: path.id,
      startMs: cursor,
      durationMs,
      ink: path.ink,
      pen: "down",
      ...(schemaVersion === 2 ? { easing: "linear" } : {}),
    };
    cursor += durationMs + gapMs;
    if (!Number.isSafeInteger(cursor) || cursor > MAX_MS) throw new RangeError("Draw plan exceeds its time budget.");
    return stroke;
  });
  const markers = [{ id: "outline", atMs: 0 }];
  if (inscriptionsAt !== null && inscriptionsAt > 0) markers.push({ id: "inscriptions", atMs: inscriptionsAt });
  markers.push({ id: "hold", atMs: cursor });
  const plan = { timeUnit: "ms", durationMs: cursor + holdMs, markers, strokes };
  validateDrawPlan(plan, geometry, schemaVersion);
  return plan;
}

function validateDrawPlan(plan, inputGeometry, schemaVersion = 1) {
  requireSchemaVersion(schemaVersion);
  const geometry = normalizeGeometry(inputGeometry);
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) throw new TypeError("Draw plan is required.");
  const allowedPlanKeys = ["timeUnit", "durationMs", "strokes", "markers"];
  for (const key of Object.keys(plan)) if (!allowedPlanKeys.includes(key)) {
    throw new TypeError(`Unknown drawPlan field: ${key}`);
  }
  if (plan.timeUnit !== "ms") throw new Error("Draw plan must use relative milliseconds.");
  const durationMs = requireMs(plan.durationMs, "durationMs", { allowZero: false });
  if (!Array.isArray(plan.strokes) || plan.strokes.length !== geometry.paths.length) {
    throw new Error("Each geometry path must have exactly one stroke.");
  }
  const paths = new Map(geometry.paths.map(path => [path.id, path]));
  const strokeIds = new Set(), usedPaths = new Set();
  let endMs = 0;
  const strokes = plan.strokes.map((stroke, index) => {
    if (!stroke || typeof stroke !== "object" || Array.isArray(stroke)) throw new TypeError("Invalid stroke.");
    const allowedStrokeKeys = ["id", "pathId", "startMs", "durationMs", "ink", "pen",
      ...(schemaVersion === 2 ? ["easing"] : [])];
    for (const key of Object.keys(stroke)) if (!allowedStrokeKeys.includes(key)) {
      throw new TypeError(`Unknown stroke field: ${key}`);
    }
    const hasEasing = Object.hasOwn(stroke, "easing");
    if (hasEasing && !STROKE_EASINGS.includes(stroke.easing)) throw new TypeError("Unknown stroke easing.");
    if (typeof stroke.id !== "string" || !/^[a-zA-Z][a-zA-Z0-9._-]{0,119}$/.test(stroke.id)
      || strokeIds.has(stroke.id)) throw new Error("Invalid or duplicate stroke ID.");
    strokeIds.add(stroke.id);
    const path = paths.get(stroke.pathId);
    if (!path || usedPaths.has(stroke.pathId)) throw new Error(`Unknown or repeated pathId: ${stroke.pathId}`);
    usedPaths.add(stroke.pathId);
    if (stroke.ink !== path.ink || stroke.pen !== "down") throw new Error("Stroke ink or pen state mismatches geometry.");
    const startMs = requireMs(stroke.startMs, `strokes[${index}].startMs`);
    const lengthMs = requireMs(stroke.durationMs, `strokes[${index}].durationMs`, { allowZero: false });
    if (startMs < endMs || startMs + lengthMs > durationMs) throw new Error("Stroke order overlaps or exceeds drawPlan duration.");
    endMs = startMs + lengthMs;
    return { id: stroke.id, pathId: path.id, startMs, durationMs: lengthMs, ink: stroke.ink, pen: "down",
      ...(hasEasing ? { easing: stroke.easing } : {}) };
  });
  if (!Array.isArray(plan.markers) || plan.markers.length > 64) throw new Error("Invalid timeline markers.");
  const markerIds = new Set();
  let lastMarker = -1;
  const markers = plan.markers.map((marker) => {
    if (!marker || typeof marker !== "object" || Array.isArray(marker)
      || Object.keys(marker).some(key => !["id", "atMs"].includes(key))) throw new TypeError("Invalid marker.");
    if (typeof marker.id !== "string" || !/^[A-Za-z][A-Za-z0-9._-]{0,119}$/.test(marker.id)
      || markerIds.has(marker.id)) throw new Error("Invalid or repeated marker ID.");
    const atMs = requireMs(marker.atMs, `markers.${marker.id}.atMs`);
    if (atMs < lastMarker || atMs > durationMs) throw new Error("Marker time is out of range or order.");
    markerIds.add(marker.id);
    lastMarker = atMs;
    return { id: marker.id, atMs };
  });
  return { timeUnit: "ms", durationMs, markers, strokes };
}

/** Frame-independent visibility. Consumers can derive pen position from the same path. */
function progressAt(plan, timeMs, schemaVersion = 1) {
  requireSchemaVersion(schemaVersion);
  if (!Number.isFinite(timeMs)) throw new TypeError("Timeline time must be finite.");
  return plan.strokes.map(stroke => ({
    pathId: stroke.pathId,
    fraction: schemaVersion === 2
      ? easedProgress((timeMs - stroke.startMs) / stroke.durationMs, stroke.easing)
      : Math.max(0, Math.min(1, (timeMs - stroke.startMs) / stroke.durationMs)),
  }));
}

module.exports = { MAX_MS, STROKE_EASINGS, requireMs, drawPlanFor, validateDrawPlan, progressAt, easedProgress };
