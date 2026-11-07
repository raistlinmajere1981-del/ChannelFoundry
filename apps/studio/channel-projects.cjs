"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { normalizeSourceEntityKeys, approvedCharacterSources, resolveSourceEntities } = require("./narrator-source-identity.cjs");

const DEFAULT_ROOT = path.resolve(__dirname, "../..");
const ID_PATTERN = /^[a-z][a-z0-9-]{1,48}$/;
const databaseProjects = new WeakMap();
const reportedMigrations = new Set();

function migrationWarning(id, file, error) {
  if (!reportedMigrations.has(file)) {
    // Do not log database contents, filesystem paths or raw exception text.
    console.warn(`[channel-projects] ${id}: narrator migration failed (${String(error?.code ?? 'migration-error').replace(/[^a-z0-9_-]/gi, '').slice(0, 64)}). Channel selection preserved.`);
    reportedMigrations.add(file);
  }
  return 'Anlatıcı ayarları aktarılamadı. Kanal seçimi korundu. Aktarım hatası giderilene kadar anlatıcı ayarları ve Hikâyeleştir kullanılamaz.';
}

function normalizeNarrator(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Geçerli anlatıcı ayarları gerekli.");
  const mode = String(input.mode ?? "source_bound_first_person").trim();
  if (!["source_bound_first_person", "neutral"].includes(mode)) throw new Error("Desteklenmeyen anlatım perspektifi.");
  return {
    displayName: String(input.displayName ?? "").trim().slice(0, 160),
    mode,
    editorialNote: String(input.editorialNote ?? "").trim().slice(0, 1600),
    sourceEntityKeys: normalizeSourceEntityKeys(input.sourceEntityKeys),
  };
}

// The legacy row is migration input only. No Studio API writes it anymore.
function legacyNarrator(db) {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='narrative_narrator_profile'").get()) return null;
  return db.prepare("SELECT display_name AS displayName, mode, editorial_note AS editorialNote FROM narrative_narrator_profile WHERE id=1").get() ?? null;
}

function migrateNarrator(raw, file, db) {
  if (Object.hasOwn(raw, "narrator")) return raw;
  const legacy = legacyNarrator(db);
  if (!legacy) return raw;
  const next = { ...raw, narrator: normalizeNarrator(legacy) };
  writeJson(file, next);
  return next;
}

function projectDirectory(projectRoot = DEFAULT_ROOT) {
  return path.join(path.resolve(projectRoot), "channels");
}
function stateFile(projectRoot = DEFAULT_ROOT) {
  return path.join(path.resolve(projectRoot), ".channel-active.json");
}
function validateId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  if (!ID_PATTERN.test(id) || id.endsWith("-") || id.includes("--")) {
    throw new Error("Proje kodu 2-49 karakter olmalı; küçük harf, rakam ve tire kullanılabilir.");
  }
  return id;
}
function optionalHttps(value, label) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  let url;
  try { url = new URL(text); } catch { throw new Error(`${label} geçerli bir URL olmalı.`); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
    throw new Error(`${label} HTTPS adresi olmalı.`);
  }
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
function youtubeUrl(value) {
  const result = optionalHttps(value, "YouTube adresi");
  if (!result) return "";
  const target = new URL(result);
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(target.hostname.toLowerCase())) {
    throw new Error("Yalnızca YouTube kanal bağlantısı kabul edilir.");
  }
  if (!/^\/(?:@[^/]+|channel\/[^/]+|user\/[^/]+|c\/[^/]+)\/?$/.test(target.pathname)) {
    throw new Error("YouTube adresi bir kanalı göstermeli.");
  }
  return result;
}
function playlistUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const url = new URL(optionalHttps(raw, "Playlist adresi"));
  if (!["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("Playlist YouTube adresi olmalı.");
  }
  const id = String(url.searchParams.get("list") ?? "");
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) throw new Error("Geçerli bir playlist kimliği gerekli.");
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`;
}
function normalize(input, previous) {
  if (input?.narrator !== undefined && input?.narrator !== null) normalizeNarrator(input.narrator);
  const id = validateId(previous?.id ?? input?.id);
  const displayName = String(input?.displayName ?? previous?.displayName ?? "").trim();
  if (!displayName || displayName.length > 90) throw new Error("Proje adı 1-90 karakter olmalı.");
  const webRepository = optionalHttps(input?.webRepository ?? previous?.webRepository ?? "", "Web reposu");
  if (webRepository && new URL(webRepository).hostname.toLowerCase() !== "github.com") {
    throw new Error("Web reposu GitHub HTTPS adresi olmalı.");
  }
  const webDirectory = String(input?.webDirectory ?? previous?.webDirectory ?? "web").trim();
  if (webDirectory !== "web") throw new Error("Web klasörü 'web' olarak kullanılmalı.");
  return {
    id,
    displayName,
    youtubeChannelUrl: youtubeUrl(input?.youtubeChannelUrl ?? previous?.youtubeChannelUrl ?? ""),
    youtubePlaylistUrl: playlistUrl(input?.youtubePlaylistUrl ?? previous?.youtubePlaylistUrl ?? ""),
    webRepository,
    webDirectory,
    hostingProvider: String(input?.hostingProvider ?? previous?.hostingProvider ?? "").trim().slice(0, 48),
    webUrl: optionalHttps(input?.webUrl ?? previous?.webUrl ?? "", "Web sitesi"),
    deploymentEnabled: Boolean(input?.deploymentEnabled ?? previous?.deploymentEnabled ?? false),
    narrator: normalizeNarrator({ ...previous?.narrator, ...input?.narrator }),
  };
}
function readProject(id, projectRoot = DEFAULT_ROOT) {
  const safeId = validateId(id);
  const folder = path.join(projectDirectory(projectRoot), safeId);
  const file = path.join(folder, "channel.json");
  if (!fs.existsSync(file)) throw new Error(`Kanal projesi bulunamadı: ${safeId}`);
  let raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (raw.id !== safeId) throw new Error(`Kanal proje kimliği uyuşmuyor: ${safeId}`);
  normalize(raw); // Invalid project identities are still rejected independently.
  // Import only this project's own old SQLite profile, without opening the
  // normal Studio bootstrap (which can write schemas or clean legacy fixtures).
  const databaseFile = path.join(folder, ".local-data", "studio", "channel-foundry-studio.sqlite");
  let narratorMigrationError;
  try {
    if (!Object.hasOwn(raw, "narrator") && fs.existsSync(databaseFile)) {
      const { DatabaseSync } = require("node:sqlite");
      const db = new DatabaseSync(databaseFile, { readOnly: true, timeout: 5000 });
      try { raw = migrateNarrator(raw, file, db); } finally { db.close(); }
    }
    reportedMigrations.delete(file);
  } catch (error) {
    narratorMigrationError = migrationWarning(safeId, file, error);
  }
  const normalized = normalize(raw);
  return { ...normalized, ...(narratorMigrationError ? { narratorMigrationError } : {}), hasWeb: fs.existsSync(path.join(folder, "web", "package.json")) };
}
function listProjects(projectRoot = DEFAULT_ROOT) {
  const directory = projectDirectory(projectRoot);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((item) => item.isDirectory() && ID_PATTERN.test(item.name))
    .flatMap((item) => {
      try { return [readProject(item.name, projectRoot)]; } catch { return []; }
    }).sort((a, b) => a.displayName.localeCompare(b.displayName, "tr"));
}
function activeProjectId(projectRoot = DEFAULT_ROOT) {
  const projects = listProjects(projectRoot);
  if (!projects.length) return "";
  let configured = "";
  try { configured = String(JSON.parse(fs.readFileSync(stateFile(projectRoot), "utf8")).id ?? ""); } catch {}
  return projects.some((project) => project.id === configured) ? configured : projects[0].id;
}
function activeProject(projectRoot = DEFAULT_ROOT) {
  const id = activeProjectId(projectRoot);
  return id ? readProject(id, projectRoot) : null;
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, file);
}
function setActiveProject(id, projectRoot = DEFAULT_ROOT) {
  const project = readProject(id, projectRoot);
  writeJson(stateFile(projectRoot), { id: project.id });
  return project;
}
function createProject(input, projectRoot = DEFAULT_ROOT) {
  const project = normalize(input);
  if (project.narrator.sourceEntityKeys.length) throw new Error("Anlatıcı kimliklerini proje oluşturulduktan sonra kanalın onaylı Evren kayıtlarından seç.");
  const directory = path.join(projectDirectory(projectRoot), project.id);
  if (fs.existsSync(directory)) throw new Error("Bu proje kodu zaten kullanılıyor.");
  fs.mkdirSync(directory, { recursive: true });
  writeJson(path.join(directory, "channel.json"), project);
  return readProject(project.id, projectRoot);
}
function updateProject(input, projectRoot = DEFAULT_ROOT, db = null) {
  const previous = readProject(input?.id, projectRoot);
  if (previous.narratorMigrationError) throw new Error(previous.narratorMigrationError);
  const project = normalize(input, previous);
  if (project.narrator.sourceEntityKeys.some(key => !previous.narrator.sourceEntityKeys.includes(key))) {
    assertDatabaseOwner(db, project.id, projectRoot);
    resolveSourceEntities(db, project.narrator.sourceEntityKeys);
  }
  writeJson(path.join(projectDirectory(projectRoot), project.id, "channel.json"), project);
  return readProject(project.id, projectRoot);
}
function activeDataRoot(projectRoot = DEFAULT_ROOT) {
  const id = activeProjectId(projectRoot);
  return id ? path.join(projectDirectory(projectRoot), id, ".local-data") : path.join(projectRoot, "local-data");
}

function bindDatabaseProject(db, id, projectRoot = DEFAULT_ROOT) {
  const owner = databaseProjectScope(db);
  if (owner && (owner.id !== id || path.resolve(owner.projectRoot) !== path.resolve(projectRoot))) {
    throw new Error("Studio veritabanı seçili kanal projesine ait değil.");
  }
  const project = readProject(id, projectRoot);
  const file = path.join(projectDirectory(projectRoot), project.id, "channel.json");
  if (!project.narratorMigrationError) migrateNarrator(JSON.parse(fs.readFileSync(file, "utf8")), file, db);
  databaseProjects.set(db, { id: project.id, projectRoot });
}

function databaseProjectScope(db) {
  const file = db.prepare("PRAGMA database_list").all().find(row => row.name === "main")?.file;
  const studio = file ? path.dirname(file) : "";
  const data = path.dirname(studio);
  const channel = path.dirname(data);
  const channels = path.dirname(channel);
  if (path.basename(studio) === "studio" && path.basename(data) === ".local-data" && path.basename(channels) === "channels") {
    return { id: path.basename(channel), projectRoot: path.dirname(channels) };
  }
  return null;
}

function narratorForDatabase(db) {
  // Resolve from the database's owner, never the mutable active-project file.
  const scope = databaseProjects.get(db) ?? databaseProjectScope(db);
  // Unbound disposable databases must never consume the real active channel.
  if (!scope) return normalizeNarrator();
  const project = readProject(scope.id, scope.projectRoot);
  if (project.narratorMigrationError) throw new Error(project.narratorMigrationError);
  return project.narrator;
}

function assertDatabaseOwner(db, id, projectRoot) {
  const scope = db && (databaseProjects.get(db) ?? databaseProjectScope(db));
  if (!scope || scope.id !== id || path.resolve(scope.projectRoot) !== path.resolve(projectRoot)) {
    throw new Error("Anlatıcı kimliklerini seçmek için bu kanalı aç. Aktif Studio veritabanı bu kanal projesine ait değil.");
  }
}

function narratorSourcesForProject(db, id, projectRoot = DEFAULT_ROOT) {
  assertDatabaseOwner(db, validateId(id), projectRoot);
  return approvedCharacterSources(db);
}

function registerChannelProjectIpc(ipcMain, runtime, options = {}) {
  const root = options.projectRoot ?? DEFAULT_ROOT;
  ipcMain.handle("studio:channel-projects", () => ({ activeId: activeProjectId(root), projects: listProjects(root) }));
  ipcMain.handle("studio:channel-narrator-sources", (_event, input) => {
    if (validateId(input?.id) !== activeProjectId(root)) throw new Error("Anlatıcı kimliklerini seçmek için bu kanalı aç.");
    return narratorSourcesForProject(runtime.database(), input.id, root);
  });
  ipcMain.handle("studio:channel-project-create", (_event, input) => {
    const project = createProject(input, root);
    runtime.refreshMainWindow();
    return project;
  });
  ipcMain.handle("studio:channel-project-update", (_event, input) => {
    const previous = readProject(input?.id, root);
    const keys = normalizeNarrator({ ...previous.narrator, ...input?.narrator }).sourceEntityKeys;
    const addsIdentity = keys.some(key => !previous.narrator.sourceEntityKeys.includes(key));
    if (addsIdentity && previous.id !== activeProjectId(root)) throw new Error("Anlatıcı kimliklerini seçmek için bu kanalı aç.");
    const project = updateProject(input, root, addsIdentity ? runtime.database() : null);
    runtime.refreshMainWindow();
    return project;
  });
  ipcMain.handle("studio:channel-project-select", (_event, input) => {
    const project = readProject(input?.id, root);
    if (project.id === activeProjectId(root)) return { changed: false, project };
    if (runtime.workersBusy() || options.youtubeSyncIsRunning?.()) {
      throw new Error("Devam eden AI veya YouTube işlemi bitmeden proje değiştirilemez.");
    }
    setActiveProject(project.id, root);
    options.onSelect(project);
    return { changed: true, project };
  });
}
module.exports = {
  DEFAULT_ROOT, validateId, normalize, readProject, listProjects, activeProject,
  activeProjectId, setActiveProject, createProject, updateProject, activeDataRoot,
  normalizeNarrator, bindDatabaseProject, narratorForDatabase,
  narratorSourcesForProject,
  registerChannelProjectIpc,
};
