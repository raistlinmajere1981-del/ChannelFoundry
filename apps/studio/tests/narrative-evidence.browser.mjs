/** Production React + read-only production IPC; all data and output in tmp. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const repo = path.resolve(import.meta.dirname, '../../..'), studio = path.join(repo, 'apps/studio');
const { createServer } = require('vite');
// Reuse the installed browser-test dependency; no nested project commands/writes.
const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : createRequire(path.join(repo, 'channels/birdesengor/web/package.json'))('playwright-core');
const { createFixture, permission } = require('./fixtures/narrative-evidence.cjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'narrative-evidence-browser-'));
const out = process.env.NARRATIVE_EVIDENCE_ARTIFACTS || fs.mkdtempSync(path.join(os.tmpdir(), 'narrative-evidence-artifacts-'));
fs.mkdirSync(out, { recursive: true });
const { db } = createFixture(scratch);
const handlers = new Map();
require('../narrative-ipc.cjs').registerNarrativeIpc({ handle: (name, fn) => handlers.set(name, fn) }, { database: () => db });
const methods = { narrativeStatus: 'studio:narrative-status', narrativeOutlineStatus: 'studio:narrative-outline-status' };
const errors = [], results = [];
let server, browser, page;
try {
  fs.symlinkSync(path.join(repo, 'node_modules'), path.join(scratch, 'node_modules'));
  fs.writeFileSync(path.join(scratch, 'index.html'), '<html lang="tr"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>');
  fs.writeFileSync(path.join(scratch, 'entry.tsx'), [
    "import React from 'react';import{createRoot}from'react-dom/client';",
    `import Narrative from '/@fs/${studio}/src/NarrativeWorkbench.tsx';`,
    ...['studio-theme-tokens.css', 'styles.css', 'pipeline.css', 'studio-accessibility.css', 'studio-theme-bindings.css', 'studio-workspace-system.css', 'studio-fixed-viewport.css'].map(name => `import '/@fs/${studio}/src/${name}';`),
    `window.channelFoundryStudio=Object.fromEntries(${JSON.stringify(Object.keys(methods))}.map(name=>[name,()=>window.__read(name)]));window.channelFoundryStudio.onDataChanged=()=>()=>{};`,
    "document.body.style.cssText='margin:0;padding:12px;background:var(--surface-canvas)';document.documentElement.dataset.studioTextSize='large';",
    "document.documentElement.dataset.studioTheme='light';createRoot(document.getElementById('root')).render(<div className='studio-shell' style={{display:'block',width:'100%',minWidth:0}}><div className='ai-stage-content' style={{display:'block',height:'calc(100dvh - 24px)',width:'100%',overflow:'auto'}}><Narrative/></div></div>);",
  ].join('\n'));
  server = await createServer({ configFile: false, root: scratch, cacheDir: path.join(scratch, '.vite'), logLevel: 'error', esbuild: { jsx: 'automatic' }, resolve: { dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 0, fs: { allow: [studio, path.join(repo, 'node_modules'), scratch] } } });
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? path.join(os.homedir(), '.claude-server-commander/puppeteer-cache/chrome/linux-155.0.8059.39/chrome-linux64/chrome'), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  page = await browser.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.exposeFunction('__read', name => {
    assert.ok(Object.hasOwn(methods, name), 'Only read-only IPC is exposed');
    return handlers.get(methods[name])({});
  });
  for (const width of [1920, 1366, 390]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' });
    const cards = page.locator('.narrative-draft-card');
    await cards.first().waitFor();
    await page.evaluate(theme => { document.documentElement.dataset.studioTheme = theme; }, theme);
    assert.equal(await cards.count(), 3);
    const card = cards.first(), details = card.locator('.narrative-evidence-ledger'), toggle = details.locator('summary');
    const body = await card.locator('.narrative-body').innerText();
    assert.equal(body, permission);
    assert.equal(await details.evaluate(node => node.open), false);
    assert.equal(await details.locator('.narrative-ledger-content').isVisible(), false);
    await toggle.click();
    assert.equal(await details.evaluate(node => node.open), true);
    const entry = details.locator('.narrative-ledger-entries > li').filter({ hasText: permission });
    assert.equal(await entry.count(), 1);
    assert.deepEqual(await entry.locator('code').allTextContents(), ['I8ec5jhbTH4']);
    assert.ok((await entry.innerText()).includes('Mor Sıvı — Kaynak Video'));
    assert.equal(await details.locator('.narrative-ledger-context code').count(), 4);
    assert.ok((await details.innerText()).includes('Genel bağlam · özgül ayrıntı kanıtı değil'));
    const unmapped = details.locator('.narrative-ledger-entries > li').filter({ hasText: 'Video eşlemesi olmayan ayrıntı.' });
    assert.equal(await unmapped.locator('code').count(), 0);
    assert.ok((await unmapped.innerText()).includes('özgül video eşlemesi yok'));
    assert.equal((await details.innerText()).includes('TASLAĞA AİT OLMAYAN'), false);
    assert.equal((await details.innerText()).includes('OLAY DEĞİLDİR'), false);
    assert.equal(await card.locator('.narrative-body').innerText(), body);
    const reading = await card.locator('.narrative-body').innerText();
    for (const metadata of ['Genel bağlam', 'I8ec5jhbTH4', 'Kaynak Video', 'Frozen kaynak izi']) assert.equal(reading.includes(metadata), false);
    const fallback = cards.nth(1).locator('.narrative-evidence-ledger');
    await fallback.locator('summary').click();
    assert.ok((await fallback.innerText()).includes('yalnız genel bağlam incelenebilir'));
    assert.equal(await fallback.locator('.narrative-ledger-entries').count(), 0);
    assert.equal(await fallback.locator('.narrative-ledger-node').count(), 1);
    const layout = await details.evaluate(node => {
      const content = node.querySelector('.narrative-ledger-text'), style = getComputedStyle(content);
      const background = getComputedStyle(node.querySelector('.narrative-ledger-node')).backgroundColor;
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const a = luminance(style.color), b = luminance(background);
      return { fontSize: parseFloat(style.fontSize), foreground: style.color, background, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), overflow: node.scrollWidth > node.clientWidth + 1, viewportOverflow: document.querySelector('.ai-stage-content').scrollWidth > innerWidth - 24 + 1 };
    });
    assert.ok(layout.fontSize >= 14, JSON.stringify(layout));
    assert.ok(layout.contrast >= 4.5, JSON.stringify(layout));
    assert.equal(layout.overflow, false, JSON.stringify(layout));
    assert.equal(layout.viewportOverflow, false, JSON.stringify(layout));
    await details.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `evidence-${theme}-${width}.png`), fullPage: true });
    // Keyboard collapse/reopen/collapse; reader text must stay unchanged.
    await toggle.focus(); await page.keyboard.press('Enter');
    assert.equal(await details.evaluate(node => node.open), false);
    await page.keyboard.press('Enter'); assert.equal(await details.evaluate(node => node.open), true);
    await toggle.click(); assert.equal(await details.evaluate(node => node.open), false);
    assert.equal(await card.locator('.narrative-body').innerText(), body);
    results.push({ width, theme, ...layout });
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ results, errors, realDatabaseOpened: false }, null, 2));
  console.log('PASS Stage4.3 React/IPC evidence ledger: 1920/1366/390 light/dark, collapsed by default, mouse/keyboard toggle, exact detail video IDs, summary fallback and reader separation. Artifacts:', out);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  console.error('Browser verification did not pass. Artifacts:', out);
  throw error;
} finally {
  await browser?.close(); await server?.close(); db.close(); fs.rmSync(scratch, { recursive: true, force: true });
}
