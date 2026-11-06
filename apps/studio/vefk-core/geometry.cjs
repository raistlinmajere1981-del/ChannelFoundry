"use strict";

const { validateNumericGrid } = require("./squares.cjs");

const DEFAULT_VIEWBOX = Object.freeze([0, 0, 1000, 1000]);
const ID = /^[A-Za-z][A-Za-z0-9._-]{0,119}$/;
const ALLOWED_CAPS = new Set(["round", "square", "butt"]);
const SEGMENTS = Object.freeze([
  [[0, 0], [80, 0]], [[80, 0], [80, 65]], [[80, 65], [80, 130]],
  [[80, 130], [0, 130]], [[0, 130], [0, 65]], [[0, 65], [0, 0]],
  [[0, 65], [80, 65]],
]);
const GLYPHS = Object.freeze({
  0: [0, 1, 2, 3, 4, 5], 1: [1, 2], 2: [0, 1, 6, 4, 3],
  3: [0, 1, 6, 2, 3], 4: [5, 6, 1, 2], 5: [0, 5, 6, 2, 3],
  6: [0, 5, 6, 4, 2, 3], 7: [0, 1, 2], 8: [0, 1, 2, 3, 4, 5, 6],
  9: [0, 1, 2, 3, 5, 6], "-": [6],
});

function finite(value, name, min = -100000, max = 100000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number in [${min}, ${max}].`);
  }
  return value;
}

function normalizeViewBox(value) {
  if (!Array.isArray(value) || value.length !== 4) throw new TypeError("viewBox requires four numbers.");
  const result = value.map((number, i) => finite(number, `viewBox[${i}]`));
  if (result[2] <= 0 || result[3] <= 0) throw new RangeError("viewBox dimensions must be positive.");
  if (!Number.isFinite(result[0] + result[2]) || !Number.isFinite(result[1] + result[3])) {
    throw new RangeError("Invalid viewBox boundaries.");
  }
  return result;
}

function normalizePathD(d, viewBox) {
  if (typeof d !== "string" || d.length < 4 || d.length > 8192) throw new TypeError("Invalid SVG path length.");
  // Never parse arbitrary SVG or HTML. Only explicit absolute M, L and Z commands.
  if (/[^MLZ0-9.\-+\s]/.test(d)) throw new Error("Unsafe SVG path syntax: only M/L/Z and numbers are allowed.");
  const tokens = d.trim().match(/[MLZ]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g) || [];
  if (tokens.join(" ").replace(/\s+/g, "") !== d.replace(/\s+/g, "")) {
    throw new Error("Malformed SVG path tokens.");
  }
  if (tokens.length > 4096) throw new RangeError("SVG path is too complex.");
  let i = 0, drawn = false, hasMove = false;
  while (i < tokens.length) {
    const operation = tokens[i++];
    if (operation === "Z") {
      if (!hasMove) throw new Error("Z requires an active subpath.");
      hasMove = false;
      continue;
    }
    if (operation !== "M" && operation !== "L") throw new Error("Expected an explicit SVG path command.");
    if (operation === "L" && !hasMove) throw new Error("L requires a preceding M.");
    if (i + 1 >= tokens.length) throw new Error("SVG path coordinates missing.");
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    finite(x, "path x"); finite(y, "path y");
    if (x < viewBox[0] - 0.0001 || x > viewBox[0] + viewBox[2] + 0.0001
        || y < viewBox[1] - 0.0001 || y > viewBox[1] + viewBox[3] + 0.0001) {
      throw new RangeError("SVG path lies outside viewBox.");
    }
    if (operation === "M") hasMove = true;
    else drawn = true;
  }
  if (!drawn) throw new Error("SVG path must contain at least one line segment.");
  return d.trim().replace(/\s+/g, " ");
}

function checkKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`Unsupported ${label} field: ${key}`);
  }
}

function normalizeGeometry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Missing geometry.");
  checkKeys(input, ["coordinateSpace", "viewBox", "paths", "inkStyles"], "geometry");
  if (input.coordinateSpace !== "svg-viewBox") throw new Error("Geometry must use svg-viewBox coordinates.");
  const viewBox = normalizeViewBox(input.viewBox);
  if (!Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > 1024) {
    throw new RangeError("Geometry requires between 1 and 1024 paths.");
  }
  const ids = new Set();
  const paths = input.paths.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TypeError("Invalid geometry path.");
    checkKeys(raw, ["id", "d", "ink", "semanticValue"], "path");
    if (typeof raw.id !== "string" || !ID.test(raw.id) || ids.has(raw.id)) {
      throw new Error(`Missing, duplicate or invalid path id: ${String(raw.id)}`);
    }
    ids.add(raw.id);
    const ink = raw.ink ?? "glyph";
    if (typeof ink !== "string" || !ID.test(ink)) throw new Error("Invalid ink style id.");
    const path = { id: raw.id, d: normalizePathD(raw.d, viewBox), ink };
    if (raw.semanticValue !== undefined) {
      if (typeof raw.semanticValue !== "string" || raw.semanticValue.length > 120) {
        throw new Error("Invalid semanticValue.");
      }
      path.semanticValue = raw.semanticValue;
    }
    return path;
  });
  const sourceStyles = input.inkStyles ?? { glyph: { width: 8, cap: "round" } };
  if (!sourceStyles || typeof sourceStyles !== "object" || Array.isArray(sourceStyles)) {
    throw new TypeError("inkStyles must be an object.");
  }
  const inkStyles = {};
  for (const [key, value] of Object.entries(sourceStyles)) {
    if (!ID.test(key) || !value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Invalid ink style.");
    }
    checkKeys(value, ["width", "cap"], "ink style");
    const width = finite(value.width, `inkStyles.${key}.width`, 0.01, 100);
    const cap = value.cap ?? "round";
    if (!ALLOWED_CAPS.has(cap)) throw new TypeError("Unsupported line cap.");
    inkStyles[key] = { width, cap };
  }
  if (Object.keys(inkStyles).length > 32) throw new RangeError("Too many ink styles.");
  for (const path of paths) if (!inkStyles[path.ink]) {
    throw new Error(`Path ${path.id} references undefined ink style ${path.ink}.`);
  }
  return { coordinateSpace: "svg-viewBox", viewBox, paths, inkStyles };
}

function rounded(value) {
  return String(Number(value.toFixed(4)));
}

function digitContours(value, centerX, centerY, cellWidth) {
  const symbols = String(value).split("");
  const advance = 94, total = symbols.length * advance - 14;
  const scale = Math.min(0.9 * cellWidth / total, 0.77 * cellWidth / 130);
  const left = centerX - total * scale / 2;
  const top = centerY - 65 * scale;
  const segments = [];
  for (let glyph = 0; glyph < symbols.length; glyph++) {
    const parts = GLYPHS[symbols[glyph]];
    if (!parts) throw new Error("Unsupported numeric glyph.");
    for (const segment of parts) {
      const [[x1, y1], [x2, y2]] = SEGMENTS[segment];
      const xoff = glyph * advance;
      const at = (x, y) => `${rounded(left + (xoff + x) * scale)} ${rounded(top + y * scale)}`;
      segments.push(`M ${at(x1, y1)} L ${at(x2, y2)}`);
    }
  }
  return segments.join(" ");
}

function squareGeometry(grid) {
  const cells = validateNumericGrid(grid);
  const n = cells.length;
  const start = 110, edge = 780, cell = edge / n, end = start + edge;
  const paths = [
    { id: "grid.outer", d: `M ${start} ${start} L ${end} ${start} L ${end} ${end} L ${start} ${end} Z`, ink: "grid" },
  ];
  for (let column = 1; column < n; column++) {
    const x = rounded(start + column * cell);
    paths.push({ id: `grid.v${column}`, d: `M ${x} ${start} L ${x} ${end}`, ink: "grid" });
  }
  for (let row = 1; row < n; row++) {
    const y = rounded(start + row * cell);
    paths.push({ id: `grid.h${row}`, d: `M ${start} ${y} L ${end} ${y}`, ink: "grid" });
  }
  for (let row = 0; row < n; row++) for (let column = 0; column < n; column++) {
    paths.push({
      id: `cell.r${row}c${column}`,
      d: digitContours(cells[row][column], start + (column + 0.5) * cell, start + (row + 0.5) * cell, cell),
      ink: "glyph",
      semanticValue: String(cells[row][column]),
    });
  }
  return normalizeGeometry({
    coordinateSpace: "svg-viewBox",
    viewBox: [...DEFAULT_VIEWBOX],
    paths,
    inkStyles: { grid: { width: 7, cap: "round" }, glyph: { width: 11, cap: "round" } },
  });
}

/** Render trusted, validated geometry; never allow arbitrary SVG nodes or style attributes. */
function geometrySvg(input) {
  const geo = normalizeGeometry(input);
  const paths = geo.paths.map((path) => {
    const style = geo.inkStyles[path.ink];
    const color = path.ink === "grid" ? "#6c5034" : "#503a28";
    return `<path id="${path.id}" d="${path.d}" fill="none" stroke="${color}" stroke-width="${style.width}" stroke-linecap="${style.cap}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${geo.viewBox.join(" ")}" role="img">${paths}</svg>`;
}

module.exports = {
  DEFAULT_VIEWBOX, normalizeViewBox, normalizePathD, normalizeGeometry,
  squareGeometry, digitContours, geometrySvg,
};
