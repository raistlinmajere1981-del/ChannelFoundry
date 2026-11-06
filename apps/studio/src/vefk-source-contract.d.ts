type StudioVefkSource = {
  id: string;
  sha256: string;
  filename: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  bytes: number;
  createdAt: string;
  duplicate?: boolean;
  lastAnalysisId?: number | null;
};
type StudioVefkPreparationConfig = {
  corners: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  contrast: number;
  brightness: number;
};
type StudioVefkPreparation = {
  revision: number;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  config: StudioVefkPreparationConfig;
  createdAt: string;
};
type StudioVefkSourceImage = StudioVefkSource & {
  imageDataUrl: string;
  originalImageDataUrl: string;
  preparation: StudioVefkPreparation | null;
};
type StudioVefkRegion = {
  id: string;
  kind: "grid" | "number" | "text" | "symbol" | "line" | "seal" | "unknown";
  box: [number, number, number, number];
  label: string;
  confidence: number;
  reviewed: boolean;
  needsReview: boolean;
};
type StudioVefkCell = {
  row: number;
  column: number;
  text: string;
  confidence: number;
  reviewed: boolean;
  needsReview: boolean;
};
type StudioVefkSourceAnalysisResult = {
  schema: "vefk.source-analysis.v1";
  coordinateSpace: "normalized-1000";
  preparationRevision: number;
  orientation: "ltr" | "rtl" | "mixed" | "unknown";
  note: string;
  coordinateWarnings: Array<{
    regionIndex: number;
    action: "clipped" | "skipped" | "kind-unknown";
    originalBox: number[] | null;
    box: number[] | null;
    reason: string;
  }>;
  regions: StudioVefkRegion[];
  grid: { rows: number; columns: number; cells: StudioVefkCell[] } | null;
  traces: Array<{
    regionId: string;
    reviewed: boolean;
    paths: Array<{ id: string; d: string }>;
  }>;
};
type StudioVefkSourceAnalysis = {
  id: number;
  sourceId: string;
  origin: "ai" | "review";
  status: "proposed" | "reviewed";
  provider: string;
  model: string;
  createdAt: string;
  result: StudioVefkSourceAnalysisResult;
};
type StudioVefkVisionSupport = {
  supported: boolean;
  provider: string;
  model: string;
  reason: string;
};
