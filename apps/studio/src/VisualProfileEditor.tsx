import { useEffect, useState } from "react";
import VideoFrameSelector from "./VideoFrameSelector";
import VisualBasketHub from "./VisualBasketHub";

type VisualEditorItem = { key: string; kind: string; title: string };
type SeedVisual = Partial<StudioVisualDefinition> | undefined;
type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
type VisualOperation = "save" | "pick" | "generate" | "clear" | "reference-pick" | "reference-clear" | null;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function generationLabel(provider: string, model: string) {
  if (model) return model;
  return provider === "codex-cli" ? "Codex yerleşik görsel aracı" : "model bildirilmedi";
}

function promptFromDescription(item: VisualEditorItem, description: string, attributes: string[], atmosphere: string): string {
  const details = description.trim();
  const traits = attributes.map((value) => value.trim()).filter(Boolean);
  if (!details && !traits.length) return "";
  return [
    `“${item.title}” kaydının görsel temsili.`,
    details && `Görünüm ve sahne tarifi: ${details}`,
    traits.length && `Belirtilen özellikler: ${traits.join("; ")}`,
    atmosphere.trim() && `Atmosfer: ${atmosphere.trim()}`,
    "Kaynakta tanımlanmayan özgül karakteristikler, yeni semboller veya yazılar ekleme.",
  ].filter(Boolean).join("\n");
}

export default function VisualProfileEditor({
  item,
  seedVisual,
  size = "1024x1024",
  onStatus,
  productionActions = false,
  sourceVideoIds = [],
  dock = false,
  onDirtyChange,
  onBusyChange,
}: {
  item: VisualEditorItem;
  seedVisual?: SeedVisual;
  size?: ImageSize;
  onStatus?: (message: string | null, tone?: "success" | "error") => void;
  productionActions?: boolean;
  sourceVideoIds?: string[];
  dock?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const bridge = window.channelFoundryStudio;
  const [profile, setProfile] = useState<StudioVisualProfile | null>(null);
  const [capability, setCapability] = useState<StudioAiImageCapability | null>(null);
  const [presets, setPresets] = useState<StudioVisualPresets | null>(null);
  const [presetId, setPresetId] = useState("");
  const [reference, setReference] = useState<StudioVisualReference | null>(null);
  const [useReference, setUseReference] = useState(true);
  const [description, setDescription] = useState("");
  const [attributesText, setAttributesText] = useState("");
  const [atmosphere, setAtmosphere] = useState("");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [basketBusy, setBasketBusy] = useState(false);
  const [operation, setOperation] = useState<VisualOperation>(null);
  const [savedFields, setSavedFields] = useState<string>("");

  const applyProfile = (value: StudioVisualProfile | null, seed: SeedVisual = undefined) => {
    setProfile(value);
    setDescription(value?.description ?? seed?.description ?? "");
    setAttributesText((value?.attributes ?? seed?.attributes ?? []).join("\n"));
    setAtmosphere(value?.atmosphere ?? seed?.atmosphere ?? "");
    setPrompt(value?.prompt ?? seed?.prompt ?? "");
    setNegativePrompt(value?.negativePrompt ?? seed?.negativePrompt ?? "");
    setSavedFields(JSON.stringify([value?.description ?? seed?.description ?? "", (value?.attributes ?? seed?.attributes ?? []).join("\n"), value?.atmosphere ?? seed?.atmosphere ?? "", value?.prompt ?? seed?.prompt ?? "", value?.negativePrompt ?? seed?.negativePrompt ?? ""]));
  };

  const load = async () => {
    if (!bridge) return;
    const [nextProfile, nextCapability, nextPresets, nextReference] = await Promise.all([
      bridge.visualProfileGet(item.key),
      productionActions ? bridge.aiImageCapability() : Promise.resolve(null),
      productionActions && bridge.visualPresetsGet ? bridge.visualPresetsGet() : Promise.resolve(null),
      productionActions && bridge.visualReferenceGet ? bridge.visualReferenceGet(item.key) : Promise.resolve(null),
    ]);
    applyProfile(nextProfile, seedVisual);
    setCapability(nextCapability);
    setPresets(nextPresets);
    setPresetId(nextPresets?.defaultId ?? "");
    setReference(nextReference);
    setUseReference(Boolean(nextReference));
  };

  useEffect(() => { void load().catch(() => undefined); }, [item.key, productionActions]);
  const changed = savedFields !== "" && savedFields !== JSON.stringify([description, attributesText, atmosphere, prompt, negativePrompt]);
  useEffect(() => { onDirtyChange?.(changed); }, [changed, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy || basketBusy); }, [busy, basketBusy, onBusyChange]);
  useEffect(() => () => { onDirtyChange?.(false); onBusyChange?.(false); }, [item.key]);

  const input = (): StudioVisualProfileInput => ({
    entityKey: item.key,
    entityType: item.kind,
    source: profile?.source || (seedVisual ? "ai" : "manual"),
    description,
    attributes: attributesText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    atmosphere,
    prompt,
    negativePrompt,
  });

  const preparePrompt = () => {
    const proposal = promptFromDescription(item, description, attributesText.split(/\r?\n/), atmosphere);
    if (!proposal || (prompt.trim() && !window.confirm("Mevcut üretim promptu kayıt açıklamasından hazırlanan metinle değiştirilsin mi?"))) return;
    setPrompt(proposal);
    onStatus?.("Görsel tarifi kullanılarak prompt hazırlandı. Üretim henüz başlatılmadı.", "success");
  };

  const begin = (next: Exclude<VisualOperation, null>, message?: string) => {
    setBusy(true);
    setOperation(next);
    onStatus?.(message ?? null);
  };

  const finish = () => {
    setOperation(null);
    setBusy(false);
  };

  const save = async () => {
    if (!bridge) return;
    begin("save");
    try {
      const next = await bridge.visualProfileSave(input());
      applyProfile(next); onStatus?.("Görsel profili kaydedildi.", "success");
    } catch (reason) { onStatus?.(errorText(reason), "error"); }
    finally { finish(); }
  };

  // Adding a basket job already stores a snapshot of its generation prompt.
  // Save any unsaved visual profile fields too, so navigation does not raise
  // a leave-confirmation immediately after a successful basket add.
  const onBasketAdded = async () => {
    if (!bridge) return;
    if (!changed) {onStatus?.("Görsel üretim sepetine eklendi.","success");return;}
    begin("save");
    try {
      const next=await bridge.visualProfileSave(input());
      applyProfile(next);
      onStatus?.("Sepete eklendi; görsel profilindeki değişiklikler de kaydedildi.","success");
    } catch(reason) {
      onStatus?.("Sepete eklendi, fakat görsel profili kaydedilemedi: "+errorText(reason),"error");
    } finally { finish(); }
  };

  useEffect(()=>{
    const changedImage=(event:Event)=>{
      if ((event as CustomEvent<string>).detail !== item.key) return;
      // A basket candidate was accepted in the independent top-bar manager.
      void load().catch(reason=>onStatus?.("Görsel önizlemesi yenilenemedi: "+errorText(reason),"error"));
    };
    window.addEventListener("channel-foundry:visual-basket-accepted",changedImage);
    return()=>window.removeEventListener("channel-foundry:visual-basket-accepted",changedImage);
  },[item.key,productionActions]);

  const pick = async () => {
    if (!bridge || !productionActions) return;
    begin("pick");
    try {
      await bridge.visualProfileSave(input());
      const result = await bridge.visualImagePick({ entityKey: item.key, entityType: item.kind });
      if (!result.canceled && result.profile) {
        applyProfile(result.profile);
        onStatus?.(result.optimization
          ? `Görsel eklendi · WebP ${result.optimization.width}×${result.optimization.height} · ${Math.round(result.optimization.bytes / 1024)} KB`
          : 'Görsel eklendi.', 'success');
      }
    } catch (reason) { onStatus?.(errorText(reason), "error"); }
    finally { finish(); }
  };

  const generate = async () => {
    if (!bridge || !productionActions || !capability?.supported || !prompt.trim()) return;
    if (profile?.imagePath && !window.confirm("Bu kayıt için mevcut görsel var. Yeni görsel üretip bağlı dosyayı değiştirmek istiyor musun?")) return;
    begin("generate", "Görsel hazırlanıyor. Bu işlem birkaç dakika sürebilir.");
    try {
      const generationInput = { ...input(), size, subject: item.title, presetId, useReference };
      const result = await bridge.visualImageGenerate(generationInput);
      const controller = result.generation.controllerModel ? ` · yönetici ${result.generation.controllerModel}` : "";
      applyProfile(result.profile);
      const info = result.generation.optimization;
      onStatus?.(`Görsel üretildi · ${generationLabel(result.generation.provider, result.generation.model)}${controller}${info ? ` · WebP ${info.width}×${info.height} · ${Math.round(info.bytes/1024)} KB` : ''}`, 'success');
    } catch (reason) { onStatus?.(errorText(reason), "error"); }
    finally { finish(); }
  };

  const clear = async () => {
    if (!bridge || !productionActions || !profile?.imagePath) return;
    if (!window.confirm("Bu kaydın görsel dosyası kaldırılsın mı? Görsel tarifi ve prompt korunacak.")) return;
    begin("clear");
    try {
      const result = await bridge.visualImageClear(item.key);
      applyProfile(result.profile ?? null, seedVisual); onStatus?.("Görsel kaldırıldı; metin profili korunuyor.", "success");
    } catch (reason) { onStatus?.(errorText(reason), "error"); }
    finally { finish(); }
  };

  const pickReference = async () => {
    if (!bridge || !productionActions) return;
    begin("reference-pick");
    try {
      const result = await bridge.visualReferencePick({ entityKey: item.key });
      if (!result.canceled && result.reference) {
        setReference(result.reference);
        setUseReference(true);
        onStatus?.("Referans kare kaydedildi. Üretimde seçiliyse Codex CLI görsel girdisi olarak kullanacak.", "success");
      }
    } catch (reason) { onStatus?.(errorText(reason), "error"); }
    finally { finish(); }
  };

  const clearReference = async () => {
    if (!bridge || !reference || !window.confirm("Bu kaydın referans karesi kaldırılsın mı? Üretilmiş görsel korunur.")) return;
    begin("reference-clear");
    try {
      await bridge.visualReferenceClear(item.key);
      setReference(null); setUseReference(false);
      onStatus?.("Referans kare kaldırıldı; üretilen görsel değişmedi.", "success");
    } catch (reason) { onStatus?.(errorText(reason), "error"); }
    finally { finish(); }
  };

  const referenceControls = productionActions && <section className="visual-reference-panel">
    <div className="visual-reference-panel__heading"><strong>Kaynak video karesi</strong><small>Yalnız üretime rehberlik eder; kitap görseli değildir.</small></div>
    {reference && <div className="visual-reference-panel__image">
      <img src={reference.imageDataUrl} alt="Yüklenmiş referans kare"/>
      {reference.sourceVideoId && <small>Kaynak: {reference.sourceVideoId}{reference.sourceSeconds != null ? ` · ${Math.floor(reference.sourceSeconds / 60)}:${String(Math.floor(reference.sourceSeconds % 60)).padStart(2, "0")}` : ""}</small>}
      <label><input type="checkbox" checked={useReference} disabled={busy}
        onChange={event => setUseReference(event.target.checked)}/> Üretimde kullan</label>
    </div>}
    {reference && useReference && capability?.provider !== "codex-cli" &&
      <small className="visual-reference-panel__warning">Referans kareyle üretim için Codex CLI seçilmeli.</small>}
    <div className="visual-reference-panel__actions">
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void pickReference()}>
        {reference ? "Kareyi değiştir" : "Videodan kare ekle"}</button>
      {reference && <button type="button" disabled={busy} onClick={() => void clearReference()}>Kareyi kaldır</button>}
    </div>
    {!dock && <VideoFrameSelector entityKey={item.key} sourceVideoIds={sourceVideoIds} disabled={busy} onAttached={(next) => {
      setReference(next); setUseReference(true);
      onStatus?.("Kaynak videodan kare kaydedildi. Üretilmiş kitap görseli değiştirilmedi.", "success");
    }}/>}
  </section>;

  const presetControls = productionActions && <div className="visual-preset-chooser">
    <label><span>Görsel standardı</span>
      <select value={presetId} disabled={busy || !presets?.presets.length}
        onChange={event => setPresetId(event.target.value)}>
        {(presets?.presets ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <small>Ortak varsayılan, Ayarlar → Görsel standartları bölümünden değiştirilebilir.</small>
  </div>;

  const generating = operation === "generate";

  const basket = productionActions && <VisualBasketHub mode="add" current={{...input(), title:item.title, prompt, size, presetId, useReference}}
    hasImage={Boolean(profile?.imagePath)} disabled={busy} onAdded={onBasketAdded} onBusyChange={setBasketBusy} onStatus={onStatus}/>;

  const actionButtons = <div className="entity-visual-actions">
    {productionActions && <button className="secondary-button" disabled={busy || (!description.trim() && !attributesText.trim())} onClick={preparePrompt}>Tariften prompt hazırla</button>}
    <button className="secondary-button" disabled={busy} onClick={() => void save()}>{operation === "save" ? "Kaydediliyor…" : changed ? "Profili kaydet *" : "Profili kaydet"}</button>
    {productionActions && <button className="secondary-button" disabled={busy} onClick={() => void pick()}>{operation === "pick" ? "Dosya seçiliyor…" : "Görsel ekle"}</button>}
    {productionActions && capability?.supported && <button className="primary-button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>{generating ? "Üretiliyor…" : "Görsel üret"}</button>}
    {!dock && basket}
  </div>;
  // In the compact dock the file actions must live outside the aspect-ratio
  // image viewport; otherwise its overflow clipping hides the lower controls.
  const fileActions = profile?.imagePath && productionActions && !generating ? <>
    <button onClick={() => void bridge?.visualImageShow(item.key)}>Dosyayı göster</button>
    <button className="danger-text" disabled={busy} onClick={() => void clear()}>{operation === "clear" ? "Kaldırılıyor…" : "Görseli kaldır"}</button>
  </> : null;
  const preview = <div className={`entity-visual-preview${generating ? " is-generating" : ""}`}>
    {generating ? <div><span>GÖRSEL ÜRETİLİYOR</span><strong>Görsel hazırlanıyor…</strong><p>Görsel üretimi sürüyor.</p></div>
      : profile?.imageDataUrl ? <img src={profile.imageDataUrl} alt={`${item.title} görseli`}/>
      : <div><span>GÖRSEL DOSYASI</span><strong>Henüz eklenmedi</strong><p>Görsel ekleyebilir veya üretebilirsin.</p></div>}
    {!dock && fileActions && <footer>{fileActions}</footer>}
  </div>;
  if (dock) return <section className="entity-visual-editor record-visual-dock">
    <div className="record-visual-head"><strong>GÖRSEL</strong><span>{generating ? "Üretiliyor" : profile?.imagePath ? "Hazır" : "Eksik"}</span></div>
    {preview}
    {fileActions && <div className="record-visual-file-actions">{fileActions}</div>}
    <div className="record-visual-quick-actions">
      {productionActions && <button type="button" disabled={busy} onClick={() => void pick()}><span>＋</span> Görsel ekle</button>}
      {productionActions && <VideoFrameSelector entityKey={item.key} sourceVideoIds={sourceVideoIds} disabled={busy} onAttached={(next)=>{
        setReference(next);setUseReference(true);onStatus?.("Video referansı kırpılarak kaydedildi.","success");
      }}/>}
      {basket}
    </div>
    <details className="record-visual-config">
      <summary>Görsel tarifi ve üretim ayarları {changed ? "●" : ""}</summary>
      <div className="entity-visual-form">
        <label><span>Görsel açıklaması</span><textarea disabled={busy} value={description} onChange={event => setDescription(event.target.value)}/></label>
        <label><span>Özellikler</span><textarea disabled={busy} value={attributesText} onChange={event => setAttributesText(event.target.value)}/></label>
        <label><span>Atmosfer</span><textarea disabled={busy} value={atmosphere} onChange={event => setAtmosphere(event.target.value)}/></label>
        <label><span>Üretim promptu</span><textarea className="prompt-area" disabled={busy} value={prompt} onChange={event => setPrompt(event.target.value)}/></label>
        <label><span>Kaçınılacak özellikler</span><textarea disabled={busy} value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)}/></label>
        {presetControls}
        {referenceControls}
        {actionButtons}
      </div>
    </details>
  </section>;
  return <section className="entity-visual-editor">
    <div className="relations-head">
      <div><small>GÖRSEL PROFİL</small><h3>{productionActions ? "Görsel üretim ve dosya yönetimi" : "Görsel kimlik ve üretim girdisi"}</h3></div>
      <span className={productionActions && capability?.supported ? "visual-capability ready" : "visual-capability"}>
        {generating
          ? "Görsel üretimi sürüyor…"
          : productionActions
            ? capability?.supported
              ? `Doğrudan üretim · ${generationLabel(capability.provider, capability.model)}${capability.controllerModel ? ` · ${capability.controllerModel} yönetici` : ""}`
              : "Prompt + manuel görsel"
            : "Üretim 06 · Görsel Tamamlama'da"}
      </span>
    </div>
    <div className="entity-visual-layout">
      <div className="entity-visual-form">
        <label><span>Görsel açıklama</span><textarea disabled={busy} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kaynaklarda geçen görünüş, tür, fiziksel ayrıntılar…"/></label>
        <div className="form-two"><label><span>Özellikler · satır satır</span><textarea disabled={busy} value={attributesText} onChange={(event) => setAttributesText(event.target.value)} placeholder={"Varlık türü: …\nBoy: …\nBelirgin özellik: …"}/></label><label><span>Atmosfer</span><textarea disabled={busy} value={atmosphere} onChange={(event) => setAtmosphere(event.target.value)} placeholder="Karanlık, sisli, arşiv hissi…"/></label></div>
        <label><span>Görsel üretim promptu</span><textarea disabled={busy} className="prompt-area" value={prompt} onChange={(event) => setPrompt(event.target.value)}/></label>
        <label><span>Kaçınılacak özellikler · opsiyonel</span><textarea disabled={busy} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)}/></label>
        {presetControls}
        {referenceControls}
        <div className="entity-visual-actions">
          {productionActions && <button className="secondary-button" disabled={busy || (!description.trim() && !attributesText.trim())} onClick={preparePrompt}>Tariften prompt hazırla</button>}
          <button className="secondary-button" disabled={busy} onClick={() => void save()}>{operation === "save" ? "Kaydediliyor…" : "Profili kaydet"}</button>
          {productionActions && <button className="secondary-button" disabled={busy} onClick={() => void pick()}>{operation === "pick" ? "Dosya seçiliyor…" : "Görsel ekle"}</button>}
          {productionActions && capability?.supported && <button className="primary-button" disabled={busy || !prompt.trim()} onClick={() => void generate()}>{generating ? "Üretiliyor…" : "Görsel üret"}</button>}
          {basket}
        </div>
      </div>
      <div className={`entity-visual-preview${generating ? " is-generating" : ""}`}>
        {generating
          ? <div><span>GÖRSEL ÜRETİLİYOR</span><strong>Görsel hazırlanıyor…</strong><p>Codex görsel üretimi birkaç dakika sürebilir. Studio çalışmaya devam ediyor.</p></div>
          : profile?.imageDataUrl
            ? <img src={profile.imageDataUrl} alt={`${item.title} görseli`}/>
            : <div><span>GÖRSEL DOSYASI</span><strong>Henüz eklenmedi</strong><p>{productionActions ? "Bu aşamada görsel üretebilir veya bir dosya ekleyebilirsin." : "Görsel 06 · Görsel Tamamlama aşamasında üretilecek veya eklenecek."}</p></div>}
        {profile?.imagePath && productionActions && !generating && <footer><button onClick={() => void bridge?.visualImageShow(item.key)}>Dosyayı göster</button><button className="danger-text" disabled={busy} onClick={() => void clear()}>{operation === "clear" ? "Kaldırılıyor…" : "Görseli kaldır"}</button></footer>}
      </div>
    </div>
  </section>;
}
