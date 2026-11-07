# Evren Kitabı — Aşama 4.2: anlatıcı kaynak kimliği ve günlük anlatımı

8 Kasım 2026. Mevcut Aşama 1–4.1 çalışma ağacının üzerine eklenmiştir. Stash/reset/restore/clean, commit/push/deploy yapılmadı. Nested `channels/birdesengor/web` deposunda dosya değiştirilmedi veya komut çalıştırılmadı. Gerçek Studio DB açılmadı; gerçek `channel.json`, hazırlanmış #5, kaynak node'ları veya yayınlar üzerinde uygulama çalıştırılmadı. Gerçek taslaklarda approve/discard/AI generate yapılmadı; AI testleri sahte provider kullanır.

## Davranış

- Kanal Ayarları → Anlatıcı → **Evren'deki anlatıcı kimlikleri**: açıkça birden çok karakter seçilebilir veya seçim kaldırılabilir. Güncel onaylı karakterin adı, kaynak ID'si ve Eşlendi/Eşlenmedi durumu görünür. Kaybolmuş, onayı kalkmış veya türü değişmiş seçili kayıt “Çözümlenemiyor” olarak gösterilir; ID korunur ve editör kaldırabilir. Benzer isimden alternatif kayıt seçilmez.
- `narrator.sourceEntityKeys: string[]` varsayılanı `[]`. ID'ler doğrulanır, tekilleştirilir ve kararlı sıralanır. Mevcut ayarlar okunurken yeni alanı yazmak için migration yapılmaz; önceki tek yönlü anlatıcı migration'ı korunur ve eski profil kimlik eşlemesi üretmez. Kısmi anlatıcı ayarı güncellemesi diğer anlatıcı alanlarını korur; açık `[]` eşlemeyi kaldırır.
- Yeni `studio:channel-narrator-sources` IPC / `channelNarratorSources({id})`, `runtime.database()` kullanır. Hem açık kanal hem DB'nin bağlı proje kökü/ID'si doğrulanır. Başka kanal düzenlenirken açık kanalın karakter seçenekleri gösterilmez; seçim için ilgili kanal açılmalıdır. Yeni kimlik ekleme IPC'de ve doğrudan proje güncelleme yolunda doğrulanır. Kaldırma ve ilgisiz ayar güncellemeleri kayıp bir kimliği sessizce değiştirmez. Kaynak listesi salt SQL SELECT kullanır; şema veya node verisi yazmaz.
- Yeni hazırlanacak çalışmalar `narrative-records-v2` kullanır. Prepare sırasında seçilen her key'nin aynı DB'de güncel `approved` / `character` kaydı ve kullanılabilir adı olması gerekir. Kayıp, taslak/onayı kalkmış veya başka türde kayıt anlamlı hatayla reddedilir. `input.narrator.sourceEntityKeys` ile `input.narratorSourceEntities: [{sourceKey,name}]` run girdisine dondurulur, request'e taşınır ve yeni politika sürümüyle birlikte fingerprint'e girer. Sonraki kanal ayarı değişiklikleri hazırlanmış girdiyi/request'i değiştirmez.
- V1 request şekli, alanları, referans örneği ve v1 bağlantı güvenliği korunur; eski run'a yeni kimlik alanı eklenmez. Yeni davranış için eski run'ı otomatik yeniden hazırlama, silme veya değiştirme yapılmaz. V1 prompt yolu da önceki anlatıcı talimatlarını korur.
- V2 prompt, birinci şahıs eylemi için **açıkça eşlenmiş ID + eyleme ait kaynak kanıtı** ister. Görünen ad, alias, “Anlatıcı” veya “sunucu” etiketi sahiplik kanıtı değildir. Eşleme boşsa, kişi başka biriyse veya özne belirsizse üçüncü şahıs kaynaklı tarafsız anlatım kullanılır. Ömer ve Anlatıcı node'ları birleştirilmez. Neutral mod tarafsız kalır.
- Kaynak yeterliyse olay sırası, ayrı karşılaşmalar ve bilgi parçaları birkaç doğal paragrafta doyurucu günlük oluşturabilir. Sabit uzunluk/paragraf kotası yoktur; kaynak sınırlıysa kısa kalır. Tasvir, diyalog, duygu, tarih, olay veya doğrudan deneyim uydurulmaz. Çok videolu bir kayıt bütün ayrıntıların her videoda geçtiği anlamına gelmez; kanıtsız video atfı ve olay birleşmesi yasaktır.
- Sahip karaktere referans yasağı v2'de kaynak ID'sine dayanır; başka label kullanarak aşılamaz. Eşlenmemiş “Anlatıcı” adlı karakter, normal metin içi referans kurallarına tabidir. Aşama 4.1'in art arda, cümle sonuna eklenen ve tek başına duran referans **blocker** kontrolleri hem v1 hem v2 için kayıt ve doğrudan store apply yolunda sürer.
- Üçüncü şahıs eylem uyarısı frozen eşleme ve frozen kaynak adlarıyla üretilir. Örneğin eşlenen Ömer için “Ömer kapıya gitti/gidiyor” yalnız `warning` olur. Eşleme yokken veya neutral modda bu uyarı yoktur. Alıntı parçaları, doğrudan hitap, başka ID'ye ait referanslar ve aynı adı taşıyan başka karakterin oluşturduğu belirsizlik dışlanır. Uyarılar metni değiştirmez ve onayı engellemez.

## Bu aşamada değiştirilen dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `apps/studio/narrator-source-identity.cjs` (yeni) | ID listesi doğrulaması, salt okunur approved character listesi ve prepare çözümlemesi |
| `apps/studio/channel-projects.cjs` | Kanal ayarı alanı, kısmi güncelleme, DB/proje izolasyonu, kaynak seçimi IPC ve kayıt doğrulaması |
| `apps/studio/preload.cjs` | Kaynak seçenekleri köprüsü |
| `apps/studio/src/ChannelProjectsSettings.tsx` | Çoklu seçim, eşleme kaldırma, kayıp ID ve kanal açma durumları; eski kanalın geç gelen sonucunu dışlama |
| `apps/studio/src/channel-projects.css` | Var olan ayar görünümünde checkbox/ID ve çözümlenemeyen kayıt satırları |
| `apps/studio/src/studio-api.d.ts` | Yeni IPC metodunun tipi |
| `apps/studio/src/narrative-api-contract.d.ts` | Eski profillerle uyumlu opsiyonel kaynak ID listesi ve frozen kaynak adı/ID tipi |
| `apps/studio/narrative-evidence.cjs` | V2 ve koşullu v1 kayıt kanıtı desteği |
| `apps/studio/narrative-store.cjs` | Prepare doğrulaması, frozen kimlik kanıtı/fingerprint, iki politika için bağlantı gate'i |
| `apps/studio/narrative-ai-contract.cjs` | V2 request kimlikleri ve tarafsız referans örneği; v1 biçiminin korunması |
| `apps/studio/narrative-ai-generation.cjs` | V2 için açık ID tabanlı POV ve kaynakla sınırlı doğal günlük talimatı |
| `apps/studio/narrative-quality.cjs` | ID tabanlı sahip referans denetimi; mapping gerektiren salt editoryal POV uyarısı |
| `apps/studio/narrative-service.cjs` | Kalite kontrolüne frozen kimlikler ve aynı adlı diğer karakter bağlamı |
| `apps/studio/verify-narrator-source-identity.cjs` (yeni) | Aşama 4.2 in-memory/tmp entegrasyon ve geriye uyumluluk senaryoları |
| `apps/studio/verify-channel-narrator.cjs` | Boş eşleme varsayılanı ve yeni prompt beklentisi |
| `apps/studio/verify-narrative-stage4.cjs` | Mapping olmadan genel “Anlatıcı” POV uyarısı üretilmemesi beklentisi |
| `apps/studio/verify-narrative-ai-generation.cjs` | Yeni profil/prompt beklentisi; mevcut sahte AI ve referans güvenliği testleri |
| `apps/studio/tests/channel-narrator.browser.mjs` | Gerçek React/IPC fixture'ına açık seçim/kaldırma, çözümlenemeyen ID, iki kanal ve frozen ad/ID senaryoları |
| `package.json` | Yeni kimlik testinin `verify:channel-narrator` zincirine eklenmesi |
| `docs/EVREN_JOURNAL_STAGE4_IDENTITY.md` (yeni) | Bu rapor |

Tablo yalnız bu aşamada düzenlenen dosyaları listeler. Başlangıçtaki diğer modified/untracked dosyalar korunmuştur.

## Doğrulama sonuçları

Tüm veri fixture'ları `:memory:` veya `os.tmpdir()` altında; gerçek DB/ayarlar test girdisi değildir.

| Komut / kontrol | Sonuç |
| --- | --- |
| `node apps/studio/verify-narrator-source-identity.cjs` | **PASS**: çoklu açık eşleme/kaldırma, adı benzer node'ları otomatik eşlememe, yanlış/kayıp/onayı kalkmış/silinmiş/türü yanlış ID, başka kanala özel ID, aynı ID'nin iki kanalda ayrı adları, yanlış runtime DB, idempotent prepare, fingerprint, frozen ayarlar, POV/alıntı/hitap/aynı isim, çok paragraflı yanıt, kayıt ve apply blocker'ları |
| Sentetik tarihsel #5 | **PASS**: v1 prepared, beş üçüncü şahıs draft ve sıfır approved fixture'ı; settings/prepare işlemlerinden sonra eski run ve draft satırları ile request aynı. Gerçek #5 okunmadı/yazılmadı. |
| Önceki sözleşmeyle karşılaştırma | **PASS**: görev başındaki `narrative-ai-contract.cjs` kopyası izole fixture üzerinde eski v1 policy ile çalıştırıldı; yeni kodun v1 request JSON'u bayt bayt aynı. Karşılaştırma gerçek veriye dayanmaz. |
| `node apps/studio/verify-channel-narrator.cjs` | **PASS**: tek yönlü migration, eski ayarlar, izolasyon, gerçek IPC, frozen request ve publication/memory koruması |
| `npm run verify:channel-narrator` | Node testleri **PASS**; React browser adımı yerel Vite sunucusu açılırken `listen EPERM 127.0.0.1:5173` ile ortam tarafından engellendi; tam zincir **geçmedi**. |
| `node apps/studio/verify-narrative-stage4.cjs` | **PASS**: node/ilişki ayrımı, frozen kaynaklar ve detached-reference blocker |
| `npm run verify:narrative-stage4` | Node testi **PASS**; ilk browser adımı aynı `listen EPERM` ile engellendi. Sonraki outline browser adımı zincirde çalışmadı; tam zincir **geçmedi**. |
| Sunucusuz Chromium açılış denemesi | Ortam `setsockopt: Operation not permitted` / `SIGTRAP` ile browser sürecini kapattı. Browser sonucu veya yeni ekran görüntüsü başarı kanıtı olarak sunulmaz. |
| `node --check apps/studio/tests/channel-narrator.browser.mjs` | **PASS**, yalnız sözdizimi doğrulaması |
| `node apps/studio/verify-narrative-ai-generation.cjs` | **PASS**, yalnız sahte provider; gerçek AI çağrısı yok |
| `node apps/studio/verify-narrative-ipc.cjs` | **PASS** |
| `node apps/studio/verify-narrative-service-contract.cjs` | **PASS** |
| `node apps/studio/verify-narrative-structured-content.cjs` | **PASS** |
| `node apps/studio/verify-channel-projects.cjs` | **PASS** |
| `node apps/studio/verify-narrative-store.cjs` | **PASS** |
| `node apps/studio/verify-narrative-editorial-ui.cjs` | **PASS** |
| `npm run build:studio` | **PASS**, TypeScript + Vite; 139 modül |
| `git diff --check` | **PASS** |

## Kısıtlar

React etkileşim testleri güncellendi ve build geçti; browser çalıştırılması bu ortamda doğrulanamadı. Ekran görüntüsüyle görsel kabul iddiası yoktur. Türkçe POV uyarısı temkinli bir dil örüntüsü kontrolüdür; tüm çekimleri/özne belirsizliklerini çözümleyen dilbilimsel kanıt değildir. Aynı adlı başka karakter varsa şüpheli düz ad için uyarı bastırılır; editoryal inceleme gerekir. Prompt'un gerçek modelde günlük kalitesi bu görevde gerçek AI çağrısı yapılmadığı için ölçülmedi.

Gerçek kanalda hiçbir kaynak eşlenmedi. Kullanıcının bildirdiği #5'in prepared / beş draft / sıfır onay durumu korunacak şekilde yalnız kod ve izole fixture'lar çalıştırıldı; gerçek #5 frozen request'i yeniden oluşturulmadı veya değiştirilmedi. Önceden hazırlanmış run'lar v2'ye otomatik geçirilmez.

## Bağımsız Nexa review ve terminal kabulü — 8 Kasım 2026

- Codex'in `workspace-write` sandbox'ında loopback sunucu/Chromium çalışmadığı için ilk rapor browser zincirlerini kısıtlı olarak bildirir. Aynı kod **yetkili normal Desktop Commander terminalinde** ayrıca çalıştırıldı: `npm run verify:channel-narrator` **PASS** (gerçek React + IPC, seçme/kaldırma, çözülmeyen ID, iki kanal, kaydetme/yeniden açma); `npm run verify:narrative-stage4` **PASS** (gerçek Chromium anlatı metni ve outline testleri). Bu bağımsız çalıştırma Codex'in sandbox kısıtını kaldırmadı.
- İncelemede üçüncü şahıs kontrolünün kaynakta sık geçen `Ömer davetliyi çağırır` fiilini kaçırdığı görüldü. `narrative-quality.cjs` eylem çekimleri genişletildi ve `verify-narrator-source-identity.cjs` içine `Ömer davetliyi çağırır` ile `Ömer mor sıvıyı içti` örnekleri eklendi. Eşlenmemiş kimlik, doğrudan hitap, alıntı ve aynı adlı başka karakter testleri korunuyor. Yeni testler PASS.
- Değişiklik sonrası `npm run build:studio`, `verify:narrative-stage4`, `verify:channel-narrator`, `verify-narrative-ai-generation`, `verify-narrative-service-contract`, `verify-narrative-ipc`, `git diff --check` PASS.
- Gerçek #5: `prepared`, beş `draft`, sıfır aktif onaylı günlük; model `gpt-5.6-luna`. Kullanıcının anlatıcı eşleştirmesi hâlâ boş, kullanıcı açıkça kayıt seçmedikçe hiçbir kayıt otomatik eşlenmeyecek. Gerçek `channels/birdesengor/channel.json` ve `public-export/content/publication.json` fiziksel SHA-256 özetleri başlangıçla aynı.
- Dikkat: geliştirme boyunca gerçek SQLite ana dosyasının fiziksel hash'i değişti, önceden mevcut WAL/SHM dosyaları kayboldu. Bu SQLite checkpoint/kapanışı ile tutarlı, fakat sebebi kesin teyit edilemiyor. Mantıksal #5 çalışma ve taslak sayıları değişmedi. Bu nedenle *SQLite'nın ham byte'ları tamamen değişmedi* iddiası yapılmıyor.
- Gerçek modelle **yeni** günlük üretimi bu turda yapılmadı: kaynak kimliğinin anlatım kalitesine etkisi ancak kullanıcı seçimi yapıldıktan sonra yeni prepared çalışma ile doğrulanabilir.
