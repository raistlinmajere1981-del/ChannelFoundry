import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import { createPortal } from "react-dom";
import {
  FULL_CORNERS,validatePreparation,prepareRgba,preparedDimensions,
  rotateCorners,type Corners,type Raster,type PreparationSettings,
} from "./vefk-image-prepare";
import "./vefk-image-preparation.css";

type Props={
  inspector: HTMLElement | null;
  source:StudioVefkSourceImage;
  onSaved:(updated:StudioVefkSourceImage)=>void;
  onClose:()=>void;
};
const labels=["Sol üst","Sağ üst","Sağ alt","Sol alt"];
const errText=(error:unknown)=>error instanceof Error?error.message:String(error);
function copyFull():Corners{return FULL_CORNERS.map(point=>({...point})) as Corners;}
function editInitial(source:StudioVefkSourceImage):PreparationSettings{
  const saved=source.preparation?.config;
  return saved
    ? {corners:saved.corners.map(p=>({...p})) as Corners,contrast:saved.contrast,brightness:saved.brightness}
    : {corners:copyFull(),contrast:1,brightness:0};
}
async function loadRaster(url:string,maxSide:number):Promise<{raster:Raster;originalWidth:number;originalHeight:number}>{
  const photo=new Image();
  photo.src=url;
  await photo.decode();
  if(!photo.naturalWidth||!photo.naturalHeight)throw new Error("Orijinal görsel açılamadı.");
  const originalWidth=photo.naturalWidth,originalHeight=photo.naturalHeight;
  const factor=Math.min(1,maxSide/Math.max(originalWidth,originalHeight));
  const width=Math.max(12,Math.round(originalWidth*factor));
  const height=Math.max(12,Math.round(originalHeight*factor));
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d",{willReadFrequently:true});
  if(!context)throw new Error("Canvas veri dönüşümü kullanılamıyor.");
  context.fillStyle="#fff";context.fillRect(0,0,width,height);
  context.drawImage(photo,0,0,width,height);
  return {
    raster:{width,height,data:context.getImageData(0,0,width,height).data},
    originalWidth,originalHeight,
  };
}
function canvasData(raster:Raster):string{
  const canvas=document.createElement("canvas");
  canvas.width=raster.width;canvas.height=raster.height;
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Görsel kaydedilemiyor.");
  const pixels=new Uint8ClampedArray(raster.data.length);
  pixels.set(raster.data);
  context.putImageData(new ImageData(pixels,raster.width,raster.height),0,0);
  return canvas.toDataURL("image/png");
}

export default function VefkImagePreparation({source,onSaved,onClose,inspector}:Props){
  const bridge=window.channelFoundryStudio;
  const svgRef=useRef<SVGSVGElement|null>(null);
  const dragRef=useRef<number|null>(null);
  const [settings,setSettings]=useState<PreparationSettings>(()=>editInitial(source));
  const [preview,setPreview]=useState("");
  const [originalAspect,setOriginalAspect]=useState(1);
  const [previewAspect,setPreviewAspect]=useState(1);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [info,setInfo]=useState("Dört köşeyi sürükle.");

  useEffect(()=>{
    let alive=true;
    void loadRaster(source.originalImageDataUrl,360).then(({originalWidth,originalHeight})=>{
      if(alive)setOriginalAspect(originalWidth/originalHeight);
    }).catch(reason=>{if(alive)setError(errText(reason));});
    return()=>{alive=false;};
  },[source.originalImageDataUrl]);

  useEffect(()=>{
    let alive=true;
    // Debounce expensive raster sampling while the user drags a corner.
    const timeout=window.setTimeout(()=>{
      void (async()=>{
        const valid=validatePreparation(settings);
        const {raster,originalWidth,originalHeight}=await loadRaster(source.originalImageDataUrl,1700);
        const dims=preparedDimensions(originalWidth,originalHeight,valid.corners,420);
        const image=prepareRgba(raster,valid,dims);
        if(!alive)return;
        setPreview(canvasData(image));setPreviewAspect(dims.width/dims.height);
        setError("");
      })().catch(reason=>{if(alive)setError(errText(reason));});
    },120);
    return()=>{alive=false;window.clearTimeout(timeout);};
  },[source.originalImageDataUrl,settings]);

  function localPoint(event:ReactPointerEvent<SVGSVGElement>){
    const svg=svgRef.current;
    const matrix=svg?.getScreenCTM();
    if(!svg||!matrix)throw new Error("Perspektif alanı açılamadı.");
    const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    const transformed=p.matrixTransform(matrix.inverse());
    return{x:Math.max(0,Math.min(1000,transformed.x)),
      y:Math.max(0,Math.min(1000,transformed.y))};
  }
  function onPointerMove(event:ReactPointerEvent<SVGSVGElement>){
    const index=dragRef.current;
    if(index===null)return;
    try {
      const next=localPoint(event);
      setSettings(current=>({
        ...current,
        corners:current.corners.map((point,i)=>i===index?next:point) as Corners,
      }));
    }catch(reason){setError(errText(reason));}
  }
  function onPointerFinish(event:ReactPointerEvent<SVGSVGElement>){
    dragRef.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId)){
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
  async function save(){
    if(!bridge||busy)return;
    setBusy(true);setError("");setInfo("Kırpma ve perspektif sonucu kaydediliyor.");
    try{
      const valid=validatePreparation(settings);
      const {raster,originalWidth,originalHeight}=await loadRaster(source.originalImageDataUrl,2048);
      const dims=preparedDimensions(originalWidth,originalHeight,valid.corners,1400);
      const corrected=prepareRgba(raster,valid,dims);
      const imageDataUrl=canvasData(corrected);
      const stored=await bridge.vefkSourcePrepare({
        sourceId:source.id,
        expectedRevision:source.preparation?.revision??0,
        config:valid,
        imageDataUrl,
      });
      const latest=await bridge.vefkSourceGet(source.id);
      if(!latest||latest.preparation?.revision!==stored.revision){
        throw new Error("Hazırlanan görseli yeniden açamadım.");
      }
      onSaved(latest);
    }catch(reason){setError(errText(reason));setInfo("Görsel hazırlanamadı. Orijinal dosya değişmedi.");}
    finally{setBusy(false);}
  }
  const points=settings.corners;
  const polygon=points.map(p=>p.x+","+p.y).join(" ");
  const surface = <div className="vefk-prep-layout">
    <div className="vefk-prep-original">
      <div className="vefk-prep-description">
        <strong>Orijinal fotoğraf</strong><span>Kırp ve hizala</span>
      </div>
      <div className="vefk-prep-original-scroll">
        <svg ref={svgRef} className="vefk-prep-source-svg" viewBox="0 0 1000 1000"
          preserveAspectRatio="none" style={{aspectRatio:String(originalAspect)}}
          role="img" aria-label="Vefk kaynak görseli üzerinde perspektif köşeleri"
          onPointerMove={onPointerMove} onPointerUp={onPointerFinish}
          onPointerCancel={onPointerFinish}>
          <image href={source.originalImageDataUrl} x="0" y="0" width="1000" height="1000"
            preserveAspectRatio="none"/>
          <polygon points={polygon} className="vefk-prep-polygon" pointerEvents="none"/>
          {points.map((point,index)=><g key={index} className="vefk-prep-corner"
            transform={"translate("+point.x+","+point.y+")"}
            onPointerDown={event=>{
              if(busy||event.button!==0)return;
              event.preventDefault();event.stopPropagation();
              dragRef.current=index;svgRef.current?.setPointerCapture(event.pointerId);
            }} role="button" tabIndex={0} aria-label={labels[index]+" köşeyi taşı"}>
            <circle r="19"/>
            <text textAnchor="middle" dominantBaseline="central">{index+1}</text>
          </g>)}
        </svg>
      </div>
    </div>
  </div>;
  const tools =     <aside className="vefk-prep-tools">
      <div className="vefk-prep-description">
        <strong>Perspektif ve renk</strong>
        <span>Hazırlık revizyonu r{(source.preparation?.revision??0)+1}</span>
      </div>
      <div className="vefk-prep-buttons">
        <button type="button" disabled={busy} onClick={()=>setSettings(v=>({...v,corners:rotateCorners(v.corners)}))}>
          ↻ 90° döndür
        </button>
        <button type="button" disabled={busy} onClick={()=>setSettings(v=>({...v,corners:copyFull()}))}>
          Tam görüntü
        </button>
        <button type="button" disabled={busy} onClick={()=>setSettings({corners:copyFull(),contrast:1,brightness:0})}>
          Sıfırla
        </button>
      </div>
      <label>Kontrast · %{Math.round(settings.contrast*100)}
        <input type="range" min="0.5" max="2.5" step="0.05" value={settings.contrast}
          onChange={event=>setSettings(v=>({...v,contrast:Number(event.target.value)}))}/>
      </label>
      <label>Parlaklık · {settings.brightness}
        <input type="range" min="-100" max="100" step="5" value={settings.brightness}
          onChange={event=>setSettings(v=>({...v,brightness:Number(event.target.value)}))}/>
      </label>
      <div className="vefk-prep-preview">
        <strong>Düzeltilmiş önizleme</strong>
        {preview?<img alt="Düzeltilmiş vefk kaynak görseli" src={preview} style={{aspectRatio:String(previewAspect)}}/>:
          <span>Önizleme oluşturuluyor…</span>}
      </div>
      {error&&<p className="vefk-prep-error" role="alert">{error}</p>}
      <p className="vefk-prep-description" role="status">{info}</p>
      <small className="vefk-prep-warning">Kaydettikten sonra yeni görüntüyü yeniden çözümle.</small>
      <div className="vefk-prep-footer">
        <button type="button" disabled={busy} onClick={onClose}>Vazgeç</button>
        <button type="button" className="primary" disabled={busy||!preview||Boolean(error)}
          onClick={()=>void save()}>{busy?"Hazırlanıyor…":"Düzeltmeyi kaydet"}</button>
      </div>
    </aside>;
  return <>{surface}{inspector && createPortal(tools, inspector)}</>;
}
