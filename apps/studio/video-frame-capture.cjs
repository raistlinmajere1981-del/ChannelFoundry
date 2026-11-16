'use strict';

// Read-only preview and explicitly confirmed attachment. No video downloads,
// narrative writes, publication changes or background generation.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ytDlpManager = require('./ytdlp-manager.cjs');
const profiles = require('./visual-profiles.cjs');
const references = require('./visual-references.cjs');
const { optimizeImage } = require('./visual-image-optimizer.cjs');
const sharp = require('sharp');

const execFileAsync = promisify(execFile);
const previews = new Map();
const MAX_PREVIEWS = 8;
const TTL_MS = 15 * 60 * 1000;

function videoIdOf(input) {
  const id = String(input?.videoId ?? '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Geçerli bir YouTube video kimliği seçilmeli.');
  return id;
}
function secondsOf(input) {
  const value = Number(input?.seconds);
  if (!Number.isFinite(value) || value < 0 || value > 6 * 3600) throw new Error('Zaman 0 ile 6 saat arasında olmalı.');
  return Math.round(value * 10) / 10;
}
function validateCatalog(db, videoId, seconds) {
  const video = db.prepare('SELECT video_id AS videoId, title, duration_seconds AS durationSeconds FROM youtube_videos WHERE video_id = ?').get(videoId);
  if (!video) throw new Error('Video, Studio kaynak arşivinde bulunamadı.');
  if (video.durationSeconds != null && seconds >= video.durationSeconds) throw new Error('Seçilen zaman video süresini aşıyor.');
  return video;
}
function prunePreviews() {
  const now = Date.now();
  for (const [id, item] of previews) {
    if (item.expiresAt <= now || previews.size > MAX_PREVIEWS) {
      previews.delete(id);
      try { fs.unlinkSync(item.file); } catch {}
    }
  }
}
function processError(error, tool) {
  const msg = String(error?.stderr || error?.message || error || '').slice(0, 700);
  if (/403|429|sign in|login|unavailable|bot|cookies/i.test(msg)) {
    return new Error('Kaynak videoya erişilemedi veya YouTube sınırlaması var. Kareyi dosyadan ekleme seçeneği kullanılabilir. (' + tool + ')');
  }
  return new Error(tool + ' kare çıkaramadı. Video erişimini ve zamanı kontrol et. ' + msg);
}
async function captureFrame(db, userDataPath, input, { run = execFileAsync } = {}) {
  prunePreviews();
  const videoId = videoIdOf(input);
  const seconds = secondsOf(input);
  const video = validateCatalog(db, videoId, seconds);
  const url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId);
  let streamUrl;
  try {
    const { stdout } = await run(ytDlpManager.executablePath(), [
      '--no-playlist', '--no-warnings', '--skip-download',
      '-f', 'bv*[height<=720]/b[height<=720]/best',
      '--get-url', url,
    ], { timeout: 45000, maxBuffer: 256 * 1024, windowsHide: true });
    streamUrl = String(stdout).split(/\r?\n/).find((value) => /^https:\/\//i.test(value.trim()))?.trim();
    if (!streamUrl) throw new Error('Video akış adresi dönmedi.');
  } catch (error) { throw processError(error, 'yt-dlp'); }

  const file = path.join(os.tmpdir(), 'cf-frame-' + crypto.randomBytes(16).toString('hex') + '.jpg');
  try {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-ss', String(seconds), '-i', streamUrl,
      '-frames:v', '1', '-vf', 'scale=1280:-2:force_original_aspect_ratio=decrease',
      '-q:v', '3', file,
    ], { timeout: 90000, maxBuffer: 32 * 1024, windowsHide: true });
    if (!fs.existsSync(file)) throw new Error('Kare üretilemedi.');
    const bytes = fs.readFileSync(file);
    if (!bytes.length || bytes.length > 6 * 1024 * 1024) throw new Error('Kare boyutu geçersiz.');
    const id = crypto.randomBytes(16).toString('hex');
    previews.set(id, { file, videoId, seconds, expiresAt: Date.now() + TTL_MS });
    return { previewId: id, videoId, title: video.title, seconds,
      imageDataUrl: 'data:image/jpeg;base64,' + bytes.toString('base64') };
  } catch (error) {
    try { fs.unlinkSync(file); } catch {}
    throw processError(error, 'ffmpeg');
  }
}
function validatedCrop(value) {
  if (value == null) return { x:0, y:0, width:1, height:1 };
  const { x, y, width, height } = value;
  if (![x,y,width,height].every((v) => typeof v === 'number' && Number.isFinite(v)) ||
      x < 0 || y < 0 || width < .02 || height < .02 || x+width > 1.00001 || y+height > 1.00001) {
    throw new Error('Kırpma alanı video karesi sınırlarında olmalı.');
  }
  return { x,y,width,height };
}
async function acceptFrame(db, userDataPath, input) {
  prunePreviews();
  const previewId = String(input?.previewId ?? '');
  const entry = previews.get(previewId);
  if (!/^[a-f0-9]{32}$/.test(previewId) || !entry) throw new Error('Kare önizlemesi bulunamadı veya süresi doldu.');
  const entityKey = String(input?.entityKey ?? '').trim();
  if (!entityKey || entityKey.length > 700) throw new Error('Kare için kayıt seçilmeli.');
  const crop = validatedCrop(input?.crop);
  const target = profiles.targetFile(userDataPath, entityKey, '.webp');
  let croppedFile = '';
  try {
    let source = entry.file;
    if (crop.x > 0 || crop.y > 0 || crop.width < 1 || crop.height < 1) {
      const meta = await sharp(entry.file).metadata();
      if (!meta.width || !meta.height) throw new Error('Kare çözünürlüğü okunamadı.');
      const left = Math.round(crop.x * meta.width), top = Math.round(crop.y * meta.height);
      const width = Math.min(meta.width - left, Math.max(1,Math.round(crop.width * meta.width)));
      const height = Math.min(meta.height - top, Math.max(1,Math.round(crop.height * meta.height)));
      if (width < 64 || height < 64) throw new Error('En az 64×64 piksel alan seçilmeli.');
      croppedFile = path.join(os.tmpdir(), 'cf-frame-crop-' + crypto.randomBytes(16).toString('hex') + '.jpg');
      await sharp(entry.file).extract({left,top,width,height}).jpeg({quality:94}).toFile(croppedFile);
      source = croppedFile;
    }
    const optimization = await optimizeImage(source, target);
    const reference = references.attach(db, userDataPath, entityKey, target, entry.videoId, entry.seconds, crop);
    previews.delete(previewId);
    try { fs.unlinkSync(entry.file); } catch {}
    return { reference, optimization };
  } catch (error) {
    try { fs.unlinkSync(target); } catch {}
    throw error;
  } finally { if (croppedFile) try { fs.unlinkSync(croppedFile); } catch {} }
}
function discardFrame(input) {
  const id = String(input?.previewId ?? '');
  const entry = previews.get(id);
  if (!entry) return false;
  previews.delete(id);
  try { fs.unlinkSync(entry.file); } catch {}
  return true;
}
module.exports = { captureFrame, acceptFrame, discardFrame, videoIdOf, secondsOf, validateCatalog, validatedCrop, prunePreviews };
