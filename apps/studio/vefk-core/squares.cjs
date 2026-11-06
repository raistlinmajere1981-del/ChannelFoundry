"use strict";

const SUPPORTED_ORDERS = Object.freeze([3, 5, 7]);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

function requireSafeInteger(value, name) {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be a safe integer.`);
  return value;
}

function safeFromBigInt(value, label) {
  if (value < MIN_SAFE || value > MAX_SAFE) {
    throw new RangeError(`${label} exceeds the safe integer range.`);
  }
  return Number(value);
}

function requireOrder(order) {
  if (!SUPPORTED_ORDERS.includes(order)) {
    throw new RangeError(`Only odd orders ${SUPPORTED_ORDERS.join(", ")} are supported by S1.`);
  }
  return order;
}

function requireParameters(input = {}) {
  const order = requireOrder(input.order ?? 3);
  const first = requireSafeInteger(input.first ?? 1, "first");
  const step = requireSafeInteger(input.step ?? 1, "step");
  if (step === 0) throw new RangeError("step cannot be zero: all cells must be unique.");
  const last = BigInt(first) + BigInt(step) * BigInt(order * order - 1);
  safeFromBigInt(last, "Sequence");
  magicSum(order, first, Number(last));
  return { order, first, step };
}

function magicSum(order, first, last) {
  return safeFromBigInt(BigInt(order) * (BigInt(first) + BigInt(last)) / 2n, "Magic sum");
}

/** Siamese movement goes up-left, matching the 6/1/8;7/5/3;2/9/4 fixture. */
function siameseSquare(input = {}) {
  const { order, first, step } = requireParameters(input);
  const grid = Array.from({ length: order }, () => Array(order).fill(null));
  let row = 0;
  let column = Math.floor(order / 2);
  for (let index = 0; index < order * order; index += 1) {
    const value = safeFromBigInt(BigInt(first) + BigInt(index) * BigInt(step), "Cell");
    grid[row][column] = value;
    const up = (row - 1 + order) % order;
    const left = (column - 1 + order) % order;
    if (grid[up][left] !== null) row = (row + 1) % order;
    else { row = up; column = left; }
  }
  return grid;
}

function validateNumericGrid(grid, { minOrder = 1, maxOrder = 9 } = {}) {
  if (!Array.isArray(grid) || !Number.isInteger(grid.length)
      || grid.length < minOrder || grid.length > maxOrder) {
    throw new RangeError(`Grid must have ${minOrder}–${maxOrder} rows.`);
  }
  const order = grid.length;
  return grid.map((row, index) => {
    if (!Array.isArray(row) || row.length !== order) {
      throw new TypeError(`Grid row ${index} must have exactly ${order} cells.`);
    }
    return row.map((value, column) => requireSafeInteger(value, `grid[${index}][${column}]`));
  });
}

function sumSafe(values, label) {
  return safeFromBigInt(values.reduce((sum, value) => sum + BigInt(value), 0n), label);
}

function magicSquareChecks(grid, input) {
  const { order, first, step } = requireParameters(input);
  const cells = validateNumericGrid(grid, { minOrder: order, maxOrder: order });
  const last = safeFromBigInt(BigInt(first) + BigInt(step) * BigInt(order * order - 1), "Sequence");
  const expectedSum = magicSum(order, first, last);
  const rowSums = cells.map((row, index) => sumSafe(row, `row ${index}`));
  const columnSums = Array.from({ length: order }, (_, column) =>
    sumSafe(cells.map(row => row[column]), `column ${column}`));
  const diagonalSums = [
    sumSafe(cells.map((row, i) => row[i]), "diagonal 1"),
    sumSafe(cells.map((row, i) => row[order - 1 - i]), "diagonal 2"),
  ];
  const expected = Array.from({ length: order * order }, (_, index) =>
    safeFromBigInt(BigInt(first) + BigInt(index) * BigInt(step), "Cell"));
  const actual = cells.flat();
  const sameValues = new Set(actual).size === actual.length
    && actual.length === expected.length
    && expected.every(value => actual.includes(value));
  const canonical = siameseSquare({ order, first, step });
  const correctArrangement = cells.every((row, r) =>
    row.every((value, c) => value === canonical[r][c]));
  const passed = sameValues && correctArrangement
    && [...rowSums, ...columnSums, ...diagonalSums].every(value => value === expectedSum);
  return { rowSums, columnSums, diagonalSums, expectedSum, passed };
}

function assertMagicSquare(grid, params) {
  const checks = magicSquareChecks(grid, params);
  if (!checks.passed) throw new Error("Magic square values, arrangement, or sums are invalid.");
  return checks;
}

module.exports = {
  SUPPORTED_ORDERS, requireSafeInteger, requireParameters,
  siameseSquare, validateNumericGrid, magicSquareChecks, assertMagicSquare,
};
