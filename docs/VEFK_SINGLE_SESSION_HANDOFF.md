> **En güncel devir — S4b (2026-11-04):** Yerel sürümlü doc2 yayını tamamlandı.
> Catalog1/binding2/doc1 korunur; seçilmiş onaylı doc2 varsa catalog2/binding3
> ve binding.motion `{strokeEasing:"v2"}` gerekir. Aşağıdaki eski S4a/S6/P7.5
> v1-only kayıtları tarihseldir. Canlı deploy yok; S4c UI/doc2 görsel E2E açık.

# BirDeSenGör — P7.5 vefk cihazı birleşik kapanışı

Güncelleme: **2026-11-04**. Bu bölüm aşağıdaki önceki S6 oturum kaydından daha yenidir ve P7.5 için bağlayıcıdır.

## P7.5 uygulama ve sınırlar

Bağımsız açılan/sarılan `parchment` tamamen kaldırıldı. `VefkStand` tek kalıcı `vefk-stand` nesnesidir: üç ayrık ahşap ayak, pirinç köşeler, sabit eğimli gerilmiş panel, çapraz destek ve entegre divit yuvası. Panelin dokusu yüzey malzemesidir; ikinci parşömen/örtü/rulo veya ikinci SVG yoktur. Oda/focus ölçüleri eşittir; mevcut CameraRig 2.4 zoom’u aynı fiziksel cihazı yaklaştırır. Kapatma/Escape yalnız mevcut kamera dönüşünü başlatır.

Mekanik kol play/pause, oyulmuş native range ileri/geri seek, mühür nişleri onaylı kayıt/revizyon seçimi, süpürme taşı yalnız **seek(0)** yapar. Tüm yollar ve onaylı kaynak değişmeden kalır. Açık vefk yokken denetimler etkileşim almaz; empty/error/loading hallerinde dönüş halkası kullanılabilir. Hareketli divit aynı düğümdür; pointer hitbox’ı donanımı engellemez, klavye eylemi kalır. Kanonik Studio player değişmedi; SVG ekran matrisi ve mevcut metal uçtaki sıfır alanlı ölçüm noktası projeksiyonu eşler. Reduced motion otomatik çizim/divit uçuşunu durdurur, range/taş/niş kullanılabilir kalır.

**Kanonik binding v2:** `sceneId: birdesengor-study-v2`, `surface: vefk-stand / vefk-stand.ink-plane`, `pen: quill / quill.tip`, `coordinateSpace: svg-viewBox`, `fit: contain`. Publication/catalog/document şemaları **2/1/1** kalır. Studio `vefk-publication.cjs`, PHP referans + sunulan gate ve JS referans + site consumer birlikte güncellendi. Eski binding v1 ve eski yüzey id’si yeni hash ile bile reddedilir; fallback veya migration yoktur. Eski 5×5 demo yalnız sayfa yenileyerek çalışmaz; yeni binding ile yeniden yayın paketi üretilmesi gerekir. Kullanıcının Studio kaynaklarına ve gerçek export’una dokunulmadı.

Başlangıçta sahiplik/süreçler/çalışma ağacı kontrol edildi. Mevcut 5208 Vite süreci korundu; testler kendi boş portlarında çalıştı. Büyük tracked/untracked ağaç korunur. CameraRig, kitap, kamera, mum ve kanonik efekt uygulama dosyaları başlangıç kopyalarıyla byte-byte karşılaştırıldı: değişmedi. Manifest/efekt spec içindeki diğer **15 nesnenin kayıtları birebir aynı**; toplam **16 nesne / 21 anchor** sürer. Git commit/push/clean/reset/stash/checkout ve deploy yapılmadı. Başka sahne kurgusuna geçilmedi.

## P7.5 doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Başlangıç site Node | 146/146 PASS |
| İlk binding/PHP sözleşme bölümü | 41/41 PASS |
| Son site Node | **150/150 PASS** |
| Son Studio Vefk toplu test | **218/218 PASS**; gerçek yerel PHP endpoint/auth/HTTP ve saldırı fixture’ları dahil |
| Site üretim build | **PASS**, 94 modül |
| PHP gate/reference ve JS consumer kopyaları | **Byte eşitliği PASS**, iki PHP lint PASS |
| S6 boundary audit, yeni geçici sentetik 3×3 | **11/11 PASS**, `S6_ACCEPTANCE_PASS` |
| S6 v1 şema audit | **PASS**, `S6_SITE_SCHEMA_STRICTNESS_PASS` |
| Tam Chromium regresyon + P7.5 özel tarayıcı testi | **Son toplu tur sürüyor; nihai sonuç aşağıya işlenecek** |
| Üç kadraj P7.5 özel ön tur | **3/3 PASS**, tek nesne/panel/SVG, 16/21, native range, kol, taş, mühür, zoom ve reduced motion |
| diff whitespace | Son doküman yazımından sonra tamamlanacak |

Testler yalnız bellek SQLite, geçici export/JSON ve mock API kullanır. E2E’nin eski gerçek export bağımlılığı kaldırıldı: kitap regresyonu için sentetik 4 bölüm/33 kayıt; vefk için gerçek Studio üretici akışından bellek DB + geçici export. İkinci vefk kaydı revizyon 1 → onay → revizyon 2 → onay → seçim akışından geçer. Gerçek Studio verisi test girdisi değildir. Test sunucuları kendi yaşam döngülerinde kapatılır; üretilen izole fixture/screenshot’lar kullanıcı dosyalarını temizlemez.

Görsel kanıt: `channels/birdesengor/web/artifacts/p75/{1920,1366,390}-{room,focus}.png` ve `metrics.json`. Panel/donanım üç viewport içinde, ekran hedefleri en az 40×40 px; oda paneli diğer etkileşimli hit alanlarını örtmez. Zoom testi CSS `zoom:1.1` + resize ile yapılır; gerçek OS/browser zoom ve fiziksel telefon üzerinde manuel kabul değildir. Bu ilk CSS malzeme sanat turudur; nihai fotogerçekçi sanat kabulü ayrıca yapılabilir. Uygulamanın kalan zorunlu işi varsa son sonuç bölümünde açıkça işaretlenecektir.

### Tekrarlanabilir komutlar

```sh
npm --prefix channels/birdesengor/web test
npm --prefix channels/birdesengor/web run build
npm --prefix channels/birdesengor/web run test:e2e
npm --prefix channels/birdesengor/web run test:e2e:p75
rg --files apps/studio | rg '(^|/)vefk.*\.test\.(cjs|mjs)$' | sort | xargs node --test --test-isolation=none
node -e 'require("node:fs").writeFileSync("/tmp/bdg-p75-audit-publication.json", JSON.stringify(require("./apps/studio/vefk-s6-fixtures.cjs").fixture()))'
node apps/studio/vefk-s6-boundary-audit.mjs /tmp/bdg-p75-audit-publication.json
node apps/studio/vefk-s6-consumer-schema-audit.mjs
cmp docs/contracts/vefk-s6-php-gate.php channels/birdesengor/web/public/api/studio/vefk-s6-php-gate.php
cmp docs/contracts/vefk-site-consumer.mjs channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs
git diff --check
git -C channels/birdesengor/web diff --check
```

### Testte yakalanan ve düzeltilen sorunlar

- İlk npm çağrısı yanlışlıkla repo kökünde çalıştı: `Missing script: test/build`. Doğru site prefix’iyle tekrarlandı; build/test geçti.
- Cihaz boyutu değişince eski effect pose testte reddedildi. Yalnız vefk-stand spec kaydı yeni oda ölçülerine eşitlendi; motor değişmedi.
- İlk projeksiyon örneklerinde yaklaşık 1–2,25 px sapma vardı. Sabit eğim ve responsive metal ucunu gerçek SVG/DOM ekran dönüşümüyle ölçerek düzeltildi; <1 px kabul eşiği gevşetilmedi.
- Mobilde divit hit alanı panelle kesişti; cihazın mobil konumu ayrıldı. Çizim sırasındaki geniş divit hitbox’ı dönüş halkasını engelliyordu; pointer geçişi ve sabit kol kullanımıyla düzeltildi.
- İlk tam E2E sentetik kitap fixture’ında video yayın referansları eksikti; kameranın mevcut birleştirme bekletisi hata verdi. Yalnız dummy fixture’a iki sentetik referans eklendi; kamera kodu değiştirilmedi.
- Sonraki tam E2E turu eski açılan sayfanın mobil 220 px çizim alanı varsayımını yakaladı (yeni sabit cihazda revizyon 2 için 167 px). Sabit cihazın kompakt kadrajı korunarak yeni mobil kabul eşiği 160 px, masaüstü 260 px olarak tanımlandı; başlık iki satırla, matris tek satırla sınırlandı. Eski rulo ölçüsünü sağlamak için cihaz focus sırasında büyütülmez. Yeni özel tarayıcı testi revizyon 2 yüzeyini de bu eşiklerle denetler.
- Model/servis kota veya limit hatası görülmedi.

---

## Önceki S6 oturum kaydı — tarihsel

Aşağıdaki kayıt önceki uygulama ve testlerin tarihçesidir; P7.5’in yapılmadığı, rulo kullanıldığı veya testin gerçek yerel export gerektirdiği ifadeleri yukarıdaki son kararla geçersizdir.

# BirDeSenGör — Vefk S6 birleşik oturum kapanışı

Güncelleme: 2026-11-04
Durum: **Yerel S6 entegrasyonu ve JS v1 katılığı PASS. Canlı sunucuya kurulmadı/doğrulanmadı.**

## Yetki ve çalışma sınırı

Bu belge önceki paralel Studio/site devir eşiğinin yerine geçer. Kullanıcı
birleşik oturumda mevcut S6 değişikliklerini incelemeyi, sandbox dışında yerel
testleri tamamlamayı ve sonuçları belgelemeyi açıkça yetkilendirdi. PHP endpoint
ve iki ortak tüketici kopyası bu kapsamda denetlendi. Ana depo ve
`channels/birdesengor/web` alt deposunun mevcut değişiklikleri korundu;
`web` ana depoda henüz untracked dizindir, ayrı Git deposu değildir.

Deploy, canlı PHP'ye POST, commit/push/stash/reset/clean/checkout yapılmadı.
Önceden var olan untracked dosyalar silinmedi. P7.5 parşömen/divit/masa/mum,
sahne, kamera ve efekt bileşenleri değiştirilmedi. Başka projeler ve diğer
oturumların süreçleri/OpenCode sunucusu yönetilmedi. Testlerin kendi geçici
PHP sunucuları ve geçici dosyaları test sonunda kapatılıp kaldırıldı.

## Tamamlanan entegrasyon ve kaynaklar

- `channels/birdesengor/web/public/api/studio/bootstrap.php`: tek, en fazla
  16 MiB + 1 byte okuma; aynı JSON'dan eski associative ve tip koruyan
  `stdClass` çözümleme. Auth ve yöntem kapıları body okumadan önce kalır.
- `index.php` → `publication_validate` → `publication_validate_vefk` →
  `publication_write` → asset temizliği: S6 hatası yazma/temizlikten önce
  **422 / invalid_vefk_publication** olur. Mevcut asset ve fiziksel yerleşim
  kontrolleri korunur.
- `publication-vefk.php` yalnız sabit yerel `vefk-s6-php-gate.php` dosyasını
  yükler; sunucu paketi depo `docs/` dizinine bağımlı değildir.
- `publication.php`: Vefk yayını, doğrulanan typed nesneden yazılır;
  `{}` ve `[]` korunur. Vefksiz yayının mevcut davranışı sürer.
- `docs/contracts/vefk-s6-php-gate.php` ile site kopyası byte-byte aynı.
  Son incelemede `M L 0 L 1 1` yolunu PHP'nin harfi sıfıra cast ederek kabul
  ettiği kanıtlandı; x/y tokenlarına `is_numeric` kontrolü eklenerek iki
  kopyada düzeltildi. Tam hash'li iki regresyon S1/JS/PHP/HTTP'de ret verir.
- `docs/contracts/vefk-site-consumer.mjs` ile
  `channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs` byte-byte aynı;
  v1 bilinmeyen stroke `easing`, fazla alan, hatalı kimlik/zamanlama ve v2
  belge fail-closed reddedilir. S4 motion schema v2 uygulanmadı.
- `apps/studio/vefk-s6-fixtures.cjs`, `vefk-s6-endpoint.test.cjs`,
  `vefk-s6-endpoint-harness.php`, `vefk-s6-php-runner.cjs`,
  `vefk-s6-consumer-schema.test.mjs`, `vefk-s6-php-gate.test.cjs` tekrarlanabilir
  kanıt kaynaklarıdır. Önceki audit senaryoları yeniden tasarlanmadı.

## Kesin doğrulama raporu

Ortam: Node **v26.12.1**, PHP CLI/built-in HTTP **8.5.12**;
`PDO`, `pdo_sqlite`, `mbstring` mevcut. Sandbox kısıtı olmadan çalıştırıldı.

| Kontrol | Sonuç |
| --- | --- |
| Endpoint + tüketici şeması, iki dosya | **46/46 PASS** |
| Tüm Studio Vefk testleri, 24 dosya | Son toplu koşu sonucu sunucu kabul raporunda |
| PHP referans kapısı | **33/33 PASS** |
| Gerçek yerel PHP + kanonik JS boundary audit | **11/11 PASS**, `S6_ACCEPTANCE_PASS`, exit 0 |
| v1 bilinmeyen easing şema audit'i | **PASS**, `S6_SITE_SCHEMA_STRICTNESS_PASS`, exit 0 |
| `verify-publication-v2.cjs` | **PASS** |
| Studio TypeScript/Vite build | **PASS** |
| V2 site Node testleri | **146/146 PASS** |
| V2 site Vite build | **PASS** |
| PHP taşıyan web TypeScript/Vite build | **PASS**; Babylon chunk boyutu uyarısı var |
| PHP lint | **9/9 dosya PASS** |
| Kaynak/build PHP eşitliği ve 644 izinleri | **5/5 PASS**, gate ayrıca referansla aynı |
| Ana depo ve web alt deposu `git diff --check` | **PASS** |

Alt kümeler toplu Vefk test sayısının içindedir; sayılar birbirine eklenmez.

HTTP kanıtı gerçek `php -S 127.0.0.1:<geçici-port>` üzerinde, kopyalanmış
`site/api/studio`, atılabilir SQLite kullanıcıları ve geçici content/assets
ile alınır. Dört HTTP testi toplam 51 uygulama isteği ve dört health isteği
çalıştırır: geçerli yayın ve hash'li geri okuma, tüm 31 tam hash'li şema
saldırısı, önceki kabul edilmiş yayını/credits/assets/DB byte/hash/mtime/mode
koruma, 401/403/404/405/400/409/413/422, legacy akış, tam 16 MiB kabul ve
16 MiB + 1 byte sized/chunked ret. `{}`→`[]` hash bozulması reddedilir;
yeniden hash'lenen geçerli liste de liste olarak saklanır. CLI taşıyıcı
ayrıca sahte Content-Length ve body okuma adedini denetler; bu iki durum
gerçek ağ protokolü kanıtı diye sunulmaz.

## Tekrar çalıştırma

```bash
node --test --test-isolation=none apps/studio/vefk-s6-endpoint.test.cjs apps/studio/vefk-s6-consumer-schema.test.mjs
node apps/studio/vefk-s6-boundary-audit.mjs
node apps/studio/vefk-s6-consumer-schema-audit.mjs
rg --files apps/studio | rg '(^|/)vefk.*\.test\.(cjs|mjs)$' | sort | xargs node --test --test-isolation=none
node apps/studio/verify-publication-v2.cjs
npm run build --workspace @channel-foundry/studio
npm --prefix channels/birdesengor/web test
npm --prefix channels/birdesengor/web run build
npm --prefix channels/birdesengor/web run build
```

Boundary audit mevcut yerel export'u yalnız okur; endpoint testleri yeni
sentetik 3×3 veri üretir. Eski 5×5 demoya özel migration/fallback yok.
`vefk-s6-php-runner.cjs` stdin EOF sorununa karşı yalnız geçici input dosyası
kullanır; HTTP testleri gerçek SAPI `php://input` yolunu kullanır.

## Sonraki iş sırası ve açık sınır

Yerel S6 açısından bilinen entegrasyon blocker'ı kalmadı. **Canlı PHP'nin
kurulu sürümü, hosting SAPI/izinleri ve canlı kabul davranışı bu oturumda
test edilmedi**; yerel PASS deploy veya üretim kabulü değildir. Yerel HTTP
sunucusunda `post_max_size=32M` seçildi ki uygulamanın kendi 16 MiB sınırı
test edilsin. Tarayıcı fiziksel/görsel E2E bu oturumda yeniden çalıştırılmadı.

1. `channels/birdesengor/web/docs/VISUAL_ASSETS_P7.md` içindeki **P7.5**:
   aynı tek parşömen ve divitin özgün malzeme/ışık/perspektif varlıkları.
   Mevcut DOM kimlikleri, hitbox'lar, `parchment.ink-plane`, `quill.tip`,
   `frameAt`, `penDown` ve mürekkep eşlemesi korunacak.
2. Yeni sentetik 3×3 ve çoklu M/L/Z manuel vefkle gerçek browser E2E:
   play/pause/seek/restart, pen-up sırasında sabit mürekkep, tek DOM nesnesi,
   reduced-motion ve masaüstü/mobil kadrajlar. Ardından görsel kabul.
3. S4 motion schema v2 ayrı gelecek iştir; yalnız
   `docs/contracts/VEFK_STROKE_MOTION_V2_PROPOSAL.md` tasarısı vardır. Studio,
   JS ve PHP birlikte sürüm kabulü olmadan v1'e easing yazılmayacak.
4. Canlı kurulum ve hosting kabulü, ayrıca yetkilendirilecek ayrı aşamadır.

Ayrıntılı güncel kabul kaydı: `docs/VEFK_S6_SERVER_ACCEPTANCE.md`;
master planın 34. bölümündeki birleşik oturum kapanış eki.

## P7.5 tek oturum birleşik kapanışı — 2026-11-04

**Son durum:** Eski rulo/parşömen yerine `vefk-stand` tek kalıcı fiziksel aygıt. Tek kalıcı `quill`, `vefk-stand.ink-plane` yüzeyi, `quill.tip` ucu. Sabit yüzey; kamera zoom/return; gerçek mekanik kol, zaman oluğu, mühür nişleri, tahribatsız `seek(0)` temizleme taşı. Kayıt/SQL/SVG salt okunur kalır. Eski 5×5 örneğe compat veya migrasyon yok; eski binding kasıtlı reddedilir.

**Kanıtlar:** `npm test` V2 **150/150**, `npm run build` **PASS**; Studio geniş Vefk **218/218 PASS**; PHP site S6 boundary **PASS**, schema strictness **PASS**; PHP ve JS sözleşme kopyaları eşit, PHP lint ve `git diff --check` PASS. **Tam `npm run test:e2e` PASS**: kitap/kamera/forum/mum/tütsü ve Vefk bütünleşik Chromium senaryoları, ayrıca P7.5 özel dört senaryo (üç ekran + azaltılmış hareket) PASS. Mobil çizim alanı >220px test kuralı korundu; aygıt mobil gerçek yüksekliği 234px alt sınırıyla artırıldı. Nib-to-ink sapması 1920:0,001px,1366:0,675px,390:0,001px; canlı çizim <0,003px. Görseller `channels/birdesengor/web/artifacts/p75/` altında.

**Sıradaki ayrım:** P7.5 işlevsel/yerleşim kabulü tamam; fotogerçekçi ahşap/pirinç/parşömen dokuları ve gerçek cihazda görsel kalite kullanıcı incelemesi ayrı sanat turu. S4 kalıcı stroke easing v2 ayrı iki-uçlu sözleşme geliştirmesi. Gerçek hosting/deploy kapsam dışı; commit/push/deploy yapılmadı. Önceki handoff bölümünde parşömen/rulo yazan adımlar artık **tarihsel ve geçersizdir**.

## P7.5b malzeme turu — 2026-11-04 · doğrulanmış ara nokta

Yalnız V2 cihaz malzemesi: altı özgün deterministik WebP (ceviz uzun lif,
ceviz önlük, eskitilmiş dövme pirinç, sabit lifli parşömen, metal oluk,
reset taşı), üretici `scripts/generate-p75-stand-assets.py`, scoped
`src/vefk/stand-materials.css`, component'te yalnız bu CSS'in import'u.
Divit, kamera, manifest, ölçüler, kanonik oynatıcı/SVG, Studio ve PHP
uygulamaları değişmedi. 16 nesne/21 anchor, tek aygıt/divit, üç ayrık ayak,
dört köşelik ve mevcut native kontroller bağımsız tarayıcı testinde korunur.

**Geçenler:** V2 Node **155/155**, Vite build; Studio Vefk **218/218** ve
doğrudan subprocess exit **0**. Normal/reduced-motion × 1920/1366/390
malzeme/touch/klavye/hit-test/close→room capture **6/6**; 18 PNG ve JSON
`channels/birdesengor/web/artifacts/p75b/`. Üç boyutta oda/odak görselleri
incelendi; düzenli kâğıt ızgarası ve plastik parlaklık azalıyor. Prosedürel
ton bulutları/malzeme rölyefi hâlâ sınırlı; fotoğraf veya AI fotoğrafı değil,
**fotogerçekçilik onaylanmadı**.

**Açık doğrulama:** Tam `npm run test:e2e` içindeki ana `tests/e2e.mjs`
**PASS**, ardından değişmemiş P7.5 testi mobil canlı örnekte kısmi stroke
bulamayarak durdu (`:124`). Tek başına tekrar mobil uç/zoom ölçümlerinden
sonra kapanışın kısa `returning` fazını beklerken timeout verdi (`:153`).
Kesin neden izole edilmedi; **tam E2E PASS veya P7.5b tam kabulü denemez**.
Eski `artifacts/p75/metrics.json` başarısız testlerde yazılmadığından bu
turun yeni sayısal kanıtı değildir. Eşikler ve eski testler değiştirilmedi.

**Kalan:** Bu iki mobil gözlemi izole etmek; gerekiyorsa yalnız izinli
malzeme CSS/asset maliyetini düzeltmek ve tam E2E'yi exit 0 ile tamamlamak.
Tek kontrollü tur uzadığı için güvenli ara noktada bırakıldı. Ayrıntılı
varlık tablosu, sınırlar ve loglar
[P7 görsel varlık dokümanında](../channels/birdesengor/web/docs/VISUAL_ASSETS_P7.md).
Başlangıçtaki Git durumu korunur, başka oturum dosyası silinmedi; 5208
sunucusuna müdahale, Git yazma işlemi veya canlı deploy yapılmadı.


## S4b son durum ve tekrar çalıştırma (2026-11-04)

İzinli kaynak değişiklikleri: `vefk-publication.cjs`, `vefk-store.cjs`, iki JS
consumer, iki PHP gate; S4/S6 testleri/fixture'ları ve P7.5d açık SHA istisna
listesi. Dört devir/sözleşme belgesi güncellendi. Core, player frameAt, sahne,
renderer, kamera, VefkWorkshop UI, Efekt Atölyesi, global CSS ve Android değişmedi.
Kopya çiftleri byte-eşit. Doc1/catalog1 export byte sabitleri ve frozen v1
hash/kareler PASS; catalog2 mixed doc1/doc2 ve kesin binding3 motion kabulü PASS.

Son sonuçlar: **283/283 Studio Vefk**, **164/164 V2 Node**, skip 0; Studio/V2
build exit 0. S6 doc1/karma doc2/manualPaths audit'leri **11/11**; strict v1
audit PASS. Gerçek loopback PHP HTTP doc2/karma/manualPaths kabulü 200, bozuk
sürüm/easing/binding/hash/boyut ve yetkisiz rol 4xx; ret halinde publication,
assets, credits, DB byte/hash/mtime/mode korunur. Mevcut değişmemiş P7.5 browser
**4/4 PASS**, nib üstü 0,456px. Bu doc1 regresyonudur; **doc2 gerçek sahne
16:9/4:3 görsel E2E ve S4c kalıcı easing UI henüz yapılmadı**.

Loglar: `/tmp/vefk-s4b-7ivdbpht/`; `studio-vefk-tests-final.log`, `site-tests.log`,
`site-build.log`, `studio-build.log`, `p75-browser.log`, `audit-v1.log`,
`audit-v2.log`, `audit-manual-v2.log`, `schema-audit.log`, `scope-check.json`.
İlk hedef turda yalnız iki test kurulum hatası vardı; düzeltme sonrası son tur
geçti. Build/site/browser testleri aynı dizinin `verification/` repo kopyasında,
gerçek web node_modules symlink'i ve web/.git işaretleyicisiyle çalışır:

```bash
export BIRDESENGOR_CANONICAL_EFFECTS_ROOT="$HOME/YardimciWorkspace/EfektAtolyesi/src"
mapfile -t tests < <(rg --files apps/studio | rg '(^|/)vefk.*\.test\.(cjs|mjs)$' | sort)
node --test --test-isolation=none "${tests[@]}"
npm --prefix channels/birdesengor/web test
npm --prefix channels/birdesengor/web run build
npm run build --workspace @channel-foundry/studio
npm --prefix channels/birdesengor/web run test:e2e:p75
node apps/studio/vefk-s6-boundary-audit.mjs /tmp/vefk-s4b-7ivdbpht/audit-v2.json
node apps/studio/vefk-s6-consumer-schema-audit.mjs
```

Testler yalnız atılabilir veriler üretir. Gerçek `.local-data`, DB, export ve
demo 5×5 korunur; mevcut Vite/OpenCode ayaktadır. Git yazma, migration,
production host, canlı POST veya deploy yok. Sonraki iş S4c UI/doc2 görsel E2E;
canlı kurulum ayrıca ele alınmalıdır.

## S4c2a son kabul — 2026-11-04 (önceki S4c2 FAIL notlarını günceller)

**Yerel v2 sahne kabulü PASS.** DOC2 karışık katalog/Studio onaylı paket senaryosu gerçek Chromium'da 1920×1080, 1366×768, 390×844 ve reduced-motion için **4/4 PASS**. Mürekkep ve divit aynı kanonik `frameAt` zamanıyla çalışıyor; kayıtlardaki en yüksek durdurulmuş uç sapması **0,822px** (<1px). V1 P7.5 sahne regresyonu **4/4 PASS**.

Önceki gerçek görsel hata giderildi: tek SVG yolunda birden çok `M` alt-yolu varken global stroke dash'in her alt-yolda yeniden başlaması nedeniyle gelecekteki çizgi erken boyanıyordu (18/27/18 piksel). `web/src/vefk/geometry.js` kaynak mürekkep uzunluğunu alt-yollara bölüyor, `VefkStand.jsx` her alt-yolu kendi kesik çizgi ilerlemesiyle görünür kılıyor; kanonik geometri/ölçüm path'i ve veri sözleşmesi korunuyor. Aynı piksel testinde **erken mürekkep 0/0/0 piksel**, geometri testleri **9/9 PASS**.

**Son tamamlayıcı denetim:** P7.5d'nin tarihsel SHA kilidi yeni kodun üç açık ve test edilen dosyasını (`VefkStand.jsx`, `geometry.js`, `tests/vefkGeometry.test.mjs`) izinli S4c2a kapsamına aldı; bunun dışındaki kaynak hash koruması devam ediyor. `npm test` **169/169 PASS** (skip 0), `npm run build` PASS, dokunulmayan PHP ve JS kanonik tüketici çiftleri birebir eşit, `git diff --check` PASS. Önceki **168/169** ve **18/27/18** kayıtları artık tarihsel bulgulardır, güncel engel değildir.

Kanıtlar `channels/birdesengor/web/artifacts/s4c2/`: `s4c2a-results.json`, `metrics.json`, `s4c2a-doc2-browser.log`, `s4c2a-p75-browser.log`, `s4c2a-site-tests-final.log`, geometri ve derleme logları, ekran görüntüleri. Aktif kullanıcı verileri / gerçek Studio yayın dosyaları / canlı hosting veya Electron üzerinde sınama yok. Git commit/push veya deploy yapılmadı. Sonraki iş S4c'nin Studio–yayın–sahne bütünsel uçtan uca tekrarının raporlanması ve kalan arayüz/gerçek cihaz kabulü.


## 2026-11-04 — V1 site tasarımının kaldırılması, tek kanonik web

BirDeSenGör'ün aktif web kaynağı artık yalnız **channels/birdesengor/web/**. Daha önce ayrı geliştirilmiş V2 fiziksel sahne (tek Grabfold kitap, kamera, topluluk defteri, VefkStand/divit, S4 v2 stroke motion) bu konuma taşındı. **web-v2/** dizini kaldırıldı; V1 Babylon/React tasarımı, V1 CSS/scene görselleri, obsolete test/derleme/deploy betikleri mevcut çalışma kopyasından çıkarıldı. Tarihsel Git commit'leri silinmedi.

**Korunan API:** web/public/api/community, api/studio (S6 PHP v1/v2 gate ve yönetici/asset/publication), api/youtube; web/public/index.php PHP önizleme kapısı ve .htaccess. apps/web sembolik bağlantısı bu tek web köküne gider. web/.git altmodül kimliği ve project.json korundu. V1 arayüzüne fallback, ikinci React uygulaması veya paralel eski sahne motoru yok. Studio ile site tüketicisinin PHP/JS kanonik kopyaları aynı; publication/document schemaVersion ve vefk-stand/quill binding kontratları yeniden adlandırılmadı.

Root npm dev:web/build:web/verify:web ve Studio kanal komutları aynı kökü çalıştırır; tarihsel V1 kitap-tema/Natro verify/deploy araçları kaldırıldı. Release doğrulaması V2'nin Node/build/Chromium suite'ine yönlendirildi. Yeni V2 canlı dağıtımı henüz ele alınmadı; eski Natro dağıtım betiği bilerek taşınmadı. **Git commit/push ve canlı deploy yapılmadı.** Yeni tek-kök regresyonu web/tests/single-web-retirement.test.mjs, P7.5d SHA kilidi (yalnız taşınmış kaynakların sınırlı yeniden tabanlanması), Studio/PHP entegrasyon testleriyle doğrulanır. Son tarayıcı E2E sonucu ayrı doğrulama günlüğündedir.
