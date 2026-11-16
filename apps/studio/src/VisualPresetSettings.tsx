import { useEffect, useState } from "react";
import "./visual-presets.css";

const empty = (): StudioVisualPresets => ({ version: 1, defaultId: "", presets: [] });

export default function VisualPresetSettings() {
  const bridge = window.channelFoundryStudio;
  const [config, setConfig] = useState<StudioVisualPresets>(empty);
  const [saved, setSaved] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [imagesPerRequest, setImagesPerRequest] = useState<1|2|4>(1);
  const [batchSaving, setBatchSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void bridge?.visualBasketStatus().then(next => {if(alive) setImagesPerRequest(next.settings.imagesPerRequest);})
      .catch(reason => {if(alive) setError(String(reason));});
    bridge?.visualPresetsGet().then(next => {
      if (!alive) return;
      setConfig(next);
      setSaved(JSON.stringify(next));
      setSelected(next.defaultId);
    }).catch(reason => { if (alive) setError(String(reason)); });
    return () => { alive = false; };
  }, [bridge]);

  const saveBatchCount = async (count: 1|2|4) => {
    if (!bridge || batchSaving) return;
    setBatchSaving(true);setError("");
    try {const next=await bridge.visualBasketSettings({imagesPerRequest:count});
      setImagesPerRequest(next.imagesPerRequest);setNotice("Toplu üretim adedi kaydedildi.");}
    catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally {setBatchSaving(false);}
  };

  const active = config.presets.find(entry => entry.id === selected);
  const dirty = Boolean(saved) && JSON.stringify(config) !== saved;
  const replace = (change: Partial<StudioVisualPreset>) => setConfig(previous => ({
    ...previous, presets: previous.presets.map(preset =>
      preset.id === selected ? { ...preset, ...change } : preset),
  }));
  const add = () => {
    if (config.presets.length >= 16) return;
    const id = "custom-" + Date.now().toString(36);
    setConfig(previous => ({
      ...previous,
      presets: [...previous.presets, {
        id, name: "Yeni Karakalem Standardı",
        instruction: "Kaynak kaydına sadık, gerçekçi grafit karakalem çizim.",
        negative: "kaynak dışı öğeler, renk, sinematik afiş, uydurma yazılar",
      }],
    }));
    setSelected(id);
  };
  const remove = () => {
    if (!active || config.presets.length <= 1 || !window.confirm("Bu görsel standardı kaldırılsın mı? Mevcut görseller değişmez.")) return;
    const remaining = config.presets.filter(preset => preset.id !== selected);
    setConfig(previous => ({
      ...previous, defaultId: previous.defaultId === selected ? remaining[0].id : previous.defaultId,
      presets: remaining,
    }));
    setSelected(remaining[0].id);
  };
  const save = async () => {
    if (!bridge || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await bridge.visualPresetsSave(config);
      setConfig(next); setSaved(JSON.stringify(next)); setNotice("Görsel standartları kaydedildi.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <section className="visual-presets-settings panel settings-card">
    <header className="visual-presets-head">
      <div><h2>Görsel standartları</h2><p>Kayıt Dosyaları ve Görsel Tamamlama aynı standartları kullanır. Üretim sırasında farklı bir standart seçilebilir.</p></div>
      <span>{config.presets.length} standart</span>
    </header>
    <div className="visual-presets-columns">
      <nav className="visual-presets-list" aria-label="Görsel standartları">
        {config.presets.map(item => <button key={item.id} type="button"
          className={item.id === selected ? "selected" : ""}
          onClick={() => { setSelected(item.id); setError(""); }}>
          <strong>{item.name}</strong>
          {item.id === config.defaultId && <small>Varsayılan</small>}
        </button>)}
        <button type="button" className="visual-presets-new" disabled={busy || config.presets.length >= 16} onClick={add}>＋ Yeni standart</button>
      </nav>
      {active ? <div className="visual-presets-editor">
        <label>Ad
          <input value={active.name} onChange={event => replace({ name: event.target.value })} disabled={busy} maxLength={90}/>
        </label>
        <label>Stil ve kaynak sadakati
          <textarea rows={7} value={active.instruction} onChange={event => replace({ instruction: event.target.value })} disabled={busy}/>
        </label>
        <label>Kaçınılacak özellikler
          <textarea rows={3} value={active.negative} onChange={event => replace({ negative: event.target.value })} disabled={busy}/>
        </label>
        <div className="visual-presets-actions">
          <button type="button" disabled={busy || config.defaultId === active.id}
            onClick={() => setConfig(previous => ({ ...previous, defaultId: active.id }))}>Varsayılan yap</button>
          <button type="button" disabled={busy || config.presets.length <= 1} onClick={remove}>Standardı kaldır</button>
          <button type="button" className="primary-button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Kaydediliyor…" : "Standartları kaydet"}</button>
        </div>
      </div> : <p>Görsel standartları yükleniyor…</p>}
    </div>
    <section className="visual-basket-settings">
      <div><h3>Sepet ile toplu görsel üretimi</h3>
        <p>Kayıt Dosyaları ve Görsel Tamamlama ekranlarından kayıtları sepete ekleyebilirsin. Kaç bağımsız görselin tek yaprakta üretileceğini buradan seç. Üretim onayla başlar; adaylar kontrol edilmeden kitaba işlenmez.</p>
      </div>
      <label>Tek üretim isteğinde
        <select aria-label="Bir üretimde görsel sayısı" disabled={batchSaving} value={imagesPerRequest} onChange={e=>void saveBatchCount(Number(e.target.value) as 1|2|4)}>
          <option value={1}>1 görsel · tekil (en tutarlı)</option>
          <option value={2}>2 görsel · yan yana</option>
          <option value={4}>4 görsel · 2×2 levha</option>
        </select>
      </label>
      <small>Çoklu levhalar otomatik bölünür ve her kayıt için ayrı aday kaydedilir. Dört parçalı üretimde görsel başına çözünürlük düşebilir. Aynı standart ve oran kullanan kayıtlar gruplanır; kalanlar tekil üretilebilir.</small>
    </section>
    <p className="visual-presets-note">Bu alan yalnız görünüm tarifini etkiler; varlıkların kaynak metinleri, anlatı içerikleri ve daha önce üretilmiş görseller değiştirilmez.</p>
    <span className={error ? "visual-presets-error" : "visual-presets-notice"} role="status">{error || notice || (dirty ? "Kaydedilmemiş görsel standardı değişikliği var." : "")}</span>
  </section>;
}
