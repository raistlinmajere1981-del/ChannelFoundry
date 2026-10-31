import { useEffect, useState } from "react";
import "./ai-minimal.css";

type Provider = { id: string; label: string; role: "text" | "image" | "both"; transport: "cli" | "api" | "local" | "none"; endpoint: string; secret: boolean };
type Role = "text" | "image";
type CatalogEntry = { id: string; label?: string; supportedReasoningEfforts?: Array<{ reasoningEffort: string }> };
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
  const [textModels, setTextModels] = useState<CatalogEntry[]>([]);
  const [imageModels, setImageModels] = useState<CatalogEntry[]>([]);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [textVerified, setTextVerified] = useState(false);
  const [imageVerified, setImageVerified] = useState(false);

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
    }).catch((reason) => setError(errorText(reason)));
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
      setImageModel(""); setImageModels([]); setImageKey(""); setImageVerified(false);
    }
  };
  const useSharedService = async () => {
    if (!bridge || busy) return;
    setBusy("service"); setFeedback();
    try {
      const detected = await bridge.aiOpenCodeService();
      if (detected !== textEndpoint) {
        setTextEndpoint(detected); setTextKey(""); setTextModels([]);
        setTextModel(""); setFallbackModel(""); setTextVerified(false);
      }
      setResult("Ortak servis · " + detected);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(""); }
  };
  const chooseModel = (id: string) => {
    setFeedback();
    if (role === "text") { setTextModel(id); setTextVerified(false); setReasoning(""); }
    else { setImageModel(id); setImageVerified(false); }
  };
  const textCandidate = () => ({
    provider: backendId(textProvider),
    endpoint: provider(textProvider)?.transport === "cli" ? "" : textEndpoint.trim(),
    apiKey: textKey.trim() || (sameTextConnection ? undefined : ""),
    model: textModel, fallbackModel, reasoningEffort: reasoning as StudioCodexReasoningEffort | "",
    timeoutSeconds: 420,
  });
  const imageFields = () => ({
    imageMode: (imageProvider === "disabled" ? "disabled" : "enabled") as StudioAiImageMode,
    imageProvider: (imageProvider === "disabled" ? "openai-compatible" : imageProvider) as StudioAiImageProvider,
    imageEndpoint: imageProvider === "codex-cli" || imageProvider === "disabled" ? "" : imageEndpoint.trim(),
    imageModel: imageProvider === "disabled" ? "" : imageModel,
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
        }));
        if (loadModels) {
          setTextModels(entries);
          if (!entries.some((entry) => entry.id === textModel)) { setTextModel(""); setTextVerified(false); }
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
        const entries = response.models.map((entry) => ({ id: entry.id, label: entry.label }));
        if (loadModels) {
          setImageModels(entries);
          if (!entries.some((entry) => entry.id === imageModel)) { setImageModel(""); setImageVerified(false); }
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
    if (!bridge || busy) return;
    if (!textModel) { setRole("text"); setError("Metin modeli seçilmeli."); return; }
    if (imageProvider !== "disabled" && !imageModel) { setRole("image"); setError("Görsel modeli seçilmeli."); return; }
    setBusy("save"); setFeedback();
    try {
      const candidate = { ...textCandidate(), ...imageFields(),
        clearApiKey: !sameTextConnection && !textKey,
        clearImageApiKey: !sameImageConnection && !imageKey,
      };
      const response = await bridge.aiSaveConfig(candidate);
      setStored(response); setTextKey(""); setImageKey(""); setResult("Kaydedildi");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(""); }
  };
  if (!bridge) return null;
  const reasoningOptions = textModels.find((entry) => entry.id === textModel)?.supportedReasoningEfforts || [];
  return <section className="ai-provider-panel ai-minimal">
    <header className="ai-minimal-header"><h2>AI modelleri</h2>
      <button className="primary-button" disabled={Boolean(busy)} onClick={() => void save()}>{busy === "save" ? "Kaydediliyor…" : "Kaydet"}</button>
    </header>
    <div className="ai-minimal-tabs">
      <button className={role === "text" ? "active" : ""} onClick={() => { setRole("text"); setFeedback(); }}>Metin</button>
      <button className={role === "image" ? "active" : ""} onClick={() => { setRole("image"); setFeedback(); }}>Görsel</button>
    </div>
    <div className="ai-minimal-form">
      <label><span>Sağlayıcı</span><select value={currentProvider} onChange={(event) => chooseProvider(event.target.value)}>
        {providers.filter((entry) => entry.role === role || entry.role === "both").map((entry) =>
          <option key={entry.id} value={entry.id}>{entry.label}</option>)}
      </select></label>
      {current?.transport === "api" || current?.transport === "local" ? <>
        <label><span>Endpoint</span><div className="ai-endpoint-row"><input value={endpoint} readOnly={Boolean(current.endpoint)} onChange={(event) => { if (role === "text") { setTextEndpoint(event.target.value); setTextVerified(false); } else { setImageEndpoint(event.target.value); setImageVerified(false); } setFeedback(); }}/>{role === "text" && currentProvider === "opencode-cli" && <button type="button" className="secondary-button" onClick={() => void useSharedService()} disabled={Boolean(busy)}>{busy === "service" ? "Aranıyor…" : "Ortak servis"}</button>}</div></label>
        {current.secret && <label><span>{currentProvider === "opencode-cli" ? "Sunucu parolası" : "API anahtarı"}</span><input type="password" autoComplete="off" value={key} placeholder={savedKey ? "••••••••••••" : currentProvider === "opencode-cli" ? "OpenCode sunucu parolası" : "API anahtarı"} onChange={(event) => { if (role === "text") setTextKey(event.target.value); else setImageKey(event.target.value); setFeedback(); }}/></label>}
      </> : null}
      {currentProvider !== "disabled" && <>
        <div className="ai-minimal-model-heading">
          <span>Model</span><div className="ai-minimal-check-actions">
            <button type="button" className="secondary-button" disabled={Boolean(busy) || !canDiscover} onClick={() => void discover(false)}>{busy === "check" ? "Deneniyor…" : "Bağlantıyı dene"}</button>
            <button type="button" className="secondary-button" disabled={Boolean(busy) || !canDiscover} onClick={() => void discover(true)}>{busy === "models" ? "Getiriliyor…" : "Modelleri getir"}</button>
          </div>
        </div>
        <select aria-label="Model" value={models.some((entry) => entry.id === model) ? model : ""} onChange={(event) => chooseModel(event.target.value)}>
          <option value="">Model seç</option>
          {models.map((entry) => <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>)}
        </select>
        {role === "text" && current?.transport !== "cli" && <label><span>Yedek model</span><select value={models.some((entry) => entry.id === fallbackModel) ? fallbackModel : ""} onChange={(event) => setFallbackModel(event.target.value)}><option value="">Kapalı</option>{models.filter((entry) => entry.id !== textModel).map((entry) => <option key={entry.id} value={entry.id}>{entry.label || entry.id}</option>)}</select></label>}
        {role === "text" && reasoningOptions.length > 0 && <label><span>Reasoning</span><select value={reasoning} onChange={(event) => setReasoning(event.target.value)}><option value="">Varsayılan</option>{reasoningOptions.map((entry) => <option key={entry.reasoningEffort} value={entry.reasoningEffort}>{entry.reasoningEffort}</option>)}</select></label>}
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
