'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ytDlp = require('./ytdlp-manager.cjs');
const frames = require('./video-frame-capture.cjs');
const execFileAsync = promisify(execFile);
const cueCache = new Map();
const CACHE_MS = 20 * 60 * 1000;

function toSeconds(value) {
  const parts = String(value).replace(',', '.').split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n))) return NaN;
  return parts.reduce((sum, v) => sum * 60 + v, 0);
}
function readable(value) {
  return String(value).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function parseVtt(text) {
  const cues = [];
  for (const block of String(text).replace(/\r/g, '').split(/\n\s*\n/g)) {
    const lines = block.split('\n');
    const index = lines.findIndex((line) => line.includes(' --> '));
    if (index < 0) continue;
    const match = /^([\d:.]+)\s+-->\s+([\d:.]+)/.exec(lines[index].trim());
    if (!match) continue;
    const startSeconds = toSeconds(match[1]), endSeconds = toSeconds(match[2]);
    const cue = readable(lines.slice(index + 1).join(' '));
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) || endSeconds < startSeconds || !cue) continue;
    const previous = cues[cues.length - 1];
    // Auto-subtitles repeat the rolling line: keep the first occurrence.
    if (previous && previous.text === cue && startSeconds - previous.startSeconds < 3) continue;
    cues.push({ startSeconds, endSeconds, text: cue });
    if (cues.length >= 50000) break;
  }
  return cues;
}
function matches(cues, query) {
  const needle = query.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
  const result = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const near = [cue, cues[i + 1]].filter(Boolean);
    const current = cue.text.toLocaleLowerCase('tr-TR');
    if (!current.includes(needle)) continue;
    if (result.length && Math.abs(result[result.length - 1].startSeconds - cue.startSeconds) < 3) continue;
    result.push({ ...cue, text: near.map((part) => part.text).join(' · ').slice(0, 500) });
    if (result.length >= 30) break;
  }
  return result;
}
async function search(db, input, { run = execFileAsync } = {}) {
  const videoId = frames.videoIdOf(input);
  frames.validateCatalog(db, videoId, 0);
  const query = String(input?.query ?? '').trim().slice(0, 120);
  if (query.length < 2) throw new Error('Aramak için en az iki karakter yazılmalı.');
  const now = Date.now();
  for (const [id, row] of cueCache) if (now > row.expiresAt) cueCache.delete(id);
  let cues = cueCache.get(videoId)?.cues;
  if (!cues) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-vtt-'));
    try {
      const output = path.join(dir, '%(id)s.%(ext)s');
      await run(ytDlp.executablePath(), [
        '--no-playlist', '--no-warnings', '--skip-download',
        '--write-subs', '--write-auto-subs', '--sub-langs', 'tr,en',
        '--sub-format', 'vtt', '-o', output,
        'https://www.youtube.com/watch?v=' + videoId,
      ], { timeout: 65000, maxBuffer: 256 * 1024, windowsHide: true });
      const files = fs.readdirSync(dir).filter((file) => file.endsWith('.vtt')).sort((a, b) => {
        const rank = (n) => n.includes('.tr.') ? 0 : n.includes('.en.') ? 1 : 2;
        return rank(a) - rank(b);
      });
      if (!files.length) throw new Error('Kaynak için zaman kodlu altyazı bulunamadı.');
      cues = parseVtt(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
      if (!cues.length) throw new Error('Zaman kodlu altyazıda okunabilir satır bulunamadı.');
      cueCache.set(videoId, { cues, expiresAt: now + CACHE_MS });
    } catch (error) {
      const message = String(error?.stderr || error?.message || error || '');
      if (/403|429|sign.in|login|bot|unavailable/i.test(message)) {
        throw new Error('YouTube altyazısına şu anda erişilemiyor. Video içindeki oynatıcıdan elle zaman seçebilirsin.');
      }
      if (message.includes('zaman kodlu') || message.includes('Zaman kodlu')) throw error;
      throw new Error('Zaman kodlu altyazı alınamadı. ' + message.slice(0, 250));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  return { videoId, query, hits: matches(cues, query), cueCount: cues.length };
}
module.exports = { toSeconds, parseVtt, matches, search };
