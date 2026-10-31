export type StudioTheme = "dark" | "light" | "soft-dark";
export type StudioTextSize = "standard" | "comfortable" | "large";
export type StudioAccent = "gold" | "blue" | "green" | "neutral";
export type StudioDensity = "compact" | "balanced" | "spacious";
export type StudioReadingWidth = "narrow" | "medium" | "wide";
export type StudioContrast = "normal" | "high";
export type StudioMotion = "normal" | "reduced";

export type StudioAppearance = {
  theme: StudioTheme;
  textSize: StudioTextSize;
  accent: StudioAccent;
  density: StudioDensity;
  readingWidth: StudioReadingWidth;
  contrast: StudioContrast;
  motion: StudioMotion;
};

const STORAGE_KEY = "channel-foundry:studio-appearance-v1";
export const DEFAULT_APPEARANCE: StudioAppearance = {
  theme: "dark", textSize: "comfortable", accent: "gold",
  density: "balanced", readingWidth: "medium", contrast: "normal", motion: "normal",
};

function valueOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && options.includes(value as T) ? value as T : fallback;
}

export function normalizeStudioAppearance(value: Partial<StudioAppearance> | null | undefined): StudioAppearance {
  return {
    theme: valueOf(value?.theme, ["dark", "light", "soft-dark"], DEFAULT_APPEARANCE.theme),
    textSize: valueOf(value?.textSize, ["standard", "comfortable", "large"], DEFAULT_APPEARANCE.textSize),
    accent: valueOf(value?.accent, ["gold", "blue", "green", "neutral"], DEFAULT_APPEARANCE.accent),
    density: valueOf(value?.density, ["compact", "balanced", "spacious"], DEFAULT_APPEARANCE.density),
    readingWidth: valueOf(value?.readingWidth, ["narrow", "medium", "wide"], DEFAULT_APPEARANCE.readingWidth),
    contrast: valueOf(value?.contrast, ["normal", "high"], DEFAULT_APPEARANCE.contrast),
    motion: valueOf(value?.motion, ["normal", "reduced"], DEFAULT_APPEARANCE.motion),
  };
}

export function readStudioAppearance(): StudioAppearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeStudioAppearance(raw ? JSON.parse(raw) as Partial<StudioAppearance> : null);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function applyStudioAppearance(value: StudioAppearance) {
  const normalized = normalizeStudioAppearance(value);
  const root = document.documentElement;
  root.dataset.studioTheme = normalized.theme;
  root.dataset.studioTextSize = normalized.textSize;
  root.dataset.studioAccent = normalized.accent;
  root.dataset.studioDensity = normalized.density;
  root.dataset.studioReadingWidth = normalized.readingWidth;
  root.dataset.studioContrast = normalized.contrast;
  root.dataset.studioMotion = normalized.motion;
  root.style.colorScheme = normalized.theme === "light" ? "light" : "dark";
}

export function saveStudioAppearance(value: StudioAppearance) {
  const normalized = normalizeStudioAppearance(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  applyStudioAppearance(normalized);
  window.dispatchEvent(new CustomEvent("channel-foundry:studio-appearance", { detail: normalized }));
  return normalized;
}
