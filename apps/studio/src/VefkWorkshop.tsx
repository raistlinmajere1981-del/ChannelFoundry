import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import VefkTimelineEditor from "./VefkTimelineEditor";
import { reconcileDrawPlan } from "./vefk-timeline-model";
import { studioPenPose } from "./vefk-pen-pose";
import type { IntraStrokeCurve } from "./vefk-intrastroke-preview";
import { createEditorPreviewPlayer, editorInput, persistentMotionInput } from "./vefk-motion-editor";
import {
  clampPoint, movePath, nextPathId, pathBounds, scalePath, shapePath,
  type EditorTool, type Point2,
} from "./vefk-editor-model";
import VefkSourceWorkbench from "./VefkSourceWorkbench";
import "./vefk-workshop.css";

type Bridge = NonNullable<typeof window.channelFoundryStudio>;
type Document = StudioVefkDocument;
type Path = StudioVefkGeometry["paths"][number];
type Status = StudioVefkStatus | "new";
type ShapeTool = Exclude<EditorTool, "select">;
type Gesture =
  | { kind: "move"; pathId: string; original: string; start: Point2 }
  | { kind: "shape"; tool: ShapeTool; start: Point2; trail: Point2[] };

const statusLabels: Record<Status, string> = {
  new: "Yeni", draft: "Taslak", checked: "Kontrolde", approved: "Onaylı", published: "Yayınlandı",
};
const kindLabels: Record<StudioVefkKind, string> = {
  magicSquare: "Siamese kare", manualSquare: "Manuel kare", manualPaths: "Serbest çizim",
};
const tools: Array<{ id: EditorTool; label: string; symbol: string }> = [
  { id: "select", label: "Seç / taşı", symbol: "↖" },
  { id: "line", label: "Çizgi", symbol: "╱" },
  { id: "rectangle", label: "Dikdörtgen", symbol: "▭" },
  { id: "diamond", label: "Baklava", symbol: "◇" },
  { id: "freehand", label: "Serbest çiz", symbol: "✎" },
];
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

function randomId() {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 12).replaceAll("-", "")
    : Math.random().toString(36).slice(2, 14);
  return `vefk-${token}`;
}
function creationGeometry(): StudioVefkGeometry {
  return {
    coordinateSpace: "svg-viewBox", viewBox: [0, 0, 1000, 1000],
    paths: [{ id: "mark.001", ink: "glyph", d: "M 225 250 L 775 250 L 775 750 L 225 750 Z" }],
    inkStyles: {
      grid: { width: 7, cap: "round" },
      glyph: { width: 11, cap: "round" },
    },
  };
}
function requiredPath(id: string) { return id.startsWith("cell.r") || id.startsWith("grid."); }
export default function VefkWorkshop() {
  const bridge = window.channelFoundryStudio as Bridge | undefined;
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const artboardScrollRef = useRef<HTMLDivElement | null>(null);
  const zoomTouched = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const [records, setRecords] = useState<StudioVefkListItem[]>([]);
  const [catalogSelections, setCatalogSelections] = useState<StudioVefkCatalogSelection[]>([]);
  const [sources, setSources] = useState<StudioVefkSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<StudioVefkRevision[]>([]);
  const [record, setRecord] = useState<StudioVefkRecord | null>(null);
  const [working, setWorking] = useState<Document | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sourceDirty, setSourceDirty] = useState(false);
  const [timelineMs, setTimelineMs] = useState(0);
  const [timelinePreview, setTimelinePreview] = useState(false);
  const [experimentalCurve, setExperimentalCurve] = useState<IntraStrokeCurve>("linear");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorTool>("select");
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState(true);
  const [zoom, setZoom] = useState(0.75);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [dragPreviewId, setDragPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 1200);
  const rightPanelUserChoice = useRef(false);
  const lastNarrowViewport = useRef(window.innerWidth <= 1200);
  useEffect(() => {
    const adapt = () => {
      const narrow = window.innerWidth <= 1200;
      if (lastNarrowViewport.current === narrow) return;
      lastNarrowViewport.current = narrow;
      if (!rightPanelUserChoice.current) setRightOpen(!narrow);
    };
    window.addEventListener("resize", adapt);
    return () => window.removeEventListener("resize", adapt);
  }, []);
  const [newOpen, setNewOpen] = useState(false);
  const [newKind, setNewKind] = useState<StudioVefkKind>("magicSquare");
  const [newOrder, setNewOrder] = useState(3);
  const [newTitle, setNewTitle] = useState("Yeni vefk");
  const [squareParameters, setSquareParameters] = useState({ order: 3, first: "1", step: "1" });
  const [history, setHistory] = useState<Document[]>([]);
  const [future, setFuture] = useState<Document[]>([]);

  const status: Status = record?.status ?? "new";
  const siteSelection = record ? catalogSelections.find(item => item.id === record.id) : null;
  const locked = status === "checked" || status === "approved" || status === "published";
  const canEdit = Boolean(working && !locked && !busy);
  // Use the document's viewBox ratio, not a forced square canvas. Square vefks
  // remain unchanged; traced photographs can be landscape or portrait.
  const [stageX, stageY, stageWidth, stageHeight] = working?.geometry.viewBox ?? [0,0,1000,1000];
  const stageMax = Math.max(stageWidth, stageHeight);
  const fitArtboard = useCallback(() => {
    const viewport = artboardScrollRef.current;
    if (!viewport || stageMax <= 0 || stageWidth <= 0) return;
    // Fit to the available center-column width; tall drawings can scroll vertically.
    const visibleWidth = Math.max(160, viewport.clientWidth - 40);
    const fitted = Math.max(.2, Math.min(.75,
      Number((visibleWidth / (1000 * stageWidth / stageMax)).toFixed(2))));
    setZoom(value => value === fitted ? value : fitted);
  }, [stageWidth, stageMax]);
  useEffect(() => { zoomTouched.current = false; }, [working?.id, working?.revision]);
  useEffect(() => {
    if (!working || !artboardScrollRef.current) return;
    const viewport = artboardScrollRef.current;
    const sync = () => { if (!zoomTouched.current) fitArtboard(); };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [working?.id, working?.revision, fitArtboard, leftOpen, rightOpen]);
  const square = working?.construction.kind === "magicSquare" ? working.construction : null;
  const validParameters = squareParameters.first.trim() !== "" && squareParameters.step.trim() !== ""
    && Number.isSafeInteger(Number(squareParameters.first)) && Number.isSafeInteger(Number(squareParameters.step))
    && Number(squareParameters.step) !== 0;
  const changedParameters = Boolean(square && (squareParameters.order !== square.parameters.order
    || Number(squareParameters.first) !== square.parameters.first
    || Number(squareParameters.step) !== square.parameters.step));
  useEffect(() => {
    if (square) setSquareParameters({ order: square.parameters.order,
      first: String(square.parameters.first), step: String(square.parameters.step) });
  }, [working?.id, working?.revision, square?.parameters.order, square?.parameters.first, square?.parameters.step]);
  const selected = useMemo(() => working?.geometry.paths.find(path => path.id === selectedPath) ?? null,
    [working, selectedPath]);
  const bounds = useMemo(() => {
    if (!selected) return null;
    try { return pathBounds(selected.d); } catch { return null; }
  }, [selected]);
  const previewPlayer = useMemo(() => {
    if (!working) return null;
    try {
      return createEditorPreviewPlayer(working, experimentalCurve);
    } catch { return null; }
  }, [working, experimentalCurve]);
  const timelineFrame = useMemo(
    () => timelinePreview && previewPlayer ? previewPlayer.frameAt(timelineMs) : null,
    [timelinePreview, timelineMs, previewPlayer],
  );
  const penPose = useMemo(() => {
    if (!timelineFrame?.pen || !previewPlayer) return null;
    const duration = previewPlayer.durationMs;
    const before = previewPlayer.frameAt(Math.max(0, timelineMs - 32)).pen?.position ?? timelineFrame.pen.position;
    const after = previewPlayer.frameAt(Math.min(duration, timelineMs + 32)).pen?.position ?? timelineFrame.pen.position;
    return studioPenPose({ ...timelineFrame.pen, phase: timelineFrame.pen.phase ?? "hold" }, before, after);
  }, [timelineFrame, previewPlayer, timelineMs]);
  const progressByPath = useMemo(() => new Map(
    timelineFrame?.visibility.map(item => [item.pathId, item.fraction]) ?? [],
  ), [timelineFrame]);
  const selectTimelineTime = useCallback((ms: number) => {
    setTimelinePreview(true);
    setTimelineMs(ms);
  }, []);
  useEffect(() => {
    setTimelinePreview(false);
    setTimelineMs(0);
    setExperimentalCurve("linear");
  }, [working?.id, working?.revision]);
  const visibleRecords = useMemo(() => records.filter(entry => {
    if (statusFilter && entry.status !== statusFilter) return false;
    const text = search.toLocaleLowerCase("tr-TR");
    return !text || entry.title.toLocaleLowerCase("tr-TR").includes(text);
  }), [records, search, statusFilter]);

  async function refreshList() {
    if (!bridge) return;
    const [next, images, catalog] = await Promise.all([
      bridge.vefkList({ limit: 500 }), bridge.vefkSourceList(), bridge.vefkCatalogList(),
    ]);
    setRecords(next);
    setSources(images);
    setCatalogSelections(catalog);
  }
  useEffect(() => {
    sessionStorage.setItem("channel-foundry:vefk-unsaved", dirty || sourceDirty ? "1" : "0");
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !sourceDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      sessionStorage.removeItem("channel-foundry:vefk-unsaved");
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty, sourceDirty]);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    void Promise.all([bridge.vefkList({ limit: 500 }), bridge.vefkSourceList(), bridge.vefkCatalogList()])
      .then(([result, images, catalog]) => {
        if (alive) { setRecords(result); setSources(images); setCatalogSelections(catalog); }
      }).catch(reason => { if (alive) setError(errorText(reason)); });
    const unsubscribe = bridge.onDataChanged?.(() => {
      void refreshList().catch(() => undefined);
    });
    return () => { alive = false; unsubscribe?.(); };
  }, [bridge]);

  function resetHistory() { setHistory([]); setFuture([]); }
  function apply(next: Document) {
    if (!working || !canEdit) return;
    const revised = next.geometry !== working.geometry
      ? { ...next, drawPlan: reconcileDrawPlan(next.geometry, next.drawPlan, next.schemaVersion) }
      : next;
    setHistory(stack => [...stack.slice(-39), working]);
    setFuture([]);
    setWorking(revised);
    setDirty(true);
    setNotice("");
    setError("");
  }
  function patchDocument(next: Partial<Document>) {
    if (!working) return;
    apply({ ...working, ...next });
  }
  function patchPaths(paths: Path[], selectedId?: string | null) {
    if (!working) return;
    const next = { ...working, geometry: { ...working.geometry, paths } };
    apply(next);
    if (selectedId !== undefined) setSelectedPath(selectedId);
  }
  function patchPath(id: string, changes: Partial<Path>) {
    if (!working) return;
    patchPaths(working.geometry.paths.map(path => path.id === id ? { ...path, ...changes } : path), id);
  }

  function guardedLeave() {
    return (!dirty && !sourceDirty) || window.confirm("Kaydedilmemiş vefk veya görsel inceleme düzenlemeleri var. Vazgeçilsin mi?");
  }
  async function pickSource() {
    if (!bridge || busy || !guardedLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await bridge.vefkSourcePick();
      if (result.canceled) return;
      await refreshList();
      setActiveSourceId(result.source.id); setRecord(null); setWorking(null); setRevisions([]);
      setDirty(false); setSelectedPath(null); resetHistory();
      setNotice(result.source.duplicate ? "Bu görsel kaynak arşivinde zaten var; mevcut kayıt açıldı." : "Orijinal görsel arşive alındı.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  function selectSource(id: string) {
    if (busy || !guardedLeave()) return;
    setActiveSourceId(id); setRecord(null); setWorking(null); setRevisions([]);
    setDirty(false); setSelectedPath(null); resetHistory(); setError(""); setNotice("");
  }
  async function startSourceDraft(input: StudioVefkCreateInput) {
    if (!bridge || busy || !guardedLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await bridge.vefkGenerate(input);
      setWorking(next); setRecord(null); setRevisions([]); setDirty(true);
      setSelectedPath(null); setMode("select"); resetHistory();
      setNotice("Kaynak çözümlemesinden düzenlenebilir taslak oluşturuldu. Henüz veritabanına kaydedilmedi.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function openRecord(id: string, revision?: number) {
    if (!bridge || busy || !guardedLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const [next, versions] = await Promise.all([
        bridge.vefkGet({ id, revision }), bridge.vefkRevisions(id),
      ]);
      if (!next) throw new Error("Seçilen vefk bulunamadı.");
      setRecord(next); setWorking(next.document); setRevisions(versions);
      setActiveSourceId(null); setDirty(false); setSelectedPath(null); setMode("select"); resetHistory();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function createNew() {
    if (!bridge || busy || !guardedLeave()) return;
    setBusy(true); setError("");
    try {
      const id = randomId();
      const input: StudioVefkCreateInput = {
        id, title: newTitle.trim() || "Yeni vefk", revision: 1, kind: newKind,
        parameters: newKind === "magicSquare" ? { order: newOrder, first: 1, step: 1 } : undefined,
        grid: newKind === "manualSquare" ? [[1, 2, 3], [4, 5, 6], [7, 8, 9]] : undefined,
        geometry: newKind === "manualPaths" ? creationGeometry() : undefined,
      };
      const doc = await bridge.vefkGenerate(input);
      setRecord(null); setWorking(doc); setRevisions([]);
      setActiveSourceId(null); setDirty(true); setSelectedPath(null); resetHistory(); setNewOpen(false);
      setMode("select"); setNotice("Yeni çalışma alanı hazır. Henüz veritabanına kaydedilmedi.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function enablePersistentMotion() {
    if (!bridge || !working || !canEdit || working.schemaVersion !== 1) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await bridge.vefkGenerate(persistentMotionInput(working, status));
      apply(next);
      setNotice("Kalıcı çizgi içi eğri v2 açıldı. Her yol doğrusal başlar; değişiklikleri kaydetmelisin.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!bridge || !working || busy || locked) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const canonical = await bridge.vefkGenerate(editorInput(working));
      const updated = await bridge.vefkSaveDraft({
        document: canonical,
        expectedContentHash: record?.status === "draft"
          && record.revision === canonical.revision ? record.contentHash : undefined,
      });
      setRecord(updated); setWorking(updated.document); setDirty(false); resetHistory();
      setRevisions(await bridge.vefkRevisions(updated.id));
      await refreshList();
      setNotice(`Revizyon ${updated.revision} kaydedildi · ${updated.contentHash.slice(0, 12)}`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function review(target: "draft" | "checked" | "approved") {
    if (!bridge || !record || dirty || busy) return;
    setBusy(true); setError("");
    try {
      const updated = await bridge.vefkReview({
        id: record.id, revision: record.revision,
        status: target, expectedContentHash: record.contentHash,
      });
      setRecord(updated); setWorking(updated.document); resetHistory();
      setRevisions(await bridge.vefkRevisions(updated.id));
      await refreshList();
      setNotice(`Revizyon ${updated.revision}: ${statusLabels[updated.status]}`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function toggleSiteSelection() {
    if (!bridge || !record || busy || dirty) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (siteSelection) {
        await bridge.vefkCatalogSelect({ id: record.id, enabled: false });
        setNotice("Bu vefk site yayın kataloğundan çıkarıldı; canlı site değiştirilmedi.");
      } else {
        if (!["approved", "published"].includes(record.status)) {
          throw new Error("Önce revizyonu kontrol edip onaylamak gerekiyor.");
        }
        await bridge.vefkCatalogSelect({
          id: record.id, revision: record.revision,
          contentHash: record.contentHash, enabled: true,
          sortOrder: catalogSelections.length * 10,
        });
        setNotice("Onaylı r" + record.revision + " site kataloğuna eklendi. Paket hazırlanmadı; canlı yayına gönderilmedi.");
      }
      await refreshList();
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function prepareSitePackage() {
    if (!bridge || busy || dirty || sourceDirty) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const info = await bridge.exportPublicSnapshot();
      await refreshList();
      setNotice("Yerel site paketi oluşturuldu · " + catalogSelections.length +
        " vefk · " + info.file + " · Canlı yayın yapılmadı.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function nextRevision() {
    if (!bridge || !record || busy || dirty || !["approved", "published"].includes(record.status)) return;
    const current = records.find(entry => entry.id === record.id);
    if (current && current.currentRevision !== record.revision) {
      setError("Önce koleksiyondan bu vefkin en son revizyonunu açmalısın.");
      return;
    }
    setBusy(true); setError("");
    try {
      const next = await bridge.vefkGenerate({
        ...editorInput(record.document), revision: record.revision + 1,
      });
      setRecord(null);
      setWorking(next); setSelectedPath(null); setDirty(true);
      resetHistory();
      setNotice(`Revizyon ${next.revision} henüz kaydedilmemiş taslak olarak açıldı.`);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function regenerate(order: number, first: number, step: number) {
    if (!bridge || !working || !canEdit) return;
    if (working.geometry.paths.some(path => path.id.startsWith("mark.")) &&
        !window.confirm("Kare yeniden oluşturulurken ek çizimler sıfırlanacak. Devam edilsin mi?")) return;
    setBusy(true); setError("");
    try {
      const generated = await bridge.vefkGenerate({
        ...editorInput(working),
        geometry: undefined,
        drawPlan: undefined,
        accessibility: undefined,
        parameters: { order, first, step },
      });
      const next = working.schemaVersion === 2
        ? await bridge.vefkGenerate({ ...editorInput(generated),
          drawPlan: reconcileDrawPlan(generated.geometry, working.drawPlan, working.schemaVersion) })
        : generated;
      setHistory(stack => [...stack.slice(-39), working]);
      setWorking(next); setFuture([]); setSelectedPath(null); setDirty(true);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function changeManualCell(row: number, column: number, value: number) {
    if (!bridge || !working || !canEdit || working.construction.kind !== "manualSquare") return;
    if (!Number.isSafeInteger(value)) { setError("Hücre değeri güvenli bir tam sayı olmalı."); return; }
    setBusy(true); setError("");
    try {
      const grid = working.construction.grid!.map(line => [...line]);
      grid[row][column] = value;
      // Reconstruct only the computed cell paths; manually authored marks survive.
      const computed = await bridge.vefkGenerate({
        ...editorInput(working), grid, geometry: undefined, drawPlan: undefined, accessibility: undefined,
      });
      const extra = working.geometry.paths.filter(path => !requiredPath(path.id));
      const geometry = extra.length
        ? { ...computed.geometry, paths: [...computed.geometry.paths, ...extra] }
        : computed.geometry;
      const merged = await bridge.vefkGenerate({
        ...editorInput(computed), geometry,
        drawPlan: reconcileDrawPlan(geometry, working.drawPlan, working.schemaVersion),
        accessibility: undefined,
      });
      setHistory(stack => [...stack.slice(-39), working]);
      setWorking(merged); setFuture([]); setDirty(true);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  function undo() {
    if (!canEdit || !history.length || !working) return;
    setFuture(stack => [...stack, working]);
    setWorking(history[history.length - 1]);
    setHistory(stack => stack.slice(0, -1)); setDirty(true);
  }
  function redo() {
    if (!canEdit || !future.length || !working) return;
    setHistory(stack => [...stack, working]);
    setWorking(future[future.length - 1]);
    setFuture(stack => stack.slice(0, -1)); setDirty(true);
  }
  function removeSelected() {
    if (!working || !selectedPath || requiredPath(selectedPath)) return;
    if (working.geometry.paths.length <= 1) {
      setError("Son çizim silinemez. Önce yeni bir şekil ekleyebilirsin.");
      return;
    }
    patchPaths(working.geometry.paths.filter(path => path.id !== selectedPath), null);
  }
  function moveLayer(direction: -1 | 1) {
    if (!working || !selectedPath) return;
    const paths = [...working.geometry.paths];
    const index = paths.findIndex(path => path.id === selectedPath);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= paths.length) return;
    [paths[index], paths[destination]] = [paths[destination], paths[index]];
    patchPaths(paths);
  }
  function nudge(dx: number, dy: number) {
    if (!working || !selected) return;
    try {
      patchPath(selected.id, { d: movePath(selected.d, dx, dy, working.geometry.viewBox) });
    } catch (reason) { setError(errorText(reason)); }
  }
  function resizeSelected(factor: number) {
    if (!working || !selected) return;
    try {
      patchPath(selected.id, { d: scalePath(selected.d, factor, working.geometry.viewBox) });
    } catch (reason) { setError(errorText(reason)); }
  }

  function pointFromEvent(event: ReactPointerEvent<SVGSVGElement>): Point2 {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const local = canvas.createSVGPoint();
    local.x = event.clientX; local.y = event.clientY;
    const matrix = canvas.getScreenCTM();
    if (!matrix) throw new Error("SVG dönüşüm matrisi bulunamadı.");
    const point = local.matrixTransform(matrix.inverse());
    return clampPoint({ x: point.x, y: point.y }, working!.geometry.viewBox, snap ? 10 : 0);
  }
  function pointerStart(event: ReactPointerEvent<SVGSVGElement>) {
    if (!canEdit || !working || timelineFrame || event.button !== 0) return;
    if (mode === "select") { setSelectedPath(null); return; }
    const start = pointFromEvent(event);
    gestureRef.current = { kind: "shape", tool: mode, start, trail: [] };
    setPreviewPath(null); setDragPreviewId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pathStart(event: ReactPointerEvent<SVGPathElement>, path: Path) {
    if (timelineFrame || mode !== "select" || event.button !== 0) return;
    event.stopPropagation();
    setSelectedPath(path.id);
    if (!canEdit || !working) return;
    const svg = canvasRef.current;
    if (!svg) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const translated = point.matrixTransform(matrix.inverse());
    gestureRef.current = {
      kind: "move", pathId: path.id, original: path.d,
      start: clampPoint({ x: translated.x, y: translated.y }, working.geometry.viewBox, snap ? 10 : 0),
    };
    svg.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!working || !gestureRef.current) return;
    try {
      const pos = pointFromEvent(event);
      const gesture = gestureRef.current;
      if (gesture.kind === "move") {
        const d = movePath(gesture.original, pos.x - gesture.start.x, pos.y - gesture.start.y, working.geometry.viewBox);
        setDragPreviewId(gesture.pathId);
        setPreviewPath(d);
      } else {
        if (gesture.tool === "freehand" &&
            (gesture.trail.length < 390) &&
            (!gesture.trail.length || Math.hypot(
              gesture.trail[gesture.trail.length - 1].x - pos.x,
              gesture.trail[gesture.trail.length - 1].y - pos.y) >= 3)) gesture.trail.push(pos);
        setPreviewPath(shapePath(gesture.tool, gesture.start, pos, gesture.trail));
      }
    } catch { /* Out-of-bounds pointer moves are ignored until inside the artboard. */ }
  }
  function pointerFinish(event: ReactPointerEvent<SVGSVGElement>) {
    if (!working) return;
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setPreviewPath(null); setDragPreviewId(null);
    if (!canEdit) return;
    try {
      if (gesture.kind === "move") {
        const end = pointFromEvent(event);
        const d = movePath(gesture.original, end.x - gesture.start.x, end.y - gesture.start.y, working.geometry.viewBox);
        if (d !== gesture.original) patchPath(gesture.pathId, { d });
      } else {
        const end = pointFromEvent(event);
        if (Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y) < 8) return;
        const d = shapePath(gesture.tool, gesture.start, end, gesture.trail);
        const id = nextPathId(working.geometry.paths);
        patchPaths([...working.geometry.paths, { id, d, ink: "glyph" }], id);
      }
    } catch (reason) { setError(errorText(reason)); }
  }

  if (!bridge) return <div className="panel vefk-not-available">Vefk Atölyesi yalnız Studio masaüstü uygulamasında kullanılabilir.</div>;

  return <div className={`vefk-workshop ${leftOpen ? "" : "no-library"} ${rightOpen ? "" : "no-inspector"} ${activeSourceId && !working ? "source-active" : ""}`}>
    <header className="vefk-head">
      <div className="vefk-head-title">
        <small>ÜRETİM / VEKTÖR ATÖLYESİ</small>
        <h2>Vefk Atölyesi</h2>
        <span>Görsel çözümleme · Matematik · Çizim · Revizyon</span>
      </div>
      <div className="vefk-head-actions">
        <span className="vefk-site-count" title="Yerel site paketine seçilen onaylı vefk sayısı">Site: {catalogSelections.length}</span>
        {working && <span className={`vefk-state is-${status}`}>{statusLabels[status]} {working.revision > 1 ? `· r${working.revision}` : ""}{dirty ? " · Değişti" : ""}</span>}
        <button type="button" className="vefk-button subtle" onClick={() => setLeftOpen(!leftOpen)} aria-label={leftOpen ? "Koleksiyonu daralt" : "Koleksiyonu aç"}>{leftOpen ? "◀" : "▶"} Koleksiyon</button>
        <button type="button" className="vefk-button subtle" onClick={() => { rightPanelUserChoice.current = true; setRightOpen(!rightOpen); }} aria-label={rightOpen ? "Özellikleri daralt" : "Özellikleri aç"}>Özellikler {rightOpen ? "▶" : "◀"}</button>
        <button type="button" className="vefk-button primary" onClick={() => void pickSource()} disabled={busy}>Görselden oluştur</button>
        <button type="button" className="vefk-button" onClick={() => setNewOpen(true)} disabled={busy}>Sıfırdan oluştur</button>
        <button type="button" className="vefk-button subtle" onClick={() => void prepareSitePackage()}
          disabled={busy || dirty || sourceDirty} title="Yalnız yerel publication.json ve vefk kataloğunu hazırlar. Canlı yayın yapmaz.">
          Site paketini hazırla
        </button>
        {working && <button type="button" className="vefk-button primary" onClick={() => void save()} disabled={!dirty || locked || busy}>{busy ? "İşleniyor…" : "Kaydet"}</button>}
      </div>
    </header>

    {error && <div className="vefk-feedback error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Uyarıyı kapat">×</button></div>}
    {notice && <div className="vefk-feedback" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Bildirimi kapat">×</button></div>}

    <div className="vefk-layout">
      {leftOpen && <aside className="vefk-library" aria-label="Vefk koleksiyonu">
        <div className="vefk-section-heading"><small>KAYNAK GÖRSELLER</small><strong>{sources.length}</strong></div>
        <div className="vefk-source-mini-list">
          {sources.map(image => <button type="button" key={image.id}
            className={activeSourceId === image.id && !working ? "current" : ""}
            title={image.filename} onClick={() => selectSource(image.id)}>
            <span>▧</span><strong>{image.filename}</strong><small>{image.lastAnalysisId ? "AI çözümleme" : "Analiz yok"}</small>
          </button>)}
          {!sources.length && <span className="vefk-sources-empty">Henüz kaynak görsel yok.</span>}
        </div>
        <div className="vefk-section-heading"><small>VEFK KÜTÜPHANESİ</small><strong>{records.length}</strong></div>
        <div className="vefk-library-controls">
          <input aria-label="Vefk ara" placeholder="Başlığa göre ara…" value={search} onChange={event => setSearch(event.target.value)}/>
          <select aria-label="Duruma göre filtrele" value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="">Tüm durumlar</option>
            <option value="draft">Taslak</option>
            <option value="checked">Kontrolde</option>
            <option value="approved">Onaylı</option>
            <option value="published">Yayında</option>
          </select>
        </div>
        <div className="vefk-library-list">
          {visibleRecords.map(item => <button key={item.id} className={`vefk-document-row ${working?.id === item.id ? "selected" : ""}`} type="button"
            onClick={() => void openRecord(item.id)}>
            <span className="vefk-document-monogram">✦</span><span><strong>{item.title}</strong><small>r{item.currentRevision} · {statusLabels[item.status]} · {item.id}</small></span>
          </button>)}
          {!visibleRecords.length && <p className="vefk-empty-list">Kayıt bulunamadı. Yeni bir vefkle başlayabilirsin.</p>}
        </div>
        {record && <div className="vefk-revision-panel">
          <div className="vefk-section-heading"><small>REVİZYONLAR</small><strong>{revisions.length}</strong></div>
          {revisions.map(version => <button key={version.revision} type="button"
            className={version.revision === working?.revision ? "current" : ""}
            onClick={() => void openRecord(version.id, version.revision)}>
            <span>r{version.revision} · {statusLabels[version.status]}</span><small>{version.contentHash.slice(0, 9)}</small>
          </button>)}
        </div>}
      </aside>}

      <section className="vefk-center" aria-label="Vefk üretim alanı">
        {!working && activeSourceId ? <VefkSourceWorkbench key={activeSourceId}
          sourceId={activeSourceId} onStartDrawing={startSourceDraft} onDirtyChange={setSourceDirty}/>
        : !working ? <div className="vefk-start">
          <span className="vefk-start-symbol">▧</span><h3>Bir görselle başla.</h3>
          <p>Mevcut vefk görselini arşive al, Studio AI ile çözümle ve okunan işaretleri orijinaliyle karşılaştır.</p>
          <button className="vefk-button primary" onClick={() => void pickSource()}>Görselden vefk oluştur</button>
          <button className="vefk-button" onClick={() => setNewOpen(true)}>Sıfırdan oluştur</button>
        </div> : <>
          <div className="vefk-toolbar" role="toolbar" aria-label="Vektör araçları">
            <div className="vefk-tool-group">
              {tools.map(tool => <button key={tool.id} type="button"
                className={mode === tool.id ? "active" : ""} disabled={locked || busy}
                title={tool.label} aria-label={tool.label} aria-pressed={mode === tool.id}
                onClick={() => setMode(tool.id)}><span>{tool.symbol}</span></button>)}
            </div>
            <div className="vefk-tool-group">
              <button title="Geri al" aria-label="Geri al" disabled={!history.length || !canEdit} onClick={undo}>↶</button>
              <button title="Yinele" aria-label="Yinele" disabled={!future.length || !canEdit} onClick={redo}>↷</button>
              <button title="Izgaraya yapış" aria-pressed={snap} className={snap ? "active" : ""} onClick={() => setSnap(!snap)}>⌗</button>
              <button title="Kılavuz çizgileri" aria-pressed={guides} className={guides ? "active" : ""} onClick={() => setGuides(!guides)}>▦</button>
            </div>
            <div className="vefk-zoom">
              <button title="Görünüme sığdır" aria-label="Görünüme sığdır" onClick={() => { zoomTouched.current = false; fitArtboard(); }}>⊞</button>
              <button aria-label="Küçült" onClick={() => { zoomTouched.current = true; setZoom(value => Math.max(.2, Number((value - .1).toFixed(2)))); }}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button aria-label="Büyüt" onClick={() => { zoomTouched.current = true; setZoom(value => Math.min(1.6, Number((value + .1).toFixed(2)))); }}>+</button>
            </div>
          </div>
          <div className="vefk-artboard-scroll" ref={artboardScrollRef}>
            <div className="vefk-artboard-wrap">
              <svg ref={canvasRef} width={1000 * zoom * stageWidth / stageMax}
                height={1000 * zoom * stageHeight / stageMax} viewBox={working.geometry.viewBox.join(" ")}
                className={`vefk-artboard mode-${mode} ${timelineFrame ? "vefk-timeline-preview" : ""}`}
                aria-label={`${working.title} SVG çizimi`}
                role="img"
                onPointerDown={pointerStart} onPointerMove={pointerMove}
                onPointerUp={pointerFinish} onPointerCancel={() => {
                  gestureRef.current = null; setPreviewPath(null); setDragPreviewId(null);
                }}>
                <rect x={stageX} y={stageY} width={stageWidth} height={stageHeight} className="vefk-surface"/>
                {guides && <g className="vefk-guide-lines" pointerEvents="none">
                  {Array.from({ length: 19 }, (_, i) => <g key={i}>
                    <path d={`M ${stageX + stageWidth * (i+1)/20} ${stageY} L ${stageX + stageWidth * (i+1)/20} ${stageY + stageHeight}`}/>
                    <path d={`M ${stageX} ${stageY + stageHeight * (i+1)/20} L ${stageX + stageWidth} ${stageY + stageHeight * (i+1)/20}`}/>
                  </g>)}
                  <path className="vefk-guide-mid" d={`M ${stageX + stageWidth/2} ${stageY} L ${stageX + stageWidth/2} ${stageY + stageHeight} M ${stageX} ${stageY + stageHeight/2} L ${stageX + stageWidth} ${stageY + stageHeight/2}`}/>
                </g>}
                {working.geometry.paths.map(path => {
                  const active = path.id === selectedPath;
                  const display = active && dragPreviewId === path.id && previewPath ? previewPath : path.d;
                  const inkStyle = working.geometry.inkStyles[path.ink];
                  const fraction = timelineFrame ? progressByPath.get(path.id) ?? 0 : 1;
                  return <path key={path.id} d={display}
                    className={`vefk-ink ${path.ink === "grid" ? "grid-ink" : "glyph-ink"} ${active ? "is-selected" : ""}`}
                    pathLength={timelineFrame ? 1 : undefined}
                    strokeDasharray={timelineFrame ? 1 : undefined}
                    strokeDashoffset={timelineFrame ? 1 - fraction : undefined}
                    strokeWidth={inkStyle?.width ?? 7} strokeLinecap={inkStyle?.cap ?? "round"}
                    onPointerDown={event => pathStart(event, path)}/>;
                })}
                {previewPath && !dragPreviewId && <path d={previewPath} className="vefk-shape-preview"/>}
                {timelineFrame?.pen && penPose && <g
                  className={`vefk-pen-nib ${penPose.contact ? "is-drawing" : "is-travel"}`}
                  transform={`translate(${timelineFrame.pen.position.x} ${timelineFrame.pen.position.y})`}
                  aria-label={penPose.contact ? "Divit mürekkep bırakıyor" : "Divit kâğıttan kalkık"}>
                  <circle className="vefk-pen-contact" r={penPose.contact ? 3 : 5}/>
                  <g className="vefk-pen-shaft"
                    transform={`translate(0 ${-penPose.lift}) rotate(${penPose.angleDeg})`}>
                    <path className="vefk-pen-body" d="M -4 -29 L -4 -12 L -2 -4 L 0 0 L 2 -4 L 4 -12 L 4 -29 Z"/>
                    <path className="vefk-pen-slit" d="M 0 -24 L 0 -3"/>
                    <circle className="vefk-pen-tip" r="2"/>
                  </g>
                </g>}
                {selected && bounds && mode === "select" && <rect className="vefk-selection-box" pointerEvents="none"
                  x={bounds.x - 12} y={bounds.y - 12} width={Math.max(bounds.width + 24, 24)}
                  height={Math.max(bounds.height + 24, 24)}/>}
              </svg>
            </div>
          </div>
          <VefkTimelineEditor
            document={working}
            disabled={!canEdit}
            selectedPath={selectedPath}
            onSelectPath={id => { setSelectedPath(id); setMode("select"); }}
            previewMs={timelineMs}
            onPreviewMs={selectTimelineTime}
            previewCurve={experimentalCurve}
            onPreviewCurve={setExperimentalCurve}
            onEnablePersistentMotion={() => void enablePersistentMotion()}
            onShowComplete={() => { setTimelinePreview(false); setTimelineMs(working.drawPlan.durationMs); }}
            onPlanChange={plan => apply({ ...working, drawPlan: plan })}
            onError={setError}
          />
          <footer className="vefk-stage-foot">
            <span>{kindLabels[working.construction.kind]} · {working.geometry.paths.length} yol · {Math.round(working.drawPlan.durationMs / 1000)} sn çizim planı</span>
            <span>{selectedPath ?? "Nesne seçilmedi"} · {snap ? "10 birim snap" : "Serbest yerleşim"}</span>
          </footer>
        </>}
      </section>

      {rightOpen && !(activeSourceId && !working) && <aside className="vefk-inspector" aria-label="Vefk özellikleri">
        {!working ? <div className="vefk-blank-inspector">Çalışmaya başlamak için yeni bir vefk oluştur.</div> : <>
          <div className="vefk-inspector-head"><small>BELGE ÖZELLİKLERİ</small><strong>{working.id}</strong></div>
          <div className="vefk-properties">
            <label><span>Başlık</span><input value={working.title} disabled={!canEdit} maxLength={300}
              onChange={event => patchDocument({ title: event.target.value })}/></label>
            <label><span>Açıklama</span><textarea value={working.description} rows={2} disabled={!canEdit} maxLength={4000}
              onChange={event => patchDocument({ description: event.target.value })}/></label>
            <div className="vefk-info-pair"><span>Yöntem</span><strong>{kindLabels[working.construction.kind]}</strong></div>
            {working.construction.kind === "magicSquare" && <div className="vefk-square-params">
              <div className="vefk-inspector-head mini"><small>HESAPLAMA</small><strong>{working.construction.checks.passed ? "✓" : "!"}</strong></div>
              <label><span>Kare boyutu</span>
                <select disabled={!canEdit} value={squareParameters.order} onChange={event => setSquareParameters(previous => ({ ...previous, order: Number(event.target.value) }))}>
                  {[3, 5, 7].map(order => <option key={order} value={order}>{order} × {order}</option>)}
                </select></label>
              <div className="vefk-double-field">
                <label><span>İlk değer</span><input type="number" disabled={!canEdit} value={squareParameters.first}
                  onChange={event => setSquareParameters(previous => ({ ...previous, first: event.target.value }))}/></label>
                <label><span>Artış</span><input type="number" disabled={!canEdit} value={squareParameters.step}
                  onChange={event => setSquareParameters(previous => ({ ...previous, step: event.target.value }))}/></label>
              </div>
              <button className="vefk-button subtle" disabled={!canEdit || !validParameters || !changedParameters}
                onClick={() => void regenerate(squareParameters.order, Number(squareParameters.first), Number(squareParameters.step))}>
                Kareyi yeniden hesapla
              </button>
              <div className="vefk-info-pair"><span>Sihirli toplam</span><strong>{working.construction.checks.expectedSum}</strong></div>
            </div>}
            {selected && <div className="vefk-selected-properties">
              <div className="vefk-inspector-head mini"><small>SEÇİLEN YOL</small><strong>{selected.id}</strong></div>
              {selected.semanticValue !== undefined && <div className="vefk-info-pair"><span>Hücre değeri</span><strong>{selected.semanticValue}</strong></div>}
              {working.construction.kind === "manualSquare" && selected.id.startsWith("cell.r") &&
                <label><span>Hücreyi değiştir</span><input type="number" disabled={!canEdit} key={selected.id} defaultValue={selected.semanticValue}
                  onBlur={event => {
                    const match = /^cell\.r(\d+)c(\d+)$/.exec(selected.id);
                    if (match && event.target.value && event.target.value !== selected.semanticValue)
                      void changeManualCell(Number(match[1]), Number(match[2]), Number(event.target.value));
                  }}/></label>}
              {bounds && <div className="vefk-bounds"><span>X {Math.round(bounds.x)}</span><span>Y {Math.round(bounds.y)}</span><span>W {Math.round(bounds.width)}</span><span>H {Math.round(bounds.height)}</span></div>}
              <div className="vefk-nudge">
                <button disabled={!canEdit} onClick={() => nudge(-10, 0)} title="10 birim sola">←</button>
                <button disabled={!canEdit} onClick={() => nudge(0, -10)} title="10 birim yukarı">↑</button>
                <button disabled={!canEdit} onClick={() => nudge(0, 10)} title="10 birim aşağı">↓</button>
                <button disabled={!canEdit} onClick={() => nudge(10, 0)} title="10 birim sağa">→</button>
              </div>
              <div className="vefk-nudge">
                <button disabled={!canEdit} onClick={() => resizeSelected(0.9)}>− %10</button>
                <button disabled={!canEdit} onClick={() => resizeSelected(1.1)}>+ %10</button>
                <button disabled={!canEdit || working.geometry.paths.length <= 1 || requiredPath(selected.id)}
                  onClick={removeSelected}>Sil</button>
              </div>
              <label><span>Mürekkep</span><select value={selected.ink} disabled={!canEdit}
                onChange={event => patchPath(selected.id, { ink: event.target.value })}>
                {Object.keys(working.geometry.inkStyles).map(id => <option key={id} value={id}>{id}</option>)}
              </select></label>
              <label><span>Çizgi kalınlığı · {working.geometry.inkStyles[selected.ink].width}</span>
                <input type="range" min="1" max="30" step="1" disabled={!canEdit}
                  value={working.geometry.inkStyles[selected.ink].width}
                  onChange={event => patchDocument({ geometry: { ...working.geometry,
                    inkStyles: { ...working.geometry.inkStyles,
                      [selected.ink]: { ...working.geometry.inkStyles[selected.ink], width: Number(event.target.value) } },
                  } })}/></label>
            </div>}
            <div className="vefk-layers">
              <div className="vefk-inspector-head mini"><small>VEKTÖR KATMANLARI</small><strong>{working.geometry.paths.length}</strong></div>
              <div className="vefk-layer-actions">
                <button disabled={!canEdit || !selectedPath} onClick={() => moveLayer(-1)} title="Katmanı geri taşı">↑</button>
                <button disabled={!canEdit || !selectedPath} onClick={() => moveLayer(1)} title="Katmanı öne taşı">↓</button>
              </div>
              <div className="vefk-layer-list">
                {working.geometry.paths.map(path => <button key={path.id} type="button" className={selectedPath === path.id ? "current" : ""}
                  onClick={() => { setSelectedPath(path.id); setMode("select"); }}><span>{path.ink === "grid" ? "▦" : "◈"}</span><strong>{path.semanticValue ?? path.id}</strong><small>{path.id}</small></button>)}
              </div>
            </div>
            <div className="vefk-review">
              <div className="vefk-inspector-head mini"><small>REVİZYON / ONAY</small><strong>r{working.revision}</strong></div>
              <p>Önce taslağı kaydet. Kontrol edilmiş içerik yeniden düzenlenmek üzere açılabilir; onaylanmış içerik yeni revizyonla değişir.</p>
              {status === "draft" && <button disabled={busy || dirty} onClick={() => void review("checked")}>Kontrole gönder</button>}
              {status === "checked" && <div className="vefk-review-row">
                <button disabled={busy} onClick={() => void review("draft")}>Düzeltmeye aç</button>
                <button className="accent" disabled={busy} onClick={() => void review("approved")}>Onayla</button>
              </div>}
              {(status === "approved" || status === "published") && <button className="accent" disabled={busy} onClick={() => void nextRevision()}>Yeni revizyon oluştur</button>}
              <div className="vefk-site-selection">
                <strong>Site yayın seçimi</strong>
                <small>{siteSelection
                  ? "Site kataloğuna r" + siteSelection.revision + " seçili · " + siteSelection.contentHash.slice(0, 12)
                  : "Bu vefk yerel site kataloğunda değil."}</small>
                {siteSelection
                  ? <button disabled={busy || dirty} onClick={() => void toggleSiteSelection()}>Katalogdan çıkar</button>
                  : (status === "approved" || status === "published")
                    ? <button className="accent" disabled={busy || dirty} onClick={() => void toggleSiteSelection()}>
                      Onaylı r{record?.revision} · site kataloğuna ekle
                    </button>
                    : <small>Siteye aktarmak için önce revizyonu onayla.</small>}
                <small>Site seçimi canlı yayın değildir. Üstteki «Site paketini hazırla» yerel JSON üretir.</small>
              </div>
              {status === "new" && <small>Yeni çalışmayı kaydederek ilk revizyonu oluşturabilirsin.</small>}
            </div>
          </div>
        </>}
      </aside>}
    </div>

    {newOpen && <div className="vefk-modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setNewOpen(false);
    }}>
      <div className="vefk-create-dialog" role="dialog" aria-modal="true" aria-labelledby="vefk-create-title">
        <header><div><small>YENİ ÇALIŞMA</small><h3 id="vefk-create-title">Bir vefk oluştur</h3></div><button aria-label="Kapat" onClick={() => setNewOpen(false)}>×</button></header>
        <label><span>Adı</span><input autoFocus value={newTitle} maxLength={300} onChange={event => setNewTitle(event.target.value)}/></label>
        <div className="vefk-create-methods">
          {(["magicSquare", "manualSquare", "manualPaths"] as StudioVefkKind[]).map(kind => <button key={kind}
            type="button" className={newKind === kind ? "selected" : ""} onClick={() => setNewKind(kind)}>
            <strong>{kindLabels[kind]}</strong><small>{kind === "magicSquare" ? "Doğrulanmış 3 / 5 / 7 kare" : kind === "manualSquare" ? "Hücreleri kendin belirle" : "Vektör şekillerden kompozisyon"}</small>
          </button>)}
        </div>
        {newKind === "magicSquare" && <label><span>Başlangıç boyutu</span><select value={newOrder} onChange={event => setNewOrder(Number(event.target.value))}>
          {[3, 5, 7].map(order => <option key={order} value={order}>{order} × {order}</option>)}
        </select></label>}
        <footer><button className="vefk-button subtle" onClick={() => setNewOpen(false)}>Vazgeç</button>
          <button className="vefk-button primary" disabled={busy || !newTitle.trim()} onClick={() => void createNew()}>Çalışmayı oluştur</button></footer>
      </div>
    </div>}
  </div>;
}
