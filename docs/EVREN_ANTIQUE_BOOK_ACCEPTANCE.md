# Evren Kitabı — antik kâğıt ve okuma düzeni

Tarih: 10 Kasım 2026. Yerel uygulama; commit, push veya deploy yapılmadı.

## Uygulanan değişiklikler

- İki ayraç aynı kumaş örgüsü, kenar işlemesi, soluk altın süsü ve gölge ailesini kullanıyor. Görünür kumaş masaüstünde 26 px, mobilde 22 px; tıklama alanı 42 px genişliğinde.
- Yeşil ayraç yalnız İçindekiler açıkken tam boy. Diğer konumlarda kitabın altındaki 58 px dönüş ucu kalıyor. Kırmızı ayraç aynı seviyede ve uzunlukta bir uç kullanıyor.
- Kırmızı ayracın mevcut referans kaynağı, fiziksel konum ve kaydırma geri yükleme mekanizması korundu. İçindekiler bağlantıları dönüş ayracı oluşturmuyor.
- İçindekiler tek fiziksel yaprak. Muhataplar, Nesneler ve Mekânlar yerel `details/summary` öğeleriyle başlangıçta kapalı; yayın kayıtları alfabetik, anlatıların mevcut Studio sıralaması ve hiyerarşisi korunuyor. Uzun liste aynı yaprak içinde kayıyor.
- Ayrı kategori dizin yaprakları kaldırıldı. Asıl kayıt yaprakları korunuyor; eski kategori hedefleri İçindekiler’e çözülüyor. Sayfa numaraları ve hedefleri mevcut model tarafından yeniden hesaplanıyor.
- Dört malzeme ailesi: muhataplar soluk zeytin, nesneler okra, mekânlar gri mavi, anlatılar sıcak parşömen. Aynı renk değişkenleri dizin yazılarında, fiziksel kâğıtta, referans mürekkebinde ve önizlemede kullanılıyor.
- Kâğıt dokusu yaprağın gövdesi ve numara alanında tek yüzey. Alt renk bandı kaldırıldı; numara büyütülerek alt ortaya alındı.
- Görseller normal dikey akışta ve sayfa sınırlarında. Mevcut sayfalayıcıdaki görsel ağırlığı 440 karakter eşdeğerine ayarlandı; kısa açıklama görselin altında aynı sayfada kalabiliyor, uzun metin kayıpsız devam yapraklarına geçiyor.
- Önizleme kartı 360 px’e kadar geniş, daha büyük görselli, okunur başlık/özetli ve eski kâğıt dokulu. Gerçek boyutu ölçülerek hem fiziksel yaprak hem ekran sınırlarına sığdırılıyor. Klavye odağı, `aria-describedby` ve önce kartı kapatan Escape destekleniyor. Dokunma doğrudan hedefe gidiyor.

Yeni büyük görsel, veri modeli veya kitap motoru eklenmedi. `App.jsx`, ortak fiziksel boyut/animasyon stilleri, Topluluk, kamera, Vefk ve efekt kodlarına bu çalışma kapsamında dokunulmadı. Başlangıçta bulunan diğer oturum değişiklikleri korunuyor.

## Bu çalışmanın dosyaları

Web kökü: `channels/birdesengor/web/`.

- `src/book/bookModel.js`
- `src/book/BookIndexPages.jsx`
- `src/book/BookPages.jsx`
- `src/book/GrabfoldJournal.jsx`
- `src/book/book-ribbons.css`
- `src/book/ReferencePreviewLink.jsx`
- `src/book/reference-preview.css`
- `src/book/evren-materials.css` — yeni, Evren’e özel malzeme katmanı
- `tests/bookModel.test.mjs`
- `tests/journal-opening-e2e.mjs` — mevcut testi kategori açılımları ve gerçek devam sayfasındaki kaynak referanslarına uyarlama
- `tests/evren-antique-e2e.mjs` — yeni kabul akışları
- Bu rapor

## Doğrulama ve görseller

Geçen kontroller:

- `npm test`: 225/225.
- `npm run build`: başarılı. Vite mevcut ana paket için 500 kB parça boyutu uyarısı veriyor; yapı hatası yok.
- `node tests/evren-antique-e2e.mjs`: altı senaryo başarılı — 1920×1080 TR, 1366×768 TR, 390×844 TR, 390×844 TR azaltılmış hareket, 1920×1080 EN azaltılmış hareket, 390×844 EN azaltılmış hareket. Açılış/kapanış, aynı Grabfold örneği, kategori açılımları, tek yaprak içinde kaydırma, dört malzeme, görsel altı metin, alt orta numara, ekran/yaprak içinde önizleme, klavye odağı, Escape, tek dokunuş ve ayraç dönüşleri doğrulandı. Mobilde 621 px okuma kaydırması aynı değere geri yüklendi; çalışma zamanı hatası yok.
- `node tests/community-materials-e2e.mjs`: 1920×1080, 1366×768, 390×844 ve 390×844 azaltılmış hareket başarılı. Mevcut iç kapak, üst sekmeler, formlar, kaydırma, köşe kıvrılması, fiziksel sürükleme ve kalıcı kitap örneği korundu. Sonuç: `channels/birdesengor/web/artifacts/community-cover-spread/materials/verification.json`.
- `node tests/journal-contents-e2e.mjs`: 1920×1080, 1366×768, 390×844 başarılı; dizin → anlatı → referans → kayıt → ayraçla dönüş. Önce/sonra karşılaştırma kareleri bu son koşudan alındı.
- `JOURNAL_STAGE2_WIDTH=390 node tests/journal-opening-e2e.mjs`: mevcut Studio yayınıyla normal/azaltılmış hareket, açılış/kapanış, devam sayfasındaki kaynak referansı, mobil kaydırma ve dönüş, aynı kitap örneği; ayrıca 29 sentetik İçindekiler bağlantısı başarılı. Kaynak yayın dosyasının SHA-256 değeri değişmedi. Sonuç: `artifacts/evren-stage2/after/verification-390.json` (repo kökünden).
- `node tests/journal-layout-e2e.mjs`: üç boyutta başarılı; masaüstünde 42, mobilde 41 erişilebilir yaprak. Uzun metin, eksiksiz devam, tüm gezinme hedefleri, yüksek görsel, uzun açıklama, gerçek mobil sürükleme ve azaltılmış hareket kontrol edildi. Sonuç: `channels/birdesengor/web/artifacts/evren-journal-design/layout-verification.json`.
- `git diff --check`: temiz.

Makine tarafından okunabilen kabul sonucu: `channels/birdesengor/web/artifacts/evren-antique/after/verification.json`.

Tarayıcı testleri yerel, izole yayın verileriyle çalışır; Studio yayınını değiştirmez. `journal-opening-e2e.mjs` ayrıca mevcut Studio dışa aktarımını salt okunur kullanır ve dosyanın değişmediğini doğrular.

Ekran görüntüleri:

- `channels/birdesengor/web/artifacts/evren-antique/before/`: değişiklik öncesi aynı oturumda alınan 1920×1080, 1366×768 ve 390×844 görüntüleri.
- `channels/birdesengor/web/artifacts/evren-antique/after/comparison/`: başlangıçtaki test verisiyle yeniden çekilen, önce görüntüleriyle doğrudan karşılaştırılabilen dokuz kare.
- [Yan yana önce/sonra galerisi](../channels/birdesengor/web/artifacts/evren-antique/comparison.html).
- `channels/birdesengor/web/artifacts/evren-antique/after/`: dört malzeme, kategori açılımları, resimli anlatı, kart, dönüş ayracı, uzun İçindekiler; TR/EN ve azaltılmış hareket örnekleri.

Kabul testindeki çizim ve kayıtlar yalnız test verisidir; üretim arayüzüne sabit demo içerik eklenmez. İstekte anılan Image #1–#5 bu oturumda erişilebilir olmadığı için birebir görsel eşleştirme yapılamadı; yazılı tarif ve mevcut kitap temel alındı. Fiziksel dokunmatik cihaz yerine Chromium mobil emülasyonu kullanıldı.
