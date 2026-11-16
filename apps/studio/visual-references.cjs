'use strict';
const fs = require('node:fs');
const path = require('node:path');
const visualProfiles = require('./visual-profiles.cjs');

function ensureSchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS visual_reference_links (entity_key TEXT PRIMARY KEY, image_file TEXT NOT NULL, source_video_id TEXT NOT NULL DEFAULT '', source_seconds REAL NOT NULL DEFAULT -1, crop_json TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT");
  const columns = db.prepare('PRAGMA table_info(visual_reference_links)').all();
  if (!columns.some((column) => column.name === 'source_seconds')) db.exec('ALTER TABLE visual_reference_links ADD COLUMN source_seconds REAL NOT NULL DEFAULT -1');
  if (!columns.some((column) => column.name === 'crop_json')) db.exec("ALTER TABLE visual_reference_links ADD COLUMN crop_json TEXT NOT NULL DEFAULT ''");
}
function validateKey(value) {
  const key = String(value ?? '').trim();
  if (!key || key.length > 700) throw new Error('Referans görseli için geçerli kayıt anahtarı gerekli.');
  return key;
}
function localFile(userDataPath, storedName) {
  const name = String(storedName ?? '').trim();
  if (!name || path.basename(name) !== name || !/^[a-f0-9]{24}\.webp$/i.test(name)) return '';
  const root = path.resolve(userDataPath, 'visual-assets');
  const target = path.resolve(root, name);
  return target.startsWith(root + path.sep) ? target : '';
}
function get(db, userDataPath, entityKey, withImage = true) {
  ensureSchema(db);
  const key = validateKey(entityKey);
  const row = db.prepare('SELECT image_file AS file, source_video_id AS sourceVideoId, source_seconds AS sourceSeconds, crop_json AS cropJson, created_at AS updatedAt FROM visual_reference_links WHERE entity_key=?').get(key);
  if (!row) return null;
  const file = localFile(userDataPath, row.file);
  if (!file || !fs.existsSync(file)) return null;
  const info = fs.statSync(file);
  if (!info.isFile() || info.size > 12 * 1024 * 1024) return null;
  return { entityKey: key, imagePath: file, sourceVideoId: row.sourceVideoId, sourceSeconds: row.sourceSeconds < 0 ? null : row.sourceSeconds,
    crop: row.cropJson ? JSON.parse(row.cropJson) : null,
    imageDataUrl: withImage ? 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64') : '',
    updatedAt: row.updatedAt };
}
function attach(db, userDataPath, entityKey, optimizedWebp, sourceVideoId = '', sourceSeconds = null, crop = null) {
  ensureSchema(db);
  const key = validateKey(entityKey);
  const destination = path.resolve(optimizedWebp);
  const root = path.resolve(userDataPath, 'visual-assets');
  if (!destination.startsWith(root + path.sep) || !/^[a-f0-9]{24}\.webp$/i.test(path.basename(destination)) || !fs.existsSync(destination)) {
    throw new Error('Referans kare yalnız Studio görsel arşivinden bağlanabilir.');
  }
  const previous = get(db, userDataPath, key, false);
  const file = path.basename(destination);
  const videoId = String(sourceVideoId ?? '').trim().slice(0, 120);
  const seconds = sourceSeconds == null ? -1 : Number(sourceSeconds);
  if (!Number.isFinite(seconds) || seconds < -1 || seconds > 21600) throw new Error('Geçersiz kaynak zaman kodu.');
  db.prepare('INSERT INTO visual_reference_links(entity_key,image_file,source_video_id,source_seconds,crop_json) VALUES(?,?,?,?,?) ON CONFLICT(entity_key) DO UPDATE SET image_file=excluded.image_file, source_video_id=excluded.source_video_id, source_seconds=excluded.source_seconds, crop_json=excluded.crop_json, created_at=CURRENT_TIMESTAMP')
    .run(key, file, videoId, seconds, crop ? JSON.stringify(crop) : '');
  if (previous?.imagePath && previous.imagePath !== destination) {
    try { fs.unlinkSync(previous.imagePath); } catch {}
  }
  return get(db, userDataPath, key);
}
function clear(db, userDataPath, entityKey) {
  const key = validateKey(entityKey);
  const existing = get(db, userDataPath, key, false);
  db.prepare('DELETE FROM visual_reference_links WHERE entity_key=?').run(key);
  if (existing?.imagePath) { try { fs.unlinkSync(existing.imagePath); } catch {} }
  return { cleared: Boolean(existing), entityKey: key };
}
module.exports = { ensureSchema, get, attach, clear };
