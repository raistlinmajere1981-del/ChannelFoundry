import { useEffect, useMemo, useState } from "react";
import { useAiWorkbenchNotice } from "./AiWorkbenchStatus";
import "./narrative-workbench.css";
import NarrativeOutlineWorkbench from "./NarrativeOutlineWorkbench";

type NarrativeBridge = NonNullable<typeof window.channelFoundryStudio> & StudioNarrativeBridge;
type BusyAction = "" | "prepare" | "generate" | "apply" | "discard";

const number = (value: number) => new Intl.NumberFormat("tr-TR").format(Math.max(0, value));
const errorText = (value: unknown) => value instanceof Error ? value.message : String(value);
const clean = (value: unknown) => String(value ?? "").trim();

function stateLabel(state: StudioNarrativeRunState | "") {
  if (state === "prepared") return "Editoryal incelemede";
  if (state === "stale") return "Evren değişti · stale";
  return "Anlatı güncel";
}

function sourceLabel(source: StudioNarrativeSourceDescriptor | undefined, fallback: string) {
  return clean(source?.name) || clean(source?.label) || fallback;
}

function EvidenceDetails({ ledger, videos }: { ledger?: StudioNarrativeEvidenceLedger; videos: Map<string, { title: string }> }) {
  const videoList = (ids: string[]) => ids.length ? <ul className="narrative-ledger-videos">{ids.map(id => <li key={id}><span>{videos.get(id)?.title || "Video başlığı yok"}</span> <code>{id}</code></li>)}</ul> : <p>Bu metin için özgül video eşlemesi yok.</p>;
  return <details className="narrative-evidence-ledger">
    <summary>Kaynak ayrıntılarını incele</summary>
    <div className="narrative-ledger-content">
      <p>Frozen kaynak izi · {number(ledger?.recordCount ?? 0)} kayıt · {number(ledger?.videoCount ?? 0)} video. Bu iz, anlatının kesin doğruluk onayı değildir; ayrıntıları kaynakla karşılaştırmak içindir.</p>
      {ledger?.nodes.map(node => <section className="narrative-ledger-node" key={node.sourceKey}>
        <h4>{node.name || node.sourceKey}</h4><p className="narrative-ledger-identity">{node.kind || "Tür belirtilmemiş"} · <code>{node.sourceKey}</code></p>
        <div className="narrative-ledger-context"><strong>Genel bağlam · özgül ayrıntı kanıtı değil</strong>
          <p>{node.summary || "Genel özet bulunmuyor."}</p>
          <p>Düğümün genel video listesi; her ayrıntının bu videoların hepsinde geçtiğini göstermez.</p>
          {node.sourceVideoIds.length ? videoList(node.sourceVideoIds) : <p>Düğümün genel video listesi boş.</p>}
        </div>
        {node.evidence.length ? <ol className="narrative-ledger-entries">{node.evidence.map((entry, index) => <li key={index}>
          <strong>{entry.kind === "sequence" ? "Olay sırası" : "Kaynak ayrıntısı"}</strong><p className="narrative-ledger-text">{entry.text}</p>{videoList(entry.sourceVideoIds)}
        </li>)}</ol> : <p>Özgül details/sequence metni yok; yalnız genel bağlam incelenebilir.</p>}
      </section>)}
      {!ledger?.nodes.length && <p>Bu taslağa ait kullanılabilir frozen düğüm kaydı bulunmuyor.</p>}
      {!!ledger?.missingSourceKeys.length && <p>Frozen düğüm ayrıntısı bulunamayan kaynaklar: {ledger.missingSourceKeys.join(", ")}</p>}
    </div>
  </details>;
}

export default function NarrativeWorkbench() {
  const bridge = window.channelFoundryStudio as NarrativeBridge | undefined;
  const notify = useAiWorkbenchNotice();
  const [status, setStatus] = useState<StudioNarrativeStatus | null>(null);
  const [busy, setBusy] = useState<BusyAction>("");

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
  const pendingChanges = (status?.next.changes ?? 0) + (status?.next.removed ?? 0);
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
      notify(`Hikâyeleştir çalışması #${result.run.id} frozen Evren girdisiyle hazırlandı.`, "success");
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
    <header className="panel narrative-header">
      <div>
        <small>05 · HİKÂYELEŞTİR</small>
        <h2>Onaylı Evreni yaşayan anlatıya dönüştür</h2>
        <p>Bu aşama yalnız onaylı Evren gerçeklerini kronolojik ve okunabilir bir günlük anlatısına çevirir. Görseller ve fiziksel kitap sayfaları burada üretilmez.</p>
      </div>
      <span className={`narrative-state ${runState || "current"}`}>{stateLabel(runState)}</span>
    </header>

    <section className="narrative-metrics">
      <div className="panel"><small>YENİ / DEĞİŞEN</small><strong>{number(status?.next.changes ?? 0)}</strong><span>{number(status?.next.recordChanges ?? 0)} kayıt · {number(status?.next.relationChanges ?? 0)} teknik bağlantı</span></div>
      <div className="panel"><small>KALDIRILAN</small><strong>{number(status?.next.removed ?? 0)}</strong><span>Kaynak</span></div>
      <div className="panel"><small>YAŞAYAN ANLATI</small><strong>{number(status?.counts.activeSections ?? 0)}</strong><span>Aktif bölüm</span></div>
      <div className="panel"><small>ONAYLI TUR</small><strong>{number(status?.counts.applied ?? 0)}</strong><span>Uygulanmış çalışma</span></div>
    </section>

    {runState === "stale" ? <section className="panel narrative-gate stale">
      <div><small>EVREN DEĞİŞTİ</small><strong>Bu taslak artık onaylanamaz.</strong><p>Çalışma hazırlanırken kullanılan frozen Evren ile güncel approved Evren farklı. Eski taslak yalnız inceleme için tutuluyor; kapatıp yeni çalışma hazırlamalısın.</p></div>
      <button className="danger-button" disabled={Boolean(busy)} onClick={() => void discard()}>{busy === "discard" ? "Kapatılıyor…" : "Stale çalışmayı kapat"}</button>
    </section> : working && runState === "prepared" && !drafts.length ? <section className="panel narrative-gate ready">
      <div><small>FROZEN GİRDİ HAZIR · #{working.run.id}</small><strong>AI yalnız bu onaylı Evren anlık görüntüsünü görecek.</strong><p>{number(request?.input.sourceVideos.length ?? 0)} kaynak video · {number(request?.input.allowedSources.length ?? 0)} izinli Evren kaydı. Üretim sonunda hiçbir şey otomatik onaylanmaz.</p></div>
      <button className="primary-button" disabled={Boolean(busy)} onClick={() => void generate()}>{busy === "generate" ? "Hikâyeleştiriliyor…" : "AI taslağını üret"}</button>
    </section> : working && runState === "prepared" && drafts.length ? <section className="panel narrative-gate review">
      <div><small>EDİTORYAL KARAR · #{working.run.id}</small><strong>{number(drafts.length)} bölüm taslağı inceleme bekliyor.</strong><p>{blockingCount ? `${number(blockingCount)} metin içi bağlantı hatası nedeniyle onay kapalı. Eski taslakları inceleyebilir ve Vazgeç ile yeniden üretebilirsin. ` : qualityCount ? `${number(qualityCount)} otomatik editoryal kontrol notu var. ` : ""}Kaynakları ve birinci şahıs anlatımı değerlendir. Onay yaşayan belleği günceller; Vazgeç onaylı içeriği değiştirmez.</p></div>
      <div className="narrative-gate-actions"><button className="secondary-button" disabled={Boolean(busy)} onClick={() => void discard()}>{busy === "discard" ? "Kapatılıyor…" : "Vazgeç"}</button><button className="primary-button" disabled={Boolean(busy || blockingCount)} title={blockingCount ? "Hatalı metin içi bağlantılar giderilmeden onaylanamaz." : undefined} onClick={() => void apply()}>{blockingCount ? `Onay engellendi · ${number(blockingCount)} hata` : busy === "apply" ? "Onaylanıyor…" : `Onayla · ${number(drafts.length)}`}</button></div>
    </section> : status?.next.hasChanges ? <section className="panel narrative-gate ready">
      <div><small>YENİ EVREN DEĞİŞİKLİĞİ</small><strong>{number(pendingChanges)} değişiklik · {number(status?.next.recordChanges ?? 0)} anlatı kaynağı.</strong><p>Hazırlama işlemi approved Evreni frozen bir çalışma girdisine dönüştürür. Sonraki Evren değişikliği bu çalışmayı otomatik stale yapar.</p></div>
      <button className="primary-button" disabled={Boolean(busy)} onClick={() => void prepare()}>{busy === "prepare" ? "Hazırlanıyor…" : "Çalışmayı hazırla"}</button>
    </section> : <section className="panel narrative-gate current">
      <div><small>GÜNCEL</small><strong>Onaylı Evren ile yaşayan anlatı arasında bekleyen değişiklik yok.</strong><p>Yeni bir Evren kaydı veya revizyonu onaylandığında burada yeni Hikâyeleştir turu açılacak.</p></div>
    </section>}

    {working && <section className="panel narrative-run-meta">
      <div><small>ÇALIŞMA</small><strong>#{working.run.id}</strong><span>{working.run.model || "Model henüz çalışmadı"}</span></div>
      <div><small>BASELINE</small><strong>{working.run.baselineRunId ? `#${working.run.baselineRunId}` : "İlk anlatı"}</strong><span>{working.run.createdAt || "—"}</span></div>
      <div><small>GİRDİ PARMAK İZİ</small><code>{working.run.inputFingerprint.slice(0, 16)}</code><span>Frozen input</span></div>
      <div><small>EVREN PARMAK İZİ</small><code>{working.run.universeFingerprint.slice(0, 16)}</code><span>{working.run.state === "stale" ? "Artık güncel değil" : "Hazırlama anı"}</span></div>
    </section>}

    {request && (changes.length > 0 || removed.length > 0 || sourceVideos.length > 0) && <section className="panel narrative-provenance">
      <div className="narrative-section-head"><div><small>GİRDİ VE PROVENANCE</small><h3>Onaylı anlatı kaynakları</h3></div><span>{number(proseChanges.length)} Evren kaydı · {number(technicalGraphCount)} teknik bağlantı · {number(sourceVideos.length)} video</span></div>
      <div className="narrative-provenance-grid">
        <div><h4>Evren değişiklikleri</h4>{technicalGraphCount > 0 && <p className="narrative-graph-note">{number(technicalGraphCount)} teknik ilişki yalnız bağlantı verisi olarak tutuluyor; olay veya anı sayılmıyor.</p>}{proseChanges.length ? <div className="narrative-chip-list">{proseChanges.map((change, index) => { const key = clean(change.sourceKey); const source = sourceMap.get(key); return <span key={`${key}-${index}`}><b>{clean(change.changeKind) || "değişiklik"}</b>{sourceLabel(source, key || `Kaynak ${index + 1}`)}</span>; })}</div> : <p>Yeni/değişen kayıt yok.</p>}{removed.length > 0 && <div className="narrative-chip-list removed">{removed.map((entry) => <span key={`${entry.sourceType}:${entry.sourceKey}`}><b>removed</b>{entry.sourceKey}</span>)}</div>}</div>
        <div><h4>Kaynak videolar</h4>{sourceVideos.length ? <div className="narrative-source-videos">{sourceVideos.map((video) => <div key={video.videoId}><strong>{video.title || video.videoId}</strong><span>{video.publishedAt || "Yayın tarihi yok"}</span><code>{video.videoId}</code></div>)}</div> : <p>Kaynak video metadata kaydı yok.</p>}</div>
      </div>
    </section>}

    {drafts.length > 0 && <section className="narrative-drafts">
      <div className="narrative-section-head"><div><small>AI TASLAĞI</small><h3>Onay öncesi anlatı bölümleri</h3></div><span>Görsel yok · fiziksel sayfa yok</span></div>
      {drafts.map((draft) => <article key={draft.id} className={`panel narrative-draft-card${draft.retire ? " retired" : ""}`}>
        <header><div><small>{baselineIds.has(draft.sectionKey) ? `REVİZYON · v${draft.revisionNo}` : "YENİ BÖLÜM"} · sıra {draft.position}</small><h3>{draft.retire ? `${draft.title || draft.sectionKey} · kaldırılacak` : draft.title}</h3></div><code>{draft.sectionKey}</code></header>
        {draft.retire ? <p className="narrative-retire-copy">Bu bölüm yeni onayla yaşayan anlatıdan emekliye ayrılacak. Önceki yayınlanmış revizyon geçmişten silinmez.</p> : <p className="narrative-body">{draft.body}</p>}
        {(draft.qualityNotes?.length ?? 0) > 0 && <section className="narrative-quality" aria-label={`${draft.title} editoryal kontrol notları`}>
          <strong>Onay öncesi kontrol · {draft.qualityNotes?.length} not</strong>
          <ul>{draft.qualityNotes?.map((note) => <li key={note.code} className={`narrative-quality-${note.severity}`}>{note.message}</li>)}</ul>
        </section>}
        <div className="narrative-draft-evidence">
          <div><small>EVREN REFERANSLARI</small>{draft.entityReferences.length ? <div className="narrative-chip-list refs">{draft.entityReferences.map((reference) => <span key={`${reference.entityId}:${reference.label}`}><b>{reference.kind}</b>{reference.label}<code>{reference.entityId}</code></span>)}</div> : <span className="narrative-none">Bu bölümde inline entity referansı yok.</span>}</div>
          <div><small>KAYNAK VİDEOLAR · GENEL LİSTE</small>{draft.sourceVideoIds.length ? <div className="narrative-chip-list videos">{draft.sourceVideoIds.map((videoId) => <span key={videoId} title={videoId}>{videoMap.get(videoId)?.title || videoId}</span>)}</div> : <span className="narrative-none">Kaynak video yok.</span>}</div>
        </div>
        <EvidenceDetails ledger={draft.evidenceLedger} videos={videoMap} />
        <details><summary>Provenance source key’lerini göster</summary><div className="narrative-chip-list keys">{draft.sourceKeys.map((key) => <span key={key}>{sourceLabel(sourceMap.get(key), key)}<code>{key}</code></span>)}</div></details>
      </article>)}
    </section>}

    {memory.length > 0 && <section className="panel narrative-memory">
      <div className="narrative-section-head"><div><small>YAŞAYAN ANLATI BELLEĞİ</small><h3>Şu anda onaylı olan bölümler</h3></div><span>{number(memory.length)} aktif bölüm</span></div>
      <div className="narrative-memory-list">{memory.map((section) => <div key={section.sectionKey}><span>{String(section.position).padStart(2, "0")}</span><div><strong>{section.title}</strong><p>{section.body}</p></div><small>v{section.revisionNo}</small></div>)}</div>
    </section>}

    <NarrativeOutlineWorkbench memory={memory} />

    <section className="panel narrative-next-stage"><small>SONRAKİ AŞAMA</small><strong>Görsel Tamamlama</strong><p>Onaylanmış anlatı bölümlerinin görsel ihtiyaçları daha sonra ayrı aşamada üretilecek. Tema; sayfa, spread, yerleşim ve kitap animasyonunu kendi rendering katmanında belirleyecek.</p></section>
  </div>;
}
