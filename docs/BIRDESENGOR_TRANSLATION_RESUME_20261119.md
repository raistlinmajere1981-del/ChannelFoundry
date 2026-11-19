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

## 19 Kasım — Site açılışından sonra çeviri ve SEO denetimi (Codex high)

- Remote Desktop Commander `ghost` bağlantısı doğrulandı; çalışma kökü `/home/raistlin/ChannelFoundry`. Codex CLI `0.170.0` ve `gpt-6.2-sol` kullanılabilir. OpenCode 4096 kapalı; DeepSeek global kota kilidi korunuyor, `--resume` çalıştırılmadı.
- İlk güncel kontrol: pilot **23/23**, kitap **3/164**, Evren **246/2278** aday. Kaynak SQLite'a, yayına veya onaylara otomatik yazma yapılmadı.
- Codex Sol / **high** ile **6 yeni Evren kaydı** çevrildi; ikinci bağımsız high anlam denetimi 16 metin alanında **2 anlam düzeltmesi** buldu ve kaynak karşılaştırmasıyla düzeltildi. Evren **252/2278** aday; `audit`: clean 252, flagged/invalid/stale 0.
- Codex Sol / **high** ile `narrative-section-video-v7HCeNRDwU4` kitabı çevrildi. İkinci bağımsız high denetiminde 11 metin alanında **3 anlam düzeltmesi** uygulandı (tuzak ifadesinin yorumlanması, nedensel bağ, sorunun muhatabı). Kitap **4/164** aday; `audit`: clean 4, flagged/invalid/stale 0. Pilot audit 23 temiz.
- Türkçe `1-1,5` ile İngilizce `1–1.5` değerlerinin yanlış `NUMBERS_CHANGED` vermemesi için `apps/studio/translation-durable.cjs` sayı normalize edicisi ve regresyon testi güncellendi: **9/9 test PASS**. Düzeltilmiş kitap adayında tekrar QA sıfır işaret.
- Codex high aday üretim yardımcıları (yalnız Git-ignore çalışma dizininde) `codex-batch-high.cjs` ve `codex-book-high.cjs`. Kaynak/EN hash sabitleme, eski adayları atlama, JSON-schema üretim, yalnız sonuç dosyasına aktarım içerir. `TRANSLATION_RUN_ID` yeni her partide farklı verilirse eski prompt/cevap dosyaları korunur; aynı prefixin üzerine yazma engellendi. Ayrı high anlam denetimi ve manuel düzeltme hâlâ gereklidir.
- 19 Kasım'daki Hakan birleştirmesinde kaldırılan eski `universe-character-3e78846d1ca1c3` kimliği, sabit geçmiş manifestte bulunuyor; üretim için geçerli onaylı kaynak olmadığı için atlandı. Yeni toplu planlamada geçersiz kimliklerin elenmesi gerekir.
- Son canlı içerik paketi `pub-17650d683f675d03403873c0`. Canlı veriden SEO envanteri: **495** onay bekleyen giriş (279 TR + 115 EN kitap, 50 TR + 50 EN video, 1 TR çizim), **0** onaylı. Site **HTTP 200**, `X-Robots-Tag: noindex, nofollow`, `robots.txt Disallow: /`, sitemap **404**; indeksleme kapalı. `verify-site-seo`, `seo-batch` 3 testi ve web bilingual SEO testi PASS.
- Bir sonraki üretimden önce özel adlar, konuşan kişi, birinci/üçüncü şahıs, belirsizlik, nedensellik ve sayı karşılaştırması iki model turuyla kontrol edilmeli. **Adayların hiçbirine Studio editoryal onayı verilmedi; canlı publication, FTPS, Git commit/push/deploy yapılmadı.** Diğer oturumdan kalan `channels/birdesengor/web/src/effects/birdesengor-effects.v2.json` değişikliği aynen korundu.

### Codex high sonraki parti kullanım notu

```bash
cd ~/ChannelFoundry
export TRANSLATION_RUN_ID=next-unique-batch-id
node channels/birdesengor/.local-data/studio/translation-work-20261119/codex-book-high.cjs prepare-new 1
d=channels/birdesengor/.local-data/studio/translation-work-20261119
codex exec -m gpt-6.2-sol -c 'model_reasoning_effort="high"' -s read-only --ephemeral \
  --output-schema "$d/codex-book-high-new-$TRANSLATION_RUN_ID-schema.json" \
  -o "$d/codex-book-high-new-$TRANSLATION_RUN_ID-response.txt" - \
  < "$d/codex-book-high-new-$TRANSLATION_RUN_ID-prompt.txt" \
  > "$d/codex-book-high-new-$TRANSLATION_RUN_ID.log" 2>&1
node "$d/codex-book-high.cjs" import-new
node apps/studio/translation-durable.cjs audit --batch book
```

Yukarıdaki komut yalnız aday üretir; bağımsız kaynak anlam denetimi ve son editoryal onay yerine geçmez. Aynı `TRANSLATION_RUN_ID` değişkeni `prepare` ve `import` aşamalarında korunmalıdır.

## 19 Kasım — Codex bölüm-oturumu tekrar kullanımı + paralel high kalite turları

- Kullanıcının kararı: SEO / arama motoru açılışı en sona bırakıldı. Bu turda yalnız çeviri adayları, kaynak sadakati kontrolleri ve güvenli yardımcılar geliştirildi.
- Önceki kitap durumu **4/164** idi. Codex `gpt-6.2-sol`, `high` ile **33 yeni kitap bölümünün** EN adayı üretildi: **37/164** aday, **127 bölüm** ana kitap kuyruğunda bekliyor.
- Yeni motor: Git-ignore dizinindeki `translation-work-20261119/codex-parallel-book.cjs`. **33/33** planlanmış iş tamamlandı; toplam **58** kaynak metni alan grubu, farklı bölümlerde **2–4 eşzamanlı Codex hattı**. Aynı bölümün ardışık parçaları `codex exec resume <thread-id>` ile **aynı oturumu** kullandı; başka bölümler kendi oturumlarını kullandı. Kısa bölümler tek istekte, uzunlar art arda parçalarda. Sonraki parti için nominal kaynak alan grubu bütçesi 7.500 karakter. Codex geçmişi, prompt/cevap, chunk, kaynak hash, audit ve işlem durumu bölüm başına ayrı tutuluyor.
- Her 33 bölüm için, üretim oturumundan **ayrı** `high` Codex anlam denetimi (TR–EN alan alan) yapıldı. Bu ikinci model denetiminden gelen toplam **192 alan düzeltmesi** yapıldı. Altı bölümde ayrıca kaynakla karşılaştırılarak **elle sayı biçimi düzeltmesi** dosyaları uygulandı. Bunlar alan bazlı AI/editoryal kalite kontrolleridir, insan tarafından bütün anlatının editoryal onayı **değildir**.
- Sıkı QA: Türkçe ondalık virgül, `saat 9.35` → EN `9:35` yalnız saat bağlamında, `İbn Karuf` → `İbni Kâruf`, `İbn Necem` → `İbni Necemin` canonical alias kontrolleri; tekrarlanan yer/kişi adlarının Türkçe kalıntı sanılmaması. `Kapsız Kitap`, `Roses`, `Muhsin Abi`, `Eyşan` özel ad korumasına eklendi. Sayı farkı tespiti gevşetilmedi; ör. 108/137/140, 3–4 yaş, 4. hücre/7 kişi, 5 gün, 04:00 gibi somut uyumlar kaynakla kontrol edildi.
- Geçmiş dört Evren adayında `Coverless Book` → kanonik `Kapsız Kitap`, Ömer uzun alanında saat biçimi düzeltildi; bu dört adayın asıl sürümleri `editorial-backups/` altında. Son kitap bölümündeki üç `Kapsız Kitap` alanı da orijinal yedeğiyle düzeltildi.
- Final otomatik denetim: `pilot` **23 temiz**, `book` **37 temiz**, `universe` **252 temiz**. Üç grupta toplam **0 flagged / 0 invalid / 0 stale**. `node --test apps/studio/translation-durable.test.cjs` **12/12 PASS**. Pilot adayları kitap ve Evren adaylarıyla örtüşebilir, toplamlar toplanmaz.
- **Yalnız aday dosyaları güncellendi.** Studio SQLite onayları, canlı publication, web/SEO/noindex/robots, FTP, Git commit/push/deploy değişmedi. Diğer oturumdan önce var olan `channels/birdesengor/web/src/effects/birdesengor-effects.v2.json` çalışma dosyası korunuyor. Çalışan çeviri Codex işçisi bırakılmadı; DeepSeek ortak kota kilidi ve kapalı OpenCode sunucusu olduğu gibi duruyor.
- Tam `translation-work-20261119` klasörü (adaylar, mantık, audit, çıktılar) yerel bir **4,1 MB, tar bütünlük kontrolünden geçmiş** arşive alındı: `channels/birdesengor/.local-data/studio/backups/translation-candidates-20261119-book37-universe252.tar.gz`.

### Bir sonraki Codex high turu

```sh
cd ~/ChannelFoundry
node channels/birdesengor/.local-data/studio/translation-work-20261119/codex-parallel-book.cjs plan 10 9500
node channels/birdesengor/.local-data/studio/translation-work-20261119/codex-parallel-book.cjs run 4
node channels/birdesengor/.local-data/studio/translation-work-20261119/codex-parallel-book.cjs status
node apps/studio/translation-durable.cjs audit --batch book
```

- Bu sırada önceki iş planları atlanır, tamamlanmış dosyaların üzerine yazılmaz. Kısa kitap kuyruğu azalınca `plan` için üst karakter sınırı kontrollü olarak 12.000–15.000'e genişletilebilir; daha uzun anlatılarda tek parçada aşırı çıktı üretmeden bağımsız denetim kapasitesi gözden geçirilmelidir. Aktif başka işçi varken yeni `run` başlatılmaz.
- Açık kalite kapısı: AI anlam denetimi, yapısal QA ve özel ad kontrolünden geçmesi **yayın/EN approved** anlamına gelmez. Studio'ya aktarım, örneklem ve editoryal onay, kaynak dependency yeniden doğrulaması ve daha sonra yayın ayrı kararlardır. SEO sona bırakılmıştır.

## 19 Kasım 2026 — Codex kota sınırında güvenli duraklama

- Kullanıcı isteğiyle yeni çeviri durduruldu. Codex CLI kullanım sınırı; hata metni yeniden deneme için **22:13 (yerel saat)** gösterdi. Süre dolması erişimin kesin açılacağı anlamına gelmez; devamdan önce kullanım durumu kontrol edilmeli.
- Bu oturumda kitap çeviri adayları **37/164 → 66/164**, **29 yeni aday**. Kitap **66 temiz / 98 bekleyen**, Evren **252 temiz / 2026 bekleyen**, pilot **23 temiz** (pilot diğer gruplarla örtüşür). Otomatik denetim: üç grupta **flagged 0 / invalid 0 / stale 0**. Üretilenler hâlâ onaysız yerel aday; yayına veya Studio onaylı EN varyantlarına aktarılmadı.
- 16 bölümlük ilk parti **16/16** tamamlandı. Sonraki 14 bölümlük parti **13/14** tamamlandı. Açık kalan **narrative-section-video-UZPUAWJ8HiU** (Rüya Kapılarının Tarifini İsterken) için kaynak sürümüne bağlı chunk-0.json korunuyor; ikinci parça eksik, bağımsız anlam denetimi başlamadı. İlk parça yeniden üretilmemeli.
- Son partide kaynak sayılarını, sabit bağlantıları ve özel adları kontrol ettik; 5. Murat/Murat V, Kral Arohan'ın sabit link çevresindeki yer değiştirmesi, 16. boğumun iki kez belirtilmesi, 42. davetin iki kez belirtilmesi, 50–60 bin TL gibi ayrıntılar düzeltildi. Karanlık Devrin Kitabı özgün özel ad olarak korunuyor. 15 regresyon testi geçti.
- translation-work-20261119/codex-quota-paused.json dosyası yeni Codex çağrılarını engelleyen kota işaretçisidir. Motorun run-local komutu model çağrısı olmadan önceden tamamlanan parça ve audit dosyalarını işler. Kota yenilendiğinde işaretçi ancak limit kontrolünden sonra kaldırılmalı; önce tek yarım bölüm tamamlanmalı.
- Diğer oturuma ait web efekt değişikliği aynen bırakıldı. SEO, Git commit/push, dağıtım ve Studio yayın/onayları yapılmadı. Çalışan Codex çeviri veya denetim süreci bırakılmadı.

## 19 Kasım — Antigravity Gemini → Claude Sonnet ilk Evren paketi

- Codex kota sınırındayken OpenCode DeepSeek modeli için eski `quota-paused.json` kilidi korunuyor; OpenCode serve HTTP 200 yanıtlıyor, fakat yeni DeepSeek çağrısı bu turda denenmedi.
- Antigravity `pack-001` kaynak ve cevap dosyaları incelendi: **20 Evren kaydı, gerçek 59 çeviri alanı** (Sonnet kullanıcıya özetinde 55 demiş; gerçek dosyalarda 59), 4 denetim önerisi.
- 4 denetim önerisinden `Haber` → `News` kabul edildi; `Moroniler` için `Moronites` yerine kimliği koruyan `Moroni people` kullanıldı. `diyet` için Sonnet'in `diet` önerisi reddedildi: **narrative-section-video-mwbf__IRrho** içinde karakter para yerine `vakit veya diyet` ister, Ömer `Diyet ne?` der, konuk `bir hayvanın kanı olabilir` diye yanıtlar. Bu bağlam beslenme rejimi değildir; önceki `blood money` parasal ve fazla spesifiktir. İki alanda `a non-monetary forfeit (diyet)` tercih edildi; kaynak terim korunuyor.
- Bağımsız orijinal Sonnet `audit.json` ve Gemini `response.json` değiştirilmedi; 3 düzeltme kararı `pack-001/editorial-overrides.json` içinde kaynak/audit önerisine kilitli, denetlenebilir biçimde tutuluyor. Yeni aktarım yardımcısı `translation-work-20261119/antigravity-entity.cjs` `prepare`, `validate`, `import`, `status` komutlarını içeriyor; SQLite değiştirmiyor.
- `pack-001` **20/20** temiz olarak **yalnız universe/results aday havuzuna** aktarıldı. Evren **272/2278 aday**, kalan **2006**, QA **272 clean / flagged 0 / invalid 0 / stale 0**. Kitap 66 temiz, pilot 23 temiz, yayın ve EN editoryal onaylar değişmedi.
- **pack-002** Antigravity için hazır: `antigravity-entity/pack-002/request.json`, **40 kayıt, 120 alan, 8257 kaynak karakteri**, dengeli olarak 8 karakter + 8 olay + 8 mekân + 8 nesne + 8 anlatı. Gemini ile yalnız `pack-002/response.json`, farklı Sonnet oturumunda yalnız `pack-002/audit.json` üretilmeli. İki model aynı kayıtlara başka projeden müdahale etmemeli. Önceki talimatlar birebir geçerli; `pack-001` klasör adını `pack-002` ile değiştir.
- **Sonraki adım**: Kullanıcı iki Antigravity çıktısının tamamlandığını bildirdikten sonra `node .../antigravity-entity.cjs validate pack-002`; Sonnet denetim kararlarını TR kaynakla incele; gerekirse `editorial-overrides.json` (audit verisine doğrudan yazma); sonra `import pack-002`, `translation-durable.cjs audit --batch universe`. Hiçbir aday canlı yayın/Studio approved değildir.

## 19 Kasım 2026 akşam — Antigravity pack-002 + DeepSeek kota döngüsü

- `pack-002` Antigravity Gemini/Sonnet tamamlandı: **40 kayıt, 120 alan, 3 Sonnet düzeltmesi**. Emanetler→entrusted items, hatırlatır→brings up, kuzey İran’daki Babil komutanı coğrafi ilişkisi kabul edildi.
- Deterministik QA, ayrıca `universe-event-908b5f9abcb89f` içinde iki farklı alanda `telsiz` kelimesinin `radio` olarak çevrildiğini buldu. `pack-002/qa-overrides.json` içinde kaynak-kilitli `Two-Way Radio` ve `transceiver` düzeltmeleri kaydedildi. Sonnet `audit.json` ve Gemini `response.json` bozulmadı; aktarım yardımcısı bu ayrı kalite kararı dosyasını uyguluyor.
- `pack-002` **40/40** kayıt yalnız yerel `universe/results` aday havuzuna aktarıldı. Başlangıç Evren 272 → 312 aday; QA 0 flagged/invalid/stale.
- OpenCode HTTP 200, çevrim içi `opencode/deepseek-v4.1-flash-free` / reasoning max hattı kota yenilenince `--resume` ile tekrar açıldı. Kısa ilk denemede 1 yeni + 1 eski pilotla örtüşen yeniden kullanım, 1 geçici boş model yanıtı; sonra 18/18 başarılı, sonraki 40'lık partide 20/40 başarılı. **Bu akşam DeepSeek toplam 39 yeni + 1 geçerli eski tekrar kullanım = +40 aday**.
- DeepSeek sınırı 20:43 civarı yeniden doldu, en son bekleyen `universe-character-ec03adc13f3df7`. `quota-paused.json` ile `universe/paused-quota.json` koruyucuları yeniden oluştu. `universe/errors` içinde tek geçici boş yanıt hatası bulunuyor; `--defer-errors` ile atlandı, daha sonra ayrı incelemeyle yeniden denenecek. İstenirse güncel kota kontrolünden sonra `node apps/studio/translation-durable.cjs run --batch universe --resume --short-first --defer-errors --max-records 25 --max-requests 30 --max-failures 3 --max-chunks 1` komutuyla devam. Kota yoksa `--resume` kullanılmamalı.
- Mevcut sonuç: **Evren 352/2278 aday, 1926 kalan; kitap 66/164 aday, 98 kalan; pilot 23/23**. Üçünün kaynak ve yapısal kontrolleri **0 flagged / 0 invalid / 0 stale**. 39 yeni DeepSeek adayı 108 İngilizce metin alanı için `emanet→relics`, `telsiz→radio`, `hatırlat→recalls`, `Moroni→Moronites` risk taraması ayrıca yapıldı, şüpheli çıkmadı. Bu tarama bağımsız anlam denetiminin yerini tutmaz.
- Stale TR kaynak kimliği `universe-character-3e78846d1ca1c3` artık DeepSeek sürecinde hata sayılmadan atlanıyor (`staleSkipped`). Sonet ile DeepSeek çevirileri editoryal insan onayı almamıştır; yerel adaylardır. Codex kotası için ayrı `codex-quota-paused.json` hâlâ aktif. Yayın, SEO, Studio onayları, Git commit/push yapılmadı.

## 19 Kasım 2026 — DeepSeek yenilenen kotayla kontrollü 4 parti

- Kullanıcı DeepSeek kotasının yenilendiğini, Codex için yaklaşık bir saat kaldığını bildirince OpenCode sunucusu `127.0.0.1:4096` HTTP 200 ve parola ortam değişkeni doğrulandı; kullanıcı onayıyla DeepSeek `--resume` çalıştırıldı. Codex kotası/işleri ayrı, dokunulmadı.
- `node apps/studio/translation-durable.cjs run --batch universe --resume --short-first --defer-errors --max-records 18 --max-requests 20 --max-failures 2 --max-chunks 1`: 4 tamamlandı, iki model boş yanıtı → güvenli duruş. `--resume` DeepSeek için yerel kota durdurma dosyalarını temizledi.
- Ardından `--short-first --defer-errors` ile 16 kayıt (1 ECONNRESET, 16 başarı), 12 kayıt (2 boş yanıt, 12 başarı), 12 kayıt (12 başarı, 0 hata) tamamlandı. Bu turda **4+16+12+12=44** yeni aday. **Evren 352→396 / 2278**, kalan 1882, bağımsız denetim bekliyor. 6 ertelenmiş geçici boş yanıt / bağlantı hatası var; `--defer-errors` ile atlandı, veri kaybı yok. Bir stale eski TR kaynak kimliği `universe-character-3e78846d1ca1c3` atlandı.
- 44 yeni DeepSeek kaydı / 126 metin alanı için bilinen riskli terimler (emanet→relic, telsiz→radio, hatırlat→recall, diyet→diet) tarandı; terim flag 0. Ayrıca 14 kaynak/İngilizce kayıt örnekleminde anlam ilişkileri elle incelendi, 4 ifade sorunu düzeltildi: `universe-character-2a65540fba698b` özne Enşil yerine topluluk, `universe-object-2a5f527e11571e` mahzen koruyucusunun Henry sanılmaması, `universe-location-058f574349e8a0` Ömer+Tamruş yanlış tek kişinin ayrılması, `universe-object-41d45a5cf56662` Arohan'ın önerdiği eylemi Ömer'in gerçekleştireceğinin açıklanması.
- Dört kaynak-kilitli editoryal düzeltme ve önceki aday kopyaları `translation-work-20261119/editorial-backups/deepseek-review-20261119-next` içinde kaydedildi. Son QA Evren **396 clean, 0 flagged, 0 invalid, 0 stale**, kitap **66 clean**, pilot **23 clean**; 15/15 mevcut regresyon testi geçti.
- DeepSeek kotası bu turda yeniden dolmadı, `paused:false`, `globalQuotaPaused:false`; son kontrollü partinin ardından aktif çeviri worker'ı bırakılmadı. Codex için `codex-quota-paused.json` dosyası ayrıca korunuyor. Yayın, Studio editoryal onayları, SEO ve Git commit/push yapılmadı.
- Devam için sunucu ve kota müsaitse `node apps/studio/translation-durable.cjs run --batch universe --short-first --defer-errors --max-records 12 --max-requests 15 --max-failures 3 --max-chunks 1` kullanılabilir. Daha sonra 6 geçici başarısız kayıt, kaynak güncellemesiyle stale olan kayıt ve DeepSeek adaylarının bağımsız kaynak sadakati denetimi ayrı incelenmeli.

## 19 Kasım 2026, 21:37–21:45 — DeepSeek Evren adayları +38

- Kullanıcı OpenCode ile devamı onayladı. Sunucu http://127.0.0.1:4096/ HTTP 200; parola yalnız ortam değişkeninden sağlandı. Başlangıç universe=396/2278, book=66/164, DeepSeek kota durdurması aktif değildi.
- DeepSeek aynı opencode/deepseek-v4.1-flash-free, reasoning max ile iki küçük partide çalıştırıldı (--short-first --defer-errors --max-records 20 --max-requests 24 --max-failures 3 --max-chunks 1). İlk tur 20 yeni aday, 1 boş yanıt; ikinci tur 18 yeni aday, 1 boş yanıt ve 20. istekte ücretsiz kullanım kotası doldu. Bu oturumda +38; Evren 434/2278, 1844 kayıt kaldı. Kaynağı eski olan universe-character-3e78846d1ca1c3 veri bozulmadan atlandı.
- Yeni DeepSeek adayları 38 kayıt / 104 metin alanı açısından hızlı terminoloji taramasına tabi tutuldu. universe-event-f6576b6d0641fa iki alanda Necemin'in yıldız emaneti yanlışlıkla Necem's Star Relic, İbni Necemin yanlışlıkla İbn Necem olmuştu. Kaynak-kilitli şekilde The Star-Shaped Object Entrusted by Necemin ve İbni Necemin entrusts Ömer with a star-shaped object olarak düzeltildi. Önceki tam aday ve editoryal gerekçeler editorial-backups/deepseek-20261119-necemin-relic altında korundu.
- Gelecek DeepSeek isteminde İbni Necemin ismi ve emanet != relic ilkesi açıkça belirtildi; apps/studio/translation-durable.cjs sözlük ve istemi güncellendi. Mevcut 15/15 regresyon testi başarılı.
- Güncel denetim: Evren 434 clean, 0 flagged, 0 invalid, 0 stale; kitap 66, pilot 23 temiz. 8 çözümlenmemiş geçici yanıt hatası --defer-errors ile geçiliyor. quota-paused.json ve universe/paused-quota.json yeniden mevcut; kota doğrulanmadan --resume ile kaldırma. Codex codex-quota-paused.json hâlâ ayrı; Codex çalıştırılmadı.
- Tüm çeviriler Studio onaylı değil, yerel aday; DeepSeek adaylarına bütün kayıtları kapsayan bağımsız anlam denetimi yapılmadı. Git commit/push, Studio DB mutasyonu, SEO, deploy veya yayın yok.

### 21:45 — Son denetimde çıkan iki eski aday düzeltmesi
- Gelecek model çevirileri için kaynak adı İbni Necemin olacak şekilde sözlük sıkılaştırılınca, son tam Evren denetiminde iki eski adayda yeni GLOSSARY uyarısı saptandı. İlk yedekten SONRA tespit edildi; ilk 434 yedeği düzeltme öncesi halin arşividir.
- universe-event-ff64fc187796c4 ve universe-character-096793ce1a67a7 için kaynak sabitlenerek toplam 7 İngilizce metin alanında İbn Necem yanlış kısaltması İbni Necemin olarak düzeltildi, ilgili Divitli Defter başlığı da korundu. Önceki JSON dosyaları ve alan bazında gerekçeler editorial-backups/deepseek-20261119-glossary-retrofix klasöründe.
- Düzeltmelerden sonra QA: Evren 434 clean / flagged 0 / invalid 0 / stale 0. DeepSeek kota durdurması etkin; aktif model worker yok. Kalan Evren 1844; kitap kalan 98.

## 19 Kasım 2026 ~21:55–22:00 — Üç paralel OpenCode oturumuyla Evren (kota sınırında güvenli duruş)

- Kullanıcı üç paralel oturum ve büyük paketleri açıkça onayladı; opencode serve HTTP 200 ve OPENCODE_PASSWORD ortam değişkeni doğrulandı. Codex sınır dosyası codex-quota-paused.json korunuyor; Codex işleri başlatılmadı.
- Yeni yerel yardımcı channels/birdesengor/.local-data/studio/translation-work-20261119/parallel-deepseek-universe.cjs plan|run|status|merge komutlarını içerir. Plan 480 güncel kaynak hash'li, bir chunk'lı Evren kaydını üç çakışmasız, kalıcı manifest arasında 160'ar böler. Önceden tamamlanan 434, eski kaynak kimliği, 8 eski geçici hata ve 40 çok chunk'lı kayıt hariç tutulur. Kaynak SQLite yalnız okunur.
- Alt kuyruklar universe-par-20261119-a, universe-par-20261119-b, universe-par-20261119-c; her biri kendi kilidi, cevap dosyası ve OpenCode oturumu olan bağımsız worker. İşçiler tek quota-paused.json işaretini kullanır, kota gelince tamamlanmış adayları koruyarak durur. Run bitince kaynak sürümü + yapısal QA ile temiz adaylar ana universe/results içine kopyalanır; Studio veritabanı ve yayın değişmez.
- İlk paralel tur: A=13, B=16, C=11, toplam 40 kaynak-sabitlenmiş aday; ekstra hata 0. A'nın son isteği OpenCode free usage limit hatası aldı; B/C işaretleyiciyi algılayıp yeni istek göndermeden durdu. PARALLEL_MERGE imported=40 existing=0 flagged=0 stale=0 invalid=0.
- Evren 434 → 474/2278, kalan 1804. Kitap 66/164, kalan 98. Pilot 23 temiz. Üç grup tam QA 0 flagged/invalid/stale; mevcut test 15/15 geçti.
- Bu 40 kısa adayın tüm 117 İngilizce alanı kaynakla tek tek gözden geçirildi. 15 kayıtta 16 alanda düzeltme yapıldı: adayı=the island vs candidate, diyet=beslenme diet değil non-monetary forfeit, Ömer'in bir isme şüphe duyması, yanlış kişi zamirleri, 54th davet başlığı ve bildirilen/gerçekleşmeyen olay, 52nd davetlinin geldiği yer, hazır bulunan malzemenin keşfedilmiş sayılması, Yedi Dağ Kapısı çoğulluğu, Golds→Gold, tarif=secret instructions (tarif yemek reçetesi değil), dışarıdan duyulmayan korunma, ritüel davet/gathering ayrımı vb.
- Kaynakla eşleştirilmiş ham sonuçlar ve her alanda editoryal gerekçe editorial-backups/deepseek-parallel-20261119-review altında; yalnız ana universe/results kopyaları düzeltildi, paralel alt kuyruğun ham çeviri çıktıları korunuyor. review-parallel-20261119.cjs tekrar çalıştırılmamalı (tek seferlik düzeltme).
- apps/studio/translation-durable.cjs çeviri istemi gelecek oturumlarda adayı/aday, numaralar, özne, diyet ve ritüel davet ayrımını açıkça koruyacak şekilde sıkılaştırıldı.
- Devam: Kullanıcı DeepSeek kotasının yenilendiğini bildirdiğinde önce node channels/birdesengor/.local-data/studio/translation-work-20261119/parallel-deepseek-universe.cjs status, sonra run. Run OpenCode sunucusunu ve şifreyi doğruladıktan sonra sadece DeepSeek kota dosyasını temizler ve aynı üç manifest ile devam eder; tamamlanmış adayları tekrar çevirmez. Tamamlanan alt kuyruk adayları kopyalandığı için ana universe durumundan izlenebilir. Yeni shard planı oluşturulmaz; mevcut 480 planın 440'ı bekliyor.
- Kota yenilenmeden run çağırma; ayrı Codex sınırını temizleme. Çeviriler yerel onaysız adaydır, tüm DeepSeek Evren arşivinin bağımsız ikinci-model kaynak sadakati denetimi henüz yapılmadı. Studio approved, Git commit/push, SEO ve yayın yok.

## 19 Kasım 2026, ~22:11–22:14 — OpenCode yeniden açıldı, üç paralel kuyruk +39

- Kullanıcı "sunucu yenilendi" dedi. OpenCode HTTP 200 ve OPENCODE_PASSWORD ortam değişkeni doğrulandı. Başlangıç Evren 474/2278, kitap 66/164, Codex ayrı kota koruması etkin.
- Kalıcı paralel kaynak manifestleri kullanılmaya devam edildi: universe-par-20261119-a/b/c, her birinde başlangıçta 160 kayıt. Yeni manifest oluşturulmadı, tamamlanmış kayıtlar yeniden çevrilmedi.
- İlk koşuda eski kotadan kalan A'nın per-shard paused-quota.json dosyası unutulduğundan A tek başına reddedildi; B ve C başarıyla başladı. A'nın eski pause dosyası ortak kota henüz açıkkken kontrollü temizlenerek ayrı işçi olarak başlatıldı. Paralel yöneticideki bu hata kalıcı düzeltildi: artık sunucu doğrulandıktan ve işçi olmadığı teyit edildikten sonra tüm üç per-shard paused-quota.json dosyası tek seferde temizleniyor; çocuk worker'lar çalışırken koruma dosyası asla temizlenmiyor.
- İkinci paralel turun net çıktısı A +12, B +13 (1 geçici boş yanıt), C +14 = **39 yeni Evren adayı**. Son isteklerden birinde DeepSeek kota sınırı algılandı; ortak quota-paused.json ile tüm oturumlar güvenli durdu. İlk otomatik merge B/C ve A'nın 11 kaydını birleştirdi; A'nın son kaydı tamamlanınca tekrar merge yapıldı: toplam paralel shard sonucu 79, önceki tur 40, net +39.
- Ana Evren aday havuzu 474 → **513/2278**, kalan **1765**. Kitap 66/164 (kalan 98), pilot 23 temiz.
- **39 yeni kaydın 108 İngilizce metin alanının tamamı Türkçe kaynakla karşılaştırıldı.** 9 kayıtta 13 alan düzeltildi: tas=bowl (stone değil; üç alan), anmak=mention (summon/invoke değil; iki alan), 7th ordinal, belirsiz özne/aidiyet, koşullu geçiş ifadeleri, güneş ışığında kaybolmak=disappear, ritüel tarif=ritual instructions (recipe değil; iki alan), en küçük yardımcı=özne (zincirin sıfatı değil). Önceki aday kopyaları ve kaynak-kilitli kararlar editorial-backups/deepseek-parallel-second-round-20261119 altında; paralel shard ham çıktıları değişmeden korundu.
- apps/studio/translation-durable.cjs gelecek model çevirilerinde tas/taş, anmak/invoke, tarif/recipe, yardımcı/eylem faili ayrımını özellikle belirtecek şekilde güncellendi. 15/15 regresyon testi geçerli.
- Son kaynak/yapı denetimi Evren **513 clean / flagged 0 / invalid 0 / stale 0**, kitap 66 clean, pilot 23 clean. DeepSeek kotası yeniden dolu; ortak quota-paused.json mevcut. Aktif çeviri işi kalmadı. Bu kayıtlar yerel EN adaylarıdır; Studio approved, yayın, SEO, git commit/push yok.
- Devam edilecekse üç kalıcı shard durumunu parallel-deepseek-universe.cjs status ile denetle, kullanıcı DeepSeek kotasının açıldığını bildirdikten sonra aynı scriptin run komutunu çağır. Mevcut 480 planın 79'u tamamlandı, 401 kayıt bu üç kuyrukta bekliyor. Orijinal 8 geçici universe hatası ve 1 yeni B-shard model yanıt hatası ayrı sırada. Daha geniş bağımsız kaynak-anlam denetimi gelecekte ayrıca yapılmalı.

## 19 Kasım 2026 23:14 — ChatGPT mesaj zaman aşımı sonrası canlı kontrol

- Kullanıcı arayüzünde Message delivery timed out görüldü. Uzak bilgisayar ghost çevrimiçi; çeviri dosyalarında kayıp yok.
- opencode serve çalışıyor (localhost:4096 HTTP 200) ama DeepSeek quota-paused.json 22:29:48 Free usage limit reached nedeniyle durdurma durumunda; sunucu çalışması kota yenilendiğini kanıtlamıyor. Evren **551/2278 clean**, 1727 kayıt bekliyor.
- Codex gpt-6.1-terra/high ekonomi hattının 24 kayıtlık son paketinde 23 kayıt tamamlanmış, fTeugPG5Qns kaydı teknik NUMBERS_CHANGED ile durdurulmuştu. 38 kaynak alanı ve EN çevirisi kaydedilmişti.
- Kalan bölümde tek uyuşmazlık Türkçe 03.12–03.59 ve İngilizce 03:12–03:59 saat biçimleri (dört alan). Sayısal anlam uyuşmazlığı yok. translation-durable.cjs doğrulayıcısına zaman bağlamlı sıfır dolgulu HH.MM aralıkları için dar normalizasyon eklendi; ondalık ölçümlerdeki sayısal farkları yakalama korunuyor. translation-durable.test.cjs olumlu/olumsuz durumlar için yeni test içeriyor; **16/16 PASS**. Kaynak/revizyon hash sabitlenip mevcut translated.json EN aday sonuçlarına aktarıldı; yeni Codex isteği yapılmadı.
- Son durum: **Kitap 100/164 clean, 64 kaldı**, **Evren 551/2278 clean, 1727 kaldı**, her ikisinde flagged/invalid/stale=0. Codex economy Terra planı 33/33 tamam; bağımsız editoryal anlam denetimi bekleyen yeni adaylar Studio onaylı veya canlıda yayımlanmış değildir.
- Codex kullanımına ilişkin son mevcut kayıt 23:02: haftalık **%77**, 5 saatlik **%22**; haftalık limit 24 Kasım 2026 00:02 UTC (03:02 Türkiye saati) sıfırlanıyor. Yeni Codex kullanımı olmadığından bunlar son gözlenen değerlerdir. Codex kota/softcap durdurma işareti yok; economy hattında haftalık %95 yumuşak koruma var.
- Çeviri worker'ları tamamen durmuş, OpenCode serve ise açık. Git commit/push/deploy, Studio DB yazımı, yayın veya editoryal onay yapılmadı. Codex 64 kitap bölümünden devam edilebilir; DeepSeek kotası gerçekten yenilene kadar yeniden başlatılmamalı.

## 20 Kasım 2026 00:09 — Kitap İngilizce adayları tamamlandı (164/164)

- Kullanıcı Codex haftalık kotasında yüzde 23 kalırken devamı onayladı. Başlangıç book 100/164, universe 551/2278. DeepSeek kota durdurması korundu.
- GPT-6.1 Terra high tek-istek tüm bölüm çevirisiyle üç paralel oturumda 59 bölüm üretildi. codex-economy-terra planı 92/92 finished (eski 33 + yeni 59). Kaynak/revizyon kilidi, alan eşleme, yapı ve sayı/özel ad kontrolü korundu, haftalık yüzde 95 kullanım yumuşak durdurma sınırı etkin.
- Kalan beş istisna: üç temiz DeepSeek pilot çevirisi source/revision/QA doğrulaması sonrası book/results içine kopyalandı. Eski Codex oturumunda yarım kalan UZPUAWJ8HiU tek Terra çağrısıyla yeniden çevrildi. hwvh1DqbKig için TR approved revision 2 güncel source/tr hash manifestte tek kayıt olarak yedekli güncellendi, ardından tek Terra çağrısıyla çevrildi.
- Birkaç küçük kaynak bağlı onarım (yeni Codex çağrısı yok): Türkçe iki -> English two, bağlantılı Poyraz referansından sonra İngilizce cümle, Mezna özel adı, 21.30 ve 03.17 gibi noktalı Türkçe saatlerin doğru İngilizce HH:MM biçimi. Editoryal kararlar ilgili ekonomi iş klasörlerinde ve editorial-backups/book-final-clock-20261120 altında.
- Türkçe saat aralığı ve apostroflu 21.30'da için QA normalizasyonu eklendi, gerçek ondalık farkları hâlâ reddediyor. 17/17 yazılım testi geçti.
- Nihai durum: book 164 clean / flagged 0 / invalid 0 / stale 0 / remaining 0. Universe 551 clean, remaining 1727; pilot 23 clean. Book 164 benzersiz ID. Model dağılımı 94 Codex Terra, 64 Codex Sol, 6 DeepSeek. En az 95 book adayında independentAudit.state=pending, diğerlerinde alan açıkça sınıflandırılmamış olabilir. Bağımsız kaynak-anlam editoryal denetimi tüm adaylar için tamamlanmış değildir; Studio onayı/yayın değildir.
- 5169 metin alanının sınırlı terim risk taramasında dört vefk terimi yanında talisman açıklaması da vardı, ancak özgün vefk sözcüğü korunuyordu. Bu kontrol tam anlam denetimi değildir.
- Son Codex ölçümü: haftalık yüzde 83 kullanılmış, yüzde 17 kaldı; 5 saatlik pencere yüzde 65 kullanılmış. Haftalık reset 2026-11-24 00:02:41 UTC (Türkiye 03:02). Aktif çeviri işçisi yok. OpenCode sunucusu açık olsa da DeepSeek ortak quota-paused.json etkin.
- Studio SQLite, Git commit/push, SEO ve canlı yayın değiştirilmedi; diğer oturumların WIP dosyalarına dokunulmadı. Sonraki aşama bağımsız EN kaynak sadakati denetimi, editoryal onay ve sonra kontrollü yayın. Universe 1727 kayıt için DeepSeek yenilenmesini bekleme.

## 20 Kasım 2026, 00:52 — İngilizce içeriklerin toplu onayı ve canlı yayını

- Kullanıcı yeni adayları yeniden okuyamayacağını belirtti; bireysel onay adımı olmadan devam edilmesini istedi. Otomatik kaynak sürümü, veri yapısı, isim ve sayı QA kapılarıyla delegasyon altında toplu EN onayı yapıldı. Tek tek insan veya bütün kayıtları kapsayan bağımsız ikinci-model anlam denetimi yapılmış gibi gösterilmemeli.
- Yayın öncesi backups/before-delegated-bilingual-release-20261120-0040/ altında tutarlı SQLite, eski yerel yayın ve eski canlı yayın yedeği alındı.
- translation-work-20261119/delegated-approve.cjs ile 164 section + 551 entity = 715 EN aday, tek transaction ile Studio SQLite dil varyantlarına approved olarak aktarıldı. 714 yeni varyant, 1 eski stale approved güncellendi. manual=0 ve model/provenance alanları korunarak, insan tarafından tek tek incelenmiş gibi kaydedilmedi. 715/715 kaynak ve QA geçerli.
- Studio son durum: section/en approved 279, entity/en approved 981; yalnız 958 entity canlı paket kapsamına giriyor.
- build-translation-only-release.cjs ile yalnız 715 İngilizce locale güncelleyen, önceki Türkçe, 9 görsel, 5519 ilişki ve diğer tüm metaveriyi byte düzeyinde koruyan paket hazırlandı. PHP yayın testleri 2/2. Tam genel yayın yerine kontrollü içerik yaması kullanıldı, paralel sahne ve görsel WIP alınmadı.
- Kayıtlı Studio güvenli Electron kimlik saklama sistemi ile yönetici oturumu doğrulandı. secure-publish.cjs önce canlı pub-17650d683f675d03403873c0 fingerprint kilidini kontrol edip atomik yayın API çağrısı yaptı; şifre kullanıcıya veya loga yazılmadı.
- Yeni canlı publication ID: pub-b79e8b023d914bfd991daed7. Fingerprint b79e8b023d914bfd991daed71ba7ff587292a3716841aa29216b22c3ae04848e. Ayrı fresh HTTP GET doğrulaması: 279/279 İngilizce kitap, 958 İngilizce Evren, toplam 2717 Evren, 9 asset, 5519 ilişki. 715 TR locale değişmedi.
- Yeni canlı paket yerel public-export/content/publication.json ve public-export/publication-live-baseline.json ile eşitlendi. SQLite yayın meta alanları yeni ID ve fingerprint ile güncellendi. 9 yerel asset mevcut.
- SEO dosyaları, site uygulama kodu, git commit/push, diğer aktif WIP değiştirilmedi. DeepSeek kota koruması ve EN aday arşivleri korunuyor. Kalan Evren 1727 kayıt sonraki ufak paketlere ayrılabilir.
- Önce/sonra geri alma yedekleri backups/before-delegated-bilingual-release-20261120-0040/ ve backups/after-delegated-bilingual-release-20261120/; çeviri adaylarının tüm ham dosyaları backups/translation-candidates-20261120-book164-universe551-verified.tar.gz.
