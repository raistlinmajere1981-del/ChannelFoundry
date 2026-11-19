# BirDeSenGör — Resmî Açılış ve SEO Yayını (20.11.2026)

## Durum
- Resmî site: https://birdesengorgizlievren.com/
- Yayın kimliği: `pub-dd881d38101123b4c2012800`
- Doğrulama: 20.11.2026, Türkiye saatiyle 01.31; bağımsız tekrar kontrol 01.44.
- Ana sayfa: HTTP 200, `X-Robots-Tag: index, follow`, canonical ve karşılıklı TR/EN hreflang.
- `robots.txt`: genel taramaya izin; özel API ve içerik JSON'undan kaçınma yönergeleri; sitemap yönlendirmesi.
- `sitemap.xml`: 4.303 benzersiz adres (4.301 içerik + iki dilin ana sayfaları).
- SEO: Kaynak sürümüne bağlanan yalnızca onaylı içerikten 4.301 sayfa. Karakter/nesne/mekân/olay/öykü dahil Evren kayıtları `/tr/evren/kayit/:id` ve onaylı çevirisi varsa `/en/evren/kayit/:id` ile okunabilir. Yazılı içerik kaynak sadakati için otomatik gerçeklik filtresinden geçirilmedi.
- İngilizcesi bulunmayan kayıtların İngilizce SEO rotası 404; onaysız dil alternatifi ilan edilmez.

## Yayın kapsamı
| Veri | Canlı |
| --- | ---: |
| Onaylı kitap bölümleri | 279 |
| Evren kayıtları | 2.717 |
| Evren ilişkileri | 5.519 |
| Onaylı video çözümlemeleri | 50 |
| Yayındaki görseller | 15 |
| Özellik kaydı taşıyan Evren kayıtları | 54 |
| Özellik alanı | 90 |
| İngilizce özellik değeri gösterilebilen kayıtlar | 43 |
| SEO: TR bölümler | 279 |
| SEO: EN bölümler | 279 |
| SEO: TR Evren kaydı | 2.684 |
| SEO: EN Evren kaydı | 958 |
| SEO: TR/EN video | 50 / 50 |
| SEO: TR çizim | 1 |
| Sitemap | 4.303 |

- Studio'da henüz kabul edilmemiş dört harici görsel sepeti kaydı ve beş özellik önerisi yayına dahil edilmedi. İngilizceye çevrilmemiş Evren kayıtları gelecekte partiler halinde tamamlanabilir.
- SEO açıklamaları yalnız yayımlanmış onaylı metinlerin kısa alıntılarından türetilerek toplu onaylandı; kaynak dışında yeni bir iddia eklenmedi.

## Yayın güvenliği
- Önce canlı publication ve Studio SQLite yedeği alındı. Sahnenin canlıdaki dokuz görseli muhafaza edildi, altı yeni görsel yüklendi.
- 15 görsel sunucu SHA-256 değerleriyle doğrulandı.
- Büyük birleştirilmiş istek yerine ayrı doğrulanan iki sunucu işlemi kullanıldı: tam `publication.json` ve aynı fingerprint'e bağlı yetkili `publish_seo` yan işlemi.
- Resmî SEO rotaları etkin, ancak Studio/topluluk API kimlik doğrulaması değiştirilmedi ve özel API yanıtları `noindex` olarak kalıyor.
- Site dosyaları `deploy-natro.mjs --deploy` ile dağıtıldı; `content/` klasörüne FTPS silme uygulanmadı.
- Canlı test: 14/14; web birim testleri: 293/293; Studio derlemesi, publication/özellik/çeviri/SEO kontrol testleri başarılı.
- Arama motorlarının indeksleme süresi ve sıralaması garanti edilemez. Search Console mülk doğrulaması / indeks talebi yapılmadı.

## Dosyalar ve yedekler (Git dışında)
- `channels/birdesengor/.local-data/studio/official-release-20261120/real/`: yayın, SEO, aktarım işaretleri ve canlı kontrol.
- `channels/birdesengor/.local-data/studio/backups/official-launch-20261120-preflight/`: önceki Studio veritabanı ve eski canlı yayının kopyası, eski SEO uç noktası kaynakları.
- `channels/birdesengor/.local-data/studio/backups/official-launch-20261120-postrelease/`: resmî yayın sonrası Studio veritabanı, görseller ve SEO çalışma alanı arşivi; `backup-checksums.json`.
- Bu klasörlerdeki özel kimlik doğrulama bilgileri, medya adayları ve veritabanı içerikleri Git'e eklenmedi.

## Kodda değişen önemli alanlar
- SEO evren kaydı türü, güvenli ayrı SEO yayın API'si, ana sayfa canonical/hreflang, sitemap üretim optimizasyonu ve canlı indeksleme.
- Studio Evren özellik sözlüğü için İngilizce etiketler ve kaynağa bağlı yaş dönüşümleri.
- Görsel sepetinde harici görsel bekletme/içe aktarma; kitaba yalnız açık kabul aşamasında yazılır.
- Sahne efekti ayarları yeni sürüme dahil edildi.

## Sonraki oturum
- Kalan Evren İngilizce kayıtları küçük partilerle tamamlanır.
- Search Console sahipliği ve indeks durumları ayrıca izlenebilir.
- Dört bekleyen dış görsel ve beş özellik önerisi, otomatik olarak yayımlanmaz.
