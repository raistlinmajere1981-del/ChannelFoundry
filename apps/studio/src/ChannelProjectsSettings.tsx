import { useEffect, useState, type FormEvent } from "react";

type ProjectInput = {
  id: string; displayName: string; youtubeChannelUrl: string; youtubePlaylistUrl: string;
  webRepository: string; webUrl: string; hostingProvider: string;
};
const empty = (): ProjectInput => ({
  id: "", displayName: "", youtubeChannelUrl: "", youtubePlaylistUrl: "",
  webRepository: "", webUrl: "", hostingProvider: "",
});
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const normalized = (value: string) => value.trim().replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/$/, "").toLowerCase();
function isLinked(project: StudioChannelProject | undefined, catalog: StudioYoutubeChannel | null) {
  return Boolean(project?.youtubeChannelUrl && catalog
    && normalized(project.youtubeChannelUrl) === normalized(catalog.url)
    && (project.youtubePlaylistUrl || "") === (catalog.playlistUrl || ""));
}

export default function ChannelProjectsSettings() {
  const bridge = window.channelFoundryStudio;
  const [projects, setProjects] = useState<StudioChannelProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editing, setEditing] = useState("");
  const [form, setForm] = useState<ProjectInput>(empty);
  const [scope, setScope] = useState<"channel" | "playlist">("channel");
  const [newProject, setNewProject] = useState(false);
  const [catalog, setCatalog] = useState<StudioYoutubeChannel | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    if (!bridge) return;
    const [result, channel] = await Promise.all([bridge.channelProjects(), bridge.youtubeCatalogActive()]);
    setProjects(result.projects); setActiveId(result.activeId); setCatalog(channel);
    return result;
  };
  const choose = (id: string, list: StudioChannelProject[] = projects) => {
    const project = list.find((entry) => entry.id === id);
    if (!project) return;
    setEditing(id); setNewProject(false);
    setScope(project.youtubePlaylistUrl ? "playlist" : "channel");
    setForm({
      id: project.id, displayName: project.displayName, youtubeChannelUrl: project.youtubeChannelUrl,
      youtubePlaylistUrl: project.youtubePlaylistUrl || "", webRepository: project.webRepository,
      webUrl: project.webUrl, hostingProvider: project.hostingProvider,
    });
    setError(""); setNotice("");
  };
  useEffect(() => {
    void load().then((result) => {
      if (result?.activeId) choose(result.activeId, result.projects);
    }).catch((reason) => setError(message(reason)));
    return bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
  }, []);
  const update = (name: keyof ProjectInput, value: string) => {
    setForm((previous) => ({ ...previous, [name]: value }));
    setNotice(""); setError("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!bridge || busy) return;
    if (scope === "playlist" && !form.youtubePlaylistUrl.trim()) { setError("Playlist bağlantısı gerekli."); return; }
    setBusy("save"); setError(""); setNotice("");
    try {
      const next = newProject ? await bridge.channelProjectCreate(form) : await bridge.channelProjectUpdate(form);
      const result = await load();
      choose(next.id, result?.projects);
      setNotice("Kaydedildi");
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(""); }
  };
  const activate = async (id: string) => {
    if (!bridge || busy || id === activeId) return;
    setBusy("switch"); setError("");
    try { await bridge.channelProjectSelect({ id }); setNotice("Proje açılıyor…"); }
    catch (reason) { setError(message(reason)); setBusy(""); }
  };
  const linkCatalog = async () => {
    if (!bridge || busy || editing !== activeId || !form.youtubeChannelUrl) return;
    // Kaydedilmemiş ayarlarla yanlış kanalın arşivi oluşturulmasın.
    const saved = projects.find((project) => project.id === activeId);
    if (saved?.youtubeChannelUrl !== form.youtubeChannelUrl || saved?.youtubePlaylistUrl !== form.youtubePlaylistUrl) {
      setError("Önce kaynağı kaydet.");
      return;
    }
    setBusy("connect"); setError(""); setNotice("");
    try {
      const result = await bridge.channelProjectConnectSource();
      await load();
      setNotice(result.created ? "YouTube kataloğu hazır" : "YouTube kataloğu bağlandı");
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(""); }
  };
  const testWeb = async () => {
    if (!bridge || busy || !form.webUrl) return;
    setBusy("test"); setError(""); setNotice("");
    try { await bridge.webConnectionTest({ url: form.webUrl }); setNotice("Web bağlantısı hazır"); }
    catch (reason) { setError(message(reason)); }
    finally { setBusy(""); }
  };
  if (!bridge) return null;
  const current = projects.find((project) => project.id === editing);
  const savedSource = current?.youtubeChannelUrl === form.youtubeChannelUrl && current?.youtubePlaylistUrl === form.youtubePlaylistUrl;
  const currentLinked = isLinked(current, catalog);
  return <section className="panel channel-projects-panel">
    <header className="project-compact-header">
      <h2>Kanal ve yayın</h2>
      <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => { setEditing(""); setNewProject(true); setForm(empty()); setScope("channel"); setError(""); setNotice(""); }}>+ Yeni proje</button>
    </header>
    <div className="channel-projects-grid">
      <div className="channel-projects-list">
        {projects.map((project) => <div key={project.id} className={`channel-project-entry ${editing === project.id ? "selected" : ""}`}>
          <button type="button" disabled={Boolean(busy)} onClick={() => choose(project.id)}>
            <strong>{project.displayName}</strong><small>{project.id}{activeId === project.id ? " · Etkin" : ""}</small>
          </button>
          {activeId !== project.id && <button className="channel-project-activate" type="button" disabled={Boolean(busy)} onClick={() => void activate(project.id)}>Aç</button>}
        </div>)}
      </div>
      {(newProject || editing) && <form className="channel-projects-editor" onSubmit={(event) => void save(event)}>
        <div className="project-fields-compact">
          <label><span>Proje adı</span><input required disabled={Boolean(busy)} value={form.displayName} onChange={(event) => update("displayName", event.target.value)}/></label>
          <label><span>Kod</span><input required disabled={!newProject || Boolean(busy)} value={form.id} onChange={(event) => update("id", event.target.value.toLowerCase())}/></label>
        </div>
        <div className="project-field-group">
          <div className="project-group-heading"><h3>YouTube arşivi</h3>{editing === activeId && <span className={currentLinked ? "linked" : ""}>{currentLinked ? "Bağlı" : "Bekliyor"}</span>}</div>
          <label><span>Kanal URL</span><input type="url" disabled={Boolean(busy)} value={form.youtubeChannelUrl} onChange={(event) => { update("youtubeChannelUrl", event.target.value); setScope("channel"); setForm((previous) => ({...previous, youtubeChannelUrl: event.target.value, youtubePlaylistUrl: ""})); }} placeholder="https://www.youtube.com/@kanal"/></label>
          <label><span>Arşiv kapsamı</span><select value={scope} disabled={Boolean(busy)} onChange={(event) => { const next = event.target.value as "channel" | "playlist"; setScope(next); if (next === "channel") update("youtubePlaylistUrl", ""); }}><option value="channel">Tüm kanal</option><option value="playlist">Playlist</option></select></label>
          {scope === "playlist" && <label><span>Playlist URL</span><input type="url" disabled={Boolean(busy)} value={form.youtubePlaylistUrl} onChange={(event) => update("youtubePlaylistUrl", event.target.value)} placeholder="https://www.youtube.com/playlist?list=..."/></label>}
          {editing === activeId && <div className="project-inline-actions"><button type="button" className="secondary-button" disabled={Boolean(busy) || !form.youtubeChannelUrl || !savedSource} onClick={() => void linkCatalog()}>{busy === "connect" ? "Bağlanıyor…" : currentLinked ? "Kataloğu yenile" : "Kataloğu bağla"}</button></div>}
        </div>
        <div className="project-field-group">
          <div className="project-group-heading"><h3>Web yayını</h3><span>{current?.deploymentEnabled ? "Etkin" : "Kapalı"}</span></div>
          <label><span>Alan adı</span><div className="project-input-action"><input type="url" disabled={Boolean(busy)} value={form.webUrl} onChange={(event) => update("webUrl", event.target.value)} placeholder="https://alanadi.com"/><button type="button" className="secondary-button" disabled={Boolean(busy) || !form.webUrl} onClick={() => void testWeb()}>Test</button></div></label>
          <div className="project-fields-compact">
            <label><span>Hosting</span><input disabled={Boolean(busy)} value={form.hostingProvider} onChange={(event) => update("hostingProvider", event.target.value)} placeholder="Natro"/></label>
            <label><span>Web Git deposu</span><input type="url" disabled={Boolean(busy)} value={form.webRepository} onChange={(event) => update("webRepository", event.target.value)} placeholder="https://github.com/..."/></label>
          </div>
        </div>
        <div className="channel-projects-actions">
          <span>{error ? <b className="project-inline-error" role="alert">{error}</b> : notice}</span>
          <button type="submit" className="primary-button" disabled={Boolean(busy) || !form.id.trim() || !form.displayName.trim()}>{busy === "save" ? "Kaydediliyor…" : "Kaydet"}</button>
        </div>
      </form>}
    </div>
  </section>;
}
