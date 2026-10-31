"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const projects = require("./channel-projects.cjs");
const { configureElectronDataPaths } = require("./studio-data-paths.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "channel-project-contract-"));
try {
  assert.deepEqual(projects.listProjects(root), []);
  assert.equal(projects.activeProjectId(root), "");
  const first = projects.createProject({
    id: "birdesengor",
    displayName: "BirDeSenGör",
    youtubeChannelUrl: "https://www.youtube.com/@BirDeSenGor",
    hostingProvider: "Natro",
  }, root);
  const second = projects.createProject({
    id: "ikinci-kanal",
    displayName: "İkinci Kanal",
  }, root);
  assert.equal(first.id, "birdesengor");
  assert.equal(first.hasWeb, false);
  assert.equal(first.deploymentEnabled, false);
  assert.equal(first.youtubePlaylistUrl, "");
  const playlist = "https://www.youtube.com/playlist?list=PL0123456789ABCDEF";
  const assigned = projects.updateProject({ id: first.id, youtubePlaylistUrl: playlist }, root);
  assert.equal(assigned.youtubePlaylistUrl, playlist);
  assert.throws(() => projects.updateProject({ id: first.id, youtubePlaylistUrl: "https://example.com/list?list=abc" }, root), /Playlist/);
  assert.throws(() => projects.updateProject({ id: first.id, youtubePlaylistUrl: "https://www.youtube.com/playlist?list=bad" }, root), /playlist kimliği/);
  projects.updateProject({ id: first.id, youtubePlaylistUrl: "" }, root);
  assert.equal(projects.listProjects(root).length, 2);
  assert.throws(() => projects.createProject({ id: "../escape", displayName: "Bad" }, root), /Proje kodu/);
  assert.throws(() => projects.createProject({ id: "birdesengor", displayName: "Tekrar" }, root), /kullanılıyor/);
  assert.throws(() => projects.updateProject({ id: "missing", displayName: "X" }, root), /bulunamadı/);
  assert.throws(() => projects.updateProject({ id: first.id, webUrl: "http://example.com" }, root), /HTTPS/);
  assert.throws(() => projects.updateProject({ id: first.id, youtubeChannelUrl: "https://example.com/@wrong" }, root), /YouTube/);
  assert.equal(projects.activeProjectId(root), "birdesengor");

  const firstRoot = projects.activeDataRoot(root);
  const fakeApp = {
    values: {},
    setPath(name, value) { this.values[name] = value; },
  };
  const a = configureElectronDataPaths(fakeApp, { projectRoot: root, environment: {} });
  assert.equal(a.root, firstRoot);
  assert.equal(fakeApp.values.userData, path.join(firstRoot, "studio"));
  fs.writeFileSync(path.join(a.studio, "unique-first.txt"), "birdesengor");
  projects.setActiveProject(second.id, root);
  const b = configureElectronDataPaths(fakeApp, { projectRoot: root, environment: {} });
  assert.equal(b.root, path.join(root, "channels", second.id, ".local-data"));
  assert.notEqual(a.studio, b.studio);
  assert.equal(fs.existsSync(path.join(b.studio, "unique-first.txt")), false);
  projects.setActiveProject(first.id, root);
  assert.equal(projects.activeProjectId(root), first.id);
  assert.equal(fs.readFileSync(path.join(a.studio, "unique-first.txt"), "utf8"), "birdesengor");
  const updated = projects.updateProject({
    id: first.id, displayName: "BirDeSenGör Evreni", webUrl: "https://ornek.com/",
    hostingProvider: "Natro",
  }, root);
  assert.equal(updated.webUrl, "https://ornek.com");
  assert.equal(updated.hostingProvider, "Natro");
  assert.equal(updated.deploymentEnabled, false);
  assert.equal(projects.readProject(first.id, root).displayName, "BirDeSenGör Evreni");
  assert.throws(() => projects.setActiveProject("olmayan", root), /bulunamadı/);
  console.log("Channel projects: registry, URLs, selection and isolated Studio data PASS");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
