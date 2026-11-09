# BirDeSenGör — Çizim Atölyesi kabul kaydı

2026-11-09. Yerel çalışma; commit, push ve deploy yapılmadı. Başlangıçtaki paralel Studio, dil, topluluk, kamera, kitap ve efekt değişiklikleri korundu.

## Uygulanan davranış

Web alanının adı **Çizim Atölyesi**. Görsel başlık ve çerçeveye gömülü pirinç isim kartı kaldırıldı. Eser başlığı ekran okuyucu için korunuyor. Üst raydaki kontroller dengelendi; çizim yüzeyi `723×579` yerine `723×625` ve daha yukarıdan başlıyor. Uzun zaman sürgüsü, alt düğmeler ve hız ayarı gerçek ahşap yüzeyde kalıyor; dokunma alanları ayrık.

Katalog, başlat/duraklat, başa dön, adımlar, tekrar, hız, dört yakınlaştırma kademesi, okuma ve kapatma mevcut işlevlerini kullanır. Kare gruplama, stroke easing, intrastroke seyahat, RAF saati, geometrik yakınlaştırma ve divit motoru yeniden yazılmadı. Yüzey ölçüleri divit hokkasının ters projeksiyonuna ve katalog maskesine aynı kaynaktan verilir.

Kalıcı kayıt: `birdesengor-channel-drawing`, başlık: **Kanal Çizimi**. Şimdiki katalog yalnız bu kayıt. Yeni Studio eserleri serbest ad/tür ile eklenebilir; ana kayıt katalogda daima ilk sıraya alınır. Ana kayıt ilk doğrulamada tamamlanmış ve duraklamış açılır. Başa dön sıfır zamanı seçer; Oynat mevcut motorla gerçek çizgileri oluşturur. Diğer kayıtların varsayılan sıfırdan başlama davranışı korunur. Ana kayda doğrudan bağlantı tamamlanmış açılışı bozmaz.

## Çizim ve kaynak

Gerçek örnek, proje kökündeki `Screenshot_20261109_151819.png` içinde bulundu ve incelendi. Kökteki `logo.png` ChannelFoundry logosudur; bu çizimin kaynağı değildir. Ekran görüntüsündeki yalnız `(488,198)-(1430,825)` kompozisyon alanı kullanıldı; tarayıcı arayüzü ve yeşil seçim çizgisi alınmadı. Kaynak parmak izi `apps/studio/channel-drawing/artwork.json` içindedir.

535 temel path; bunların 175'i portre konturu/taramasıdır. Teşekkür satırıyla toplam **562 path / 562 stroke**, **181864 ms**. Çerçeve ve süslemeler kaynak konturlarından, soluk eş merkezli geometri kaynak ölçülerinden, portre kontur ve ton taramalarından üretildi. Her öğe mutlak M/L çizgi verisidir. Yazı Noto Serif konturlarından harf harf örneklenir. Logo/portre/yazı için HTML, CSS veya ayrı bir resim katmanı yoktur. Mevcut SVG içindeki tek resim nesnesi divit varlığıdır.

Kaynağın tam kâğıt dokusu, metalik ışığı ve sürekli portre tonları tek renk çizgi motorunda birebir üretilmiyor. Bunların yerine gerçek kontur ve divit taraması kullanılıyor. Kaynaktaki geometri ve portre oranları korunuyor; yeni sembol eklenmedi. Motor sınırı sahte görüntü açılmasıyla gizlenmedi.

## Sponsor otomasyonu ve sınırlar

`apps/studio/publication-v2.cjs` normal yayın paketi oluştururken, önceden kurulmuş ana kayıt için `channel-drawing.cjs.synchronize` çağırır. Ham keşif veya altyazıdan çıkarım yapılmaz.

Son onaylı/yayınlanabilir bölüm; mevcut kamera izin listesi, tamamlanmış ve güncel analiz, editoryal curated durumu, onaylı güncel yayın dili ve geçmiş yayın tarihiyle sınırlandırılır. Üyelere özel, gelecekteki, eski analizli veya yayın metni onaysız bölüm alınmaz. Bölümün yalnız açıkça kaydedilmiş sponsor confirm kararları ve elle girilen sponsorları kullanılır. İnceleme ekranının varsayılan confirm görünümü onay sayılmaz. Katkıda bulunanlar sponsor sayılmaz.

Sponsor değişince aynı kimlikte yeni onaylı revizyon, yeni harf konturları, zaman çizelgesi ve içerik hash'i üretilir; eski revizyon korunur. Aynı veriyle tekrar paketleme revizyon artırmaz. Geçerli yeni bölüm sponsorsuzsa teşekkür satırı çizilir. Geçerli yayın kaynağı geçici olarak yoksa önceki gerçek sponsor korunur. Yönetilen Türkçe metin mevcut dil sözleşmesiyle birlikte güncellenir; İngilizce varyant mevcut inceleme hattında kalır ve eski çeviri yeni revizyona otomatik taşınmaz.

Mevcut yerel yayınlarda uygun sponsor kaynağı bulunmadı; ana revizyon 1'de **Destekçilerimize teşekkürler** çiziliyor. Sponsorlu senaryolar gerçek Studio üreticisi ve SQLite ile izole testlerde doğrulandı; gerçek kullanıcı/bölüm verilerine test sponsoru yazılmadı.

Otomasyon **yerel yayın paketi üretimine kadar** bağlıdır. Çalışan sitede zamanlanmış Studio sorgusu yoktur. Güncellenen paketin mevcut yayın hattıyla gönderilmesi gerekir; bu turda uzak yayın yapılmadı. Ham kaynak konturlarını yeniden hazırlamak offline Python araçları gerektirir; normal export yalnız Node ve paketlenmiş konturlarla çalışır. 1351 yazı karakteri/Türkçe desteklenir; kapsam dışı karakter veya motorun 1024 path / katalog boyutu sınırı açık hata verir, metin sessizce değiştirilmez.

Okuma içeriğinde şu bağlantı vardır: **Sponsorluk için hakandemir@gmail.com adresinden Hakan'a ulaşabilirsiniz.** `mailto:` kullanılabilir. Bölüm dizisi genişletilebilir, boş Hakkımızda yoktur. Teknik üretim notları ziyaretçiye gösterilmez; Studio belgesinde ve üretim dokümanında korunur.

## Değişen dosyalar

Bu listenin kapsamı bu turda yapılan düzenlemelerdir; mevcut Git farklarının tamamı bu çalışmaya ait değildir.

- `apps/studio/channel-drawing.cjs`, `channel-drawing.test.cjs`, `seed-channel-drawing.cjs`.
- `apps/studio/channel-drawing/artwork.json`, `letter-outlines.json`, `trace-source.py`, `FONT-LICENSE.txt`, `README.md`.
- `apps/studio/publication-v2.cjs`: küçük sponsor eşitleme bağlantısı; önceki dil değişiklikleri korundu.
- `apps/studio/vefk-publication.cjs`: ana kaydın ilk sırada kalması.
- `channels/birdesengor/web/src/vefk/channelDrawing.js`.
- Aynı dizinde `VefkStand.jsx`, `VefkQuill.jsx`, `VefkReading.jsx`, `VefkReading.d.ts`, `useVefkExperience.js`, `verify-publication.js`, `physical-vefk.css`.
- `VefkAtmosphere.jsx`: mevcut tek malzeme ışığından önce tam kaynak sahnesini doğrulama; kanonik efekt motoru değişmedi.
- `src/scene/data/study.scene.json`, `src/effects/birdesengor-effects.v2.json`: yalnız atölye görünen adı.
- `src/language/messages.json`: web genel çizim adları ve iletişim çevirileri.
- `public/scene-assets/vefk/chassis-no-nameplate.png`: eski varlığı koruyan, isim kartı kaldırılmış yeni çerçeve.
- `tests/channelDrawing.test.mjs`, `tests/channel-drawing-e2e.mjs`, `tests/vefkPublication.test.mjs`, `tests/vefk-workshop-e2e.mjs`, `tests/physical-books-e2e.mjs`.
- Bu kabul raporu ve yerelde `.superdesign/resume.json` / taslak v4.

Studio Vefk Atölyesi editörünün bu turda kaynak değişikliği yapılmadı. Belge şeması, divit/zaman çizelgesi çekirdeği ve kayıt yaşam döngüsü değiştirilmedi. Paylaşılan okuma bileşeninin Studio varsayılanları korundu.

## Doğrulama

Web birim testleri 221/221; Studio çekirdek/kayıt/yayın/destek/kamera testleri 53/53, yeni ana çizim testleri 5/5 ve editör/zaman çizelgesi/IPC testleri 31/31 geçti. Web ve Studio TypeScript + Vite derlemeleri başarılı. Web derlemesinde 500 kB paket boyutu uyarısı var; hata yok. Kamera, Topluluk Defteri, mevcut çizim v1/v2 ve fiziksel kullanım tarayıcı kontrolleri geçti. Fiziksel kitaplar yeniden çalıştırmada tüm dört ekran/hareket senaryosunu geçti. Yeni ana çizimin son tarayıcı sonucu aşağıdaki tabloda verilir. Tarayıcı delilleri `channels/birdesengor/web/artifacts/channel-drawing/` altında; tamamlanmış açılış, sıfırlama, çerçeve, portre, sponsor, final, okuma ve katalog görüntüleri bulunur. `verification.json` ekran ölçüleri ve gerçek SVG CTM'si üzerinden ölçülen divit sapmasını içerir. Ek bağımsız vektör ve imzalı belge `artifacts/channel-drawing/` altındadır; bunlar oynatıcı yerine kullanılmaz.

Genel kitap/atölye testlerinin eski ortam katmanı sayımı, paralel pulse efektlerini kalıcı oda canvas'ı sayıyordu (2 yerine 5 bekliyordu). Testler mevcut candle/passive izin listesine bağlandı. İlk kitap denemesindeki RAF gözlemleme zamanlama hatası ayrıca yeniden denendi. Üretim kitap/kamera/topluluk kaynakları değiştirilmedi.

## Yerel veri ve geri alma

Kurulum öncesi tutarlı SQLite ve public-export yedeği:
`channels/birdesengor/.local-data/studio/backups/channel-drawing-2026-11-09T18-37-41-135Z/`.

Başlangıçta seçili başka demo bulunmuyordu; kurulumdan sonra katalog yalnız ana kaydı içeriyor. Eski Studio belgeleri silinmedi. Yeni paket `.local-data/studio/public-export/content/publication.json` ve standart `vefk/documents/` dosyalarında.

## İsim kartı varlığının üretimi

Yerleşim için Superdesign mevcut taslağının v4 sürümü kullanıldı:
https://superdesign.dev/teams/d43e8b12-551a-4b15-a10c-e48c388c4fc6/projects/bbe1c1c0-3365-4bfa-93a9-8e94e1426586

Çerçevedeki karta yönelik yerel raster düzenleme yerleşik image_gen ile yapıldı, CLI kullanılmadı. Son varlık: `channels/birdesengor/web/public/scene-assets/vefk/chassis-no-nameplate.png`. 1024×1536 oranı ve alfa kanalı doğrulandı. Bu görsel çizimin kendisi değildir.

Kullanılan istem:
> Use case: precise-object-edit. Edit target: the supplied 1024x1536 transparent physical wooden easel chassis asset. Remove ONLY the central rectangular brass nameplate at x413..611 y115..175, including its four screws, and restore continuous matching antique wood grain in that exact area. Keep every other pixel, edge, frame dimension, corner brass fastener, shelf, legs, transparency and the open central window unchanged. No text, no new objects. Exact same front camera angle and aspect ratio. Preserve existing alpha transparency precisely. This is a production UI chassis, do not redesign or recolor it.

## Ana çizim son tarayıcı sonucu

| Görünüm | Sonuç | En büyük divit sapması |
| --- | --- | --- |
| 1920×1080 / no-preference | Geçti | 0.000061 px |
| 1366×768 / no-preference | Geçti | 0.000039 px |
| 390×844 / no-preference | Geçti | 0.000031 px |
| 390×844 / reduce | Geçti | 0.000031 px |

Her senaryoda tamamlanmış açılış, başa dönme, okuma/iletişim, katalog, taşma/çakışma ve 44 px dokunma hedefleri doğrulandı. Normal harekette gerçek RAF oynatma, duraklama, bütün çizim bölümleri, final, tamamlanmış çizimden tekrar başlatma ve dört yakınlaştırma kademesi kontrol edildi. Hareket azaltmada varsayılan final ve animasyonun devre dışı kalması doğrulandı.

Son genel atölye tarayıcı turu da tamamen geçti: dört gerçek Studio görünümü, masaüstü/mobil 32 kayıtlık katalog seçimi, boş/bozulmuş/ulaşılamayan/yükleniyor yayın durumları. Gerçek yerel Kanal Çizimi paketi PHP yayın kapısından da geçti. Ham test/derleme günlükleri `artifacts/channel-drawing/validation/` altında korunur.
