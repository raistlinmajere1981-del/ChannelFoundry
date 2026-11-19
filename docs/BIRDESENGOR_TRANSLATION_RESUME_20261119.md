# BirDeSenGör — Kesintiye dayanıklı EN çeviri, 19 Kasım 2026

## Durum ve güvenlik
- Üretim motoru: `apps/studio/translation-durable.cjs`
- Kaynak: son onaylı Türkçe yayın metinleri; SQLite kaynağına üretim sırasında yazılmaz.
- Veritabanı yedeği: `channels/birdesengor/.local-data/studio/backups/before-en-translation-20261119.sqlite`; `quick_check=ok`.
- Çeviri çalışma dosyaları: `channels/birdesengor/.local-data/studio/translation-work-20261119/` (Git ignored).
- Model: `opencode/deepseek-v4.1-flash-free`, provider variant `max` (OpenCode local 4096).
- OpenCode bağlantı şifresi mevcut `OPENCODE_PASSWORD` ortam değişkeninden alınır; terminal komutunda, aday dosyasında veya Git'e girecek herhangi bir dosyada tutulmaz. Önceki geçici kimlik bilgisi dosyası temizlendi.
- Kaynak kimliği, revizyon/hash, referans kimlikleri, Arapça semboller değiştirilemez.
- EN kanonik `name` değişmeden `displayName` yalnız yayın varyantında üretilebilir.
- Eski onaylı EN korunur; yeni üretim yalnız ayrı dosyada `candidate` oluşturur. Henüz otomatik yayına alma/onay yok.

## İş listeleri
- `pilot`: 3 farklı uzunlukta anlatı, beş Evren türünden dörder kayıt (23).
- `book`: 164 kaynak-onaylı TR kitabı, EN eksik/güncel değil.
- `universe`: 2278 kaynak-onaylı TR Evren kaydı, EN eksik/güncel değil.
- Manifestler ilk oluşturulduklarında kaynak ve onay hash'lerini sabitler; tekrar planlanmaz.
- Pilot ile diğer paketlerde aynı kaydı tekrar çevirmemek için tamamlanan adaylar birebir kaynak hash'i ile yeniden kullanılabilir.

## Durum sorgulama
```sh
cd ~/ChannelFoundry
node apps/studio/translation-durable.cjs status --batch pilot
node apps/studio/translation-durable.cjs status --batch book
node apps/studio/translation-durable.cjs status --batch universe
```

## Güvenli devam ettirme
```sh
cd ~/ChannelFoundry
node apps/studio/translation-durable.cjs run --batch pilot --kind entity --max-records 10 --max-requests 10
node apps/studio/translation-durable.cjs run --batch book --max-records 2 --max-requests 12
node apps/studio/translation-durable.cjs run --batch universe --max-records 10 --max-requests 12
```
`--max-records` yeni oluşturulacak kayıt sayısını, `--max-requests` bu çalıştırmadaki model isteğini sınırlar. `--max-failures` varsayılan 3: üç başarısız kayıttan sonra çalışan durur; kayıtlı parçalar korunur.
Bitmiş kayıtlar ve kaydedilmiş alan parçaları sonraki çalıştırmalarda yeniden üretilmez.

## Kota veya kesinti
- Kota hatası algılanınca `paused-quota.json` yazılır ve o iş dizini durur.
- Limit yenilendikten sonra önceki `run` komutuna **`--resume`** eklenir. Model/variant otomatik değişmez.
- Çalışan işçi dizin içinde `.worker.lock` tutar; aynı paket iki işçiyle aynı anda çalıştırılmamalı.
- Sistem beklenmedik kapanıp kilit dosyası kaldıysa eski PID çalışmıyorken **`--recover-lock`** ile devam edilir.
- Eksik/yanlış JSON veya model yanıtı `errors/` içinde görünür; okunamayan yanıt `responses/` içinde korunur. Başarılı alan parçaları `chunks/` içinde saklanır. `audit --batch pilot` komutu adayları güncel kaynakla yeniden doğrular.
- Uzun anlatı 2.500 karakterlik tahmini alan gruplarıyla parçalara bölünür. Bir parça başarılı olduktan sonra yeniden ödeme yapılmaz.

## Kalite ve yayın sınırı
1. Her aday `publication-languages.validateVariant` ile doğrulanır; özel ad/sayı/uzunluk/Türkçe kalıntısı QA raporu taşır.
2. QA işareti olmayan aday bile anlamsal inceleme ve örneklem kontrolü gerektirir.
3. Onay yalnız sourceHash ve TR bağımlılığı güncelse ayrı bir editoryal adımda yapılmalı.
4. Studio/web yayın, SEO, Git commit/push bu çalışma kapsamına dahil değildir.
5. Diğer geliştirme sessionları aynı SQLite veya bu dizindeki aynı `batch` için eşzamanlı yazma işlemi yapmamalı.

## 19 Kasım — Kota sınırında güvenli duruş

- OpenCode 4096 portu ilk kontrolde erişilebilirken mevcut `OPENCODE_PASSWORD` ortam değişkeniyle kimlik doğrulaması **PASS** oldu; şifre komuta verilmedi. Eski yerel kimlik bilgisi dosyası kaldırıldı.
- Pilot: 23 kaydın 21'i çeviri adayı olarak kalıcı dosyada; 2 uzun anlatı kısmen tamamlanmış. Başarılı alan grupları `chunks/` altında tutuluyor.
- Modelin açık yanıtı: `Free usage limit reached`. İkinci uzun anlatının 8/9 parçasında kota doldu ve işçi durdu. `quota-paused.json` **ortak fren** olarak bütün partilerin yeni isteklerini engelliyor. Parça/veritabanı kaybı olmadı.
- Kalite taraması: 21 adaydan 17 otomatik kontrolde temiz, 4'ünde isim tutarlılığı işareti var (`Babil` → `Babylon`, `Yaşlı Duman` → `Old Duman`/`Old Smoke`). Bunlar hazır/onaylı sayılmadı; editoryal düzeltme gerekiyor.
- Son kontrolde 4096 sunucusu dinlemiyordu. Limit yenilendiğinde OpenCode `serve` yeniden açılmalı ve bağlantı testi tekrarlanmalı.
- Limit yenilenmeden `--resume` kullanılmamalı. Kullanıcı yenilendiğini bildirdikten sonra, örneğin `node apps/studio/translation-durable.cjs run --batch pilot --kind section --max-records 2 --max-requests 12 --resume` ile devam edilebilir. Mevcut parçalar hash'lerinden tanınır ve yeniden çevrilmez.
- `book` ve `universe` paketleri de ortak kota işareti kalkana kadar durur.
- Hiçbir aday Studio SQLite'a onay olarak yazılmadı; SEO, canlı web deploy, Git commit/push yapılmadı.

## Limit yenileme sonrası ikinci çalışma — 19 Kasım 2026

- `OPENCODE_PASSWORD` ortam değişkeniyle OpenCode 4096 erişimi doğrulandı. Şifre hiçbir komuta yazılmadı.
- Pilot **23/23** tamamlandı; 38 başarılı alan grubu korunuyor. Yarım kalan iki anlatı sadece eksik parçalarından devam ederek tamamlandı.
- Anlamsal örneklemde Poyraz referansının cümle bağlanması ve Şira anlatısında `telsiz` / `radyo` ayrımı düzeltildi. Yaşlı Duman kimliği tek biçime çekildi; Babil/Babylon terim eşdeğerliği tanımlandı. Kaynak kimlikleri veya Studio veritabanı değiştirilmedi.
- Motor eklentileri: `--short-first` (küçük içerikler önce), `--max-chunks N` (büyükleri ayrı sıraya bırakır), hatalı referans cümlesi ve telsiz/radyo karışıklığı QA işaretleri, 40+ karakterlik çevrilmemiş alan kontrolü.
- Kitap ana sırası: **3/164** yeni aday, 7 grup kaydedildi. Evren ana sırası: **24/2278** aday, 27 grup kaydedildi; birkaç uzun kayıt tamamlanmamış ara parça olarak saklı.
- Çeviri QA tekrar taraması: pilot 23 temiz, kitap 3 temiz, Evren 24 temiz. Kaynak hash uyuşmazlığı ve yapı hatası sıfır. Bu kontroller tam anlamsal doğrulama veya editoryal onay yerine geçmez.
- DeepSeek yeniden `Free usage limit reached` döndürdü: `universe-location-312bb5bb9c0e78` kaydının ilk parçasında. Ortak kota kilidi etkin; sonraki tüm yeni istekler engellenir.
- Limit yenilenince OpenCode açık olduğu doğrulanarak `node apps/studio/translation-durable.cjs run --batch universe --short-first --max-chunks 2 --max-records 25 --max-requests 30 --resume` ile sürdürülür; başka bir model seçilmez.
- Repo durumundaki diğer dosyalara dokunulmadı; Git commit/push ve web deploy yapılmadı. Tüm İngilizce çeviriler yalnız aday dosyalarında duruyor.

## 19 Kasım — üçüncü kota dönemi

- Kullanıcının devam onayıyla OpenCode 4096/DeepSeek V4.1 Flash Free `max` yeniden doğrulandı; `OPENCODE_PASSWORD` ortam değişkeni kullanıldı. Bir önceki ortak kota freni `--resume` ile kaldırıldı.
- Evren kuyruğunda `--short-first --max-chunks 2` ile iki parti çalıştırıldı: **30 + 10 = 40 yeni aday** üretildi. Pilotun önceki adayı hash kontrolüyle yeniden kullanıldı.
- Güncel sonuçlar: Pilot **23/23**, Kitap **3/164**, Evren **64/2278**. Evren parça önbelleği 66 dosya; iki büyük/yarım kayıt için kaydedilmiş ara parçalar saklı.
- Bir model boş yanıtı daha sonra yeniden denendi ve başarıyla tamamlandı. Kalan tek çözümlenmemiş hata, yeniden dolan kotanın vurduğu `universe-event-bb812ae6e67d95` kaydında.
- DeepSeek açıkça `Free usage limit reached` döndürdü. Ortak fren ve Evren paket freni etkin, çalışan çeviri işçisi yok.
- Yeniden denetim: Pilot 23 temiz, Kitap 3 temiz, Evren 64 temiz; kaynak sürümü ve yapı uyuşmazlığı sıfır. 17/17 test başarılı. Bu kontroller anlamsal editör onayı değildir.
- Limit kullanıcı tarafından yenilendikten sonra OpenCode ayakta olduğu doğrulanarak `node apps/studio/translation-durable.cjs run --batch universe --short-first --max-chunks 2 --max-records 35 --max-requests 40 --resume` ile devam edilebilir.
- Studio SQLite onayları değişmedi, siteye yayın veya Git push yapılmadı.

## 19 Kasım — sonraki DeepSeek kota dönemi (Evren)

- Kullanıcının devam talimatıyla OpenCode 4096 sunucusuna `OPENCODE_PASSWORD` ortam değişkeniyle bağlanıldı; `max` reasoning / `opencode/deepseek-v4.1-flash-free` değişmedi.
- Önceki kota yüzünden bekleyen `universe-event-bb812ae6e67d95` tamamlandı ve aynı kaynak hash'iyle kaydedildi.
- İlk turda 17 yeni aday üretildi; 4 ayrı kayıtta boş model yanıtı alınınca `max-failures` devreye girdi, kota bitmemişti.
- Motor `--defer-errors` seçeneğiyle geliştirildi: önceki boş yanıtlara sahip kayıtlar sonraki çalıştırmada ayrıca erteleniyor ve sürekli kuyruk başında maliyet yaratmıyor. Bu kayıtlar `errors/` altında kalıp daha sonra tekrar denenecek.
- İkinci turda 18 yeni aday daha üretildi; sonraki istekte `Free usage limit reached` geldi ve global kota freni kuruldu.
- **Bu oturumda +35 Evren adayı.** Güncel sonuçlar: pilot 23/23, kitap 3/164, Evren **99/2278**. Evren'de 101 parça önbelleği, 6 çözümlenmemiş hata / yarım kayıt mevcut. Diğer tamamlanan içeriklere dokunulmadı.
- Yeniden denetim: 99 Evren, 23 pilot, 3 kitap adayı kaynak/gövde/terim/numara otomatik kontrollerinde işaretsiz, geçersiz veya stale kayıt yok. 17/17 test başarılı. Anlamsal onay ve yayın hâlâ ayrı süreç.
- DeepSeek kota yenilenene kadar `--resume` uygulanmamalı. Kullanıcı yenilendiğini bildirdikten ve OpenCode bağlantısı doğrulandıktan sonra:
  `node apps/studio/translation-durable.cjs run --batch universe --short-first --defer-errors --max-chunks 2 --max-records 45 --max-requests 50 --max-failures 4 --resume`
- Kaynak SQLite, canlı site, Git commit/push/deploy değiştirilmedi.

## 19 Kasım — Evren çeviri devamı, 99 → 136

- OpenCode 4096 erişimi ve shell `OPENCODE_PASSWORD` doğrulandı. Kota kilidi kullanıcı devam talebinden sonra `--resume` ile kaldırıldı; DeepSeek V4.1 Flash Free, reasoning `max` değişmedi.
- Kısa/önceki hataları erteleyen evren kuyruğu bir parti olarak çalıştı: `--short-first --defer-errors --max-chunks 2 --max-records 45 --max-requests 50 --max-failures 4 --resume`.
- **37 yeni çeviri adayı**, toplam Evren **136/2278**. Mevcut pilot 23/23 ve kitap 3/164 değişmedi.
- 41 model isteği; üç istekte boş veya geçersiz JSON; 41. istekte `Free usage limit reached` hatası. Global kota freni tekrar etkin, hiçbir çeviri işçisi çalışmıyor.
- Evren'de 138 kalıcı parça, 9 çözümlenmemiş hata/yarım kayıt. Pilot 23, kitap 3, Evren 136 adayın kaynak ve otomatik QA taramasında **0 invalid / 0 stale / 0 flag**; 17/17 test başarılı. Bu sayılar editoryal/anlamsal onay anlamına gelmez.
- Limit yenilince, OpenCode erişimi doğrulandıktan sonra aynı parametrelerle `--resume` ile devam edilebilir.
- SQLite Studio onayları veya canlı site değiştirilmedi; Git commit/push/deploy yapılmadı.

## 19 Kasım — Kullanıcı isteğiyle mola / güvenli duruş

- **MOLA:** Kullanıcı uygun noktada durmamızı istedi. Kontrol edildi: çalışan `translation-durable.cjs run` veya çeviri amaçlı `codex exec` süreci yok. Yeni model çağrısı başlatılmadı.
- Pilot **23/23** aday, Kitap **3/164** aday, Evren **246/2278** aday diskte korunuyor. Büyük `Ömer` kaydı 24/24 parça ile tamamlandı; uzun kayıttaki telsiz/radyo düzeltmesi uygulandı.
- Codex GPT-6.2 Sol / `medium` kısa kayıtlar için başarılı üretim yaptı ama `high` ile 12 kayıtlık anlam denetiminde yedi editoryal sorun bulundu. Bu yedi düzeltme kaynaklara bakılarak uygulandı. Geniş `medium` üretimi, kapsamlı anlam kalite stratejisi belirlenene kadar durduruldu.
- Son QA sıkılaştırmasında özel ad `Düğümlü Kitap` sözlüğe eklendi. **Bekleyen düzeltme:** Evren'deki 5 aday ve Kitap'taki 1 adayda `Düğümlü Kitap` yanlışlıkla `Knotted Book` olarak İngilizceleştirilmiş; işaretli adaylar bu nedenle henüz temiz sayılmamalı. Kaynak-EN karşılaştırması `translation-work-20261119/inspect-proper-title.cjs` çıktısı ile hazır. Bu **6 dosyaya düzeltme henüz UYGULANMADI**; sonraki oturumda kontrollü biçimde uygulanmalı. Bir diğer özel ad `İbni Necemin` önceki adayda görüldü; sözlük kimliği doğrulanarak elle kontrol edilebilir.
- Son durum: Pilot 23 temiz; Kitap 3 adaydan 1 işaretli; Evren 246 adaydan 5 işaretli. Sıfır `invalid` ve `stale`; testler 18/18. Ortak DeepSeek kota freni etkin; kullanıcı limitin yenilendiğini söylediğinde `--resume` kullanılabilir.
- Git commit/push, Studio SQLite'a onay ve canlı web deploy yapılmadı; diğer oturumların çalışma dosyalarına dokunulmadı.
- MOLA SONRASI SIRA: (1) Altı `Düğümlü Kitap` adayını özgün metindeki özel ada göre düzelt ve `audit` ile doğrula; (2) `medium` ile üretilen adaylar için örneklem dışı editoryal kalite stratejisini belirle; (3) DeepSeek ya da Codex ile kontrollü partilerde devam et; (4) yalnız kullanıcı ayrı onay verdiğinde yayın/onay akışı.

## 19 Kasım — Açılış kararı ve çeviri stratejisi değişikliği

- Kullanıcı tüm TR→EN gövde çevirilerinin yayından önce tamamlanması koşulunu kaldırdı. İstenen yalnız İngilizce içindekiler başlıklarıdır. Önceden onaylı olmayan 164 bölüm gövdesi eksik olarak kalır; bu dürüst eksik durumdur.
- 164 bölümün indeks başlığı GPT-6.2 Sol / medium ile dört partide çevrildi; kaynak ID/Türkçe başlık/source-hash kontrolüyle `publication_toc_titles` yan tablosuna kaydedildi. Yeni TR/EN outline başlıklarının eksikleri tamamlandı. 279/279 bölümün İngilizce içindekiler başlığı hazır, 115 tam EN anlatı kalır.
- Yeni yayın `pub-928879f6e7942b060e61597a`, 279 anlatı, 2718 Evren varlığı, 5519 ilişki, 5 görsel. Live web ve atomik içerik deploy başarılı. Şifre ekranı kaldırıldı, SEO ve arama motoru indekslemesi kapalı bırakıldı.
- Önceki çeviri adayları (`pilot=23`, `book=3`, `universe=246`) **onaylı canlı EN metni değildir**. Adaylar ve düzeltme raporları `.local-data/studio/translation-work-20261119/` altında duruyor; kapsamlı kaynak sadakati incelemesi yapılmadan otomatik onaylanmayacak.
- Çeviri motoru kota nedeniyle duruyor; açık işçi yok. Artık yeni yayın için önkoşul değil. Site sahibi Türkçe tarafı incelerken yalnız seçilen kayıtlarda yeniden çalışacak.
- Sonraki oturumda önce canlı Türkçe gözden geçirme geri bildirimlerini toplamak, ardından ilgili kayıtların revizyonunu ve seçilmiş çeviri adaylarını incelemek; SEO hazırlığı ve indekslemeyi en sona bırakmak amaçlanıyor.
- Yayın/geri dönüş ayrıntıları: `docs/BIRDESENGOR_PUBLIC_LAUNCH_20261119.md`. Canlı içerik geri dönüş yedeği `channels/birdesengor/.local-data/studio/backups/before-reviewed-full-publication-2026-11-19T02-02-27-456Z/`.
