import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import core from './vefk-core/index.cjs';
import store from './vefk-store.cjs';
import publisher from './vefk-publication.cjs';
import fixtures from './vefk-s6-fixtures.cjs';
import phpRunner from './vefk-s6-php-runner.cjs';
import * as reference from '../../docs/contracts/vefk-site-consumer.mjs';
import * as site from '../../channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs';

const phpGate = fileURLToPath(new URL('../../docs/contracts/vefk-s6-php-gate.php', import.meta.url));
function phpCheck(raw) {
  const result = phpRunner.runPhp(['-r', `
    require getenv('S4B_GATE');
    try {
      vefk_s6_validate_publication(json_decode(stream_get_contents(STDIN),false,512,JSON_THROW_ON_ERROR));
      echo json_encode(['ok'=>true]);
    } catch(Throwable $error) {echo json_encode(['ok'=>false,'error'=>$error->getMessage()]);}
  `], {input: JSON.stringify(raw), env: {...process.env, S4B_GATE: phpGate},
    encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}
async function agree(raw, accepted) {
  const before = JSON.stringify(raw);
  if (accepted) assert.equal(publisher.validateCatalog(raw.vefkCatalog).ok, true);
  else assert.throws(() => publisher.validateCatalog(raw.vefkCatalog));
  for (const consumer of [reference, site]) {
    if (accepted) assert.equal((await consumer.readVefkPublication(raw)).status, 'ready');
    else await assert.rejects(consumer.readVefkPublication(raw));
  }
  const result = phpCheck(raw);
  assert.equal(result.ok, accepted, JSON.stringify(result));
  assert.equal(JSON.stringify(raw), before, 'validation must not mutate publication');
}
function approve(db, doc, sortOrder = 0) {
  store.saveDraft(db, {document: doc});
  for (const status of ['checked', 'approved']) store.setReviewState(db, {
    id: doc.id, revision: doc.revision, status, expectedContentHash: doc.contentHash});
  publisher.select(db, {id: doc.id, revision: doc.revision, enabled: true, sortOrder, contentHash: doc.contentHash});
}

test('S4b frozen doc1/catalog1/binding2 export bytes match the pre-S4b publisher', () => {
  // Captured with the unchanged S4a publisher and core, not computed expectations.
  const db = new DatabaseSync(':memory:');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 's4b-frozen-'));
  try {
    const doc = core.createVefk({id: 's4b-frozen-v1', title: 'S4b frozen v1', parameters: {order: 3}});
    approve(db, doc);
    const catalog = publisher.buildCatalog(db);
    assert.equal(catalog.schemaVersion, 1);
    assert.equal(catalog.binding.bindingVersion, 2);
    assert.equal(Object.hasOwn(catalog.binding, 'motion'), false);
    assert.equal(doc.contentHash, 'bcbb45fdebb7ad06f3a57c0940754a19d0ecb552a63a5eda0d2bd803b022e235');
    assert.equal(catalog.entries[0].sha256, '7ba57436629146f90fd7541f5200edb22cc325b1504b9229809d4a513dfee517');
    assert.equal(catalog.fingerprint, 'e7c5d43ac3daa3088a9863fdebb2545bc0e0ad83da8657ab8af4011e7b9f0ae7');
    const exported = publisher.exportCatalog(db, root, catalog);
    assert.equal(fixtures.sha(fs.readFileSync(exported.file)), 'e8f40b658a872b073540b6c9409fa54f39e9e03c63b27a9341ec7a12ecfc3ebe');
  } finally {db.close(); fs.rmSync(root, {recursive: true, force: true});}
});

test('S4b approved mixed Studio catalog preserves doc1 bytes and exports immutable doc2', async () => {
  const db = new DatabaseSync(':memory:');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 's4b-mixed-'));
  try {
    const raw = fixtures.v2Fixture();
    for (const entry of raw.vefkCatalog.entries) approve(db, entry.document, entry.order);
    const catalog = publisher.buildCatalog(db);
    assert.equal(catalog.schemaVersion, 2);
    assert.deepEqual(catalog.binding, publisher.BINDING_V2);
    assert.deepEqual(catalog.entries.map(e => e.document.schemaVersion), [1, 2]);
    const exported = publisher.exportCatalog(db, root, catalog);
    for (const entry of catalog.entries) {
      const bytes = fs.readFileSync(path.join(root, 'public-export/content', entry.url));
      assert.equal(fixtures.sha(bytes), entry.sha256);
      assert.deepEqual(core.parseVefk(bytes.toString()), entry.document);
      assert.equal(store.getDocument(db, entry.id).status, 'approved');
    }
    assert.deepEqual(JSON.parse(fs.readFileSync(exported.file)), catalog);
    raw.vefkCatalog = catalog; fixtures.rehashTop(raw);
    await agree(raw, true);
    const doc = catalog.entries[1].document;
    assert.equal(Object.isFrozen(store.getDocument(db, doc.id).document.drawPlan), true);
    const edited = structuredClone(doc); edited.drawPlan.strokes[0].easing = 'ease-out';
    assert.throws(() => store.saveDraft(db, {document: edited, expectedContentHash: doc.contentHash}), /contentHash/);
    edited.contentHash = core.documentHash(edited);
    assert.throws(() => store.saveDraft(db, {document: edited, expectedContentHash: doc.contentHash}), /değiştirilemez/);
  } finally {db.close(); fs.rmSync(root, {recursive: true, force: true});}
});

for (const manual of [false, true]) {
  for (const easing of ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'omitted']) {
    test(`S4b four validators accept ${manual ? 'multi-M/Z' : 'fresh 3x3'} ${easing} in mixed catalog2`, async () => {
      const raw = fixtures.v2Fixture({manual, easing});
      raw.vefkCatalog.entries.forEach(e => assert.equal(core.validateVefk(e.document).ok, true));
      await agree(raw, true);
      const doc = raw.vefkCatalog.entries.at(-1).document;
      const a = reference.createVefkPlayer(doc), b = site.createVefkPlayer(doc);
      for (let i = 0; i <= 200; i++) {
        const t = doc.drawPlan.durationMs * i / 200;
        assert.deepEqual(a.frameAt(t), b.frameAt(t));
      }
    });
  }
}
test('S4b catalog2 permits doc1-only input while Studio continues to emit catalog1', async () => {
  const raw = fixtures.fixture();
  raw.vefkCatalog.schemaVersion = 2;
  raw.vefkCatalog.binding = structuredClone(publisher.BINDING_V2);
  await agree(fixtures.rehash(raw), true);
});
for (const [name, mutate] of fixtures.v2Attacks) {
  test(`S4b all validators fail closed after full rehash: ${name}`, async () => {
    const raw = fixtures.v2Fixture(); mutate(raw); fixtures.rehash(raw);
    await agree(raw, false);
  });
}
test('S4b catalog1 rejects binding3 capability even with doc1 only', async () => {
  const raw = fixtures.fixture(); raw.vefkCatalog.binding = structuredClone(publisher.BINDING_V2);
  await agree(fixtures.rehash(raw), false);
});
test('S4b stale semantic, file, catalog and publication hashes are rejected', async () => {
  for (const mutate of [
    r => {r.vefkCatalog.entries.at(-1).document.drawPlan.strokes[0].easing = 'ease-out';},
    r => {r.vefkCatalog.entries.at(-1).sha256 = '0'.repeat(64);},
    r => {r.vefkCatalog.fingerprint = '0'.repeat(64);},
  ]) {
    const raw = fixtures.v2Fixture(); mutate(raw); fixtures.rehashTop(raw);
    await agree(raw, false);
  }
  const raw = fixtures.v2Fixture(); raw.publication.contentFingerprint = '0'.repeat(64);
  for (const consumer of [reference, site]) await assert.rejects(consumer.readVefkPublication(raw));
  assert.equal(phpCheck(raw).ok, false);
});
test('S4b 32-entry and 5MiB limits stay strict in all validators', async () => {
  const raw = fixtures.v2Fixture(); raw.vefkCatalog.entries = Array(33).fill(raw.vefkCatalog.entries[0]);
  await agree(fixtures.rehash(raw), false);
  const oversized = fixtures.v2Fixture();
  oversized.vefkCatalog.entries.at(-1).document.description = 'x'.repeat(5 * 1024 * 1024);
  await agree(fixtures.rehash(oversized), false);
});
test('S4b store updates explicit doc2 drafts with optimistic hashes and preserves version on reload', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const doc = fixtures.v2Fixture({mixed: false}).vefkCatalog.entries[0].document;
    store.saveDraft(db, {document: doc});
    const edited = structuredClone(doc); edited.drawPlan.strokes[0].easing = 'ease-out';
    edited.contentHash = core.documentHash(edited);
    assert.throws(() => store.saveDraft(db, {document: edited}), /eşleşmiyor/);
    store.saveDraft(db, {document: edited, expectedContentHash: doc.contentHash});
    assert.deepEqual(store.getDocument(db, doc.id).document, edited);
    assert.equal(store.listRevisions(db, doc.id).length, 1);
    const bad = structuredClone(edited); bad.drawPlan.strokes[0].easing = 'unknown';
    bad.contentHash = core.documentHash(bad);
    assert.throws(() => store.saveDraft(db, {document: bad, expectedContentHash: edited.contentHash}), /easing/);
    assert.deepEqual(store.getDocument(db, doc.id).document, edited);
  } finally {db.close();}
});

test('S4b Studio allows exactly 32 approved selections and rejects a 33rd', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (let i = 0; i < 32; i++) approve(db, core.createVefk({
      id: `s4b-limit-${String(i).padStart(2, '0')}`, title: 'Synthetic limit test',
      schemaVersion: i % 2 ? 2 : 1, parameters: {order: 3}}), i);
    const raw = fixtures.fixture(); raw.vefkCatalog = publisher.buildCatalog(db);
    assert.equal(raw.vefkCatalog.entries.length, 32);
    await agree(fixtures.rehashTop(raw), true);
    assert.throws(() => approve(db, core.createVefk({id: 's4b-limit-extra',
      title: 'One too many', schemaVersion: 2, parameters: {order: 3}})), /32/);
    assert.equal(publisher.selected(db).length, 32);
  } finally {db.close();}
});

test('S4b Studio rejects a catalog exceeding 5MiB built from individually valid approved doc2', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const geometry = {coordinateSpace: 'svg-viewBox', viewBox: [0,0,1000,1000],
      inkStyles: {glyph: {width: 5, cap: 'round'}},
      paths: Array.from({length: 40}, (_, i) => ({id: `mark.${i}`, ink: 'glyph',
        d: 'M 1 1 ' + Array(800).fill('L 2 2').join(' ')}))};
    for (let i = 0; i < 32; i++) approve(db, core.createVefk({
      id: `s4b-size-${String(i).padStart(2, '0')}`, title: 'Synthetic size test',
      schemaVersion: 2, kind: 'manualPaths', geometry}), i);
    assert.throws(() => publisher.buildCatalog(db), /5 MB/);
    assert.equal(publisher.selected(db).length, 32);
  } finally {db.close();}
});
