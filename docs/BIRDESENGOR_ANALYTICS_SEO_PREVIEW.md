# BirDeSenGör — Analitik + SEO (önizleme aşaması)

## Durum
- Önizleme girişi, `robots.txt` disallow ve kök `X-Robots-Tag: noindex, nofollow` korunur.
- Yayın içeriği/demolar silinmez. Topluluk veritabanına dokunulmaz.
- Studio ana panelindeki Evren kayıtları yerine **Site performansı** yerleştirildi.
- Studio **Ayarlar → Ziyaretçiler / SEO** sekmeleri eklendi. Ek bir tarayıcı analitik servisi kullanılmaz.

## Kişisel kimlik tutmayan ölçüm
- Sahne değişimleri ve kararlı içerik kimlikleri (konu metni, kullanıcı adı değil) `/api/analytics/` üzerinde günlük sayaçlara eklenir.
- Kalıcı ziyaretçi/oturum ID'si, localStorage, takip çerezi, IP, UA, referrer kaydı yoktur.
- Veri yalnız `day, area, content_key, event, hits, active_seconds` sütunlarıyla `channel-foundry-private/analytics.sqlite` içinde saklanır.
- 365 günlük toplulaştırılmış tutma penceresi. Süreler yalnız odaklı, görünür ve yakın zamanda etkileşimli sekmelerde yaklaşık 15 saniyelik dilimler olarak eklenir.
- *Ziyaret* sayısı tekil kullanıcı değil, **sayfa açılışıdır**. Analitik gerçek ziyaretçi kimliği veya yolculuk grafiği üretmez. Metriklerden kişisel davranış çıkarılmamalı.
- Yetkili istatistik okuma: Studio Basic Admin `/api/studio/?action=analytics_summary&days=7|30|90`.

## SEO
- Studio, onaylı `publication v2` içeriğini semantik kimliklere göre SEO önerisine dönüştürür; video ve vefkler yalnız yayın onaylıysa eklenir.
- Başlık/açıklama manuel düzenlenebilir; AI yalnız mevcut yazı modelini kullanarak öneri üretir, hiçbir şeyi otomatik onaylamaz.
- Editör kayıtları proje bazında `seo-workspaces/<project>.json` (Electron userData) dosyasında tutulur.
- Canlı yayın anında SEO manifesti mevcut publication fingerprint ile gönderilir ve sunucuda doğrulanır.
- SEO manifesti web kökü dışında `channel-foundry-private/seo-manifest.json` konumundadır; içerik public `publication.json` dosyasına eklenmez.
- Semantik HTML adresleri: `/evren/bolum/<id>`, `/kamera/video/<id>`, `/vefk/<id>`; etkileşimli sahneye direkt bağlantı içerir.
- `/sitemap.xml` yalnız arama motoruna açma kararı verildiğinde görüntülenir. Değişmeyen içerik hash'lerinin son değiştirilme tarihi korunur.
- Demo aşamasında SEO sayfaları yalnız mevcut önizleme oturumu üzerinden gösterilebilir; `noindex` devam eder.
- `BIRDESENGOR_SEARCH_PUBLIC=1` varsayılan olarak **kapalıdır**. Bu ayar tek başına yayına açma işlemi değildir: ayrıca kök parola kapısı, `robots.txt` ve `X-Robots-Tag` gelecek yayın oturumunda ayrı ele alınmalıdır.

## Kontroller
- `npm run build:studio`, `npm run build:web`
- `node apps/studio/verify-site-seo.cjs`
- `node --test channels/birdesengor/web/tests/analytics-privacy.test.mjs`
- `node apps/studio/verify-publication-v2-ui.cjs`
- `npm --prefix channels/birdesengor/web run verify:dist`
- Önizleme trafiği, canlı sunucuda bu PHP dosyaları dağıtıldıktan sonra sayılmaya başlar; eski site trafiği geri getirilemez.

## Bilinen sınırlar
- IP veya tarayıcı kimliği toplanmadığından tekil kullanıcı, geri dönüş oranı ve kişi bazında gezinme akışı ölçülemez.
- SEO indeksleme ve Google Search Console performansı şifre kaldırılana kadar doğrulanamaz.
- Analytics API'ye ağdan gelen sahte olaylar teorik olarak mümkündür; kaynak sayımını asla finansal/güvenlik kararı için güvenilir kabul etme.
- Çerezsiz tasarım, web sunucusunun olağan erişim kayıtlarını veya KVKK yükümlülüklerini otomatik olarak ortadan kaldırmaz.
