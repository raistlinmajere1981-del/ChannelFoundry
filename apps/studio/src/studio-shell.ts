export type StudioSidebarMode = "expanded" | "collapsed";

export const SIDEBAR_STORAGE_KEY = "channel-foundry:studio-sidebar-v1";

function isSidebarMode(value: unknown): value is StudioSidebarMode {
  return value === "expanded" || value === "collapsed";
}

export function readSidebarMode(): StudioSidebarMode | null {
  try {
    const value = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return isSidebarMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function initialSidebarMode(): StudioSidebarMode {
  const stored = readSidebarMode();
  if (stored) return stored;
  try {
    return window.matchMedia("(max-width: 1180px)").matches ? "collapsed" : "expanded";
  } catch {
    return "expanded";
  }
}

export function saveSidebarMode(mode: StudioSidebarMode): StudioSidebarMode {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, mode);
  } catch {
    // A blocked storage backend must not prevent the in-memory toggle.
  }
  return mode;
}
