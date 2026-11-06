import test from "node:test";
import assert from "node:assert/strict";
import {
  clampPoint, decodePath, movePath, nextPathId, pathBounds, scalePath, shapePath,
} from "./vefk-editor-model.ts";

const viewBox = [0, 0, 1000, 1000];

test("snap and clamp keep geometry in the defined artboard", () => {
  assert.deepEqual(clampPoint({ x: 104.5, y: -19 }, viewBox, 10), { x: 100, y: 0 });
  assert.deepEqual(clampPoint({ x: 1002, y: 997 }, viewBox, 10), { x: 1000, y: 1000 });
  assert.deepEqual(clampPoint({ x: 105.123456, y: 400.25 }, viewBox), { x: 105.1235, y: 400.25 });
  assert.throws(() => clampPoint({ x: Infinity, y: 0 }, viewBox));
});

test("SVG model parses explicit line segments, supports Z and rejects unsafe commands", () => {
  assert.deepEqual(decodePath("M 10 10 L 30 20 Z"), [
    { command: "M", x: 10, y: 10 },
    { command: "L", x: 30, y: 20 },
    { command: "Z" },
  ]);
  for (const unsafe of ["M 1 1 C 5 7 2 2 4 4", "M 0 0 onclick=alert(1)",
    "M 0 0 L 1e+10 2", "L 2 2", "M 0 0 L NaN 5"]) {
    assert.throws(() => decodePath(unsafe));
  }
});

test("drag move preserves path command sequence and stable ids", () => {
  const input = "M 120 120 L 180 120 L 180 180 L 120 180 Z";
  const moved = movePath(input, 30, -10, viewBox);
  assert.equal(moved, "M 150 110 L 210 110 L 210 170 L 150 170 Z");
  assert.deepEqual(pathBounds(moved), { x: 150, y: 110, width: 60, height: 60 });
  assert.equal(movePath(moved, -30, 10, viewBox), input);
  assert.throws(() => movePath(input, -200, 0, viewBox), /dışına/);
});

test("scale with fixed center fits the artboard and rejects out-of-range factors", () => {
  const input = "M 200 200 L 400 200 L 400 400 L 200 400 Z";
  assert.deepEqual(pathBounds(scalePath(input, 0.5, viewBox)),
    { x: 250, y: 250, width: 100, height: 100 });
  assert.throws(() => scalePath(input, 0, viewBox));
  assert.throws(() => scalePath(input, 10, viewBox));
  assert.throws(() => scalePath(input, 5, viewBox), /dışına/);
});

test("rectangle, line, diamond and freehand use S1-approved M/L/Z path notation", () => {
  const start = { x: 100, y: 100 }, end = { x: 400, y: 300 };
  for (const tool of ["line", "rectangle", "diamond", "freehand"]) {
    const d = shapePath(tool, start, end, [
      { x: 120, y: 130 }, { x: 250, y: 180 }, { x: 320, y: 200 },
    ]);
    assert.ok(d.startsWith("M "));
    assert.match(d, /^[MLZ0-9 .+-]+$/);
    assert.ok(decodePath(d).length >= 2);
  }
  assert.equal(shapePath("rectangle", start, end), "M 100 100 L 400 100 L 400 300 L 100 300 Z");
});

test("new freehand ids remain stable and collision-free", () => {
  const rows = [{ id: "mark.001" }, { id: "mark.003" }, { id: "grid.outer" }];
  assert.equal(nextPathId(rows), "mark.002");
  assert.equal(nextPathId([...rows, { id: "mark.002" }]), "mark.004");
});
