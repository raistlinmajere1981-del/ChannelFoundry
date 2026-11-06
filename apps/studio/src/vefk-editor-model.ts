export type EditorTool = "select" | "line" | "rectangle" | "diamond" | "freehand";
export type Point2 = { x: number; y: number };

export function round4(value: number): number {
  return Number(value.toFixed(4));
}
export function clampPoint(point: Point2, viewBox: [number, number, number, number], snap = 0): Point2 {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error("Geçersiz koordinat.");
  const [x, y, width, height] = viewBox;
  const bound = (number: number, low: number, high: number) => Math.min(high, Math.max(low, number));
  return {
    x: round4(bound(snap > 0 ? Math.round(point.x / snap) * snap : point.x, x, x + width)),
    y: round4(bound(snap > 0 ? Math.round(point.y / snap) * snap : point.y, y, y + height)),
  };
}

type Segment = { command: "M" | "L"; x: number; y: number } | { command: "Z" };
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function decodePath(d: string): Segment[] {
  const tokens = d.trim().split(/\s+/);
  const result: Segment[] = [];
  for (let index = 0; index < tokens.length;) {
    const cmd = tokens[index++];
    if (cmd === "Z") { result.push({ command: "Z" }); continue; }
    if (cmd !== "M" && cmd !== "L" || index + 1 >= tokens.length) throw new Error("Geçersiz SVG çizgisi.");
    const xRaw = tokens[index++], yRaw = tokens[index++];
    if (!NUMBER.test(xRaw) || !NUMBER.test(yRaw)) throw new Error("Desteklenmeyen SVG koordinatı.");
    const x = Number(xRaw), y = Number(yRaw);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Geçersiz çizgi koordinatı.");
    result.push({ command: cmd, x, y });
  }
  if (!result.length || result[0].command !== "M") throw new Error("Çizgi başlangıcı yok.");
  return result;
}

function encodePath(segments: Segment[]): string {
  return segments.map((segment) => segment.command === "Z"
    ? "Z"
    : `${segment.command} ${round4(segment.x)} ${round4(segment.y)}`).join(" ");
}

export function pathBounds(d: string): { x: number; y: number; width: number; height: number } {
  const vertices = decodePath(d).filter((entry): entry is Extract<Segment, { x: number }> => entry.command !== "Z");
  const xs = vertices.map(p => p.x), ys = vertices.map(p => p.y);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/** Moves a single path without changing its stable id or construction metadata. */
export function movePath(d: string, dx: number, dy: number, viewBox: [number, number, number, number]): string {
  const segments = decodePath(d);
  if (![dx, dy].every(Number.isFinite)) throw new Error("Geçersiz taşıma koordinatı.");
  const moved = segments.map(segment => segment.command === "Z"
    ? segment
    : { ...segment, x: round4(segment.x + dx), y: round4(segment.y + dy) });
  const vertices = moved.filter((entry): entry is Extract<Segment, { x: number }> => entry.command !== "Z");
  const [x, y, width, height] = viewBox;
  if (vertices.some(p => p.x < x || p.x > x + width || p.y < y || p.y > y + height)) {
    throw new Error("Nesne çalışma alanının dışına taşınamaz.");
  }
  return encodePath(moved);
}

export function scalePath(d: string, factor: number, viewBox: [number, number, number, number]): string {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 5) throw new Error("Geçersiz ölçek.");
  const bounds = pathBounds(d);
  const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
  const scaled = decodePath(d).map(segment => segment.command === "Z"
    ? segment : {
      ...segment,
      x: round4(centerX + (segment.x - centerX) * factor),
      y: round4(centerY + (segment.y - centerY) * factor),
    });
  const vertices = scaled.filter((entry): entry is Extract<Segment, { x: number }> => entry.command !== "Z");
  const [x, y, width, height] = viewBox;
  if (vertices.some(p => p.x < x || p.x > x + width || p.y < y || p.y > y + height)) {
    throw new Error("Ölçekleme alanın dışına çıkıyor.");
  }
  return encodePath(scaled);
}

export function shapePath(tool: Exclude<EditorTool, "select">,
  start: Point2, end: Point2, trail: Point2[] = []): string {
  const xy = (p: Point2) => `${round4(p.x)} ${round4(p.y)}`;
  if (tool === "line") return `M ${xy(start)} L ${xy(end)}`;
  if (tool === "rectangle") return [
    `M ${xy(start)}`,
    `L ${xy({ x: end.x, y: start.y })}`,
    `L ${xy(end)}`,
    `L ${xy({ x: start.x, y: end.y })}`,
    "Z",
  ].join(" ");
  if (tool === "diamond") {
    const midX = (start.x + end.x) / 2, midY = (start.y + end.y) / 2;
    return [
      `M ${xy({ x: midX, y: start.y })}`,
      `L ${xy({ x: end.x, y: midY })}`,
      `L ${xy({ x: midX, y: end.y })}`,
      `L ${xy({ x: start.x, y: midY })}`, "Z",
    ].join(" ");
  }
  if (tool === "freehand") {
    const points = [start, ...trail, end];
    const distinct = points.filter((p, i) => i === 0 ||
      Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) >= 2);
    if (distinct.length < 2) distinct.push(end);
    // Bound the path complexity for the S1 validator.
    const step = Math.max(1, Math.ceil(distinct.length / 400));
    const reduced = distinct.filter((_, index) => index % step === 0);
    if (reduced[reduced.length - 1] !== distinct[distinct.length - 1]) reduced.push(distinct[distinct.length - 1]);
    return reduced.map((p, i) => `${i ? "L" : "M"} ${xy(p)}`).join(" ");
  }
  throw new Error("Bilinmeyen çizim aracı.");
}

export function nextPathId(paths: Array<{ id: string }>): string {
  const used = new Set(paths.map(path => path.id));
  for (let index = 1; index < 10000; index++) {
    const id = `mark.${String(index).padStart(3, "0")}`;
    if (!used.has(id)) return id;
  }
  throw new Error("Yeni yol için kimlik kalmadı.");
}

/** Rendering only: distribute the canonical ink fraction over SVG subpaths.
 * SVG dash patterns restart at M; splitting avoids revealing later pen strokes
 * while the canonical nib is still drawing an earlier one. No timing is made here. */
export function visibleSubpaths(d: string, fraction: number) {
  const pieces: Array<{ d: string; length: number; prefix: number }> = [];
  let x = 0, y = 0, startX = 0, startY = 0, total = 0;
  for (const segment of decodePath(d)) {
    if (segment.command === "M") {
      x = startX = segment.x; y = startY = segment.y;
      pieces.push({ d: `M ${x} ${y}`, length: 0, prefix: total });
    } else {
      const nextX = segment.command === "Z" ? startX : segment.x;
      const nextY = segment.command === "Z" ? startY : segment.y;
      const length = Math.hypot(nextX-x, nextY-y);
      const piece = pieces[pieces.length-1];
      piece.d += segment.command === "Z" ? " Z" : ` L ${nextX} ${nextY}`;
      piece.length += length; total += length; x = nextX; y = nextY;
    }
  }
  const visible = Math.min(1, Math.max(0, fraction))*total;
  return pieces.map(piece => ({ d: piece.d, fraction: piece.length > 0
    ? Math.min(1, Math.max(0, (visible-piece.prefix)/piece.length)) : 0 }));
}
