# BirDeSenGör — 20 Kasım 2026 toplu yayın ve Studio kapanışı

Canlı site: https://birdesengorgizlievren.com/

## Yayın kapsamı
- Publication ID: pub-39fe6759ea6c17271e4bcc1f
- Evren: 2.717 Türkçe ve 2.717 İngilizce onaylı varlık.
- Kitap: 279 bölüm, iki dilli içerik ve 5.519 Evren ilişkisi.
- Görseller: 20 görsel; her biri canlı kaynaktan SHA-256 ile doğrulandı.
- Vefk/Sponsorluk: güncel 5. revizyon, değişmeyen çizim hash'i, TR/EN metinleri ve kaynak video kimliği.
- SEO: 6.094 onaylı sayfa, 6.096 sitemap adresi; canonical ve hreflang kontrolleri geçti.
- Studio SEO: 67 eksik kaynak-onay durumu eşitlendi; 6.094/6.094 onaylı ve 0 bekleyen durum.
- Yeni PHP yayın servisi, gzip ve sıkıştırmasız JSON GET, HEAD desteğiyle canlı test edildi.

## Web ve sahne
- 7 aktif dekoratif WebP optimize edildi; 10 kullanılmayan eski görsel kaldırıldı.
- Yönetilen sahne dosyaları yeni Git kaynaklarıyla eşitlendi; content/, topluluk verileri ve yönetici dosyaları korunarak dağıtıldı.
- Vefk katalog açılırken çizim duruyor, divit şişeye dönüyor; kapanınca çizim otomatik devam etmiyor.
- Evren ve Topluluk kitabında Grabfold sayfa kıvrılırken kaydırma konumu korunuyor.
- PHP ana sayfa indeksleme, robots, SEO yönlendirmeleri, güncel JS/CSS ve medya SHA kontrolleri geçti.

## Veritabanı ve yedek
Studio SQLite kaynak temizlik turunda 146,4 MiB'dan 94,3 MiB'a indirildi.
2.717/2.717 dil kaydı, 279 bölüm, 615 altyazı ve 286 kaynak video çözümlemesi korunuyor.
SQLite quick_check ve foreign_key_check kontrolleri başarılı.
Eski 329 yedek, doğrulanmış tarihî arşivde korundu; aktif backups klasöründe tek güncel sıkıştırılmış SQLite var.

Toplu yayın öncesi yeni Studio SQLite, canlı publication ve sitemap ile SEO baseline yedekleri:
channels/birdesengor/.local-data/studio/group-release-20261120/backups/

Son yayın adayı ve kaynak-sabitli yerel çalışma:
channels/birdesengor/.local-data/studio/source-content-repair-20261120/en-prepublication/release-r2/

Yayın, SEO, dağıtım, SHA ve canlı kontrol işaretleri:
channels/birdesengor/.local-data/studio/group-release-20261120/

## Doğrulama
- Web 298/298 birim testi geçti.
- Build, verify:dist, PHP verify:preview ve canlı verify:live geçti.
- Studio Evren özellikleri, kaynak altyazı kanıtı, publication-v2 ve SEO doğrulayıcıları geçti.
- Evren/Topluluk kitap kaydırma ve Grabfold ofset regresyonları desktop/mobile geçti.
- Vefk fiziksel kullanım masaüstü 1920/1366, mobil normal/reduced kombinasyonlarında geçti.
- Son canlı publication paketi, 20 görsel hash'i, SEO ve sitemap doğrulandı.
- Çok uzun E2E turunun ilk denemelerinde tarayıcı zamanlaması kaynaklı hatalar
  yaşandı; kıvrılma hatası düzeltildi ve hedef testler yeniden çalıştırıldı.
  Diğer uzun tarayıcı turu sonucu ayrı kapanış kaydında açıklanır.

Kalan hiçbir içerik veya SEO paketi yayın beklemiyor. Site onaylı iki dilli
yayında, Studio'nun yerel yayın ve SEO onayları aynı fingerprint'e eşit.
