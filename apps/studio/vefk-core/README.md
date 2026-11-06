# BirDeSenGör Studio · Vefk Core S1

**Status:** implemented and testable (S1 only). No Electron IPC, SQLite tables, UI, V2 runtime, effect engine, publication, or deploy integration is included.

## Run tests

From the ChannelFoundry repository root:

```bash
node --test apps/studio/vefk-core/*.test.cjs
```

Requires a current Node.js with built-in `node:test`, `node:assert/strict`, and `node:crypto`. The module itself has **zero external dependencies**.

## Core API

```js
const vefk = require("./apps/studio/vefk-core/index.cjs");

const square = vefk.createVefk({
  id: "vefk-example-3",
  revision: 1,
  title: "A mathematical square",
  kind: "magicSquare",
  parameters: { order: 3, first: 1, step: 1 },
});

const json = vefk.serializeVefk(square);
const decoded = vefk.parseVefk(json);
const svg = vefk.geometrySvg(decoded.geometry);
const atHalfSecond = vefk.progressAt(decoded.drawPlan, 500);
```

Additional supported methods:

- `kind: "manualSquare"` with `grid: number[][]`: stores a numeric matrix without claiming it is magic, and generates a path for each cell.
- `kind: "manualPaths"` with `geometry`: validated vector paths, independent of the square algorithm. An example of `geometry` is `{coordinateSpace:"svg-viewBox",viewBox:[0,0,100,100],paths:[{id:"symbol.outer",d:"M 10 10 L 90 90",ink:"glyph"}],inkStyles:{glyph:{width:3,cap:"round"}}}`.
- Optional `provenance`, `description`, `accessibility`, `language`, `drawPlan` or simple `timing` are supported.
- Functions `siameseSquare`, `magicSquareChecks`, `assertMagicSquare`, `squareGeometry`, `normalizeGeometry`, `drawPlanFor`, `validateDrawPlan`, `validateVefk`, `documentHash`, `canonicalString` are also exported.

## Published document contract

The wire model is `birdesengor.vefk`, `schemaVersion: 1`: stable identity and revision, description and provenance, construction, geometry, drawPlan, accessibility and SHA-256 `contentHash`. See `docs/contracts/vefk-v1.example.json`, which validates with the current core without modification.

`createVefk` returns a **deep-frozen**, validated document. The content hash is computed using a canonical key-sorted representation of all **published semantic fields**, including the drawing sequence. Non-published input such as `generatedAt` and `editorState` never enters generated documents; an optional top-level `generatedAt` on imported documents is validated but excluded from the hash. Field/property order does not change the fingerprint.

The canonical document must remain independent of scene object IDs, physical layout, camera placement and effect anchor IDs. V2 uses an external binding manifest (`vefk-stand.ink-plane`, `quill.tip`), which this module does not interpret.

## Guarantees

- Algorithm: up-left Siamese, orders 3/5/7 only. The canonical 3×3 orientation starts with `6 1 8` / `7 5 3` / `2 9 4`. `first` and nonzero `step` are safe integers. Grid uniqueness, exact arrangement, rows, columns and both diagonals are checked.
- Vector: fixed 1000×1000 SVG viewBox for generated grids, stable `grid.*` and `cell.rNcN` IDs. Multi-digit/negative numbers are drawn as scalable 7-segment vector paths rather than platform-dependent font glyphs. This is an engineering placeholder for S3's finalized inscription typography, not a historical calligraphic style.
- Security: only absolute `M`, `L`, `Z` SVG path commands; no markup/script, external references, CSS, dynamic font references or imported raw SVG.
- Timeline: ordered, non-overlapping, one stroke per geometry path, every stroke has a valid reference, ink style and bounded relative millisecond times. `progressAt` is stateless: seek, pause and rewind produce the same per-path fraction at the same time.
- Validator: rejects unsupported schemas, unknown fields, invalid geometry, duplicate IDs, broken magic squares and stale hashes.

## S1 limits and next work

S1 deliberately does **not** provide an interactive editor, database persistence, glyph/font layout, time-editing UI, scene rendering, physics, decorative ink effects or Natro publication. In S3 replace schematic 7-segment glyphs with editor-authored vector contours (without changing the wire contract), and in S4 derive nib position from the same path used for ink-length progress.

Mathematical verification validates arrangement and numeric sums; it makes no claim about metaphysical effects.
