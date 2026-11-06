# S6 — Vefk Sunucu Kabul Sözleşmesi (site oturumuna devir)

Tarih: 2026-11-04
Durum: **Tasarı / sunucu kabulü BLOCKED**. Site ve Efekt Atölyesi dosyalarına bu Studio oturumunda müdahale edilmedi.

## Sınır ve mevcut bulgu

Studio, `birdesengor.vefk` (schemaVersion 1) belgelerini onaylı revizyonla üretir. `publication.json` içinde `vefkCatalog` bulunuyorsa katalog da bütün yayının `publication.contentFingerprint` hesabına dahildir. Bu alan yoksa eski genel yayın akışı, mevcut sözleşmesiyle sürer.

Site tarafında iki ayrı kontrol noktası vardır:

1. PHP `channels/birdesengor/web/public/api/studio/publication.php` → `publication_validate()`: sunucunun gelen yayını depolamadan **önce** denetlemesi gerekir.
2. ESM `docs/contracts/vefk-site-consumer.mjs` → `readVefkPublication()`: istemcinin yüklenen yayını sahneye bağlamadan **önce** doğrulaması gerekir.

2026-11-04 salt-okunur testinde PHP sağlıklı kaydı kabul etti, fakat değiştirilen Vefk belge başlığı, güvensiz SVG komutu, sahte divit ankordu, bozuk katalog hash'i, dizin dışına çıkan belge URL'si ve hatalı revizyonu da kabul etti. Aynı altı mutasyonu ESM tüketici reddetti. Bu, **PHP giriş sınırı açığıdır**; tek başına sahnede çalıştırılabildiği anlamına gelmez. Yalnız JS doğrulamasına güvenilerek sunucu kabulü sağlanmış sayılmamalı.

## PHP için beklenen kapı

- `publication.schemaVersion = 2`; yayın parmak izi, kanonik derin anahtar sıralamalı JSON'un SHA-256'sı ile doğrulanmalı. Hesaba `schemaVersion,journal,archive,assets,youtubeAnalysis,support` ve **yalnız mevcutsa** `vefkCatalog` girmeli. Ham veri hash'lenmeden önce sessiz normalize edilmemeli.
- `vefkCatalog` yoksa Vefk dokümanı icat edilmemeli; mevcut V2 kabul politikası geçerli. Varsa katalog `format=birdesengor.vefk-catalog`, `schemaVersion=1`, en fazla 32 giriş, izin verilen ölçü/boyut sınırları, deterministik sıra ve tekrarsız kimlik içermeli.
- Katalog `fingerprint` değeri, `fingerprint` alanı hariç kanonik katalog nesnesinin SHA-256'sı olmalı. `binding` yalnız `birdesengor-study-v2` içindeki `parchment.ink-plane` ve `quill.tip` ankora, `svg-viewBox` ve `contain` eşlemine izin vermeli; sahte, eksik veya farklı bağlantı reddedilmeli.
- Her katalog girişi onaylı Studio belgesine göre `id,revision,title,contentHash,order,url,sha256,document` tutarlılığı taşımalı. `url` yalnız `vefk/documents/<id>-r<revision>-<sha16>.json` biçiminde, hash'e bağlı yerel yolda kalmalı; `../`, tam URL ve dış kaynak yasak. Belge metninin kanonik pretty JSON byte hash'i girişi doğrulamalı.
- `document.format=birdesengor.vefk`, `schemaVersion=1`, `contentHash=SHA256(semantik belge)` zorunlu. İzinli geometri yalnız güvenli mutlak `M/L/Z`, sınırlı yol sayısı/uzunluğu/koordinatlar, tekil path ID, tanımlı mürekkep stili ve geçerli SVG viewBox içermeli. Her path için tekil, sıralı, pozitif süreli ve doğru `ink/pen` alanlı stroke gereklidir; `durationMs` ve marker sınırları aşılmamalı.
- Katalog veya belge kabulü başarısızsa **4xx ile reddet**, yayını/DB'yi/asset'i yazma, önceki sağlam yayını koru. Kırık belgeyi `vefkCatalog` alanını atarak kabul etmek, hash'i yeniden hesaplayıp sessizce düzeltmek ya da sahnede sahte çizim üretmek kabul edilmez.
- Kaynak dosya boyutu, iç içe veri derinliği ve toplam işlem bütçesi sınırlandırılmalı. Bu, sadece hash doğrulaması değil, CPU/bellek istismarına karşı da kabul kapısıdır.

## Tekrarlanabilir test

Proje kökünde:

```sh
node apps/studio/vefk-s6-boundary-audit.mjs \
  channels/birdesengor/.local-data/studio/public-export/content/publication.json
```

İkinci argüman olarak etkin PHP `publication.php` yolu verilebilir. Araç **salt-okunurdur**: PHP işlevini CLI içinde çağırır, HTTP POST/deploy veya DB yazma yapmaz. Sağlıklı gerçek yayını ve altı saldırı fixtürünü aynı PHP ve ESM sınırından geçirir. Altı mutasyonun ikisi de tarafından reddedilmesi ve sağlam yayının kabul edilmesi halinde `S6_ACCEPTANCE_PASS`/exit 0 beklenir. Şu an `S6_ACCEPTANCE_BLOCKED=6`/exit 2 beklenen gerçek bulgudur. Test için demo 5×5 kaydına özel fallback yoktur; herhangi yeni, onaylı ve seçili test vefkiyle yeniden çalıştırılabilir.

## Paralel site oturumu için uygulama ayrımı

PHP kabul dosyaları ve V2 sahne kodu yalnız site geliştirme oturumuna aittir. Studio oturumu kanonik oynatıcıyı, bu audit aracını ve kendi S1–S5 testlerini sürdürebilir. Sunucu doğrulama uygulandıktan sonra şu ayrı kanıtlar istenir:

1. Birim düzeyi PHP 7/7 vaka: 1 sağlam yayın kabul, 6 bozuk yayın ret.
2. Bozuk yayın POST edilince **eski sağlam yayının ve asset dosyalarının değişmediği** uçtan uca kanıt; auth, body boyutu ve hata kodu.
3. V2 sahnede gerçek yeni test kataloğuyla `readVefkPublication`, `frameAt`, `penDown`, visibility ve seek senkronizasyonu; reduced-motion son kare durumu.
4. Tek çizgi içi hız eğrileri ortak sözleşmede kabul edilmeden `stroke.easing` gibi alanlar **yayınlanmaz**. Studio'daki deneysel önizleme yalnız araştırma yüzeyidir.

Bu not site dosyalarını değiştirme veya canlı deploy izni vermez.

## Referans PHP çözümü — 2026-11-04 Studio doğrulama eki

`docs/contracts/vefk-s6-php-gate.php` bir **bağımsız, yalnızca referans** doğrulayıcıdır.
Siteye kurulmadı. `vefk_s6_validate_publication(stdClass $raw)` girdi olarak
*publication iç nesnesini*, gerçek JSON türleri korunmuş şekilde alır. Bu
özellikle `archive.entities[].visual = {}` kayıtlarını `[]` ile karıştırmamak
için zorunludur. Mevcut `request_json()` / `publication_validate()` PHP
ilişkisel dizileriyle tek başına üst fingerprint doğrulaması güvenilir değildir.

**Site oturumundaki uygulama kararı:** İstek JSON'unu tek kaynak metinden hem
`json_decode(..., true)` (mevcut işleme) hem de `json_decode(..., false)`
(kanonik türleri koruma) halinde çıkarmak; bütün mevcut yetki/asset kapıları
korunduktan sonra, fakat **`publication_write` ve asset temizliğinden önce**
referans doğrulamasını eklemek. `DomainException` ve JSON hataları doğru 4xx
ile cevaplanmalı, bozuk yayın sonrası önceki yayın/asset'ler değişmemeli.
Referans dosyanın sunucuda güvenli bakımı, konumu ve entegrasyonu **yalnız site
oturumunun sorumluluğundadır**. Studio tarafından site dosyasına kopyalama veya
deploy izni verilmedi. Vefk kataloğu bulunmayan yayınlar referans kapıda
değişmeden geçer ve önceki PHP doğrulamasıyla değerlendirilir.

Referans test komutu (son argüman isteğe bağlı geçici kapı):
```sh
node apps/studio/vefk-s6-boundary-audit.mjs \
  channels/birdesengor/.local-data/studio/public-export/content/publication.json \
  channels/birdesengor/web/public/api/studio/publication.php \
  docs/contracts/vefk-s6-php-gate.php
```

Yeni 3×3, 14 yolluk **tamamen sentetik** yayınla da çalıştırıldı:
sağlam yayın ve hash'leri tutarlı yeniden üretilmiş başlık **2/2 kabul**;
üçü bütün SHA-256 katmanları güncellenmiş olan **9/9 bozuk yayın reddi**,
toplam **11/11 PASS**. `apps/studio/vefk-s6-php-gate.test.cjs` ayrıca
PHP referansını **31/31** pozitif/negatif vakada doğrular: UTF-8 Arapça başlık,
boş JSON nesnesi, vefksiz eski yayın, tam hash'li bozuk SVG ve stroke,
tanımsız `easing`, yanlış sahne ankordu. Ancak gerçek PHP kabul kapısı
bu dosyayla **henüz entegre değildir**, dolayısıyla üretim S6 halen BLOCKED.

**İkinci açık kapı — şema katılığı:**
`node apps/studio/vefk-s6-consumer-schema-audit.mjs` tamamen sentetik
3×3 v1 belgesine, bütün hash'ler yeniden hesaplanmış yasak `stroke.easing`
ekler. S1 çekirdeği **reddediyor**, yeni referans PHP **reddediyor**,
ama güncel JS site tüketicisi **kabul ediyor**; sonuç
`S6_SITE_SCHEMA_STRICTNESS_BLOCKED` / exit 2. Bunun sonucu bilinmeyen bir
özelliğin sitede *yanlış oynatılması* olabilir; tek başına script çalıştırma
veya kullanıcı verisinin ele geçirildiği anlamına gelmez. Site oturumu v1
`drawPlan.strokes` için izinli alanları sıkı doğrulamalı; ayrı bir v2
`schemaVersion` anlaşması yapılmadan hiçbir yeni `easing` yayınlanmamalı.

Ek kabul: Gerçek HTTP kullanıcı oturumunda 4xx + yazma-sıfır kanıtı;
mevcut oturumda **yalnız salt-okunur CLI** testleri yapıldı.

## S1 semantik eşitlik doğrulaması ve dosya devir sınırı (2026-11-04)

PHP referans kapısında yalnız SHA doğrulaması yeterli değildir: bütün
hash'leri doğru yeniden hesaplanmış sahte `magicSquare` grid'leri,
`construction.checks`, sahte `algorithmId`, hücreye yanlış
`semanticValue`, normalleştirilmemiş SVG, yanlış style alanları,
mutlak koordinat sınırı ve metin UTF-16 uzunluğu da ayrı reddedilmelidir.
Bunlara karşı `vefk_s6_construction` Siamese-odd (3/5/7) hücre yerleşim
algoritmasını, kare toplamlarını, `manualSquare` için yapı kontrolünü ve
`manualPaths` için yalnız vektör kontrolünü doğrular.

`apps/studio/vefk-s6-php-gate.test.cjs` **31/31 PASS**: tam hash'li
sahte matematik karesi, süresi çakışan stroke ve güvensiz SVG'ler ret;
geçerli 3×3, 5×5, 7×7, negatif ve azalan diziler, matematiksel olmayan
`manualSquare`, çok parçalı çizgili `manualPaths` kabul.
PHP lint PASS. Bu, yalnızca *referans doğrulayıcının* testidir;
gerçek endpoint'in aynı davranışı gösterdiği iddia edilmez.

Geliştirmeleri tek oturumda birleştirme sözleşmesi:
`docs/VEFK_SINGLE_SESSION_HANDOFF.md`. Site V2/PHP/efekt dosyaları
paralel oturumdayken Studio tarafından değiştirilmez. Gerçek PHP POST
4xx/yazma-sıfır ve JS v1 `easing` alanı fail-closed testleri
entegrasyon sahibi tek oturumun zorunlu kapanış kapılarıdır.

## S6 birleşik yerel entegrasyon kararı — 2026-11-04 (önceki BLOCKED notlarını günceller)

**Yerel geliştirme kapısı PASS; canlı hosting kabulü yapılmadı.** Artık gerçek PHP `publication_validate_vefk` kapısı `channels/birdesengor/web/public/api/studio/index.php` tarafından yetkili yayın talebinde, veri yazma ve asset temizliğinden önce çağrılır. Referans doğrulayıcı, siteye taşınan `vefk-s6-php-gate.php` dosyasıyla byte-byte aynı ve build çıktısında da 644 izinleriyle korunmuştur. JSON typed nesne/liste ayrımı için aynı ham gövde bir kez sınırlandırılmış biçimde okunur; Vefk yoksa legacy yayın akışı bozulmaz. PHP koordinat tokenı, komut harfleri sayıya çevrilmeden doğrulanır.

Site JS v1 tüketici `docs/contracts/vefk-site-consumer.mjs` ile eşlenik sürümdedir. İzinsiz `stroke.easing` dahil v1'de bilinmeyen alanlar fail-closed reddedilir. Kalıcı v2 motion yayımlama henüz etkin değildir.

Testler: **46/46** birleşik S6 endpoint/şema; **33/33** PHP referans; **11/11** yayın kabul karşılaştırması; **216/216** toplam Vefk; **146/146** V2 site. İki eski blokajın tekrar denetimi artık `S6_ACCEPTANCE_PASS` ve `S6_SITE_SCHEMA_STRICTNESS_PASS` sonuçlarını verir. Gerçek localhost `php -S` HTTP testleri izole SQLite admin hesabı ve sentetik içerikle 4xx/401/403/413/422, 16MiB ve chunked sınırları, verinin reddedilen istekten sonra hash/mtime/mode olarak değişmemesini doğruladı. Studio, site V2 ve PHP taşıyan web derlemeleri, PHP lint, Publication V2 ve diff biçim denetimleri PASS.

**Sınırlar:** Canlı siteye herhangi bir yayın gönderilmedi, gerçek hosting/SAPI sınanmadı, Git commit/push veya deploy yapılmadı. Gerçek sahne Chromium görsel E2E ve P7.5 görsel materyal çalışmaları ayrıca yapılacak. Bu kayıt, yukarıdaki tarihsel `S6_ACCEPTANCE_BLOCKED` ve `S6_SITE_SCHEMA_STRICTNESS_BLOCKED` ifadelerinin **önceki durumu** tarif ettiğini açıkça günceller. Ayrıntılı devir: `docs/VEFK_SINGLE_SESSION_HANDOFF.md`.
