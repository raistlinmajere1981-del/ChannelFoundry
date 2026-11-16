import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import "./video-frame-selector.css";

type Props = { entityKey: string; sourceVideoIds?: string[]; disabled?: boolean; onAttached: (reference: StudioVisualReference) => void };
type Crop = { x:number; y:number; width:number; height:number };
const FULL: Crop = {x:0,y:0,width:1,height:1};
const validVideoId = (id:string) => /^[A-Za-z0-9_-]{11}$/.test(id);
function clock(seconds:number) {
  const n=Math.floor(seconds),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  return (h?String(h)+":":"")+(h?String(m).padStart(2,"0"):String(m))+":"+String(s).padStart(2,"0");
}
function timeFromText(value:string) {
  const parts=value.trim().split(":");
  if(!parts.length||parts.length>3||parts.some(p=>!/^\d+$/.test(p)))return NaN;
  return parts.reduce((acc,p)=>acc*60+Number(p),0);
}
function errorText(error:unknown) {return error instanceof Error?error.message:String(error);}
const clamp = (n:number) => Math.min(1,Math.max(0,n));

export default function VideoFrameSelector({entityKey,sourceVideoIds=[],disabled=false,onAttached}:Props) {
  const bridge=window.channelFoundryStudio;
  const [open,setOpen]=useState(false);
  const [videos,setVideos]=useState<StudioYoutubeCatalogVideo[]>([]);
  const [query,setQuery]=useState("");
  const [showOthers,setShowOthers]=useState(false);
  const [videoId,setVideoId]=useState("");
  const [timeText,setTimeText]=useState("00:00");
  const [playerAt,setPlayerAt]=useState<number|null>(null);
  const [preview,setPreview]=useState<StudioVideoFramePreview|null>(null);
  const [crop,setCrop]=useState<Crop>(FULL);
  const [busy,setBusy]=useState<"preview"|"attach"|null>(null);
  const [cueQuery,setCueQuery]=useState("");
  const [cueHits,setCueHits]=useState<StudioVideoCueHit[]>([]);
  const [cueBusy,setCueBusy]=useState(false);
  const [error,setError]=useState("");
  const cropArea=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number}|null>(null);
  const sourceKey=sourceVideoIds.filter(validVideoId).join(",");
  useEffect(()=>{
    if(sourceVideoIds.some(validVideoId))setVideoId(sourceVideoIds.find(validVideoId)||"");
  },[entityKey,sourceKey]);
  useEffect(()=>{
    if(!open||!bridge)return;
    let live=true;
    void bridge.youtubeCatalogVideos({}).then(rows=>{if(live)setVideos(rows);})
      .catch(e=>{if(live)setError("Video arşivi alınamadı: "+errorText(e));});
    return()=>{live=false;};
  },[open,bridge]);
  useEffect(()=>{
    if(!open)return;
    const original=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy&&!cueBusy)setOpen(false);};
    window.addEventListener("keydown",key);
    return()=>{document.body.style.overflow=original;window.removeEventListener("keydown",key);};
  },[open,busy,cueBusy]);
  useEffect(()=>()=>{if(preview?.previewId)void bridge?.visualFrameDiscard({previewId:preview.previewId}).catch(()=>{});},
    [preview?.previewId,bridge]);
  const sources=useMemo(()=>[...new Set(sourceVideoIds.filter(validVideoId))],[sourceKey]);
  const sourceSet=useMemo(()=>new Set(sources),[sourceKey]);
  const choices=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase("tr");
    return videos.filter(v=>(!sources.length||showOthers||sourceSet.has(v.videoId)) &&
        (!needle||v.videoId.includes(needle)||v.title.toLocaleLowerCase("tr").includes(needle)))
      .sort((a,b)=>Number(sourceSet.has(b.videoId))-Number(sourceSet.has(a.videoId)))
      .slice(0,100);
  },[videos,query,showOthers,sourceKey]);
  const selected=videos.find(v=>v.videoId===videoId);
  const seconds=timeFromText(timeText);
  const validTime=Number.isFinite(seconds)&&seconds>=0&&seconds<=21600&&
    (selected?.durationSeconds==null||seconds<selected.durationSeconds);
  const removePreview=()=>{
    if(preview)void bridge?.visualFrameDiscard({previewId:preview.previewId}).catch(()=>{});
    setPreview(null);setCrop(FULL);
  };
  const close=()=>{if(!busy&&!cueBusy){removePreview();setOpen(false);}};
  const chooseVideo=(id:string)=>{removePreview();setVideoId(id);setPlayerAt(null);setCueHits([]);setError("");setTimeText("00:00");};
  const changeTime=(n:number)=>{removePreview();setTimeText(clock(Math.max(0,n)));};
  const searchCues=async()=>{
    if(!bridge||cueBusy||!validVideoId(videoId)||cueQuery.trim().length<2)return;
    setCueBusy(true);setError("");setCueHits([]);
    try {
      const result=await bridge.visualCueSearch({videoId,query:cueQuery});
      setCueHits(result.hits);
      if(!result.hits.length)setError("Eşleşen zaman kodu bulunamadı; videoyu manuel inceleyebilirsin.");
    } catch(e){setError(errorText(e));}
    finally{setCueBusy(false);}
  };
  const capture=async()=>{
    if(!bridge||busy||!validVideoId(videoId)||!validTime)return;
    setBusy("preview");setError("");removePreview();
    try{setPreview(await bridge.visualFramePreview({videoId,seconds}));setCrop(FULL);}
    catch(e){setError(errorText(e));}
    finally{setBusy(null);}
  };
  const attach=async()=>{
    if(!bridge||!preview||busy||disabled)return;
    setBusy("attach");setError("");
    try {
      const {reference}=await bridge.visualFrameAccept({entityKey,previewId:preview.previewId,crop});
      setPreview(null);onAttached(reference);setOpen(false);
    }catch(e){setError(errorText(e));}
    finally{setBusy(null);}
  };
  const point=(event:PointerEvent<HTMLDivElement>)=>{
    const rect=cropArea.current?.getBoundingClientRect();
    if(!rect||!rect.width||!rect.height)return null;
    return {x:clamp((event.clientX-rect.left)/rect.width),y:clamp((event.clientY-rect.top)/rect.height)};
  };
  const pointerDown=(event:PointerEvent<HTMLDivElement>)=>{
    if(!preview||busy)return;
    const p=point(event);if(!p)return;
    drag.current=p;event.currentTarget.setPointerCapture(event.pointerId);
    setCrop({x:p.x,y:p.y,width:.001,height:.001});
  };
  const pointerMove=(event:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    const p=point(event);if(!p)return;
    const s=drag.current;
    setCrop({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),
      width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)});
  };
  const pointerUp=(event:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    const p=point(event);const start=drag.current;drag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(!p||Math.abs(start.x-p.x)<.02||Math.abs(start.y-p.y)<.02)setCrop(FULL);
  };
  const cropStyle={left:String(crop.x*100)+"%",top:String(crop.y*100)+"%",
    width:String(crop.width*100)+"%",height:String(crop.height*100)+"%"};
  const canAttach=crop.width>=.02&&crop.height>=.02;
  return <div className="video-frame-selector">
    <button type="button" className="secondary-button" disabled={disabled} onClick={()=>setOpen(true)}>
      ◫ Video karesi seç ve kırp
    </button>
    {open&&createPortal(<div className="vfm-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
      <section className="vfm-modal" role="dialog" aria-modal="true" aria-label="Kaynak videodan referans kare seçimi">
        <header className="vfm-header">
          <div><small>GÖRSEL REFERANSI · KAYIT ARŞİVİ</small><h2>Videodan kare seç</h2>
            <p>Video → sahneyi bul → kareyi yakala → gerekli alanı kırp → kaydet</p></div>
          <button type="button" aria-label="Kapat" className="vfm-close" disabled={Boolean(busy||cueBusy)} onClick={close}>✕</button>
        </header>
        <div className="vfm-body">
          <aside className="vfm-controls">
            <section className="vfm-step">
              <h3><span>01</span> Kaynak videoyu seç</h3>
              {sources.length>0&&<p>{sources.length} ilişkili kaynak önceliklidir.</p>}
              <input aria-label="Kaynak videolarda ara" type="search" value={query} placeholder="Başlığa göre ara…" onChange={e=>setQuery(e.target.value)}/>
              {sources.length>0&&<label className="vfm-check"><input type="checkbox" checked={showOthers} onChange={e=>setShowOthers(e.target.checked)}/> Diğer arşiv videolarını göster</label>}
              <div className="vfm-video-list" role="listbox" aria-label="Kaynak videolar">
                {choices.map(v=><button type="button" role="option" aria-selected={v.videoId===videoId} key={v.videoId} className={v.videoId===videoId?"selected":""} onClick={()=>chooseVideo(v.videoId)}>
                  <strong>{v.title}</strong><small>{sourceSet.has(v.videoId)?"★ İlişkili kaynak · ":""}{v.videoId}{v.durationSeconds?" · "+clock(v.durationSeconds):""}</small>
                </button>)}
                {!choices.length&&<p>Bu filtreyle video bulunamadı.</p>}
              </div>
            </section>
            <section className="vfm-step">
              <h3><span>02</span> Sahneyi bul</h3>
              <form className="vfm-cue-search" onSubmit={e=>{e.preventDefault();void searchCues();}}>
                <input aria-label="Altyazıda ara" value={cueQuery} placeholder="Altyazıda geçen ifade…" onChange={e=>setCueQuery(e.target.value)}/>
                <button type="submit" disabled={!validVideoId(videoId)||cueBusy||cueQuery.trim().length<2}>{cueBusy?"Aranıyor…":"Bul"}</button>
              </form>
              {cueHits.length>0&&<div className="vfm-cue-hits" aria-label="Altyazı eşleşmeleri">
                {cueHits.map((hit,i)=><button type="button" key={String(i)+"-"+hit.startSeconds} onClick={()=>{changeTime(hit.startSeconds);setPlayerAt(Math.floor(hit.startSeconds));}}>
                  <b>{clock(hit.startSeconds)}</b><span>{hit.text}</span>
                </button>)}
              </div>}
              <div className="vfm-time">
                <label>Zaman kodu (dk:sn)
                  <input value={timeText} aria-invalid={!validTime} onChange={e=>{removePreview();setTimeText(e.target.value);}}/>
                </label>
                <div>
                  <button type="button" onClick={()=>changeTime(seconds-5)} disabled={!validTime}>−5 sn</button>
                  <button type="button" onClick={()=>changeTime(seconds-1)} disabled={!validTime}>−1</button>
                  <button type="button" onClick={()=>changeTime(seconds+1)} disabled={!validTime}>+1</button>
                  <button type="button" onClick={()=>changeTime(seconds+5)} disabled={!validTime}>+5 sn</button>
                </div>
              </div>
              {selected?.durationSeconds!=null&&selected.durationSeconds>1&&
                <input aria-label="Video zaman çizgisi" type="range" min={0} max={Math.floor(selected.durationSeconds-1)}
                  step={1} value={validTime?Math.floor(seconds):0} onChange={e=>changeTime(Number(e.target.value))}/>}
              <button type="button" className="vfm-open-player" disabled={!validVideoId(videoId)||!validTime} onClick={()=>setPlayerAt(Math.floor(seconds))}>▶ Videoyu bu saniyeden oynat</button>
            </section>
          </aside>
          <main className="vfm-stage">
            <section className="vfm-source">
              <div className="vfm-pane-heading"><strong>Kaynak video</strong><small>{selected?.title||"Video seçilmedi"}</small></div>
              {playerAt!=null&&validVideoId(videoId)?
                <iframe title="Kaynak video" key={videoId+"-"+playerAt} allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin"
                  src={"https://www.youtube-nocookie.com/embed/"+videoId+"?start="+playerAt+"&rel=0"}/>
                :<div className="vfm-placeholder"><span>▶</span><p>Videoyu seçip zaman kodundan oynat.</p></div>}
            </section>
            <section className="vfm-capture">
              <div className="vfm-pane-heading"><strong>03 · Kareyi yakala ve kırp</strong>
                <div><button type="button" disabled={!validVideoId(videoId)||!validTime||Boolean(busy)} onClick={()=>void capture()}>
                  {busy==="preview"?"Kare çıkarılıyor…":"◫ Bu saniyeden kare al"}</button>
                  {preview&&<button type="button" onClick={()=>setCrop(FULL)} disabled={Boolean(busy)}>Kırpmayı sıfırla</button>}</div></div>
              {preview?<div className="vfm-image-area">
                <div className="vfm-crop-surface" ref={cropArea} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
                  <img draggable={false} src={preview.imageDataUrl} alt={"Kaynak video karesi "+clock(preview.seconds)}/>
                  <div className="vfm-crop-rect" style={cropStyle}/>
                </div>
                <p>Gerekli alanı seçmek için kare üzerinde fareyle sürükle. Seçimi kaldırmak için “Kırpmayı sıfırla”.</p>
              </div>:<div className="vfm-capture-empty">Bir sahne seçip “Bu saniyeden kare al” düğmesine bas. Görsel burada açılacak; kırpma tamamlanınca referansa kaydedilecek.</div>}
            </section>
          </main>
        </div>
        <footer className="vfm-footer">
          <span role="status">{error?<b className="vfm-error">{error}</b>:preview?
            "Referans: "+preview.videoId+" · "+clock(preview.seconds)+" · "+Math.round(crop.width*100)+"% × "+Math.round(crop.height*100)+"%":
            "Yalnız seçtiğin referans kaydedilir; mevcut kitap görseli korunur."}</span>
          <button type="button" onClick={close} disabled={Boolean(busy||cueBusy)}>Vazgeç</button>
          <button type="button" className="vfm-primary" onClick={()=>void attach()} disabled={!preview||!canAttach||Boolean(busy)||disabled}>
            {busy==="attach"?"Kaydediliyor…":"04 · Kırp ve referansa kaydet"}
          </button>
        </footer>
      </section>
    </div>,document.body)}
  </div>;
}
