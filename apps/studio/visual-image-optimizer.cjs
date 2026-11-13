'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const INPUT_LIMIT = 30 * 1024 * 1024;
const OUTPUT_LIMIT = 260 * 1024;
const MAX_INPUT_PIXELS = 45_000_000;
const PROFILES = [
  [1280, 78], [1152, 74], [1024, 74], [960, 70],
  [896, 68], [800, 68], [704, 65], [640, 62],
];
const supported = new Set(['jpeg', 'png', 'webp']);

/** Studio's single manual / AI image ingestion boundary. Never changes originals. */
async function optimizeImage(sourceFile, outputFile) {
  const input = path.resolve(String(sourceFile ?? ''));
  const output = path.resolve(String(outputFile ?? ''));
  if (!input || !output || input === output) throw Error('Görsel dönüştürme için ayrı kaynak ve hedef gerekli.');
  const stat = fs.statSync(input);
  if (!stat.isFile() || !stat.size || stat.size > INPUT_LIMIT) throw Error('Görsel boş veya 30 MB giriş sınırını aşıyor.');
  const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOnError: true, animated: false });
  const meta = await source.metadata();
  if (!supported.has(meta.format) || !meta.width || !meta.height) throw Error('Yalnız geçerli PNG, JPEG ve WebP görseller işlenebilir.');
  if (meta.pages && meta.pages > 1) throw Error('Hareketli görseller Evren kitabında kullanılamaz.');
  let result, dimensions;
  for (const [edge, quality] of PROFILES) {
    const out = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOnError: true })
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, alphaQuality: 88, effort: 5 })
      .toBuffer({ resolveWithObject: true });
    result = out.data;
    dimensions = out.info;
    if (result.length <= OUTPUT_LIMIT) break;
  }
  if (!result || result.length > OUTPUT_LIMIT) throw Error('Görsel, yayın için uygun boyuta güvenli biçimde indirilemedi.');
  const temp = `${output}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  try {
    fs.writeFileSync(temp, result, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, output);
  } catch (error) { try { fs.unlinkSync(temp); } catch {} throw error; }
  return {
    file: output,
    format: 'webp',
    inputBytes: stat.size,
    bytes: result.length,
    width: dimensions.width,
    height: dimensions.height,
    sourceWidth: meta.autoOrient?.width ?? meta.width,
    sourceHeight: meta.autoOrient?.height ?? meta.height,
  };
}
module.exports = { optimizeImage, INPUT_LIMIT, OUTPUT_LIMIT };
