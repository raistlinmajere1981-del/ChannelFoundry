# BirDeSenGör — Görsel giriş ve kitap sunumu milestone'u

**Tarih:** 13 Kasım 2026. Studio ve Web birbirlerinin çalıştırma kaynaklarına bağımlı değil; iki ayrı Git deposunda yönetiliyor.

## Studio — yeni görsel standardı

- Tek giriş kuralı: **Kayıt Dosyaları** görsel ekleme ve AI görsel üretme işlemlerinden hemen sonra `visual-image-optimizer.cjs` üzerinden dönüştürülmüş dosya, sonra `visual-profiles` veri bağlantısı.
- Kaynak JPEG/PNG/WebP olabilir; içerik gerçekten decode edilerek doğrulanır. Animasyon kabul edilmez. Input en fazla 30 MiB, 45 MP. EXIF yönelimi düzeltilir; bozulmamış orijinal manuel dosya korunur.
- Çıktı: **WebP**, uzun kenar en fazla 1280 px, kalite/resolution adaptasyonu ve en fazla **260 KiB**. Saydamlık korunur, EXIF metadata transfer edilmez. Sınırı karşılayamayan görsel başarısız sayılır; yarım/bozuk dosya yayın profiline bağlanmaz.
- Başarılı yeni kayıt eklemede UI görselin nihai piksel ölçülerini ve KiB boyutunu bildirir. Önceki bağlı görsel yalnız yeni DB güncellemesi başarıyla bitince silinir. AI'nin geçici ham çıktı dosyası dönüştürme sonrası temizlenir.
- Mevcut büyük deneme görselleri kendiliğinden dönüştürülmez ve silinmez; kullanıcı onları daha sonra kaldırıp yeniden ekleyebilir.
- `publication-v2` görselleri yalnız içerik hash'li adlarla yayınlar; PNG, JPEG ve WebP dosyalarından doğrulanabilen ölçüler `width`/`height` olarak verilir, kitabın yüklenmeden önce en-boy oranını korumasına yardımcı olur.
- Sharp (`apps/studio/package.json`, N-API OS paketleri) Linux/Windows uyumlu görsel dönüşüm bağımlılığıdır; sistemin harici ImageMagick/ffmpeg kurulumuna bağımlılığı yoktur.

## Web — Evren kitabı

- Görselin çevresindeki ikinci sarı fon, çerçeve ve plaka yok: tek kitap kağıdı üstüne eklenmiş görsel, sol üst / sağ alt köşede yarı saydam eskitilmiş bantlar, çok hafif görsel gölgesi.
- Tarayıcıdaki `bookImageLoader.js`, görüntüyü önce yükleyip decode eder; gerçek DOM resmi ancak tamamı hazır olduğunda yumuşak geçişle gösterilir. Yarım yüklenmiş JPG/PNG tarama çizgileri sayfada görünmez. Yüklenirken görselin alanı ayrılmış kalır; bozuk dosya açıklama verir.
- Yakın kitap yapraklarından en fazla altı farklı resim önceden alınır. Ortak decoded URL önbelleği tekrarlanan HTTP isteğini engeller. Tüm arşiv açılışta indirilmez.
- Mobilde bantların kenardan taşmasını önlemek için görsel genişliği yaprağın %80'i ile sınırlıdır. Pencereyi sabit tutan grabfold fiziksel motoru ve içerik/kitap düzeni değiştirilmedi.
- Production `.htaccess` yalnız hash'li Publication V2 resimlerini `max-age=31536000, immutable` ile saklar; yayın verisi, SEO, giriş/önizleme sayfaları eski no-store ve erişim korumalarında kalır.

## Küçük düzenlemeler

- AI Servisleri'ndeki “Kayıtlı model gösteriliyor...” yardımcı cümlesi kaldırıldı; kayıtlı model yine listede görünür.
- Sahne Atölyesi ve Kayıt Dosyaları otomatik menü daraltmaz; uygulamanın tek saklanan kullanıcı sidebar tercihi kullanılır.

## Kontroller

- `npm run verify:visual-image-pipeline`: WebP dönüştürme, sınırlar, orijinal koruması, bozuk dosya reddi ve Publication V2 boyutları.
- `npm run verify:studio-shell`, `npm run verify:fixed-viewport`, `npm run verify:publication-v2-ui`, `npm run verify:visual-completion`, `npm run verify:settings-workspace`.
- Web: `npm test`, `npm run build`, `npm run test:e2e:journal` ve tek görselin iki bantla, çerçevesiz, decode sonrası gösterim e2e testi.
- Evren tek-yaprak ve başlık yoğunluğu bağımsız masaüstü/mobil testleri.

Bu milestone yalnız yerel kaynak kodunu değiştirir. Canlı yayın manifesti, gerçek görseller, production SEO veya korumalı veriler değiştirilmez; deployment ayrıca yapılır.
