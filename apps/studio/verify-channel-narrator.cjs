"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const projects = require("./channel-projects.cjs");
const workspace = require("./universe-workspace.cjs");
const store = require("./narrative-store.cjs");
const service = require("./narrative-service.cjs");
const generation = require("./narrative-ai-generation.cjs");
const { registerNarrativeIpc } = require("./narrative-ipc.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "channel-narrator-"));
const connections = [];
const profile = { displayName: "Ömer", mode: "source_bound_first_person", editorialNote: "Kaynaklara sadık, sade anlat.", sourceEntityKeys: [] };
function open(id) {
  const directory = path.join(root, "channels", id, ".local-data", "studio");
  fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "channel-foundry-studio.sqlite"));
  connections.push(db);
  db.exec("PRAGMA foreign_keys=ON");
  workspace.ensureSchema(db);
  db.prepare(`INSERT INTO universe_workspace_nodes
    (key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state)
    VALUES('story',1,'story','Kaynak','Onaylı kaynak','[]','["video"]','{}','approved')`).run();
  return db;
}
function narrativeRows(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'narrative_%' ORDER BY name").all()
    .map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]);
}

try {
  projects.createProject({ id: "birdesengor", displayName: "BirDeSenGör", webUrl: "https://example.test", hostingProvider: "Natro", deploymentEnabled: true }, root);
  projects.createProject({ id: "ikinci", displayName: "İkinci", narrator: { displayName: "Deniz", mode: "neutral", editorialNote: "Kısa anlat." } }, root);
  const a = open("birdesengor"), b = open("ikinci");
  assert.throws(() => projects.bindDatabaseProject(a, "ikinci", root), /seçili kanal projesine ait değil/);
  assert.equal(b.prepare("SELECT 1 FROM sqlite_master WHERE name='narrative_narrator_profile'").get(), undefined);

  // Establish approved narrative memory before the migration, as in real Studio.
  const old = service.prepare(a);
  store.saveDraftSections(a, old.run.id, [{ key: "approved-memory", title: "Onaylı anı", body: "Korunacak metin.", sourceKeys: ["story"] }]);
  store.applyRun(a, old.run.id);
  a.exec(`CREATE TABLE narrative_narrator_profile(id INTEGER PRIMARY KEY,display_name TEXT,mode TEXT,editorial_note TEXT)`);
  a.prepare("INSERT INTO narrative_narrator_profile VALUES(1,?,?,?)").run(profile.displayName, profile.mode, profile.editorialNote);
  const file = path.join(root, "channels/birdesengor/channel.json");
  const raw = JSON.parse(fs.readFileSync(file));
  delete raw.narrator;
  raw.unrelatedSetting = { preserved: true };
  fs.writeFileSync(file, JSON.stringify(raw));
  const before = narrativeRows(a);
  const publication = path.join(path.dirname(a.prepare("PRAGMA database_list").get().file), "public-export/content/publication.json");
  fs.mkdirSync(path.dirname(publication), { recursive: true });
  fs.writeFileSync(publication, '{"previousPublication":"must remain identical"}');
  const publicationBefore = fs.readFileSync(publication);

  assert.deepEqual(projects.readProject("birdesengor", root).narrator, profile);
  const migrated = fs.readFileSync(file, "utf8");
  assert.deepEqual(JSON.parse(migrated).unrelatedSetting, raw.unrelatedSetting);
  assert.equal(JSON.parse(migrated).deploymentEnabled, true);
  assert.equal(JSON.parse(migrated).webUrl, raw.webUrl);
  assert.deepEqual(narrativeRows(a), before, "Migration must not write any narrative table, including old runs or the legacy profile");
  projects.readProject("birdesengor", root);
  assert.equal(fs.readFileSync(file, "utf8"), migrated, "Migration is idempotent");
  assert.deepEqual(fs.readFileSync(publication), publicationBefore);

  const handlers = new Map();
  let refreshed = 0, selected = "", busy = false, youtubeBusy = false;
  const ipc = { handle: (name, callback) => { assert.equal(handlers.has(name), false); handlers.set(name, callback); } };
  const runtime = { database: () => a, refreshMainWindow: () => refreshed++, workersBusy: () => busy };
  projects.registerChannelProjectIpc(ipc, runtime, { projectRoot: root, youtubeSyncIsRunning: () => youtubeBusy, onSelect: p => { selected = p.id; } });
  registerNarrativeIpc(ipc, runtime);
  const call = (name, input) => handlers.get(`studio:${name}`)({}, input);
  assert.equal(handlers.has("studio:narrative-outline-profile"), false);
  assert.throws(() => call("channel-project-update", { id: "birdesengor", narrator: { mode: "invent" } }), /perspektifi/);
  assert.equal(refreshed, 0);
  const edited = { ...profile, editorialNote: "Kaynaklara sadık; kısa paragraflar." };
  call("channel-project-update", { id: "birdesengor", narrator: edited });
  assert.equal(refreshed, 1);
  assert.deepEqual(call("channel-projects").projects.find(p => p.id === "birdesengor").narrator, edited);
  call("channel-project-update", { id: "birdesengor", displayName: "BirDeSenGör" });
  assert.deepEqual(projects.readProject("birdesengor", root).narrator, edited, "Unrelated settings saves preserve narrator");
  assert.equal(projects.readProject("ikinci", root).narrator.displayName, "Deniz");
  call("channel-project-create", { id: "ucuncu", displayName: "Üçüncü", narrator: { displayName: "Ece", mode: "neutral" } });
  assert.equal(projects.readProject("ucuncu", root).narrator.displayName, "Ece");

  workspace.updateNode(a, { key: "story", summary: "Yeni kaynak bilgisi." });
  const prepared = call("narrative-prepare", { narrator: { displayName: "Spoof", mode: "neutral" } });
  assert.deepEqual(prepared.run.input.narrator, edited, "Renderer cannot override the channel narrator at preparation");
  const frozen = JSON.stringify(prepared.request);
  const frozenRun = JSON.stringify(store.getRun(a, prepared.run.id));
  const approved = JSON.stringify(store.narrativeMemory(a));
  const nextProfile = { displayName: "Ömer", mode: "neutral", editorialNote: "Yeni kalıcı tercih.", sourceEntityKeys: [] };
  call("channel-project-update", { id: "birdesengor", narrator: nextProfile });
  assert.equal(JSON.stringify(call("narrative-request", prepared.run.id)), frozen);
  assert.equal(JSON.stringify(store.getRun(a, prepared.run.id)), frozenRun);
  assert.equal(JSON.stringify(store.narrativeMemory(a)), approved);
  assert.deepEqual(fs.readFileSync(publication), publicationBefore);
  const next = call("narrative-prepare");
  assert.notEqual(next.run.id, prepared.run.id);
  assert.deepEqual(next.request.input.narrator, nextProfile);
  assert.notEqual(next.run.inputFingerprint, prepared.run.inputFingerprint);

  busy = true;
  assert.throws(() => call("channel-project-select", { id: "ikinci" }), /bitmeden/);
  busy = false; youtubeBusy = true;
  assert.throws(() => call("channel-project-select", { id: "ikinci" }), /bitmeden/);
  youtubeBusy = false;
  call("channel-project-select", { id: "ikinci" });
  assert.equal(selected, "ikinci");
  assert.deepEqual(service.prepare(b).request.input.narrator, projects.readProject("ikinci", root).narrator);
  assert.deepEqual(projects.narratorForDatabase(a), nextProfile, "An open database remains bound to its owner during relaunch");
  assert.equal(JSON.stringify(service.buildRequest(a, prepared.run.id)), frozen);

  // Existing channel settings always win over the retained, inert legacy row.
  a.prepare("UPDATE narrative_narrator_profile SET display_name='Obsolete'").run();
  assert.deepEqual(projects.readProject("birdesengor", root).narrator, nextProfile);
  projects.updateProject({ id: "birdesengor", narrator: { displayName: "", mode: "neutral", editorialNote: "" } }, root);
  assert.equal(projects.readProject("birdesengor", root).narrator.displayName, "", "An intentionally empty setting must not reimport legacy values");

  const isolated = new DatabaseSync(":memory:"); connections.push(isolated);
  projects.bindDatabaseProject(isolated, "ikinci", root);
  assert.equal(projects.narratorForDatabase(isolated).displayName, "Deniz", "Explicit runtime binding supports overridden Studio data roots");
  const unbound = new DatabaseSync(":memory:"); connections.push(unbound);
  assert.deepEqual(projects.narratorForDatabase(unbound), projects.normalizeNarrator(), "Unbound test databases never read real active settings");

  // Pre-feature runs lacking a narrator snapshot never gain a live dependency.
  const input = { ...store.getRun(a, next.run.id).input }; delete input.narrator;
  a.prepare("UPDATE narrative_runs SET input_json=? WHERE id=?").run(JSON.stringify(input), next.run.id);
  const legacyRequest = service.buildRequest(a, next.run.id);
  assert.equal(legacyRequest.input.narrator.mode, "neutral");
  projects.updateProject({ id: "birdesengor", narrator: profile }, root);
  assert.deepEqual(service.buildRequest(a, next.run.id), legacyRequest);
  const prompt = generation.buildMessages(prepared.request)[0].content;
  for (const rule of [/ben diliyle/, /Anlatıcı adlı node mapped değilse/, /adıyla hitap/, /tek başına.*kanıtlamaz/, /Kimin yaşadığı belirsizse/, /Metafizik/, /kaynak kanıtı yerine geçemez/]) assert.match(prompt, rule);
  // A migration fault must never hide the selected channel or pick another.
  const failedId = 'migration-failure';
  projects.createProject({ id: failedId, displayName: 'Z Seçili kanal' }, root);
  projects.setActiveProject(failedId, root);
  const failedFile = path.join(root, 'channels', failedId, 'channel.json');
  const failedRaw = JSON.parse(fs.readFileSync(failedFile)); delete failedRaw.narrator;
  fs.writeFileSync(failedFile, JSON.stringify(failedRaw));
  const selectedBefore = fs.readFileSync(path.join(root, '.channel-active.json'), 'utf8');
  const failedDirectory = path.join(root, 'channels', failedId, '.local-data/studio');
  fs.mkdirSync(failedDirectory, { recursive: true });
  const failedDbFile = path.join(failedDirectory, 'channel-foundry-studio.sqlite');
  fs.writeFileSync(failedDbFile, 'Corrupt migration fixture');
  const savedWarn = console.warn, warnings = []; console.warn = value => warnings.push(value);
  try {
    const result = projects.readProject(failedId, root);
    assert.equal(result.id, failedId); assert.equal(result.displayName, failedRaw.displayName);
    assert.match(result.narratorMigrationError, /aktarılamadı/);
    assert.ok(projects.listProjects(root).some(project => project.id === failedId));
    assert.equal(projects.activeProjectId(root), failedId);
    assert.equal(projects.activeDataRoot(root), path.join(root, 'channels', failedId, '.local-data'));
    assert.equal(fs.readFileSync(path.join(root, '.channel-active.json'), 'utf8'), selectedBefore);
    assert.equal(fs.readFileSync(failedFile, 'utf8'), JSON.stringify(failedRaw));
    assert.throws(() => projects.updateProject({ id: failedId, narrator: profile }, root), /aktarılamadı/);
    const bound = new DatabaseSync(':memory:'); connections.push(bound);
    projects.bindDatabaseProject(bound, failedId, root);
    assert.throws(() => projects.narratorForDatabase(bound), /aktarılamadı/, 'AI must not consume a default profile after failed migration');
    assert.equal(warnings.length, 1, 'Repeated reads must not flood diagnostics');
    assert.ok(!warnings[0].includes(root), 'Diagnostics must not expose raw database exception details');
    fs.rmSync(failedDbFile);
    const repaired = new DatabaseSync(failedDbFile);
    repaired.exec('CREATE TABLE narrative_narrator_profile(id INTEGER PRIMARY KEY,display_name TEXT,mode TEXT,editorial_note TEXT)');
    repaired.prepare('INSERT INTO narrative_narrator_profile VALUES(1,?,?,?)').run(profile.displayName, profile.mode, profile.editorialNote);
    repaired.close();
    fs.mkdirSync(failedFile + '.tmp'); // Deterministic atomic-write failure, including when tests run as root.
    assert.match(projects.readProject(failedId, root).narratorMigrationError, /aktarılamadı/);
    assert.equal(projects.activeProjectId(root), failedId);
    assert.equal(fs.readFileSync(failedFile, 'utf8'), JSON.stringify(failedRaw));
    fs.rmdirSync(failedFile + '.tmp');
    assert.deepEqual(projects.readProject(failedId, root).narrator, profile);
    assert.equal(projects.readProject(failedId, root).narratorMigrationError, undefined);
    assert.deepEqual(projects.narratorForDatabase(bound), profile, 'Repair resumes migration on the same channel');
  } finally { console.warn = savedWarn; }
  console.log("PASS channel narrator: one-way migration, persistence, isolation, real IPC, immutable prepared requests, subsequent settings, unchanged approved memory/publication, attribution rules");
} finally {
  for (const db of connections) db.close();
  fs.rmSync(root, { recursive: true, force: true });
}
