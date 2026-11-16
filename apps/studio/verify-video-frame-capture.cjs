'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { DatabaseSync } = require('node:sqlite');
const frames = require('./video-frame-capture.cjs');
const refs = require('./visual-references.cjs');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-frame-test-'));
  const db = new DatabaseSync(':memory:');
  try {
    db.exec("CREATE TABLE youtube_videos (video_id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_seconds INTEGER) STRICT");
    db.prepare('INSERT INTO youtube_videos VALUES(?,?,?)').run('abcDEFghi01', 'Sahne kaynağı', 620);
    assert.throws(() => frames.videoIdOf({ videoId: 'https://example.com' }), /YouTube/);
    assert.throws(() => frames.secondsOf({ seconds: -1 }), /Zaman/);
    assert.throws(() => frames.validateCatalog(db, 'abcDEFghi01', 621), /video süresini/);
    const stub = async (command, args) => {
      if (String(command).includes('yt-dlp')) return { stdout: 'https://example.com/fake-video-url\n' };
      assert.equal(command, 'ffmpeg');
      await sharp({ create: { width: 640, height: 360, channels: 3, background: '#999999' } })
        .jpeg().toFile(args[args.length - 1]);
      return { stdout: '' };
    };
    const image = await frames.captureFrame(db, root, { videoId: 'abcDEFghi01', seconds: 65 }, { run: stub });
    assert.match(image.imageDataUrl, /^data:image\/jpeg;base64,/);
    assert.equal(image.seconds, 65);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='visual_reference_links'").get().n, 0);
    const saved = await frames.acceptFrame(db, root, { entityKey: 'character:sample', previewId: image.previewId });
    assert.equal(saved.reference.sourceVideoId, 'abcDEFghi01');
    assert.equal(saved.reference.sourceSeconds, 65);
    assert.match(saved.reference.imageDataUrl, /^data:image\/webp;base64,/);
    assert.equal(refs.get(db, root, 'character:sample').sourceSeconds, 65);
    await assert.rejects(frames.acceptFrame(db, root, { entityKey: 'character:sample', previewId: image.previewId }), /bulunamadı/);
    const partial = await frames.captureFrame(db, root, { videoId: 'abcDEFghi01', seconds: 66 }, { run: stub });
    await assert.rejects(frames.acceptFrame(db, root, { entityKey: 'object:crop', previewId: partial.previewId, crop: {x: .99,y:0,width:.3,height:1} }), /Kırpma alanı/);
    const cropped = await frames.acceptFrame(db, root, {entityKey:'object:crop',previewId: partial.previewId,
      crop:{x:.25,y:.2,width:.5,height:.5}});
    const meta=await sharp(cropped.reference.imagePath).metadata();
    assert.ok(meta.width <= 330 && meta.width >= 310);
    assert.ok(meta.height <= 190 && meta.height >= 175);
    assert.equal(cropped.reference.crop.x,.25);
    const other = await frames.captureFrame(db, root, { videoId: 'abcDEFghi01', seconds: 67 }, { run: stub });
    assert.equal(frames.discardFrame({ previewId: other.previewId }), true);
    assert.equal(frames.discardFrame({ previewId: other.previewId }), false);
    console.log('Video frame preview, confirmation, provenance, cleanup and validation verified.');
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
