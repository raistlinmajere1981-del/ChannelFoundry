"use strict";

// The S1/S2 geometry validator remains strict. Only untrusted AI proposals enter
// this bounded recovery layer, so one bad region does not lose the whole run.
const LIMIT = 1000;
const MAX_EDGE_OVERSHOOT = 35;
const MAX_REGIONS = 250;
const KINDS = new Set(["grid", "number", "text", "symbol", "line", "seal", "unknown"]);

function rounded(value) {
  return Number(value.toFixed(2));
}

function repairBox(raw) {
  if (!Array.isArray(raw) || raw.length !== 4 ||
      !raw.every(v => typeof v === "number" && Number.isFinite(v))) {
    return { action: "skipped", reason: "Geçersiz sayı veya kutu biçimi", box: null };
  }
  const [x, y, width, height] = raw;
  if (width <= 0 || height <= 0) {
    return { action: "skipped", reason: "Sıfır/negatif genişlik veya yükseklik", box: null };
  }
  const right = x + width, bottom = y + height;
  const left = Math.max(0, x), top = Math.max(0, y);
  const clippedRight = Math.min(LIMIT, right);
  const clippedBottom = Math.min(LIMIT, bottom);
  const overflow = Math.max(0, -x, -y, x - LIMIT, y - LIMIT, right - LIMIT, bottom - LIMIT);
  if (clippedRight <= left || clippedBottom <= top) {
    return { action: "skipped", reason: "Görsel dışında kalan kutu", box: null };
  }
  if (overflow > MAX_EDGE_OVERSHOOT) {
    return { action: "skipped", reason: "35 birimi aşan taşma; koordinat biçimi belirsiz", box: null };
  }
  const x0 = rounded(left), y0 = rounded(top);
  const x1 = rounded(clippedRight), y1 = rounded(clippedBottom);
  const clippedWidth = rounded(x1 - x0), clippedHeight = rounded(y1 - y0);
  if (clippedWidth <= 0 || clippedHeight <= 0) {
    return { action: "skipped", reason: "Yuvarlama sonrası boş kutu", box: null };
  }
  return {
    action: overflow > 0 ? "clipped" : "valid",
    reason: overflow > 0 ? "Küçük sınır taşması kırpıldı; kullanıcı kontrolü gerekli" : "",
    box: [x0, y0, clippedWidth, clippedHeight],
  };
}

function sanitizeAiAnalysis(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !Array.isArray(input.regions)) {
    throw new TypeError("AI çözümleme önerisinde bölgeler listesi yok.");
  }
  if (input.regions.length > MAX_REGIONS) {
    throw new RangeError("AI en fazla 250 bölge önerebilir.");
  }
  const regions = [], coordinateWarnings = [];
  for (let i = 0; i < input.regions.length; i++) {
    const item = input.regions[i];
    const candidate = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const outcome = repairBox(candidate.box);
    const originalBox = Array.isArray(candidate.box) && candidate.box.length === 4 &&
      candidate.box.every(v => typeof v === "number" && Number.isFinite(v))
      ? [...candidate.box] : null;
    if (outcome.action !== "valid") {
      coordinateWarnings.push({
        regionIndex: i + 1,
        action: outcome.action,
        originalBox,
        box: outcome.box,
        reason: outcome.reason,
      });
    }
    if (outcome.action === "skipped") continue;
    let kind = candidate.kind;
    if (!KINDS.has(kind)) {
      kind = "unknown";
      coordinateWarnings.push({
        regionIndex: i + 1, action: "kind-unknown", originalBox,
        box: outcome.box, reason: "Tanımsız işaret tipi belirsiz olarak işlendi",
      });
    }
    const confidence = typeof candidate.confidence === "number" &&
      Number.isFinite(candidate.confidence) && candidate.confidence >= 0 &&
      candidate.confidence <= 1 ? candidate.confidence : 0;
    const needsReview = outcome.action !== "valid" || kind === "unknown" ||
      confidence < 0.85 || candidate.needsReview === true;
    regions.push({
      ...candidate, kind, box: outcome.box, confidence:
        outcome.action === "clipped" ? Math.min(confidence, 0.5) : confidence,
      reviewed: false, needsReview,
    });
  }
  const correctionCount = coordinateWarnings.filter(w => w.action === "clipped").length;
  const skippedCount = coordinateWarnings.filter(w => w.action === "skipped").length;
  const note = typeof input.note === "string" ? input.note : "";
  const suffix = correctionCount || skippedCount ?
    " [Koordinat denetimi: " + correctionCount + " kutu sınırda düzeltildi, " +
    skippedCount + " kutu atlandı. Kaynağı gözle kontrol edin.]" : "";
  return {
    ...input,
    regions,
    // Keep diagnostics separate from the model's prose; never silently hide a lost region.
    coordinateWarnings,
    note: (note + suffix).slice(0, 2000),
  };
}

module.exports = { repairBox, sanitizeAiAnalysis, MAX_EDGE_OVERSHOOT };
