import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard";
import AiProviderSettings from "./AiProviderSettings";
import CommunityAdminSettings from "./CommunityAdminSettings";
import UniverseMaintenanceSettings from "./UniverseMaintenanceSettings";
import ChannelProjectsSettings from "./ChannelProjectsSettings";
import SeoSettings from "./SeoSettings";
import "./site-insights.css";
import {SettingsController,useSettingsManager,SETTINGS_BUSY_KEY,SETTINGS_DIRTY_KEY} from "./SettingsController";
import StudioTopbar from "./StudioTopbar";
import StudioIcon, { type StudioIconName } from "./StudioIcon";
import { initialSidebarMode, saveSidebarMode, type StudioSidebarMode } from "./studio-shell";
import { studioLogoMarkUrl } from "./studio-assets";

const VideoArchive = lazy(() => import("./VideoArchive"));
const SubtitleResearch = lazy(() => import("./SubtitleResearch"));
const AiWorkbench = lazy(() => import("./AiWorkbench"));
const VefkWorkshop = lazy(() => import("./VefkWorkshop"));
const SceneWorkshop = lazy(() => import("./SceneWorkshop"));
const EditorialWorkspaceV3 = lazy(() => import("./EditorialWorkspaceV3"));
const CommunityAdmin = lazy(() => import("./CommunityAdmin"));
const PublishCenter = lazy(() => import("./PublishCenter"));

const productionSections = [
  "Gösterge Paneli",
  "Video Arşivi",
  "Altyazı Araştırma",
  "AI Atölyesi",
  "Vefk Atölyesi",
  "Sahne Atölyesi",
  "Kayıt Dosyaları",
] as const;

const systemSections = [
  "Topluluk",
  "Yayınlama",
  "Ayarlar",
] as const;

const sections = [...productionSections, ...systemSections] as const;

const navIcons: Record<(typeof sections)[number], StudioIconName> = {
  "Gösterge Paneli": "dashboard",
  "Video Arşivi": "video",
  "Altyazı Araştırma": "subtitles",
  "AI Atölyesi": "sparkles",
  "Vefk Atölyesi": "vefk",
  "Sahne Atölyesi": "scene",
  "Kayıt Dosyaları": "records",
  "Topluluk": "community",
  "Yayınlama": "publish",
  "Ayarlar": "settings",
};

type Section = (typeof sections)[number];
type NavigableSection = Section | "Muhataplar";
type ItemKind = StudioPersistedItem["kind"];
type StudioItem = StudioPersistedItem & { relatedCount: number };
type StudioChannelBridge = NonNullable<typeof window.channelFoundryStudio> & {
  youtubeCatalogActive(): Promise<StudioYoutubeChannel | null>;
  youtubeCatalogSetActive(input: { channelId: string }): Promise<StudioYoutubeChannel>;
};

const editorialModeStorageKey = "channel-foundry:editor-mode";

function requestEditorialMode(mode: "editor" | "characters") {
  sessionStorage.setItem(editorialModeStorageKey, mode);
  window.dispatchEvent(new CustomEvent("channel-foundry:editor-mode", { detail: mode }));
}

function errorText(error: unknown) { return error instanceof Error ? error.message : String(error); }
function connectedKeys(key: string, relations: StudioPersistedRelation[]) {
  const result = new Set<string>();
  relations.forEach((relation) => {
    if (relation.fromKey === key) result.add(relation.toKey);
    if (relation.toKey === key) result.add(relation.fromKey);
  });
  return result;
}
function makeIdentity(kind: ItemKind) {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { key: `local:${kind}:${token}`, id: `local-${kind}-${token.slice(0, 8)}` };
}

export default function StudioPipeline() {
  const bridge = window.channelFoundryStudio as StudioChannelBridge | undefined;
  const [active, setActive] = useState<Section>("Gösterge Paneli");
  const [items, setItems] = useState<StudioPersistedItem[]>([]);
  const [relations, setRelations] = useState<StudioPersistedRelation[]>([]);
  const [workspaceNodes, setWorkspaceNodes] = useState<StudioUniverseWorkspaceNode[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState<StudioUniverseWorkspaceStatus | null>(null);
  const [databaseInfo, setDatabaseInfo] = useState<StudioDatabaseInfo | null>(null);
  const [channels, setChannels] = useState<StudioYoutubeChannel[]>([]);
  const [projects, setProjects] = useState<StudioChannelProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [catalogStats, setCatalogStats] = useState<StudioYoutubeCatalogStats>({ total: 0, imported: 0, transcripts: 0, pendingImport: 0 });
  const [catalogVideos, setCatalogVideos] = useState<StudioYoutubeCatalogVideo[]>([]);
  const [aiStats, setAiStats] = useState<StudioAiAnalysisStats>({ transcripts: 0, analyzed: 0, waiting: 0, running: 0, errors: 0 });
  const [mergeStatus, setMergeStatus] = useState<StudioUniverseMergeStatus | null>(null);
  const [publicationInfo, setPublicationInfo] = useState<StudioPublicationInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<StudioSidebarMode>(() => initialSidebarMode());
  // Bütün çalışma alanları kullanıcının aynı kalıcı menü tercihini paylaşır.
  const sceneWorkspaceActive = active === "Sahne Atölyesi" || active === "Kayıt Dosyaları";
  const effectiveSidebarMode: StudioSidebarMode = sidebarMode;

  const load = async () => {
    if (!bridge) { setItems([]); setRelations([]); setWorkspaceNodes([]); setWorkspaceStatus(null); setChannels([]); setActiveChannelId(""); setCatalogVideos([]); setReady(true); return; }
    await bridge.bootstrap({});
    const [state, info, nextChannels, nextActiveChannel, stats, nextCatalogVideos, nextWorkspaceNodes, nextWorkspaceStatus, nextAiStats, nextMergeStatus, nextPublicationInfo, nextProjects] = await Promise.all([
      bridge.loadState(),
      bridge.getDatabaseInfo(),
      bridge.youtubeCatalogChannels(),
      bridge.youtubeCatalogActive(),
      bridge.youtubeCatalogStats(),
      bridge.youtubeCatalogVideos({}),
      bridge.universeWorkspaceList(),
      bridge.universeWorkspaceStatus(),
      bridge.aiAnalysisStats(),
      bridge.universeMergeStatus(),
      bridge.getPublicationInfo(),
      bridge.channelProjects(),
    ]);
    setProjects(nextProjects.projects);
    setActiveProjectId(nextProjects.activeId);
    setItems(state.items);
    setRelations(state.relations);
    setDatabaseInfo(info);
    setChannels(nextChannels);
    setActiveChannelId(nextActiveChannel?.id || "");
    setCatalogStats(stats);
    setCatalogVideos(nextCatalogVideos);
    setWorkspaceNodes(nextWorkspaceNodes);
    setWorkspaceStatus(nextWorkspaceStatus);
    setAiStats(nextAiStats);
    setMergeStatus(nextMergeStatus);
    setPublicationInfo(nextPublicationInfo);
    setError(null);
    setReady(true);
  };

  useEffect(() => {
    void load().catch((reason) => { setError(errorText(reason)); setReady(true); });
    return bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
  }, []);

  const studioItems = useMemo<StudioItem[]>(() => items.map((item) => ({ ...item, relatedCount: connectedKeys(item.key, relations).size })), [items, relations]);
  const activateSection = (section: NavigableSection) => {
    if(active === "Ayarlar" && section!==active){
      if(sessionStorage.getItem(SETTINGS_BUSY_KEY)==='1'){window.alert('Ayarlar kaydedilirken sayfadan çıkılamaz.');return;}
      if(sessionStorage.getItem(SETTINGS_DIRTY_KEY)==='1'&&!window.confirm('Ayarlar bölümünde kaydedilmemiş değişiklikler var. Çıkılsın mı?'))return;
    }
    if (active === "Kayıt Dosyaları" && section !== active) {
      if (sessionStorage.getItem("channel-foundry:records-busy") === "1") { window.alert("Devam eden kayıt veya görsel işlemi tamamlanmadan çalışma alanından çıkılamaz."); return; }
      if (sessionStorage.getItem("channel-foundry:records-unsaved") === "1" && !window.confirm("Kayıt Dosyaları'nda kaydedilmemiş değişiklikler var. Çıkılsın mı?")) return;
    }
    if (active === "Sahne Atölyesi" && section !== active
      && sessionStorage.getItem("channel-foundry:scene-unsaved") === "1") {
      if (!window.confirm("Kaydedilmemiş sahne düzenlemeleri var. Çalışma alanından çıkılsın mı?")) return;
      sessionStorage.removeItem("channel-foundry:scene-unsaved");
    }
    if (active === "Vefk Atölyesi" && section !== active
      && sessionStorage.getItem("channel-foundry:vefk-unsaved") === "1"
      && !window.confirm("Kaydedilmemiş vefk düzenlemeleri var. Çalışma alanından çıkılsın mı?")) return;
    if (section === "Muhataplar") {
      requestEditorialMode("characters");
      setActive("Kayıt Dosyaları");
      return;
    }
    setActive(section);
  };
  const selectProject = async (id: string) => {
    if (!bridge || projectBusy || !id || id === activeProjectId) return;
    if(active === "Ayarlar"){
      if(sessionStorage.getItem(SETTINGS_BUSY_KEY)==='1'){window.alert('Ayarlar kaydedilirken proje değiştirilemez.');return;}
      if(sessionStorage.getItem(SETTINGS_DIRTY_KEY)==='1'&&!window.confirm('Kaydedilmemiş ayarlar var. Proje değiştirilsin mi?'))return;
    }
    if (active === "Kayıt Dosyaları") {
      if (sessionStorage.getItem("channel-foundry:records-busy") === "1") { window.alert("Devam eden kayıt veya görsel işlemi tamamlanmadan proje değiştirilemez."); return; }
      if (sessionStorage.getItem("channel-foundry:records-unsaved") === "1" && !window.confirm("Kaydedilmemiş kayıt düzenlemeleri var. Proje değiştirilsin mi?")) return;
    }
    if (active === "Sahne Atölyesi" && sessionStorage.getItem("channel-foundry:scene-unsaved") === "1"
      && !window.confirm("Kaydedilmemiş sahne düzenlemeleri var. Proje değiştirilsin mi?")) return;
    if (active === "Vefk Atölyesi" && sessionStorage.getItem("channel-foundry:vefk-unsaved") === "1"
      && !window.confirm("Kaydedilmemiş vefk düzenlemeleri var. Proje değiştirilsin mi?")) return;
    setProjectBusy(true);
    try {
      await bridge.channelProjectSelect({ id });
      // Proje seçimi Electron tarafından yeniden başlatılarak uygulanır.
    } catch (reason) {
      setError(`Proje değiştirilemedi: ${errorText(reason)}`);
      setProjectBusy(false);
    }
  };
  const toggleSidebar = () => setSidebarMode((current) => saveSidebarMode(current === "expanded" ? "collapsed" : "expanded"));
  const createDraft = async (kind: ItemKind) => {
    const identity = makeIdentity(kind);
    const titles: Record<ItemKind, string> = { video: "Yeni kayıt", character: "Yeni muhatap", event: "Yeni olay", file: "Yeni dosya" };
    const item: StudioPersistedItem = { ...identity, kind, title: titles[kind], meta: "", summary: "İçerik özetini buraya yaz.", status: "draft" };
    try {
      const saved = bridge ? await bridge.saveItem(item) : item;
      setItems((current) => [saved, ...current]);
      activateSection(kind === "character" ? "Muhataplar" : "Kayıt Dosyaları");
      setShowCreate(false);
      setError(null);
    } catch (reason) { setError(errorText(reason)); }
  };

  if (!ready) return <div className="pipeline-loading"><span>Yayın Atölyesi</span><strong>Yerel üretim alanı hazırlanıyor…</strong></div>;
  return <div className={`studio-shell pipeline-shell studio-sidebar-${effectiveSidebarMode}`} data-scene-workspace={sceneWorkspaceActive ? "true" : undefined}>
    <aside className="studio-sidebar pipeline-sidebar" id="studio-primary-sidebar" aria-label="Ana menü">
      <Brand collapsed={effectiveSidebarMode === "collapsed"}/>
      <div className="studio-sidebar-scroll">
        <div className="nav-caption">ÜRETİM</div>
        <nav className="studio-nav" aria-label="Üretim">
          {productionSections.map((section) => <SidebarNavItem key={section} section={section} icon={navIcons[section]} active={active === section} collapsed={effectiveSidebarMode === "collapsed"} onSelect={() => activateSection(section)}/>)}
        </nav>
        <div className="nav-caption system-caption">SİSTEM</div>
        <nav className="studio-nav" aria-label="Sistem">
          {systemSections.filter((section) => section !== "Ayarlar").map((section) => <SidebarNavItem key={section} section={section} icon={navIcons[section]} active={active === section} collapsed={effectiveSidebarMode === "collapsed"} onSelect={() => activateSection(section)}/>)}
        </nav>
      </div>
      <nav className="studio-nav studio-settings-nav" aria-label="Uygulama ayarları">
        <SidebarNavItem section="Ayarlar" icon={navIcons.Ayarlar} active={active === "Ayarlar"} collapsed={effectiveSidebarMode === "collapsed"} onSelect={() => activateSection("Ayarlar")}/>
      </nav>
    </aside>
    <main className="studio-main pipeline-main">
      <StudioTopbar section={active} projects={projects} activeProjectId={activeProjectId} busy={projectBusy} activeChannel={channels.find((entry) => entry.id === activeChannelId) || null} onProjectChange={(id) => void selectProject(id)} sidebarCollapsed={effectiveSidebarMode === "collapsed"} onToggleSidebar={toggleSidebar}/>
      <section className="studio-content pipeline-content" aria-label="Çalışma alanı" data-workspace-section={active}>
        {error && active !== "AI Atölyesi" && <div className="storage-warning studio-workspace-error" role="alert">Studio uyarısı: {error}</div>}
        <Suspense fallback={<SectionLoading section={active}/> }>
          {active === "Gösterge Paneli" && <Dashboard items={studioItems} relations={relations} catalog={catalogStats} catalogVideos={catalogVideos} aiStats={aiStats} mergeStatus={mergeStatus} workspaceNodes={workspaceNodes} workspaceStatus={workspaceStatus} publicationInfo={publicationInfo} activeProjectId={activeProjectId} onNavigate={activateSection}/>}
          {active === "Video Arşivi" && <VideoArchive/>}
          {active === "Altyazı Araştırma" && <SubtitleResearch/>}
          {active === "AI Atölyesi" && <AiWorkbench pipelineError={error}/>}
          {active === "Vefk Atölyesi" && <VefkWorkshop/>}
          {active === "Sahne Atölyesi" && <SceneWorkshop/>}
          {active === "Kayıt Dosyaları" && <EditorialWorkspaceV3 nodes={workspaceNodes} legacyItems={studioItems} legacyRelations={relations} onReload={load} onCreate={() => setShowCreate(true)}/>}
          {active === "Topluluk" && <CommunityAdmin key={activeProjectId} projectId={activeProjectId}/>}
          {active === "Yayınlama" && <PublishCenter/>}
          {active === "Ayarlar" && <Settings databaseInfo={databaseInfo} catalog={catalogStats} workspaceStatus={workspaceStatus}/>}
        </Suspense>
      </section>
    </main>
    {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={(kind) => void createDraft(kind)}/>} 
  </div>;
}

type SidebarNavItemProps = {
  section: Section;
  icon: StudioIconName;
  active: boolean;
  collapsed: boolean;
  onSelect: () => void;
};

function SidebarNavItem({ section, icon, active, collapsed, onSelect }: SidebarNavItemProps) {
  return <button
    type="button"
    className={active ? "active" : ""}
    data-section={section}
    data-tooltip={section}
    title={collapsed ? section : undefined}
    aria-label={collapsed ? section : undefined}
    aria-current={active ? "page" : undefined}
    onClick={onSelect}
  >
    <StudioIcon name={icon} className="studio-nav-icon"/>
    <span className="studio-nav-label">{section}</span>
  </button>;
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return <div className={`studio-brand${collapsed ? " is-collapsed" : ""}`} role="img" aria-label="Yayın Atölyesi">
    <img className="studio-brand-mark" src={studioLogoMarkUrl} alt="" aria-hidden="true"/>
    <span className="studio-brand-copy" aria-hidden="true">
      <strong className="studio-brand-name">Yayın Atölyesi</strong>
      <small className="studio-brand-subtitle">STÜDYO</small>
    </span>
  </div>;
}

function SectionLoading({ section }: { section: Section }) {
  if (section === "Topluluk") return <section className="community-console-state panel" role="status" aria-live="polite">
    <span className="community-console-spinner" aria-hidden="true"/>
    <h2>Topluluk hazırlanıyor</h2>
    <p>Yönetici bağlantısı doğrulanıyor, konular ve ilk mesajlar yükleniyor…</p>
  </section>;
  return <div className="pipeline-loading"><span>{section}</span><strong>Çalışma alanı hazırlanıyor…</strong></div>;
}

type SettingsTab = "project" | "ai" | "community" | "data" | "seo";
const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "project", label: "Kanal ve yayın" },
  { id: "ai", label: "AI servisleri" },
  { id: "community", label: "Topluluk" },
  { id: "data", label: "Yerel veri" },
  { id: "seo", label: "SEO" },
];
export function Settings({ databaseInfo, catalog, workspaceStatus }: { databaseInfo: StudioDatabaseInfo | null; catalog: StudioYoutubeCatalogStats; workspaceStatus: StudioUniverseWorkspaceStatus | null }) {
 return <SettingsController><SettingsWorkspace databaseInfo={databaseInfo} catalog={catalog} workspaceStatus={workspaceStatus}/></SettingsController>;
}
function SettingsWorkspace({ databaseInfo, catalog, workspaceStatus }: { databaseInfo: StudioDatabaseInfo | null; catalog: StudioYoutubeCatalogStats; workspaceStatus: StudioUniverseWorkspaceStatus | null }) {
  const controller=useSettingsManager();
  const [tab, setTab] = useState<SettingsTab>(() => {
    const next = sessionStorage.getItem("studio:settings-tab");
    sessionStorage.removeItem("studio:settings-tab");
    return next === "seo" ? next : "project";
  });
  const manualItemCount = Math.max(0, (databaseInfo?.itemCount ?? 0) - catalog.imported);
  const [visited,setVisited]=useState<SettingsTab[]>(['project']);
  useEffect(()=>{setVisited(prev=>prev.includes(tab)?prev:[...prev,tab]);},[tab]);
  useEffect(()=>{
    const hotkey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void controller?.saveAll();}};
    window.addEventListener('keydown',hotkey);return()=>window.removeEventListener('keydown',hotkey);
  },[controller]);
  const status=controller?.state;
  return <div className="settings-page settings-compact settings-v3">
    <header className="settings-v3-bar"><div><strong>Yapılandırma</strong><small>{status?.dirty.length?`${status.dirty.length} bölümde kaydedilmemiş değişiklik`:'Bütün ayarlar kaydedildi'}</small></div>
      <div className="settings-v3-actions"><span className={status?.error?"is-error":""} role="status">{status?.error||status?.notice||''}</span><button disabled={!status?.dirty.length||Boolean(status?.busy.length)||status?.saving} onClick={()=>controller?.revertAll()}>Vazgeç</button><button className="primary-button" disabled={!status?.dirty.length||Boolean(status?.busy.length)||status?.saving} onClick={()=>void controller?.saveAll()}>{status?.saving?'Kaydediliyor…':'Tümünü kaydet'}</button></div>
    </header>
    <nav className="studio-settings-tabs" aria-label="Ayarlar bölümleri">
      {settingsTabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>
    <div className="studio-settings-surface settings-v3-surface">
      <div hidden={tab!=="project"}>{visited.includes('project')&&<ChannelProjectsSettings/>}</div>
      <div hidden={tab!=="seo"}>{visited.includes('seo')&&<SeoSettings active={tab==='seo'}/>}</div>
      <div hidden={tab!=="ai"}>{visited.includes('ai')&&<AiProviderSettings/>}</div>
      <div hidden={tab!=="community"}>{visited.includes('community')&&<CommunityAdminSettings/>}</div>
      <div hidden={tab!=="data"}>{visited.includes('data')&&<div className="studio-settings-data">
        <section className="panel settings-card settings-data-card">
          <h2>Yerel veri</h2>
          <dl>
            <div><dt>Konum</dt><dd title={databaseInfo?.file || ""}>{databaseInfo?.file ? "Proje verisi" : "—"}</dd></div>
            <div><dt>Manuel içerik</dt><dd>{manualItemCount}</dd></div>
            <div><dt>Seçili kaynak video</dt><dd>{catalog.imported}</dd></div>
            <div><dt>Editoryal evren</dt><dd>{workspaceStatus?.counts.total ?? 0}</dd></div>
            <div><dt>Kanal kataloğu</dt><dd>{catalog.total}</dd></div>
          </dl>
        </section>
        <UniverseMaintenanceSettings/>
      </div>}</div>
    </div>
  </div>;
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (kind: ItemKind) => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="create-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><small>MANUEL İÇERİK</small><h2>AI evreninden bağımsız ne eklemek istiyorsun?</h2></div><button onClick={onClose}>×</button></div><div className="create-grid"><button onClick={() => onCreate("video")}><span>KY</span><strong>Kayıt</strong><small>Manuel editoryal kayıt</small></button><button onClick={() => onCreate("character")}><span>MH</span><strong>Muhatap</strong><small>Kişi, tanık veya varlık</small></button><button onClick={() => onCreate("event")}><span>OL</span><strong>Olay</strong><small>Timeline düğümü</small></button><button onClick={() => onCreate("file")}><span>DS</span><strong>Dosya</strong><small>Not veya araştırma belgesi</small></button></div></div></div>;
}
