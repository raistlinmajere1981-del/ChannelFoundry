/**
 * Vefk drawing schedule editor: pure deterministic transformations.
 * Explicit document version; legacy callers default to the unchanged v1 shape.
 */
type VefkGeometry = StudioVefkGeometry;
type VefkPlan = StudioVefkDrawPlan;
type VefkStroke = VefkPlan["strokes"][number];

export type TimelineRow = {
  id: string;
  pathId: string;
  ink: string;
  durationMs: number;
  gapBeforeMs: number;
  easing?: StudioVefkStrokeEasing;
};

export type TimelineEdit =
  | { kind: "move"; pathId: string; delta: -1 | 1 }
  | { kind: "duration"; pathId: string; valueMs: number }
  | { kind: "gap"; pathId: string; valueMs: number }
  | { kind: "hold"; valueMs: number };

const strokeCurves: readonly StudioVefkStrokeEasing[] = ["linear", "ease-in", "ease-out", "ease-in-out"];
function requireVersion(plan: VefkPlan, schemaVersion: 1 | 2) {
  if (schemaVersion !== 1 && schemaVersion !== 2) throw new Error("Desteklenmeyen belge sürümü.");
  if (schemaVersion === 1 && plan.strokes.some(stroke => Object.hasOwn(stroke, "easing"))) {
    throw new Error("Kalıcı çizgi içi eğri yalnız v2 belgede kullanılabilir.");
  }
}
const MAX_MS = 3_600_000;
const boundedMs = (value: number, label: string, allowZero = true): number => {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > MAX_MS) {
    throw new RangeError(label + " 0–3.600.000 ms aralığında tam sayı olmalı.");
  }
  return value;
};

function freshStrokeId(used: Set<string>): string {
  for (let i = 1; i <= 1024; i += 1) {
    const id = "stroke." + String(i).padStart(3, "0");
    if (!used.has(id)) { used.add(id); return id; }
  }
  throw new RangeError("Çizim yolu sayısı sınırı aşıldı.");
}

/** Keeps existing timing exactly until the geometry path set/ink actually changes. */
export function reconcileDrawPlan(geometry: VefkGeometry, original: VefkPlan, schemaVersion: 1 | 2 = 1): VefkPlan {
  requireVersion(original, schemaVersion);
  const existing = new Map(geometry.paths.map(path => [path.id, path]));
  const usedPaths = new Set(original.strokes.map(stroke => stroke.pathId));
  if (existing.size === original.strokes.length && usedPaths.size === existing.size &&
      original.strokes.every(stroke => existing.get(stroke.pathId)?.ink === stroke.ink)) {
    return original;
  }
  return scheduleFromRows(geometry, timelineRows(geometry, original, schemaVersion), tailHoldMs(original), schemaVersion);
}

function tailHoldMs(plan: VefkPlan): number {
  const last = plan.strokes.at(-1);
  return Math.max(0, plan.durationMs - (last ? last.startMs + last.durationMs : 0));
}

export function timelineRows(geometry: VefkGeometry, original: VefkPlan, schemaVersion: 1 | 2 = 1): TimelineRow[] {
  requireVersion(original, schemaVersion);
  const paths = new Map(geometry.paths.map(path => [path.id, path]));
  const usedIds = new Set(original.strokes.map(stroke => stroke.id));
  const rows: TimelineRow[] = [];
  let previousEnd = 0;
  for (const stroke of original.strokes) {
    const path = paths.get(stroke.pathId);
    if (path && !rows.some(item => item.pathId === path.id)) {
      rows.push({
        id: stroke.id, pathId: path.id, ink: path.ink,
        durationMs: stroke.durationMs,
        gapBeforeMs: Math.max(0, stroke.startMs - previousEnd),
        ...(schemaVersion === 2 ? { easing: stroke.easing ?? "linear" } : {}),
      });
    }
    previousEnd = stroke.startMs + stroke.durationMs;
  }
  for (const path of geometry.paths) {
    if (!rows.some(item => item.pathId === path.id)) {
      rows.push({
        id: freshStrokeId(usedIds), pathId: path.id, ink: path.ink,
        durationMs: path.ink === "grid" ? 700 : 950, gapBeforeMs: rows.length ? 140 : 0,
        ...(schemaVersion === 2 ? { easing: "linear" as const } : {}),
      });
    }
  }
  return rows;
}

function scheduleFromRows(geometry: VefkGeometry, rows: TimelineRow[], holdMs: number, schemaVersion: 1 | 2): VefkPlan {
  boundedMs(holdMs, "Bitiriş beklemesi");
  if (rows.length !== geometry.paths.length || rows.length === 0) {
    throw new Error("Her vektör yolu için tam bir zaman çizgisi gerekli.");
  }
  const sourcePaths = new Map(geometry.paths.map(path => [path.id, path]));
  const used = new Set<string>(), usedStrokeIds = new Set<string>();
  let cursor = 0, inscriptionAt: number | null = null;
  const strokes: VefkStroke[] = rows.map(row => {
    const path = sourcePaths.get(row.pathId);
    if (!path || used.has(row.pathId) || usedStrokeIds.has(row.id) || !row.id.match(/^[A-Za-z][A-Za-z0-9._-]*$/)) {
      throw new Error("Çizim sırası: tekrarlanan veya bulunamayan yol/stroke.");
    }
    used.add(row.pathId); usedStrokeIds.add(row.id);
    cursor += boundedMs(row.gapBeforeMs, "Kalem geçişi");
    if (path.ink !== "grid" && inscriptionAt === null) inscriptionAt = cursor;
    const stroke: VefkStroke = {
      id: row.id, pathId: row.pathId,
      startMs: cursor,
      durationMs: boundedMs(row.durationMs, "Çizgi süresi", false),
      ink: path.ink, pen: "down",
      ...(schemaVersion === 2 ? { easing: row.easing ?? "linear" } : {}),
    };
    cursor += stroke.durationMs;
    if (cursor > MAX_MS) throw new RangeError("Toplam çizim süresi bir saati aşıyor.");
    return stroke;
  });
  const markers: VefkPlan["markers"] = [{ id: "outline", atMs: 0 }];
  if (inscriptionAt !== null && inscriptionAt > 0) markers.push({ id: "inscriptions", atMs: inscriptionAt });
  markers.push({ id: "hold", atMs: cursor });
  if (cursor + holdMs > MAX_MS) throw new RangeError("Son beklemeyle toplam süre bir saati aşıyor.");
  return { timeUnit: "ms", durationMs: cursor + holdMs, markers, strokes };
}

export function changeDrawPlan(geometry: VefkGeometry, original: VefkPlan, edit: TimelineEdit, schemaVersion: 1 | 2 = 1): VefkPlan {
  const rows = timelineRows(geometry, original, schemaVersion);
  let holdMs = tailHoldMs(original);
  if (edit.kind === "hold") {
    holdMs = boundedMs(edit.valueMs, "Bitiriş beklemesi");
  } else {
    const index = rows.findIndex(row => row.pathId === edit.pathId);
    if (index < 0) throw new Error("Çizim zaman çizelgesinde yol bulunamadı.");
    if (edit.kind === "move") {
      const target = index + edit.delta;
      if (target < 0 || target >= rows.length) return reconcileDrawPlan(geometry, original, schemaVersion);
      [rows[index], rows[target]] = [rows[target], rows[index]];
    } else if (edit.kind === "duration") {
      rows[index].durationMs = boundedMs(edit.valueMs, "Çizgi süresi", false);
    } else {
      rows[index].gapBeforeMs = boundedMs(edit.valueMs, "Kalem geçişi");
    }
  }
  return scheduleFromRows(geometry, rows, holdMs, schemaVersion);
}

function pathInkUnits(d: string): number {
  const tokens = d.trim().split(/\s+/);
  const distance = (a: {x:number;y:number},b: {x:number;y:number}) =>
    Math.hypot(b.x-a.x,b.y-a.y);
  let previous: {x:number;y:number}|null = null;
  let origin: {x:number;y:number}|null = null;
  let ink = 0, lift = 0;
  for (let i=0; i<tokens.length;) {
    const op=tokens[i++];
    if(op==="Z") {
      if(!previous||!origin)throw new Error("Vefk yolu eksik.");
      ink+=distance(previous,origin);previous=origin;continue;
    }
    if((op!=="M"&&op!=="L")||i+1>=tokens.length)
      throw new Error("Divit süresi yalnız güvenli M/L/Z yollarında hesaplanır.");
    const point={x:Number(tokens[i++]),y:Number(tokens[i++])};
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))
      throw new Error("Vefk yol koordinatları geçersiz.");
    if(op==="M") {
      if(previous)lift+=distance(previous,point);
      origin=point;
    } else {
      if(!previous)throw new Error("Çizgiden önce başlangıç gerekli.");
      ink+=distance(previous,point);
    }
    previous=point;
  }
  // Matches the canonical player's bounded lift allocation.
  return ink+Math.min(lift*.35,ink*.30);
}

/** Recommends consistent nib travel speed while preserving authored gaps, order
 * and final hold. Explicit user action only; no schema or player changes. */
export function balanceStrokeDurations(
  geometry: VefkGeometry, original: VefkPlan, unitsPerSecond = 180, schemaVersion: 1 | 2 = 1,
): VefkPlan {
  if (!Number.isFinite(unitsPerSecond) || unitsPerSecond < 60 || unitsPerSecond > 600)
    throw new RangeError("Divit hızı 60–600 birim/sn aralığında olmalı.");
  const rows = timelineRows(geometry, original, schemaVersion);
  const byPath = new Map(geometry.paths.map(p => [p.id, p.d]));
  for(const row of rows){
    const d=byPath.get(row.pathId);
    if(!d)throw new Error("Zamanlama yolu bulunamadı.");
    const units=pathInkUnits(d);
    row.durationMs=Math.max(180,Math.min(6000,Math.round(units*1000/unitsPerSecond)));
  }
  return scheduleFromRows(geometry, rows, tailHoldMs(original), schemaVersion);
}

/**
 * S4 canonical-compatible tempo envelopes between complete SVG paths.
 * Internal easing is independent: v1 stays linear; v2 retains each path's curve.
 */
export type StrokeTempoCurve = "slow-opening" | "slow-ending" | "ceremony";
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function applyStrokeTempoCurve(
  geometry: VefkGeometry, original: VefkPlan, curve: StrokeTempoCurve, schemaVersion: 1 | 2 = 1,
): VefkPlan {
  if (!["slow-opening", "slow-ending", "ceremony"].includes(curve)) {
    throw new RangeError("Bilinmeyen divit tempo eğrisi.");
  }
  const rows = timelineRows(geometry, original, schemaVersion);
  if (rows.length < 2) return original;
  const budget = rows.reduce((sum, row) => sum + row.durationMs, 0);
  if (!Number.isSafeInteger(budget) || budget < rows.length || budget > MAX_MS)
    throw new RangeError("Tempo eğrisi toplam çizim süresi geçersiz.");
  // Derive the tempo reference from geometry, not previously curved durations.
  // Applying the same preset twice must not accelerate it a second time.
  const byPath = new Map(geometry.paths.map(path => [path.id,path.d]));
  const units = rows.map(row => {
    const d = byPath.get(row.pathId);
    if (!d) throw new Error("Tempo eğrisi için çizim yolu bulunamadı.");
    return Math.max(12, pathInkUnits(d));
  });
  const totalUnits = units.reduce((sum,value) => sum + value,0);
  let elapsed = 0;
  const weights = units.map(value => {
    const midpoint = (elapsed + value / 2) / totalUnits;
    elapsed += value;
    const s = smoothstep(midpoint);
    const envelope = curve === "slow-opening"
      ? 1.50 - .75 * s
      : curve === "slow-ending"
        ? .75 + .75 * s
        : .80 + .70 * smoothstep(Math.abs(2 * midpoint - 1));
    return value * envelope;
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const available = budget - rows.length; // at least 1 ms per stroke
  const proportional = weights.map(value => available * value / totalWeight);
  const allocations = proportional.map(value => Math.floor(value));
  const remaining = available - allocations.reduce((sum, value) => sum + value, 0);
  const priority = proportional.map((value, index) => ({
    index, fraction: value - allocations[index],
  })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remaining; i++) allocations[priority[i].index]++;
  rows.forEach((row, index) => { row.durationMs = 1 + allocations[index]; });
  return scheduleFromRows(geometry, rows, tailHoldMs(original), schemaVersion);
}

export function previewFraction(stroke: VefkStroke, ms: number): number {
  if (!Number.isFinite(ms)) throw new TypeError("Geçersiz oynatma zamanı.");
  return Math.max(0, Math.min(1, (ms - stroke.startMs) / stroke.durationMs));
}

/** Only an explicitly versioned v2 document can author persistent easing.
 * Keep exact timings/markers, including any authored gaps and final hold. */
export function setStrokeEasing(
  geometry: VefkGeometry, plan: VefkPlan, pathId: string,
  curve: StudioVefkStrokeEasing, schemaVersion: 1 | 2,
): VefkPlan {
  requireVersion(plan, schemaVersion);
  if (schemaVersion !== 2) throw new Error("Kalıcı çizgi içi eğri yalnız v2 belgede kullanılabilir.");
  if (!strokeCurves.includes(curve)) throw new RangeError("Bilinmeyen çizgi içi eğri.");
  const reconciled = reconcileDrawPlan(geometry, plan, schemaVersion);
  if (!reconciled.strokes.some(stroke => stroke.pathId === pathId)) {
    throw new Error("Çizim zaman çizelgesinde yol bulunamadı.");
  }
  return { ...reconciled, strokes: reconciled.strokes.map(stroke =>
    stroke.pathId === pathId ? { ...stroke, easing: curve } : stroke) };
}
