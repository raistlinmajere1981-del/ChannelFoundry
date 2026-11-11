import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { VefkReading } from "../../../channels/birdesengor/web/src/vefk/VefkReading.jsx";
import VefkTimelineEditor from "./VefkTimelineEditor";
import { changeDrawPlan, reconcileDrawPlan } from "./vefk-timeline-model";
import { studioPenPose } from "./vefk-pen-pose";
import type { IntraStrokeCurve } from "./vefk-intrastroke-preview";
import { createEditorPreviewPlayer, editorInput, persistentMotionInput } from "./vefk-motion-editor";
import {
  clampPoint, movePath, nextPathId, pathBounds, scalePath, shapePath, visibleSubpaths,
  type EditorTool, type Point2,
} from "./vefk-editor-model";
import VefkSourceWorkbench, { type SourceActions, type SourceProgress } from "./VefkSourceWorkbench";
import VefkViewport, { type ViewportActions } from "./VefkViewport";
import "./vefk-workshop.css";

type Bridge = NonNullable<typeof window.channelFoundryStudio>;
type Document = StudioVefkDocument;
type Path = StudioVefkGeometry["paths"][number];
type Status = StudioVefkStatus | "new";
type CollectionItem = { kind: "source" | "document"; id: string; name: string };
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
  const viewportRef = useRef<ViewportActions>(null);
  const sourceRef = useRef<SourceActions>(null);
  const [inspectorHost, setInspectorHost] = useState<HTMLElement | null>(null);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const [drawingImage, setDrawingImage] = useState<StudioVefkSourceImage | null>(null);
  const [sourceImage, setSourceImage] = useState<StudioVefkSourceImage | null>(null);
  const [sourceVersion, setSourceVersion] = useState(0);
  const [sourceProgress, setSourceProgress] = useState<SourceProgress | null>(null);
  const [sourceEvidence, setSourceEvidence] = useState<StudioVefkSourceReview | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"review" | "drawing">("review");
  const [view, setView] = useState<"photo" | "overlay" | "svg">("overlay");
  const inspectSource = useCallback(() => setRightOpen(true), []);
  const revealTraces = useCallback(() => setView("overlay"), []);
  const [pan, setPan] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [packageReady, setPackageReady] = useState(false);
  const [packageReadiness, setPackageReadiness] = useState<string>("");
  const [rename, setRename] = useState<{ item: CollectionItem; title: string } | null>(null);
  const [menu, setMenu] = useState<CollectionItem | null>(null);
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
  const [zoom, setZoom] = useState(1);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [dragPreviewId, setDragPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 760);
  const leftPanelUserChoice = useRef(false);
  useEffect(() => {
    const adapt = () => { if (!leftPanelUserChoice.current) setLeftOpen(window.innerWidth > 760); };
    window.addEventListener("resize", adapt); return () => window.removeEventListener("resize", adapt);
  }, []);
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
  const [newKind, setNewKind] = useState<StudioVefkKind>("manualPaths");
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
  const fitArtboard = () => viewportRef.current?.fit();
  const reviewing = Boolean(activeSourceId && workspaceMode === "review");
  const selectionMatches = Boolean(siteSelection && record && siteSelection.revision === record.revision && siteSelection.contentHash === record.contentHash);
  useEffect(() => { setPreviewOpen(false); }, [working?.id, working?.revision]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [menu]);
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
  const orderedPaths = useMemo(() => {
    if (!working) return [];
    const byId = new Map(working.geometry.paths.map(path => [path.id, path]));
    return working.drawPlan.strokes.flatMap(stroke => { const path = byId.get(stroke.pathId); return path ? [path] : []; });
  }, [working]);
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
    const [next, images, catalog, localPackage] = await Promise.all([
      bridge.vefkList({ limit: 500 }), bridge.vefkSourceList(), bridge.vefkCatalogList(), bridge.vefkPackageStatus(),
    ]);
    setRecords(next);
    setSources(images);
    setCatalogSelections(catalog); setPackageReady(localPackage.ready);
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
    void Promise.all([bridge.vefkList({ limit: 500 }), bridge.vefkSourceList(), bridge.vefkCatalogList(), bridge.vefkPackageStatus()])
      .then(([result, images, catalog, localPackage]) => {
        if (alive) { setRecords(result); setSources(images); setCatalogSelections(catalog); setPackageReady(localPackage.ready); }
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
      ? { ...next, drawPlan: next.geometry.paths.length ? reconcileDrawPlan(next.geometry, next.drawPlan, next.schemaVersion) : { ...next.drawPlan, strokes: [], markers: [], durationMs: 0 } }
      : next;
    setHistory(stack => [...stack.slice(-39), working]);
    setFuture([]);
    setWorking(revised);
    setDirty(true);
    setNotice(""); setPreviewOpen(false); setPackageReady(false);
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
      setSourceImage(null); setSourceProgress(null); setSourceEvidence(null); setWorkspaceMode("review"); setView("overlay");
      setActiveSourceId(result.source.id); setRecord(null); setWorking(null); setRevisions([]);
      setDirty(false); setSelectedPath(null); resetHistory();
      setNotice(result.source.duplicate ? "Bu görsel kaynak arşivinde zaten var; mevcut kayıt açıldı." : "Orijinal görsel arşive alındı.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  function selectSource(id: string) {
    if (busy || !guardedLeave()) return;
    setSourceImage(null); setSourceProgress(null); setSourceEvidence(null); setWorkspaceMode("review"); setView("overlay");
    setActiveSourceId(id); setRecord(null); setWorking(null); setRevisions([]);
    setDirty(false); setSelectedPath(null); resetHistory(); setError(""); setNotice("");
  }
  async function startSourceDraft(input: StudioVefkCreateInput, evidence: StudioVefkSourceReview) {
    if (!bridge || busy || !guardedLeave()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await bridge.vefkGenerate(input);
      setWorking(next); setRecord(null); setRevisions([]); setDirty(true);
      setSourceEvidence(evidence); setWorkspaceMode("drawing"); setView(evidence.method === "traced" ? "overlay" : "svg");
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
      const evidence = await bridge.vefkSourceReviewInfo(id);
      setSourceEvidence(evidence); setSourceProgress(null); setSourceImage(null);
      setActiveSourceId(evidence && sources.some(item => item.id === evidence.sourceId) ? evidence.sourceId : null);
      setWorkspaceMode("drawing"); setView("svg");
      setDirty(false); setSelectedPath(null); setMode("select"); resetHistory();
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
      setRecord(null); setWorking(newKind === "manualPaths" ? { ...doc,
        geometry: { ...doc.geometry, paths: [] }, drawPlan: { ...doc.drawPlan, strokes: [], markers: [], durationMs: 0 } } : doc); setRevisions([]);
      setSourceEvidence(null); setSourceImage(null); setWorkspaceMode("drawing"); setView("svg");
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
    if (!working.geometry.paths.length) { setError("Kaydetmek için bir çizgi ekle."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const input = editorInput(working);
      input.provenance = { ...working.provenance, references: working.provenance.references.map(value => value.trim()).filter(Boolean) };
      const canonical = await bridge.vefkGenerate(input);
      const updated = await bridge.vefkSaveDraft({
        document: canonical, sourceReview: sourceEvidence,
        expectedContentHash: record?.status === "draft"
          && record.revision === canonical.revision ? record.contentHash : undefined,
      });
      setRecord(updated); setWorking(updated.document); setDirty(false); resetHistory();
      setSourceEvidence(await bridge.vefkSourceReviewInfo(updated.id));
      setRevisions(await bridge.vefkRevisions(updated.id));
      await refreshList();
      setNotice(`✓ Revizyon ${updated.revision} kaydedildi`);
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
      setTimelinePreview(false); setPreviewOpen(false); setTimelineMs(updated.document.drawPlan.durationMs);
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
      if (selectionMatches) {
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
      setPackageReady(true);
      setPackageReadiness(info.readiness?.readyForTheme ? "Yayınlama modülünden canlıya gönderilebilir."
        : "Yayınlama: anlatı / görsel tamamlama koşulları bekleniyor.");
      setNotice("✓ Yerel yayın paketi hazır · " + catalogSelections.length + " vefk. Canlı yayın için Yayınlama modülünü kullan.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function nextRevision(targetRecord = record) {
    if (!bridge || !targetRecord || busy || dirty && targetRecord === record || !["approved", "published"].includes(targetRecord.status)) return;
    const current = records.find(entry => entry.id === targetRecord.id);
    if (current && current.currentRevision !== targetRecord.revision) {
      setError("Önce koleksiyondan bu vefkin en son revizyonunu açmalısın.");
      return;
    }
    setBusy(true); setError("");
    try {
      const next = await bridge.vefkGenerate({
        ...editorInput(targetRecord.document), revision: targetRecord.revision + 1,
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
    patchPaths(working.geometry.paths.filter(path => path.id !== selectedPath), null);
  }
  function moveLayer(direction: -1 | 1) {
    if (!working || !selectedPath || !canEdit) return;
    try { apply({ ...working, drawPlan: changeDrawPlan(working.geometry, working.drawPlan,
      { kind: "move", pathId: selectedPath, delta: direction }, working.schemaVersion) }); }
    catch (reason) { setError(errorText(reason)); }
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
  function pathStart(event: ReactPointerEvent<SVGElement>, path: Path) {
    if (timelineFrame || mode !== "select" || event.button !== 0) return;
    event.stopPropagation();
    setSelectedPath(path.id); setRightOpen(true);
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
        const ink = working.geometry.inkStyles.glyph ? "glyph" : Object.keys(working.geometry.inkStyles)[0];
        patchPaths([...working.geometry.paths, { id, d, ink }], id);
      }
    } catch (reason) { setError(errorText(reason)); }
  }


  function clearWorkspace() {
    setRecord(null); setWorking(null); setActiveSourceId(null); setSourceImage(null); setSourceEvidence(null);
    setSourceProgress(null); setRevisions([]); setDirty(false); setSourceDirty(false); setSelectedPath(null); resetHistory();
  }
  async function runMenu(action: "rename" | "copy" | "revision" | "delete" | "analyses" | "catalog" | "cleanup", renameRequest?: { item: CollectionItem; title: string }) {
    const item = renameRequest?.item ?? menu; setMenu(null); if (!bridge || !item || busy) return;
    if (!guardedLeave()) return;
    if (action === "revision") {
      const latest = await bridge.vefkGet({ id: item.id });
      await openRecord(item.id); await nextRevision(latest); return;
    }
    if (action === "rename" && !renameRequest) { setRename({ item, title: item.name }); return; }
    const name = renameRequest?.title.trim() ?? item.name;
    if (!name) return;
    setRename(null);
    const messages = {
      delete: item.kind === "source" ? `“${item.name}” kaynak görseli ve tüm analizleri silinsin mi? Üretilmiş Vefk belgeleri korunur.`
        : `“${item.name}” belgesi tüm revizyonlarıyla silinsin mi? Yerel katalog seçimi de kaldırılır. Canlı site değişmez.`,
      analyses: `“${item.name}” için tüm AI analizleri ve incelemeler silinsin mi? Kaynak ve Vefk belgeleri korunur.`,
      catalog: `“${item.name}” yerel yayın kataloğundan çıkarılsın mı? Canlı site değişmez.`,
      cleanup: "Yalnız kullanılmayan yerel Vefk görsel dosyaları temizlensin mi?",
    };
    if (action in messages && !window.confirm(messages[action as keyof typeof messages])) return;
    setBusy(true); setError("");
    let resultNotice = "✓ İşlem tamamlandı";
    try {
      if (action === "delete") {
        if (item.kind === "source") { const result = await bridge.vefkSourceDelete({ id: item.id, confirmed: true }); if (result.cleanupPending) resultNotice = "Kaynak silindi · Dosya temizliği bekliyor"; }
        else await bridge.vefkDelete({ id: item.id, confirmed: true });
        if (activeSourceId === item.id || working?.id === item.id) clearWorkspace();
      } else if (action === "analyses") {
        await bridge.vefkAnalysisDelete({ id: item.id, confirmed: true });
        if (activeSourceId === item.id) { setSourceVersion(value => value+1); setSourceProgress(null); setSourceDirty(false); }
      } else if (action === "catalog") await bridge.vefkCatalogSelect({ id: item.id, enabled: false });
      else if (action === "cleanup") { const result = await bridge.vefkSourceCleanup({ confirmed: true }); resultNotice = `✓ ${result.removed} kullanılmayan dosya temizlendi`; }
      else if (action === "copy") await bridge.vefkCopy({ id: item.id, newId: randomId() });
      else if (action === "rename" && item.kind === "source") {
        const renamed = await bridge.vefkSourceRename({ id: item.id, title: name! });
        if (sourceImage?.id === item.id) { setSourceImage({ ...sourceImage, filename: renamed.filename }); setSourceVersion(value => value+1); }
      } else if (action === "rename") {
        const original = await bridge.vefkGet({ id: item.id });
        if (!original) throw new Error("Belge bulunamadı.");
        if (original.status === "checked") throw new Error("Yeniden adlandırmak için önce düzeltmeye aç.");
        const revision = original.status === "draft" ? original.revision : original.revision + 1;
        const renamed = await bridge.vefkGenerate({ ...editorInput(original.document), title: name!, revision });
        const updated = await bridge.vefkSaveDraft({ document: renamed, expectedContentHash: original.status === "draft" ? original.contentHash : undefined });
        if (working?.id === item.id) { setRecord(updated); setWorking(updated.document); setDirty(false); }
      }
      await refreshList(); setNotice(resultNotice);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setNewOpen(false); setMenu(null); setRename(null); setPan(false); return; }
      const editingText = event.target instanceof HTMLElement && Boolean(event.target.closest("input,textarea,select,[contenteditable=true]"));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); if (reviewing) sourceRef.current?.save(); else void save(); return;
      }
      if (editingText || newOpen || menu || rename || reviewing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if ((event.key === "Delete" || event.key === "Backspace") && canEdit) { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener("keydown", handle); return () => window.removeEventListener("keydown", handle);
  });
  const primaryLabel = reviewing ? sourceProgress?.primary ?? "İncelemeye başla" : !working ? "Görsel ekle"
    : !working.geometry.paths.length ? "Çizgi ekle" : dirty || !record ? "Kaydet" : status === "draft" ? previewOpen ? "Önizlemeyi doğrula" : "Önizle"
    : status === "checked" ? "Onayla" : !selectionMatches ? "Siteye hazırla" : packageReady ? "Paket hazır ✓" : "Paketi hazırla";
  function primaryAction() {
    if (reviewing) { setRightOpen(true); sourceRef.current?.advance(); }
    else if (!working) void pickSource();
    else if (!working.geometry.paths.length) { setMode("freehand"); setPan(false); }
    else if (dirty || !record) void save();
    else if (status === "draft") {
      if (previewOpen) void review("checked");
      else { setExperimentalCurve("linear"); setView("svg"); setPreviewOpen(true); setTimelinePreview(true); setTimelineMs(0); }
    } else if (status === "checked") void review("approved");
    else if (!selectionMatches) void toggleSiteSelection();
    else if (!packageReady) void prepareSitePackage();
  }
  const steps = [
    { name: "Kaynak", detail: activeSourceId ? "Hazır" : working ? "Sıfırdan" : "Bekliyor", done: Boolean(activeSourceId || working) },
    { name: "İncele", detail: sourceProgress?.analyzed ? sourceProgress.remaining ? `${sourceProgress.remaining} öğe kaldı` : sourceProgress.saved ? "Tamamlandı" : "Kaydedilmeli" : sourceEvidence ? "Tamamlandı" : working ? "Gerekli değil" : "Bekliyor", done: Boolean(sourceEvidence || (sourceProgress?.saved && !sourceProgress.remaining) || (working && !activeSourceId)) },
    { name: "Çizim", detail: `${working?.geometry.paths.length ?? sourceProgress?.paths ?? 0} yol`, done: Boolean(working) },
    { name: "Onay", detail: ["approved","published"].includes(status) ? "Onaylı" : status === "checked" ? "Önizleme doğrulandı" : "Bekliyor", done: ["approved","published"].includes(status) },
    { name: "Yayına hazır", detail: packageReady && selectionMatches ? "Paket hazır" : selectionMatches ? "Katalogda" : "Hazır değil", done: packageReady && selectionMatches },
  ];
  useEffect(() => {
    setDrawingImage(null);
    if (!bridge || !sourceEvidence || !activeSourceId) return;
    let alive = true;
    void bridge.vefkSourceGet(sourceEvidence.sourceId, sourceEvidence.preparationRevision)
      .then(image => { if (alive) setDrawingImage(image); }).catch(() => { if (alive) setDrawingImage(null); });
    return () => { alive = false; };
  }, [bridge, sourceEvidence?.sourceId, sourceEvidence?.preparationRevision, activeSourceId]);
  const currentStep = steps.findIndex(step => !step.done);
  if (!bridge) return <div className="panel vefk-not-available">Vefk Atölyesi Studio masaüstünde çalışır.</div>;

  return <div className={`vefk-workshop ${leftOpen ? "" : "no-library"} ${rightOpen ? "" : "no-inspector"}`}>
    <header className="vefk-head">
      <div className="vefk-head-title"><h2>Vefk Atölyesi</h2><span title={reviewing ? sourceImage?.filename : working?.title}>{reviewing ? sourceImage?.filename : working?.title || sourceImage?.filename || "Yeni çalışma"}</span></div>
      <div className="vefk-head-actions">
        <span className={`vefk-state is-${status}`}>{dirty || sourceDirty ? "Kaydedilmedi" : working ? statusLabels[status] : "Kaynak"}</span>
        <button className="vefk-button subtle" title={leftOpen ? "Koleksiyonu daralt" : "Koleksiyonu aç"} aria-label={leftOpen ? "Koleksiyonu daralt" : "Koleksiyonu aç"} aria-pressed={leftOpen} onClick={() => { leftPanelUserChoice.current = true; setLeftOpen(!leftOpen); }}>◧</button>
        <button className="vefk-button subtle" title={rightOpen ? "Özellikleri daralt" : "Özellikleri aç"} aria-label={rightOpen ? "Özellikleri daralt" : "Özellikleri aç"} aria-pressed={rightOpen} onClick={() => { rightPanelUserChoice.current = true; setRightOpen(!rightOpen); }}>◨</button>
        <button className="vefk-button" title="Çalışmayı kaydet" aria-label="Kaydet" disabled={busy || (reviewing ? !sourceDirty : !dirty || locked || !working?.geometry.paths.length)} onClick={() => reviewing ? sourceRef.current?.save() : void save()}>Kaydet</button>
        <button className="vefk-button primary vefk-next" disabled={busy || (reviewing && (sourceProgress?.busy || sourceProgress?.preparing)) || (packageReady && selectionMatches && !reviewing)} onClick={primaryAction}>{busy || sourceProgress?.busy && reviewing ? "İşleniyor…" : primaryLabel} <span>→</span></button>
      </div>
    </header>
    <nav className="vefk-flow" aria-label="Üretim aşamaları">{steps.map((step,index) => <button key={step.name} className={`${step.done ? "done" : ""} ${index === currentStep ? "current" : ""}`}
      aria-current={index === currentStep ? "step" : undefined} disabled={index < 2 ? !activeSourceId : index === 2 ? !working : false}
      onClick={() => { if (index < 2 && activeSourceId) { setWorkspaceMode("review"); setView("overlay"); } else if (index === 2 && working) setWorkspaceMode("drawing"); else { setWorkspaceMode("drawing"); setRightOpen(true); } }}>
      <span className="vefk-flow-number">{step.done ? "✓" : String(index+1).padStart(2,"0")}</span><span><strong>{step.name}</strong><small>{step.detail}</small></span></button>)}</nav>
    {error && <div className="vefk-feedback error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Uyarıyı kapat">×</button></div>}
    {notice && <div className="vefk-feedback" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Bildirimi kapat">×</button></div>}
    <div className="vefk-layout">
      {leftOpen && <aside className="vefk-library" aria-label="Vefk koleksiyonu">
        <div className="vefk-library-controls"><div className="vefk-new-actions"><button onClick={() => void pickSource()} disabled={busy}>＋ Görsel</button><button onClick={() => setNewOpen(true)} disabled={busy}>＋ Sıfırdan</button></div>
          <input aria-label="Koleksiyonda ara" placeholder="Koleksiyonda ara…" value={search} onChange={e => setSearch(e.target.value)}/>
          <select aria-label="Duruma göre filtrele" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}><option value="">Tüm durumlar</option><option value="new">Analiz bekliyor</option><option value="draft">Taslak</option><option value="checked">Kontrolde</option><option value="approved">Onaylı</option><option value="published">Yayında</option></select>
        </div>
        <div className="vefk-collection-scroll">
          <div className="vefk-section-heading"><small>KAYNAKLAR</small><strong>{sources.length}</strong></div>
          {sources.filter(image => (!statusFilter || statusFilter === "new" && !image.lastAnalysisId) && image.filename.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR"))).map(image => <div key={image.id} className={`vefk-collection-row ${activeSourceId === image.id ? "selected" : ""}`}>
            <button className="vefk-source-row" title={image.filename} onClick={() => selectSource(image.id)}><span>▧</span><strong>{image.filename}</strong><small title={image.lastAnalysisId ? "İnceleme var" : "Analiz bekliyor"}>{image.lastAnalysisId ? "◐" : "○"}</small></button>
            <button className="vefk-row-menu" aria-label={`${image.filename} işlemleri`} title="Kayıt işlemleri" onClick={() => setMenu({ kind: "source", id: image.id, name: image.filename })}>⋯</button>
          </div>)}
          {!sources.length && <p className="vefk-empty-list">Henüz görsel yok.</p>}
          <div className="vefk-section-heading"><small>VEFKLER</small><strong>{records.length}</strong></div>
          {visibleRecords.map(item => <div key={item.id} className={`vefk-collection-row ${working?.id === item.id ? "selected" : ""}`}>
            <button className="vefk-document-row" title={item.title} onClick={() => void openRecord(item.id)}><span>✦</span><strong>{item.title}</strong><small className={`is-${item.status}`} title={statusLabels[item.status]}>{["approved","published"].includes(item.status) ? "✓" : "○"}</small></button>
            <button className="vefk-row-menu" aria-label={`${item.title} işlemleri`} title="Kayıt işlemleri" onClick={() => setMenu({ kind: "document", id: item.id, name: item.title })}>⋯</button>
          </div>)}
          {!visibleRecords.length && <p className="vefk-empty-list">Kayıt yok.</p>}
        </div>
        {record && <details className="vefk-revision-panel"><summary>Revizyonlar · {revisions.length}</summary>{revisions.map(version => <button key={version.revision} className={version.revision === working?.revision ? "current" : ""} onClick={() => void openRecord(version.id, version.revision)}>r{version.revision}<span>{statusLabels[version.status]}</span></button>)}</details>}
        <button className="vefk-cleanup" disabled={busy} onClick={() => setMenu({ kind: "source", id: "", name: "Dosya temizliği" })}>Dosya temizliği</button>
      </aside>}
      <section className="vefk-center" aria-label="Vefk üretim alanı">
        <div className="vefk-toolbar" role="toolbar" aria-label="Çalışma yüzeyi araçları">
          {!reviewing && working && <button type="button" className="vefk-button" aria-pressed={readingOpen} onClick={() => { setReadingOpen(!readingOpen); setTimelinePreview(false); }}>Okuma İçeriği</button>}
          <div className="vefk-view-switch" role="group" aria-label="Yüzey görünümü">{(["photo","overlay","svg"] as const).map(option => <button key={option} aria-pressed={view === option} className={view === option ? "active" : ""} disabled={!activeSourceId && option !== "svg" || !reviewing && sourceEvidence?.method === "grid" && option !== "svg"}
            onClick={() => setView(option)}>{option === "photo" ? "Fotoğraf" : option === "overlay" ? "Üst üste" : "SVG"}</button>)}</div>
          <div className="vefk-tool-group" ref={setToolbarHost} hidden={!reviewing}/>
          {!reviewing && working && <div className="vefk-tool-group">{tools.map(tool => <button key={tool.id} title={tool.label} aria-label={tool.label} aria-pressed={!pan && mode === tool.id} className={!pan && mode === tool.id ? "active" : ""} disabled={!canEdit} onClick={() => { setMode(tool.id); setPan(false); }}>{tool.symbol}</button>)}
            <button title="Geri al" aria-label="Geri al" disabled={!history.length || !canEdit} onClick={undo}>↶</button><button title="Yinele" aria-label="Yinele" disabled={!future.length || !canEdit} onClick={redo}>↷</button>
          </div>}
          <div className="vefk-zoom"><button title="Görünümü taşı" aria-label="Görünümü taşı" aria-pressed={pan} className={pan ? "active" : ""} onClick={() => setPan(!pan)}>✥</button><button title="Görünüme sığdır" aria-label="Görünüme sığdır" onClick={fitArtboard}>⊞</button>
            <button title="Küçült" aria-label="Küçült" onClick={() => viewportRef.current?.zoom(-.25)}>−</button><span>{Math.round(zoom*100)}%</span><button title="Büyüt" aria-label="Büyüt" onClick={() => viewportRef.current?.zoom(.25)}>+</button></div>
        </div>
        {readingOpen && working && !reviewing ? <section className="vefk-reading-editor" aria-label="Okuma İçeriği düzenleyicisi">
          <div className="vefk-reading-fields">
            <h3>Okuma İçeriği</h3>
            <p>{locked ? "Bu revizyon kilitli. Düzenlemek için yeni revizyon aç." : "Kaydet, önizlemeyi doğrula, onayla ve site kataloğuna seç."}</p>
            <label>Başlık<input aria-label="Başlık" maxLength={300} value={working.title} disabled={!canEdit} onChange={e => patchDocument({ title: e.target.value })}/></label>
            <label>Açıklama<textarea aria-label="Açıklama" rows={8} maxLength={4000} value={working.description} disabled={!canEdit} onChange={e => patchDocument({ description: e.target.value })}/></label>
            <label>Kaynaklar · her satıra bir kaynak<textarea aria-label="Kaynaklar · her satıra bir kaynak" rows={4} value={working.provenance.references.join("\n")} disabled={!canEdit} onChange={e => patchDocument({ provenance: { ...working.provenance, references: e.target.value.split("\n") } })}/></label>
            <label>Yayın notları<textarea aria-label="Yayın notları" rows={4} maxLength={4000} value={working.provenance.notes} disabled={!canEdit} onChange={e => patchDocument({ provenance: { ...working.provenance, notes: e.target.value } })}/></label>
            <label>İçerik dili<input aria-label="İçerik dili" maxLength={20} value={working.language} disabled={!canEdit} onChange={e => patchDocument({ language: e.target.value })}/></label>
          </div>
          <div className="vefk-reading-preview"><small>Site okuma önizlemesi</small><VefkReading document={working} /></div>
        </section> : !working && !activeSourceId ? <div className="vefk-start"><span className="vefk-start-symbol">▧</span><h3>Bir görselle başla.</h3><p>İncele, çizime dönüştür, yayına hazırla.</p><button className="vefk-button primary" onClick={() => void pickSource()}>Görsel ekle</button><button className="vefk-button" onClick={() => setNewOpen(true)}>Sıfırdan oluştur</button></div>
          : <VefkViewport ref={viewportRef} aspect={reviewing ? sourceProgress?.aspect ?? 1 : stageWidth/stageHeight} pan={pan} onScale={setZoom} unframed={reviewing && sourceProgress?.preparing}>
            {activeSourceId && <div className="vefk-source-surface" hidden={!reviewing}><VefkSourceWorkbench key={`${activeSourceId}-${sourceVersion}`} ref={sourceRef} sourceId={activeSourceId} onStartDrawing={startSourceDraft} onDirtyChange={setSourceDirty} onProgress={setSourceProgress} onSourceLoaded={setSourceImage} inspector={inspectorHost} toolbar={toolbarHost} active={reviewing} showPhoto={view !== "svg"} showTraces={view !== "photo"} onRevealTraces={revealTraces} onInspect={inspectSource} onPrepareStart={() => {
                if (!guardedLeave()) return false;
                setWorking(null); setRecord(null); setRevisions([]); setDirty(false); setSourceEvidence(null); setSelectedPath(null); resetHistory();
                return true;
              }}/></div>}
            {working && <div className="vefk-vector-surface" hidden={reviewing}>              <svg ref={canvasRef} width="100%" height="100%" viewBox={working.geometry.viewBox.join(" ")}
                className={`vefk-artboard mode-${mode} ${timelineFrame ? "vefk-timeline-preview" : ""}`}
                aria-label={`${working.title} SVG çizimi`}
                role="img"
                onPointerDown={pointerStart} onPointerMove={pointerMove}
                onPointerUp={pointerFinish} onPointerCancel={() => {
                  gestureRef.current = null; setPreviewPath(null); setDragPreviewId(null);
                }}>
                <rect x={stageX} y={stageY} width={stageWidth} height={stageHeight} className="vefk-surface"/>
                {view !== "svg" && drawingImage && sourceEvidence?.method === "traced" && <image href={drawingImage.imageDataUrl}
                  x={stageX} y={stageY} width={stageWidth} height={stageHeight} preserveAspectRatio="none" opacity={view === "photo" ? 1 : .65}/>}
                {guides && view === "svg" && <g className="vefk-guide-lines" pointerEvents="none">
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
                  const fraction = view === "photo" ? 0 : timelineFrame ? progressByPath.get(path.id) ?? 0 : 1;
                  const pieces = timelineFrame ? visibleSubpaths(display, fraction) : [{ d: display, fraction }];
                  return <g key={path.id} onPointerDown={event => pathStart(event, path)}>
                    {pieces.map((piece,index) => <path key={index} d={piece.d}
                      className={`vefk-ink ${path.ink === "grid" ? "grid-ink" : "glyph-ink"} ${active ? "is-selected" : ""}`}
                      pathLength={timelineFrame ? 1 : undefined}
                      strokeDasharray={timelineFrame ? 1 : undefined}
                      strokeDashoffset={timelineFrame ? 1 - piece.fraction : undefined}
                      strokeOpacity={piece.fraction > 0 ? 1 : 0}
                      opacity={view === "photo" ? 0 : 1} strokeWidth={inkStyle?.width ?? 7} strokeLinecap={inkStyle?.cap ?? "round"}/>) }
                  </g>;
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
              </svg></div>}
          </VefkViewport>}
        {!reviewing && working && <VefkTimelineEditor key={`${working.id}-${working.revision}`} document={working} disabled={!canEdit} selectedPath={selectedPath}
          onSelectPath={id => { setSelectedPath(id); setMode("select"); setRightOpen(true); }} previewMs={timelineMs} onPreviewMs={selectTimelineTime}
          previewCurve={experimentalCurve} onPreviewCurve={setExperimentalCurve} onEnablePersistentMotion={() => void enablePersistentMotion()}
          forceOpen={previewOpen} onShowComplete={() => { setTimelinePreview(false); setTimelineMs(working.drawPlan.durationMs); }}
          onPlanChange={plan => apply({ ...working, drawPlan: plan })} onError={setError}/>}
        <footer className="vefk-stage-foot"><span>{reviewing ? `İnceleme: ${sourceProgress?.remaining ?? 0} kaldı` : working ? `${working.geometry.paths.length} yol · r${working.revision}` : "Kaynak bekleniyor"}</span><span>{reviewing ? "○ İnceleme　● Mavi: kontur　✓ Yeşil: onaylı" : locked ? "Revizyon kilitli" : "SVG çalışma yüzeyi"}</span></footer>
      </section>
      {rightOpen && <aside className="vefk-inspector" aria-label="Bağlamsal özellikler" ref={setInspectorHost}>
        {!reviewing && working && <div className="vefk-properties">
          <div className="vefk-inspector-head"><small>{selected ? "SEÇİLİ YOL" : "ÇALIŞMA"}</small><span>r{working.revision}</span></div>
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
                <button disabled={!canEdit} onClick={() => nudge(-10, 0)} title="10 birim sola" aria-label="Sola taşı">←</button>
                <button disabled={!canEdit} onClick={() => nudge(0, -10)} title="10 birim yukarı" aria-label="Yukarı taşı">↑</button>
                <button disabled={!canEdit} onClick={() => nudge(0, 10)} title="10 birim aşağı" aria-label="Aşağı taşı">↓</button>
                <button disabled={!canEdit} onClick={() => nudge(10, 0)} title="10 birim sağa" aria-label="Sağa taşı">→</button>
              </div>
              <div className="vefk-nudge">
                <button disabled={!canEdit} onClick={() => resizeSelected(0.9)}>− %10</button>
                <button disabled={!canEdit} onClick={() => resizeSelected(1.1)}>+ %10</button>
                <button disabled={!canEdit || requiredPath(selected.id)}
                  onClick={removeSelected}>Sil</button>
              </div>
              <label><span>Geometri</span><textarea key={selected.id + selected.d} defaultValue={selected.d} disabled={!canEdit} rows={3}
                aria-label="Yol geometrisi" onBlur={event => {
                  if (event.target.value === selected.d || !canEdit) return;
                  const field = event.currentTarget;
                  const geometry = { ...working.geometry, paths: working.geometry.paths.map(path => path.id === selected.id ? { ...path, d: field.value } : path) };
                  void bridge.vefkGenerate({ ...editorInput(working), geometry, drawPlan: reconcileDrawPlan(geometry, working.drawPlan, working.schemaVersion) })
                    .then(next => apply(next)).catch(reason => { field.value = selected.d; setError(errorText(reason)); });
                }}/></label>
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

          {!selected && <div className="vefk-context-empty"><span>↖</span><p>Bir yol seç veya çizim aracı kullan.</p></div>}

          <details className="vefk-advanced" open={Boolean(selected)}><summary>Yollar · {working.geometry.paths.length}</summary>
            <div className="vefk-layer-actions"><button title="Çizim sırasında önceye al" aria-label="Çizim sırasında önceye al" disabled={!selected || !canEdit} onClick={() => moveLayer(-1)}>↑</button><button title="Çizim sırasında sonraya al" aria-label="Çizim sırasında sonraya al" disabled={!selected || !canEdit} onClick={() => moveLayer(1)}>↓</button></div>
            <div className="vefk-layer-list">{orderedPaths.map((path,index) => <button key={path.id} className={selectedPath === path.id ? "current" : ""} onClick={() => { setSelectedPath(path.id); setMode("select"); }} title={path.id}><span>{index+1}</span><strong>{path.semanticValue ?? `Yol ${index+1}`}</strong></button>)}</div>
          </details>
          <details className="vefk-advanced"><summary>Teknik ayrıntılar</summary><small>{working.id}</small><small>{record?.contentHash}</small><small>Belge v{working.schemaVersion}</small></details>
          <details className="vefk-advanced"><summary>Görünüm</summary><label className="vefk-check"><input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)}/>Izgaraya yapış</label><label className="vefk-check"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)}/>Kılavuzlar</label></details>
          <details className="vefk-advanced" open={previewOpen || status === "checked" || selectionMatches}><summary>Yayın hazırlığı</summary>
            <ol className="vefk-readiness">{[
              [!dirty && Boolean(record), "Çalışma kaydedildi"], [steps[1].done, "İnceleme tamamlandı"], [true, "Çizim oluşturuldu"],
              [status !== "new" && status !== "draft", "Önizleme doğrulandı"], [steps[3].done, "Revizyon onaylandı"], [selectionMatches, "Katalogda seçili"], [packageReady && selectionMatches, "Yerel paket hazır"],
            ].map(([done,label]) => <li key={String(label)} className={done ? "done" : ""}><span>{done ? "✓" : "○"}</span>{label}</li>)}</ol>
            {sourceEvidence?.partialAccepted && <small>Kısmi çizim · {sourceEvidence.omittedRegions?.length ?? sourceProgress?.untraced} bölge hariç</small>}
            {status === "checked" && <button onClick={() => void review("draft")} disabled={busy}>Düzeltmeye aç</button>}
            {["approved","published"].includes(status) && <button onClick={() => void nextRevision()} disabled={busy || dirty}>Yeni revizyon</button>}
            {selectionMatches && <button disabled={busy || dirty} onClick={() => { if (window.confirm("Belge yerel yayın kataloğundan çıkarılsın mı? Canlı site değişmez.")) void toggleSiteSelection(); }}>Katalogdan çıkar</button>}
            {packageReadiness && <small>{packageReadiness}</small>}
          </details>
        </div>}
        {!reviewing && !working && <div className="vefk-context-empty"><span>↖</span><p>Görsel ekle veya yeni bir çizim oluştur.</p></div>}
      </aside>}
    </div>
    {menu && <div className="vefk-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setMenu(null); }}><div className="vefk-record-menu" role="dialog" aria-modal="true" aria-label="Kayıt işlemleri"><header><strong>{menu.name}</strong><button aria-label="Menüyü kapat" onClick={() => setMenu(null)}>×</button></header>
      {menu.id ? <>{["rename", ...(menu.kind === "document" ? ["copy", ...(records.some(item => item.id === menu.id && ["approved","published"].includes(item.status)) ? ["revision"] : [])] : ["analyses"]), ...(catalogSelections.some(s => s.id === menu.id) ? ["catalog"] : []), "delete"].map(action => <button key={action} className={action === "delete" || action === "analyses" ? "danger" : ""} onClick={() => void runMenu(action as Parameters<typeof runMenu>[0])}>{action === "rename" ? "Yeniden adlandır" : action === "copy" ? "Çoğalt" : action === "revision" ? "Yeni revizyon" : action === "analyses" ? "Yalnız analizleri sil" : action === "catalog" ? "Katalogdan çıkar" : menu.kind === "source" ? "Görseli ve analizleri sil" : "Belgeyi ve revizyonları sil"}</button>)}
        {menu.kind === "document" && <button onClick={() => { const id = menu.id; setMenu(null); void openRecord(id); }}>Kaydı aç</button>}
      </> : <button onClick={() => void runMenu("cleanup")}>Kullanılmayan Vefk dosyalarını temizle</button>}
    </div></div>}
    {rename && <div className="vefk-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setRename(null); }}>
      <form className="vefk-create-dialog" role="dialog" aria-modal="true" aria-labelledby="vefk-rename-title" onSubmit={event => { event.preventDefault(); void runMenu("rename", rename); }}>
        <header><h3 id="vefk-rename-title">Yeniden adlandır</h3><button type="button" aria-label="Kapat" onClick={() => setRename(null)}>×</button></header>
        <label>Yeni ad<input autoFocus maxLength={rename.item.kind === "source" ? 200 : 300} value={rename.title} onFocus={event => event.target.select()} onChange={event => setRename({ ...rename, title: event.target.value })}/></label>
        <footer><button type="button" className="vefk-button" onClick={() => setRename(null)}>Vazgeç</button><button type="submit" className="vefk-button primary" disabled={!rename.title.trim() || busy}>Adı kaydet</button></footer>
      </form>
    </div>}
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
