# BirDeSenGör — Studio Vefk yayın ve sahne sözleşmesi

Güncel devir: 6 Kasım 2026. Vefk, V2 odasında tek kalıcı fiziksel şövale ve divitle bağlıdır. Bu belge çalışan sözleşmeyi anlatır; eski rulo/prototip veya v1-only kabul notları geçerli değildir. Yerel entegrasyon canlı deploy anlamına gelmez.

## Studio yayın akışı

Vefk oluştur/düzenle → kaydet → kontrole gönder → onayla → site kataloğuna seç → site paketini hazırla. Yalnız açıkça seçilen onaylı, değiştirilemez revizyonlar yayına girer. Yeni taslak veya seçilmemiş onaylı revizyon, seçilmiş eski revizyonun yerini almaz.

Ana çıktı `channels/birdesengor/.local-data/studio/public-export/content/publication.json` dosyasıdır. Yardımcı katalog ve belgeler aynı export altında `content/vefk/` dizinine yazılır. Web, ham publication içindeki gömülü `entry.document` verisini tüketir; çizim için ayrı bir belge URL'sini veya Studio veritabanını okumaz. Katalog en fazla 32 kayıt/5 MiB destekler.

Publication `schemaVersion:2` olarak kalır. Seçim yoksa `vefkCatalog` bulunmaz. Site gerçek boş durum gösterir; yedek veya dekoratif vefk üretmez.

## Desteklenen aileler

| Katalog | Binding | Belge |
| --- | --- | --- |
| `birdesengor.vefk-catalog`, `schemaVersion:1` | `bindingVersion:2`; motion alanı yok | yalnız `birdesengor.vefk`, DOC1 |
| `birdesengor.vefk-catalog`, `schemaVersion:2` | `bindingVersion:3`, binding içinde `motion:{strokeEasing:"v2"}` | DOC1/DOC2 ve karma katalog |

Her iki ailede:

```json
{
  "sceneId": "birdesengor-study-v2",
  "surface": { "objectId": "vefk-stand", "anchorId": "vefk-stand.ink-plane" },
  "pen": { "objectId": "quill", "anchorId": "quill.tip" },
  "coordinateSpace": "svg-viewBox",
  "fit": "contain"
}
```

2026-11-10 sahiplik sözleşmesi: oda yalnız `vefk-stand` nesnesini ve `vefk-stand.ink-plane` yüzeyini içerir. `quill` / `quill.tip`, `vefk-site-consumer.mjs` içindeki `VEFK_WORKSHOP.pen` ile tanımlanan atölye içi yayın kimliğidir; oda nesnesi veya Efekt Atölyesi hedefi değildir. Tüketici pen kimliğini kesin binding karşılaştırmasıyla, oda bağlantısını yalnız atölye yüzeyi üzerinden doğrular. Mevcut paket kimlikleri, hash'leri ve belge verileri değişmez; migration gerekmez.

Binding'in alan kümesi ve değerleri kesin doğrulanır. Eski rulo anchor'ı, bilinmeyen alan/easing/sürüm, yanlış geometri veya hash reddedilir; migration, sessiz yükseltme veya sürüm düşürme yoktur. Studio, seçilen onaylı revizyonlar arasında açık DOC2 varsa katalog 2 üretir. DOC1 seçimi DOC1 byte'larını ve fingerprint'ini korur. DOC2 `drawPlan.strokes[].easing`, kanonik doğrulayıcının izin verdiği eğrileri taşır; eksik easing kanonik oynatıcıda doğrusal okunur, belge değiştirilmez.

Entry alanları `id`, `revision`, `order`, `title`, `contentHash`, `url`, `sha256`, `document` şeklindedir. Katalog fingerprint'i, semantik belge contentHash'i ve serileştirilmiş belge SHA-256 değeri tüketicide doğrulanır. Studio core/store/publisher ve PHP/JS gate doğrulaması aynı sürüm ailesini kabul etmelidir.

## Kanonik tüketici

Ana kaynak `docs/contracts/vefk-site-consumer.mjs`; site kopyası `channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs`. Kopyalar byte eşittir; site testi drift'i denetler. PHP referans `docs/contracts/vefk-s6-php-gate.php`, site kopyası `web/public/api/studio/vefk-s6-php-gate.php` dosyasıdır. Vefk görsel entegrasyonu bu tüketicileri veya Studio motorunu değiştirmez.

```js
const accepted = await readVefkPublication(publicationRaw, sceneManifest);
if (accepted.status === 'ready') {
  const player = createVefkPlayer(accepted.entries[0].document); // kayıt başına bir kez
  const frame = player.frameAt(timeMs);
}
```

`frame.visibility: [{pathId,fraction}]` mürekkebin görünür payıdır. `frame.pen` içindeki `position`, `pathId`, `fraction`, `penDown` ve `phase` (`ready/drawing/travel/hold`) fiziksel divitin tek kaynağıdır. Çoklu M/Z içindeki ve stroke aralarındaki kalem kaldırma/seyahat zamanlaması kanonik oynatıcıdan gelir. Web bu süreleri, hareket eğrilerini veya çizim sırasını yeniden üretmez. İleri/geri seek aynı zamanda aynı kareyi verir.

## V2 fiziksel tüketim

`useVefkExperience` ham `publication.raw` verisini `verifyVefkPublication` üzerinden doğrular, her kabul edilen kayıt için bir player derler ve tek rAF saati yönetir. SVG `d` geometriyi, `frame.visibility` mürekkebi, `frame.pen.position` diviti yönetir. Divit ve mürekkep aynı SVG viewBox dönüşümünü paylaşır; bağımsız CSS takip gecikmesi yoktur.

Birden fazla `M` içeren kaynak path görünmez tutulur, alt yollar kendi görünürlük paylarıyla ayrı boyanır. Bu yalnız SVG dash'in her alt yolda yeniden başlamasını düzeltir; kanonik süre/geometri/pen bilgisi değişmez. Henüz ziyaret edilmemiş yol ve sıfır paydaki yuvarlak uç görünmezdir. Kalem seyahatinde ink fraction sabit kalır.

Şövale/kalem düğümleri yaklaşma, seçim, seek ve dönüş boyunca aynıdır. Kol play/pause, oyuk native range seek, süpürme taşı seek(0), mühür çarkı kayıt seçimi ve çerçeve köşesindeki X/Escape saati durdurup oda dönüşünü başlatır. Masaüstünde en fazla beş, mobilde üç mühür görünür. Reduced-motion son kareyi duraklatır; elle zaman seçimi yine aynı kanonik kareyi kullanır.

Efekt Atölyesi gerçek oda nesnelerinin efektlerini yönetir. Atölyenin yerel parşömen ışığı aynı kanonik motoru kullanır; çizim ve divit yaşam döngüsünün sahibi `VefkStand` olur. `quill.tip`, DOM üzerinde `data-vefk-anchor` olarak bulunur; `data-effect-anchor` veya bağımsız `data-scene-object-id` olarak yayımlanmaz.

## Gerçek yerel örnek ve kabul

`demo-vefk-5x5-v2` gerçek Studio veritabanında onaylanıp seçilmiş DOC1 kaydıdır. Adındaki `v2`, belge sürümü değildir. Export katalog 1 / binding 2 taşır; 34 SVG yolu ve 35.410 ms çizim süresi vardır. Vite'nin `CHANNEL_FOUNDRY_PUBLICATION_FILE` ayarı doğrudan bu export'u okur. Üretim build'i geliştirme dosya yolunu taşımaz.

DOC2 / karma katalog, üç eğri, M/Z alt yolları ve 32 kayıtlık mekanizma sınaması gerçek Studio core/store/review/approval/select/publish zinciriyle bellek SQLite içinde üretilir. Kullanıcı DB'si, yayın dosyası veya seçimi değiştirilmez. Test kayıtları site üretim dosyalarına eklenmez.

Güncel görsel ve davranış belgesi: `channels/birdesengor/web/docs/PHYSICAL_VEFK.md`. Görseller/prompt'lar: `VEFK_ASSETS.md`. Kabul sonuçları: `VEFK_ACCEPTANCE.md`; Chromium kanıtları `web/artifacts/vefk-v2/` altında. Kanonik tüketici ve süreler yalnız testleri geçirmek için değiştirilmez. Commit, push ve canlı deploy son kullanıcı kabulünden sonraya bırakılmıştır.


## Fiziksel kullanım katmanı — 7 Kasım 2026

Web katalog çekmecesi yalnız doğrulanmış `entries` listesini, yayın sırasıyla gösterir. Adım/kare/hız/tekrar ve optik görünüm siteye ait geçici kullanım durumudur; belgeye veya yayına yazılmaz. `frameAt(t)` tek çizim/kalem otoritesidir. Hücre tekrarı diğer yolların başlangıçtaki kanonik görünürlüklerini aynı SVG üzerinde korur. `cell.rXcY.sN` yolları üst hücreyle gruplanır; hücre kimliği yoksa yol/adım kullanılır.

Okuma içeriği mevcut `title`, `description`, `language`, `provenance.notes` ve `provenance.references` alanlarıdır. Studio Okuma İçeriği düzenleyicisi ve web aynı güvenli React metin sunumunu kullanır. Düzenleme taslak kaydetme / kontrol / onay / katalog seçimi / paket akışından geçer. Yeni schemaVersion, hash kapsamı istisnası veya onaylı revizyona doğrudan yazma yoktur. Açıklama değişince mevcut contentHash ve katalog fingerprint zinciri olağan biçimde yeniden üretilir.
