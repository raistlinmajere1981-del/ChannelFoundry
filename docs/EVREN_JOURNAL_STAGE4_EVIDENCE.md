# Evren Kitabı — Aşama 4.3: kaynak izi ve doğal günlük talimatı

8 Kasım 2026. Aşama 1–4.2'nin mevcut modified/untracked çalışma ağacı korunarak küçük, eklemeli değişiklikler yapıldı. Gerçek AI çağrısı, commit, push veya deploy yapılmadı.

## Kapsam

`apps/studio/narrative-evidence-ledger.cjs` veritabanından bağımsız, deterministik bir editör türetimidir. Frozen `runSourceMap` snapshot'larını veya mevcut AI sözleşmesinin kaynak descriptor'larını alır; yalnız taslağın `sourceKeys` değerlerindeki node kayıtlarını gösterir. Her kaydın `kind`, `sourceKey`, `name`, genel özeti ve genel video listesi ayrı tutulur. `payload.sequence` sırası korunur; `payload.details` ve sequence öğeleri kendi metinleri ve **yalnız kendi** `sourceVideoIds` değerleriyle gösterilir.

Düğümün `summary` metni ve bütün video listesi **genel bağlamdır**; her ayrıntının o videoların hepsinde geçtiği iddia edilmez. Ayrıntının video listesi boşsa düğümün genel listesinden doldurulmaz. Aynı metin farklı video eşlemeleriyle geldiyse bunlar korunur. Tam kopya kayıt/öğeler tekilleştirilir; boş/bozuk JSON girdileri kullanılabilir alanlara kadar toleranslı işlenir. Eski düz metin detail öğelerine veya eksik snapshot'lara yeni kanıt metni/video ataması yapılmaz; özgül öğe yoksa genel bağlam fallback'i gösterilir. Bulunamayan kaynak anahtarları ayrıca belirtilir. Kayıt ve video sayısı seçili kayıtlardan türetilir; video sayısı genel ve özgül ID'lerin tekil birleşimidir.

`narrative-service.cjs` yalnız editör yanıtındaki taslaklara `evidenceLedger` ekler. DB kolonları, run policy, frozen input, request sözleşmesi ve fingerprint hesabı değişmedi. Eski/stale çalışma incelenirken de güncel node içeriği yerine aynı run'ın snapshot'ı kullanılır. Normal request'te bulunan video başlıkları UI'da ID yanında gösterilir; metadata yoksa ID korunur. Video başlığı ve yayın tarihi olay kanıtı değildir.

`NarrativeWorkbench.tsx` her taslak altında, okuma paragrafından ayrı ve başlangıçta kapalı **Kaynak ayrıntılarını incele** alanı gösterir. Kaynak adı/kimliği, genel bağlam, sequence/detail metni ve ilgili video başlığı/ID ayrıdır. Mevcut toplu kaynak video alanı “genel liste” olarak etiketlendi. Tema token'ları, sarmalanan uzun metinler ve native details/summary klavye davranışı kullanılır. Kaynak izi kesin doğruluk sertifikası değildir. Yayın üreticisi ve okuyucu site kodu değiştirilmedi; ledger `narrativeMemory`, frozen baseline veya publication içine yazılmaz.

## Hafif üretim temizliği

Yalnız v2 üretim mesajı oluşturulurken üç kısa talimat eklendi/güncellendi:

- Okuyucu paragrafına “kaynakta daha fazla ayrıntı yok”, “kaynakta açıklanmamaktadır”, “bu bilgilerin … aktarıldığı belirtilmiştir” gibi editoryal kaynak raporları koyma. Eksik bilgiyi doldurma; gerçek belirsizliği kaynak sahibine bağlı doğal anlatımla koru.
- Ayrı sequence/detail parçalarını, kaynak izin verdiğinde kronolojiyi koruyan doğal paragraflara taşı. Uzunluk/sözcük/paragraf kotası yoktur; kaynak azsa kısa kal. Duygu, sebep, izin, diyalog, mekân, tarih veya olay ekleme; farklı videolardan kanıtsız ortak sahne kurma.
- Özgül video atfını ilgili detail/sequence öğesinden al; genel node video listesini ayrıntılara dağıtma. `visual`, `attributes`, `prompt`, `negativePrompt` olay kanıtı değildir.

Explicit mapped ID **ve eyleme ait kaynak kanıtı** gerektiren birinci şahıs kuralı, neutral mod, diğer kişilere ait deneyim/iddia atfı ve paranormal iddiaların kaynak sahibine bağlanması korunur. V1 prompt'u bayt düzeyinde aynı kaldı. Yeni mesajlar ancak ileride kullanıcı yeni üretim çağrısı başlatırsa kullanılır; bu turda #6 veya başka gerçek run için `buildMessages`/generate çalıştırılmadı, kaydedilmiş hiçbir istem/metin güncellenmedi.

`narrative-quality.cjs` yalnız dar ve açık meta rapor kalıpları için `editorial_source_report` **warning** ekler. Uyarı metni değiştirmez ve onayı engellemez. Alıntılar dışlanır; sıradan “bilinmiyor” veya doğal kaynak atfı uyarılmaz. Aşama 4.1 inline reference blocker'ları, narrator POV ve 4+ video review kontrolleri korunur.

## Neyi otomatik doğrulamıyoruz?

Bu iz bir cümlenin doğru/yanlış olduğuna karar vermez; transcript/video içeriğini semantik olarak karşılaştırmaz. Özgül metnin kaynağa gerçekten sadık çıkarıldığı, farklı videoların aynı olayı anlattığı, olay kronolojisinin eksiksizliği veya birinci şahıs sahipliği regex ile kanıtlanmaz. Her okuyucu cümlesi otomatik olarak tek bir ledger öğesine eşleştirilmez; editör taslağa ait frozen kaynakları yan yana inceler. Uyarıların olmaması doğruluk garantisi değildir.

Kullanıcının düzeltmesine göre **“İbn Necem Ömer’in mor sıvıyı içmesine izin verdi”** ayrıntısı approved `payload.details` içinde, `I8ec5jhbTH4` videosuna bağlıdır. Bunu uydurma sayan bir kural eklenmedi. Gerçek DB açılmadan, kullanıcının bildirdiği ayrıntı sentetik approved fixture'a aynı video ID'siyle taşındı. Test, bu kaynak izinin korunmasını doğrular; gerçek videonun yeniden doğrulandığı iddiasında bulunmaz.

## Gerçek #6 ve mevcut çalışma ağacı

Gerçek Studio SQLite/WAL/SHM dosyaları açılmadı; gerçek #6 prepared run ve üç draft okunmadı/yazılmadı. Gerçek `channel.json` ve `publication.json` üzerinde yazma yapılmadı. Approved kaynak, gerçek AI istemi, approve/discard/generate veya yeniden hazırlama işlemi çalıştırılmadı. Tüm veri fixture'ları `:memory:`/`os.tmpdir()` içindedir; AI generation regresyon testi mock provider kullanır.

Başlangıçtaki dirty dosyaların SHA-256 karşılaştırmasında bu aşamanın izinli sekiz mevcut dosyası dışında kalan **38 dosya aynı** kaldı; gerçek `channels/birdesengor/channel.json` da bunların içindedir. `narrative-ai-contract.cjs`, `narrative-store.cjs`, `narrative-evidence.cjs` değiştirilmedi. Reset/restore/checkout/clean/stash kullanılmadı. Nested web projesinde ve diğer sitelerde dosya düzenlemesi veya proje komutu çalıştırılmadı; mevcut browser testleri yalnız kurulu Playwright bağımlılığını çözmek için web package konumunu kullanır. Studio build yalnız kendi `dist` çıktısını üretir.

## Testler

| Kontrol | Sonuç |
| --- | --- |
| `npm run build:studio` | PASS: TypeScript + Vite, 139 modül |
| `npm run verify:narrative-evidence:unit` | PASS: detail/summary ayrımı, izin örneği, dört video granularity, sequence sırası, eksik video eşlemesi, kopya/boş/bozuk JSON, aynı metnin farklı video eşlemeleri, descriptor/snapshot eşitliği, üç draft filtrelemesi, iki kanalda aynı key izolasyonu, stale frozen kaynak, report-style warning ve false-positive senaryoları |
| Önceki sözleşmeyle bağımsız karşılaştırma | PASS: görev başında alınmış Aşama 4.2 contract/generation dosyaları memory/tmp fixture üzerinde çalıştırıldı. V1/v2 request JSON baytları ve user message aynı; v1 system message da aynı. Hash'ler yeni teste sabitlendi. |
| `npm run verify:narrative-stage4` | Node testi PASS; ilk browser adımı `listen EPERM 127.0.0.1:5173` ile engellendi. Tam zincir PASS değil; sonraki outline browser adımı zincirde çalışmadı. |
| `npm run verify:channel-narrator` | Her iki Node testi PASS; browser adımı aynı EPERM ile engellendi. Tam zincir PASS değil. |
| `npm run verify:narrative-evidence:browser` | Vite sunucusu aynı EPERM ile engellendi. Browser render/etkileşim/görsel kabul henüz doğrulanmadı. |
| `node apps/studio/verify-narrative-ai-generation.cjs` | PASS; yalnız mock provider, gerçek AI çağrısı yok |
| `node apps/studio/verify-publication-v2.cjs` | PASS; ek assertion'lar editör ledger okumasından sonra yayın snapshot/fingerprint'inin aynı kaldığını ve ledger'ın yayına girmediğini doğrular |
| Narrative service, editorial UI, IPC, structured content, store ve outline Node testleri | PASS |
| Yeni browser script'i `node --check` | PASS; yalnız sözdizimi, browser başarısı değildir |
| `git diff --check` | PASS |

Bağımsız eski/yeni request karşılaştırmasındaki SHA-256 değerleri (sentetik fixture; gerçek #6 fingerprint'i değildir):

```text
narrative-records-v2 8839e832c182b5043eb2aa35199978774a31fb004f0a693f1077f5da90a79cf7
narrative-records-v1 951253ca6f0bba9a73da0d6ca98a12e3ecc3001db24e87ca1ddc1f848b16ff5a
```

`package.json` içine `verify:narrative-evidence`, `verify:narrative-evidence:unit`, `verify:narrative-evidence:browser` komutları eklendi; yeni suite release zincirine de bağlandı. Yeni browser testi gerçek React + salt okuma production IPC fixture'ı kullanır; 1920/1366/390, light/dark, başlangıçta kapalılık, mouse/klavye aç-kapat, doğru video başlığı/ID, metadata/okuyucu metni ayrımı, summary fallback, taşma ve metin kontrastı assertion'larını içerir. Bütün yeni fixture ve görsel çıktıları varsayılan olarak `/tmp` altındadır; çıktı klasörü `NARRATIVE_EVIDENCE_ARTIFACTS` ile seçilebilir.

Sandbox dışındaki asıl terminalde kalan doğrulama:

```bash
npm run verify:narrative-evidence
npm run verify:narrative-stage4
npm run verify:channel-narrator
```

## Sonraki gerçek deneme / A-B

Kullanıcı, önceki kalite denemelerinin limit tasarrufu için GPT-5.6 Luna ile yapıldığını bildirdi. Anlatım zayıflığının ne kadarının modelden geldiği bu görevde ölçülmedi; yazılımsal kural eksikliği varsayılmadı. Sonraki gerçek deneme kullanıcı tarafından **daha güçlü model + High reasoning** ile başlatılacak. Bu görev model/sağlayıcı/akıl yürütme ayarlarını değiştirmedi ve #6'yı kapatmadı.

Yeni denemede kaynakta desteklenen olayların doğal paragraflara taşınması, rapor dilinin azalması, explicit kimliğe bağlı ben dili, ayrı videolardan kanıtsız sahne kurulup kurulmadığı ve kaynak izinin editörce izlenebilirliği karşılaştırılabilir. #6 Luna metinleriyle fark tek başına prompt etkisi sayılamaz; model de değişmektedir. Saf prompt A/B yapılacaksa aynı frozen kaynaklar/kimlik, aynı güçlü model ve High ayarıyla eski/yeni talimat ayrı, kullanıcı tarafından başlatılan denemelerde karşılaştırılmalıdır. Otomatik içerik dönüştürme veya daha ağır kalite kuralları eklemeden önce bu ölçüm beklenir.
