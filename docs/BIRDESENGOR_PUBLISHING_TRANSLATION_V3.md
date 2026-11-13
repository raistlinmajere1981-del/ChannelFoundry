# BirDeSenGör — Yayın ve Çeviri V3

## Mimari sahiplik (13 Kasım 2026)

**Kayıt Dosyaları** içerik düzenleme, görsel, dil ve onay ortamıdır. **Yayın Merkezi** yalnız canlı publication aktarımı içindir. **Çizim Atölyesi** revizyon onayı ve yerel katalog seçimi yapar. Sahne Atölyesi'nin efekt yayını bağımsızdır.

### Kayıt Dosyaları / TR–EN

- `EditorialWorkspaceV3` içinde **TR / EN** geçişi ve `PublicationTranslationCenter`: 5 yayın içeriği türü (kamera, anlatı, evren kaydı, içindekiler, çizim), tür/durum/başlık filtreleri, seçilen içeriğin karşılaştırmalı dil editörü.
- Onaylı Türkçe yayın metni, İngilizce AI üretiminin zorunlu kaynağıdır. Çözümleme, hikâyeleştirme, geometri, kaynak kimlikleri, referans ve semboller değiştirilemez. AI her zaman **taslak veya aday** oluşturur, onay vermez.
- Onaylı Türkçenin revizyonuna bağlı `tr_dependency`, İngilizcenin geçerliliğini takip eder. Eski SQLite tablolarına yeni sütun eklenir ve eski onaylı EN metinlerine, mevcut TR onayları temel alınarak sürüm damgası verilir. Böylece önceki çeviriler kaybolmaz; yalnız TR sonradan değişirse EN stale olur.
- `publication-translation-batch.cjs` SQLite'da **kalıcı** tek-işçi iş kuyruğudur. İş sırası: queued → running → done/failed/skipped. Yalnız EN eksik veya stale, TR'si onaylı kayıtlar sıraya alınır. Onaylı EN değişmez; manuel draft/approved metinler AI tarafından doğrudan ezilmez; yeniden üretim adayına dönüşür. Duraklat, devam et, hataları yeniden dene. Studio kapanırsa süren iş sıraya döner ve yeni oturumda elle devam edilebilir.
- `languagesOverview`, `languagesGet/Save/Generate`, `languagesBatch...` preload/IPC sözleşmeleri kullanılır. AI endpoint'i mevcut Studio ayarlarını kullanır; ikinci sağlayıcı konfigürasyonu yoktur. Toplu üretim hiçbir şekilde otomatik yayın yapmaz.
- Kayıt Dosyaları'nın sağdaki görsel profili, seçili evren yayınıyla eşleşen kayıtta görünür kalır. `TranslationStatus` ana sayfa kısa yolu Kayıt Dosyaları'na yönlendirilir.

### Yayın Merkezi / Publication V2

- `PublishCenter.tsx` tek ekran: **Evren**, **Görseller**, **Çizimler** değişiklikleri ve otomatik hazırlık kontrolleri; yayın etkinleştirme, yönetici bağlantısı ve dil durum özeti.
- `publication-updates.compareCoverage()` mevcut canlı paket ile yerel paketin kimliklerini karşılaştırır. Yeni anlatı, evren kaydı, ilişki, kamera içeriği, içindekiler bölümü, çizim katalog/revizyonu veya destek kayıtlarındaki fark **tam yayın** önerir. Sadece mevcut kayıt/görsellerin güvenli değişimi varsa **güncelleme** önerir.
- Gelişmiş yayın tercihlerinde tam/güncelleme elle seçilebilir. Yerel içeriğe eklenen yeni kayıtları dışarıda bırakacak `update` seçimi için ayrıca açık onay alınır.
- Önceden ayrı **yerel paket oluştur** butonu yoktur: `studio-runtime.publishPublicExport(mode)` içinden `createPublicExport(mode)` çağrısı yayın komutunun bir aşamasıdır. SHA-256 doğrulama, hashed asset upload, baseline fingerprint kilidi, atomik publication manifest etkinleştirme ve sunucu doğrulaması **değişmedi**.
- Varsayılan olarak kısmi TR/EN onayı desteklenir; onaysız bir dil varyantı yayınlanmaz. **İki dil tam onaylı olsun** seçeneği yayın öncesi daha katı kontrol sağlar. Güncelleme yolu mevcut kayıtlar için iki dil onayı ister; eksik dillerle bu kayıtların üzerinde yazmaz.
- Son paket, fingerprint ve dosya yolu yalnız **Yayın geçmişi ve teknik ayrıntılar** içinde görüntülenir.

### Temizlik ve kabul

- Kullanılmayan `publish-center.css` ve `publication-translation-center.css` kaldırıldı, `styles.css` içindeki eski import temizlendi.
- `npm run verify:publication-workspace` → dil kaynağı/dependency, toplu iş kuyruğu, yayın kapsama kontrolü, sınır testleri, React/Playwright 1280×720–1500×870.
- `node apps/studio/tests/publication-languages.browser.mjs` → gerçek SQLite + Studio React, çift dil onay/aday/stale regresyonu.
- `npm run verify:publication-v2`, `npm run verify:publication-v2-ui`, `npm run verify:visual-completion`, `npm run verify:studio-shell`, `npm run build:studio` ve diğer release kontrolleri.

Bu milestone canlı siteye aktarılmaz, çalışan demo/gerçek kayıtları temizlemez, sahne efekti yayın hattını değiştirmez.
