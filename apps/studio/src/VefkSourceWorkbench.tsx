import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { approveItems, cellBox, reviewQueue } from "./vefk-review-model";
import { traceInk, projectTracedGeometry, type SourceBox, type TraceResult } from "./vefk-image-trace";
import { classifyInk } from "./vefk-ink-mask";
import { excludeInkFromMask } from "./vefk-ink-exclusions";
import { compareInkMasks } from "./vefk-ink-compare";
import VefkImagePreparation from "./VefkImagePreparation";
import "./vefk-source-workbench.css";

export type SourceProgress = { remaining: number; paths: number; pendingTraces: number; untraced: number;
  analyzed: boolean; saved: boolean; busy: boolean; preparing: boolean; aspect: number; primary: string };
export type SourceActions = { advance: () => void; save: () => void };
type Props = {
  sourceId: string;
  onStartDrawing: (input: StudioVefkCreateInput, evidence: StudioVefkSourceReview) => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onProgress: (progress: SourceProgress) => void;
  onSourceLoaded: (source: StudioVefkSourceImage) => void;
  inspector: HTMLElement | null;
  toolbar: HTMLElement | null;
  active: boolean;
  showPhoto: boolean;
  showTraces: boolean;
  onRevealTraces: () => void;
  onInspect: () => void;
  onPrepareStart: () => boolean;
};
const regionTypes: StudioVefkRegion["kind"][] = ["grid", "number", "text", "symbol", "line", "seal", "unknown"];
const regionNames: Record<StudioVefkRegion["kind"], string> = {
  grid: "Izgara", number: "Sayı", text: "Yazı", symbol: "Sembol", line: "Çizgi",
  seal: "Mühür", unknown: "Belirsiz",
};
const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason);
function sourceDocumentId() {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 16) : Math.random().toString(36).slice(2, 18);
  return `vefk-source-${token}`;
}
function isIntegerText(text: string): boolean {
  const normalized = text.trim().replace(/[−–]/g, "-");
  return /^[+-]?\d+$/.test(normalized) && Number.isSafeInteger(Number(normalized));
}

export default forwardRef<SourceActions, Props>(function VefkSourceWorkbench({ sourceId, onStartDrawing, onDirtyChange,
  onProgress, onSourceLoaded, inspector, toolbar, active, showPhoto, showTraces, onRevealTraces, onInspect, onPrepareStart }, ref) {
  const bridge = window.channelFoundryStudio;
  const [source, setSource] = useState<StudioVefkSourceImage | null>(null);
  const [analysis, setAnalysis] = useState<StudioVefkSourceAnalysis | null>(null);
  const [working, setWorking] = useState<StudioVefkSourceAnalysisResult | null>(null);
  const [vision, setVision] = useState<StudioVefkVisionSupport | null>(null);
  const [selected, setSelected] = useState<string>("");
  const pictureRef = useRef<SVGSVGElement | null>(null);
  const suppressClick = useRef(false);
  const drawingRef = useRef<{ start: { x:number; y:number }; end:{ x:number; y:number } } | null>(null);
  const [manualSelection, setManualSelection] = useState(false);
  const [textureSelection, setTextureSelection] = useState(false);
  const [excludedAreas, setExcludedAreas] = useState<Record<string,SourceBox[]>>({});
  const [maskPreview, setMaskPreview] = useState<{
    regionId:string;box:SourceBox;dataUrl:string;inkPixels:number;excludedPixels:number;
  } | null>(null);
  const [maskComparison, setMaskComparison] = useState<{
    regionId:string;candidates:Array<{
      level:number;density:number;edgeDensity:number;excludedPixels:number;dataUrl:string;
    }>;
  } | null>(null);
  const [manualPreview, setManualPreview] = useState<SourceBox | null>(null);
  const [threshold, setThreshold] = useState(135);
  const [inkMode, setInkMode] = useState<"global"|"adaptive">("adaptive");
  const [localContrast, setLocalContrast] = useState(22);
  const [traceResolution, setTraceResolution] = useState(480);
  const [preserveDots, setPreserveDots] = useState(true);
  const [traceQuality, setTraceQuality] = useState<{
    regionId:string;report:TraceResult["quality"];sample:TraceResult["sample"];
  } | null>(null);
  const [invert, setInvert] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [conversion, setConversion] = useState<"traced" | "grid">("traced");
  const [preparing, setPreparing] = useState(false);
  const opacity = 100;
  const [showBoxes, setShowBoxes] = useState(true);
  const [aspect, setAspect] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    onDirtyChange(dirty || preparing);
    return () => onDirtyChange(false);
  }, [dirty, preparing, onDirtyChange]);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    setSource(null); setAnalysis(null); setWorking(null); setDirty(false); setError(""); setSelected(""); setTraceQuality(null);
    setExcludedAreas({}); setMaskPreview(null); setTextureSelection(false); setManualSelection(false);
    void Promise.all([
      bridge.vefkSourceGet(sourceId),
      bridge.vefkSourceAnalysis(sourceId),
      bridge.vefkVisionSupport(),
    ]).then(([item, latest, support]) => {
      if (!alive) return;
      if (!item) throw new Error("Kaynak resim bulunamadı.");
      setSource(item); onSourceLoaded(item);
      setAnalysis(latest);
      setWorking(latest?.result ?? null);
      setVision(support);
    }).catch(reason => { if (alive) setError(errorText(reason)); });
    return () => { alive = false; };
  }, [bridge, sourceId]);

  useEffect(() => {
    if (!source) return;
    const picture = new Image();
    picture.onload = () => {
      if (picture.naturalWidth && picture.naturalHeight) {
        setAspect(picture.naturalWidth / picture.naturalHeight);
      }
    };
    picture.src = source.imageDataUrl;
    return () => { picture.onload = null; };
  }, [source?.imageDataUrl]);

  const queue = useMemo(() => reviewQueue(working), [working]);
  const remaining = queue.length;
  const readyGrid = useMemo(() => {
    const grid = working?.grid;
    if (!grid || grid.rows !== grid.columns || grid.rows < 3 || grid.rows > 9) return null;
    if (grid.cells.some(c => !c.reviewed || !isIntegerText(c.text))) return null;
    const rows: number[][] = Array.from({ length: grid.rows }, () => []);
    for (const cell of grid.cells) rows[cell.row][cell.column] = Number(cell.text.trim().replace(/[−–]/g, "-"));
    return rows.every(row => row.length === grid.rows && row.every(Number.isSafeInteger)) ? rows : null;
  }, [working]);
  const selectedRegion = working?.regions.find(region => region.id === selected) ?? null;
  const selectedExclusions = excludedAreas[selected] ?? [];
  useEffect(() => {
    // Never let an old threshold/rectangle preview appear over a new region.
    setMaskPreview(null);
  }, [sourceId,selected,threshold,inkMode,localContrast,traceResolution,invert,excludedAreas,
    selectedRegion?.box[0],selectedRegion?.box[1],selectedRegion?.box[2],selectedRegion?.box[3]]);
  useEffect(() => {
    // Keep candidate thumbnails when only their selected level changes, so the
    // user can compare alternatives without re-running the photo classification.
    setMaskComparison(null);
  }, [sourceId,selected,inkMode,traceResolution,invert,excludedAreas,
    selectedRegion?.box[0],selectedRegion?.box[1],selectedRegion?.box[2],selectedRegion?.box[3]]);
  useEffect(() => { if (active && selected) onInspect(); }, [selected, active, onInspect]);
  const selectedCell = working?.grid?.cells.find(cell => `cell-${cell.row}-${cell.column}` === selected) ?? null;
  const traces = working?.traces ?? [];
  const tracedCount = traces.reduce((sum, group) => sum + group.paths.length, 0);
  const unapprovedTraces = traces.filter(group => !group.reviewed).length;
  const untracedRegions = working?.regions.filter(region =>
    !traces.some(group => group.regionId === region.id)).length ?? 0;
  const readyToTransfer = analysis?.status === "reviewed" && Boolean(working)
    && !dirty && !remaining;
  const canTransferGrid = Boolean(readyToTransfer && readyGrid);
  const canTransferTraces = Boolean(readyToTransfer && tracedCount && !unapprovedTraces);

  function replaceRegion(id: string, patch: Partial<StudioVefkRegion>) {
    if (!working) return;
    setWorking({ ...working, regions: working.regions.map(region => region.id === id
      ? { ...region, ...patch } : region) });
    setDirty(true); setNotice(""); setSelected(id);
  }
  function updateRegionBox(regionId: string, coordinate: number, value: number) {
    if (!working || busy || !Number.isInteger(value)) return;
    const region = working.regions.find(item => item.id === regionId);
    if (!region) return;
    const box = [...region.box] as SourceBox;
    box[coordinate] = value;
    const [x,y,w,h] = box;
    if (x < 0 || y < 0 || w < 8 || h < 8 || x + w > 1000 || y + h > 1000) {
      setError("Kaynak bölgesi 0–1000 sınırında kalmalı; en ve boy en az 8 olmalı.");
      return;
    }
    if (box.every((n,i) => n === region.box[i])) return;
    setWorking({ ...working,
      regions: working.regions.map(item => item.id === regionId
        ? { ...item, box, reviewed: false, needsReview: true } : item),
      // Old strokes refer to the former crop; they cannot remain approved or saved.
      traces: working.traces.filter(group => group.regionId !== regionId),
    });
    if (traceQuality?.regionId === regionId) setTraceQuality(null);
    setExcludedAreas(previous => ({...previous,[regionId]:[]}));
    setTextureSelection(false);setMaskPreview(null);
    setDirty(true); setError(""); setSelected(regionId);
    setNotice("Bölge sınırı güncellendi. Eski izler ve geçici doku dışlamaları kaldırıldı; yeniden izle ve doğrula.");
  }
  function changeExcludedAreas(regionId:string,areas:SourceBox[]) {
    if(!working)return;
    setExcludedAreas(previous => ({...previous,[regionId]:areas}));
    setMaskPreview(null);
    if(traceQuality?.regionId===regionId)setTraceQuality(null);
    if(working.traces.some(group=>group.regionId===regionId)){
      // A changed mask must never leave older approved paths attached to the crop.
      setWorking({...working,
        traces:working.traces.filter(group=>group.regionId!==regionId),
        regions:working.regions.map(region=>region.id===regionId
          ? {...region,reviewed:false,needsReview:true}:region),
      });
      setDirty(true);
    }
    setNotice("Doku dışlaması güncellendi. Bu bölgenin eski izleri geçersiz; maskeyi önizleyip yeniden izle.");
  }
  function replaceCell(row: number, column: number, patch: Partial<StudioVefkCell>) {
    if (!working?.grid) return;
    setWorking({ ...working, grid: {
      ...working.grid,
      cells: working.grid.cells.map(cell => cell.row === row && cell.column === column
        ? { ...cell, ...patch } : cell),
    } });
    setDirty(true); setNotice(""); setSelected(`cell-${row}-${column}`);
  }

  function localPoint(event: ReactPointerEvent<SVGSVGElement>) {
    const svg=pictureRef.current;
    if (!svg) throw new Error("Kaynak görsel alanı bulunamadı.");
    const matrix=svg.getScreenCTM();
    if (!matrix) throw new Error("Görsel koordinat dönüşümü bulunamadı.");
    const point=svg.createSVGPoint();
    point.x=event.clientX;point.y=event.clientY;
    const transformed=point.matrixTransform(matrix.inverse());
    return {x:Math.max(0,Math.min(1000,transformed.x)),y:Math.max(0,Math.min(1000,transformed.y))};
  }
  function boxBetween(a:{x:number;y:number},b:{x:number;y:number}):SourceBox {
    return [Number(Math.min(a.x,b.x).toFixed(2)),Number(Math.min(a.y,b.y).toFixed(2)),
      Number(Math.abs(a.x-b.x).toFixed(2)),Number(Math.abs(a.y-b.y).toFixed(2))];
  }
  function pointerStart(event:ReactPointerEvent<SVGSVGElement>){
    if ((!manualSelection&&!textureSelection)||!working||event.button!==0||busy||
      (textureSelection&&!selectedRegion)) return;
    const point=localPoint(event);
    suppressClick.current=true;
    drawingRef.current={start:point,end:point};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event:ReactPointerEvent<SVGSVGElement>){
    if(!drawingRef.current)return;
    const point=localPoint(event);
    drawingRef.current.end=point;
    setManualPreview(boxBetween(drawingRef.current.start,point));
  }
  function pointerEnd(event:ReactPointerEvent<SVGSVGElement>){
    const gesture=drawingRef.current;
    drawingRef.current=null;
    setManualPreview(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(!gesture||!working)return;
    const box=boxBetween(gesture.start,localPoint(event));
    if(textureSelection&&selectedRegion){
      const region=selectedRegion.box;
      const left=Math.max(box[0],region[0]),top=Math.max(box[1],region[1]);
      const right=Math.min(box[0]+box[2],region[0]+region[2]);
      const bottom=Math.min(box[1]+box[3],region[1]+region[3]);
      if(right-left<2||bottom-top<2){
        setNotice("Doku dışlamak için seçili bölge içinde en az 2×2 birim alan çiz.");return;
      }
      if(selectedExclusions.length>=24){setError("Bu bölgede en fazla 24 dışlama alanı kullanılabilir.");return;}
      changeExcludedAreas(selectedRegion.id,[...selectedExclusions,[
        Number(left.toFixed(2)),Number(top.toFixed(2)),
        Number((right-left).toFixed(2)),Number((bottom-top).toFixed(2)),
      ]]);
      setTextureSelection(false);
      return;
    }
    if(box[2]<8||box[3]<8){setNotice("Bölge oluşturmak için görsel üzerinde daha geniş bir alan seç.");return;}
    if(working.regions.length>=250){setError("En fazla 250 kaynak bölgesi seçilebilir.");return;}
    const id="region-"+String(working.regions.length+1).padStart(3,"0");
    setWorking({...working,regions:[...working.regions,{
      id,kind:"symbol",box,label:"",confidence:1,reviewed:false,needsReview:true,
    }]});
    setSelected(id);setManualSelection(false);setDirty(true);setNotice("Yeni bölge eklendi. Türünü ve çizgilerini inceleyebilirsin.");
  }

  async function sampleSelectedRegion() {
    if(!source||!selectedRegion) throw new Error("Önce fotoğraftan bir bölge seç.");
    const img=new Image();img.src=source.imageDataUrl;
    await img.decode();
    const [x,y,w,h]=selectedRegion.box;
    const cropX=x/1000*img.naturalWidth,cropY=y/1000*img.naturalHeight;
    const cropW=w/1000*img.naturalWidth,cropH=h/1000*img.naturalHeight;
    const scale=Math.min(1,traceResolution/Math.max(cropW,cropH));
    const width=Math.max(12,Math.min(512,Math.round(cropW*scale)));
    const height=Math.max(12,Math.min(512,Math.round(cropH*scale)));
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx)throw new Error("Raster örnekleme desteklenmiyor.");
    ctx.fillStyle="white";ctx.fillRect(0,0,width,height);
    ctx.drawImage(img,cropX,cropY,cropW,cropH,0,0,width,height);
    return {width,height,data:ctx.getImageData(0,0,width,height).data};
  }
  async function previewSelectedMask() {
    if(!selectedRegion || busy)return;
    if(maskPreview?.regionId===selectedRegion.id){setMaskPreview(null);return;}
    setBusy(true);setError("");
    try {
      const image=await sampleSelectedRegion();
      const classified=classifyInk(image,{threshold,invert,inkMode,localContrast});
      const {mask,excludedPixels}=excludeInkFromMask(
        classified.mask,image.width,image.height,selectedRegion.box,selectedExclusions);
      const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext("2d");
      if(!ctx)throw new Error("Maske önizlemesi desteklenmiyor.");
      const pixels=ctx.createImageData(image.width,image.height);
      let inkPixels=0;
      for(let i=0;i<mask.length;i++)if(mask[i]){
        const p=i*4;pixels.data[p]=234;pixels.data[p+1]=45;
        pixels.data[p+2]=95;pixels.data[p+3]=155;inkPixels++;
      }
      ctx.putImageData(pixels,0,0);
      setMaskPreview({regionId:selectedRegion.id,box:[...selectedRegion.box] as SourceBox,
        dataUrl:canvas.toDataURL("image/png"),inkPixels,excludedPixels});
      setNotice("Pembe alanlar çizime aday piksellerdir; henüz onaylı SVG değildir.");
    }catch(reason){setError(errorText(reason));}
    finally{setBusy(false);}
  }
  async function compareSelectedMasks() {
    if(!selectedRegion || busy)return;
    if(maskComparison?.regionId===selectedRegion.id){setMaskComparison(null);return;}
    setBusy(true);setError("");
    try {
      const image=await sampleSelectedRegion();
      const candidates=compareInkMasks(image,selectedRegion.box,{
        threshold,inkMode,localContrast,invert,excludedAreas:selectedExclusions,
      }).map(candidate=>{
        const canvas=document.createElement("canvas");
        canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext("2d");
        if(!ctx)throw new Error("Maske karşılaştırması desteklenmiyor.");
        const pixels=ctx.createImageData(image.width,image.height);
        pixels.data.set(image.data);
        for(let i=0;i<candidate.mask.length;i++)if(candidate.mask[i]){
          const p=i*4;
          pixels.data[p]=Math.round(image.data[p]*.4+234*.6);
          pixels.data[p+1]=Math.round(image.data[p+1]*.4+45*.6);
          pixels.data[p+2]=Math.round(image.data[p+2]*.4+95*.6);
          pixels.data[p+3]=255;
        }
        ctx.putImageData(pixels,0,0);
        return {level:candidate.level,density:candidate.density,
          edgeDensity:candidate.edgeDensity,excludedPixels:candidate.excludedPixels,
          dataUrl:canvas.toDataURL("image/png")};
      });
      setMaskComparison({regionId:selectedRegion.id,candidates});
      setNotice("Üç karşılaştırma yalnız önizlemedir. Daha az pembe alan mutlaka daha iyi yazı izi değildir.");
    }catch(reason){setError(errorText(reason));}
    finally{setBusy(false);}
  }
  async function traceSelectedRegion() {
    if(!source||!working||!selectedRegion||busy)return;
    setError("");setNotice("");setBusy(true);
    try {
      const image=await sampleSelectedRegion();
      const result=traceInk(image,selectedRegion.box,selectedRegion.id,
        {threshold,invert,inkMode,localContrast,preserveDots,maxPaths:160,minLength:5,
          excludedAreas:selectedExclusions});
      const before=working.traces.filter(group=>group.regionId!==selectedRegion.id);
      if(before.reduce((s,g)=>s+g.paths.length,0)+result.paths.length>850)
        throw new Error("Kaynak için 850 kontur yolu sınırına ulaşıldı. Bölge sayısını azalt.");
      setWorking({...working,traces:[...before,{
        regionId:selectedRegion.id,reviewed:false,
        paths:result.paths.map(line=>({id:line.id,d:line.d})),
      }]});
      setDirty(true); onRevealTraces();
      setTraceQuality({regionId:selectedRegion.id,report:result.quality,sample:result.sample});
      setNotice(result.paths.length+" çizgi çıkarıldı · "+result.quality.joinedSegments+
        " iskelet parçası birleştirildi · "+result.quality.preservedDots+
        " küçük işaret korundu · "+result.quality.removedSpeckles+
        " toz izi temizlendi. Mavi çizgileri fotoğraf üzerinde kontrol edip onayla.");
    }catch(reason){setError(errorText(reason));}
    finally{setBusy(false);}
  }
  function reviewTrace(regionId:string,reviewed:boolean){
    if(!working)return;
    setWorking({...working,traces:working.traces.map(group=>group.regionId===regionId
      ? {...group,reviewed} : group)});
    setDirty(true);setNotice("");
  }
  function deleteTrace(regionId:string){
    if(!working)return;
    setWorking({...working,traces:working.traces.filter(group=>group.regionId!==regionId)});
    if (traceQuality?.regionId === regionId) setTraceQuality(null);
    setDirty(true);setNotice("Seçilen bölgenin vektör izleri kaldırıldı; kaynak resim korundu.");
  }

  function openPreparation() {
    if (busy || !source || preparing) return;
    if (!onPrepareStart()) return;
    if (dirty) { setWorking(analysis?.result ?? null); setDirty(false); }
    setPreparing(true); setError(""); setNotice("");
  }
  function preparationSaved(updated: StudioVefkSourceImage) {
    setSource(updated);onSourceLoaded(updated);setAnalysis(null);setWorking(null);setSelected("");setTraceQuality(null);
    setExcludedAreas({});setMaskPreview(null);setTextureSelection(false);
    setDirty(false);setPreparing(false);setManualSelection(false);
    setNotice("Yeni görüntü hazırlığı r" + updated.preparation?.revision + " kaydedildi. AI çözümlemesini bu görüntü üzerinde yeniden başlatabilirsin. Önceki analizler arşivde.");
  }

  async function analyze() {
    if (!bridge || busy || !source) return;
    if (dirty && !window.confirm("Kaydedilmemiş düzeltmeler var. Analiz yeniden çalıştırılsın mı? Önceki kayıtlar arşivde kalacak.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await bridge.vefkSourceAnalyze(source.id);
      setAnalysis(result); setWorking(result.result); setSelected(""); setDirty(false); setTraceQuality(null);
      setExcludedAreas({});setMaskPreview(null);setTextureSelection(false);
      setNotice("AI önerisi hazır. Belirsiz bölgeleri ve hücreleri incele.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function saveReview() {
    if (!bridge || !analysis || !working || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await bridge.vefkSourceReview({
        sourceId, expectedAnalysisId: analysis.id, result: working,
      });
      setAnalysis(result); setWorking(result.result); setDirty(false);
      setNotice("İnceleme kaydedildi. Orijinal görsel ve önceki analizler korundu.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function makeDraft(mode: "grid" | "traced") {
    if (!source || !analysis || !working || !bridge || busy || !readyToTransfer) return;
    if (mode === "grid" && !readyGrid) return;
    if (mode === "traced" && !canTransferTraces) return;
    let partialAccepted = false;
    if (mode === "traced" && untracedRegions) {
      partialAccepted = window.confirm(`${untracedRegions} bölge izlenmedi ve SVG’ye aktarılmayacak. Kısmi çizim olarak devam edilsin mi?`);
      if (!partialAccepted) return;
    }
    const evidence: StudioVefkSourceReview = { sourceId, analysisId: analysis.id,
      preparationRevision: working.preparationRevision, method: mode, partialAccepted };
    setBusy(true); setError("");
    try {
      const id = sourceDocumentId();
      const title = source.filename.replace(/\.[a-z0-9]+$/i, "").slice(0, 180);
      const provenance: StudioVefkDocument["provenance"] = {
        kind: "traditional-reference",
        references: [source.id],
        notes: `AI çözümlemesi #${analysis.id}; kaynak SHA-256 ${source.sha256}; görsel hazırlığı r${analysis.result.preparationRevision}; hazırlanan görüntü SHA-256 ${source.preparation?.sha256 ?? source.sha256}; incelenen kaynak: ${source.filename}. ${mode === "grid" ? "Şematik sayısal kare." : "Kaynak fotoğraftan incelenmiş kalem yolları; yalnız izlenen bölgeler."}`,
      };
      if (mode === "grid" && readyGrid) {
        await onStartDrawing({
          id, revision: 1, title, kind: "manualSquare", grid: readyGrid, provenance,
          description: "Görselden okunan ve insan tarafından kontrol edilen sayısal kare. Özgün yazı ve motif konturları bu şematik kareye aktarılmadı.",
        }, evidence);
      } else {
        const sourceImage = new Image();
        sourceImage.src = source.imageDataUrl;
        await sourceImage.decode();
        if (!sourceImage.naturalWidth || !sourceImage.naturalHeight)
          throw new Error("Kaynak görüntünün boyutları okunamadı.");
        const projection = projectTracedGeometry(
          traces.flatMap(group => group.paths),sourceImage.naturalWidth,sourceImage.naturalHeight,
        );
        const paths = projection.paths;
        const geometry: StudioVefkGeometry = {
          coordinateSpace: "svg-viewBox", viewBox: projection.viewBox,
          paths, inkStyles: { trace: { width: 5, cap: "round" } },
        };
        await onStartDrawing({
          id, revision: 1, title, kind: "manualPaths", geometry, provenance,
          description: "Orijinal görselin elle seçilip doğrulanan bölgelerinden elde edilen kalem yolları. İzlendiği kanıtlanmayan alanlar bu vektöre dahil değildir.",
          accessibility: {
            summary: "Kaynak fotoğraftan çizim yolu izleme; " + paths.length + " stroke.",
            matrixText: readyGrid ? readyGrid.map(row => row.join(" ")).join(" / ") : "",
          },
        }, evidence);
      }
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }


  function nextItem(after = selected) {
    const next = queue.find(item => item.id !== after) ?? queue[0];
    if (next) setSelected(next.id);
  }
  function confirmItems(ids: string[]) {
    if (!working) return;
    const next = approveItems(working, ids);
    setWorking(next); setDirty(true); setBulkIds([]);
    const item = reviewQueue(next)[0];
    if (item) setSelected(item.id);
    setNotice(ids.length === 1 ? "✓ Öğe onaylandı" : `✓ ${ids.length} öğe onaylandı`);
  }
  const primary = !working ? "İncelemeye başla" : remaining ? "Sonraki belirsiz öğe"
    : dirty || analysis?.status !== "reviewed" ? "İncelemeyi kaydet"
    : conversion === "grid" && readyGrid ? "Çizimi oluştur"
    : unapprovedTraces ? "Konturları incele" : !tracedCount ? "Çizgi çıkar" : "Çizimi oluştur";
  function advance() {
    if (busy || preparing) return;
    if (!working) { void analyze(); return; }
    if (remaining) { nextItem(); return; }
    if (dirty || analysis?.status !== "reviewed") { void saveReview(); return; }
    if (conversion === "grid" && readyGrid) { void makeDraft("grid"); return; }
    if (unapprovedTraces) { setSelected(traces.find(group => !group.reviewed)!.regionId); return; }
    if (!tracedCount) { setSelected(working.regions[0]?.id ?? ""); return; }
    void makeDraft("traced");
  }
  useImperativeHandle(ref, () => ({ advance, save: () => { void saveReview(); } }));
  useEffect(() => { onProgress({ remaining, paths: tracedCount, pendingTraces: unapprovedTraces,
    untraced: untracedRegions, analyzed: Boolean(working), saved: !dirty && analysis?.status === "reviewed",
    busy, preparing, aspect, primary });
  }, [remaining, tracedCount, unapprovedTraces, untracedRegions, Boolean(working), dirty, analysis?.status, busy, preparing, aspect, primary, onProgress]);

  if (!bridge || !source) return <div className="vefk-source-missing">{error || "Görsel açılıyor…"}</div>;
  const selectedTrace = traces.find(group => group.regionId === selected);
  const select = (id: string) => { if (!manualSelection && !textureSelection) { setSelected(id); onInspect(); } };
  const controls = <>
    <button title="Bölge çiz" aria-label="Bölge çiz" aria-pressed={manualSelection} disabled={!working || busy}
      onClick={() => { setManualSelection(v => !v); setTextureSelection(false); }}>▭</button>
    <button title="Kırp ve hizala" aria-label="Kırp ve hizala" disabled={busy || preparing} onClick={openPreparation}>⌑</button>
    <button title="AI ile yeniden çözümle" aria-label="AI ile yeniden çözümle" disabled={busy || preparing || vision?.supported === false} onClick={() => void analyze()}>✧</button>
    <button title="Tespitleri göster" aria-label="Tespitleri göster" aria-pressed={showBoxes} onClick={() => setShowBoxes(v => !v)}>▦</button>
  </>;
  const properties = <div className="vefk-source-properties">
    <div className="vefk-inspector-head"><small>{selectedCell ? "HÜCRE" : selectedRegion ? regionNames[selectedRegion.kind].toLocaleUpperCase("tr-TR") : "İNCELEME"}</small>
      <span>{selectedCell?.reviewed || selectedRegion?.reviewed ? "✓ Onaylı" : selected ? "Onay bekliyor" : `${remaining} kaldı`}</span></div>
    {error && <p className="vefk-source-alert error" role="alert">{error}</p>}
    {notice && <p className="vefk-source-alert" role="status">{notice.length > 160 ? notice.slice(0, 157) + "…" : notice}</p>}
    {!working && <div className="vefk-context-empty"><span>↖</span><p>Görseli incelemeye başla.</p>
      {vision?.supported === false && <p role="alert">{vision.reason}</p>}</div>}
    {working && <>
      {selectedCell && <section className="vefk-source-selected-editor" key={selected}>
        <h4>Hücre {selectedCell.row + 1} / {selectedCell.column + 1}</h4>
        <label>Okunan değer<input value={selectedCell.text} maxLength={120} disabled={busy}
          onChange={event => replaceCell(selectedCell.row, selectedCell.column, { text: event.target.value, reviewed: false, needsReview: true })}/></label>
        <small>AI güveni %{Math.round(selectedCell.confidence*100)}</small>
        <button disabled={busy || !selectedCell.text.trim() || selectedCell.reviewed} onClick={() => confirmItems([selected])}>
          {selectedCell.reviewed ? "✓ Onaylı" : "Onayla ve ilerle"}</button>
      </section>}
      {selectedRegion && <section className="vefk-source-selected-editor" key={selected}>
        <label>Tür<select aria-label="Bölge türü" value={selectedRegion.kind} disabled={busy} onChange={event => replaceRegion(selected, { kind: event.target.value as StudioVefkRegion["kind"], reviewed: false, needsReview: true })}>
          {regionTypes.map(kind => <option key={kind} value={kind}>{regionNames[kind]}</option>)}</select></label>
        <label>Okunan işaret<input value={selectedRegion.label} maxLength={250} disabled={busy}
          onChange={event => replaceRegion(selected, { label: event.target.value, reviewed: false, needsReview: true })}/></label>
        <small>AI güveni %{Math.round(selectedRegion.confidence*100)}</small>
        <button disabled={busy || selectedRegion.reviewed || !queue.some(item => item.id === selected && item.eligible)} onClick={() => confirmItems([selected])}>
          {selectedRegion.reviewed ? "✓ Onaylı" : "Onayla ve ilerle"}</button>
        <div className="vefk-trace-actions">
          <button disabled={busy} aria-pressed={maskPreview?.regionId === selected} onClick={() => void previewSelectedMask()}>Maske</button>
          <button className="accent" disabled={busy} onClick={() => void traceSelectedRegion()}>Çizgi çıkar</button>
        </div>
        {selectedTrace && <div className="vefk-trace-review">
          <span>{selectedTrace.paths.length} yol · {selectedTrace.reviewed ? "✓ Onaylı" : "Mavi konturları incele"}</span>
          <button disabled={busy || selectedTrace.reviewed} onClick={() => { reviewTrace(selected, true); setNotice("✓ Konturlar onaylandı"); }}>Konturları onayla</button>
          <button disabled={busy} onClick={() => deleteTrace(selected)}>İzleri sil</button>
        </div>}
        <details className="vefk-advanced"><summary>Mürekkep ve sınırlar</summary>
          <label>Algılama<select value={inkMode} onChange={event => setInkMode(event.target.value as "global" | "adaptive")}>
            <option value="adaptive">Yerel kontrast</option><option value="global">Sabit eşik</option></select></label>
          {inkMode === "adaptive" ? <label>Kontrast · {localContrast}<input type="range" min={8} max={55} step={1} value={localContrast} onChange={e => setLocalContrast(Number(e.target.value))}/></label>
            : <label>Eşik · {threshold}<input type="range" min={35} max={220} value={threshold} onChange={e => setThreshold(Number(e.target.value))}/></label>}
          <button disabled={busy} onClick={() => void compareSelectedMasks()}>Maskeleri karşılaştır</button>
          {maskComparison?.regionId === selected && <div className="vefk-mask-comparison-options">{maskComparison.candidates.map(candidate =>
            <button key={candidate.level} disabled={busy} onClick={() => inkMode === "adaptive" ? setLocalContrast(candidate.level) : setThreshold(candidate.level)}>
              <img src={candidate.dataUrl} alt={`Maske ${candidate.level}`}/><span>{candidate.level}</span><small>%{candidate.density}</small></button>)}</div>}
          <label>Örnekleme<select value={traceResolution} onChange={e => setTraceResolution(Number(e.target.value))}><option value={320}>320 px</option><option value={480}>480 px</option></select></label>
          <label className="vefk-check"><input type="checkbox" checked={preserveDots} onChange={e => setPreserveDots(e.target.checked)}/>Noktaları koru</label>
          <label className="vefk-check"><input type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)}/>Koyu zemin</label>
          <button aria-pressed={textureSelection} disabled={busy} onClick={() => { setTextureSelection(v => !v); setManualSelection(false); }}>Doku dışla · {selectedExclusions.length}</button>
          {!!selectedExclusions.length && <button onClick={() => changeExcludedAreas(selected, selectedExclusions.slice(0,-1))}>Son dışlamayı geri al</button>}
          <div className="vefk-region-box-controls"><strong>Sınırlar</strong><div>{["X", "Y", "En", "Boy"].map((caption,index) =>
            <label key={caption}>{caption}<input type="number" min={0} max={1000} value={selectedRegion.box[index]} onChange={e => { if (e.target.value) updateRegionBox(selected, index, Number(e.target.value)); }}/></label>)}</div></div>
          {traceQuality?.regionId === selected && <small>{traceQuality.report.preservedDots} nokta korundu · {traceQuality.report.removedSpeckles} toz izi temizlendi</small>}
        </details>
      </section>}
      {!selected && <div className="vefk-context-empty"><span>↖</span><p>Bir hücre veya bölge seç.</p></div>}
      <details className="vefk-review-queue" open><summary>İnceleme kuyruğu · {remaining}</summary>
        <button disabled={!remaining || busy} onClick={() => nextItem()}>Sonraki öğe →</button>
        {working.grid && <div className="vefk-source-cell-grid" style={{ gridTemplateColumns: `repeat(${working.grid.columns}, minmax(0,1fr))` }}>
          {working.grid.cells.map(cell => <button key={`${cell.row}-${cell.column}`} title={`Hücre ${cell.row+1}/${cell.column+1} · ${cell.reviewed ? "Onaylı" : "Onay bekliyor"}`}
            aria-label={`Hücre ${cell.row+1}/${cell.column+1}`} className={`${cell.reviewed ? "reviewed" : "uncertain"} ${selected === `cell-${cell.row}-${cell.column}` ? "selected" : ""}`}
            onClick={() => setSelected(`cell-${cell.row}-${cell.column}`)}>{cell.text || "?"}{cell.reviewed && <sup>✓</sup>}</button>)}
        </div>}
        <div className="vefk-source-region-list">{working.regions.map(region => <button key={region.id} className={`${region.reviewed ? "reviewed" : "uncertain"} ${selected === region.id ? "selected" : ""}`} onClick={() => setSelected(region.id)}>
          <span>{regionNames[region.kind]}</span><strong>{region.label || "?"}</strong><small>{region.reviewed ? "✓" : "○"}</small></button>)}</div>
      </details>
      <details className="vefk-advanced"><summary>Toplu inceleme</summary>
        <button onClick={() => setBulkIds(queue.filter(item => item.confidence >= .95 && item.eligible).map(item => item.id))}>Yüksek güvenlileri seç</button>
        {queue.filter(item => item.eligible).map(item => <label className="vefk-check" key={item.id}>
          <input type="checkbox" checked={bulkIds.includes(item.id)} onChange={e => setBulkIds(ids => e.target.checked ? [...ids,item.id] : ids.filter(id => id !== item.id))}/>{item.label} · %{Math.round(item.confidence*100)}</label>)}
        <button disabled={!bulkIds.length || busy} onClick={() => confirmItems(bulkIds)}>Seçilenleri onayla · {bulkIds.length}</button>
      </details>
      <details className="vefk-advanced" open={!remaining}><summary>Üretim yöntemi</summary>
        <select aria-label="Üretim yöntemi" value={conversion} onChange={e => setConversion(e.target.value as "traced" | "grid")}>
          <option value="traced">Özgün çizimi koru</option><option value="grid" disabled={!readyGrid}>Sayısal kare</option></select>
        <small>{tracedCount} yol · {untracedRegions} bölge izlenmedi</small>
        {!!untracedRegions && <small>İzlenmeyen bölgeler SVG’ye aktarılmaz.</small>}
        <button disabled={busy || (conversion === "traced" ? !canTransferTraces : !canTransferGrid)} onClick={() => void makeDraft(conversion)}>Çizimi oluştur</button>
      </details>
      <details className="vefk-advanced"><summary>Kaynak ayrıntıları</summary><small>{analysis?.provider} · {analysis?.model}</small><p>{working.note}</p>
        <small>{source.id}</small><small>{source.sha256}</small>
        {!!working.coordinateWarnings?.length && <p>{working.coordinateWarnings.length} koordinat uyarısı. Atlanan bölgeleri elle ekle.</p>}
      </details>
    </>}
  </div>;
  return <>
    {active && toolbar && createPortal(controls, toolbar)}
    {active && inspector && !preparing && createPortal(properties, inspector)}
    {preparing ? <VefkImagePreparation inspector={inspector} source={source} onSaved={preparationSaved} onClose={() => setPreparing(false)}/>
    : <svg ref={pictureRef} viewBox="0 0 1000 1000" preserveAspectRatio="none" className={`vefk-source-picture ${manualSelection || textureSelection ? "select-area" : ""}`}
      onClickCapture={event => { if (suppressClick.current) { suppressClick.current=false; event.stopPropagation(); } }}
      role="img" aria-label="Kaynak görsel ve inceleme tespitleri" onPointerDown={pointerStart} onPointerMove={pointerMove} onPointerUp={pointerEnd}
      onPointerCancel={() => { drawingRef.current = null; setManualPreview(null); }} onClick={e => { if (e.target === e.currentTarget) setSelected(""); }}>
      <image href={source.imageDataUrl} x={0} y={0} width={1000} height={1000} preserveAspectRatio="none" opacity={showPhoto ? opacity / 100 : 0} onClick={() => setSelected("")}/>
      {maskPreview && <image href={maskPreview.dataUrl} x={maskPreview.box[0]} y={maskPreview.box[1]} width={maskPreview.box[2]} height={maskPreview.box[3]} preserveAspectRatio="none" pointerEvents="none"/>}
      {showBoxes && working?.grid?.cells.map(cell => {
        const box = cellBox(working, cell); if (!box) return null;
        const id = `cell-${cell.row}-${cell.column}`;
        return <g key={id} role="button" tabIndex={active ? 0 : -1} aria-label={`Görsel hücre ${cell.row+1}/${cell.column+1}`} onClick={() => select(id)} onKeyDown={e => { if (e.key === "Enter") select(id); }}
          className={`vefk-source-cell ${cell.reviewed ? "reviewed" : "uncertain"} ${selected === id ? "selected" : ""}`}>
          <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]}/><text x={box[0]+8} y={box[1]+24}>{cell.reviewed ? "✓" : "?"}</text></g>;
      })}
      {showBoxes && working?.regions.map(region => <g key={region.id} role="button" tabIndex={active ? 0 : -1} aria-label={`${regionNames[region.kind]} ${region.label}`}
        className={`vefk-source-region ${region.reviewed ? "reviewed" : "uncertain"} ${selected === region.id ? "selected" : ""}`}
        onClick={() => select(region.id)} onKeyDown={e => { if (e.key === "Enter") select(region.id); }}>
        <rect pointerEvents={region.kind === "grid" ? "stroke" : undefined} x={region.box[0]} y={region.box[1]} width={region.box[2]} height={region.box[3]}/>
        <text x={region.box[0]+5} y={Math.max(18,region.box[1]-6)}>{region.reviewed ? "✓ " : "○ "}{region.label || regionNames[region.kind]}</text>
      </g>)}
      {showTraces && traces.map(group => <g key={group.regionId} className={`vefk-source-trace ${group.reviewed ? "reviewed" : "pending"}`} pointerEvents="none">
        {group.paths.map(path => <path key={path.id} d={path.d} fill="none" strokeWidth={4.5} strokeLinecap="round"/>)}</g>)}
      {selectedRegion && selectedExclusions.map((box,index) => <rect key={index} className="vefk-source-excluded-area" x={box[0]} y={box[1]} width={box[2]} height={box[3]} pointerEvents="none"/>)}
      {manualPreview && <rect className={`vefk-source-manual-preview ${textureSelection ? "is-texture" : ""}`} x={manualPreview[0]} y={manualPreview[1]} width={manualPreview[2]} height={manualPreview[3]} pointerEvents="none"/>}
    </svg>}
  </>;
});
