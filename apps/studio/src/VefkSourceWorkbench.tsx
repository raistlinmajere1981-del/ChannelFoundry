import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { traceInk, projectTracedGeometry, type SourceBox, type TraceResult } from "./vefk-image-trace";
import { classifyInk } from "./vefk-ink-mask";
import { excludeInkFromMask } from "./vefk-ink-exclusions";
import { compareInkMasks } from "./vefk-ink-compare";
import VefkImagePreparation from "./VefkImagePreparation";
import "./vefk-source-workbench.css";

type Props = {
  sourceId: string;
  onStartDrawing: (input: StudioVefkCreateInput) => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
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

export default function VefkSourceWorkbench({ sourceId, onStartDrawing, onDirtyChange }: Props) {
  const bridge = window.channelFoundryStudio;
  const [source, setSource] = useState<StudioVefkSourceImage | null>(null);
  const [analysis, setAnalysis] = useState<StudioVefkSourceAnalysis | null>(null);
  const [working, setWorking] = useState<StudioVefkSourceAnalysisResult | null>(null);
  const [vision, setVision] = useState<StudioVefkVisionSupport | null>(null);
  const [selected, setSelected] = useState<string>("");
  const pictureRef = useRef<SVGSVGElement | null>(null);
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
  const [showTraces, setShowTraces] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [opacity, setOpacity] = useState(75);
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
      setSource(item);
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

  const remaining = useMemo(() => working
    ? working.regions.filter(r => r.needsReview).length + (working.grid?.cells.filter(c => c.needsReview).length ?? 0)
    : 0, [working]);
  const readyGrid = useMemo(() => {
    const grid = working?.grid;
    if (!grid || grid.rows !== grid.columns || grid.rows < 3 || grid.rows > 9) return null;
    if (grid.cells.some(c => c.needsReview || !isIntegerText(c.text))) return null;
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
  const selectedCell = working?.grid?.cells.find(cell => `cell-${cell.row}-${cell.column}` === selected) ?? null;
  const traces = working?.traces ?? [];
  const tracedCount = traces.reduce((sum, group) => sum + group.paths.length, 0);
  const unapprovedTraces = traces.filter(group => !group.reviewed).length;
  const untracedRegions = working?.regions.filter(region =>
    !traces.some(group => group.regionId === region.id)).length ?? 0;
  const readyToTransfer = analysis?.status === "reviewed" && Boolean(working)
    && !dirty && !remaining && !unapprovedTraces;
  const canTransferGrid = Boolean(readyToTransfer && readyGrid);
  const canTransferTraces = Boolean(readyToTransfer && tracedCount);

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
      setDirty(true);
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
    if (dirty && !window.confirm("Kaydedilmemiş inceleme düzeltmeleri var. Görsel hazırlığına geçersen bu değişikliklerden vazgeçilecek. Devam edilsin mi?")) return;
    if (dirty) { setWorking(analysis?.result ?? null); setDirty(false); }
    setPreparing(true); setError(""); setNotice("");
  }
  function preparationSaved(updated: StudioVefkSourceImage) {
    setSource(updated);setAnalysis(null);setWorking(null);setSelected("");setTraceQuality(null);
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
        });
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
        });
      }
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  if (!bridge) return <div className="vefk-source-missing">Görsel incelemesi Studio masaüstünde çalışır.</div>;
  if (!source) return <div className="vefk-source-missing">{error || "Kaynak görsel açılıyor…"}</div>;

  return <div className="vefk-source-workspace">
    <header className="vefk-source-header">
      <div><small>KAYNAK GÖRSEL · ORİJİNAL SAKLANIYOR</small><h3 title={source.filename}>{source.filename}</h3>
        <span>{Math.round(source.bytes / 1024)} KB · {source.sha256.slice(0, 13)}… · {source.preparation ? "Düzeltilmiş r" + source.preparation.revision : "Orijinal görünüm"}</span></div>
      <div className="vefk-source-actions">
        <button type="button" disabled={busy || preparing} onClick={openPreparation}>Kırp / hizala</button>
        <button type="button" disabled={busy || preparing || vision?.supported === false} onClick={() => void analyze()}>
          {busy ? "Çözümleniyor…" : analysis ? "Yeniden çözümle" : "AI ile çözümle"}
        </button>
        <button type="button" disabled={(!dirty && analysis?.status === "reviewed") || !analysis || busy} onClick={() => void saveReview()}>{dirty ? "Düzeltmeleri kaydet" : "İncelemeyi kaydet"}</button>
        <button type="button" disabled={!canTransferTraces || busy} onClick={() => void makeDraft("traced")}>
          İzlenen çizgileri SVG'ye aktar
        </button>
        <button type="button" className="primary" disabled={!canTransferGrid || busy} onClick={() => void makeDraft("grid")}>
          Sayısal kareyi SVG'ye aktar
        </button>
      </div>
    </header>
    {error && <p className="vefk-source-alert error" role="alert">{error}</p>}
    {notice && <p className="vefk-source-alert" role="status">{notice}</p>}
    {preparing
      ? <VefkImagePreparation source={source} onSaved={preparationSaved} onClose={() => setPreparing(false)}/>
      : <div className="vefk-source-detail">
      <div className="vefk-source-image-pane">
        <div className="vefk-source-preview-tools">
          <label>İşaretler <input type="checkbox" checked={showBoxes} onChange={event => setShowBoxes(event.target.checked)}/></label>
          <label>Mürekkep yolları <input type="checkbox" checked={showTraces} onChange={event => setShowTraces(event.target.checked)}/></label>
          <button type="button" className={manualSelection ? "selected" : ""} disabled={!working || busy}
            onClick={() => {setTextureSelection(false);setManualSelection(value => !value);}}>{manualSelection ? "Alan seçiminden çık" : "+ Bölge çiz"}</button>
          <button type="button" className={maskPreview ? "selected" : ""} disabled={!selectedRegion || busy}
            onClick={() => void previewSelectedMask()}>{maskPreview ? "Maskeyi gizle" : "Mürekkep maskesi"}</button>
          <button type="button" className={textureSelection ? "selected" : ""} disabled={!selectedRegion || busy}
            onClick={() => {setManualSelection(false);setTextureSelection(value => !value);}}>
            {textureSelection ? "Doku seçiminden çık" : "+ Doku dışla"}</button>
          <label>Görsel %{opacity} <input type="range" min="15" max="100" value={opacity}
            onChange={event => setOpacity(Number(event.target.value))}/></label>
          <span>{analysis?.model ? `${analysis.provider} · ${analysis.model}` : "Henüz analiz yok"}</span>
        </div>
        <div className="vefk-source-picture-scroll">
          <svg ref={pictureRef} viewBox="0 0 1000 1000" preserveAspectRatio="none"
            className={`vefk-source-picture ${manualSelection || textureSelection ? "select-area" : ""}`}
            style={{ aspectRatio: String(aspect) }}
            role="img" aria-label="Orijinal vefk görseli ve AI tespitleri"
            onPointerDown={pointerStart} onPointerMove={pointerMove} onPointerUp={pointerEnd}
            onPointerCancel={() => { drawingRef.current = null; setManualPreview(null); }}>
            <image href={source.imageDataUrl} x="0" y="0" width="1000" height="1000"
              preserveAspectRatio="none" opacity={opacity / 100}/>
            {maskPreview && maskPreview.regionId===selected && <image
              className="vefk-source-mask-preview" href={maskPreview.dataUrl}
              x={maskPreview.box[0]} y={maskPreview.box[1]}
              width={maskPreview.box[2]} height={maskPreview.box[3]}
              preserveAspectRatio="none" pointerEvents="none"/>}
            {showBoxes && working?.regions.map(region =>
              <g key={region.id} className={`vefk-source-region ${region.needsReview ? "uncertain" : "ready"} ${selected === region.id ? "selected" : ""}`}
                onClick={() => { if (!manualSelection) setSelected(region.id); }} role="button" tabIndex={0}
                onKeyDown={event => { if (event.key === "Enter" && !manualSelection) setSelected(region.id); }}>
                <rect x={region.box[0]} y={region.box[1]} width={region.box[2]} height={region.box[3]}/>
                <text x={region.box[0] + 4} y={Math.max(region.box[1] - 6, 16)}>{region.label || regionNames[region.kind]}</text>
              </g>)}
            {showTraces && traces.map(group => <g key={group.regionId} className={`vefk-source-trace ${group.reviewed ? "reviewed" : "pending"}`}
                pointerEvents="none">
              {group.paths.map(path => <path key={path.id} d={path.d} fill="none" strokeWidth="4.5" strokeLinecap="round"/>)}
            </g>)}
            {selectedRegion && selectedExclusions.map((box,index) =>
              <rect key={index} className="vefk-source-excluded-area" x={box[0]} y={box[1]}
                width={box[2]} height={box[3]} pointerEvents="none"/>)}
            {manualPreview && <rect className={`vefk-source-manual-preview ${textureSelection ? "is-texture" : ""}`}
              x={manualPreview[0]} y={manualPreview[1]}
              width={manualPreview[2]} height={manualPreview[3]} pointerEvents="none"/>}
          </svg>
        </div>
        <div className="vefk-source-note">
          <strong>{working ? `${remaining} belirsiz öğe · ${tracedCount} kalem yolu · ${unapprovedTraces} izleme onayı` : "Kaynak hazır"}</strong>
          <span>{working
            ? "Turuncu işaretler inceleme, mavi konturlar çizim doğrulaması bekler. Kaynak fotoğrafı açıp kapatmadan aynı koordinatta karşılaştır."
            : "AI çözümleme yalnızca yapılandırılmış öneri üretir; fotoğraf tek başına onaylı vefk değildir."}</span>
        </div>
      </div>
      <aside className="vefk-source-review-pane">
        {!vision?.supported && <div className="vefk-source-unsupported"><strong>Görsel AI desteği gerekli</strong><p>{vision?.reason || "AI modeli kontrol ediliyor…"}</p></div>}
        {vision?.supported && <div className="vefk-source-provider-note">Kaynak resim, <strong>AI ile çözümle</strong> seçildiğinde Studio AI ayarlarında tanımlı modele gönderilir. Modelin görsel giriş desteği istekte doğrulanır.</div>}
        {working ? <>
          <div className="vefk-source-review-heading"><strong>Çözümleme önerisi</strong><span>#{analysis?.id} · {analysis?.status === "reviewed" ? "İncelendi" : "AI önerisi"}</span></div>
          <p className="vefk-source-description">{working.note || "AI bir açıklama eklemedi."}</p>
          {!!working.coordinateWarnings?.length && <details className="vefk-source-coordinate-warnings" open>
            <summary>Koordinat denetimi · {working.coordinateWarnings.length} uyarı</summary>
            <p>Kırpılan bölgeler onay bekler; atlanan bölgeleri fotoğrafa bakarak elle ekleyebilirsin.</p>
            {working.coordinateWarnings.slice(0, 24).map((warning, index) =>
              <div key={index}>
                <strong>AI alanı #{warning.regionIndex}</strong> · {warning.action === "clipped" ? "Düzeltildi"
                  : warning.action === "skipped" ? "Atlandı" : "Tür belirsiz"}
                <span>{warning.reason} · [{warning.originalBox?.join(", ") ?? "okunamadı"}]
                  {warning.box ? " → [" + warning.box.join(", ") + "]" : ""}</span>
              </div>)}
          </details>}
          {working.grid && <section className="vefk-source-grid-area">
            <h4>Hücre çözümlemesi <small>{working.grid.rows} × {working.grid.columns}</small></h4>
            <div className="vefk-source-cell-grid" style={{ gridTemplateColumns: `repeat(${working.grid.columns}, minmax(0,1fr))` }}>
              {working.grid.cells.map(cell => <button key={`${cell.row}-${cell.column}`} type="button"
                title={`r${cell.row + 1} c${cell.column + 1} · güven %${Math.round(cell.confidence * 100)}`}
                className={`${cell.needsReview ? "uncertain" : ""} ${selected === `cell-${cell.row}-${cell.column}` ? "selected" : ""}`}
                onClick={() => setSelected(`cell-${cell.row}-${cell.column}`)}>
                {cell.text || "?"}</button>)}
            </div>
          </section>}
          {selectedCell && <section className="vefk-source-selected-editor">
            <h4>Hücre {selectedCell.row + 1} / {selectedCell.column + 1}</h4>
            <label>Okunan değer <input value={selectedCell.text} maxLength={120}
              onChange={event => replaceCell(selectedCell.row, selectedCell.column, { text: event.target.value, reviewed: false, needsReview: true })}/></label>
            <small>AI güveni %{Math.round(selectedCell.confidence * 100)}</small>
            <button type="button" disabled={!selectedCell.text.trim()} onClick={() =>
              replaceCell(selectedCell.row, selectedCell.column, { reviewed: true, needsReview: false })}>Doğruladım</button>
          </section>}
          {selectedRegion && <section className="vefk-source-selected-editor">
            <h4>{selectedRegion.id} · %{Math.round(selectedRegion.confidence * 100)}</h4>
            <div className="vefk-region-box-controls">
              <strong>Görsel alanı · X / Y / En / Boy</strong>
              <div>{(["X", "Y", "En", "Boy"] as const).map((caption,index) =>
                <label key={caption}>{caption}
                  <input type="number" min={index < 2 ? 0 : 8} max={1000} step={1}
                    disabled={busy} value={selectedRegion.box[index]}
                    onChange={event => { if (event.target.value.trim())
                      updateRegionBox(selectedRegion.id,index,Number(event.target.value)); }}/>
                </label>)}</div>
              <small>Sınırları daraltmak kâğıt kenarı ve zemin dokusunu dışlar. Değişen bölgenin izleri yeniden kontrol edilir.</small>
            </div>
            <label>Tip <select value={selectedRegion.kind} onChange={event => replaceRegion(selectedRegion.id, {
              kind: event.target.value as StudioVefkRegion["kind"], reviewed: false, needsReview: true,
            })}>{regionTypes.map(type => <option key={type} value={type}>{regionNames[type]}</option>)}</select></label>
            <label>İşaret / metin <input value={selectedRegion.label} maxLength={250}
              onChange={event => replaceRegion(selectedRegion.id, { label: event.target.value, reviewed: false, needsReview: true })}/></label>
            <button type="button" disabled={!selectedRegion.label && !["grid","line"].includes(selectedRegion.kind)}
              onClick={() => replaceRegion(selectedRegion.id, { reviewed: true, needsReview: false })}>Bölge metnini doğruladım</button>
            <div className="vefk-trace-controls">
              <h4>Gerçek mürekkep izleme</h4>
              <label>Algılama yöntemi
                <select value={inkMode} onChange={event => setInkMode(event.target.value as "global"|"adaptive")}>
                  <option value="adaptive">Eski kâğıt · yerel kontrast</option>
                  <option value="global">Sabit renk eşiği</option>
                </select>
              </label>
              {inkMode === "adaptive"
                ? <label>Yerel kontrast · {localContrast}
                  <input type="range" min="8" max="55" step="2" value={localContrast}
                    onChange={event => setLocalContrast(Number(event.target.value))}/>
                </label>
                : <label>Eşik · {threshold}
                  <input type="range" min="35" max="220" step="5" value={threshold}
                    onChange={event => setThreshold(Number(event.target.value))}/>
                </label>}
              <button type="button" disabled={busy} onClick={() => void compareSelectedMasks()}>
                {maskComparison?.regionId===selectedRegion.id ? "Karşılaştırmayı kapat" : "3 maskeyi karşılaştır"}
              </button>
              {maskComparison?.regionId===selectedRegion.id && <div className="vefk-mask-comparison">
                <strong>{inkMode==="adaptive"?"Yerel kontrast":"Sabit eşik"} karşılaştırması</strong>
                <div className="vefk-mask-comparison-options">
                  {maskComparison.candidates.map(candidate =>
                    <button key={candidate.level} type="button" disabled={busy}
                      className={candidate.level===(inkMode==="adaptive"?localContrast:threshold)?"selected":""}
                      title={"Seçili ayarı "+candidate.level+" yap; mevcut izleri yeniden izleyene kadar değiştirmez"}
                      onClick={() => {
                        if(inkMode==="adaptive")setLocalContrast(candidate.level);
                        else setThreshold(candidate.level);
                        setNotice("Kontrast seçildi. Önce maskeyi kontrol et, ardından mürekkep yollarını yeniden izle.");
                      }}>
                      <span>{candidate.level}</span>
                      <img src={candidate.dataUrl} alt={candidate.level+" değerinde kaynak mürekkebi karşılaştırması"}/>
                      <small>Aday %{candidate.density}</small>
                      <small>Kenar %{candidate.edgeDensity}</small>
                    </button>)}
                </div>
                {maskComparison.candidates.some(candidate=>candidate.edgeDensity>=22) &&
                  <small className="vefk-mask-edge-warning">
                    Bölgenin kenarlarında yoğun mürekkep adayı var. Harf taşması veya kâğıt sınırı olabilir; kırpmayı fotoğraftan denetle.
                  </small>}
                <small>Bu kıyaslama yalnız görseldir. Daha az yol veya pembe alan otomatik olarak daha doğru Arapça anlamına gelmez. Seçimden sonra konturları yeniden izle.</small>
              </div>}
              <label>Kaynak örnekleme
                <select value={traceResolution} onChange={event => setTraceResolution(Number(event.target.value))}>
                  <option value={320}>Dengeli · 320 px</option>
                  <option value={480}>İnce yazı · 480 px</option>
                </select>
              </label>
              <label className="vefk-trace-invert">Küçük yazı noktalarını koru
                <input type="checkbox" checked={preserveDots} onChange={event => setPreserveDots(event.target.checked)}/>
              </label>
              <label className="vefk-trace-invert" title="Yalnız koyu zemin üzerine açık renk mürekkep bulunan kaynaklar için. Açık parşömende yanlış kontur çıkarmaz.">Ters renk · koyu zemin
                <input type="checkbox" checked={invert} onChange={event => setInvert(event.target.checked)}/>
              </label>
              <div className="vefk-texture-controls">
                <strong>Doku dışlamaları · {selectedExclusions.length}</strong>
                {selectedExclusions.length>0 && <div>
                  <button type="button" disabled={busy} onClick={() =>
                    changeExcludedAreas(selectedRegion.id,selectedExclusions.slice(0,-1))}>Son alanı geri al</button>
                  <button type="button" disabled={busy} onClick={() =>
                    changeExcludedAreas(selectedRegion.id,[])}>Alanları temizle</button>
                </div>}
                {maskPreview?.regionId===selectedRegion.id && <span>
                  Pembe maske: {maskPreview.inkPixels} aday piksel · {maskPreview.excludedPixels} dışlandı
                </span>}
                <small>+ Doku dışla ile fotoğraf üzerinde istemediğin alanı çiz. Dışlamalar bu oturumda geçicidir; kaydedilen SVG yolları kalıcıdır. İşaretin üzerini yanlışlıkla kapatma.</small>
              </div>
              <button type="button" disabled={busy} onClick={() => void traceSelectedRegion()}>
                {traces.some(group => group.regionId === selectedRegion.id) ? "Konturları yeniden izle" : "Mürekkep çizgilerini izle"}
              </button>
              {traceQuality?.regionId === selectedRegion.id && <div className="vefk-trace-quality" role="status">
                <strong>Son izleme ölçümü</strong>
                <span>Örnek: {traceQuality.sample.width}×{traceQuality.sample.height} px ·
                  mürekkep %{(traceQuality.report.inkFraction * 100).toFixed(1)}</span>
                <span>{traceQuality.report.joinedSegments} iskelet parçası birleştirildi ·
                  {traceQuality.report.preservedDots} küçük işaret korundu ·
                  {traceQuality.report.removedSpeckles} küçük gürültü parçası ayrıldı ·
                  {traceQuality.report.excludedPixels} aday piksel elle dışlandı</span>
                <small>Bunlar otomatik yorumdur. Harf veya sembol olarak doğrulanmış sayılmaz; kaydetmeden önce çizgileri kaynakla karşılaştır.</small>
              </div>}
              {traces.filter(group => group.regionId === selectedRegion.id).map(group =>
                <div key={group.regionId} className="vefk-trace-review">
                  <span>{group.paths.length} yol · {group.reviewed ? "Onaylı" : "İnceleme bekliyor"}</span>
                  <button type="button" disabled={busy || group.reviewed} onClick={() => reviewTrace(group.regionId,true)}>
                    Konturları onayla
                  </button>
                  <button type="button" disabled={busy} onClick={() => deleteTrace(group.regionId)}>İzleri sil</button>
                </div>)}
              <small>Yollar fotoğrafın orta hatlarından çıkarılır. Özellikle karmaşık yazılarda hatalı birleşimleri vektör editöründe düzeltmek gerekebilir.</small>
            </div>
          </section>}
          <section className="vefk-source-region-list">
            <h4>Tespitler <small>{working.regions.length}</small></h4>
            {working.regions.map(region => <button type="button" key={region.id}
              className={`${selected === region.id ? "selected" : ""} ${region.needsReview ? "uncertain" : ""}`}
              onClick={() => setSelected(region.id)}>
              <span>{regionNames[region.kind]}</span><strong>{region.label || "Okunamadı"}</strong>
              <small>%{Math.round(region.confidence * 100)}</small>
            </button>)}
          </section>
          <div className="vefk-source-conversion">
            <strong>SVG üretim durumu</strong>
            <p>{remaining > 0
              ? `${remaining} belirsiz okuma var. Önce doğrulayıp incelemeyi kaydet.`
              : unapprovedTraces > 0
                ? `${unapprovedTraces} kontur grubunun onayı bekleniyor.`
                : dirty ? "Düzeltmeleri kaydedince vektör aktarımı açılacak."
                  : "İncelenmiş içeriği SVG taslağına aktarabilirsin."}</p>
            <p>{readyGrid ? "Sayısal kare: şematik rakamlarla yeniden çizilir." : "Şematik sayı karesi: tam ve doğrulanmış kare yok."}</p>
            <p>{tracedCount
              ? `Özgün mürekkep: ${tracedCount} ayrı yol, ${untracedRegions} bölgede izleme yok. İzlenmemiş kısımlar çıktıya dahil edilmez.`
              : "Özgün mürekkep: henüz hiçbir bölgeden vektör izlenmedi."}</p>
            <p>Her iki aktarım da S2 içinde taslak açar; otomatik onay veya yayın yapmaz.</p>
          </div>
        </> : <div className="vefk-source-empty"><strong>Kaynak görsel hazır.</strong><p>AI ile çözümleyerek hücreleri, sembolleri ve belirsiz alanları görsel üzerinde inceleyebilirsin. Sıfırdan çizim ayrı çalışma yoludur.</p></div>}
      </aside>
    </div>}
  </div>;
}
