import PublicationLanguageEditor from "./PublicationLanguageEditor";
import { useEffect, useMemo, useState } from "react";
import { useAiWorkbenchNotice } from "./AiWorkbenchStatus";
import "./narrative-workbench.css";
import NarrativeOutlineWorkbench from "./NarrativeOutlineWorkbench";
import "./narrative-stage-layout.css";

type NarrativeBridge = NonNullable<typeof window.channelFoundryStudio> & StudioNarrativeBridge;
type BusyAction = "" | "prepare" | "generate" | "apply" | "discard";

const number = (value: number) => new Intl.NumberFormat("tr-TR").format(Math.max(0, value));
const errorText = (value: unknown) => value instanceof Error ? value.message : String(value);
const clean = (value: unknown) => String(value ?? "").trim();

function stateLabel(state: StudioNarrativeRunState | "") {
  if (state === "prepared") return "Editoryal incelemede";
  if (state === "stale") return "Evren değişti · yeniden hazırlanmalı";
  return "Anlatı güncel";
}

function sourceLabel(source: StudioNarrativeSourceDescriptor | undefined, fallback: string) {
  return clean(source?.name) || clean(source?.label) || fallback;
}

function sourceKindLabel(kind: unknown) {
  const labels: Record<string, string> = { story: "Hikâye", character: "Muhatap", location: "Mekân", object: "Nesne", detail: "Ayrıntı", event: "Olay", sequence: "Olay sırası" };
  return labels[clean(kind).toLowerCase()] ?? "Evren kaydı";
}

function sourceChangeLabel(kind: unknown) {
  const labels: Record<string, string> = { new: "Yeni", changed: "Güncellendi", removed: "Kaldırıldı", unchanged: "Değişmedi" };
  return labels[clean(kind).toLowerCase()] ?? "Değişiklik";
}

function EvidenceDetails({ ledger, videos }: { ledger?: StudioNarrativeEvidenceLedger; videos: Map<string, { title: string }> }) {
  const videoList = (ids: string[]) => ids.length
    ? <ul className="narrative-ledger-videos">{ids.map(id => <li key={id}>{videos.get(id)?.title || "Başlığı bulunamayan video"}</li>)}</ul>
    : <p>Bu ayrıntı için doğrudan eşleşen video belirtilmemiş.</p>;
  return <section className="narrative-evidence-ledger">
    <div className="narrative-ledger-content">
      <p className="narrative-ledger-intro">Çalışma hazırlanırken kaydedilen {number(ledger?.recordCount ?? 0)} Evren kaydı ve {number(ledger?.videoCount ?? 0)} video. Bu bilgiler, anlatıyı asıl kaynaklarla karşılaştırmak içindir; tek başına doğruluk onayı değildir.</p>
      {ledger?.nodes.map(node => <section className="narrative-ledger-node" key={node.sourceKey}>
        <header className="narrative-ledger-node-heading"><h4>{node.name || "Adsız Evren kaydı"}</h4><span>{sourceKindLabel(node.kind)}</span></header>
        <div className="narrative-ledger-context">
          <strong>Genel bağlam</strong>
          <p>{node.summary || "Genel açıklama bulunmuyor."}</p>
          {node.sourceVideoIds.length > 0 && <div className="narrative-ledger-related">
            <strong>Kayıtla ilişkili videolar</strong>
            <p>Bu liste, aşağıdaki her ayrıntının bütün videolarda geçtiği anlamına gelmez.</p>
            {videoList(node.sourceVideoIds)}
          </div>}
        </div>
        {node.evidence.length ? <div className="narrative-ledger-evidence">
          <strong>Kaynakta geçen ayrıntılar</strong>
          <ol className="narrative-ledger-entries">{node.evidence.map((entry, index) => <li key={index}>
            <strong>{entry.kind === "sequence" ? "Olay sırası" : "Kaynak ayrıntısı"}</strong>
            <p className="narrative-ledger-text">{entry.text}</p>
            <div className="narrative-ledger-specific"><span>Bu ayrıntının kaynağı</span>{videoList(entry.sourceVideoIds)}</div>
          </li>)}</ol>
        </div> : <p>Bu kayıtta ayrı bir olay veya ayrıntı eşlemesi yok; yalnız genel bağlam incelenebilir.</p>}
      </section>)}
      {!ledger?.nodes.length && <p>Bu bölüme ait kaynak ayrıntısı bulunmuyor.</p>}
      {!!ledger?.missingSourceKeys.length && <p className="narrative-source-warning">Bazı kaynak kayıtlarının ayrıntıları bu çalışma kopyasında bulunmuyor. Kaynaklarla karşılaştırılması gerekiyor.</p>}
    </div>
  </section>;
}

export default function NarrativeWorkbench() {
  const bridge = window.channelFoundryStudio as NarrativeBridge | undefined;
  const notify = useAiWorkbenchNotice();
  const [status, setStatus] = useState<StudioNarrativeStatus | null>(null);
  const [busy, setBusy] = useState<BusyAction>("");
  const [activeView, setActiveView] = useState<"narrative"|"outline"|"languages"|"sources">("narrative");
  const [languageKind, setLanguageKind] = useState<"section"|"outline">("section");
  const [languagesVisited, setLanguagesVisited] = useState(false);

  const load = async () => {
    if (!bridge) return;
    setStatus(await bridge.narrativeStatus());
  };

  useEffect(() => {
    void load().catch((error) => notify(errorText(error), "error"));
    return bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
  }, []);

  const working = status?.workingRun ?? null;
  const runState = working?.run.state ?? "";
  const drafts = working?.drafts ?? [];
  const request = working?.request ?? null;
  const allowedSources = request?.input.allowedSources ?? [];
  const sourceMap = useMemo(() => new Map(allowedSources.map((source) => [source.sourceKey, source])), [allowedSources]);
  const baselineIds = useMemo(() => new Set((request?.input.baselineNarrative ?? []).map((section) => section.sectionKey)), [request]);
  const sourceVideos = request?.input.sourceVideos ?? [];
  const videoMap = useMemo(() => new Map(sourceVideos.map((video) => [video.videoId, video])), [sourceVideos]);
  const changes = request?.input.changes ?? [];
  // Graph edges are provenance, not prose: don't display them as story facts.
  const proseChanges = changes.filter((change) => change.sourceType !== "relation");
  const technicalGraphCount = changes.length - proseChanges.length + (request?.input.technicalGraphChanges?.length ?? 0);
  const qualityCount = drafts.reduce((total, draft) => total + (draft.qualityNotes?.length ?? 0), 0);
  const blockingCount = drafts.reduce((total, draft) => total + (draft.qualityNotes?.filter((note) => note.severity === "blocker").length ?? 0), 0);
  const removed = request?.input.removed ?? [];
  const memory = status?.memory ?? [];

  if (!bridge) return <div className="panel narrative-empty">Hikâyeleştir Studio içinde kullanılabilir.</div>;

  const prepare = async () => {
    if (busy || working || !status?.next.hasChanges) return;
    setBusy("prepare");
    try {
      const result = await bridge.narrativePrepare();
      await load();
      notify("Hikâyeleştir çalışması, Evren'in hazırlama anındaki sabit kaynaklarıyla oluşturuldu.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(""); }
  };

  const generate = async () => {
    if (busy || !working || working.run.state !== "prepared" || drafts.length) return;
    setBusy("generate");
    try {
      const result = await bridge.narrativeGenerateDraft({ runId: working.run.id });
      await load();
      const model = result.generation.model || result.generation.configuredModel || "AI modeli";
      notify(`${result.drafts.length} anlatı bölümü ${model} ile taslak olarak hazırlandı; henüz onaylanmadı.`, "success");
    } catch (error) { await load().catch(() => undefined); notify(errorText(error), "error"); }
    finally { setBusy(""); }
  };

  const apply = async () => {
    if (busy || !working || working.run.state !== "prepared" || !drafts.length || blockingCount) return;
    if (!confirm(`Çalışma #${working.run.id} içindeki ${drafts.length} anlatı bölümü onaylansın mı?${qualityCount ? `\n\n${qualityCount} editoryal kontrol notu var. Kopuk ifadeler, kaynak ayrımı ve anlatıcı kimliğini gerçekten inceledin mi?` : ""}\n\nOnay yaşayan anlatı belleğini günceller.`)) return;
    setBusy("apply");
    try {
      await bridge.narrativeApply(working.run.id);
      await load();
      notify("Hikâyeleştir taslağı onaylandı ve yaşayan anlatı belleğine uygulandı.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(""); }
  };

  const discard = async () => {
    if (busy || !working || !["prepared", "stale"].includes(working.run.state)) return;
    if (!confirm(`Hikâyeleştir çalışması #${working.run.id} vazgeçilmiş olarak kapatılsın mı? Onaylı anlatı belleği değişmez.`)) return;
    setBusy("discard");
    try {
      await bridge.narrativeDiscard(working.run.id);
      await load();
      notify("Hikâyeleştir çalışması kapatıldı; onaylı anlatı korunuyor.", "success");
    } catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(""); }
  };

  return <div className="narrative-workbench">
    <section className="panel narrative-control-panel">
      <header className="narrative-header">
        <div><small>05 · HİKÂYELEŞTİR</small><h2>Evren anlatısı</h2></div>
        <div className="narrative-header-actions">
          <span className={`narrative-state ${runState || "current"}`} title={runState === "stale" ? "Evren değişti. Önce eski taslağı kapatıp yeni bir çalışma hazırlamak gerekiyor." : undefined}>{stateLabel(runState)}</span>
          {runState === "stale" ? (
            <button type="button" className="danger-button" disabled={Boolean(busy)} onClick={() => void discard()}>{busy === "discard" ? "Kapatılıyor…" : "Eski taslağı kapat"}</button>
          ) : working && runState === "prepared" && !drafts.length ? (
            <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => void generate()}>{busy === "generate" ? "Hikâyeleştiriliyor…" : "Anlatı taslağını üret"}</button>
          ) : working && runState === "prepared" && drafts.length ? (
            <>
              <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => void discard()}>{busy === "discard" ? "Kapatılıyor…" : "Taslağı bırak"}</button>
              <button type="button" className="primary-button" disabled={Boolean(busy || blockingCount)} title={blockingCount ? "Hatalı metin içi bağlantılar giderilmeden onaylanamaz." : qualityCount ? `${number(qualityCount)} editoryal kontrol notunu inceleyerek onayla.` : undefined} onClick={() => void apply()}>{blockingCount ? `Onay engellendi · ${number(blockingCount)} hata` : busy === "apply" ? "Onaylanıyor…" : `Bölümleri onayla · ${number(drafts.length)}`}</button>
            </>
          ) : status?.next.hasChanges ? (
            <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => void prepare()}>{busy === "prepare" ? "Hazırlanıyor…" : "Çalışmayı hazırla"}</button>
          ) : null}
        </div>
      </header>
      <div className="narrative-metrics" aria-label="Hikâyeleştirme sayıları">
        <div><strong>{number(status?.next.changes ?? 0)}</strong><span>Yeni / değişen</span><small>{number(status?.next.recordChanges ?? 0)} kayıt · {number(status?.next.relationChanges ?? 0)} bağlantı</small></div>
        <div><strong>{number(status?.next.removed ?? 0)}</strong><span>Kaldırılan</span><small>kaynak</small></div>
        <div><strong>{number(status?.counts.activeSections ?? 0)}</strong><span>Onaylı anlatı</span><small>aktif bölüm</small></div>
        <div><strong>{number(status?.counts.applied ?? 0)}</strong><span>Tamamlanan</span><small>onaylı çalışma</small></div>
      </div>
    </section>

    <nav className="narrative-view-tabs" role="tablist" aria-label="Hikâyeleştir çalışma alanları">
      {([
        ["narrative","Anlatı",drafts.length?drafts.length:memory.length],
        ["outline","İçindekiler",memory.length],
        ["languages","Çeviriler",null],
        ["sources","Kaynaklar",sourceVideos.length],
      ] as const).map(([view,label,count])=><button type="button" role="tab" key={view}
        aria-selected={activeView===view} className={activeView===view?"active":""}
        onClick={()=>{setActiveView(view);if(view==="languages")setLanguagesVisited(true);}}>{label}{count!==null&&<b>{number(count)}</b>}</button>)}
    </nav>
    <section className="narrative-view-body" role="tabpanel">
      {activeView==="sources" && <div className="narrative-sources-view">
    {request && (changes.length > 0 || removed.length > 0 || sourceVideos.length > 0) && <section className="panel narrative-provenance">
      <div className="narrative-section-head"><div><small>KAYNAK ÖZETİ</small><h3>Onaylı Evren bilgileri ve videolar</h3></div><span>{number(proseChanges.length)} kayıt · {number(sourceVideos.length)} video</span></div>
      <div className="narrative-provenance-grid">
        <div><h4>Evren değişiklikleri</h4>{technicalGraphCount > 0 && <p className="narrative-graph-note">{number(technicalGraphCount)} kayıt ilişkisi anlatının kaynak bağlantısını korur; tek başına olay olarak anlatılmaz.</p>}{proseChanges.length ? <div className="narrative-chip-list">{proseChanges.map((change, index) => { const key = clean(change.sourceKey); const source = sourceMap.get(key); return <span key={`${key}-${index}`}><b>{sourceChangeLabel(change.changeKind)}</b>{sourceLabel(source, `Evren kaydı ${index + 1}`)}</span>; })}</div> : <p>Yeni/değişen kayıt yok.</p>}{removed.length > 0 && <div className="narrative-chip-list removed">{removed.map((entry) => <span key={`${entry.sourceType}:${entry.sourceKey}`}><b>Kaldırıldı</b>{sourceLabel(sourceMap.get(entry.sourceKey), "Önceki Evren kaydı")}</span>)}</div>}</div>
        <div><h4>Kaynak videolar</h4>{sourceVideos.length ? <div className="narrative-source-videos">{sourceVideos.map((video) => <div key={video.videoId}><strong>{video.title || "Başlıksız video"}</strong><span>{video.publishedAt || "Yayın tarihi belirtilmemiş"}</span></div>)}</div> : <p>Henüz kaynak video bilgisi bulunmuyor.</p>}</div>
      </div>
    </section>}

      {drafts.map(draft=><section key={draft.id} className="panel narrative-source-entry">
        <div className="narrative-section-head"><div><small>ANLATI KAYNAKLARI · {number(draft.sourceVideoIds.length)} VİDEO</small><h3>{draft.title || "Başlıksız bölüm"}</h3></div></div>
        <EvidenceDetails ledger={draft.evidenceLedger} videos={videoMap} />
      </section>)}
      {!working && <div className="narrative-reading-empty"><strong>Henüz çalışma kaynağı yok</strong><p>İlk çalışma hazırlandığında kaynak ayrıntıları burada görüntülenir.</p></div>}
    </div>}
    {activeView==="narrative" && <div className="narrative-reading-view">
    {!drafts.length && !memory.length && <div className="narrative-reading-empty"><strong>Henüz anlatı bölümü bulunmuyor</strong><p>Üstteki düğmeyle kaynakları hazırlayıp anlatı taslaklarını üretebilirsin.</p></div>}
    {drafts.length > 0 && <section className="narrative-drafts">
      <div className="narrative-section-head"><div><small>AI TASLAĞI</small><h3>Onay öncesi anlatı bölümleri</h3></div><span>{number(drafts.length)} bölüm</span></div>
      {drafts.map((draft) => <article key={draft.id} className={`panel narrative-draft-card${draft.retire ? " retired" : ""}`}>
        <header><div><small>{baselineIds.has(draft.sectionKey) ? `REVİZYON · ${draft.revisionNo}. sürüm` : "YENİ BÖLÜM"} · {number(draft.position + 1)}. sıra</small><h3>{draft.retire ? `${draft.title || "Başlıksız bölüm"} · kaldırılacak` : draft.title || "Başlıksız bölüm"}</h3></div></header>
        {draft.retire ? <p className="narrative-retire-copy">Bu bölüm yeni onayla yaşayan anlatıdan emekliye ayrılacak. Önceki yayınlanmış revizyon geçmişten silinmez.</p> : <p className="narrative-body">{draft.body}</p>}
        {(draft.qualityNotes?.length ?? 0) > 0 && <section className="narrative-quality" aria-label={`${draft.title} editoryal kontrol notları`}>
          <strong>Onay öncesi kontrol · {draft.qualityNotes?.length} not</strong>
          <ul>{draft.qualityNotes?.map((note) => <li key={note.code} className={`narrative-quality-${note.severity}`}>{note.message}</li>)}</ul>
        </section>}
        <div className="narrative-draft-evidence">
          <div><small>EVREN REFERANSLARI</small>{draft.entityReferences.length ? <div className="narrative-chip-list refs">{draft.entityReferences.map((reference) => <span key={`${reference.entityId}:${reference.label}`}><b>{sourceKindLabel(reference.kind)}</b>{reference.label}</span>)}</div> : <span className="narrative-none">Bu bölümde metin içi Evren bağlantısı bulunmuyor.</span>}</div>
          <div><small>KAYNAK VİDEOLAR · GENEL LİSTE</small>{draft.sourceVideoIds.length ? <div className="narrative-chip-list videos">{draft.sourceVideoIds.map((videoId) => <span key={videoId}>{videoMap.get(videoId)?.title || "Başlıksız video"}</span>)}</div> : <span className="narrative-none">Kaynak video yok.</span>}</div>
        </div>
      </article>)}
    </section>}

    {memory.length > 0 && <section className="panel narrative-memory">
      <div className="narrative-section-head"><div><small>YAŞAYAN ANLATI BELLEĞİ</small><h3>Şu anda onaylı olan bölümler</h3></div><span>{number(memory.length)} aktif bölüm</span></div>
      <div className="narrative-memory-list">{memory.map((section) => <div key={section.sectionKey}><span>{String(section.position).padStart(2, "0")}</span><div><strong>{section.title}</strong><p>{section.body}</p></div><small>v{section.revisionNo}</small></div>)}</div>
    </section>}

    </div>}
    <div className="narrative-outline-view" hidden={activeView!=="outline"}><NarrativeOutlineWorkbench memory={memory}/></div>
    {languagesVisited && <div className="narrative-languages-view" hidden={activeView!=="languages"}>
      <div className="narrative-language-kind" role="tablist" aria-label="Yayın metni türü">
        <button type="button" role="tab" aria-selected={languageKind==="section"} className={languageKind==="section"?"active":""} onClick={()=>setLanguageKind("section")}>Anlatı bölümleri</button>
        <button type="button" role="tab" aria-selected={languageKind==="outline"} className={languageKind==="outline"?"active":""} onClick={()=>setLanguageKind("outline")}>İçindekiler</button>
      </div>
      <div hidden={languageKind!=="section"}><PublicationLanguageEditor embedded kind="section"/></div>
      <div hidden={languageKind!=="outline"}><PublicationLanguageEditor embedded kind="outline"/></div>
    </div>}
    </section>
  </div>;
}
