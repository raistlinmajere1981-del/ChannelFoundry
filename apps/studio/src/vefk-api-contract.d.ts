type StudioVefkStatus = "draft" | "checked" | "approved" | "published";
type StudioVefkCatalogSelection = {
  id: string;
  revision: number;
  contentHash: string;
  sortOrder: number;
  selectedAt: string;
};
type StudioVefkKind = "magicSquare" | "manualSquare" | "manualPaths";

type StudioVefkGeometry = {
  coordinateSpace: "svg-viewBox";
  viewBox: [number, number, number, number];
  paths: Array<{ id: string; d: string; ink: string; semanticValue?: string }>;
  inkStyles: Record<string, { width: number; cap: "round" | "square" | "butt" }>;
};

type StudioVefkStrokeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

type StudioVefkDrawPlan = {
  timeUnit: "ms";
  durationMs: number;
  markers: Array<{ id: string; atMs: number }>;
  strokes: Array<{ id: string; pathId: string; startMs: number; durationMs: number; ink: string; pen: "down"; easing?: StudioVefkStrokeEasing }>;
};

type StudioVefkDocument = {
  format: "birdesengor.vefk";
  schemaVersion: 1 | 2;
  id: string;
  revision: number;
  title: string;
  description: string;
  language: string;
  provenance: { kind: "manual" | "traditional-reference" | "algorithmic"; references: string[]; notes: string };
  construction: {
    kind: StudioVefkKind;
    algorithmId: "siamese-odd" | "manual";
    algorithmVersion: string;
    parameters: Record<string, number>;
    grid?: number[][];
    checks: { passed: boolean; expectedSum?: number; rowSums?: number[]; columnSums?: number[]; diagonalSums?: number[]; verification?: string };
  };
  geometry: StudioVefkGeometry;
  drawPlan: StudioVefkDrawPlan;
  accessibility: { summary: string; matrixText: string };
  contentHash: string;
  generatedAt?: string;
};

type StudioVefkCreateInput = {
  schemaVersion?: 1 | 2;
  id: string;
  revision?: number;
  title: string;
  description?: string;
  language?: string;
  kind?: StudioVefkKind;
  parameters?: { order?: number; first?: number; step?: number };
  grid?: number[][];
  geometry?: StudioVefkGeometry;
  drawPlan?: StudioVefkDrawPlan;
  timing?: { gridMs?: number; glyphMs?: number; gapMs?: number; holdMs?: number };
  provenance?: StudioVefkDocument["provenance"];
  accessibility?: StudioVefkDocument["accessibility"];
};

type StudioVefkRevision = {
  id: string;
  revision: number;
  status: StudioVefkStatus;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  checkedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
};

type StudioVefkRecord = StudioVefkRevision & { document: StudioVefkDocument };
type StudioVefkListItem = {
  id: string;
  title: string;
  currentRevision: number;
  status: StudioVefkStatus;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
};
