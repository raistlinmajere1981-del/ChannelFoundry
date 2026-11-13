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
  const [resetPrompt,setResetPrompt] = useState(false);
  const [resetBusy,setResetBusy] = useState(false);
  const [success,setSuccess] = useState("");
  const [names,setNames]=useState<Record<string,string>>({});
  const reset = async () => {
    if (!window.channelFoundryStudio || resetBusy) return;
    setResetBusy(true);setError("");setSuccess("");
    try {
      await window.channelFoundryStudio.analyticsReset();
      setResetPrompt(false);
      setSuccess("Bütün ziyaret ve etkinlik istatistikleri sıfırlandı.");
      setData(null);
      try { setData(await window.channelFoundryStudio.analyticsSummary(days)); }
      catch (e) { setError("Sıfırlama başarılı, ancak yeni özet alınamadı: " + (e instanceof Error ? e.message : String(e))); }
    } catch (e) {
      setError("Sıfırlama tamamlanamadı: " + (e instanceof Error ? e.message : String(e)));
    } finally { setResetBusy(false); }
  };
  const refresh = async () => {
    if (!window.channelFoundryStudio) return;
    setBusy(true);setError("");
    try { setData(await window.channelFoundryStudio.analyticsSummary(days)); }
    catch (e) { setData(null);setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, [days]);
  useEffect(()=>{
    let live=true;
    void window.channelFoundryStudio?.universeWorkspaceList().then(nodes=>{
      if(live)setNames(Object.fromEntries(nodes.flatMap(node=>[
        [node.key,node.name],
        ...(node.key.startsWith('universe-')?[[node.key.replace(/^universe-/,''),node.name]]:[]),
      ])));
    }).catch(()=>undefined);
    return()=>{live=false;};
  },[]);
  const contentName=(key:string)=>names[key]??Object.entries(names).find(([id])=>id===key||id.endsWith(key))?.[1]
    ??(key.startsWith('universe-character-')?'Muhatap kaydı':key.startsWith('narrative-section-')?'Anlatı bölümü':key.startsWith('universe-')?'Evren kaydı':key.length===11?'Kamera videosu':'İçerik kaydı');
  const rows = data?.areas ?? [];
  const max = Math.max(1,...rows.map(row => row.seconds));
  return <section className="insight-settings analytics-settings">
    <header className="insight-header"><div><h2>Site analitiği</h2><p>Ziyaret oturumları ve aktif geçirilen süre. Kimlik takibi yapılmaz.</p></div>
      <div className="insight-actions">
        {[7,30,90].map(value=><button key={value} type="button" className={days===value?"selected":""} onClick={()=>setDays(value)}>{value} gün</button>)}
        <button type="button" disabled={busy} onClick={()=>void refresh()}>Yenile</button>
      </div>
    </header>
    {error && <p className="insight-warning" role="alert">{error}</p>}
    {success && <p className="insight-success" role="status">{success}</p>}
    <div className="insight-metrics">
      <div><small>Ziyaret oturumları</small><strong>{data ? format(data.visits) : "—"}</strong><span>Aynı sekmede yenileme yeni oturum sayılmaz</span></div>
      <div><small>Toplam aktif süre</small><strong>{data ? duration(data.activeSeconds) : "—"}</strong><span>Ana oda ve içerik alanlarında etkileşimli süre</span></div>
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
          <div key={row.area+":"+row.contentKey}><span>{labels[row.area]??row.area}<small>{contentName(row.contentKey)}</small></span><strong>{format(row.views)}</strong></div>
        )}</div> : <p className="insight-empty">Henüz içerik etkileşimi yok.</p>}
      </section>
    </div>
    <p className="insight-footnote">Ziyaret oturumu aynı sekmedeki yenilemeleri tek sayar; sekme veya tarayıcı yeniden açıldığında yeni oturum başlayabilir. Bu bir tekil insan sayısı değildir. Aktif süre yaklaşık ölçümdür. Sunucuda yalnızca anonim günlük toplamlar saklanır.</p>
    <section className="insight-reset" aria-label="İstatistik yönetimi">
      <div><strong>İstatistik yönetimi</strong><p>Testlerin ardından yayına temiz sayaçlarla başlamak için kullanılır. Yalnız analitik kayıtlarını siler; topluluk, yayın ve SEO verileri etkilenmez.</p></div>
      {!resetPrompt ? <button type="button" className="insight-reset-open" disabled={busy || resetBusy} onClick={() => {setError("");setSuccess("");setResetPrompt(true);}}>İstatistikleri sıfırla</button> :
        <div className="insight-reset-confirm">
          <p>7, 30 ve 90 günlük ziyaret ve süre kayıtlarının tamamı kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
          <div>
            <button type="button" disabled={resetBusy} onClick={() => setResetPrompt(false)}>Vazgeç</button>
            <button type="button" className="insight-reset-danger" disabled={resetBusy} onClick={() => void reset()}>{resetBusy ? "Sıfırlanıyor…" : "Evet, tümünü sıfırla"}</button>
          </div>
        </div>}
    </section>
  </section>;
}
