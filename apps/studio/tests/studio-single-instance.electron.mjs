/** Native Electron startup regression. Uses private lock/data folders only.
 * Run: node apps/studio/tests/studio-single-instance.electron.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { _electron: electron } = createRequire(new URL('../../../channels/birdesengor/web/package.json', import.meta.url))('playwright-core');
const studio = fileURLToPath(new URL('../', import.meta.url));
const executablePath = require('electron');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-single-instance-'));
const lock = path.join(root, 'application-lock');
fs.mkdirSync(lock);
const bootstrap = path.join(root, 'bootstrap.cjs');
// Isolate the application-wide lock; run the real production entry point.
fs.writeFileSync(bootstrap, `const { app } = require('electron');\napp.setPath('userData', process.env.STUDIO_TEST_LOCK);\nrequire(${JSON.stringify(path.join(studio, 'main.cjs'))});\n`);
const env = { ...process.env, STUDIO_TEST_LOCK: lock, CHANNEL_FOUNDRY_DATA_ROOT: path.join(root, 'first-channel') };
delete env.ELECTRON_RUN_AS_NODE;
delete env.CHANNEL_FOUNDRY_DEV_SERVER_URL;
delete env.CHANNEL_FOUNDRY_START_PROJECT;
let primary;
async function start(dataRoot) {
  const app = await electron.launch({ executablePath, args: [bootstrap, '--no-sandbox'], env: { ...env, CHANNEL_FOUNDRY_DATA_ROOT: dataRoot }, timeout: 30000 });
  primary = app;
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.studio-shell').waitFor();
  assert.equal(await app.evaluate(({ app }) => app.hasSingleInstanceLock()), true);
  return page;
}
async function stop() {
  if (!primary) return;
  await primary.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await primary.close().catch(() => {});
  primary = null;
}
function duplicate(dataRoot, startupProject) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, [bootstrap, '--no-sandbox'], { env: { ...env, CHANNEL_FOUNDRY_DATA_ROOT: dataRoot, ...(startupProject ? { CHANNEL_FOUNDRY_START_PROJECT: startupProject } : {}) }, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-3000); });
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Second instance did not exit: ' + stderr)); }, 15000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timeout); if (code !== 0 || signal) reject(new Error(`Second instance exit ${code}/${signal}: ${stderr}`)); else resolve(); });
  });
}
try {
  const page = await start(env.CHANNEL_FOUNDRY_DATA_ROOT);
  const originalWindow = await primary.evaluate(({ BrowserWindow, app }) => {
    app.__secondaryLaunches = 0;
    app.on('second-instance', () => { app.__secondaryLaunches++; });
    const window = BrowserWindow.getAllWindows()[0]; window.minimize(); return window.id;
  });
  await page.evaluate(() => { window.__singleInstanceSentinel = 'unsaved UI preserved'; });
  await duplicate(env.CHANNEL_FOUNDRY_DATA_ROOT);
  assert.deepEqual(await primary.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows();
    return { count: windows.length, id: windows[0].id, minimized: windows[0].isMinimized(), visible: windows[0].isVisible(), focused: windows[0].isFocused() };
  }), { count: 1, id: originalWindow, minimized: false, visible: true, focused: true });
  assert.equal(await page.evaluate(() => window.__singleInstanceSentinel), 'unsaved UI preserved');

  await primary.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
  const otherChannel = path.join(root, 'other-channel');
  await duplicate(otherChannel, 'nonexistent-startup-channel');
  assert.equal(fs.existsSync(otherChannel), false, 'Rejected launch must not create data folders or databases');
  assert.equal(await primary.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  assert.equal(await primary.evaluate(({ app }) => app.getPath('userData')), path.join(env.CHANNEL_FOUNDRY_DATA_ROOT, 'studio'));

  await Promise.all([duplicate(otherChannel), duplicate(otherChannel), duplicate(otherChannel)]);
  assert.equal(await primary.evaluate(({ app }) => app.__secondaryLaunches), 5);
  assert.equal(await primary.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  assert.equal(await page.evaluate(() => window.__singleInstanceSentinel), 'unsaved UI preserved');

  await stop();
  await start(otherChannel);
  assert.equal(await primary.evaluate(({ app }) => app.getPath('userData')), path.join(otherChannel, 'studio'));
  console.log('PASS: duplicate exits; minimized/hidden window restored and focused; channel-wide lock; concurrent launches; UI preserved; lock released on quit.');
} finally {
  await stop();
  fs.rmSync(root, { recursive: true, force: true });
}
