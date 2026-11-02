# Studio Shell Responsive Polish and Yayın Atölyesi Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Yayın Atölyesi (the ChannelFoundry Studio desktop app) one responsive desktop shell: a collapsible icon sidebar, aligned topbar, transparent Yayın Atölyesi brand assets, and a single full-width workspace frame with independent inner scrolling.

**Architecture:** Keep the existing React shell and semantic token system. Add one device-level sidebar preference module, one shared inline-SVG icon component, transparent derivatives of the new Yayın Atölyesi source logo, and token-driven layout rules in the existing shell CSS files. No page-level layouts or domain behavior change.

**Tech Stack:** React 19, TypeScript, Vite, Electron, plain CSS semantic tokens, Node assertion verifiers.

**Spec:** User requests in this session (Studio common shell and responsive behavior; Yayın Atölyesi brand update, 2026-11-02).

## Global Constraints

- Only the common application shell, responsive behavior, and user-visible branding may change. Do not alter page-specific internal control layouts, YouTube catalog, subtitle archive, AI operations, database behavior, other projects, the assistant, OpenCode server, deployment, migrations, or backups.
- Keep package IDs, folder names, Git repository name, internal module names, database paths, and API identifiers unchanged.
- Preserve all existing appearance preferences and theme choices.
- Reuse existing icon/theme/CSS infrastructure; add no dependency.
- Workspace must never own an outer scroll; lists/editors keep their own scroll containers.
- 1920x1080, 1600x900, 1366x768, 1280x720 and 1024x768 must remain usable without horizontal page scrolling.
- User sidebar preference persists per device and survives app restart and channel-project changes (localStorage, not project state).
- The Yayın Atölyesi brand is one emblem plus a CSS wordmark, not a baked wordmark image. The sidebar shows the emblem; expanded mode adds the name and STÜDYO subtitle, collapsed mode hides them.
- Logo derivatives keep the source proportions and colors, use real alpha, and retain transparent breathing room. No baked background, frame, or extra panel.
- Use the existing ChannelFoundry visual identity and semantic tokens; do not introduce a new visual language.

## Review Focus

- Persisted sidebar mode must be read before first paint or the shell briefly jumps width on launch.
- Toggling the project restarts the Studio process; the preference must not live in project-scoped storage.
- Collapsed navigation must keep accessible names and visible focus rings even though visible text is hidden.
- At 1024x768 the topbar title and controls must not overlap, and the sidebar must default collapsed only when the user has no saved preference.
- The sidebar must fill its grid track so the collapsed rail cannot visually overlap the workspace frame.
- The Yayın Atölyesi emblem must stay legible on dark, light, and soft-dark themes; the wordmark follows the theme text color.
- The workspace frame must stay inside the viewport with inner panes scrolling; no page-level horizontal scrollbar.

---

### Task 1: Sidebar preference persistence

**Files:**
- Create: `apps/studio/src/studio-shell.ts`
- Test: `apps/studio/verify-studio-shell.cjs`

**Interfaces:**
- Produces: `StudioSidebarMode = "expanded" | "collapsed"`, `SIDEBAR_STORAGE_KEY`, `readSidebarMode(): StudioSidebarMode | null`, `initialSidebarMode(): StudioSidebarMode`, `saveSidebarMode(mode): StudioSidebarMode`.
- Test consumes those exact exports through TypeScript transpile + `vm`.

- [x] **Step 1: Write a failing verifier** covering: no preference + wide viewport → expanded; no preference + narrow viewport → collapsed; saved collapsed overrides wide; saved expanded overrides narrow; invalid value falls back; saving writes `channel-foundry:studio-sidebar-v1`.
- [x] **Step 2: Run `node apps/studio/verify-studio-shell.cjs` and confirm it fails because the module does not exist.**
- [x] **Step 3: Implement `studio-shell.ts` with localStorage guarded by try/catch and `matchMedia("(max-width: 1180px)")` only for the no-preference default.**
- [x] **Step 4: Re-run the verifier and confirm preference cases PASS.**

### Task 2: Yayın Atölyesi brand assets and compact sidebar brand

**Files:**
- Create: `apps/studio/src/assets/brand/source/logo1-source.png`
- Create: `apps/studio/src/assets/brand/yayin-atolyesi-logo.png`
- Create: `apps/studio/src/assets/brand/yayin-atolyesi-mark.png`
- Modify: `apps/studio/src/studio-assets.ts`
- Modify: `apps/studio/src/StudioPipeline.tsx`
- Modify: `apps/studio/src/studio-layout.css`
- Modify: `apps/studio/src/studio-fixed-viewport.css`
- Modify: `apps/studio/src/main.tsx`
- Modify: `apps/studio/main.cjs`
- Modify: `apps/studio/index.html`
- Test: `apps/studio/verify-studio-shell.cjs`

**Interfaces:**
- Produces: `studioLogoUrl` for the transparent full logo and `studioLogoMarkUrl` for the transparent standalone emblem, using the existing `new URL(..., import.meta.url)` pattern.
- `Brand` renders the emblem plus `.studio-brand-copy` (name and STÜDYO subtitle) and exposes `aria-label="Yayın Atölyesi"`.
- Electron window title, error dialog, browser title, favicon, and loading screen use the Yayın Atölyesi identity; package/internal identifiers stay unchanged.

- [x] **Step 1: Add failing verifier assertions for the preserved source, both RGBA derivatives, content cropping, transparent borders, emblem-only mark, CSS wordmark markup, window title, and removal of baked wordmark assets.**
- [x] **Step 2: Run the verifier and confirm it fails on the missing source and assets.**
- [x] **Step 3: Derive both transparent assets from the supplied `logo1.png` without redrawing: clean only near-invisible alpha noise, split the full logo from the standalone emblem, crop to content with 16px transparent breathing room, and keep the source landmark.**
- [x] **Step 4: Use the emblem plus CSS wordmark in the sidebar. Center the emblem above the name in expanded mode; hide the copy and shrink/center the emblem in collapsed mode; use theme text and accent tokens for the wordmark and subtitle; add a dimension transition.**
- [x] **Step 5: Update the favicon, Electron window/error identity, index title, and loading screen to Yayın Atölyesi.**
- [x] **Step 6: Re-run the verifier and build; visually inspect light, dark, and soft-dark themes plus an actual restart.**

### Task 3: Shared icons, collapsible sidebar, topbar toggle

**Files:**
- Create: `apps/studio/src/StudioIcon.tsx`
- Modify: `apps/studio/src/StudioPipeline.tsx`
- Modify: `apps/studio/src/StudioTopbar.tsx`
- Test: `apps/studio/verify-studio-shell.cjs`

**Interfaces:**
- `StudioIcon` accepts `{ name: StudioIconName; className?: string }` and renders a 24x24 currentColor stroked SVG with `aria-hidden="true"`.
- `StudioTopbar` accepts `sidebarCollapsed: boolean` and `onToggleSidebar: () => void`.
- `StudioPipeline` owns `sidebarMode`, persists on toggle, adds `studio-sidebar-collapsed` or `studio-sidebar-expanded` to `.studio-shell`, gives the sidebar `id="studio-primary-sidebar"`, and renders icon+label buttons with `aria-current="page"` on the active item.

- [x] **Step 1: Add failing static assertions for all eight section icons, the collapse button wiring, labels/tooltips, and accessible active state.**
- [x] **Step 2: Run the verifier and confirm the assertions fail.**
- [x] **Step 3: Implement the shared icon component and wire the sidebar/topbar. Keep Settings last in the sidebar in both modes.**
- [x] **Step 4: Re-run the verifier and the TypeScript build. Confirm PASS.**

### Task 4: Common responsive layout, frame, and themes

**Files:**
- Modify: `apps/studio/src/studio-next.css`
- Modify: `apps/studio/src/studio-layout.css`
- Modify: `apps/studio/src/studio-topbar.css`
- Modify: `apps/studio/src/studio-workspace-system.css`
- Modify: `apps/studio/src/studio-fixed-viewport.css`
- Modify: `apps/studio/src/studio-theme-tokens.css`
- Modify: `apps/studio/verify-workspace-design.cjs`
- Modify: `apps/studio/verify-fixed-viewport.cjs`
- Modify: `apps/studio/verify-studio-appearance.cjs`
- Test: `apps/studio/verify-studio-shell.cjs`

**Interfaces:**
- CSS variables: `--studio-shell-gap`, `--studio-sidebar-expanded`, `--studio-sidebar-collapsed`, `--studio-workspace-inset`, `--studio-workspace-width`, `--shadow-workspace`.
- Shell classes: `.studio-sidebar-expanded`, `.studio-sidebar-collapsed`, `.studio-sidebar-toggle`, `.studio-nav-icon`, `.studio-nav-label`.

- [x] **Step 1: Add failing CSS assertions: no 1440px limit, full-width workspace, 60px collapsed rail, hidden labels/captions/dividers when collapsed, equal shell gaps via one variable, frame border/shadow tokens, topbar one-row grid, and no outer overflow.**
- [x] **Step 2: Run the verifier and confirm failures.**
- [x] **Step 3: Implement the token-driven layout in the existing CSS files, including responsive `clamp()` spacing, narrow-height compaction, and max-width 1180 behavior.**
- [x] **Step 4: Update older verifiers to assert the new shared contract instead of the retired 1440px constant and sticky topbar assumption.**
- [x] **Step 5: Re-run `verify:studio-shell`, `verify:workspace-design`, `verify:fixed-viewport`, `verify:appearance`, and the Studio build.**

### Task 5: Visual and release verification

**Files:**
- Modify: `package.json`
- Test commands: `npm run verify:studio-shell`, `npm run verify:workspace-design`, `npm run verify:fixed-viewport`, `npm run build:studio`, full `verify:release`.

- [x] **Step 1: Add `verify:studio-shell` to root scripts and the release chain.**
- [x] **Step 2: Build, launch the dev server, and capture 1920x1080, 1600x900, 1366x768, 1280x720, and 1024x768 screenshots in dark, light, and soft-dark themes.**
- [x] **Step 3: Visually confirm sidebar modes, logo transparency and theme legibility, active icons, focus/tooltip, frame edges, equal spacing, no shell overlap, no outer workspace scroll, and no horizontal page scroll.**
- [x] **Step 4: Verify the light-theme collapsed preference and Yayın Atölyesi emblem survive a real browser restart.**
- [x] **Step 5: Fix regressions and rerun the affected checks.**
- [x] **Step 6: Run the full release verifier; confirm all existing Studio and Book Web checks pass.**
- [x] **Step 7: Commit the finished shell and brand update as a checkpoint.**

## Self-Review

Spec coverage: sidebar icons/modes/tooltips/a11y/persistence (Tasks 1, 3), topbar toggle/alignment (Task 3, 4), Yayın Atölyesi source/transparent derivatives/emblem + CSS wordmark/themes/window identity (Task 2, 4), common workspace/margins/full width/frame (Task 4), responsive sizes and restart persistence (Tasks 2, 5), verification and checkpoint (Task 5). Existing page internals and domain behavior are explicitly untouched. No new dependencies or visual language.
