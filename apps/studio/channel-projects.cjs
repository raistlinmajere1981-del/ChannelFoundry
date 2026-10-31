"use strict";
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "../..");
const ID_PATTERN = /^[a-z][a-z0-9-]{1,48}$/;

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
  };
}
function readProject(id, projectRoot = DEFAULT_ROOT) {
  const safeId = validateId(id);
  const folder = path.join(projectDirectory(projectRoot), safeId);
  const file = path.join(folder, "channel.json");
  if (!fs.existsSync(file)) throw new Error(`Kanal projesi bulunamadı: ${safeId}`);
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (raw.id !== safeId) throw new Error(`Kanal proje kimliği uyuşmuyor: ${safeId}`);
  const normalized = normalize(raw);
  return { ...normalized, hasWeb: fs.existsSync(path.join(folder, "web", "package.json")) };
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
  const directory = path.join(projectDirectory(projectRoot), project.id);
  if (fs.existsSync(directory)) throw new Error("Bu proje kodu zaten kullanılıyor.");
  fs.mkdirSync(directory, { recursive: true });
  writeJson(path.join(directory, "channel.json"), project);
  return readProject(project.id, projectRoot);
}
function updateProject(input, projectRoot = DEFAULT_ROOT) {
  const previous = readProject(input?.id, projectRoot);
  const project = normalize(input, previous);
  writeJson(path.join(projectDirectory(projectRoot), project.id, "channel.json"), project);
  return readProject(project.id, projectRoot);
}
function activeDataRoot(projectRoot = DEFAULT_ROOT) {
  const id = activeProjectId(projectRoot);
  return id ? path.join(projectDirectory(projectRoot), id, ".local-data") : path.join(projectRoot, "local-data");
}
module.exports = {
  DEFAULT_ROOT, validateId, normalize, readProject, listProjects, activeProject,
  activeProjectId, setActiveProject, createProject, updateProject, activeDataRoot,
};
