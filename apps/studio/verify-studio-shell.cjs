"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const ts = require("typescript");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadShellModule({ stored = null, narrowViewport = false } = {}) {
  const file = path.join(root, "src/studio-shell.ts");
  assert.ok(fs.existsSync(file), "studio-shell.ts must exist");
  const module = { exports: {} };
  const writes = [];
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports: module.exports,
    module,
    localStorage: {
      getItem: (key) => (key === "channel-foundry:studio-sidebar-v1" ? stored : null),
      setItem: (key, value) => { writes.push([key, value]); },
    },
    window: {
      matchMedia: (query) => ({ matches: query === "(max-width: 1180px)" && narrowViewport }),
    },
  });
  return { api: module.exports, writes };
}

const wide = loadShellModule({ narrowViewport: false }).api;
assert.equal(wide.initialSidebarMode(), "expanded", "wide screens default to expanded without a saved preference");

const narrow = loadShellModule({ narrowViewport: true }).api;
assert.equal(narrow.initialSidebarMode(), "collapsed", "narrow screens default to collapsed without a saved preference");

const savedCollapsed = loadShellModule({ stored: "collapsed", narrowViewport: false }).api;
assert.equal(savedCollapsed.initialSidebarMode(), "collapsed", "saved collapsed preference beats a wide viewport");

const savedExpanded = loadShellModule({ stored: "expanded", narrowViewport: true }).api;
assert.equal(savedExpanded.initialSidebarMode(), "expanded", "saved expanded preference beats a narrow viewport");

const invalid = loadShellModule({ stored: "wide-ish", narrowViewport: false }).api;
assert.equal(invalid.initialSidebarMode(), "expanded", "invalid preference falls back to the viewport default");

const saving = loadShellModule();
assert.equal(saving.api.saveSidebarMode("collapsed"), "collapsed");
assert.deepEqual(saving.writes, [["channel-foundry:studio-sidebar-v1", "collapsed"]], "saving persists only the device-level sidebar mode");

function decodeRgbaPng(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG", `${file} must be a PNG`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  const interlace = buffer[28];
  assert.equal(bitDepth, 8, `${file} must be 8-bit`);
  assert.equal(colorType, 6, `${file} must carry an alpha channel (RGBA)`);
  assert.equal(interlace, 0, `${file} must not be interlaced`);
  let offset = 8;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
    if (type === "IEND") break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = row[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }
  return { width, height, pixels };
}

const brandDir = path.join(root, "src/assets/brand");
const sourceFile = path.join(brandDir, "source", "logo1-source.png");
assert.ok(fs.existsSync(sourceFile), `source logo must be preserved at ${sourceFile}`);
const sourceImage = decodeRgbaPng(sourceFile);
assert.deepEqual([sourceImage.width, sourceImage.height], [1254, 1254], "source logo keeps its original 1254x1254 geometry");
const sourceBytes = fs.statSync(sourceFile).size;
assert.ok(sourceBytes > 400000, "source logo must be the original high-resolution asset");
assert.equal(sourceImage.pixels[3], 0, "source logo must use real transparency, not a baked white canvas");

const brandFiles = {
  full: path.join(brandDir, "yayin-atolyesi-logo.png"),
  mark: path.join(brandDir, "yayin-atolyesi-mark.png"),
};
for (const [name, file] of Object.entries(brandFiles)) {
  assert.ok(fs.existsSync(file), `${name} brand asset must exist at ${file}`);
}
const fullLogo = decodeRgbaPng(brandFiles.full);
const mark = decodeRgbaPng(brandFiles.mark);
assert.ok(fullLogo.width > 700 && fullLogo.width < 820, "full logo must be cropped from the source, not upscaled");
assert.ok(fullLogo.height > 600 && fullLogo.height < 720, "full logo must include the stacked emblem and wordmark content");
assert.ok(fullLogo.width / fullLogo.height > 1 && fullLogo.width / fullLogo.height < 1.25, "full logo keeps the stacked source ratio");
assert.ok(mark.width > 390 && mark.width < 450, "mark must crop the standalone emblem at source resolution");
assert.ok(mark.height > 370 && mark.height < 430, "mark must crop the standalone emblem height at source resolution");
assert.ok(Math.abs(mark.width - mark.height) < 35, "mark must stay close to the square emblem ratio");
for (const [name, image] of Object.entries({ fullLogo, mark })) {
  let minAlpha = 255;
  let maxAlpha = 0;
  for (let index = 3; index < image.pixels.length; index += 4) {
    minAlpha = Math.min(minAlpha, image.pixels[index]);
    maxAlpha = Math.max(maxAlpha, image.pixels[index]);
  }
  assert.equal(minAlpha, 0, `${name} must have fully transparent pixels, not an embedded white or black canvas`);
  assert.equal(maxAlpha, 255, `${name} must keep the opaque brand marks`);
  for (const [x, y] of [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]) {
    assert.equal(image.pixels[(y * image.width + x) * 4 + 3], 0, `${name} corner must be transparent`);
  }
  for (let x = 0; x < image.width; x += 1) {
    assert.equal(image.pixels[x * 4 + 3], 0, `${name} top border must keep transparent breathing room`);
    assert.equal(image.pixels[((image.height - 1) * image.width + x) * 4 + 3], 0, `${name} bottom border must keep transparent breathing room`);
  }
  for (let y = 0; y < image.height; y += 1) {
    assert.equal(image.pixels[(y * image.width) * 4 + 3], 0, `${name} left border must keep transparent breathing room`);
    assert.equal(image.pixels[(y * image.width + image.width - 1) * 4 + 3], 0, `${name} right border must keep transparent breathing room`);
  }
}
for (const [name, file] of Object.entries(brandFiles)) {
  const size = fs.statSync(file).size;
  assert.ok(size < sourceBytes, `${name} must be a cropped derivative, not the full source canvas`);
}
assert.ok(!fs.existsSync(path.join(brandDir, "channel-foundry-logo.png")), "retired ChannelFoundry logo derivative must be removed");
assert.ok(!fs.existsSync(path.join(brandDir, "channel-foundry-logo-light.png")), "retired light logo derivative must be removed");
assert.ok(!fs.existsSync(path.join(brandDir, "channel-foundry-mark.png")), "retired ChannelFoundry mark must be removed");

const assets = read("src/studio-assets.ts");
for (const exported of ["studioLogoUrl", "studioLogoMarkUrl"]) {
  assert.match(assets, new RegExp(`export const ${exported}`), `missing ${exported}`);
}
assert.ok(!assets.includes("studioLogoLightUrl"), "the dark wordmark image variant is no longer needed");
assert.match(read("src/main.tsx"), /studioLogoMarkUrl/);

const pipeline = read("src/StudioPipeline.tsx");
const topbar = read("src/StudioTopbar.tsx");
const iconSource = read("src/StudioIcon.tsx");
for (const name of ["dashboard", "video", "subtitles", "sparkles", "records", "community", "publish", "settings", "panel-left", "download", "appearance"]) {
  assert.ok(iconSource.includes(`"${name}"`), `shared icon family is missing ${name}`);
}
assert.match(iconSource, /viewBox: "0 0 24 24"/);
assert.match(iconSource, /strokeWidth: 1\.7/);
for (const section of ["Gösterge Paneli", "Video Arşivi", "Altyazı Araştırma", "AI Atölyesi", "Kayıt Dosyaları", "Topluluk", "Yayınlama", "Ayarlar"]) {
  assert.ok(pipeline.includes(`"${section}"`), `sidebar is missing ${section}`);
  assert.ok(pipeline.includes(`data-section="${section}"`) || pipeline.includes(`section="${section}"`) || pipeline.includes(`section: "${section}"`) || pipeline.includes(`"${section}":`), `sidebar item ${section} must be rendered from the shared item component`);
}
assert.match(pipeline, /initialSidebarMode/);
assert.match(pipeline, /saveSidebarMode/);
assert.match(pipeline, /studio-sidebar-\$\{effectiveSidebarMode\}/);
assert.doesNotMatch(pipeline, /sceneSidebarExpanded/, 'Scene and Records do not force sidebar collapse');
assert.match(pipeline, /effectiveSidebarMode: StudioSidebarMode = sidebarMode/, 'All workspaces retain the same saved sidebar state');
assert.match(pipeline, /aria-current=\{active \? "page" : undefined\}/);
assert.match(pipeline, /aria-label=\{collapsed \? section : undefined\}/);
assert.match(pipeline, /data-tooltip=\{section\}/);
assert.match(pipeline, /id="studio-primary-sidebar"/);
assert.match(pipeline, /<Brand collapsed=\{effectiveSidebarMode === "collapsed"\}\/>/);
assert.match(pipeline, /studio-settings-nav/);
assert.match(pipeline, /studio-nav-label/);
assert.match(pipeline, /studio-brand-copy/);
assert.match(pipeline, /studio-brand-name[^>]*>Yayın Atölyesi</);
assert.match(pipeline, /studio-brand-subtitle[^>]*>STÜDYO</);
assert.match(pipeline, /aria-label="Yayın Atölyesi"/);
assert.ok(!pipeline.includes("studio-brand-logo"), "sidebar brand must use the emblem plus CSS wordmark, not a baked wordmark image");
assert.ok(!pipeline.includes("Channel Foundry Studio"), "user-visible Studio identity must be Yayın Atölyesi");
assert.match(topbar, /sidebarCollapsed: boolean/);
assert.match(topbar, /onToggleSidebar: \(\) => void/);
assert.match(topbar, /aria-controls="studio-primary-sidebar"/);
assert.match(topbar, /aria-expanded=\{!sidebarCollapsed\}/);
assert.match(topbar, /<StudioIcon name="panel-left"/);
assert.ok(!topbar.includes("function Icon("), "topbar must consume the shared icon family instead of a local copy");

const workspaceSystem = read("src/studio-workspace-system.css");
const fixedViewport = read("src/studio-fixed-viewport.css");
const topbarCss = read("src/studio-topbar.css");
const layoutCss = read("src/studio-layout.css");
const nextCss = read("src/studio-next.css");
const themeTokens = read("src/studio-theme-tokens.css");
const themeBindings = read("src/studio-theme-bindings.css");
assert.match(workspaceSystem, /--studio-workspace-width:\s*100%/);
assert.ok(!workspaceSystem.includes("--studio-workspace-width:1440px"), "the retired 1440px workspace cap must be removed");
assert.match(workspaceSystem, /--studio-shell-gap:clamp\(/);
assert.match(workspaceSystem, /--studio-workspace-inset:clamp\(/);
assert.match(workspaceSystem, /--studio-sidebar-expanded:\s*2\d\dpx/);
assert.match(workspaceSystem, /--studio-sidebar-collapsed:\s*(5[6-9]|6[0-4])px/);
assert.match(fixedViewport, /grid-template-columns:var\(--studio-sidebar-width\) minmax\(0,1fr\)/);
assert.match(fixedViewport, /studio-sidebar-collapsed\{--studio-sidebar-width:var\(--studio-sidebar-collapsed\)/);
assert.match(fixedViewport, /studio-sidebar-expanded\{--studio-sidebar-width:var\(--studio-sidebar-expanded\)/);
assert.match(fixedViewport, /\.pipeline-sidebar\{[\s\S]*?width:100%/, "sidebar must fill its grid track so the collapsed rail cannot overlap the workspace");
assert.match(fixedViewport, /\.studio-main\.pipeline-main\{[\s\S]*?padding:var\(--studio-shell-gap\)!important/);
assert.match(fixedViewport, /\.studio-content\.pipeline-content\{[\s\S]*?width:100%;[\s\S]*?padding:var\(--studio-workspace-inset\)/);
assert.match(fixedViewport, /border:1px solid var\(--border-soft\)/);
assert.match(fixedViewport, /box-shadow:var\(--shadow-workspace\)/);
assert.match(fixedViewport, /studio-sidebar-collapsed \.studio-nav-label/);
assert.match(fixedViewport, /display:none/);
assert.match(fixedViewport, /studio-sidebar-collapsed \.nav-caption/);
assert.match(fixedViewport, /studio-sidebar-collapsed \.studio-settings-nav\{[\s\S]*?border-top:0/);
assert.match(fixedViewport, /studio-nav button::after\{[\s\S]*?content:attr\(data-tooltip\)/);
assert.match(fixedViewport, /studio-nav button:hover::after/);
assert.match(fixedViewport, /studio-nav button:focus-visible::after/);
assert.match(topbarCss, /grid-template-columns:auto minmax\(0,1fr\) auto/);
assert.match(topbarCss, /\.studio-sidebar-toggle\{/);
assert.match(topbarCss, /\.studio-sidebar-toggle\.collapsed svg\{transform:rotate\(180deg\)\}/);
assert.match(topbarCss, /\.studio-topbar-global\{[\s\S]*?min-height:56px/);
assert.match(topbarCss, /@media\(max-width:1180px\)/);
assert.match(layoutCss, /\.studio-brand \{[\s\S]*?flex-direction: column;/, "expanded brand must stack the emblem above the wordmark");
assert.match(layoutCss, /\.studio-brand-mark \{[\s\S]*?width: 42px;[\s\S]*?height: 42px;/, "expanded brand emblem must stay compact");
assert.match(layoutCss, /\.studio-brand-name \{[\s\S]*?color: var\(--text-primary\);/, "brand wordmark must follow the active theme text color");
assert.match(layoutCss, /\.studio-brand-subtitle \{[\s\S]*?color: var\(--accent-strong\);/, "STÜDYO subtitle must stay gold in every theme");
assert.match(fixedViewport, /studio-sidebar-collapsed \.studio-brand-copy\{display:none\}/);
assert.match(fixedViewport, /studio-sidebar-collapsed \.studio-brand-mark\{[\s\S]*?width:32px/, "collapsed brand must center a smaller emblem");
assert.ok(!layoutCss.includes("studio-brand-logo"), "baked wordmark image styles must be retired");
assert.match(nextCss, /body\{margin:0;min-width:0/);
assert.match(themeTokens, /--shadow-workspace:/);
assert.match(themeTokens, /--studio-brand-shadow:/);
assert.match(themeBindings, /\.studio-nav button\.active\{[\s\S]*?box-shadow:inset 3px 0 var\(--accent\)/);
assert.match(themeBindings, /\.studio-nav button\.active \.studio-nav-icon\{[\s\S]*?color:var\(--accent-strong\)/);

const indexHtml = read("index.html");
assert.match(indexHtml, /<title>Yayın Atölyesi<\/title>/, "browser window title must use the new brand");
assert.ok(!indexHtml.includes("Channel Foundry Studio"), "browser window title must no longer expose the old identity");
const electronMain = read("main.cjs");
assert.match(electronMain, /title: "Yayın Atölyesi"/, "Electron window title must use the new brand");
assert.match(electronMain, /showErrorBox\("Yayın Atölyesi"/, "user-visible error dialog must use the new brand");
assert.match(pipeline, /<span>Yayın Atölyesi<\/span>/, "loading screen must use the new brand");

console.log("Studio shell: preference, Yayın Atölyesi brand assets, shared icons, collapse wiring and responsive frame contract PASS");
