# Evren Kitabı — İçindekiler araması kabul raporu

10 Kasım 2026. [Sahne ve sarkaç çalışmasının](BIRDESENGOR_SCENE_PENDULUM_REVIEW.md) yerel ek kapsamıdır. Commit, push veya canlı deploy yapılmadı. Yayın, üyelik ve Studio verisi değiştirilmedi.

## Tamamlanan davranış

Arama, İçindekiler başlığı ile ilk kategori arasındadır. Mevcut parşömen devam eder; büyüteç, sepya yazı ve tek ince alt çizgi kullanılır. Dolu alanda görünen temizleme kontrolünün CSS hedefi 44×44 px'dir. Mobilde satır tek satırdır, baskı alanını veya yeşil ayracı aşmaz. Yerel giriş en az 16 px yazıyla sunulur; kitap genelindeki metin seçme/dokunma engelleri bu girişe uygulanmaz.

`contentsSearch.js`, mevcut `page.rows`, `model.contents` ve hedef haritalarından yalnız başlıklara ait bir arama dizini türetir. Seri, bölüm, anlatı/kayıt, muhatap, nesne ve mekân başlıkları aranır. Normal İçindekiler'de görünmeyen tek kayıtlı bölümün kayıt başlığı da kendi `section` kimliğiyle bulunur. Hedef haritasında bulunmayan kayıt eklenmez; anlatı gövdeleri, özetler ve kaynak arşivi taranmaz. Yeni API, panel, modal, fiziksel yaprak veya kitap veri modeli yoktur.

Kapalı kategoriler de aranır. Türkçe büyük/küçük harf, noktalı/noktasız I, diakritikler ve fazla boşluk normalize edilir. Her dil, mevcut yayın sağlayıcısının o dil için hazırladığı kitap modelini arar. Kategori/üst başlık eşleşmesi çocukları getirir; eşleşen çocuğun seri/bölüm bağlamı da görünür. Aynı `kind:id` hedefi yalnız bir kez gösterilir; aynı adlı farklı türler kendi kategorilerinde ayrı kalır. Sayfa numaraları mevcut hedef haritalarından gelir, kitap sırası değişmez.

Sonuç bağlantıları normal İçindekiler ile aynı `onNavigate` yolunu kullanır. Arama kendi başına kırmızı ayraç üretmez; mevcut kırmızı dönüş konumunu da değiştirmez. Yeşil ayraç İçindekiler'e döner. Arama boşaltılınca önceki kategori tercihleri ve İçindekiler kaydırması geri gelir. Arama metni, kategori durumu ve kaydırma yalnız okuyucu arayüzündedir; kitap motorunun sayfayı önbellekten çıkarmasına dayanır. Kitap modeli/dil değişince bu durum ve arama dizini yenilenir.

Dolu aramada Escape temizler ve girişi odakta tutar; boşken kitabın mevcut Escape davranışı sürer. Enter ile otomatik ilk sonuca atlama eklenmedi; Tab ve Enter ile mevcut bağlantılar kullanılabilir. Sonuç sayısı `role=status`, `aria-live=polite`, `aria-atomic=true` üzerinden bildirilir. Sonuçsuz gövdede yalnız “Bu adla bir kayıt bulunamadı.” mesajı gösterilir. İlgili arayüz metinlerinin TR/EN kayıtları tamamdır.

## İki ek düzeltme

- Sayfa kenarı hover kıvrılması, ardından iptal ve gerçek sayfa hareketi sırasında İçindekiler kaydırması korunur. Motor aynı DOM içeriğini katlanan yüzeye taşır; girişin capture aşamasında alınan kaydırma değeri DOM taşıma sonrasında `MutationObserver` ile yeniden uygulanır. Arama ve normal dizin kaydırmaları ayrı saklanır.
- Çizim Atölyesi'nin yaklaşma hedefi, erişilebilir etiketleri `title` balonuna kopyalayan seçimden çıkarıldı. Yaklaşma hedefinin ekran okuyucu etiketi ve tıklama davranışı korunur.

## Doğrulama

- Web birim testleri: **230/230 geçti**; bunların beşi yeni arama testidir.
- Production build geçti. Önceden mevcut 500 kB chunk uyarısı sürüyor.
- Mevcut İçindekiler/gerçek sayfa/referans/kırmızı ayraç dönüş E2E: **1920×1080, 1366×768, 390×844 geçti**.
- Mevcut uzun metin, görsel/altyazı, sayfa erişimi ve reduced-motion düzen E2E: **üç ekran boyutunda geçti**.
- Yeni arama E2E: **1920×1080, 1366×768, 390×844 ve 390×844 reduced-motion; her birinde TR/EN geçti**. Doğal metin seçimi ve dil değişiminde dolu aramanın sıfırlanması dahil.
- Önceki sahne/sarkaç regresyonu: **1920×1080, 1366×768, 390×844, 320×740 ve 390×844 reduced-motion geçti**.
- Ana depo ve web alt modülünde `git diff --check` geçti.

Arama E2E; başlıkları, kapalı kategorileri, aynı adlı üç farklı türü, kategori ve üst başlık çocuklarını, sonuçsuz durumu, temizleyerek eski kategori/kaydırmaya dönüşü, hover/iptal kaydırmasını, gerçek hedef/folioları, yeşil/kırmızı ayraçları, doğal odak/metin seçme/dokunmayı, iki dilde eşleşmeyi ve model değişiminde dolu aramanın sıfırlanmasını denetler. Arama/dil değişimi ek yayın isteği başlatmaz. Kitap yaprak sayısı korunur.

Testler izole sentetik yayın ve kontrollü Topluluk yanıtlarıyla yürütülür. Gerçek yayın verisine yazılmaz. Dokunmatik kontroller Chromium emülasyonudur; canlı cihazda ekran klavyesi veya insan ekran okuyucu oturumu yapılmadı.

Çalıştırma: `npm run test:e2e:contents-search`. Bu komut `test:e2e:journal` zincirine de eklendi.

## Ekran görüntüleri ve kanıt

| Boyut / hareket | Boş arama | Sonuçlu | Sonuçsuz |
| --- | --- | --- | --- |
| 1920×1080 | [TR](../channels/birdesengor/web/artifacts/contents-search/empty-tr-1920-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/empty-en-1920-no-preference.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/results-tr-1920-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/results-en-1920-no-preference.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/no-results-tr-1920-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/no-results-en-1920-no-preference.png) |
| 1366×768 | [TR](../channels/birdesengor/web/artifacts/contents-search/empty-tr-1366-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/empty-en-1366-no-preference.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/results-tr-1366-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/results-en-1366-no-preference.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/no-results-tr-1366-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/no-results-en-1366-no-preference.png) |
| 390×844 | [TR](../channels/birdesengor/web/artifacts/contents-search/empty-tr-390-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/empty-en-390-no-preference.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/results-tr-390-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/results-en-390-no-preference.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/no-results-tr-390-no-preference.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/no-results-en-390-no-preference.png) |
| 390×844 reduced-motion | [TR](../channels/birdesengor/web/artifacts/contents-search/empty-tr-390-reduce.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/empty-en-390-reduce.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/results-tr-390-reduce.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/results-en-390-reduce.png) | [TR](../channels/birdesengor/web/artifacts/contents-search/no-results-tr-390-reduce.png) · [EN](../channels/birdesengor/web/artifacts/contents-search/no-results-en-390-reduce.png) |

- [Hover sırasında korunan kaydırma · 1920](../channels/birdesengor/web/artifacts/contents-search/hover-scroll-1920-no-preference.png) · [1366](../channels/birdesengor/web/artifacts/contents-search/hover-scroll-1366-no-preference.png).
- [Arama E2E sonuçları](../channels/birdesengor/web/artifacts/contents-search/results.json).
- [Sahne/sarkaç regresyon sonuçları](../channels/birdesengor/web/artifacts/scene-pendulum/results.json).

## Bu ek kapsamın kaynak dosyaları

Web: `src/book/BookIndexPages.jsx`, `src/book/BookPages.jsx`, `src/book/GrabfoldJournal.jsx`, `src/book/contentsSearch.js`, `src/book/usePaperGestures.js`, `src/book/evren-materials.css`, `src/language/messages.json`, `src/vefk/VefkStand.jsx`, `package.json`, `tests/contentsSearch.test.mjs`, `tests/contents-search-e2e.mjs`, `tests/fixtures/contents-search-fixture.mjs`.

Önceki sahne/sarkaç değişiklikleri korunmuştur. `bookModel.js` ve `book-ribbons.css` bu ek kapsam için değiştirilmedi; mevcut model ve ayraç sözleşmeleri kullanıldı.
