"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const src = path.join(__dirname, "src");
const read = (name) => fs.readFileSync(path.join(src, name), "utf8");

const appearanceModule = { exports: {} };
let saved = JSON.stringify({ theme: "light", textSize: "large" });
const root = { dataset: {}, style: {} };
const emitted = [];
const js = ts.transpileModule(read("studio-appearance.ts"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(js, {
  exports: appearanceModule.exports,
  module: appearanceModule,
  localStorage: { getItem: () => saved, setItem: (_key, value) => { saved = value; } },
  document: { documentElement: root },
  window: { dispatchEvent: (event) => emitted.push(event) },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
});
const api = appearanceModule.exports;
const legacy = api.readStudioAppearance();
assert.equal(legacy.theme, "light");
assert.equal(legacy.textSize, "large");
assert.equal(legacy.density, "balanced");
assert.equal(legacy.readingWidth, "medium");
assert.equal(legacy.accent, "gold");

const next = api.saveStudioAppearance({
  ...legacy, theme: "soft-dark", accent: "blue", density: "compact",
  readingWidth: "narrow", contrast: "high", motion: "reduced",
});
for (const [field, expected] of Object.entries({
  studioTheme: "soft-dark", studioTextSize: "large", studioAccent: "blue",
  studioDensity: "compact", studioReadingWidth: "narrow",
  studioContrast: "high", studioMotion: "reduced",
})) assert.equal(root.dataset[field], expected);
assert.equal(root.style.colorScheme, "dark");
assert.equal(api.readStudioAppearance().accent, "blue");
assert.equal(JSON.parse(saved).motion, "reduced");
assert.equal(emitted[0].type, "channel-foundry:studio-appearance");
assert.equal(next.readingWidth, "narrow");

const fallback = api.normalizeStudioAppearance({
  theme: "pink", density: "unlisted", contrast: "maximum",
});
assert.equal(fallback.theme, "dark");
assert.equal(fallback.density, "balanced");
assert.equal(fallback.contrast, "normal");

const controls = read("AppearanceSettings.tsx");
const tokens = read("studio-theme-tokens.css");
const workspace = read("studio-workspace-system.css");
const main = read("main.tsx");
const dashboard = read("Dashboard.tsx");
const research = read("SubtitleResearch.tsx");
const activity = read("AiActivityMonitor.tsx");
const workbench = read("AiWorkbench.tsx");
const topbar = read("StudioTopbar.tsx");

for (const option of ["soft-dark", "gold", "blue", "green", "neutral", "compact", "balanced", "spacious",
  "narrow", "medium", "wide", "high", "reduced"]) {
  assert.ok(controls.includes(`"${option}"`), "Appearance setting missing: " + option);
}
for (const field of ["studioTheme", "studioTextSize", "studioAccent", "studioDensity", "studioReadingWidth", "studioContrast", "studioMotion"]) {
  assert.ok(read("studio-appearance.ts").includes("dataset." + field), "Root appearance value missing: " + field);
}
assert.match(tokens, /data-studio-theme="soft-dark"/);
assert.match(tokens, /data-studio-accent="blue"/);
assert.match(tokens, /data-studio-contrast="high"/);
assert.match(workspace, /--studio-workspace-width:100%/);
assert.ok(!workspace.includes("--studio-workspace-width:1440px"), "retired workspace cap must not return");
assert.match(workspace, /--studio-reading-measure:74ch/);
assert.match(workspace, /data-studio-density="compact"/);
assert.match(workspace, /data-studio-motion="reduced"/);
assert.match(workspace, /\.subtitle-advanced-filters/);
assert.match(main, /import "\.\/studio-workspace-system.css";/);
assert.ok(main.indexOf("studio-workspace-system.css") > main.indexOf("studio-theme-bindings.css"));
assert.ok(!research.includes("subtitle-research-hero panel"), "Large research hero should be removed");
assert.match(research, /<details className="subtitle-advanced-filters">/);
assert.match(research, /<\/details>/);
assert.match(dashboard, /\{note && <small>\{note\}<\/small>\}/);
assert.ok(!dashboard.includes("ops-footnote"), "Dashboard footnote should be removed");
assert.match(activity, /summary\.errors > 0 \|\| summary\.queue > 0/);
assert.ok(!activity.includes("ai-activity-helper"), "AI idle helper copy should not occupy space");
assert.ok(!topbar.includes("CHANNEL FOUNDRY / STUDIO"), "Global topbar should not repeat the sidebar brand");
assert.ok(!workbench.includes("<small>EVREN</small>"), "AI stages should show action names without duplicate categories");
assert.match(workbench, /stats\.analyzed > 0 \|\| videoQueue > 0/, "AI stage status should be conditional");
assert.match(workspace, /studio-topbar-global\{min-height:56px/, "Topbar height should be consistent");

console.log("Studio workspace design: appearance persistence, themes, layout, density and compact content PASS");
