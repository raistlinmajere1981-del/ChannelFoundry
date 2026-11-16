# BirDeSenGör — Özel Tasarım Önizlemesi Yayın Kapanışı

**Tarih:** 16 Kasım 2026
**Site:** https://birdesengorgizlievren.com/
**Son yayın kimliği:** pub-b45c74b37b5cabd2ea40eec9
**Yayın yöntemi:** Güncel web arayüzü için FTPS; iki dilli, imzalı publication.json için ayrıca tasarım-önizleme dağıtımı.

## Tamamlanan içerik

- Evren kitabındaki **105/105 anlatı** onaylı Türkçe ve İngilizce metne sahip. İçindekiler ağacındaki **9/9 başlık** iki dilde güncel.
- Düğümlü Kitap'ın 1–68 aralığındaki **65 doğrudan kayıtlı daveti**, numaralı ve özgün video bağlantılarıyla yer alıyor. 25, 56 ve 66'nın doğrudan görüşme kaydı bulunmuyor. Eski sekiz anlatı **Ara Kayıtlar** altında ayrı korunuyor.
- Diğer konu başlıkları **Bledum, Mezna ve Kapsız Kitap**; bağımsız kayıtlar kaybolmadı.
- **1.663 Evren varlığı** Türkçe onaylı yayın varyantına sahip. İngilizce güncel varlık açıklaması **411/1.663**. Kitabın içinde doğrudan referanslanan 108 varlıktan **63'ünün İngilizcesi güncel**, 45'inin eksik veya eski. Ana 105 anlatının İngilizce metinleri tamdır; arşivin tamamı çift dilli değildir.
- **3.619** kaynak ilişkisi, **50** kamera videosu, **1** çizim kaydı yayında.
- Sahne resmi/karakalem üretimi ertelendi. Yeni publication paketinde **0 görsel asset** var. Görsel kayıt ve atölye veritabanı temizlenmedi.
- SEO içeriği/önerisi/onayı oluşturulmadı; kullanıcının kararıyla tasarım aşamasından çıkışa ertelendi.

## Süreç

1. İşlem öncesinde yerel SQLite yedeği alındı. Tüm mevcut yedekler korundu.
2. Codex CLI ile onaylı Türkçe metinlerden eksik İngilizce kitap bölümleri, konu başlıkları ve çizim açıklaması çevrildi. Alan yapısı, başlıklar, kaynak video ID'leri, inline referanslar, uzunluk, dilbilgisi göstergeleri ve korunan adlar kontrol edildi. Türkçe anlatı metinleri değiştirilmedi.
3. Onaylı Evren kaynaklarından eksik ve eski Türkçe varlık yayın metinleri onaylandı: 1.229 yeni, 26 yenilenmiş, 408 önceden geçerli. Kaynak düğüm/ilişki içeriği değiştirilmedi.
4. İki bağlı varlığa Codex ile, Eşref Abi adlı varlığa OpenCode/DeepSeek ile İngilizce açıklama eklendi. Codex kullanım kotası dolduğu için kalan bağlı 45 EN açıklama zorlanmadı. OpenCode servisi kapatıldı ve Studio sağlayıcı ayarları değiştirilmedi.
5. Web **289/289** testten, production build ve dist doğrulamasından geçti. FTPS kuru deneme başarılıydı; site arayüzü mevcut kullanıcı/topluluk verileri silinmeden yüklendi.
6. Yeni içerik paketi imza/fingerprint kontrolünden geçti; **105 TR ve 105 EN anlatı**, 65 doğru davet ve 1.663 TR varlık kontrol edildi.
7. Normal prod yayın hattındaki görsel tamamlama ve genel Evren değişiklik kapısı değiştirilmedi. Yalnız tasarım aşamasında kullanılmak üzere ayrı, imzalı, atomik FTP publication aktarım yolu kullanıldı. Canlı eski manifestler yedeklendi.
8. Son canlı Playwright E2E kontrolleri: **1366×768 Türkçe** ve **390×844 İngilizce** kitap açma, **105 İçindekiler kaydı**, **65 davet başlığı** doğrulandı. Canlı yayın endpoint, JS dosya hash'i, parola kapısı, hatalı giriş, hatırlama çerezi ve eski dosya kalıntıları **npm run verify:live** ile PASS.

## Korunan yedekler

- channels/birdesengor/.local-data/studio/backups/before-preview-translation-20261116-152805.sqlite.gz
- channels/birdesengor/.local-data/studio/backups/before-private-book-preview-export-20261116-155314.tar.gz
- channels/birdesengor/.local-data/studio/backups/before-design-preview-publication-2026-11-16T12-54-16-003Z/
- channels/birdesengor/.local-data/studio/backups/before-design-preview-publication-2026-11-16T12-58-15-900Z/
- channels/birdesengor/.local-data/studio/backups/after-design-preview-publication-20261116-155919.sqlite.gz

Eski yedekler silinmedi. SQLite quick_check başarılı, 105 anlatı doğrulandı. 3.930 adet bekleyen genel Evren kaynak farkı tüketilmedi.

## Erişim / SEO sınırı

- Ana sayfa şifreli ve noindex/nofollow; robots.txt tüm tarayıcılar için Disallow: / kuralına sahip.
- **Önemli:** /content/publication.json yolu kimlik doğrulamadan doğrudan HTTP 200 ile okunuyor. Dolayısıyla arayüz parolalı ve arama motorlarına kapalı olsa da bütün metin kaynağı gerçek erişim kontrolü altında değildir. Özel içeriğin tamamını gizlemek istenirse sunucu yayın verisi ve ilgili API'ler ayrıca oturum doğrulaması altına alınmalı.
- Bu çalışmada SEO meta sayfa onayları, sitemap ve arama motoruna açma işlemleri yapılmadı.

## Sonraki çalışma

- Kitabı canlı, şifreli önizlemede okuyup tutarlılık/bağlantı/not düzeltmeleri belirlenebilir.
- Kitapta bağlanan 45 eksik EN Evren varlık açıklaması ve diğer arşiv EN kayıtları ayrıca çevrilebilir. 105 anlatının iki dilde okunmasına engel değil.
- Kayıt yönetimindeki toplu görsel üretim geliştirmesi tamamlandığında görüntüler eklenebilir.
- SEO ve indeksleme tasarım aşamasının sonunda ele alınacak.
- Kamuya açık final yayından önce kalan 3.930 Evren kaynak farkı bütün içerikle uzlaştırılmalı.

**Git commit veya push yapılmadı.** Studio masaüstü uygulaması açılmadı; uzun süreli background işi bırakılmadı.
