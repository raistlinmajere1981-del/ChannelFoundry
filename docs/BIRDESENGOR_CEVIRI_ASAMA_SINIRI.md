# BirDeSenGör — Çeviri aşaması sınırı (11 Kasım 2026)

Çeviri yalnız yayın öncesi, son onaylanmış Türkçe metin üzerinden yapılır. 01 — Çözümleme altyazıdan kaynak analizi üretir; Türkçe veya İngilizce yayın metni üretmez. 02 — Ayıklama, 03 — Evrene İşleme, 04 — İnceleme ve 05 — Hikâyeleştir de dil çevirisi başlatmaz.

## Uygulanan ayrım

- Studio analiz işçisi (`studio-runtime.cjs`), analiz kaydından sonra `publication-languages.generate()` çağırmaz ve dil kaynağını çözümleme sonunda otomatik eşitlemez.
- AI Atölyesi/Çözümleme, Hikâyeleştir, Kayıt Dosyaları ve Vefk Atölyesi içindeki bağımsız çeviri editörleri kaldırıldı.
- Bütün dil türleri (`video`, `section`, `entity`, `outline`, `vefk`) mevcut **Yayınlama → Türkçe / İngilizce yayın metinleri** editöründe kalır. Gösterge Paneli'ndeki Çeviri Durumu kutusu kullanıcıyı buraya yönlendirir.
- Son onaylı içerik kaynakları, `publication-v2` görüntüsüyle `publication-languages.overview()` üzerinden Yayınlama aşamasında eşitlenir. Kaynak hash'leri, TR/EN onay durumları, `stale` kontrolü ve manuel düzeltme koruması aynen sürer.
- Terminal kaynak analiz köprüsünde metadata/hash takibi ayrı bir teknik iştir; çeviri modeli çağrısı değildir. Bu köprü ve çalışan DeepSeek dil üretim kodu bu aşamada değiştirilmedi.

## Geçiş ve güvence

Değişiklik yalnız kod/arayüz seviyesindedir: mevcut dil varyantlarına, SQLite dosyasına, işlenmekte olan DeepSeek kayıtlarına dokunmaz. Studio'nun Electron oturumu yeniden açılınca yeni görünüm devreye girer. Aktif bir çeviri çalışmasını bölmek için Studio'yu yeniden başlatma. Yerel paketi üretme, commit/push ve canlı deploy bu değişikliğin kapsamında değildir.

Doğrulama: `node apps/studio/verify-translation-stage-boundary.cjs`, `npm run build:studio`, mevcut yayın dili ve Hikâyeleştir regresyonları.
