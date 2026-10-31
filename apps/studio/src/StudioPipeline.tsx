import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Dashboard from "./Dashboard";
import AiProviderSettings from "./AiProviderSettings";
import CommunityAdminSettings from "./CommunityAdminSettings";
import UniverseMaintenanceSettings from "./UniverseMaintenanceSettings";
import ChannelProjectsSettings from "./ChannelProjectsSettings";
import StudioTopbar from "./StudioTopbar";
import { studioLogoUrl } from "./studio-assets";

const VideoArchive = lazy(() => import("./VideoArchive"));
const SubtitleResearch = lazy(() => import("./SubtitleResearch"));
const AiWorkbench = lazy(() => import("./AiWorkbench"));
const EditorialWorkspaceV2 = lazy(() => import("./EditorialWorkspaceV2"));
const CommunityAdmin = lazy(() => import("./CommunityAdmin"));
const PublishCenter = lazy(() => import("./PublishCenter"));

const productionSections = [
  "Gösterge Paneli",
  "Video Arşivi",
  "Altyazı Araştırma",
  "AI Atölyesi",
  "Kayıt Dosyaları",
] as const;

const systemSections = [
  "Topluluk",
  "Yayınlama",
  "Ayarlar",
] as const;

const sections = [...productionSections, ...systemSections] as const;

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
    if (section === "Muhataplar") {
      requestEditorialMode("characters");
      setActive("Kayıt Dosyaları");
      return;
    }
    setActive(section);
  };
  const selectProject = async (id: string) => {
    if (!bridge || projectBusy || !id || id === activeProjectId) return;
    setProjectBusy(true);
    try {
      await bridge.channelProjectSelect({ id });
      // Proje seçimi Electron tarafından yeniden başlatılarak uygulanır.
    } catch (reason) {
      setError(`Proje değiştirilemedi: ${errorText(reason)}`);
      setProjectBusy(false);
    }
  };
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

  if (!ready) return <div className="pipeline-loading"><span>Channel Foundry Studio</span><strong>Yerel üretim alanı hazırlanıyor…</strong></div>;
  return <div className="studio-shell pipeline-shell">
    <aside className="studio-sidebar pipeline-sidebar">
      <Brand/>
      <div className="nav-caption">ÜRETİM</div>
      <nav className="studio-nav">{productionSections.map((section) => <button key={section} className={active === section ? "active" : ""} onClick={() => activateSection(section)}><span>{section}</span></button>)}</nav>
      <div className="nav-caption system-caption">SİSTEM</div>
      <nav className="studio-nav">{systemSections.map((section) => <button key={section} className={active === section ? "active" : ""} onClick={() => setActive(section)}><span>{section}</span></button>)}</nav>
      <div className="local-badge"><span className="local-dot"/> SQLite çalışma alanı</div>
    </aside>
    <main className="studio-main pipeline-main">
      <StudioTopbar section={active} projects={projects} activeProjectId={activeProjectId} busy={projectBusy} activeChannel={channels.find((entry) => entry.id === activeChannelId) || null} onProjectChange={(id) => void selectProject(id)} onManage={() => setActive("Ayarlar")}/>
      {error && active !== "AI Atölyesi" && <div className="storage-warning">Studio uyarısı: {error}</div>}
      <section className="studio-content pipeline-content">
        <Suspense fallback={<SectionLoading section={active}/> }>
          {active === "Gösterge Paneli" && <Dashboard items={studioItems} relations={relations} catalog={catalogStats} catalogVideos={catalogVideos} aiStats={aiStats} mergeStatus={mergeStatus} workspaceNodes={workspaceNodes} workspaceStatus={workspaceStatus} publicationInfo={publicationInfo} onNavigate={activateSection}/>}
          {active === "Video Arşivi" && <VideoArchive/>}
          {active === "Altyazı Araştırma" && <SubtitleResearch/>}
          {active === "AI Atölyesi" && <AiWorkbench pipelineError={error}/>}
          {active === "Kayıt Dosyaları" && <EditorialWorkspaceV2 nodes={workspaceNodes} legacyItems={studioItems} legacyRelations={relations} onReload={load} onCreate={() => setShowCreate(true)}/>}
          {active === "Topluluk" && <CommunityAdmin/>}
          {active === "Yayınlama" && <PublishCenter items={studioItems} relations={relations} workspaceNodes={workspaceNodes} workspaceStatus={workspaceStatus}/>}
          {active === "Ayarlar" && <Settings databaseInfo={databaseInfo} catalog={catalogStats} workspaceStatus={workspaceStatus}/>}
        </Suspense>
      </section>
    </main>
    {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={(kind) => void createDraft(kind)}/>} 
  </div>;
}

function Brand() {
  return <div className="studio-brand">
    <div className="studio-brand-logo-frame">
      <img className="studio-brand-logo" src={studioLogoUrl} alt="Channel Foundry Studio"/>
    </div>
  </div>;
}

function SectionLoading({ section }: { section: Section }) {
  return <div className="pipeline-loading"><span>{section}</span><strong>Çalışma alanı hazırlanıyor…</strong></div>;
}

type SettingsTab = "project" | "ai" | "community" | "data";
const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "project", label: "Kanal ve yayın" },
  { id: "ai", label: "AI servisleri" },
  { id: "community", label: "Topluluk" },
  { id: "data", label: "Yerel veri" },
];
function Settings({ databaseInfo, catalog, workspaceStatus }: { databaseInfo: StudioDatabaseInfo | null; catalog: StudioYoutubeCatalogStats; workspaceStatus: StudioUniverseWorkspaceStatus | null }) {
  const [tab, setTab] = useState<SettingsTab>("project");
  const manualItemCount = Math.max(0, (databaseInfo?.itemCount ?? 0) - catalog.imported);
  return <div className="settings-page settings-compact">
    <nav className="studio-settings-tabs" aria-label="Ayarlar bölümleri">
      {settingsTabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>
    <div className="studio-settings-surface">
      {tab === "project" && <ChannelProjectsSettings/>}
      {tab === "ai" && <AiProviderSettings/>}
      {tab === "community" && <CommunityAdminSettings/>}
      {tab === "data" && <div className="studio-settings-data">
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
      </div>}
    </div>
  </div>;
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: (kind: ItemKind) => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="create-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-head"><div><small>MANUEL İÇERİK</small><h2>AI evreninden bağımsız ne eklemek istiyorsun?</h2></div><button onClick={onClose}>×</button></div><div className="create-grid"><button onClick={() => onCreate("video")}><span>KY</span><strong>Kayıt</strong><small>Manuel editoryal kayıt</small></button><button onClick={() => onCreate("character")}><span>MH</span><strong>Muhatap</strong><small>Kişi, tanık veya varlık</small></button><button onClick={() => onCreate("event")}><span>OL</span><strong>Olay</strong><small>Timeline düğümü</small></button><button onClick={() => onCreate("file")}><span>DS</span><strong>Dosya</strong><small>Not veya araştırma belgesi</small></button></div></div></div>;
}
