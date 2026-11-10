export type StudioIconName =
  | "dashboard"
  | "video"
  | "subtitles"
  | "sparkles"
  | "records"
  | "scene"
  | "vefk"
  | "community"
  | "publish"
  | "settings"
  | "panel-left"
  | "download"
  | "appearance";

type Props = {
  name: StudioIconName;
  className?: string;
  size?: number;
};

export default function StudioIcon({ name, className, size = 20 }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    focusable: false,
  };

  switch (name) {
    case "dashboard":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/></svg>;
    case "video":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>;
    case "subtitles":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h2m3 0h5M7 14h4m3 0h3"/></svg>;
    case "sparkles":
      return <svg {...common}><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>;
    case "records":
      return <svg {...common}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>;
    case "scene":
      return <svg {...common}><path d="M3 19V5h18v14H3z"/><path d="M7 14l3-4 3 3 2-2 3 4"/><circle cx="16" cy="8" r="1.2"/></svg>;
    case "vefk":
      return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="1.8"/><path d="M9.2 3.5v17m5.6-17v17M3.5 9.2h17m-17 5.6h17"/><path d="m9.4 9.4 5.2 5.2m0-5.2-5.2 5.2"/></svg>;
    case "community":
      return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case "publish":
      return <svg {...common}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>;
    case "settings":
      return <svg {...common}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/></svg>;
    case "panel-left":
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M16 9l-3 3 3 3"/></svg>;
    case "download":
      return <svg {...common}><path d="M12 3v11m-4-4 4 4 4-4"/><path d="M4 16v4h16v-4M4 6h4m8 0h4"/></svg>;
    case "appearance":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c2 0 3-2 2-3.5-.7-1.3.4-2.5 2-2.5h2a3 3 0 0 0 3-3"/><circle cx="8" cy="9" r=".8" fill="currentColor"/><circle cx="13" cy="7" r=".8" fill="currentColor"/><circle cx="7" cy="14" r=".8" fill="currentColor"/></svg>;
    default:
      return null;
  }
}
