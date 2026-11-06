export function reviewQueue(result: StudioVefkSourceAnalysisResult | null) {
  if (!result) return [];
  return [
    ...(result.grid?.cells ?? []).filter(cell => !cell.reviewed).map(cell => ({
      id: `cell-${cell.row}-${cell.column}`, label: `Hücre ${cell.row + 1} / ${cell.column + 1}`,
      confidence: cell.confidence, eligible: Boolean(cell.text.trim()),
    })),
    ...result.regions.filter(region => !region.reviewed).map(region => ({
      id: region.id, label: region.label || region.kind, confidence: region.confidence,
      eligible: region.kind !== "unknown" && (Boolean(region.label) || ["line", "grid"].includes(region.kind)),
    })),
  ];
}
export function approveItems(result: StudioVefkSourceAnalysisResult, ids: string[]) {
  const allowed = new Set(reviewQueue(result).filter(item => item.eligible && ids.includes(item.id)).map(item => item.id));
  return { ...result,
    regions: result.regions.map(region => allowed.has(region.id) ? { ...region, reviewed: true, needsReview: false } : region),
    grid: result.grid ? { ...result.grid, cells: result.grid.cells.map(cell => allowed.has(`cell-${cell.row}-${cell.column}`)
      ? { ...cell, reviewed: true, needsReview: false } : cell) } : null,
  };
}
export function cellBox(result: StudioVefkSourceAnalysisResult, cell: StudioVefkCell): [number, number, number, number] | null {
  const grid = result.grid;
  const region = result.regions.filter(item => item.kind === "grid").sort((a,b) => b.box[2]*b.box[3] - a.box[2]*a.box[3])[0];
  if (!grid || !region) return null;
  const [x,y,w,h] = region.box;
  return [x + cell.column*w/grid.columns, y + cell.row*h/grid.rows, w/grid.columns, h/grid.rows];
}
