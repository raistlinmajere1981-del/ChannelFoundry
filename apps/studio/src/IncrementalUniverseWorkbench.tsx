import { useEffect, useState } from "react";
import { useAiWorkbenchNotice } from "./AiWorkbenchStatus";
import "./universe-batch-selection.css";

type PendingSource = { videoId:string; title:string; publishedAt:string };
type MergeResult = StudioUniverseMergeResult & { sources?:PendingSource[] };
type MergeStatus = StudioUniverseMergeStatus & { ingest?: { pending?:number; processed?:number; newSources?:number; changedSources?:number; awaitingApplyRunId?:number|null; batchLimit?:number; nextSources?:PendingSource[]; backlog?:{ drafts?:number; revisions?:number; total?:number; blocking?:number } } };
type WorkspaceStatus = StudioUniverseWorkspaceStatus & { counts: StudioUniverseWorkspaceStatus["counts"] & { pendingRevisions?:number } };
type ApplyResult = WorkspaceStatus & { created?:number; updated?:number; revisionProposed?:number; ingestProcessed?:number };
type ResultCategory = "stories"|"characters"|"events"|"locations"|"objects"|"relations";
type ResultEntry = { key:string; title:string; label:string; summary:string; sourceVideoIds:string[]; details:string[] };

const n=(value:number)=>new Intl.NumberFormat("tr-TR").format(Math.max(0,value));
const err=(value:unknown)=>value instanceof Error?value.message:String(value);
const resultCategories:Array<{key:ResultCategory;label:string}>=[
  {key:"stories",label:"Hikâyeler"},{key:"characters",label:"Muhataplar"},{key:"events",label:"Olaylar"},{key:"locations",label:"Mekânlar"},{key:"objects",label:"Nesneler"},{key:"relations",label:"Bağlantılar"},
];
const relationKind=(value:StudioUniverseRelation["fromType"])=>({story:"Hikâye",character:"Muhatap",event:"Olay",location:"Mekân",object:"Nesne"})[value];

function resultEntries(universe:StudioUniverse,category:ResultCategory):ResultEntry[]{
  if(category==="stories")return universe.stories.map((entry,index)=>({key:`story:${entry.name}:${index}`,title:entry.name,label:"Hikâye",summary:entry.summary,sourceVideoIds:entry.sourceVideoIds,details:entry.sequence.map((detail)=>detail.text)}));
  if(category==="characters")return universe.characters.map((entry,index)=>({key:`character:${entry.name}:${index}`,title:entry.name,label:entry.roles?.join(" · ")||"Muhatap",summary:entry.summary,sourceVideoIds:entry.sourceVideoIds,details:entry.details.map((detail)=>detail.text)}));
  if(category==="events")return universe.events.map((entry,index)=>({key:`event:${entry.name}:${index}`,title:entry.name,label:"Olay",summary:entry.summary,sourceVideoIds:entry.sourceVideoIds,details:[]}));
  if(category==="locations")return universe.locations.map((entry,index)=>({key:`location:${entry.name}:${index}`,title:entry.name,label:"Mekân",summary:entry.summary,sourceVideoIds:entry.sourceVideoIds,details:entry.details.map((detail)=>detail.text)}));
  if(category==="objects")return universe.objects.map((entry,index)=>({key:`object:${entry.name}:${index}`,title:entry.name,label:"Nesne",summary:entry.summary,sourceVideoIds:entry.sourceVideoIds,details:entry.details.map((detail)=>detail.text)}));
  return universe.relations.map((entry,index)=>({key:`relation:${entry.fromName}:${entry.toName}:${index}`,title:`${entry.fromName} → ${entry.toName}`,label:entry.label||"Bağlantı",summary:`${relationKind(entry.fromType)} → ${relationKind(entry.toType)}`,sourceVideoIds:entry.sourceVideoIds,details:[]}));
}

export default function IncrementalUniverseWorkbench({onOpenReview}:{onOpenReview?:(mode:"records"|"revisions")=>void}={}){
  const bridge=window.channelFoundryStudio;
  const notify=useAiWorkbenchNotice();
  const [status,setStatus]=useState<MergeStatus>({availableAnalyses:0,run:null});
  const [workspace,setWorkspace]=useState<WorkspaceStatus|null>(null);
  const [result,setResult]=useState<MergeResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [selectedVideoIds,setSelectedVideoIds]=useState<string[]>([]);
  const [selectionSignature,setSelectionSignature]=useState("");
  const [resultCategory,setResultCategory]=useState<ResultCategory>("stories");
  const [selectedResultKey,setSelectedResultKey]=useState<string|null>(null);

  const load=async()=>{
    if(!bridge)return;
    const [merge,editorial]=await Promise.all([bridge.universeMergeStatus(),bridge.universeWorkspaceStatus()]);
    const next=merge as MergeStatus;
    const nextWorkspace=editorial as WorkspaceStatus;
    setStatus(next);setWorkspace(nextWorkspace);
    const latestApplied=nextWorkspace.latestImport?.runId??null;
    const currentReviewable=next.run&&["done","error"].includes(next.run.state)&&next.run.id!==latestApplied?next.run.id:null;
    const runId=next.ingest?.awaitingApplyRunId??currentReviewable;
    setResult(runId?(await bridge.universeMergeResult(runId) as MergeResult|null):null);
  };
  useEffect(()=>{void load().catch((e)=>notify(err(e),"error"));return bridge?.onDataChanged?.(()=>{void load().catch(()=>undefined);});},[]);
  useEffect(()=>{if(!status.run||!["waiting","running"].includes(status.run.state))return;const timer=window.setInterval(()=>void load(),1800);return()=>window.clearInterval(timer);},[status.run?.id,status.run?.state]);

  const nextSources=status.ingest?.nextSources??[];
  const nextSignature=nextSources.map((source)=>source.videoId).join("|");
  useEffect(()=>{
    if(nextSignature===selectionSignature)return;
    setSelectionSignature(nextSignature);
    setSelectedVideoIds(nextSources.map((source)=>source.videoId));
  },[nextSignature,selectionSignature]);

  if(!bridge)return <div className="panel universe-empty">Evrene İşleme Studio içinde kullanılabilir.</div>;

  const pending=status.ingest?.pending??status.availableAnalyses;
  const processed=status.ingest?.processed??0;
  const batchLimit=status.ingest?.batchLimit??10;
  const drafts=status.ingest?.backlog?.drafts??workspace?.counts.draft??0;
  const revisions=status.ingest?.backlog?.revisions??workspace?.counts.pendingRevisions??0;
  const awaiting=status.ingest?.awaitingApplyRunId??null;
  const active=Boolean(status.run&&["waiting","running"].includes(status.run.state));
  const failed=status.run?.state==="error";
  const currentRunApplied=Boolean(status.run&&workspace?.latestImport?.runId===status.run.id);
  const complete=Boolean(result?.state==="done"&&(result.complete??result.sourceCoverage?.actual===result.sourceCoverage?.expected));
  const applied=Boolean(result&&workspace?.latestImport?.runId===result.id);
  const canCancel=Boolean(status.run&&!active&&!currentRunApplied&&["done","error"].includes(status.run.state));
  const canStart=selectedVideoIds.length>0&&!active&&!awaiting&&!failed&&!revisions&&!busy;

  const start=async()=>{
    if(!canStart||!confirm(`${selectedVideoIds.length} videodan ortak Evren taslağı üretilecek. Sonucu kontrol ettikten sonra 04 · İnceleme aşamasına aktarmayı ayrıca onaylayacaksın. Başlayalım mı?`))return;
    setBusy(true);try{await bridge.universeMergeStart({videoIds:selectedVideoIds});await load();notify(`Birleştirme başladı · ${selectedVideoIds.length} video. Sonuç tamamlanınca taslağı kontrol edebileceksin.`,"success");}catch(e){notify(err(e),"error");}finally{setBusy(false);}
  };
  const stop=async()=>{
    if(!active)return;setBusy(true);try{await bridge.universeMergeCancel();await load();notify("Evrene İşleme durduruldu; seçilen kaynaklar sırada kaldı ve mevcut Evren korunuyor.","success");}catch(e){notify(err(e),"error");}finally{setBusy(false);}
  };
  const cancelPrepared=async()=>{
    if(!canCancel||!status.run)return;
    const sourceCount=result?.sources?.length??status.run.analysisCount;
    if(!confirm(`Çalışma #${status.run.id} iptal edilsin mi? ${sourceCount} kaynak Evrene işlenmiş sayılmayacak ve yeniden sırada kalacak. Mevcut 04 · İnceleme kayıtları değişmeyecek.`))return;
    setBusy(true);try{const canceled=await bridge.universeMergeCancel();await load();setSelectedResultKey(null);notify(canceled.canceled?`Çalışma #${canceled.runId} iptal edildi; ${sourceCount} kaynak yeniden Evrene İşleme sırasına bırakıldı.`:"İptal edilecek çalışma bulunamadı.",canceled.canceled?"success":"error");}catch(e){notify(err(e),"error");}finally{setBusy(false);}
  };
  const apply=async()=>{
    if(!result||result.state!=="done"||applied||!complete||busy||!confirm(`Çalışma #${result.id} İnceleme aşamasına aktarılsın mı? ${result.analysisCount} kaynak işlenmiş olarak kilitlenir; yeni kayıtlar ve revizyonlar henüz onaylanmaz veya siteye yayınlanmaz.`))return;
    setBusy(true);try{const next=await bridge.universeWorkspaceApply(result.id) as ApplyResult;await load();notify(`${next.created??0} yeni kayıt · ${next.updated??0} taslak güncellemesi · ${next.revisionProposed??0} revizyon. ${next.ingestProcessed??result.analysisCount} kaynak işlendi ve kilitlendi.`,"success");onOpenReview?.("records");}catch(e){notify(err(e),"error");}finally{setBusy(false);}
  };
  const toggle=(videoId:string)=>setSelectedVideoIds((current)=>current.includes(videoId)?current.filter((id)=>id!==videoId):[...current,videoId]);
  const selectAll=()=>setSelectedVideoIds(nextSources.map((source)=>source.videoId));

  const counts=result?[
    ["Hikâye",result.universe.stories.length],["Muhatap",result.universe.characters.length],["Olay",result.universe.events.length],["Mekân",result.universe.locations.length],["Nesne",result.universe.objects.length],["Bağlantı",result.universe.relations.length],
  ]:[];
  const inspected=result?resultEntries(result.universe,resultCategory):[];
  const sourcesById=new Map((result?.sources??[]).map((source)=>[source.videoId,source.title]));
  const runProgress=status.run?.totalChunks
    ? Math.round(100*(status.run.doneChunks??0)/status.run.totalChunks)
    : 0;
  const selectedResult=inspected.find((entry)=>entry.key===selectedResultKey)??inspected[0]??null;
  const categoryCount=(category:ResultCategory)=>result?resultEntries(result.universe,category).length:0;

  const phase=active?"processing":failed?"failed":(awaiting||(result?.state==="done"&&!applied))?"ready":revisions?"blocked":nextSources.length?"selection":"waiting";
  const phaseText={
    selection:"Kaynakları seç ve birleştirmeyi başlat",
    processing:"Videolar ortak Evren taslağına dönüştürülüyor",
    ready:"Evren taslağı hazır — incelemeye aktarılmadı",
    blocked:"Yeni tur için revizyon kararları gerekiyor",
    failed:"Evren taslağı oluşturulamadı",
    waiting:"Yeni ayıklanmış video bekleniyor",
  }[phase];
  const phaseDetail={
    selection:`Seçtiğin ${n(selectedVideoIds.length)} videodaki kişiler, mekânlar, olaylar ve bağlantılar birbiriyle eşleştirilecek. Henüz Evren kaydı değişmez.`,
    processing:`AI, ${n(status.run?.analysisCount??0)} videodaki ortak kayıtları birleştiriyor. Tamamlandığında taslağı görüp devam edip etmeyeceğine karar vereceksin.`,
    ready:"Modelin oluşturduğu kayıtları aşağıda kontrol et. İncelemeye aktar dediğinde henüz onaylanmamış kayıtlar hazırlanır; siteye yayınlanmaz.",
    blocked:`${n(revisions)} revizyon kararı bekliyor. Yeni video turundan önce bunları 04 · İnceleme bölümünde tamamla.`,
    failed:"Bu turdaki videolar Evrene aktarılmadı. Hata ayrıntısını inceleyip çalışmayı iptal ederek aynı kaynakları yeniden deneyebilirsin.",
    waiting: drafts
      ? `${n(drafts)} taslak İnceleme bölümünde bekliyor. Yeni bir tur için önce Ayıklama'dan video hazırlanmalı.`
      : "02 · Ayıklama'da videoları tamamladığında burada tarih sırasıyla birleştirilmeye hazır hale gelirler.",
  }[phase];

  return <div className="universe-workbench">
    <section className={`panel universe-workspace-status phase-${phase}`} aria-label="Evrene İşleme durumu">
      <div className="universe-workspace-copy">
        <div className="universe-workspace-kicker">
          <span className="universe-phase-dot" aria-hidden="true"/>
          <span>{phase==="processing"?"İşlem sürüyor":phase==="ready"?"Onay bekliyor":phase==="selection"?"Başlamaya hazır":phase==="failed"?"Hata":phase==="blocked"?"Karar gerekiyor":"Hazır"}</span>
          <small>{n(pending)} bekleyen video · {n(processed)} daha önce işlendi</small>
        </div>
        <strong>{phaseText}</strong>
        <p>{phaseDetail}</p>
      </div>
      <div className="universe-workspace-buttons">
        {result?.state==="done"&&!applied&&<button className="universe-apply-button" disabled={busy||!complete} onClick={()=>void apply()}>{complete?"Taslağı İncelemeye aktar":"Eksik sonuç — aktarılamaz"}</button>}
        {canCancel&&<button className="universe-cancel-button" disabled={busy} onClick={()=>void cancelPrepared()}>Bu turu iptal et</button>}
        {active
          ? <button className="universe-update-button stop" disabled={busy} onClick={()=>void stop()}>İşlemi durdur</button>
          : phase==="selection"
            ? <button className="universe-update-button" disabled={!canStart} onClick={()=>void start()}>Evren taslağı oluştur · {n(selectedVideoIds.length)} video</button>
            : phase==="blocked"&&onOpenReview
              ? <button className="universe-update-button" onClick={()=>onOpenReview("revisions")}>Revizyonlara geç</button>
              : phase==="waiting"&&onOpenReview&&drafts>0
                ? <button className="universe-update-button" onClick={()=>onOpenReview("records")}>Taslakları incele</button>
                : null}
      </div>
    </section>
    <div className="universe-steps" aria-label="Evrene İşleme adımları">
      <span className={phase==="selection"?"current":phase==="waiting"?"idle":"done"}><b>1</b> Kaynak seç</span>
      <span className={phase==="processing"?"current":phase==="selection"||phase==="waiting"?"idle":phase==="failed"?"problem":"done"}><b>2</b> Kayıtları birleştir</span>
      <span className={phase==="ready"?"current":phase==="failed"?"problem":"idle"}><b>3</b> Taslağı kontrol et</span>
    </div>

    {phase==="selection"&&<section className="panel universe-batch-selection">
      <div className="universe-batch-head">
        <div>
          <small>BU TURUN VİDEOLARI</small>
          <h3>Birleştirilecek kaynakları seç</h3>
          <p>Videolar en eskiden yeniye sıralandı. Bir turda en fazla {n(batchLimit)} video kullanılabilir; aynı kişi, olay veya mekânın farklı videolardaki anlatımları tek Evren kaydında buluşturulur.</p>
        </div>
        <div className="universe-batch-actions">
          <button type="button" onClick={selectAll} disabled={selectedVideoIds.length===nextSources.length}>Tümünü seç</button>
          <button type="button" onClick={()=>setSelectedVideoIds([])} disabled={!selectedVideoIds.length}>Seçimi temizle</button>
        </div>
      </div>
      <div className="universe-batch-list" aria-label="Bu tur için seçilebilen videolar">
        {nextSources.map((source,index)=><label key={source.videoId} className={selectedVideoIds.includes(source.videoId)?"selected":""}>
          <input type="checkbox" checked={selectedVideoIds.includes(source.videoId)} onChange={()=>toggle(source.videoId)}/>
          <span className="universe-batch-index">{String(index+1).padStart(2,"0")}</span>
          <span className="universe-batch-copy"><strong>{source.title||"Başlıksız video"}</strong><small>{source.publishedAt||"Yayın tarihi yok"}</small></span>
          <span className="universe-batch-choice">{selectedVideoIds.includes(source.videoId)?"Bu turda":"Sırada kalsın"}</span>
        </label>)}
      </div>
      <div className="universe-batch-foot">
        <strong>{n(selectedVideoIds.length)} / {n(nextSources.length)} video seçildi</strong>
        <span>{pending>nextSources.length?`${n(pending-nextSources.length)} video sonraki turlarda bekliyor.`:"Bütün bekleyen videolar bu listede."} İşaretini kaldırdığın video silinmez, sırada kalır.</span>
      </div>
    </section>}

    {active&&<section className="panel universe-run-progress" aria-label="Evren taslağı üretimi">
      <div className="universe-run-progress-head">
        <div><small>AI BİRLEŞTİRME İŞLEMİ · #{status.run?.id}</small><h3>{n(status.run?.doneChunks??0)} / {n(status.run?.totalChunks??0)} parça tamamlandı</h3></div>
        <span className="universe-progress-percent">{status.run?.totalChunks?`${runProgress}%`:"Hazırlanıyor"}</span>
      </div>
      <div className="universe-run-progress-track" role="progressbar" aria-label="Birleştirme parçası ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.run?.totalChunks?runProgress:undefined}><i style={{width:`${runProgress}%`}}/></div>
      <p>Seçilen {n(status.run?.analysisCount??selectedVideoIds.length)} video ortak kayıtlara dönüştürülüyor. Bu sayı işlenen AI parçalarını gösterir; henüz bir kayıt onaylanmadı.</p>
      <small>İşlemi durdurursan bu turun geçici sonuçları atılır, kaynakların ve önceki Evren kayıtların korunur.</small>
    </section>}
    {failed&&<section className="panel universe-run-error"><div><small>TAMAMLANAMAYAN BİRLEŞTİRME · #{status.run?.id}</small><strong>Hiçbir kayıt aktarılmadı</strong><span>{n(status.run?.doneChunks??0)} / {n(status.run?.totalChunks??0)} parça oluşturulmuştu. "Bu turu iptal et" seçeneğiyle kaynakları yeniden sıraya alabilirsin.</span></div><details><summary>Teknik hata ayrıntısı</summary><pre>{status.run?.error||"Hata ayrıntısı yok."}</pre></details></section>}
    {!active&&!result&&!failed&&(nextSources.length===0||revisions>0)&&<section className="panel universe-empty">
      <span>{revisions?"ÖNCE TAMAMLANMASI GEREKEN KARARLAR":"SIRADAKİ TUR"}</span>
      <h3>{revisions?"Revizyonlar bekliyor":"Yeni kaynak bekleniyor"}</h3>
      <p>{revisions?`${n(revisions)} revizyon kararını 04 · İnceleme bölümünde tamamladıktan sonra yeni videoları işleyebilirsin.`:"02 · Ayıklama'da tamamlanan videolar burada en eskiden başlayarak seçilebilir. Var olan Evren kayıtların etkilenmez."}</p>
    </section>}

    {result&&<section className={`panel universe-result-panel${result.state==="error"?" error":""}`}>
      <div className="universe-result-head"><div><small>{result.state==="error"?"KISMİ / BAŞARISIZ SONUÇ":"BİRLEŞTİRME SONUCU"} · #{result.id}</small><strong>{n(result.analysisCount)} videodan oluşan Evren taslağı</strong><span>{result.state==="done"?"Aşağıdaki kayıtlar henüz onaylanmadı. İsimleri, özetleri ve kaynak bağlantılarını kontrol edip üstteki düğmeyle 04 · İnceleme aşamasına aktarabilirsin.":"Bu çalışma İncelemeye aktarılmadı; iptal edersen kaynaklar korunarak sıraya döner."}</span><small className="universe-result-model">Kullanılan model: {result.model}</small></div><div className={`universe-result-state ${result.state}`}>{result.state==="done"&&complete?"Hazır":result.state==="error"?"Başarısız":"Eksik"}</div></div>
      <div className="universe-result-metrics">{counts.map(([label,value])=><div key={String(label)}><small>{label}</small><strong>{n(Number(value))}</strong></div>)}</div>
      <div className="universe-result-context"><div><strong>Kaynak kontrolü: {n(result.sourceCoverage?.actual??0)} / {n(result.sourceCoverage?.expected??result.analysisCount)} video</strong><span>{complete?"Seçtiğin bütün videolar sonuç içinde yer alıyor.":`${n(result.sourceCoverage?.missing?.length??0)} video sonuçta eksik; bu taslak aktarılamaz.`}</span></div><details><summary>Kaynak videolar · {result.sources?.length??result.analysisCount}</summary><div className="universe-result-sources">{(result.sources??[]).map((source)=><span key={source.videoId}><b>{source.title||source.videoId}</b><small>{source.publishedAt||source.videoId}</small></span>)}{!result.sources?.length&&<span><b>Kaynak listesi eski çalışma formatında.</b><small>{result.analysisCount} video kullanıldı.</small></span>}</div></details></div>
      <nav className="universe-result-tabs" aria-label="Evrene İşleme sonuç türü">{resultCategories.map((category)=><button key={category.key} className={resultCategory===category.key?"active":""} onClick={()=>{setResultCategory(category.key);setSelectedResultKey(null);}}><span>{category.label}</span><b>{n(categoryCount(category.key))}</b></button>)}</nav>
      <div className="universe-result-layout">
        <div className="universe-result-list">{inspected.map((entry)=><button key={entry.key} className={selectedResult?.key===entry.key?"active":""} onClick={()=>setSelectedResultKey(entry.key)}><small>{entry.label}</small><strong>{entry.title}</strong><span>{entry.sourceVideoIds.length} kaynak</span></button>)}{!inspected.length&&<p>Bu türde sonuç üretilmedi.</p>}</div>
        <article className="universe-result-detail">{selectedResult?<><small>{selectedResult.label.toUpperCase()}</small><h3>{selectedResult.title}</h3><p>{selectedResult.summary||"Bu kayıt için özet üretilmedi."}</p>{selectedResult.details.length>0&&<section><strong>AYRINTILAR</strong><ol>{selectedResult.details.map((detail,index)=><li key={`${detail}:${index}`}>{detail}</li>)}</ol></section>}<section><strong>BU KAYDIN DAYANDIĞI VİDEOLAR</strong><div className="universe-result-source-ids">{selectedResult.sourceVideoIds.length?selectedResult.sourceVideoIds.map((id)=><span key={id} title={id}>{sourcesById.get(id)||id}</span>):<span>Bu kayıtla ilişkilendirilmiş kaynak yok.</span>}</div></section></>:<div className="universe-result-detail-empty">Bu türde kayıt üretilmedi. Diğer türleri yukarıdan inceleyebilirsin.</div>}</article>
      </div>
    </section>}
  </div>;
}
