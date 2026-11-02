import { useEffect, useRef, useState } from "react";
import AppearanceSettings from "./AppearanceSettings";
import StudioIcon from "./StudioIcon";
import YtDlpSettings from "./YtDlpSettings";

type Panel = "appearance" | "download" | null;
type Props = {
  section: string;
  projects: StudioChannelProject[];
  activeProjectId: string;
  busy: boolean;
  activeChannel: StudioYoutubeChannel | null;
  onProjectChange: (id: string) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

function sameSource(project: StudioChannelProject | undefined, channel: StudioYoutubeChannel | null) {
  if (!project?.youtubeChannelUrl || !channel) return false;
  const strip = (value: string) => value.replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/$/, "").toLowerCase();
  return strip(project.youtubeChannelUrl) === strip(channel.url)
    && (project.youtubePlaylistUrl || "") === (channel.playlistUrl || "");
}

export default function StudioTopbar({ section, projects, activeProjectId, busy, activeChannel, onProjectChange, sidebarCollapsed, onToggleSidebar }: Props) {
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
    <button
      className={`studio-sidebar-toggle${sidebarCollapsed ? " collapsed" : ""}`}
      type="button"
      aria-label={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
      aria-expanded={!sidebarCollapsed}
      aria-controls="studio-primary-sidebar"
      title={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
      onClick={onToggleSidebar}
    ><StudioIcon name="panel-left"/></button>
    <div className="studio-topbar-title">
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
      <div className="studio-toolbar-anchor">
        <button className={`studio-toolbar-button ${open === "download" ? "selected" : ""}`} type="button" aria-label="yt-dlp yönetimi" aria-expanded={open === "download"} title="yt-dlp yönetimi" onClick={() => setOpen(open === "download" ? null : "download")}><StudioIcon name="download"/><i className={`studio-toolbar-indicator ${toolTone}`}/></button>
        {open === "download" && <div className="studio-toolbar-popover studio-toolbar-download" role="dialog" aria-label="yt-dlp yönetimi"><YtDlpSettings/></div>}
      </div>
      <div className="studio-toolbar-anchor">
        <button className={`studio-toolbar-button ${open === "appearance" ? "selected" : ""}`} type="button" aria-label="Studio görünümü" aria-expanded={open === "appearance"} title="Studio görünümü" onClick={() => setOpen(open === "appearance" ? null : "appearance")}><StudioIcon name="appearance"/></button>
        {open === "appearance" && <div className="studio-toolbar-popover studio-toolbar-appearance" role="dialog" aria-label="Studio görünümü"><AppearanceSettings/></div>}
      </div>
    </div>
  </header>;
}
