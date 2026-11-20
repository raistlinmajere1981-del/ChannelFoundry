# BirDeSenGör — Evren Arşivinde Boş İçerik Düzeltmesi (20 Kasım 2026)

## Kaynak ve neden

Kitabın Kral Arohan ve Tuji sayfalarında görsel mevcutken, gövde metninde “Bu dilde onaylı içerik henüz yok.” görüntüleniyordu. Sorun görünümden değil, iki dilli publication yükündeki `locales.tr` eksikliğinden kaynaklandı.

Canlı yayındaki 2.717 Evren kaydının 33'ünde geçerli Türkçe dil varyantı yoktu. Bunların 10'unda eski onaylı Türkçe metinler Studio kaynak revizyonu sonrasında geçersizleşmiş; 23'ünde daha önce ayrı bir Türkçe dil varyantı oluşturulmamıştı. Bazı eski İngilizce onaylar da güncel kaynakla eşleşmediği için yayımlanmıyordu.

## Uygulanan düzeltme

- 33 kaydın güncel ve onaylı Studio Evren kaynakları incelendi. Türkçe metinler doğrudan ilgili kaynak kaydının kendisinden, adı/kayıt türü/özet/ayrıntı kaynakları değiştirilmeden alındı. Özgün anlatıya yeni iddia eklenmedi; çeviri modeli kullanılmadı.
- Özel Studio SQLite anlık yedeği ve eski canlı publication/SEO paketleri oluşturuldu. Yeni paket bağımsız SQLite staging ortamında doğrulandı.
- Yalnız söz konusu 33 kaydın `locales.tr` alanları güncellendi. Kaynak kimlikleri, onaylı İngilizce varyantlar, kaynak anlatıları, ilişki ağı, tüm görseller ve diğer 2.684 Evren kaydı değişmeden kaldı.
- Eski ve güncel kaynakla uyuşmayan İngilizce çeviriler güvenlik kontrolü aşılmadan gizli kaldı. **33 kayıt için güncel İngilizce metin veya onay bekleniyor.** Bu durum Türkçe metinlerin yayınını engellemiyor.
- Eklenen 33 onaylı Türkçe arşiv sayfasının SEO girdisi, yeni publication fingerprint'ine bağlanarak eski 6.027 sayfa korunmak suretiyle yayınlandı.
- Sunucudaki publication ile SEO/sitemap doğrulandıktan sonra ana Studio SQLite'daki Türkçe dil onayları ve yerel `public-export` paketi aynı sürüme eşitlendi.
- `scripts/verify-live.mjs` artık her canlı kontrolde TR/EN arşiv dil kapsamasını yazdırıyor. Eksik olması bilinçli kısmi yayınları engellemiyor, fakat uyarı görünür.

## Son canlı doğrulama

| Alan | Sonuç |
|---|---:|
| Yayın kimliği | `pub-77c30a8ca32fe9113256bdc7` |
| Evren kayıtları | 2.717 |
| Onaylı Türkçe Evren kaydı | **2.717 / 2.717** |
| Onaylı İngilizce Evren kaydı | **2.684 / 2.717** |
| Türkçe + İngilizce SEO sayfaları | 6.060 |
| Sitemap adresi | 6.062 |
| Yayındaki görseller | 20 |
| Evren ilişkileri | 5.519 |
| Kitap bölümleri | 279 |

- Canlı publication dosyası, Studio yayın yetkisi ve bağımsız HTTPS okuması üzerinden eşleşti.
- Kral Arohan, Tuji, Nezrin, Hezmina, Babil, Düğümlü Kitap, Meseyn ve Dinoran Türkçe kitap modelinde gerçek özet ve ayrıntılarla doğrulandı.
- Site JavaScript paketi ve mevcut SEO canonical sistemi değiştirilmedi.
- İçerik yayını, SEO yayını, canlı doğrulama ve yerel Studio eşitleme işaretleri Git dışındaki `channels/birdesengor/.local-data/studio/source-content-repair-20261120/` klasöründe tutuluyor.
- Yedekler: aynı klasörde `studio-before-promotion.sqlite`, `studio-staging.sqlite`, `publication-before.json`, `seo-before.json`, `pre-local/`.
- Geçerli olmayan eski İngilizce varyantların geri açılması doğru değil; sonraki İngilizce çeviri turu bu 33 kaydı güncel kaynakları üzerinden ele almalıdır.
