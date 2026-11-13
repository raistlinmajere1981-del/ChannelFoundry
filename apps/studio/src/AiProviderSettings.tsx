import { useEffect, useState } from "react";
import "./ai-minimal.css";
import {useSettingsSection} from "./SettingsController";

type Provider = { id: string; label: string; role: "text" | "image" | "both"; transport: "cli" | "api" | "local" | "none"; endpoint: string; secret: boolean };
type Role = "text" | "image";
type ReasoningChoice = { reasoningEffort: string; mode?: "effort"|"variant"|"thinkingLevel"; description?: string };
type CatalogEntry = { id: string; label?: string; supportedReasoningEfforts?: ReasoningChoice[]; defaultReasoningEffort?: string };
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method [\x27\x22][^\x27\x22]+[\x27\x22]: (?:Error: )?/, "").replace(/^Error: /, "");
const isCompatible = (id: string) => id === "google-ai-studio" || id === "openai-compatible" || id === "ollama";
const backendId = (id: string): StudioAiProvider => id === "google-ai-studio" ? "openai-compatible" : id as StudioAiProvider;
function inferText(config: StudioAiConfig) {
  return config.provider === "openai-compatible" && config.endpoint.includes("generativelanguage.googleapis.com")
    ? "google-ai-studio" : config.provider;
}
function inferImage(config: StudioAiConfig) {
  return config.image.mode === "disabled" ? "disabled" : config.image.provider;
}

export default function AiProviderSettings() {
  const bridge = window.channelFoundryStudio;
  const [providers, setProviders] = useState<Provider[]>([]);
  const [stored, setStored] = useState<StudioAiConfig | null>(null);
  const [role, setRole] = useState<Role>("text");
  const [textProvider, setTextProvider] = useState("ollama");
  const [imageProvider, setImageProvider] = useState("codex-cli");
  const [textEndpoint, setTextEndpoint] = useState("");
  const [imageEndpoint, setImageEndpoint] = useState("");
  const [textKey, setTextKey] = useState("");
  const [imageKey, setImageKey] = useState("");
  const [textModel, setTextModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [imageReasoning, setImageReasoning] = useState("");
  const [textModels, setTextModels] = useState<CatalogEntry[]>([]);
  const [imageModels, setImageModels] = useState<CatalogEntry[]>([]);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [textVerified, setTextVerified] = useState(false);
  const [imageVerified, setImageVerified] = useState(false);
  const [initializing,setInitializing]=useState(true);

  useEffect(() => {
    if (!bridge) return;
    void Promise.all([bridge.aiConfig(), bridge.aiProviders()]).then(([config, entries]) => {
      setStored(config); setProviders(entries);
      setTextProvider(inferText(config));
      setImageProvider(inferImage(config));
      setTextEndpoint(config.endpoint);
      setImageEndpoint(config.image.endpoint);
      setTextModel(config.model); setImageModel(config.image.model);
      setFallbackModel(config.fallbackModel);
      setReasoning(config.reasoningEffort);
      setImageReasoning(config.image.reasoningEffort ?? "");
    }).catch((reason) => setError(errorText(reason))).finally(()=>setInitializing(false));
  }, []);

  const provider = (id: string) => providers.find((entry) => entry.id === id);
  const currentProvider = role === "text" ? textProvider : imageProvider;
  const current = provider(currentProvider);
  const sameTextConnection = Boolean(stored && inferText(stored) === textProvider && stored.endpoint === (current?.transport === "cli" ? "" : textEndpoint));
  const sameImageConnection = Boolean(stored && inferImage(stored) === imageProvider && stored.image.endpoint === (current?.transport === "cli" || imageProvider === "disabled" ? "" : imageEndpoint));
  const savedKey = role === "text" ? sameTextConnection && stored?.apiKeyConfigured : sameImageConnection && stored?.image.apiKeyConfigured;
  const key = role === "text" ? textKey : imageKey;
  const endpoint = role === "text" ? textEndpoint : imageEndpoint;
  const model = role === "text" ? textModel : imageModel;
  const models = role === "text" ? textModels : imageModels;
  const displayModels= model && !models.some(entry=>entry.id===model) ? [{id:model,label:model+" · Kayıtlı model"},...models] : models;
  const canDiscover = Boolean(current && (current.transport === "cli" || endpoint.trim()) && (!current.secret || key.trim() || savedKey));
  const setFeedback = () => { setResult(""); setError(""); };
  const chooseProvider = (id: string) => {
    const definition = provider(id);
    if (!definition) return;
    setFeedback();
    if (role === "text") {
      setTextProvider(id); setTextEndpoint(definition.endpoint);
      setTextModel(""); setFallbackModel(""); setReasoning(""); setTextModels([]); setTextKey(""); setTextVerified(false);
    } else {
      setImageProvider(id); setImageEndpoint(definition.endpoint);
      setImageModel(""); setImageReasoning(""); setImageModels([]); setImageKey(""); setImageVerified(false);
    }
  };
  const useSharedService = async () => {
    if (!bridge || busy) return;
    setBusy("service"); setFeedback();
    try {
      const detected = await bridge.aiOpenCodeService();
      if (detected !== textEndpoint) {
        setTextEndpoint(detected); setTextKey(""); setTextModels([]);
        setTextModel(""); setFallbackModel(""); setReasoning(""); setTextVerified(false);
      }
      setResult("Ortak servis · " + detected);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(""); }
  };
  const chooseModel = (id: string) => {
    setFeedback();
    if (role === "text") { setTextModel(id); setTextVerified(false); setReasoning(""); }
    else { setImageModel(id); setImageReasoning(""); setImageVerified(false); }
  };
  const selectedText = textModels.find((entry) => entry.id === textModel);
  const textReasoningOptions = selectedText?.supportedReasoningEfforts ?? [];
  const selectedImage = imageModels.find((entry) => entry.id === imageModel);
  const imageReasoningOptions = selectedImage?.supportedReasoningEfforts ?? [];
  const activeTextReasoning = textReasoningOptions.find((option)=>option.reasoningEffort === reasoning);
  const activeImageReasoning = imageReasoningOptions.find((option)=>option.reasoningEffort === imageReasoning);
  // Avoid wiping saved choices just because the user edited the other tab without fetching a new catalog.
  const savedTextReasoning = !textModels.length && stored?.model === textModel &&
    inferText(stored) === textProvider && stored.reasoningEffort === reasoning;
  const savedImageReasoning = !imageModels.length && stored?.image.model === imageModel &&
    inferImage(stored) === imageProvider && stored.image.reasoningEffort === imageReasoning;
  const textCandidate = () => ({
    provider: backendId(textProvider),
    endpoint: provider(textProvider)?.transport === "cli" ? "" : textEndpoint.trim(),
    apiKey: textKey.trim() || (sameTextConnection ? undefined : ""),
    model: textModel, fallbackModel,
    reasoningEffort: activeTextReasoning?.reasoningEffort ?? (savedTextReasoning ? reasoning : ""),
    reasoningMode: activeTextReasoning?.mode ?? (savedTextReasoning ? stored?.reasoningMode ?? "" : ""),
    timeoutSeconds: 420,
  });
  const imageFields = () => ({
    imageMode: (imageProvider === "disabled" ? "disabled" : "enabled") as StudioAiImageMode,
    imageProvider: (imageProvider === "disabled" ? "openai-compatible" : imageProvider) as StudioAiImageProvider,
    imageEndpoint: imageProvider === "codex-cli" || imageProvider === "disabled" ? "" : imageEndpoint.trim(),
    imageModel: imageProvider === "disabled" ? "" : imageModel,
    imageReasoningEffort: activeImageReasoning?.reasoningEffort ?? (savedImageReasoning ? imageReasoning : ""),
    imageReasoningMode: activeImageReasoning?.mode ?? (savedImageReasoning ? stored?.image.reasoningMode ?? "" : ""),
    imageApiKey: imageKey.trim() || (sameImageConnection ? undefined : ""),
  });
  const discover = async (loadModels = true) => {
    if (!bridge || !canDiscover || busy) return;
    setBusy(loadModels ? "models" : "check"); setFeedback();
    try {
      if (role === "text") {
        const response = await bridge.aiModels({
          provider: backendId(textProvider), endpoint: textCandidate().endpoint,
          ...(textKey ? { apiKey: textKey } : {}), timeoutSeconds: 420,
        });
        const entries = response.models.filter((entry) => entry.text).map((entry) => ({
          id: entry.id, label: entry.label, supportedReasoningEfforts: entry.supportedReasoningEfforts,
          defaultReasoningEffort: entry.defaultReasoningEffort,
        }));
        if (loadModels) {
          setTextModels(entries);
          const chosen = entries.find((entry) => entry.id === textModel);
          if (!chosen && !stored?.model) { setTextModel(""); setTextVerified(false); }
          if (!chosen?.supportedReasoningEfforts?.some((option)=>option.reasoningEffort === reasoning)) setReasoning("");
        }
        setResult(loadModels ? entries.length + " metin modeli" : "Bağlantı hazır");
      } else {
        if (imageProvider === "disabled") return;
        const candidate = textCandidate();
        const response = await bridge.aiImageModels({
          provider: candidate.provider, endpoint: candidate.endpoint,
          imageProvider: imageProvider as StudioAiImageProvider, imageEndpoint: imageFields().imageEndpoint,
          ...(imageKey ? { imageApiKey: imageKey } : {}), timeoutSeconds: 420,
        });
        const entries = response.models.map((entry) => ({ id: entry.id, label: entry.label,
          supportedReasoningEfforts: entry.supportedReasoningEfforts,
          defaultReasoningEffort: entry.defaultReasoningEffort }));
        if (loadModels) {
          setImageModels(entries);
          const chosen = entries.find((entry) => entry.id === imageModel);
          if (!chosen && !stored?.image.model) { setImageModel(""); setImageVerified(false); }
          if (!chosen?.supportedReasoningEfforts?.some((option)=>option.reasoningEffort === imageReasoning)) setImageReasoning("");
        }
        setResult(loadModels ? entries.length + " görsel modeli" : "Bağlantı hazır");
      }
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(""); }
  };
  const test = async () => {
    if (!bridge || busy || !model) return;
    setBusy("test"); setFeedback();
    try {
      if (role === "text") {
        const response = await bridge.aiTestCandidate(textCandidate());
        setTextVerified(true); setResult("Başarılı · " + response.reply);
      } else {
        const response = await bridge.aiImageTestCandidate({ ...textCandidate(), ...imageFields() });
        setImageVerified(true); setResult("Görsel üretildi · " + Math.round(response.bytes / 1024) + " KB");
      }
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(""); }
  };
  const save = async () => {
    if (!bridge || busy) throw new Error("AI ayarları şu anda kaydedilemiyor.");
    if (!textModel) { setRole("text"); setError("Metin modeli seçilmeli."); throw new Error("AI servisleri: metin modeli seçilmeli."); }
    if (imageProvider !== "disabled" && !imageModel) { setRole("image"); setError("Görsel modeli seçilmeli."); throw new Error("AI servisleri: görsel modeli seçilmeli."); }
    setBusy("save"); setFeedback();
    try {
      const candidate = { ...textCandidate(), ...imageFields(),
        clearApiKey: !sameTextConnection && !textKey,
        clearImageApiKey: !sameImageConnection && !imageKey,
      };
      const response = await bridge.aiSaveConfig(candidate);
      setStored(response); setTextKey(""); setImageKey(""); setResult("Kaydedildi");
    } catch (reason) { setError(errorText(reason));throw reason; }
    finally { setBusy(""); }
  };
  const textConfigured=Boolean(stored&&
    inferText(stored)===textProvider&&stored.model===textModel&&
    stored.endpoint===(provider(textProvider)?.transport==='cli'?'':textEndpoint.trim())&&
    stored.fallbackModel===fallbackModel&&stored.reasoningEffort===reasoning);
  const imageConfigured=Boolean(stored&&
    inferImage(stored)===imageProvider&&
    (imageProvider==='disabled'||stored.image.model===imageModel)&&
    stored.image.endpoint===(imageProvider==='codex-cli'||imageProvider==='disabled'?'':imageEndpoint.trim())&&
    (imageProvider==='disabled'||(stored.image.reasoningEffort||'')===imageReasoning));
  const dirty=Boolean(!initializing&&stored&&(!textConfigured||!imageConfigured||textKey||imageKey));
  const reset=()=>{if(!stored)return;
    setTextProvider(inferText(stored));setImageProvider(inferImage(stored));
    setTextEndpoint(stored.endpoint);setImageEndpoint(stored.image.endpoint);
    setTextModel(stored.model);setImageModel(stored.image.model);
    setFallbackModel(stored.fallbackModel);setReasoning(stored.reasoningEffort);setImageReasoning(stored.image.reasoningEffort??'');
    setTextKey('');setImageKey('');setError('');setResult('');
  };
  const coordinated=useSettingsSection('AI servisleri',dirty,Boolean(busy),save,reset);
  if (!bridge) return null;
  const reasoningOptions = role === "text" ? textReasoningOptions : imageReasoningOptions;
  const selectedReasoning = role === "text" ? reasoning : imageReasoning;
  return <section className="ai-provider-panel ai-minimal">
    <header className="ai-minimal-header"><h2>AI modelleri</h2>
      {!coordinated&&<button className="primary-button" disabled={Boolean(busy)} onClick={() => void save().catch(()=>undefined)}>{busy === "save" ? "Kaydediliyor…" : "Kaydet"}</button>}
    </header>
    <div className="ai-minimal-tabs ai-role-cards">
      <button className={role === "text" ? "active" : ""} onClick={() => { setRole("text"); setFeedback(); }}>
        <strong>✦ Metin servisi</strong><span>{provider(textProvider)?.label??textProvider}</span><small>{textModel||'Model seçilmedi'}</small>
      </button>
      <button className={role === "image" ? "active" : ""} onClick={() => { setRole("image"); setFeedback(); }}>
        <strong>▣ Görsel servisi</strong><span>{provider(imageProvider)?.label??imageProvider}</span><small>{imageProvider==='disabled'?'Devre dışı':imageModel||'Model seçilmedi'}</small>
      </button>
    </div>
    <div className="ai-minimal-form">
      <label><span>Sağlayıcı</span><select value={currentProvider} onChange={(event) => chooseProvider(event.target.value)}>
        {providers.filter((entry) => entry.role === role || entry.role === "both").map((entry) =>
          <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select></label>
      {current?.transport === "api" || current?.transport === "local" ? <>
        <label><span>Endpoint</span><div className="ai-endpoint-row"><input value={endpoint} readOnly={Boolean(current.endpoint)} onChange={(event) => {
          if (role === "text") {
            setTextEndpoint(event.target.value);setTextModels([]);setTextModel("");setFallbackModel("");setReasoning("");setTextVerified(false);
          } else {
            setImageEndpoint(event.target.value);setImageModels([]);setImageModel("");setImageReasoning("");setImageVerified(false);
          }
          setFeedback();
        }}/>{role === "text" && currentProvider === "opencode-cli" && <button type="button" className="secondary-button" onClick={() => void useSharedService()} disabled={Boolean(busy)}>{busy === "service" ? "Aranıyor…" : "Ortak servis"}</button>}</div></label>
        {current.secret && <label><span>{currentProvider === "opencode-cli" ? "Sunucu parolası" : "API anahtarı"}</span><input type="password" autoComplete="off" value={key} placeholder={savedKey ? "••••••••••••" : currentProvider === "opencode-cli" ? "OpenCode sunucu parolası" : "API anahtarı"} onChange={(event) => { if (role === "text") setTextKey(event.target.value); else setImageKey(event.target.value); setFeedback(); }}/></label>}
      </> : null}
      {currentProvider !== "disabled" && <>
        <div className="ai-minimal-model-heading">
          <span>Model</span><div className="ai-minimal-check-actions">
            <button type="button" className="secondary-button" disabled={Boolean(busy) || !canDiscover} onClick={() => void discover(false)}>{busy === "check" ? "Deneniyor…" : "Bağlantıyı dene"}</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy) || !canDiscover} onClick={() => void discover(true)}>{busy === "models" ? "Getiriliyor…" : "Modelleri getir"}</button>
          </div>
        </div>
        {stored&&model&&!models.length&&<p className="ai-minimal-saved-model">Kayıtlı model gösteriliyor. Model listesini yeniden almak zorunda değilsin.</p>}
        <select aria-label="Model" value={model} onChange={(event) => chooseModel(event.target.value)}>
          <option value="">Model seç</option>
          {displayModels.map((entry) => <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>)}
        </select>
        {role === "text" && current?.transport !== "cli" && <label><span>Yedek model</span><select value={fallbackModel} onChange={(event) => setFallbackModel(event.target.value)}><option value="">Kapalı</option>{models.filter((entry) => entry.id !== textModel).map((entry) => <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>)}</select></label>}
        {reasoningOptions.length > 0 && <label><span>Reasoning · modelin bildirdiği seçenekler</span>
          <select aria-label="Reasoning" value={selectedReasoning}
            onChange={(event) => { if (role === "text") setReasoning(event.target.value); else setImageReasoning(event.target.value); setFeedback(); }}>
            <option value="">Varsayılan</option>
            {reasoningOptions.map((entry) => <option key={entry.reasoningEffort} value={entry.reasoningEffort}
              title={entry.description}>{entry.reasoningEffort}{entry.description ? " · " + entry.description : ""}</option>)}
          </select>
        </label>}
        {model && models.some((entry)=>entry.id === model) && !reasoningOptions.length &&
          <p className="ai-minimal-note">Bu model reasoning seçeneklerini katalogda bildirmiyor. Varsayılan kullanılacak; seçenek tahmin edilmeyecek.</p>}
        <div className="ai-minimal-actions">
          <button type="button" className="secondary-button" disabled={Boolean(busy) || !model} onClick={() => void test()}>{busy === "test" ? "Test ediliyor…" : "Modeli dene"}</button>
          {(role === "text" ? textVerified : imageVerified) && <span className="ai-minimal-verified">✓ Test başarılı</span>}
        </div>
      </>}
      {currentProvider === "disabled" && <div className="ai-minimal-actions"><span>Görsel üretimi kapalı</span></div>}
      {result && <p className="ai-minimal-result" role="status">{result}</p>}
      {error && <p className="ai-minimal-error" role="alert">{error}</p>}
    </div>
  </section>;
}
