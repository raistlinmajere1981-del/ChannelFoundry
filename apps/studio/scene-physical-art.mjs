/** Explicit, reviewed art files actually used by the physical foreground objects.
 * These aren't arbitrary site uploads. They preserve the same filenames and
 * UI mounts; no scene JSON path, room photo, remote URL or publication asset
 * can be supplied by an editor draft.
 *
 * Book closed covers have a measured alpha silhouette and hit polygon.
 * Replacements must preserve the 1536x1024 art canvas and its footprint.
 */
export const PHYSICAL_ART_SLOTS=Object.freeze({
  'research-journal':Object.freeze([
    {path:'/scene-assets/books/scene-closed/evren-master-closed.webp',label:'Kapalı kitap · Türkçe',warning:'1536 × 1024 çerçeveyi, saydam kenarları ve kitabın mevcut siluetini koruyun. Kapak açılma geometrisi bu görsele bağlıdır.'},
    {path:'/scene-assets/books/scene-closed/evren-master-closed-en.webp',label:'Kapalı kitap · İngilizce',warning:'Türkçe kapakla aynı çerçeve ve saydam siluet kullanılmalı. Diğer dildeki kapak ayrı dosyadır.'},
    {path:'/scene-assets/books/scene-closed/evren-inner-leather.webp',label:'İç kapak · deri'},
    {path:'/scene-assets/books/scene-closed/evren-inner-mystic-v1.webp',label:'İç kapak · mühürlü yüzey'},
    {path:'/scene-assets/books/evren-hires/paper.webp',label:'Sayfa bloğu · kenar kâğıdı'},
    {path:'/scene-assets/books/research-rag-paper.webp',label:'Okuma sayfaları · kâğıt dokusu'},
  ]),
  'community-journal':Object.freeze([
    {path:'/scene-assets/books/scene-closed/topluluk-master-closed.webp',label:'Kapalı kitap · Türkçe',warning:'1536 × 1024 çerçeveyi, saydam kenarları ve kitabın mevcut siluetini koruyun. Kapak açılma geometrisi bu görsele bağlıdır.'},
    {path:'/scene-assets/books/scene-closed/topluluk-master-closed-en.webp',label:'Kapalı kitap · İngilizce',warning:'Türkçe kapakla aynı çerçeve ve saydam siluet kullanılmalı. Diğer dildeki kapak ayrı dosyadır.'},
    {path:'/scene-assets/books/community-live/leather.webp',label:'İç kapak · deri'},
    {path:'/scene-assets/books/community-live/page-edge.webp',label:'Sayfa bloğu · kenar kâğıdı'},
    {path:'/scene-assets/books/community-live/spine.webp',label:'Kitap sırtı'},
    {path:'/scene-assets/books/community-live/ribbon.webp',label:'Kapak şeridi'},
    {path:'/scene-assets/books/community-rag-paper.webp',label:'Okuma sayfaları · kâğıt dokusu'},
  ]),
  camera:Object.freeze([
    {path:'/scene-assets/camera/research/camera-body.webp',label:'Kamera gövdesi',warning:'Gövde görselindeki LCD menteşe ve kamera lensinin konumu korunmalı. Fiziksel LCD ince ayarı ayrıca yapılabilir.'},
  ]),
  'vefk-stand':Object.freeze([
    {path:'/scene-assets/vefk/vellum.webp',label:'Parşömen dokusu'},
    {path:'/scene-assets/vefk/chassis-no-nameplate.webp',label:'Ahşap/metal çerçeve',warning:'Şasi üzerindeki düğme ve parşömen boşlukları mevcut kontrol koordinatlarıyla uyumlu olmalı.'},
    {path:'/scene-assets/vefk/inkwell.webp',label:'Bakır mürekkep kabı',warning:'Divitin dinlenme ucu bu görselin sabit kalibre edilmiş ağız noktasını izler.'},
    {path:'/scene-assets/vefk/quill.webp',label:'Divit',warning:'Divitin çelik uç noktası kaynak görselde sabittir; farklı uç konumu mevcut çizim kalibrasyonunu bozar.'},
    {path:'/scene-assets/vefk/lever.webp',label:'Mekanik kol'},
  ]),
});
export const ALL_PHYSICAL_ART_PATHS=Object.freeze(Object.values(PHYSICAL_ART_SLOTS).flatMap(slots=>slots.map(slot=>slot.path)));
export function physicalArtForObject(id){return PHYSICAL_ART_SLOTS[id]??[];}
export function isPhysicalArtAsset(path){return ALL_PHYSICAL_ART_PATHS.includes(path);}
