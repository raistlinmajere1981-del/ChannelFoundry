import { useEffect, useState } from "react";

const labels: Record<string,string> = { evren: "Evren Kitabı", topluluk: "Topluluk", kamera: "Kamera", vefk: "Vefk Atölyesi" };
const format = (value: number) => new Intl.NumberFormat("tr-TR").format(value);
const duration = (seconds: number) => seconds >= 3600
  ? `${Math.floor(seconds/3600)} sa ${Math.round(seconds%3600/60)} dk`
  : `${Math.round(seconds/60)} dk`;

export default function WebsiteAnalytics() {
  const [days,setDays] = useState(30);
  const [data,setData] = useState<StudioWebsiteInsights|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const refresh = async () => {
    if (!window.channelFoundryStudio) return;
    setBusy(true);setError("");
    try { setData(await window.channelFoundryStudio.analyticsSummary(days)); }
    catch (e) { setData(null);setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [days]);
  const rows = data?.areas ?? [];
  const max = Math.max(1,...rows.map(row => row.seconds));
  return <section className="insight-settings analytics-settings">
    <header className="insight-header"><div><h2>Ziyaretçi analitiği</h2><p>Kimlik izlemeden, içerik ve aktif okuma süreleri.</p></div>
      <div className="insight-actions">
        {[7,30,90].map(value=><button key={value} type="button" className={days===value?"selected":""} onClick={()=>setDays(value)}>{value} gün</button>)}
        <button type="button" disabled={busy} onClick={()=>void refresh()}>Yenile</button>
      </div>
    </header>
    {error && <p className="insight-warning" role="status">Canlı istatistik alınamadı: {error}</p>}
    <div className="insight-metrics">
      <div><small>Sayfa açılışları</small><strong>{data ? format(data.visits) : "—"}</strong><span>Tekil kişi sayısı değildir</span></div>
      <div><small>Ölçülen aktif süre</small><strong>{data ? duration(data.activeSeconds) : "—"}</strong><span>Görünür / etkileşimli sekme</span></div>
      <div><small>İçerik açılışları</small><strong>{data ? format(rows.reduce((n,r)=>n+r.opens,0)) : "—"}</strong><span>Kitap, kamera, topluluk, vefk</span></div>
    </div>
    <div className="insight-split">
      <section className="panel insight-card">
        <h3>Alanlara göre ilgi</h3>
        {rows.length ? rows.sort((a,b)=>b.seconds-a.seconds).map(row=><div className="insight-area" key={row.area}>
          <div><strong>{labels[row.area]??row.area}</strong><span>{duration(row.seconds)} · {format(row.opens)} açılış</span></div>
          <div className="insight-track"><i style={{width:`${100*row.seconds/max}%`}}/></div>
        </div>) : <p className="insight-empty">{busy?"Veriler alınıyor…":"Bu dönemde ölçüm bulunmuyor."}</p>}
      </section>
      <section className="panel insight-card">
        <h3>En çok incelenen içerikler</h3>
        {data?.contents?.length ? <div className="insight-contents">{data.contents.map(row=>
          <div key={row.area+":"+row.contentKey}><span>{labels[row.area]??row.area}<small>{row.contentKey}</small></span><strong>{format(row.views)}</strong></div>
        )}</div> : <p className="insight-empty">Henüz içerik etkileşimi yok.</p>}
      </section>
    </div>
    <p className="insight-footnote">Ölçümler toplulaştırılmıştır: IP, çerez, ziyaretçi ID’si ve bireysel gezinme geçmişi kaydedilmez. Ziyaret sayısı sayfa açılışlarını ifade eder; aktif süre tahminidir.</p>
  </section>;
}
