# Yayın Atölyesi — Ayarlar V3

## Kararlar (13 Kasım 2026)

**Ayarlar**, beş sekmesi ve tek `SettingsController` kayıt çubuğu olan bir çalışma ortamıdır: Kanal ve Yayın, AI Servisleri, Topluluk, Yerel Veri, SEO. Analitik raporları ayar değildir; Gösterge Paneli → Site performansı → Ayrıntılar bölümüne taşındı.

**Merkezi kaydetme:** `SettingsController.tsx` kayıt çağrıları ayrı mevcut servislerde kalırken bütün aktif bölümlerin taslak, işlem ve hata durumlarını yönetir. İlk açılan sekmeler ikinci kez yüklenmez; gizlenerek yerel taslakları korunur. `Tümünü kaydet`, `Vazgeç` ve `Ctrl/Cmd+S` desteklenir. Geçiş ve proje seçme işlemleri kaydedilmemiş değişiklikleri doğrular. Kayıtlar **çoklu sunucu işlemi** olduğu için tam veritabanı transaction'ı değildir; başarılı bölümler korunur ve hata alan bölüm açıkça bildirilir.

**Güvenli/ayrı işlemler:** Topluluk yönetici bağlantısı ve parolası mevcut secure storage yönteminde kalır; kaydetme işlemi ayrıca kullanıcı etkileşimi ve doğrulama gerektirir. YouTube kataloğu bağlama, site bağlantı testi, ziyaretçi sayacı sıfırlama ve Evren sıfırlama (otomatik yedekli) genel kayıt düğmesine bağlı değildir.

**AI:** `AiProviderSettings.tsx` kayıtlı sağlayıcı, metin/görsel modelini ve reasoning ayarını kataloğu yeniden sorgulamadan görüntüler. Metin ve görsel servisleri iki özet kartında görünür; seçilenin yapılandırması aşağıdadır. Modelleri getir ve bağlantı/model testleri bağımsızdır. Ayarların veri biçimi veya anahtar saklama davranışı değiştirilmedi.

**SEO:** `SeoSettings.tsx` onaylı kaynak, mevcut TR/EN başlığı/açıklaması, AI önerisi ve arama sonucu önizlemesini bir yüzeyde sunar. Kaynak seçildiğinde kaydedilmemiş düzenlemeler için geçiş koruması çalışır. Tekil SEO önerisi hem normal yayın içerikleri hem site genel SEO kimliği için desteklenir. `seo-batch.cjs` ayrı bir kalıcı, proje kimliğine bağlı FIFO kuyruktur. İşler duraklatılabilir, devam ettirilebilir veya hatadan sonra yeniden denenebilir; önceki oturumdaki `running` işleri tekrar sıraya alınır. AI önerisi `seo-workspace.cjs` içinde `candidate` olarak source hash ile saklanır; **onaylı SEO asla otomatik ezilmez**. Yeni kaynak değişmişse eski aday görünmez; onay için editörün bilinçli kararı gerekir. PHP/Publication V2 SEO manifesti yalnız onaylı kayıtları alır, demo noindex/robots/şifre korumasına dokunulmaz.

**Tema ve ekran:** `settings-v3.css` aktif tema tokenlarını kullanır. Özellikle `universe-maintenance-settings.css` içindeki sert koyu renkler kaldırılmıştır. SEO iç içe kaydırma alanları, kompakt sekmeler, geniş kaynak ve düzenleyici alanı ile 1280×720–1500×870 pencereler için sınandı. Kayıtlı analiz raporlarında ham içerik kimlikleri yerine bulunan başlıklar veya okunur içerik türü gösterilir.

**Silinen kalıntılar:** `site-insights.css` içindeki eski SEO editörü CSS blokları kaldırıldı. Sadece Ayarlar ekranında kullanılan kontrolör ve yeni çalışma alanı stilleri eklendi.

## Doğrulama

- `npm run verify:settings-workspace` — 3 SEO FIFO/kalıcılık testleri, SEO manifest ve yayın izolasyonu, Playwright çok sekmeli kayıt/görsel/SEO/koyu-açık tema/sabit ekran kabul testi.
- `npm run verify:appearance` — tüm Studio temaları ve yeni sekme sahipliği.
- `npm run verify:studio-shell` / `npm run verify:fixed-viewport` — uygulama kabuğu ve sabit ekran.
- `npm run verify:publication-workspace` / `npm run verify:publication-v2` / `npm run verify:publication-v2-ui` — yayın ve çeviri sınırları.
- `npm run verify:records-workspace` — Kayıt Dosyaları regresyonu.
- `npm run build:studio` — TypeScript ve üretim bundle.

Bu milestone'da canlı deploy, yayın manifesti güncellemesi veya gerçek kanal/SEO/AI ayarlarının yeniden yazımı yapılmadı. Paralel web alt deposu çalışmaları bu milestone'a alınmamalıdır.
