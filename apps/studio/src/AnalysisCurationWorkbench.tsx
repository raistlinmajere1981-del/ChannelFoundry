import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAiWorkbenchNotice } from "./AiWorkbenchStatus";
import { formatVideoDate as formatDate } from "./video-analysis-utils";
import "./analysis-curation.css";

type EditorialState = "pending" | "curated" | "excluded";
type UniverseDecision = "include" | "context" | "exclude";
type SupportDecision = "confirm" | "exclude";
type SortMode = "date-desc" | "date-asc" | "title-asc" | "title-desc";
type ReviewVideo = StudioAiAnalysisVideo & { editorialState?: "" | EditorialState; universeLocked?: boolean };
type EntityCandidate = { key:string; kind:string; name:string; aliases:string[]; state:"draft"|"approved" };
type EntityResolution = {
  status:"new"|"existing"|"ambiguous";
  kind:string;
  matchedBy:""|"name"|"alias";
  canonicalName:string;
  candidates:EntityCandidate[];
  recommendedDecision:UniverseDecision;
  needsReview:boolean;
  reason:string;
};
type EditorialItem = {
  key:string;
  category:string;
  label:string;
  detail:string;
  target:"universe"|"support";
  decision:UniverseDecision|SupportDecision;
  nameOverride?:string;
  resolution?:EntityResolution;
};
type EditorialPackage = {
  videoId:string;
  state:EditorialState;
  reviewedAt:string|null;
  manualSponsors:string[];
  manualContributors:string[];
  items:EditorialItem[];
  entityCatalog?:EntityCandidate[];
  universeLocked?:boolean;
};
type EditorialStats = StudioAiAnalysisStats & { editorialPending?:number; curated?:number; excluded?:number };
type EditorialBridge = NonNullable<typeof window.channelFoundryStudio> & {
  aiAnalysisEditorial(videoId:string): Promise<EditorialPackage|null>;
  aiAnalysisEditorialSave(input:{ videoId:string; state:EditorialState; decisions:Record<string,UniverseDecision|SupportDecision>; nameOverrides:Record<string,string>; manualSponsors:string[]; manualContributors:string[] }): Promise<EditorialPackage>;
};

function errorText(error:unknown){ return error instanceof Error ? error.message : String(error); }
function names(value:string){ return [...new Set(value.split(/[\n,;]+/u).map((item)=>item.trim()).filter(Boolean))]; }
function stateText(value?:EditorialState|""){ return value === "curated" ? "Ayıklandı" : value === "excluded" ? "Evren dışı" : "İnceleme bekliyor"; }
function categoryText(value:string){ return ({storyHint:"Hikâye izi",storyBeat:"Anlatı ayrıntısı",character:"Muhatap",scene:"Olay / sahne",location:"Mekân",object:"Nesne",sponsor:"Destekçi Kaydı",contributor:"Katkıda bulunan"} as Record<string,string>)[value] || value; }
function canRename(item:EditorialItem){ return item.category === "character" || item.category === "location" || item.category === "object"; }
function normalized(value:string){ return value.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g," "); }
function kindForCategory(category:string){ return category === "character" ? "character" : category === "location" ? "location" : category === "object" ? "object" : ""; }
function entityListId(category:string){ return `analysis-curation-${category}-entities`; }
function includeLabel(item:EditorialItem){ return item.resolution?.status === "existing" ? "Mevcut kayda katkı" : "Evrene aktar"; }
function sortedDecisions(items:EditorialItem[], decisions:Record<string,UniverseDecision|SupportDecision>){
  const rank=(item:EditorialItem)=>{
    const choice=decisions[item.key] ?? item.decision;
    return choice==="include" || choice==="confirm" ? 0 : choice==="context" ? 1 : 2;
  };
  return items.map((item,index)=>({item,index})).sort((a,b)=>rank(a.item)-rank(b.item)||a.index-b.index).map(({item})=>item);
}
function resolutionLabel(item:EditorialItem, decision:UniverseDecision){
  if(item.resolution?.status === "ambiguous") return "Eşleşme gerekli";
  if(item.resolution?.status === "new") return decision === "include" ? "Yeni kayıt" : decision === "context" ? "Yalnız bağlam" : "Hariç";
  if(item.resolution?.status === "existing") return decision === "include" ? "Mevcut kayda katkı" : decision === "context" ? "Yalnız bağlam" : "Hariç";
  return "";
}

export default function AnalysisCurationWorkbench(){
  const bridge = window.channelFoundryStudio as EditorialBridge | undefined;
  const notify = useAiWorkbenchNotice();
  const [videos,setVideos] = useState<ReviewVideo[]>([]);
  const [stats,setStats] = useState<EditorialStats>({transcripts:0,analyzed:0,waiting:0,running:0,errors:0});
  const [filter,setFilter] = useState<"pending"|"curated"|"excluded"|"all">("pending");
  const [sort,setSort] = useState<SortMode>("date-desc");
  const [query,setQuery] = useState("");
  const [selectedId,setSelectedId] = useState<string|null>(null);
  const [review,setReview] = useState<EditorialPackage|null>(null);
  const [decisions,setDecisions] = useState<Record<string,UniverseDecision|SupportDecision>>({});
  const [nameOverrides,setNameOverrides] = useState<Record<string,string>>({});
  const [manualSponsors,setManualSponsors] = useState("");
  const [manualContributors,setManualContributors] = useState("");
  const scrollRef=useRef<HTMLDivElement>(null);
  const universeListRef=useRef<HTMLDivElement>(null);
  const supportListRef=useRef<HTMLDivElement>(null);
  const moveRef=useRef<{
    targetKey:string;
    choice:UniverseDecision|SupportDecision;
    list:"universe"|"support";
    before:Map<string,number>;
    anchorKey:string|null;
    anchorTop:number|null;
    originalRect:DOMRect;
    restoreFocus:boolean;
  }|null>(null);
  const [busy,setBusy] = useState(false);

  const load = async()=>{
    if(!bridge) return;
    const [list,nextStats] = await Promise.all([bridge.aiAnalysisList(),bridge.aiAnalysisStats()]);
    const analyzed = (list as ReviewVideo[]).filter((video)=>video.hasAnalysis);
    setVideos(analyzed);
    setStats(nextStats as EditorialStats);
    setSelectedId((current)=> current && analyzed.some((video)=>video.videoId===current) ? current : analyzed[0]?.videoId ?? null);
  };

  useEffect(()=>{
    void load().catch((reason)=>notify(errorText(reason),"error"));
    return bridge?.onDataChanged?.(()=>{void load().catch(()=>undefined);});
  },[]);

  useEffect(()=>{
    moveRef.current=null;
    if(!bridge || !selectedId){ setReview(null); return; }
    let canceled=false;
    void bridge.aiAnalysisEditorial(selectedId).then((next)=>{
      if(canceled) return;
      setReview(next);
      setDecisions(Object.fromEntries((next?.items ?? []).map((item)=>[item.key,item.decision])));
      setNameOverrides(Object.fromEntries((next?.items ?? []).filter(canRename).map((item)=>[item.key,item.nameOverride ?? ""])));
      setManualSponsors((next?.manualSponsors ?? []).join("\n"));
      setManualContributors((next?.manualContributors ?? []).join("\n"));
    }).catch((reason)=>{ if(!canceled) notify(errorText(reason),"error"); });
    return()=>{canceled=true;};
  },[bridge,selectedId]);

  const filtered = useMemo(()=>{
    const term=query.trim().toLocaleLowerCase("tr-TR");
    return videos.filter((video)=>{
      const state=video.editorialState || "pending";
      if(filter!=="all" && state!==filter) return false;
      return !term || `${video.title} ${video.videoId}`.toLocaleLowerCase("tr-TR").includes(term);
    }).map((video,index)=>({video,index})).sort((left,right)=>{
      const leftDate=left.video.publishedAt || "";
      const rightDate=right.video.publishedAt || "";
      const dateComparison=leftDate.localeCompare(rightDate);
      const titleComparison=left.video.title.localeCompare(right.video.title,"tr-TR",{sensitivity:"base"});
      let comparison=0;
      if(sort==="date-desc") comparison=-dateComparison || titleComparison;
      else if(sort==="date-asc") comparison=dateComparison || titleComparison;
      else if(sort==="title-desc") comparison=-titleComparison || -dateComparison;
      else comparison=titleComparison || -dateComparison;
      return comparison || left.index-right.index;
    }).map(({video})=>video);
  },[videos,filter,query,sort]);

  useEffect(()=>{
    if(selectedId && filtered.some((video)=>video.videoId===selectedId)) return;
    setSelectedId(filtered[0]?.videoId ?? null);
  },[filter,query,sort,filtered.length]);

  const selected=videos.find((video)=>video.videoId===selectedId) ?? null;
  const universeItems=review?.items.filter((item)=>item.target==="universe") ?? [];
  const supportItems=review?.items.filter((item)=>item.target==="support") ?? [];
  const universeLocked=Boolean(review?.universeLocked);
  const decisionCounts = useMemo(()=>{
    const result = { include:0, context:0, exclude:0 };
    for(const item of universeItems){
      const decision=(decisions[item.key] ?? item.decision) as UniverseDecision;
      result[decision] += 1;
    }
    return result;
  },[universeItems,decisions]);
  const resolutionCounts = useMemo(()=>{
    const result={contribution:0,newRecord:0,contextOnly:0,review:0};
    for(const item of universeItems){
      const resolution=item.resolution;
      if(!resolution) continue;
      const decision=(decisions[item.key] ?? item.decision) as UniverseDecision;
      if(resolution.needsReview) result.review += 1;
      if(resolution.status==="new" && decision==="include") result.newRecord += 1;
      if(resolution.status==="existing" && decision==="include") result.contribution += 1;
      if(resolution.status==="existing" && decision==="context") result.contextOnly += 1;
    }
    return result;
  },[universeItems,decisions]);
  const automaticCount=universeItems.filter((item)=>!item.resolution?.needsReview).length;
  const visibleUniverseItems=sortedDecisions(universeItems,decisions);
  const visibleSupportItems=sortedDecisions(supportItems,decisions);

  const chooseDecision=(item:EditorialItem,choice:UniverseDecision|SupportDecision)=>{
    const current=decisions[item.key] ?? item.decision;
    if(current===choice) return;
    const list=(item.target==="support" ? supportListRef : universeListRef).current;
    const nodes=Array.from(list?.querySelectorAll<HTMLElement>("[data-curation-key]") ?? []);
    const before=new Map(nodes.map((node)=>[node.dataset.curationKey ?? "",node.getBoundingClientRect().top]));
    const index=nodes.findIndex((node)=>node.dataset.curationKey===item.key);
    const source=nodes[index];
    if(source){
      const anchor=nodes[index+1] ?? nodes[index-1];
      moveRef.current={
        targetKey:item.key, choice, list:item.target,
        before, anchorKey:anchor?.dataset.curationKey ?? null,
        anchorTop:anchor ? before.get(anchor.dataset.curationKey ?? "") ?? null : null,
        originalRect:source.getBoundingClientRect(),
        restoreFocus:source.contains(document.activeElement),
      };
    }
    setDecisions((current)=>({...current,[item.key]:choice}));
  };

  useLayoutEffect(()=>{
    const motion=moveRef.current;
    if(!motion) return;
    moveRef.current=null;
    const list=(motion.list==="support" ? supportListRef : universeListRef).current;
    const scroll=scrollRef.current;
    if(!list || !scroll) return;
    const nodes=Array.from(list.querySelectorAll<HTMLElement>("[data-curation-key]"));
    const getNode=(key:string)=>nodes.find((node)=>node.dataset.curationKey===key);
    const anchor=motion.anchorKey ? getNode(motion.anchorKey) : null;
    if(anchor && motion.anchorTop!==null){
      scroll.scrollTop+=anchor.getBoundingClientRect().top-motion.anchorTop;
    }
    const clicked=getNode(motion.targetKey);
    const viewport=scroll.getBoundingClientRect();
    const clickedRect=clicked?.getBoundingClientRect();
    const visible=Boolean(clickedRect && clickedRect.bottom>viewport.top+30 && clickedRect.top<viewport.bottom-30);
    if(motion.restoreFocus){
      const focusTarget=visible ? clicked : anchor ?? clicked;
      const button=focusTarget?.querySelector<HTMLButtonElement>(".analysis-curation-choice.active");
      button?.focus({preventScroll:true});
    }
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.studioMotion==="reduced") return;
    for(const node of nodes){
      const oldTop=motion.before.get(node.dataset.curationKey ?? "");
      if(oldTop===undefined) continue;
      const rect=node.getBoundingClientRect();
      const delta=oldTop-rect.top;
      if(Math.abs(delta)<2 || Math.abs(delta)>420 || rect.bottom<viewport.top-20 || rect.top>viewport.bottom+20) continue;
      node.animate([{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],
        {duration:300,easing:"cubic-bezier(.22,1,.36,1)"});
    }
    // Off-screen destinations should not pull the reader down a long list.
    // A brief departing card echoes the movement at its original location.
    if(clicked && !visible && motion.originalRect.bottom>viewport.top && motion.originalRect.top<viewport.bottom){
      const ghost=clicked.cloneNode(true) as HTMLElement;
      const width=motion.originalRect.width, height=motion.originalRect.height;
      ghost.className=clicked.className+" analysis-curation-moving-ghost";
      ghost.setAttribute("aria-hidden","true");
      ghost.inert=true;
      Object.assign(ghost.style,{position:"fixed",top:`${motion.originalRect.top}px`,left:`${motion.originalRect.left}px`,width:`${width}px`,height:`${height}px`,zIndex:"9999",pointerEvents:"none",overflow:"hidden"});
      document.body.appendChild(ghost);
      const direction=motion.choice==="include" || motion.choice==="confirm" ? -1 : 1;
      const animation=ghost.animate([{opacity:.85,transform:"translateY(0)"},{opacity:0,transform:`translateY(${direction*46}px)`}],
        {duration:320,easing:"ease-out"});
      animation.finished.then(()=>ghost.remove(),()=>ghost.remove());
    }
  },[decisions]);

  const save=async(state:EditorialState)=>{
    if(!bridge || !selectedId || !review || busy) return;
    if(state==="excluded" && !confirm("Bu video evren üretiminden çıkarılsın mı? Ham çözümleme ve destek kayıtları saklanır.")) return;
    setBusy(true);
    try{
      const saved=await bridge.aiAnalysisEditorialSave({videoId:selectedId,state,decisions,nameOverrides,manualSponsors:names(manualSponsors),manualContributors:names(manualContributors)});
      setReview(saved);
      await load();
      notify(
        universeLocked
          ? "Destek kayıtları güncellendi; Evrene işlenmiş malzeme kilitli kaldı."
          : state==="curated"
            ? `${decisionCounts.include} öğe Evrene aktarılacak, ${decisionCounts.context} öğe yalnız bağlam olarak saklanacak.`
            : state==="excluded"
              ? "Video evren üretiminden çıkarıldı; ham kayıt korundu."
              : "Ayıklama kararları kaydedildi.",
        "success",
      );
    }catch(reason){
      notify(errorText(reason),"error");
    }finally{
      setBusy(false);
    }
  };

  if(!bridge) return <div className="panel analysis-curation-empty">Editoryal ayıklama Electron Studio içinde kullanılabilir.</div>;

  return <div className="analysis-curation-workbench">
    <div className="analysis-curation-summary">
      <span><b>{stats.analyzed}</b> çözümleme</span>
      <span><b>{stats.editorialPending ?? 0}</b> inceleme</span>
      <span><b>{stats.curated ?? 0}</b> evrene hazır</span>
      <span><b>{stats.excluded ?? 0}</b> evren dışı</span>
      {review && <div className="analysis-curation-selected-summary" role="status" aria-label="Seçili video kararlarının özeti">
        <span title="Kendiliğinden önerilen kararlar"><b>{automaticCount}</b> otomatik</span>
        <span className={resolutionCounts.review ? "attention" : ""} title="Eşleşmesi kontrol edilecek kayıtlar"><b>{resolutionCounts.review}</b> kontrol</span>
        <span className="include" title="Evrene aktarılacak kayıtlar"><b>{decisionCounts.include}</b> evren</span>
        <span className="context" title="Yalnız bağlam olarak tutulacak kayıtlar"><b>{decisionCounts.context}</b> bağlam</span>
        <span className="exclude" title="Evren dışında tutulacak kayıtlar"><b>{decisionCounts.exclude}</b> hariç</span>
      </div>}
    </div>
    <div className="analysis-curation-layout">
      <section className="panel analysis-curation-list">
        <header>
          <input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Çözümlenmiş videolarda ara…"/>
          <select value={filter} onChange={(event)=>setFilter(event.target.value as typeof filter)}>
            <option value="pending">Bekleyen</option>
            <option value="curated">Ayıklananlar</option>
            <option value="excluded">Evren dışı</option>
            <option value="all">Tümü</option>
          </select>
          <select aria-label="Liste sıralaması" value={sort} onChange={(event)=>setSort(event.target.value as SortMode)}>
            <option value="date-desc">Tarih · Yeni → Eski</option>
            <option value="date-asc">Tarih · Eski → Yeni</option>
            <option value="title-asc">Ad · A → Z</option>
            <option value="title-desc">Ad · Z → A</option>
          </select>
        </header>
        <div>
          {filtered.map((video)=><button key={video.videoId} className={selectedId===video.videoId?"active":""} onClick={()=>setSelectedId(video.videoId)}>
            <span><strong>{video.title}</strong><small>{formatDate(video.publishedAt)}</small></span>
            <em className={video.editorialState || "pending"}>{video.universeLocked ? "Evrene işlendi" : stateText(video.editorialState)}</em>
          </button>)}
          {!filtered.length && <p>Bu filtrede kayıt yok.</p>}
        </div>
      </section>

      <section className="panel analysis-curation-detail">
        {selected && review ? <>
          <div className="analysis-curation-actions" role="group" aria-label="Ayıklama işlemleri">
            {universeLocked ? <>
              <span>Evren malzemesi kilitli · yalnız destek kayıtları düzenlenebilir.</span>
              <button className="primary-button" disabled={busy} onClick={()=>void save("curated")}>Destek kayıtlarını kaydet</button>
            </> : <>
              <button className="text-button" disabled={busy} onClick={()=>void save("pending")}>Kararları kaydet</button>
              <button className="secondary-button" disabled={busy} onClick={()=>void save("excluded")}>Videoyu evren dışı bırak</button>
              <button className="primary-button" disabled={busy} onClick={()=>void save("curated")}>Ayıklamayı tamamla</button>
            </>}
          </div>
          <div className="analysis-curation-scroll" ref={scrollRef}>
          <header>
            <div>
              <small>EDİTORYAL AYIKLAMA</small>
              <h3>{selected.title}</h3>

            </div>
            <span className={`analysis-curation-state ${universeLocked ? "curated" : review.state}`} role="status"><i aria-hidden="true"/>{universeLocked ? "Evrene işlendi" : stateText(review.state)}</span>
          </header>

          <section aria-label="Evren kararları">
            {universeLocked && <p>Bu video Evrene işlendiği için ayıklama kararları kilitlendi. Evren içeriğinde değişiklik gerekiyorsa ilgili kaydı doğrudan düzenle veya tam Evren yeniden oluşturma akışını kullan.</p>}

            {(["character","location","object"] as const).map((category)=>{
              const kind=kindForCategory(category);
              const options=(review.entityCatalog ?? []).filter((entry)=>entry.kind===kind);
              return <datalist id={entityListId(category)} key={category}>{options.map((entry)=><option key={entry.key} value={entry.name}/>)}</datalist>;
            })}

            {visibleUniverseItems.length > 0 && <div className="analysis-curation-items" ref={universeListRef}>
              {visibleUniverseItems.map((item)=>{
                const decision=(decisions[item.key] ?? item.decision) as UniverseDecision;
                const override=nameOverrides[item.key] ?? item.nameOverride ?? "";
                const changed=Boolean(override.trim() && normalized(override)!==normalized(item.label));
                const resolution=item.resolution;
                const candidateNames=resolution?.status==="ambiguous" ? resolution.candidates.map((candidate)=>candidate.name).join(", ") : "";
                const resolutionHint=resolution?.status==="new"
                  ? resolution.needsReview ? "Eşleşme yok · ayrıntı sınırlı" : "Eşleşme yok"
                  : resolution?.status==="ambiguous"
                    ? candidateNames ? `Adaylar: ${candidateNames}` : "Birden fazla eşleşme"
                    : resolution?.canonicalName ? `Eşleşen: ${resolution.canonicalName}` : "";
                return <article key={item.key} data-curation-key={item.key} className={`analysis-curation-reading-entry decision-${decision}${resolution?.needsReview ? " needs-review" : ""}`}>
                  <div className="analysis-curation-entry-main">
                    <div className="analysis-curation-entry-heading">
                      <small>{categoryText(item.category)}</small>
                      <strong>{item.label}</strong>
                    </div>
                    {item.detail && <p className="analysis-curation-entry-reading">{item.detail}</p>}
                    {!universeLocked && canRename(item) && decision!=="exclude" && <label className="analysis-curation-name-edit">
                      <span>Kayıt adı</span>
                      <input
                        disabled={busy}
                        value={override}
                        list={entityListId(item.category)}
                        onChange={(event)=>setNameOverrides((current)=>({...current,[item.key]:event.target.value}))}
                        placeholder={resolution?.canonicalName || item.label}
                      />
                      {changed && <em>Çözümlemedeki ad: {item.label}</em>}
                    </label>}
                  </div>
                  <footer className="analysis-curation-entry-decision">
                    {resolution && <div className={`analysis-curation-resolution${resolution.needsReview ? " needs-review" : ""}`}>
                      <strong>{resolutionLabel(item,decision)}</strong>
                      {resolutionHint && <span>{resolutionHint}</span>}
                    </div>}
                    <div className="analysis-curation-choice-group" role="group" aria-label={`${item.label} için karar`}>
                      {([["include",includeLabel(item)],["context","Yalnız bağlam"],["exclude","Hariç tut"]] as const).map(([value,label])=>
                        <button key={value} type="button" className={`analysis-curation-choice ${value}${decision===value ? " active" : ""}`} aria-pressed={decision===value}
                          disabled={busy || review.state==="excluded" || universeLocked} onClick={()=>chooseDecision(item,value)}>
                          <i aria-hidden="true"/>{label}
                        </button>
                      )}
                    </div>
                  </footer>
                </article>;
              })}
            </div>}
          </section>

          <section className="analysis-curation-support">
            <small>KANAL DESTEK KAYITLARI</small>
            <h4>Evren dışında tutulan isimler</h4>
            <p>Sponsorlar ve katkıda bulunanlar hiçbir zaman Muhatap veya Evren ilişkisi oluşturmaz.</p>
            <div className="analysis-curation-items" ref={supportListRef}>
              {visibleSupportItems.map((item)=>{
                const decision=(decisions[item.key] ?? item.decision) as SupportDecision;
                return <article key={item.key} data-curation-key={item.key} className={`analysis-curation-support-entry decision-${decision}`}>
                  <div><small>{categoryText(item.category)}</small><strong>{item.label}</strong></div>
                  <div className="analysis-curation-choice-group" role="group" aria-label={`${item.label} destek kararı`}>
                    {([["confirm","Onayla"],["exclude","Hariç tut"]] as const).map(([value,label])=>
                      <button key={value} type="button" className={`analysis-curation-choice ${value}${decision===value ? " active" : ""}`}
                        aria-pressed={decision===value} disabled={busy}
                        onClick={()=>chooseDecision(item,value)}><i aria-hidden="true"/>{label}</button>
                    )}
                  </div>
                </article>;
              })}
            </div>
            <div className="analysis-curation-manual">
              <label>Destekçi Kaydı · manuel<textarea value={manualSponsors} onChange={(event)=>setManualSponsors(event.target.value)} placeholder="Her satıra bir sponsor…"/></label>
              <label>Katkıda bulunanlar · manuel<textarea value={manualContributors} onChange={(event)=>setManualContributors(event.target.value)} placeholder="Her satıra bir isim…"/></label>
            </div>
          </section>

          </div>
        </> : <div className="analysis-curation-empty"><h3>İncelemek için çözümlenmiş bir video seç.</h3></div>}
      </section>
    </div>
  </div>;
}
