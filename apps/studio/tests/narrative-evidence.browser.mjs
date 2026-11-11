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
const outlineStore = require('../narrative-outline.cjs');
// Disposable fixture only: verify the second form row with an actual chapter.
const testSeries=outlineStore.saveSeries(db,{title:'Deneme Dizisi',description:'Deneme açıklaması',position:0});
outlineStore.saveChapter(db,{seriesKey:testSeries.key,title:'Deneme Bölümü',numberLabel:'1. Bölüm',position:0});
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
  for (const width of [1920,1366,390]) for (const theme of ['light','dark']) {
    await page.setViewportSize({width,height:900});
    await page.goto(server.resolvedUrls.local[0],{waitUntil:'networkidle'});
    await page.evaluate(theme=>{document.documentElement.dataset.studioTheme=theme},theme);
    await page.getByRole('tab',{name:/Anlatı/}).waitFor();
    assert.equal(await page.locator('.narrative-gate').count(),0,'Duplicated lower control row must be removed');
    const headerLayout=await page.evaluate(()=>{
      const header=document.querySelector('.narrative-header').getBoundingClientRect();
      const actions=document.querySelector('.narrative-header-actions').getBoundingClientRect();
      return {headerHeight:header.height,actionsRight:actions.right,headerRight:header.right,actionsTop:actions.top,headerTop:header.top,actionsBottom:actions.bottom,headerBottom:header.bottom,buttonCount:document.querySelectorAll('.narrative-header-actions button').length};
    });
    assert(headerLayout.actionsRight<=headerLayout.headerRight+2 && headerLayout.actionsTop>=headerLayout.headerTop-2 && headerLayout.actionsBottom<=headerLayout.headerBottom+2,JSON.stringify(headerLayout));
    assert(headerLayout.buttonCount>0,'Narrative phase action must stay in the header');
    const cards=page.locator('.narrative-draft-card');
    assert.equal(await cards.count(),3);
    const body=await cards.first().locator('.narrative-body').innerText();
    assert.equal(body,permission,'Narrative body must remain unchanged');
    assert.equal(await page.getByText('Bu aşama yalnız onaylı Evren gerçeklerini').count(),0);
    assert.equal(await page.getByText('Hazırlama işlemi approved Evreni').count(),0);
    assert.equal(await page.locator('.narrative-next-stage').count(),0);
    const controls=await page.evaluate(()=>{
      const c=document.querySelector('.narrative-control-panel').getBoundingClientRect();
      const shell=document.querySelector('.narrative-workbench');
      const tabs=document.querySelector('.narrative-view-tabs').getBoundingClientRect();
      return {height:c.height,tabs:tabs.height,outerScroll:shell.scrollHeight-shell.clientHeight,overflow:document.querySelector('.ai-stage-content').scrollWidth>innerWidth-24+1};
    });
    assert(controls.height<(width<780?370:230) && controls.tabs<=(width<520?90:48),JSON.stringify(controls));
    assert(controls.outerScroll<=2 && !controls.overflow,JSON.stringify(controls));
    const proseLayout=await cards.first().evaluate(card=>{
      const paragraph=card.querySelector('.narrative-body');
      const body=paragraph.getBoundingClientRect(), panel=card.getBoundingClientRect();
      const reading=card.closest('.narrative-reading-view');
      const cardStyle=getComputedStyle(card);
      return {bodyWidth:body.width,cardWidth:panel.width,cardBackground:cardStyle.backgroundColor,areaBackground:getComputedStyle(reading).backgroundColor,cardBorderLeft:parseFloat(cardStyle.borderLeftWidth),technicalLabels:card.querySelectorAll('code').length};
    });
    assert(proseLayout.bodyWidth>proseLayout.cardWidth*.84 && proseLayout.cardBackground!==proseLayout.areaBackground && proseLayout.cardBorderLeft>=3 && proseLayout.technicalLabels===0,JSON.stringify({width,theme,proseLayout}));
    await page.screenshot({path:path.join(out,'reading-'+theme+'-'+width+'.png')});
    await page.getByRole('tab',{name:/Kaynaklar/}).click();
    const ledgers=page.locator('.narrative-source-entry .narrative-evidence-ledger');
    assert.equal(await ledgers.count(),3);
    const evidence=ledgers.first();
    await evidence.getByText('Genel bağlam',{exact:true}).first().waitFor();
    const entry=evidence.locator('.narrative-ledger-entries>li').filter({hasText:permission});
    assert.equal(await entry.count(),1);
    assert.equal(await entry.locator('code').count(),0,'Raw video IDs must not be visible');
    assert.equal(await entry.locator('.narrative-ledger-specific .narrative-ledger-videos li').count(),1,'Detail attribution must remain exact');
    assert.ok((await entry.innerText()).includes('Mor Sıvı — Kaynak Video'));
    assert.equal(await evidence.locator('.narrative-ledger-related .narrative-ledger-videos li').count(),4,'General video links must remain distinct from per-detail attribution');
    assert.equal(await page.locator('.narrative-sources-view code').count(),0,'No raw record or video keys on sources view');
    assert.equal(await page.getByText('Frozen',{exact:true}).count(),0);
    assert.equal(await page.getByText('NEW',{exact:true}).count(),0);
    assert(!(await page.locator('.narrative-sources-view').innerText()).includes('I8ec5jhbTH4'),'Video ID must not appear in visible text');
    const unmapped=evidence.locator('.narrative-ledger-entries>li').filter({hasText:'Video eşlemesi olmayan ayrıntı.'});
    assert.equal(await unmapped.locator('.narrative-ledger-specific .narrative-ledger-videos li').count(),0);
    assert.ok((await unmapped.innerText()).includes('doğrudan eşleşen video belirtilmemiş'));
    assert.ok((await ledgers.nth(1).innerText()).includes('yalnız genel bağlam incelenebilir'));
    const measure=await evidence.evaluate(node=>{
      const el=node.querySelector('.narrative-ledger-text'),sty=getComputedStyle(el);
      const bg=getComputedStyle(node.querySelector('.narrative-ledger-node')).backgroundColor;
      const l=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);
      return {fontSize:parseFloat(sty.fontSize),contrast:(Math.max(l(sty.color),l(bg))+.05)/(Math.min(l(sty.color),l(bg))+.05),overflow:node.scrollWidth>node.clientWidth+1};
    });
    assert(measure.fontSize>=14 && measure.contrast>=4.5 && !measure.overflow,JSON.stringify({width,theme,measure}));
    assert.equal(await page.locator('.narrative-workbench details').count(),0,'Stage 05 must not have collapsible panels');
    await page.screenshot({path:path.join(out,'sources-'+theme+'-'+width+'.png')});
    await page.getByRole('tab',{name:/İçindekiler/}).click();
    await page.locator('.narrative-outline-workspace').waitFor();
    await page.getByRole('button',{name:'Önerileri getir'}).waitFor();
    await page.getByRole('button',{name:'Dizi ekle'}).waitFor();
    for(const obsolete of ['GÜNLÜK DÜZENİ','Kitaptaki sıralama','Kitapta otomatik','Video başlıklarından bölüm önerileri']) {
      assert.equal(await page.getByText(obsolete,{exact:true}).count(),0,obsolete+' should be removed');
    }
    assert.equal(await page.locator('.narrative-outline details, .outline-help, .narrative-outline-intro').count(),0);
    const outlineLayout=await page.locator('.narrative-outline').evaluate(root=>{
      const rect=selector=>{const el=root.querySelector(selector);const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};};
      return {
        tree:rect('.narrative-outline-tree'),edit:rect('.narrative-outline-edit-pane'),
        leftAction:rect('.narrative-outline-tree .outline-panel-toolbar button'),
        rightAction:rect('.narrative-outline-edit-pane .outline-panel-toolbar button'),
        description:rect('.outline-series-fields .outline-field-description'),
        position:rect('.outline-series-fields .outline-field-position'),
        save:rect('.outline-series-fields .outline-field-save'),
        row:rect('.outline-series-fields .outline-edit-detail-row')
      };
    });
    assert(outlineLayout.tree.scrollWidth<=outlineLayout.tree.clientWidth+2 && outlineLayout.edit.scrollWidth<=outlineLayout.edit.clientWidth+2,JSON.stringify({width,theme,outlineLayout}));
    if(width>780){
      assert(Math.abs(outlineLayout.tree.width-outlineLayout.edit.width)<5,'Both work panels must have matching width');
      assert(Math.abs(outlineLayout.leftAction.y-outlineLayout.rightAction.y)<3,'Action buttons must share the same toolbar row');
      assert(Math.abs(outlineLayout.description.y-outlineLayout.position.y)<3 && Math.abs(outlineLayout.position.bottom-outlineLayout.save.bottom)<3,'Series description / position / save must be on one row');
      assert(outlineLayout.save.right<=outlineLayout.edit.right-5,'Save button must fit into right panel');
    }
    await page.locator('[data-outline-node="series"] .outline-node-title').first().click();
    await page.getByLabel('Bölüm sırası',{exact:true}).waitFor();
    const chapterLayout=await page.locator('.outline-chapter-fields .outline-edit-detail-row').evaluate(row=>{
      const rect=sel=>{const r=row.querySelector(sel).getBoundingClientRect();return {y:r.y,bottom:r.bottom,right:r.right}};
      return {label:rect('.outline-field-description'),order:rect('.outline-field-position'),save:rect('.outline-field-save'),scrollWidth:row.scrollWidth,clientWidth:row.clientWidth};
    });
    assert(chapterLayout.scrollWidth<=chapterLayout.clientWidth+2,JSON.stringify({width,theme,chapterLayout}));
    if(width>780)assert(Math.abs(chapterLayout.label.y-chapterLayout.order.y)<3 && Math.abs(chapterLayout.order.bottom-chapterLayout.save.bottom)<3,'Chapter label/order/save must share a row');
    assert.equal(await page.locator('.narrative-outline details').count(),0);
    await page.screenshot({path:path.join(out,'outline-'+theme+'-'+width+'.png')});
    assert.equal(await page.getByRole('tab',{name:'Çeviriler'}).count(),0,'Translations belong to Yayınlama, not Hikâyeleştir');
    assert.equal(await page.locator('.publication-language-editor').count(),0,'Stage 05 must not mount publication language editors');
    results.push({width,theme,controls,measure});
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ results, errors, realDatabaseOpened: false }, null, 2));
  console.log('PASS Stage05 React/IPC: compact top bar, no disclosure panels, direct content tabs, safe evidence ledger, translations isolated to Publishing and outline; 1920/1366/390 light/dark. Artifacts:', out);
} catch (error) {
  if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  console.error('Browser verification did not pass. Artifacts:', out);
  throw error;
} finally {
  await browser?.close(); await server?.close(); db.close(); fs.rmSync(scratch, { recursive: true, force: true });
}
