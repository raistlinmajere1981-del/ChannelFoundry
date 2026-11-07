/** Actual channel settings React + production project/narrative IPC; isolated data only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const repo = path.resolve(import.meta.dirname, '../../..'), studio = path.join(repo, 'apps/studio');
const { DatabaseSync } = require('node:sqlite'), { createServer } = require('vite');
const { chromium } = createRequire(path.join(repo, 'channels/birdesengor/web/package.json'))('playwright-core');
const projects = require('../channel-projects.cjs'), workspace = require('../universe-workspace.cjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'channel-narrator-react-'));
const out = path.join(repo, 'artifacts/channel-narrator-stage1'); fs.mkdirSync(out, { recursive: true });
projects.createProject({ id: 'birdesengor', displayName: 'BirDeSenGör' }, scratch);
projects.createProject({ id: 'ikinci', displayName: 'İkinci Kanal', narrator: { displayName: 'Deniz', mode: 'neutral', editorialNote: 'İkinci kanalın tercihi.' } }, scratch);
const dbs = new Map();
const ownerKey = 'universe-character-096793ce1a67a7', announcerKey = 'universe-character-2801a15b283310';
for (const id of ['birdesengor', 'ikinci']) {
  const directory = path.join(scratch, 'channels', id, '.local-data/studio'); fs.mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, 'channel-foundry-studio.sqlite'));
  dbs.set(id, db); workspace.ensureSchema(db);
  db.prepare(`INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state)
    VALUES('source',1,'story','Kaynak','Onaylı deneyim.','[]','[]','{}','approved')`).run();
  const character = db.prepare(`INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,state) VALUES(?,1,'character',?,'Kaynak eylemi.','approved')`);
  if (id === 'birdesengor') { character.run(ownerKey, 'Ömer'); character.run(announcerKey, 'Anlatıcı'); }
  else character.run('second-character', 'Deniz');
}
const settingsFile = path.join(scratch, 'channels/birdesengor/channel.json');
const old = JSON.parse(fs.readFileSync(settingsFile)); delete old.narrator; fs.writeFileSync(settingsFile, JSON.stringify(old));
dbs.get('birdesengor').exec(`CREATE TABLE narrative_narrator_profile(id INTEGER PRIMARY KEY,display_name TEXT,mode TEXT,editorial_note TEXT);
  INSERT INTO narrative_narrator_profile VALUES(1,'Ömer','source_bound_first_person','');`);
const handlers = new Map(), ipc = { handle: (name, fn) => handlers.set(name, fn) };
const runtime = { database: () => dbs.get(projects.activeProjectId(scratch)), refreshMainWindow() {}, workersBusy: () => false };
projects.registerChannelProjectIpc(ipc, runtime, { projectRoot: scratch, onSelect() {} });
require('../narrative-ipc.cjs').registerNarrativeIpc(ipc, runtime);
const methods = { channelProjects: 'channel-projects', channelNarratorSources: 'channel-narrator-sources', channelProjectCreate: 'channel-project-create', channelProjectUpdate: 'channel-project-update', channelProjectSelect: 'channel-project-select', narrativePrepare: 'narrative-prepare', narrativeOutlineStatus: 'narrative-outline-status' };
let server, browser, page; const errors = [];
try {
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(scratch, 'node_modules'));
  fs.writeFileSync(path.join(scratch, 'index.html'), '<html lang="tr"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
  fs.writeFileSync(path.join(scratch, 'entry.tsx'), `import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import Settings from '/@fs/${studio}/src/ChannelProjectsSettings.tsx';import Outline from '/@fs/${studio}/src/NarrativeOutlineWorkbench.tsx';
    import '/@fs/${studio}/src/studio-theme-tokens.css';import '/@fs/${studio}/src/styles.css';import '/@fs/${studio}/src/pipeline.css';import '/@fs/${studio}/src/studio-layout.css';import '/@fs/${studio}/src/studio-theme-bindings.css';import '/@fs/${studio}/src/channel-projects.css';
    window.channelFoundryStudio=Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,(...args)=>window.__call(name,args)]));
    window.channelFoundryStudio.youtubeCatalogActive=async()=>null;window.channelFoundryStudio.onDataChanged=()=>()=>{};
    function App(){const[screen,setScreen]=useState('settings');return <div className="studio-shell" style={{display:'block',padding:20}}><nav><button onClick={()=>setScreen('settings')}>Kanal Ayarları</button><button onClick={()=>setScreen('outline')}>Günlük Düzeni</button></nav>{screen==='settings'?<Settings/>:<Outline memory={[]}/>}</div>};
    createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`);
  server = await createServer({ configFile: false, root: scratch, cacheDir: path.join(scratch, '.vite'), logLevel: 'error', esbuild: { jsx: 'automatic' }, resolve: { dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [repo, scratch] } } }); await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? path.join(os.homedir(), '.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('__call', (name, args) => handlers.get(`studio:${methods[name]}`)({}, ...args));
  await page.goto(server.resolvedUrls.local[0]);
  const name = () => page.getByLabel('Anlatıcının adı', { exact: true });
  await page.waitForFunction(() => document.querySelector('.project-narrator input')?.value === 'Ömer');
  assert.equal(await name().inputValue(), 'Ömer');
  assert.equal(await page.getByLabel('Anlatım perspektifi', { exact: true }).inputValue(), 'source_bound_first_person');
  const ownerChoice = () => page.getByRole('checkbox', { name: new RegExp(ownerKey) });
  const announcerChoice = () => page.getByRole('checkbox', { name: new RegExp(announcerKey) });
  await ownerChoice().waitFor();
  assert.equal(await ownerChoice().isChecked(), false, 'Neither Ömer nor Anlatıcı auto-maps by name');
  assert.equal(await announcerChoice().isChecked(), false);
  await ownerChoice().check(); await announcerChoice().check();
  await announcerChoice().uncheck();
  await page.getByLabel('Editoryal üslup notları', { exact: true }).fill('Kaynaklara sadık, kısa paragraflar.');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await page.getByText('Kaydedildi', { exact: true }).waitFor();
  assert.equal(JSON.parse(fs.readFileSync(settingsFile)).narrator.editorialNote, 'Kaynaklara sadık, kısa paragraflar.');
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).narrator.sourceEntityKeys, [ownerKey]);
  const prepared = await page.evaluate(() => window.channelFoundryStudio.narrativePrepare());
  assert.equal(prepared.request.input.narrator.displayName, 'Ömer');
  assert.deepEqual(prepared.request.input.narratorSourceEntities, [{ sourceKey: ownerKey, name: 'Ömer' }]);

  await page.getByRole('button', { name: 'Günlük Düzeni', exact: true }).click();
  await page.getByRole('heading', { name: 'İçindekiler', exact: true }).waitFor();
  for (const field of ['Anlatıcının adı', 'Anlatım perspektifi', 'Editoryal üslup notları', 'Günlük sahibi', 'Üslup', 'Editoryal not']) assert.equal(await page.getByLabel(field, { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Profili kaydet', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => 'narrativeOutlineSaveProfile' in window.channelFoundryStudio), false);
  await page.getByRole('button', { name: 'Kanal Ayarları', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.project-narrator input')?.value === 'Ömer');
  assert.equal(await page.getByLabel('Editoryal üslup notları', { exact: true }).inputValue(), 'Kaynaklara sadık, kısa paragraflar.');
  await ownerChoice().waitFor(); assert.equal(await ownerChoice().isChecked(), true);
  await page.getByLabel('Anlatım perspektifi', { exact: true }).selectOption('neutral');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Kaydedildi', { exact: true }).waitFor();
  assert.deepEqual(handlers.get('studio:narrative-request')({}, prepared.run.id), prepared.request);
  const next = await page.evaluate(() => window.channelFoundryStudio.narrativePrepare());
  assert.equal(next.request.input.narrator.mode, 'neutral'); assert.notEqual(next.run.id, prepared.run.id);

  // Persist a now-missing ID in the temporary channel, then let the editor
  // remove it. No fallback to another same-named character is allowed.
  const brokenIdentity = JSON.parse(fs.readFileSync(settingsFile));
  brokenIdentity.narrator.sourceEntityKeys.push('missing-character');
  fs.writeFileSync(settingsFile, JSON.stringify(brokenIdentity));
  await page.reload();
  await page.getByText('Çözümlenemiyor: güncel onaylı karakter kaydı bulunamadı.', { exact: false }).waitFor();
  assert.equal(await ownerChoice().isChecked(), true);
  await page.getByRole('button', { name: 'Eşlemeyi kaldır', exact: true }).click();
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Kaydedildi', { exact: true }).waitFor();
  assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).narrator.sourceEntityKeys, [ownerKey]);
  assert.deepEqual(handlers.get('studio:narrative-request')({}, prepared.run.id), prepared.request);
  await page.screenshot({ path: path.join(out, 'settings-explicit-source-identity.png'), fullPage: true });

  await page.locator('.channel-project-entry').filter({ hasText: 'İkinci Kanal' }).locator('button').first().click();
  assert.equal(await name().inputValue(), 'Deniz');
  assert.equal(await ownerChoice().count(), 0, 'Inactive editor cannot show active channel character choices');
  assert.equal(await page.getByLabel('Editoryal üslup notları', { exact: true }).inputValue(), 'İkinci kanalın tercihi.');
  await page.getByLabel('Editoryal üslup notları', { exact: true }).fill('Yalnız ikinci kanalda.');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Kaydedildi', { exact: true }).waitFor();
  assert.equal(projects.readProject('birdesengor', scratch).narrator.editorialNote, 'Kaynaklara sadık, kısa paragraflar.');
  await page.locator('.channel-project-entry').filter({ hasText: 'İkinci Kanal' }).getByRole('button', { name: 'Aç', exact: true }).click();
  await page.getByText('Proje açılıyor…', { exact: true }).waitFor();
  // Project activation relaunches production Electron; reload recreates its renderer here.
  await page.reload(); await page.waitForFunction(() => document.querySelector('.project-narrator input')?.value === 'Deniz');
  const secondChoice = page.getByRole('checkbox', { name: /second-character/ });
  await secondChoice.waitFor();
  assert.equal(await ownerChoice().count(), 0);
  await secondChoice.check();
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click(); await page.getByText('Kaydedildi', { exact: true }).waitFor();
  const second = await page.evaluate(() => window.channelFoundryStudio.narrativePrepare());
  assert.equal(second.request.input.narrator.displayName, 'Deniz');
  assert.equal(second.request.input.narrator.editorialNote, 'Yalnız ikinci kanalda.');
  assert.deepEqual(second.request.input.narratorSourceEntities, [{ sourceKey: 'second-character', name: 'Deniz' }]);
  assert.deepEqual(projects.readProject('birdesengor', scratch).narrator.sourceEntityKeys, [ownerKey]);
  await page.screenshot({ path: path.join(out, 'settings-second-channel.png'), fullPage: true });
  await page.locator('.channel-project-entry').filter({ hasText: 'BirDeSenGör' }).locator('button').first().click();
  assert.equal(await name().inputValue(), 'Ömer');
  assert.equal(await page.getByLabel('Anlatım perspektifi', { exact: true }).inputValue(), 'neutral');
  await page.screenshot({ path: path.join(out, 'settings-birdesengor.png'), fullPage: true });
  // A corrupt migration source stays visible and cannot change active identity.
  projects.createProject({ id: 'migration-error', displayName: 'Aktarım hatası olan kanal' }, scratch);
  const brokenFile = path.join(scratch, 'channels/migration-error/channel.json');
  const broken = JSON.parse(fs.readFileSync(brokenFile)); delete broken.narrator;
  fs.writeFileSync(brokenFile, JSON.stringify(broken));
  const brokenDirectory = path.join(scratch, 'channels/migration-error/.local-data/studio');
  fs.mkdirSync(brokenDirectory, { recursive: true });
  fs.writeFileSync(path.join(brokenDirectory, 'channel-foundry-studio.sqlite'), 'Corrupt isolated migration source');
  await page.reload();
  await page.getByRole('button', { name: /Aktarım hatası olan kanal/ }).click();
  await page.getByRole('alert').filter({ hasText: 'Anlatıcı ayarları aktarılamadı.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Kaydet', exact: true }).isDisabled(), true);
  assert.equal(await name().isDisabled(), true);
  assert.equal(projects.activeProjectId(scratch), 'ikinci');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'react-ipc-verification.json'), JSON.stringify({ realDatabaseOpened: false, migration: true, settingsReopened: true, channelIsolation: true, frozenRequest: true, explicitSourceIdentity: true, unresolvedIdentityRemoval: true, subsequentRun: true, journalHasNoNarratorEditor: true, errors }, null, 2));
  console.log('PASS actual React + project/narrative IPC: migration, explicit identity selection/removal, unresolved ID, save/reopen, two-channel isolation, frozen ID/name request, no journal profile editor');
} catch (error) { if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); throw error; }
finally { await browser?.close(); await server?.close(); for (const db of dbs.values()) db.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
