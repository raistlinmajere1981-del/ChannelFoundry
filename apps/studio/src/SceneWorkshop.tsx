import { useCallback, useEffect, useRef, useState } from "react";
import "./scene-workshop.css";

type Pending = { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> };
function textError(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
const unsavedKey = "channel-foundry:scene-unsaved";

export default function SceneWorkshop() {
  const bridge = window.channelFoundryStudio;
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef(new Map<string, Pending>());
  const sourceHash = useRef("");
  const revision = useRef(0);
  const loading = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [prepared, setPrepared] = useState(false);
  const [approval, setApproval] = useState<StudioSceneWorkshopPreflight | null>(null);
  const [readiness, setReadiness] = useState<StudioSceneReadiness | null>(null);
  const [status, setStatus] = useState("Sahne düzenleyicisi açılıyor…");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const interval = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(interval);
  }, [busy]);

  useEffect(() => bridge?.onSceneWorkshopProgress((progress) => {
    if (progress.operation === "deploy" || progress.operation === "preflight") setStatus(progress.message);
  }), [bridge]);

  const send = useCallback((type: string, extra: Record<string, unknown> = {}) =>
    frame.current?.contentWindow?.postMessage({ type, ...extra }, "*"), []);

  const request = useCallback((type: string, extra: Record<string, unknown> = {}): Promise<any> => {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      if (!frame.current?.contentWindow) return reject(new Error("Sahne düzenleyicisi açık değil."));
      const timer = setTimeout(() => {
        pending.current.delete(id);
        reject(new Error("Sahne düzenleyicisi yanıt vermedi."));
      }, 18000);
      pending.current.set(id, { resolve, reject, timer });
      send(type, { requestId: id, ...extra });
    });
  }, [send]);

  const load = useCallback(async () => {
    if (!bridge || loading.current) return;
    loading.current = true;
    try {
      setStatus("BirDeSenGör sahnesi okunuyor…");
      const reply = await bridge.sceneWorkshopLoad();
      await request("studio:load", {
        scene: reply.scene, previewImage: reply.previewImage,
        previewObjects: reply.previewObjects, siteSource: true,
      });
      sourceHash.current = reply.sourceHash;
      setReadiness(reply.readiness);
      setLoaded(true);
      setDirty(false);
      setPrepared(false);
      setApproval(null);
      setStatus(reply.note);
      setError("");
      sessionStorage.removeItem(unsavedKey);
    } catch (reason) {
      setError(textError(reason));
      setStatus("Sahne yüklenemedi.");
    } finally { loading.current = false; }
  }, [bridge, request]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== "object") return;
      const packet = event.data;
      if (packet.type === "studio:ready") { void load(); return; }
      if (packet.type === "studio:dirty") {
        revision.current++;
        sessionStorage.setItem(unsavedKey, "1");
        setDirty(true);
        setPrepared(false);
        setApproval(null);
        return;
      }
      if (!packet.requestId || typeof packet.requestId !== "string") return;
      const item = pending.current.get(packet.requestId);
      if (!item) return;
      pending.current.delete(packet.requestId);
      clearTimeout(item.timer);
      if (packet.type === "studio:error") item.reject(new Error(packet.message || "Sahne düzenleyicisi hatası."));
      else if (packet.type === "studio:loaded" || packet.type === "studio:data") item.resolve(packet);
      else item.reject(new Error("Sahne editöründen beklenmeyen yanıt."));
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      for (const item of pending.current.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("Sahne editörü kapatıldı."));
      }
      pending.current.clear();
    };
  }, [load]);

  const persist = useCallback(async () => {
    if (!bridge) throw new Error("Studio bağlantısı bulunamadı.");
    const before = revision.current;
    const reply = await request("studio:get");
    const saved = await bridge.sceneWorkshopSave({
      scene: reply.scene as StudioSceneDocument, expectedSourceHash: sourceHash.current,
    });
    sourceHash.current = saved.sourceHash;
    setReadiness(saved.readiness);
    if (revision.current === before) {
      setDirty(false);
      sessionStorage.removeItem(unsavedKey);
    }
    return saved;
  }, [bridge, request]);

  const save = async () => {
    if (!loaded || busy) return;
    setBusy("save"); setError("");
    try {
      const result = await persist();
      setStatus(result.message);
      setPrepared(false);
      setApproval(null);
    } catch (reason) { setError(textError(reason)); }
    finally { setBusy(""); }
  };
  const prepare = async () => {
    if (!loaded || busy) return;
    setBusy("prepare"); setError("");
    try {
      await persist();
      if (sessionStorage.getItem(unsavedKey) === "1")
        throw new Error("Kaydetme sırasında yeni düzenlemeler yapıldı. Önce tekrar kaydedin.");
      const result = await bridge?.sceneWorkshopPrepare();
      if (!result) throw new Error("Hazırlama servisi bulunamadı.");
      sourceHash.current = result.sourceHash;
      setReadiness(result.readiness);
      setPrepared(true);
      setApproval(null);
      setStatus(result.message);
    } catch (reason) { setError(textError(reason)); setPrepared(false); }
    finally { setBusy(""); }
  };
  const preflight = async () => {
    if (!bridge || !loaded || busy || dirty || !prepared) return;
    setBusy("preflight"); setError("");
    setApproval(null);
    setStatus("Yerel derleme, kaynak doğrulama ve FTPS kuru deneme kontrol ediliyor…");
    try {
      const result = await bridge.sceneWorkshopPreflight();
      setApproval(result);
      setStatus(result.message);
    } catch (reason) { setError(textError(reason)); setStatus("Ön kontrol başarısız; canlı yayın kapalı."); }
    finally { setBusy(""); }
  };
  const deploy = async () => {
    if (!bridge || !approval || busy || dirty) return;
    const approved = approval;
    if (!window.confirm("BirDeSenGör canlı sitesine efekt sahnesi yayınlansın mı?\n\nBu işlem yerel site derlemesi ve doğrulanmış FTPS aktarımı yapar. Açık onay vermeden ağ aktarımı başlamaz.")) {
      await bridge.sceneWorkshopInvalidate();
      setApproval(null);
      setStatus("Canlı yayın iptal edildi.");
      return;
    }
    setApproval(null);
    setBusy("deploy");
    setStatus("BirDeSenGör canlı sitesine aktarım ve canlı doğrulama çalışıyor…");
    setError("");
    try {
      const result = await bridge.sceneWorkshopDeploy({ token: approved.token });
      setStatus(result.message);
    } catch (reason) { setError(textError(reason)); setStatus("Canlı yayın tamamlanamadı; site ayrıca doğrulanmalı."); }
    finally { setBusy(""); }
  };

  return <div className="scene-workshop-page">
    <div className="scene-workshop-controls">
      <div className="scene-workshop-heading">
        <strong>BirDeSenGör · Efekt sahnesi</strong>
        <span>{readiness ? readiness.enabledCount + "/" + readiness.effectCount + " efekt · " + readiness.mountedCount + " bağlı" : "Sahne hazırlanıyor"}</span>
      </div>
      <div className="scene-workshop-actions">
        <button type="button" onClick={() => void load()} disabled={Boolean(busy) || dirty} title="Kaynağı yeniden oku">Yenile</button>
        <button type="button" onClick={() => void save()} disabled={!loaded || Boolean(busy) || !readiness?.ready}>Kaydet{dirty ? " *" : ""}</button>
        <button type="button" onClick={() => void prepare()} disabled={!loaded || Boolean(busy) || !readiness?.ready}>Siteye hazırla</button>
        <button type="button" onClick={() => void preflight()} disabled={!loaded || Boolean(busy) || !prepared || dirty || !readiness?.ready}>Ön kontrol</button>
        <button type="button" className="scene-workshop-publish" onClick={() => void deploy()} disabled={!approval || Boolean(busy) || dirty}>Canlı yayın</button>
      </div>
    </div>
    <div className="scene-workshop-status" aria-live="polite">
      <span>{busy ? "İşlem sürüyor · " + Math.floor(elapsed / 60) + ":" + String(elapsed % 60).padStart(2, "0") + " · " : ""}{status}</span>
      {error && <strong role="alert">{error}</strong>}
    </div>
    <iframe
      ref={frame}
      className="scene-workshop-editor"
      title="BirDeSenGör sahne efekt düzenleyicisi"
      src="./scene.html?embedded=1"
      onLoad={() => send("studio:hello")}
    />
  </div>;
}
