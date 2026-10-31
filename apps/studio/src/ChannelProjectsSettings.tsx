import { useEffect, useState, type FormEvent } from "react";

type ProjectInput = {
  id: string;
  displayName: string;
  youtubeChannelUrl: string;
  webRepository: string;
  webUrl: string;
  hostingProvider: string;
};
type Bridge = NonNullable<typeof window.channelFoundryStudio>;

const blank = (): ProjectInput => ({
  id: "", displayName: "", youtubeChannelUrl: "",
  webRepository: "", webUrl: "", hostingProvider: "",
});
function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
export default function ChannelProjectsSettings() {
  const bridge = window.channelFoundryStudio as Bridge | undefined;
  const [projects, setProjects] = useState<StudioChannelProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [newProject, setNewProject] = useState(false);
  const [fields, setFields] = useState<ProjectInput>(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    if (!bridge) return;
    const result = await bridge.channelProjects();
    setProjects(result.projects);
    setActiveId(result.activeId);
    return result;
  };
  useEffect(() => {
    void load().then((result) => {
      if (result?.activeId) selectEditor(result.activeId, result.projects);
    }).catch((reason) => setError(errorText(reason)));
    return bridge?.onDataChanged?.(() => {
      void load().catch((reason) => setError(errorText(reason)));
    });
  }, []);

  const selectEditor = (id: string, source: StudioChannelProject[] = projects) => {
    const project = source.find((entry) => entry.id === id);
    if (!project) return;
    setEditingId(id);
    setNewProject(false);
    setFields({
      id: project.id,
      displayName: project.displayName,
      youtubeChannelUrl: project.youtubeChannelUrl,
      webRepository: project.webRepository,
      webUrl: project.webUrl,
      hostingProvider: project.hostingProvider,
    });
    setError("");
    setNotice("");
  };
  const changeField = (field: keyof ProjectInput, value: string) => {
    setFields((current) => ({ ...current, [field]: value }));
    setNotice("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!bridge || busy) return;
    setBusy(true);
    setError("");
    try {
      const project = newProject
        ? await bridge.channelProjectCreate(fields)
        : await bridge.channelProjectUpdate(fields);
      const result = await load();
      selectEditor(project.id, result?.projects);
      setNotice(newProject ? "Kanal projesi oluşturuldu. Kullanmak için etkinleştir." : "Proje ayarları kaydedildi.");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  const activate = async (id: string) => {
    if (!bridge || busy || !id || id === activeId) return;
    setBusy(true);
    setError("");
    try {
      const result = await bridge.channelProjectSelect({ id });
      if (!result.changed) {
        setBusy(false);
        return;
      }
      setNotice("Proje değiştiriliyor. Studio seçilen kanalın çalışma alanıyla yeniden açılacak.");
      // Backend uygulamayı yeniden açar; burada ikinci bir veri yükleme yapılmaz.
    } catch (reason) {
      setError(errorText(reason));
      setBusy(false);
    }
  };
  if (!bridge) return null;

  return <section className="panel channel-projects-panel">
    <header>
      <div><small>ÇALIŞMA ALANI</small><h2>Kanal projeleri</h2></div>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => {
        setNewProject(true); setEditingId(""); setFields(blank()); setError(""); setNotice("");
      }}>Yeni proje</button>
    </header>
    <p className="channel-projects-intro">Her kanalın araştırma, AI, altyazı ve yayın çalışma verisi birbirinden ayrıdır. Web siteleri kendi Git reposunda yönetilir.</p>
    <div className="channel-projects-grid">
      <div className="channel-projects-list">
        {projects.map((project) => <div className={`channel-project-entry${editingId === project.id ? " selected" : ""}`} key={project.id}>
          <button type="button" onClick={() => selectEditor(project.id)} disabled={busy}>
            <strong>{project.displayName}</strong>
            <small>{project.id}{activeId === project.id ? " · Etkin" : ""}</small>
          </button>
          {activeId !== project.id && <button className="channel-project-activate" type="button" disabled={busy} onClick={() => void activate(project.id)}>Aç</button>}
        </div>)}
        {!projects.length && <span className="channel-projects-empty">Henüz proje tanımlanmadı.</span>}
      </div>
      {(editingId || newProject) && <form className="channel-projects-editor" onSubmit={(event) => void save(event)}>
        <div className="channel-projects-editor-title">
          <strong>{newProject ? "Yeni kanal" : fields.displayName}</strong>
          {!newProject && editingId === activeId && <span>Etkin proje</span>}
        </div>
        <div className="channel-projects-fields">
          <label><span>Proje kodu</span><input value={fields.id} disabled={!newProject || busy} onChange={(event) => changeField("id", event.target.value.toLowerCase())} placeholder="ornek-kanal" required /></label>
          <label><span>Görünen ad</span><input value={fields.displayName} disabled={busy} onChange={(event) => changeField("displayName", event.target.value)} placeholder="Kanal adı" required /></label>
          <label><span>YouTube kanalı</span><input type="url" value={fields.youtubeChannelUrl} disabled={busy} onChange={(event) => changeField("youtubeChannelUrl", event.target.value)} placeholder="https://www.youtube.com/@kanal" /></label>
          <label><span>Web repo adresi</span><input type="url" value={fields.webRepository} disabled={busy} onChange={(event) => changeField("webRepository", event.target.value)} placeholder="https://github.com/hesap/site" /></label>
          <label><span>Web alan adı (yayın hedefi)</span><input type="url" value={fields.webUrl} disabled={busy} onChange={(event) => changeField("webUrl", event.target.value)} placeholder="https://yenialanadi.com" /></label>
          <label><span>Hosting</span><input value={fields.hostingProvider} disabled={busy} onChange={(event) => changeField("hostingProvider", event.target.value)} placeholder="Natro" /></label>
        </div>
        <div className="channel-projects-actions">
          <small>Alan adı boş bırakılabilir. Proje oluşturmak hiçbir dosyayı sunucuya yüklemez.</small>
          <button type="submit" className="primary-button" disabled={busy || !fields.displayName.trim() || !fields.id.trim()}>{busy ? "İşleniyor…" : newProject ? "Projeyi oluştur" : "Kaydet"}</button>
        </div>
      </form>}
    </div>
    {error && <p className="channel-projects-error">{error}</p>}
    {notice && <p className="channel-projects-notice">{notice}</p>}
  </section>;
}
