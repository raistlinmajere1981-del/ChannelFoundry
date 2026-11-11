import { useEffect, useState } from "react";
import PublicationLanguageEditor from "./PublicationLanguageEditor";
import "./publication-translation-center.css";

const kinds: { kind: PublicationLanguageKind | "all"; label: string }[] = [
  { kind: "all", label: "Tümü" },
  { kind: "section", label: "Günlük" },
  { kind: "video", label: "Kamera" },
  { kind: "entity", label: "Evren rehberi" },
  { kind: "outline", label: "İçindekiler" },
  { kind: "vefk", label: "Çizim Atölyesi" },
];

const fmt = (value: number) => new Intl.NumberFormat("tr-TR").format(value);

export default function PublicationTranslationCenter() {
  const bridge = window.channelFoundryStudio;
  const [kind, setKind] = useState<PublicationLanguageKind | "all">("all");
  const [overview, setOverview] = useState<PublicationLanguageOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!bridge?.languagesOverview) return;
    setBusy(true);
    setError("");
    try {
      setOverview(await bridge.languagesOverview());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let live = true;
    if (!bridge?.languagesOverview) return;
    void bridge.languagesOverview().then(value => { if (live) setOverview(value); })
      .catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [bridge]);

  const sources = overview?.rows.filter(row => kind === "all" || row.kind === kind) ?? [];
  const trReady = sources.filter(row => row.variants.tr?.state === "approved" && !row.variants.tr.stale).length;
  const enReady = sources.filter(row => row.variants.en?.state === "approved" && !row.variants.en.stale).length;

  return <section className="panel publication-translation-center">
    <header className="publication-translation-heading">
      <div>
        <small>01 · YAYIN ÖNCESİ HAZIRLIK</small>
        <h2>Türkçe / İngilizce yayın metinleri</h2>
        <p>Çözümleme ve hikâyeleştirmeden bağımsızdır. Yalnızca son onaylı kaynakların yayın metinleri çevrilir ve dil bazında onaylanır.</p>
      </div>
      <button type="button" className="secondary-button" onClick={() => void refresh()} disabled={busy}>
        {busy ? "Denetleniyor…" : "Durumu yenile"}
      </button>
    </header>

    <nav className="publication-translation-kinds" role="tablist" aria-label="Çevrilecek yayın içeriği">
      {kinds.map(item => {
        const count = overview?.rows.filter(row => item.kind === "all" || row.kind === item.kind).length;
        return <button type="button" role="tab" key={item.kind}
          aria-selected={kind === item.kind}
          className={kind === item.kind ? "active" : ""}
          onClick={() => setKind(item.kind)}>
          {item.label}{count !== undefined && <span>{fmt(count)}</span>}
        </button>;
      })}
    </nav>

    <div className="publication-translation-progress" aria-label="Seçilen gruptaki onaylı dil metinleri">
      <div><small>Kaynak kayıt</small><strong>{fmt(sources.length)}</strong></div>
      <div><small>Türkçe onaylı</small><strong>{fmt(trReady)} / {fmt(sources.length)}</strong></div>
      <div><small>İngilizce onaylı</small><strong>{fmt(enReady)} / {fmt(sources.length)}</strong></div>
    </div>

    {error && <p className="publication-translation-error" role="alert">{error}</p>}
    <p className="publication-translation-note">Önce Türkçe kaynak metin onaylanır, ardından İngilizce varyantı hazırlanır. Bu ekran canlıya yayın yapmaz; paket ve canlı yayın işlemleri ayrı sekmededir.</p>
    <PublicationLanguageEditor key={kind} kind={kind === "all" ? undefined : kind} embedded/>
  </section>;
}
