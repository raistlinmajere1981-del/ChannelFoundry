import { useEffect, useRef, useState } from "react";
import AppearanceSettings from "./AppearanceSettings";
import YtDlpSettings from "./YtDlpSettings";

type Panel = "appearance" | "download" | null;
type Props = {
  section: string;
  projects: StudioChannelProject[];
  activeProjectId: string;
  busy: boolean;
  activeChannel: StudioYoutubeChannel | null;
  onProjectChange: (id: string) => void;
  onManage: () => void;
};

function Icon({ name }: { name: "appearance" | "download" | "settings" }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "appearance") return <svg {...common} aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c2 0 3-2 2-3.5-.7-1.3.4-2.5 2-2.5h2a3 3 0 0 0 3-3"/><circle cx="8" cy="9" r=".8" fill="currentColor"/><circle cx="13" cy="7" r=".8" fill="currentColor"/><circle cx="7" cy="14" r=".8" fill="currentColor"/></svg>;
  if (name === "download") return <svg {...common} aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4"/><path d="M4 16v4h16v-4"/><path d="M4 6h4m8 0h4"/></svg>;
  return <svg {...common} aria-hidden="true"><path d="M10 3h4l.6 2.5 2 1.2L19 6l2 3.5-1.8 1.7v2L21 15l-2 3.5-2.4-.7-2 1.2L14 21h-4l-.6-2-2-1.2-2.4.7L3 15l1.8-1.8v-2L3 9.5 5 6l2.4.7 2-1.2z"/><circle cx="12" cy="12" r="3"/></svg>;
}

function sameSource(project: StudioChannelProject | undefined, channel: StudioYoutubeChannel | null) {
  if (!project?.youtubeChannelUrl || !channel) return false;
  const strip = (value: string) => value.replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/$/, "").toLowerCase();
  return strip(project.youtubeChannelUrl) === strip(channel.url)
    && (project.youtubePlaylistUrl || "") === (channel.playlistUrl || "");
}

export default function StudioTopbar({ section, projects, activeProjectId, busy, activeChannel, onProjectChange, onManage }: Props) {
  const [open, setOpen] = useState<Panel>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const linked = sameSource(activeProject, activeChannel);
  const [toolStatus, setToolStatus] = useState<StudioYtDlpStatus | null>(null);
  const bridge = window.channelFoundryStudio;
  useEffect(() => {
    const refresh = () => { void bridge?.ytDlpStatus().then(setToolStatus).catch(() => undefined); };
    refresh();
    return bridge?.onYtDlpChanged?.(refresh);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => setOpen(null), [section]);

  const toolTone = toolStatus?.lastError || toolStatus?.phase === "error" ? "error"
    : toolStatus?.updateAvailable ? "warning" : toolStatus?.available ? "ready" : "";

  return <header className="studio-topbar-global">
    <div className="studio-topbar-title">
      <small>CHANNEL FOUNDRY / STUDIO</small>
      <strong>{section}</strong>
    </div>
    <div className="studio-topbar-controls" ref={anchor}>
      <label className="studio-project-picker" title="Aktif kanal projesi">
        <span>Proje</span>
        <select aria-label="Kanal projesini seç" value={activeProjectId} disabled={busy || projects.length === 0} onChange={(event) => onProjectChange(event.target.value)}>
          {projects.map((project) => <option value={project.id} key={project.id}>{project.displayName}</option>)}
        </select>
      </label>
      <div className={`studio-source-chip ${linked ? "linked" : "unlinked"}`} title={linked ? "Proje YouTube kaynağı bağlı" : "Proje YouTube kaynağı henüz kataloğa bağlanmadı"}>
        <span className="studio-source-dot"/>
        <span>{linked ? (activeProject?.youtubePlaylistUrl ? "Playlist bağlı" : "Kanal bağlı") : "Katalog bekliyor"}</span>
      </div>
      <button className="studio-toolbar-button" type="button" title="Kanal ve yayın ayarları" aria-label="Kanal ve yayın ayarları" onClick={onManage}><Icon name="settings"/></button>
      <div className="studio-toolbar-anchor">
        <button className={`studio-toolbar-button ${open === "download" ? "selected" : ""}`} type="button" aria-label="yt-dlp yönetimi" aria-expanded={open === "download"} title="yt-dlp yönetimi" onClick={() => setOpen(open === "download" ? null : "download")}><Icon name="download"/><i className={`studio-toolbar-indicator ${toolTone}`}/></button>
        {open === "download" && <div className="studio-toolbar-popover studio-toolbar-download" role="dialog" aria-label="yt-dlp yönetimi"><YtDlpSettings/></div>}
      </div>
      <div className="studio-toolbar-anchor">
        <button className={`studio-toolbar-button ${open === "appearance" ? "selected" : ""}`} type="button" aria-label="Studio görünümü" aria-expanded={open === "appearance"} title="Studio görünümü" onClick={() => setOpen(open === "appearance" ? null : "appearance")}><Icon name="appearance"/></button>
        {open === "appearance" && <div className="studio-toolbar-popover studio-toolbar-appearance" role="dialog" aria-label="Studio görünümü"><AppearanceSettings/></div>}
      </div>
    </div>
  </header>;
}
