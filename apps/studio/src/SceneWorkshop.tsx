import { useCallback, useEffect, useRef, useState } from "react";
import { sceneTemplate } from "./scene-workspace/template.mjs";
import "./scene-workspace/editor.css";
import "./scene-workshop.css";

type SceneEditorController = { load(packet: Record<string, unknown>): void; snapshot(): {scene: StudioSceneDocument; assets: {path:string;dataUrl:string}[]; presentation: Record<string,unknown>}; destroy(): void };
function textError(reason: unknown) { return reason instanceof Error ? reason.message : String(reason); }
const unsavedKey = "channel-foundry:scene-unsaved";

export default function SceneWorkshop() {
  const bridge = window.channelFoundryStudio;
  const editorHost = useRef<HTMLDivElement>(null);
  const editor = useRef<SceneEditorController | null>(null);
  const sourceHash = useRef("");
  const currentProject = useRef("birdesengor");
  const [selectedProject,setSelectedProject]=useState("birdesengor");
  const [projects,setProjects]=useState([{id:"birdesengor",label:"BirDeSenGör",
    siteBound:true,canPublish:true,description:"Mevcut web sahnesi"}]);
  const [canPublish,setCanPublish]=useState(true);
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

  const refreshProjects = useCallback(async () => {
    if(!bridge?.sceneWorkshopProjects)return;
    const list=await bridge.sceneWorkshopProjects();
    if(Array.isArray(list)&&list.some(item=>item.id==="birdesengor"))setProjects(list);
  },[bridge]);
  useEffect(()=>{void refreshProjects().catch(reason=>setError(textError(reason)));},[refreshProjects]);

  const load = useCallback(async (projectId?:string) => {
    if (!bridge || loading.current) return;
    loading.current = true;
    try {
      const id=projectId??currentProject.current;
      setStatus("Sahne kaynağı okunuyor…");
      const reply = await bridge.sceneWorkshopLoad({projectId:id});
      if (!editor.current) throw new Error("Sahne modülü henüz hazır değil.");
      editor.current.load({
        scene: reply.scene, previewImage: reply.previewImage, background: reply.background,
        previewObjects: reply.previewObjects, previewArt: reply.previewArt, roomObjects: reply.roomObjects, assets: reply.assets, presentation: reply.presentation, focusTargets: reply.focusTargets, siteSource: reply.siteSource!==false, genericEditable:reply.siteSource===false,
      });
      sourceHash.current = reply.sourceHash;
      setCanPublish(reply.canPublish!==false);
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
  }, [bridge]);

  useEffect(() => {
    const host = editorHost.current;
    if (!host) return;
    host.innerHTML = sceneTemplate;
    let cancelled = false;
    void import("./scene-workspace/scene-editor.mjs").then(({ mountSceneEditor }) => {
      if (cancelled || !host.isConnected) return;
      editor.current = mountSceneEditor(host, {
        onCapture: async (request) => {
          if (!bridge?.sceneWorkshopCapture || currentProject.current !== "birdesengor")
            throw new Error("Gerçek web görüntüsü yalnız BirDeSenGör'de kullanılabilir.");
          return bridge.sceneWorkshopCapture({
            ...request, keepOpen:true, projectId:currentProject.current,
            expectedSourceHash:sourceHash.current,
          });
        },
        onCaptureInteract: input => {
          if(!bridge?.sceneWorkshopInteract)throw Error("Etkileşimli web önizleme bağlantısı bulunamadı.");
          return bridge.sceneWorkshopInteract({...input,projectId:currentProject.current});
        },
        onCaptureClose: input =>
          bridge?.sceneWorkshopCaptureClose?.({...input,projectId:currentProject.current})
          ?? Promise.resolve({ok:true}),
        onDirty: () => {
          revision.current++;
          sessionStorage.setItem(unsavedKey, "1");
          setDirty(true);
          setPrepared(false);
          setApproval(null);
        },
      });
      void load();
    }).catch(reason => { if (!cancelled) setError(textError(reason)); });
    return () => {
      cancelled = true;
      editor.current?.destroy();
      editor.current = null;
      host.replaceChildren();
    };
  }, [load]);

  const selectProject = async(id:string)=>{
    if(dirty||busy||loading.current||id===currentProject.current)return;
    currentProject.current=id;
    setSelectedProject(id);setLoaded(false);setReadiness(null);setApproval(null);
    setPrepared(false);sourceHash.current="";
    await load(id);
  };
  const createProject = async()=>{
    if(!bridge?.sceneWorkshopCreate||dirty||busy||loading.current)return;
    const name=window.prompt("Yeni bağımsız sahnenin adı", "Yeni Sahne");
    if(!name)return;
    setBusy("create");setError("");
    try{
      const created=await bridge.sceneWorkshopCreate({name});
      await refreshProjects();
      currentProject.current=created.id;setSelectedProject(created.id);
      sourceHash.current="";setLoaded(false);setReadiness(null);
      await load(created.id);
    }catch(reason){setError(textError(reason));}
    finally{setBusy("");}
  };

  const persist = useCallback(async () => {
    if (!bridge) throw new Error("Studio bağlantısı bulunamadı.");
    const before = revision.current;
    if (!editor.current) throw new Error("Sahne modülü hazır değil.");
    const reply = editor.current.snapshot();
    const saved = await bridge.sceneWorkshopSave({
      projectId:currentProject.current,scene: reply.scene as StudioSceneDocument, assets: reply.assets ?? [], presentation: reply.presentation, expectedSourceHash: sourceHash.current,
    });
    sourceHash.current = saved.sourceHash;
    setReadiness(saved.readiness);
    if (revision.current === before) {
      setDirty(false);
      sessionStorage.removeItem(unsavedKey);
    }
    return saved;
  }, [bridge]);

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
      const result = await bridge?.sceneWorkshopPrepare({projectId:currentProject.current});
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
      const result = await bridge.sceneWorkshopPreflight({projectId:currentProject.current});
      setApproval(result);
      setStatus(result.message);
    } catch (reason) { setError(textError(reason)); setStatus("Ön kontrol başarısız; canlı yayın kapalı."); }
    finally { setBusy(""); }
  };
  const deploy = async () => {
    if (!bridge || !approval || busy || dirty) return;
    const approved = approval;
    if (!window.confirm("BirDeSenGör canlı sitesine efekt sahnesi yayınlansın mı?\n\nBu işlem yerel site derlemesi ve doğrulanmış FTPS aktarımı yapar. Açık onay vermeden ağ aktarımı başlamaz.")) {
      await bridge.sceneWorkshopInvalidate({projectId:currentProject.current});
      setApproval(null);
      setStatus("Canlı yayın iptal edildi.");
      return;
    }
    setApproval(null);
    setBusy("deploy");
    setStatus("BirDeSenGör canlı sitesine aktarım ve canlı doğrulama çalışıyor…");
    setError("");
    try {
      const result = await bridge.sceneWorkshopDeploy({projectId:currentProject.current,token: approved.token });
      setStatus(result.message);
    } catch (reason) { setError(textError(reason)); setStatus("Canlı yayın tamamlanamadı; site ayrıca doğrulanmalı."); }
    finally { setBusy(""); }
  };

  return <div className="scene-workshop-page" data-testid="scene-workspace-v3">
    <div className="scene-workshop-controls">
      <div className="scene-workshop-heading">
        <strong>Sahne Atölyesi</strong>
        <label className="scene-project-select-label" title="Sahne kaynağı">
          <select aria-label="Sahne projesi" value={selectedProject}
            onChange={event=>void selectProject(event.target.value)}
            disabled={Boolean(busy)||dirty||!loaded}>
            {projects.map(project=><option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
        </label>
        <button type="button" className="scene-project-create" onClick={()=>void createProject()}
          disabled={Boolean(busy)||dirty||!loaded} title="Studio içinde bağımsız yeni sahne">＋ Sahne</button>
        <span>{readiness ? readiness.enabledCount + "/" + readiness.effectCount + " efekt" : "Yükleniyor"}</span>
        {dirty && <span className="scene-workshop-dirty">● Kaydedilmedi</span>}
      </div>
      <div className="scene-workshop-actions">
        <button type="button" onClick={() => void load()} disabled={Boolean(busy) || dirty} aria-label="Site sahnesini yenile">Yenile</button>
        <button type="button" onClick={() => void save()} disabled={!loaded || Boolean(busy) || !readiness?.ready}>Kaydet{dirty ? " *" : ""}</button>
        <button type="button" onClick={() => void prepare()} disabled={!loaded || Boolean(busy) || !readiness?.ready}>{canPublish?"Siteye hazırla":"Yerelde hazırla"}</button>
        {canPublish&&<button type="button" onClick={() => void preflight()} disabled={!loaded || Boolean(busy) || !prepared || dirty || !readiness?.ready}>Ön kontrol</button>}
        {canPublish&&<button type="button" className="scene-workshop-publish" onClick={() => void deploy()} disabled={!approval || Boolean(busy) || dirty}>Canlı yayın</button>}
      </div>
    </div>
    <div ref={editorHost} className="scene-editor-root" data-panel="library" aria-label="Sahne Atölyesi çalışma alanı" />
    <div className="scene-workshop-status" aria-live="polite">
      <span>{busy ? "İşlem sürüyor · " + Math.floor(elapsed / 60) + ":" + String(elapsed % 60).padStart(2, "0") + " · " : ""}{status}</span>
      {error && <strong role="alert">{error}</strong>}
    </div>
  </div>;
}
