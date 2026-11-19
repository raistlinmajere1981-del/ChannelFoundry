# BirDeSenGör — açık sahne, kısmi İngilizce ve yayın kapanışı

**19 Kasım 2026**

**Alan adı:** https://birdesengorgizlievren.com/

**İlk açılış publication:** `pub-928879f6e7942b060e61597a` (destekçi düzeltmesiyle güncellendi; aşağıya bakın)

## Yayın kararı

Açılış için bütün İngilizce metinleri bitirme zorunluluğu kaldırıldı. Site sahibi Türkçe içerikleri canlı sürümde gözden geçirebilir. Sonradan yalnız gereken kayıtlar düzenlenir veya çevrilir. SEO/arama motoru açılışı ayrı bir son aşamadır.

- Siteye girişteki geçici ortak PHP şifre ekranı kaldırıldı; `index.php` doğrudan React sahnesini sunuyor. Yönetici ve topluluk oturumları / parola denetimleri değiştirilmedi.
- `X-Robots-Tag: noindex, nofollow` ve `robots.txt: Disallow: /` korunuyor. SEO içerik rotaları ve sitemap, `BIRDESENGOR_SEARCH_PUBLIC=1` olmadan **404** döndürür. Canonical/hreflang SEO onayları bu turda hazırlanmadı/açılmadı.
- İngilizce içindekilerde **279/279 başlık hazır**. **115** bölümün tam EN gövdesi önceden onaylı, **164** bölüm yalnız İngilizce indeks başlığıyla görünür. Gövdeye girildiğinde eksik dil uyarısı kalır; Türkçe gövde İngilizceymiş gibi gösterilmez.
- İçindekiler başlıklarının kaynağa bağlı bağımsız tablosu `publication_toc_titles`; değişen Türkçe kaynak başlığı ve kaynak SHA başlık çevirisini geçersiz kılar. İçindekiler çevirisi tam EN bölüm onayı değildir.
- İçindekilerdeki üç yeni konu/alt konu için eksik toplam altı TR/EN outline varyantı onaylandı; eski `The Knotted Book` seri başlığı kanonik `Düğümlü Kitap` oldu.
- Evren arşivi **2.718** kayıt, **5.519** ilişki; **2.685** varlık TR, **407** varlık EN onaylı varyantıyla. Onayı eksik kayıtlar sözde onaylı gösterilmez. Kamera ve Vefk seçimi kaynak sözleşmesine bağlı.

## Canlıya çıkan fark ve güvenli dağıtım

Önceki yayın `pub-67e6c237405e9868fd316870`; yeni yayın `pub-928879f6e7942b060e61597a`.

| Veri | Önce | Sonra | Yeni | Silinen |
|---|---:|---:|---:|---:|
| Anlatı | 276 | 279 | 3 | 0 |
| Evren varlığı | 2.695 | 2.718 | 23 | 0 |
| Evren ilişkisi | 5.477 | 5.519 | 42 | 0 |
| Görsel | 4 | 5 | 1 | 0 |

- Web: `birdesengor-natro clean-dry-run` ardından `clean-deploy` başarılı. Yönetilen statik varlıklar eşitlendi, `content/` ve topluluk verileri web deploy sırasında korunuyor.
- İçerik: `scripts/deploy-publication-review-natro.mjs --deploy` kayıp ID kontrolü + içerik SHA + yeni varlık SHA + FTPS atomik stage/rename + canlı fingerprint doğrulamasıyla başarılı. Sunucu `CANLI FULL REVIEW PASS` döndürdü.
- Yerel yedekler: `channels/birdesengor/.local-data/studio/backups/before-20261119-public-launch.sqlite`, `before-20261119-public-launch-publication.json`, `before-20261119-public-launch-index.php`.
- Canlı içerik geri dönüş yedeği: `channels/birdesengor/.local-data/studio/backups/before-reviewed-full-publication-2026-11-19T02-02-27-456Z/`.
- Web: 292/292 birim testi, üretim build, dist ve PHP preview kontrolü geçti. Kitap içindekiler tarayıcı testleri mobil/masaüstünde geçti. Canlı giriş, JS SHA, noindex/robots ve yayın paketi kontrol edildi.

## Saklanan çeviri adayları ve sonraki çalışma

- Tamamlanmış ancak **editoryal onay/yayın almamış** dosya adayları: `channels/birdesengor/.local-data/studio/translation-work-20261119/` (pilot 23, uzun kitap 3, Evren 246 kayıt). Bunları bu yayında topluca onaylamadık; bunlar mevcut onaylı canlı EN sayıları **değildir**.
- Pilot/Codex kalite incelemelerinden gelen `Düğümlü Kitap`, `telsiz/radyo`, Ömer'in üçüncü şahıs anlatımı, modalite/konuşan kişi ve kaynak adları düzeltmeleri ilgili dosya adaylarına uygulandı. Tüm kayıtlar yeniden sürüm/şekil denetiminden geçti.
- Codex `medium` ile üretilen 60 kısa adayın 12'lik örnekleminde 7 anlam düzeltmesi gerekmesi nedeniyle bu çıktıların tamamı editoryal gözden geçirme gerektirir. Bu bir kalite kapısıdır; çevrildi diye otomatik onay yoktur.
- Türkçe site sahibi incelemesinden sonra yalnız değişen onaylı kaynakları düzelt; ilgili kayıtların EN çevirisini/revizyonunu güncelle. Görseller gerekirse paketler halinde. En son SEO başlık/açıklama onayları, canonical/hreflang/sitemap ve arama motoru erişimini ayrı bir kontrollü yayında aç.
- Çeviri devamına ilişkin teknik komutlar `docs/BIRDESENGOR_TRANSLATION_RESUME_20261119.md` içindedir. Hacimli çeviri otomatik çalışmıyor; kota fren işaretleri korunuyor.

## Git / çalışma kapanışı

Web ve Studio kaynakları ayrı Git depolarında; web alt modülünün güncel commit'i, ana depoda submodule pointer olarak kaydedilir. Yerel SQLite yedeği, geçici çeviri dosyaları ve FTPS kimlik bilgileri **Git'e eklenmez**. Canlı yayın ile Git kaynak sürümü arasında son uyum kontrolü yapılır.

## Son destekçi senkronizasyonu — 19 Kasım

**Güncel canlı publication:** `pub-6fba852098525b848f30ae5b`.

- Topluluk Defteri sağ/sol destekçi bölümünün PHP sorgusu yalnız `youtubeAnalysis.videos` listesindeki 50 tam TR/EN yayın varyantını kullanıyordu. Oysa yeni üç bölüm, `cameraArchive.videos` içindeki kaynak çözümleme arşivinde mevcut ve `support.sponsors` içinde onaylıydı.
- Destekçi sayfası artık aynı imzalı paketteki, editoryal olarak seçilmiş tamamlanmış `cameraArchive.videos` kayıtlarını kullanır. TR için yalnız özgün YouTube başlığı kaynak metadata olarak gösterilir; eksik İngilizce çeviri üretilmiş gibi sunulmaz. Üyelere özel veya yayımlanmamış video kabul edilmez.
- Yeni üç bölüm doğrulandı: 12 Kasım 2026 `inlvdZQQCRU` → **Altınay Ruhsal Uyanış**; 14 Kasım 2026 `Y4x5esJF-bY` → **Amine Sultan**; 16 Kasım 2026 `UiY0YmNqpT8` → **Cihat Girgin**. Sponsor kimliği/video ilişkileri korunmuştur.
- Çizim Atölyesi, video metninin ayrıca TR/EN onayı bulunmasa bile videonun onaylı destekçi kaydından güncellenebilir. Otomatik üretim, editoryal `curated` / `confirm` doğrulamalarını ve kaynak tarihini hâlâ şart koşar. Yeni imzalı çizim belgesi **revizyon 5**: `16 Kasım 2026 Cihat Girgin`.
- Kayıt sayıları değişmedi: **279 anlatı, 2.718 Evren varlığı, 5.519 ilişki, 5 görsel**. Yeni publication yalnız destekçi görünürlüğü ve çizim revizyonunu günceller; çeviri adayları onaylanmadı.
- Yerel geri dönüş kopyası: `channels/birdesengor/.local-data/studio/backups/before-sponsor-sync-20261119.sqlite` ve `before-sponsor-sync-20261119-publication.json`. Canlı eski paket kopyası: `channels/birdesengor/.local-data/studio/backups/before-reviewed-full-publication-2026-11-19T02-27-37-279Z/`.
- Testler: Studio ilgili modüller **20/20**, PHP topluluk API **22/22**, web **293/293**; build, PHP syntax, dist, preview, FTPS plan/deploy ve canlı üç bölüm/çizim revizyonu doğrulamaları geçti. Site giriş şifresiz kaldı; `noindex`, `robots.txt` ve SEO rotası 404 denetimi korundu.

## Son portre yayını ve Hakan birleştirmesi — 19 Kasım 2026

**Nihai canlı publication:** `pub-17650d683f675d03403873c0`
**Alan adı:** https://birdesengorgizlievren.com/?lang=tr

- Studio'da sonradan eklenen dört manuel karakalem portresi yeniden dışa aktarıldı: **Hakan Demir**, **İbni Kâruf**, **İbni Necemin**, **Eşref Abi**. 5 eski görsel korunup toplam **9** oldu; dört yeni dosya canlı sunucuda HTTP 200 ve SHA-256 ile doğrulandı.
- Kullanıcının önceki talebine uygun olarak `Hakan` kaydı, `Hakan Demir` kaydında birleştirildi. İki kaynak video, iki ilişki ve Türkçe/İngilizce onaylı varyantlar korundu. Anlatıdaki eski Hakan kimlik bağı, korunan ana kayda yönlendirildi; okura görünen bağlantı etiketi değişmedi. Evren kayıt sayısı **2.718 → 2.717**, anlatı **279**, ilişkiler **5.519** olarak kaldı.
- Geniş yayın korumasına, yalnız eski `universe-character-3e78846d1ca1c3` kimliğinin `universe-character-9df60e998324b9` ile birleştirilmesi için **tek seferlik çevre değişkeni onayıyla** ve katı kaynak/bağ kontrolüyle izin verildi. Diğer mevcut kayıtları silmek hâlâ engelleniyor.
- Hakan anlatı referansı nedeniyle değişen kaynak SHA, aynı başlıklı İngilizce içindekiler çevirisinin sürüm işaretini geçersiz kılmıştı. Başlık metni değişmediği doğrulandı ve yeni kaynak SHA ile yeniden bağlandı. Son pakette **279/279 İngilizce içindekiler başlığı** mevcut; henüz çevrilmemiş 164 gövde onaylı gösterilmiyor.
- İlk görsel paketinde `pub-60e41076443a5b08b66ca234` yayımlandı; ardından tek başlığın kaynak sürümü yenilenerek **nihai** `pub-17650d683f675d03403873c0` atomik yayımlandı. Canlı doğrulama: 279 anlatı, 2.717 Evren kaydı, 5.519 ilişki, 9 görsel, dört yeni portre SHA eşleşmesi, Hakan'ın tek kimliği ve anlatı bağı, Çizim Atölyesi Cihat Girgin revizyonu 5, `noindex` ve `robots.txt`, sitemap 404.
- Studio SQLite ve önceki yerel yayın paketi yedekleri: `channels/birdesengor/.local-data/studio/backups/before-portraits-final-release-20261119.sqlite` ve `before-portraits-final-release-20261119-publication.json`. İki canlı yayın geçişi için dosya yedekleri: `before-reviewed-full-publication-2026-11-19T03-16-50-451Z/` ve `before-reviewed-full-publication-2026-11-19T03-20-16-769Z/` (aynı yedekler dizini altında).
- İlgili Studio otomatik testleri **26/26**, SQLite `PRAGMA quick_check=ok`; web sahne kaynakları, SEO ayarları, topluluk verileri, henüz onaylanmamış çeviri adayları değiştirilmedi. Takip işleri kullanıcı ve site sahibi incelemesinden sonra ayrı oturumlara bırakıldı.
