'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { DatabaseSync } = require('node:sqlite');
const presets = require('./visual-presets.cjs');
const references = require('./visual-references.cjs');
const visualProfiles = require('./visual-profiles.cjs');
const cli = require('./ai-cli.cjs');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bir-desengor-visual-'));
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE studio_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT");
    const settings = presets.get(db);
    assert.equal(settings.defaultId, 'journal-pencil');
    assert.equal(settings.presets.length, 3);
    const custom = { ...settings, defaultId: 'journal-portrait',
      presets: settings.presets.map(p => p.id === 'journal-portrait' ? { ...p, instruction: p.instruction + ' kaynak korunsun' } : p) };
    presets.save(db, custom);
    assert.equal(presets.get(db).defaultId, 'journal-portrait');
    const composed = presets.compose(db, 'journal-pencil', 'Ömer: kapüşonlu, yüz görünmez', 'rötuş');
    assert.match(composed.prompt, /kapüşonlu, yüz görünmez/);
    assert.match(composed.prompt, /gerçekçi grafit karakalem/);
    assert.match(composed.negativePrompt, /rötuş/);
    assert.throws(() => presets.save(db, { defaultId: 'missing', presets: custom.presets }), /Varsayılan/);

    visualProfiles.ensureSchema(db, root);
    const source = path.join(root, 'video-frame.webp');
    await sharp({ create: { width: 96, height: 64, channels: 3, background: '#999999' } }).webp().toFile(source);
    const first = visualProfiles.targetFile(root, 'character:test', '.webp');
    fs.copyFileSync(source, first);
    const ref1 = references.attach(db, root, 'character:test', first, 'video-original');
    assert.match(ref1.imageDataUrl, /^data:image\/webp;base64,/);
    assert.equal(ref1.sourceVideoId, 'video-original');
    const second = visualProfiles.targetFile(root, 'character:test', '.webp');
    fs.copyFileSync(source, second);
    references.attach(db, root, 'character:test', second, 'video-new');
    assert.equal(fs.existsSync(first), false);
    assert.equal(references.get(db, root, 'character:test', false).sourceVideoId, 'video-new');

    const generated = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#777777' } }).png().toBuffer();
    let consumed = false;
    const image = await cli.requestImageGeneration({ imageModel: 'gpt-second', imageReasoningEffort: '' },
      'Ömer karakalem portresi', {
        command: '/nonexistent/test-cli',
        referenceImagePath: second,
        sessionRunner: async options => {
          assert.notEqual(options.referenceImagePath, second);
          assert.equal(path.basename(options.referenceImagePath), 'reference-frame.webp');
          assert.deepEqual(fs.readFileSync(options.referenceImagePath), fs.readFileSync(second));
          assert.equal(options.prompt.includes('Ömer karakalem portresi'), true);
          consumed = true;
          return { item: { type: 'imageGeneration', status: 'completed', result: generated.toString('base64') },
            controllerModel: 'gpt-second' };
        },
      });
    assert.equal(consumed, true);
    assert.equal(image.extension, '.png');
    assert.equal(image.buffer.length, generated.length);
    assert.equal(references.clear(db, root, 'character:test').cleared, true);
    assert.equal(references.get(db, root, 'character:test'), null);
    assert.equal(fs.existsSync(second), false);
    console.log('Visual presets, reference archive and Codex image transport verified.');
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
