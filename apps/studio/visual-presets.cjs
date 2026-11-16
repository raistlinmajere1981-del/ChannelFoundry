'use strict';

/** Per-project shared visual standards. Source details override visual-style guesses. */
const META_KEY = 'visual-presets-v1';
const BUILT_IN = [
  {
    id: 'journal-pencil', name: 'Defter Karakalemi',
    instruction: 'Ömer’in gözlem defterinden gerçekçi grafit karakalem çizim. Doğal oranlar, belirgin ama sade kurşun kalem izleri, ince taramalar, kağıt dokusu, yumuşak ışık. Sinematik kurgu, abartı ve dekoratif çerçeve ekleme. Kaynakta görünümü belirlenmeyen ayrıntıları icat etme. İnsan olmayan varlıklara kaynakta olmayan kıyafet ekleme.',
    negative: 'renkli boyama, fantastik film afişi, 3B render, anime, çizgi roman, altın parıltılar, dekoratif yazılar, filigran, yeni semboller, kaynak dışı aksesuar',
  },
  {
    id: 'journal-portrait', name: 'Portre Karakalemi',
    instruction: 'Ömer’in defterine çizilmiş belgesel duyarlıkta gerçekçi baş-omuz karakalem portresi. Gerçek kaynak karedeki yüz şekli, saç, sakal, başlık ve bakış açısı korunur. Hafif açık eskiz kağıdı, grafit dokusu, süssüz arka plan. Kaynak görünmeyen yüz ayrıntılarını tahmin etme; yüz örtülü ise örtülü kalsın.',
    negative: 'renk, cilt pürüzsüzleştirme, sinematik karakter tasarımı, kahraman pozu, abartılı kas, fantastik kıyafet, yazı, çerçeve, filigran',
  },
  {
    id: 'journal-place', name: 'Mekân ve Nesne Karakalemi',
    instruction: 'Gözlem defterinden doğal, oranları tutarlı, gerçekçi grafit karakalem mekân veya nesne etüdü. Malzeme ve yüzey dokuları kaynakta belirtildiği kadar çizilsin. Yalnız kaynaktan desteklenen mimari, yüzey ve objeler gösterilsin; nötr defter zemini.',
    negative: 'renkli illüstrasyon, fantastik mimari, sinema posteri, lens parlaması, fantezi aksesuar, uydurma yazı ve mühür, filigran',
  },
];

const clamp = (value, max) => String(value ?? '').trim().slice(0, max);
function normalizePreset(row, index) {
  const id = clamp(row?.id, 70).toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,69}$/.test(id)) throw new Error('Görsel standardı ' + (index + 1) + ': geçerli bir kimlik gerekli.');
  const name = clamp(row?.name, 90);
  const instruction = clamp(row?.instruction, 6000);
  if (!name || !instruction) throw new Error('Görsel standardının adı ve stil tarifi boş olamaz.');
  return { id, name, instruction, negative: clamp(row?.negative, 3000) };
}
function normalized(value) {
  const rows = Array.isArray(value?.presets) ? value.presets : BUILT_IN;
  if (!rows.length || rows.length > 16) throw new Error('En az bir, en fazla 16 görsel standardı olabilir.');
  const presets = rows.map(normalizePreset);
  if (new Set(presets.map(row => row.id)).size !== presets.length) throw new Error('Görsel standardı kimlikleri tekrarlanamaz.');
  const defaultId = clamp(value?.defaultId, 70) || presets[0].id;
  if (!presets.some(row => row.id === defaultId)) throw new Error('Varsayılan görsel standardı listede bulunamadı.');
  return { version: 1, defaultId, presets };
}
function get(db) {
  const json = db.prepare('SELECT value FROM studio_meta WHERE key=?').get(META_KEY)?.value;
  if (!json) return normalized({ defaultId: BUILT_IN[0].id, presets: BUILT_IN });
  try { return normalized(JSON.parse(json)); } catch { return normalized({ defaultId: BUILT_IN[0].id, presets: BUILT_IN }); }
}
function save(db, input) {
  const result = normalized(input);
  db.prepare('INSERT INTO studio_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(META_KEY, JSON.stringify(result));
  return result;
}
function resolve(db, id) {
  const config = get(db);
  return config.presets.find(row => row.id === id) ?? config.presets.find(row => row.id === config.defaultId);
}
function compose(db, id, prompt, negativePrompt = '') {
  const preset = resolve(db, id);
  const sourcePrompt = clamp(prompt, 12000);
  if (!sourcePrompt) throw new Error('Görsel üretimi için kayıt tarifi gerekli.');
  return {
    presetId: preset.id,
    prompt: ['Görsel standardı:', preset.instruction,
      'Kayıt ve kaynak bilgileri:', sourcePrompt,
      'Referans kare varsa görünür ayrıntıları koru; kaynakta bulunmayan kimlik, aksesuar veya simge üretme.'].join('\n\n'),
    negativePrompt: [preset.negative, clamp(negativePrompt, 6000)].filter(Boolean).join('; '),
  };
}
module.exports = { BUILT_IN, get, save, resolve, compose };
