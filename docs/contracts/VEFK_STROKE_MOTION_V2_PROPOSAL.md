> **6 Kasım 2026 güncel sahne:** Fiziksel şövale entegrasyonu aynı kanonik DOC1/DOC2 sözleşmesini kullanır. Mürekkep/divit ortak SVG dönüşümüne bağlandı; alt yol düzeltmesi korundu. Güncel devir [VEFK_SITE_HANDOFF.md](VEFK_SITE_HANDOFF.md), web kabulü `channels/birdesengor/web/docs/VEFK_ACCEPTANCE.md` belgesindedir. Aşağıdaki dilim raporları kendi tarihlerine ait geliştirme geçmişidir.

# BirDeSenGör Vefk — Çizgi İçi Hareket v2 Sözleşme Önerisi

Tarih: 2026-11-04 · Durum: **S4b yerel opt-in yayın doğrulandı; canlı deploy yok.**

> Güncel karar aşağıdaki **S4b** bölümüdür. Önceki tasarı ve S4a “publisher/PHP
> v1-only” ifadeleri tarihsel durumu anlatır. S4c kalıcı UI ve doc2 görsel
> tarayıcı E2E kabulü bu dilimde yapılmadı.

## Mevcut davranış

`birdesengor.vefk` schemaVersion **1** ve `vefk-catalog` schemaVersion **1** içindeki
`drawPlan.strokes`, yalnız `startMs`, `durationMs`, `pathId`, `ink`, `pen` ve
`id` taşır. `createVefkPlayer(document).frameAt(timeMs)` tek kare için
`visibility[]` ve `pen {position,penDown,phase,pathId,fraction}` verir.
Strokun içindeki hareket doğrusal zamana göre işler; kalem havadayken mürekkep
ilerlemez. Site, `frameAt(t)` sonucunu iki ayrı saatle değiştirmemelidir.

Studio'daki `Çizgi içi · Deney` dört seçeneği deneyebilir:
`linear`, `ease-in`, `ease-out`, `ease-in-out`.
`vefk-intrastroke-preview.ts` bu eğrileri yalnız geçici oynatma zamanı
örneklemesiyle uygular; `document` içine **yazmaz**. Bu modu kalıcı veri
saymak veya sitede otomatik kullanmak yasaktır.

## Çift taraflı v2 için önerilen model

Örnek biçim; henüz desteklenmiyor:

```json
{
  "format": "birdesengor.vefk",
  "schemaVersion": 2,
  "drawPlan": {
    "strokes": [
      {
        "id": "stroke.001",
        "pathId": "mark.001",
        "startMs": 0,
        "durationMs": 800,
        "ink": "glyph",
        "pen": "down",
        "easing": "ease-in-out"
      }
    ]
  }
}
```

Diğer bütün gerekli alanlar v1 ile aynı kalır. Strok bazında `easing`
yalnız v2 belgelerde kabul edilir, değerleri kesin enumerasyonla sınırlandırılır.
Belirtilmemişse `linear` kabul edilir; bilinmeyen değer sessizce doğrusala
düşürülmez. v2 belgeler yayımlanırken `vefkCatalog.schemaVersion = 2` ve
gerekli oynatma yeteneğini ilan eden bağlantı sürümü birlikte artırılır;
**eski v1 tüketici bilinmeyen paketi açıkça reddeder**, yanlış hızda göstermez.

Yükseltilmiş yeni oynatıcı:
- V1 belgeyi kesinlikle aynı piksellere/zamanlara bağlar.
- V2 tek stroku `u=(t-startMs)/durationMs` ve `p=ease(u)` ile örnekler;
  kalem konumu, mürekkep görünürlüğü ve `penDown` **aynı eğrilmiş konumdan** gelir.
- Çoklu `M` alt yollarında havadaki geçişler de aynı strokun süresi içinde
  kalır; `phase=travel` süresince görünür mürekkep sabit kalır.
- Stroke arası boşluklar, toplam süre ve sondaki `hold` değişmez.
- Pause/seek/tekrar oynatma/reduced-motion için `frameAt(t)` deterministiktir;
  araya ikinci CSS geçişi eklenmez.
- Belge `contentHash`, dosya `sha256`, katalog `fingerprint` ve
  üst `publication.contentFingerprint` yeni şemaya göre yeniden hesaplanır.
- İmzalı yayın yetkisi SHA-256'dan ayrı, mevcut sunucu yönetici oturumu tarafından
  sağlanır; yalnız hash güvenlik doğrulaması değildir.

## Uygulama sırası ve dosya sahipliği

1. Studio S1 model ve doğrulayıcı v2'yi üretir, fakat varsayılan üretim ve
   mevcut onaylı v1 kayıtlar v1 olarak kalır.
2. Ortak `docs/contracts/vefk-site-consumer.mjs` için testler hazırlanır;
   site oturumu kendi tüketici kopyasını **bilinçli ve atomik** günceller.
3. PHP yayın kabul kapısı v1 ve v2'yi doğrulayacak biçimde yükseltilir;
   şu an referans `docs/contracts/vefk-s6-php-gate.php` yalnız v1'dir.
4. Studio yayınlama için site ve sunucu v2 yeteneğini doğrulamadan v2
   belgesi seçmeye izin vermez. Sessiz uyumluluk katmanı veya v1'e geri
   yazma yapılmaz.
5. Yeni v2 deney vefki, 16:9 ve 4:3 yerleşimlerde gerçek parşömen/divit
   E2E ve kullanıcı onayı sonrası yayınlanabilir.

## Kabul testleri

- V1 mevcut kanonik testleri kare/kare değişmez.
- V2 bilinmeyen easing, bozuk SHA ve yanlış scene anchor ile fail-closed.
- Easing fonksiyonları 0 ve 1'de sabit, tekdüze ve sonlu; her strok
  `endMs` sınırında eksiksiz tamamlanır.
- Pen-up seyahatinde yeni mürekkep oluşmaz; tüm ara seek ve ters seek
  deterministik olur.
- Tek kopya site tüketicisi ve Studio kanonik tüketicisi aynı hash/sürümde olur.
- Site `transitionMs=0` ilkesiyle ikinci 110 ms gecikme eklemez.
- S6 HTTP sunucu kabulü testinde v2'yi bilmeyen sürüm 4xx ile reddeder.
- Paralel V2 sahne dosyaları ve Efekt Atölyesi oturumun onayı olmadan değiştirilmez.

Bu belge yalnız tasarıdır; v1 yayın sözleşmesi, canlı yayın, Git geçmişi ve
paralel site dosyaları bu Studio oturumunda değiştirilmeyecek.

## Açık şema uyumsuzluğu: v1 tüketici fazladan alanı kabul ediyor

2026-11-04 salt-okunur denetimi:
`apps/studio/vefk-s6-consumer-schema-audit.mjs` sıfırdan 3×3 vefk
oluşturur; bir strokun içine v1'de bulunmayan `easing: "ease-in"` ekler,
`contentHash`, belge `sha256`, katalog ve üst yayın fingerprint'lerini
tutarlı şekilde yeniler. S1 `validateVefk` ve bağımsız PHP referans
kapısı **reddeder**; mevcut site JS `readVefkPublication` ise
`schemaVersion:1` ile **ready** kabul eder. Sorun hash değil,
V1 `stroke` alan kümesinin JS tüketicide izin listesiyle
kontrol edilmemesidir.

Bu yüzden yukarıdaki yeni v2 geçişi yalnız site oturumunun ortak onayıyla
uygulanmalı; **ön koşul** eski tüketicide v1 alanlarının fail-closed
doğrulanmasıdır. Güncel site kopyasına bu Studio oturumunda müdahale edilmedi.

## S4a — kanonik model / oynatıcı adayı, kısmi uygulama (2026-11-04)

Bu kayıt yukarıdaki tarihsel “henüz desteklenmiyor” durumunu yalnız model ve
oynatıcı için günceller. **V2 yayın tamamlanmadı; S4b kapalıdır.**

- `createVefk({schemaVersion:2,...})` açık opt-in ile değişmez doc2 üretir.
  Varsayılan ve `SCHEMA_VERSION` hâlâ 1'dir; mevcut doc1 yeniden yazılmaz.
- Yalnız doc2 stroke alan kümesine isteğe bağlı `easing` eklenir. İzinli
  değerler `linear`, `ease-in`, `ease-out`, `ease-in-out`; alan yoksa linear.
  Alan mevcutsa `null`, `undefined`, sayı, dizi ve bilinmeyen metin reddedilir.
  Doc1 aynı alanı, değeri linear olsa bile, reddeder. Diğer alan kümeleri korunur.
- `drawPlanFor(geometry,settings,schemaVersion=1)` ve
  `validateDrawPlan(plan,geometry,schemaVersion=1)` mevcut çağrılarda doc1
  kalır. Doc2 otomatik planı açık `easing:"linear"` üretir; açık bir plandaki
  eksik easing normalize edilerek eklenmez. SHA-256 kanonik anlamı korur;
  easing değişikliği hash'i değiştirir, eski hash reddedilir.
- `serializeVefk(doc)` yalnız doc1 serileştirir. Doc2 aday JSON'u için açık
  `serializeVefk(doc,2)` gerekir; dönüşüm veya sürüm düşürme yapılmaz.
  Böylece **değiştirilmemiş** Studio storage/publisher çağrıları doc2 kaydetme,
  katalog doğrulama, build ve export işlemlerini reddeder. S4b bu çağrıların
  her birini site/PHP yeteneğiyle birlikte ayrıca değerlendirmelidir.
- Referans ve site tüketicisi aynı byte'larla güncellendi. Doğrudan
  `createVefkPlayer(doc2)` şemaya göre stroke alanlarını doğrular; kanonik doc2
  bütünlüğü core `validateVefk` ile doğrulanmış adaydan oynatılabilir.
  `readVefkPublication` ise catalog1/binding2 içinde **yalnız doc1** kabul eder;
  geçerli hash'li doc2 veya catalog2 kabul edilmez.
- V2 aktif stroke için `u=(t-startMs)/durationMs` üzerinden bir kez
  `f(u)` hesaplar: linear `u`, ease-in `u*u`, ease-out `u*(2-u)`,
  ease-in-out `u*u*(3-2*u)`. Mürekkep, kalem konumu ve penDown/travel aynı
  segment örneklemesinden gelir. Çoklu M ve Z→M seyahatinde mürekkep sabittir.
  Gap/hold/marker/süre ve v1 kayan nokta işlemleri korunur; CSS geçişi eklenmedi.
  `progressAt(plan,t,2)` stroke ilerlemesidir; çoklu alt-yollardaki gerçek
  mürekkep görünürlüğü ve divit için tek kaynak `frameAt(t)` olmaya devam eder.

### S4a doğrulama ve durma noktası

Kaynak/testler ve build'ler aktif DB/demo export'u korumak için geçici repo
kopyasında çalıştırıldı; doğrudan hedef testler de geçici/in-memory fixture
kullanır. Tam Studio Vefk komutu güvenli Bash dizisiyle
`apps/studio/vefk*.test.*`, core testi ve `src/vefk*.test.mjs` dosyalarını seçti:
**235/235 PASS**, skip 0; Studio workspace build **PASS**.

Yeni testler: sıfırdan 3×3 ve manualPaths çoklu M/Z; değişiklikten önce alınmış
iki doc1 contentHash/JSON SHA/kare dizisi SHA referansı ve kesirli seyahat
koordinatları; doc2 linear/eksik easing eşitliği; dört eğrinin Studio deney
matematiğiyle eşleşmesi; stroke başına ayrı eğri; pen-up mürekkep sabitliği;
kesin başlangıç/son, gap/hold/marker, ileri/geri seek, pause ve reduced son-kare
modeli; unknown key/easing/version ve doc1 injection reddi. Ortak saldırı
fixture'ında artık bilinmeyen sürüm 3 kullanılır; geçerli doc2'nin **yayın
reddi** ayrı S4a testlerindedir. JS kopyaları byte-eşit. Gerçek değişmemiş PHP
handler, geçici depoda tam yeniden hash'lenmiş doc2/catalog2 isteklerine
**422 / invalid_vefk_publication** döndürdü; depolama byte'ları değişmedi.

V2 `npm test`: **158 PASS / 2 FAIL**, skip 0. Kesin hatalar:
1. `tests/effectsAdapter.test.mjs`: geçici kopyanın kardeş dizininde
   `YardimciWorkspace/EfektAtolyesi/src/model/project.mjs` yok;
   `ERR_MODULE_NOT_FOUND`.
2. `tests/p75d-light-unity.test.mjs:64`: P7.5d tarihsel koruma SHA testi,
   izinli değişen `apps/studio/vefk-s6-fixtures.cjs` için eski SHA bekliyor
   (`ce8d41d2…` yerine `a9988419…`). Test/baseline değiştirilmedi.

V2 `npm run build`: aynı eksik harici EfektAtolyesi kaynağı nedeniyle
`Canonical EfektAtolyesi source is missing` ile **FAIL**. Hata sınırı gereği
tekrar denenmedi veya kapsam dışı düzeltme yapılmadı. Başlamış bağımsız
kontrollerin sonuçları toplandı. Loglar ve öncesi manifesti:
`/tmp/vefk-s4a-4j8jiw5a/` (`studio-vefk-tests.log`, `studio-build.log`,
`site-tests.log`, `site-build.log`, `scope-check.json`).

Bu dilim görsel E2E veya v2 yayın kabulü değildir. Publisher/PHP gate, sahne,
API, manifest, malzeme/CSS, aktif DB ve yayınlanmış veri değiştirilmedi;
commit/push/deploy yapılmadı.


### S4a düzeltici doğrulama eki — 2026-11-04

Önceki S4a kapanışında geçici test kopyasında raporlanan V2 `158 PASS / 2 FAIL` ve derleme hatası artık **tarihsel ilk deneme sonucudur**. Etki eden üretim kodu değiştirilmeden test ortamı tamamlandı: `BIRDESENGOR_CANONICAL_EFFECTS_ROOT` gerçek Efekt Atölyesi kaynağına yöneltildi; geçici kopyaya mevcut `grabfold` bağımlılığı ve web altmodül `.git` işaretleyicisi bağlandı. `p75d-light-unity.test.mjs` tarihsel malzeme SHA korumasına yalnız S4a tarafından bilerek değiştirilen, ayrı v1 frozen-hash ve frame testleriyle korunan hareket kaynaklarının açık listesi eklendi; diğer kaynakların SHA denetimi korunuyor. S4a kapsamı dışındaki sahne/asset/efekt/PHP dosyaları değiştirilmedi.

**Son test:** `npm test` V2 **164/164 PASS** (skip 0); `npm run build` **PASS**. İkisi de `/tmp/vefk-s4a-4j8jiw5a/verification/channels/birdesengor/web` geçici kopyasında, kaynağa dokunmadan çalıştı. Çıktılar `/tmp/vefk-s4a-4j8jiw5a/site-tests-final.log` ve `site-build-final.log`. Orijinal S4a testleri **235/235 Studio**, Studio build PASS, v2 yayın PHP 422 ret, v1 kimlik/hash/kare eşitliği PASS kalır. Bu **v2 canlı yayın kabulü değildir**; Studio publisher ve PHP gate hâlâ v1-only. Git commit/push/deploy yoktur.


## S4b — sürümlü yerel yayın kabulü (2026-11-04)

Dört uç birlikte güncellendi: Studio publisher/store, kanonik JS reader,
web JS kopyası ve PHP referans/site gate. JS çiftleri ve PHP çiftleri ayrı
ayrı byte-eşittir. S4a `frameAt` ve core kaynakları değiştirilmedi.

| Katalog | Kesin binding | İzinli belgeler |
| --- | --- | --- |
| `schemaVersion:1` | `bindingVersion:2`, eski alan kümesi; motion yok | yalnız doc1 |
| `schemaVersion:2` | `bindingVersion:3`, ayrıca `motion:{strokeEasing:"v2"}` | doc1 ve doc2; karma katalog kabul edilir |

`motion` alanı **binding içindedir**. Her iki binding'de sceneId
`birdesengor-study-v2`, surface `vefk-stand/vefk-stand.ink-plane`, pen
`quill/quill.tip`, coordinateSpace `svg-viewBox`, fit `contain` aynıdır.
Eksik/fazla/bilinmeyen motion alanı, farklı sürüm veya eski anchor reddedilir;
sessiz yükseltme, alias veya geriye dönüştürme yoktur. Publication şeması 2 kalır.

Studio yalnız **seçilmiş onaylı immutable revizyonlar arasında açık doc2 varsa**
catalog2 üretir. Yeni doc2 taslağı veya seçilmemiş onaylı revizyon, eski doc1
seçimini ve publication fingerprint'ini değiştirmez. Eski revizyon yeniden
seçilirse aynı catalog1 byte'ları/fingerprint'i geri gelir. Store, explicit
`createVefk({schemaVersion:2,...})` belgesini mevcut save/review/select iş akışıyla
saklar; optimistic hash ve onaylı revizyon değişmezliği korunur. UI değişmedi.
`serializeVefk(doc)` hâlâ doc1 varsayılanıdır; incelenen store/publisher/export
çağrıları doğrulanmış belgenin kendi sürümünü açık ikinci argüman olarak geçirir.

Doc2 için dört enum ve eksik-easing=linear kuralı S4a ile aynıdır; doc1'de
`easing:"linear"` dahi yasaktır. Belge contentHash, kanonik dosya SHA-256 ve
SHA16 dosya adı, katalog fingerprint'i ve üst publication contentFingerprint
birlikte hesaplanır. JS reader'a da 5 MiB katalog sınırı eklendi. Tüm uçlarda
32 girdi/5 MiB, kesin binding ve katalog sürümü eşlemesi korunur.

PHP gate typed `stdClass`/list ayrımını korur. Auth, rol ve yöntem kapıları,
tek body okuma, 16 MiB sınırı ve mevcut asset/layout kapıları değiştirilmedi.
Geçersiz istekler 4xx ile publication/asset/credits/DB yazma veya temizleme
öncesinde durur. Yalnız geçici loopback sunucusunda geçerli doc2, karma katalog,
manualPaths çoklu M/Z ve `{}`/`[]` tipleriyle **200** kabulü kanıtlandı.
Canlı POST veya kurulum yapılmadı.

### S4b doğrulama

- Tüm Studio Vefk kök/core/src testleri: **283/283 PASS**, skip 0, exit 0.
  Yeni S4b test dosyası, eski S4a frozen v1 hash/kare testleriyle birlikte çalışır.
- Önceki S4a kaynak kopyasından alınan doc1 contentHash, dosya SHA, catalog1
  fingerprint ve katalog dosyası SHA sabitleri birebir eşleşir. S4a v1 kare
  dizisi SHA ve kesirli seyahat koordinatları değişmez.
- Taze 3×3 ve manualPaths çoklu M/Z, dört eğri/eksik easing, karma katalog,
  açık immutable revizyon seçimi ve geçici export PASS. Tam 32 girdi kabul,
  33. seçim ret; tek tek geçerli onaylı doc2'lerden oluşan >5 MiB build ret.
- Tam yeniden hash'lenmiş bozuk easing/sürüm/binding/motion/typed list saldırıları
  Studio/iki JS/PHP tarafından reddedilir. Gerçek loopback HTTP bunları ve rol,
  hash, katalog boyutu hatalarını depolama byte/hash/mtime/mode eşitliğiyle sınar.
- S6 audit: sentetik doc1, karma doc2 ve manualPaths doc2 için ayrı ayrı
  **11/11 PASS**, `S6_ACCEPTANCE_PASS`; v1 şema audit PASS.
- V2 `npm test`: **164/164 PASS**, skip 0; V2 build **PASS**;
  Studio workspace TypeScript/Vite build **PASS**. Her iki build exit 0.
- Değiştirilmemiş mevcut P7.5 Chromium testi **4/4 PASS**, exit 0:
  1920/1366/390 ve reduced motion; nib üstü 0,456px (<1px).
  Bu tarayıcı testi doc1 fixture kullanır; **doc2 görsel E2E kabulü değildir**.
- P7.5d tarihsel SHA baseline değiştirilmedi. Mevcut S4a istisnalarına yalnız
  S4b publisher/store, endpoint testi, iki PHP gate ve bu sözleşmenin site
  handoff belgesi için açık liste eklendi; diğer SHA korumaları sürer.

Kanıt dizini: `/tmp/vefk-s4b-7ivdbpht/`. Son toplu Studio logu
`studio-vefk-tests-final.log`; site test/build, Studio build, `p75-browser.log`,
üç `audit-*.log`, `schema-audit.log` ve kapsam manifesti aynı dizindedir.
Build/V2 test/browser geçici repo kopyasında, Studio testleri bellek DB ve
geçici dosyalarla çalıştı. İlk hedef turdaki iki test kurulum hatası (sıra
verilmemesi ve bozulan top hash'in testte onarılması) düzeltildi; nihai tur temiz.

**Kalan:** S4c kalıcı easing UI/editleme ve doc2'nin gerçek sahnede 16:9/4:3
play/pause/seek/pen-up/nib görsel E2E kabulü. Canlı sunucu sürümü/kurulum kabulü
ayrı aşamadır. Aktif `.local-data`, mevcut export, demo 5×5, sahne/renderer,
kamera, efekt, CSS, Android ve başka oturum kaynakları değiştirilmedi;
migration veya Git yazma/deploy işlemi yapılmadı. Mevcut Vite/OpenCode korundu.

## S4c1 — kalıcı Studio eğri düzenleme kabulü (2026-11-04)

**S4c1 PASS; S4c2 görsel kabulü bekliyor.** TS document.schemaVersion `1|2`,
create input.schemaVersion `?:1|2`, stroke.easing ise isteğe bağlı kesin
`linear|ease-in|ease-out|ease-in-out` union'ıdır. Runtime şema otoritesi mevcut
strict core'dur; core, store, publisher, site renderer ve PHP değiştirilmedi.

- Zaman çizelgesi yardımcıları sürümü açık alır (eski çağrılarda varsayılan 1).
  v1 çıktısına easing eklenmez; v1 enjeksiyonu sessizce atılmadan reddedilir.
  doc2 eğrileri pathId ile sıra/süre/gap/hold/geometri/tempo/denge boyunca
  korunur; yeni yollar linear olur. Eksik doc2 easing linear okunur; bu okuma
  kaynak belgeyi değiştirmez. Tek eğri setter'ı yalnız doc2 kabul eder.
- Yeni/Taslak opt-in'i tüm stroke'ları açık linear ile bridge üzerinden yeniden
  üretir; kimlik/revizyon aynı kalır, dirty/history oluşur. Kaydetme aynı
  `editorInput → vefkGenerate → vefkSaveDraft` akışında sürümü açık taşır,
  contentHash yeniden hesaplanır ve reload doc2'yi korur. Geometri uzlaştırması
  bridge'in yeni doc2 planını eski v1 planıyla ezmez.
- Checked/approved/published UI kontrolleri kilitlidir. Onaylı v1 önce mevcut
  yeni revizyon eylemiyle v1 taslak açar; kalıcı v2 ayrıca kullanıcı eylemi
  gerektirir. v2 revizyondan yeni revizyon üretmek v2 eğrilerini korur.
  Otomatik upgrade/downgrade yoktur; opt-in undo/yinele ile geri alınabilir.
- v1 deney seçimi «kaydedilmez» diye etiketlenir; kayıt girdisine girmez.
  doc2 her satırda native «Kalıcı çizgi içi eğri» seçer. doc2 önizlemesi bütün
  deney state'leri altında doğrudan ortak `createVefkPlayer(document)` kullanır;
  ayrı zaman warp'ı veya site doğrusal mesajı yoktur.

### S4c1 kanıt ve kapsam

Yeni `vefk-motion-editor.test.mjs` **11/11 PASS**: eski S4b modelinden önceden
alınan v1 satır/plan/tempo/denge/reconcile byte SHA'ları ve kayıt hash/JSON SHA;
magic/manual karede save byte eşitliği; açık linear opt-in; locked ret; doc2
edit/geometri/eksik-easing; core/store v1 injection ret; SQLite kayıt/review/
reload ve immutable onay; yeni revizyon; tüm deney state'lerinde kanonik doc2
kare eşitliği. Eski frozen v1 fingerprint/kare testleri de tam turda geçti.

Tam Studio Vefk kök/core/src **294/294 PASS**, skip 0; S4b/PHP loopback HTTP
kabul/rol/strict ret/yazmama garantileri dahil. Son opt-in geometri düzeltmesi
sonrası src **80/80 PASS**, Studio `npm run build --workspace
@channel-foundry/studio` tekrar PASS. V2 `npm test` **164/164 PASS**, build PASS.
Tüm komutlar exit 0. JS ve PHP kopyaları byte-eşit; yeniden hash'lenmiş v1 easing
enjeksiyon şema audit'i PASS. P7.5d tarihi baseline değişmedi; yalnız kasıtlı
yedi Studio kaynak/test dosyasına açık S4c1 istisnası; kalan SHA korumaları
sürer, son guard **4/4 PASS**. Yeni site sahne/playback değişikliği yoktur.

`vefk-motion-editor.browser.mjs` gerçek Chromium'da **PASS**: gerçek Workshop
bileşeni + gerçek core + bellek SQLite köprüsüyle 1366×900'de v1 geçici deney,
opt-in, tüm stroke'larda açık linear, undo/redo, native klavye eğri seçimi,
süre düzenleme, kayıt/reload, SVG mürekkep offset/divit konumunun kanonik kareyle
eşitliği, checked/approved kilidi, v2 yeni revizyonu ve onaylı v1 için önce yeni
revizyon sonra opt-in doğrulandı. Pageerror 0. Bu test Electron IPC uçtan uca
veya gerçek site sahnesi testi olarak sunulmaz. İlk browser hazırlığında
sistem Chromium yolu bulunmadı; projede mevcut cache Chromium yolu kullanıldı.

Kanıt dizini `/tmp/vefk-s4c1-658b0hx5/`; Studio/site test ve build logları,
`studio-src-tests-final.log`, `sha-guard-final.log`, `schema-audit.log`,
`studio-browser.log`, `browser/studio-browser.json`,
`browser/studio-doc2-1366.png` ve `scope-check.json` burada. Toplu test/build
geçici kopyadadır; aktif `.local-data`, demo/export ve başka oturum kaynakları
korunur. Git yazma/deploy veya mevcut Vite/OpenCode sürecini durdurma yoktur.

**Açık S4c2 (genel S4c eksik):** gerçek site sahnesinde doc2 16:9/4:3 görsel
Chromium E2E henüz koşturulmadı: play/pause/seek, çoklu M/Z pen-up boyunca
sabit mürekkep ve divit/nib uç eşleşmesi ölçülecek. Bilinen teknik ortam
engeli saptanmadı; bu çalışma ayrı dilime bırakıldı. Studio bileşen kontrolü
ve önceki doc1 P7.5 tarayıcı kontrolü doc2 sahne kabulü değildir. Canlı hosting
kurulumu/kabulü ayrı kalır.


## S4c2 — gerçek DOC2 Chrome sahne kabulü (2026-11-04)

**S4c2 görsel kabulü FAIL / açık.** Yeni izole
`channels/birdesengor/web/tests/fixtures/s4c2-doc2-fixture.mjs` gerçek
`core.createVefk({schemaVersion:2})` ile taze üç manualPaths yolu üretir:
ilk yol çoklu M/Z ve ease-in, diğerleri ease-out / ease-in-out. Aynı geometri
ve zaman planıyla ayrı doc1 doğrusal kontrolü vardır. Bellek SQLite
save → checked → approved → select → buildCatalog → buildPublicationV2
zinciri catalog2 / binding3 / motion.strokeEasing=v2, belge/dosya/catalog/top
fingerprint'lerini üretir; sabit generatedAt ile iki üretim birebir aynıdır.
Gerçek DB/export veya `.local-data` yazılmaz; PHP referans gate yalnız stdin
ile fixture'ı kabul eder, HTTP publication isteği yapılmaz.

Yeni `tests/s4c2-doc2-e2e.mjs` bağımsız rastgele localhost Vite ve cache Chrome
kullanır; yalnız `**/api/publication` fixture'a yönlendirilir. Gerçek stand
Enter, kol, cetvel, reset, mühürler ve oda dönüşü kullanılır. 1920×1080,
1366×768, 390×844 ve reduced-motion kontrollerinde 16 nesne / 21 anchor,
tek kalıcı stand/quill/SVG, ready ve doc2 seçimi doğrulandı. Duraklatılmış
başlangıç/çeyrek/yarım/üççeyrek/son kareler, geri/ileri seek ve intra-M/Z
seyahati kanonik frameAt(t) fraction'ına 1e-10 toleransla eşit; ilk iki
stroke orta zamanda v1'den >0,15 ayrılır. Pen-up boyunca DOM penDown=false,
fraction/dash sabit, fiziksel nib hareket eder. Reset ve doc2→doc1→doc2
mühür seçimi vektörü değiştirmez; oda dönüşü cihazı yeniden oluşturmaz.
Reduced-motion son kare tam çizilir, scrub kanoniktir, quill resting kalır.

İlk tam hareket/DOM turunda en büyük duraklatılmış nib farkları sırasıyla
**0,0015 / 0,8213 / 0,0008 px**, gerçek rAF playback farkları
**0,0014 / 0,6300 / 0,0010 px**; tümü katı <1px. Geometri aynı browser task'ında
fiziksel `[data-vefk-nib-tip]` bounding rect ile gerçek SVG
getPointAtLength/getScreenCTM üzerinden ölçülür. Canlı DOM saatinin ms'ye
yuvarlanması nedeniyle canlı fraction karşılaştırması kanonik ±0,501ms
zarfını kullanır; deterministik SEEK karşılaştırması 1e-10 kalır.

**Gerçek görsel hata / yeniden üretim:** İlk stroke içinde 3030ms'de player
`travel`, penDown=false ve ikinci M henüz ziyaret edilmemiştir. Buna rağmen
`M 550 150 L 850 150` alt yolu boyanmıştır. `VefkStand.jsx` tek çoklu-alt-yol
SVG path'e toplam yol fraction'ını tek dash olarak uygular; SVG dash her
alt yolda yeniden başlar. `getPointAtLength` ile hesaplanan kanonik ink-end
ve nib eşleşmesi bu erken boyamayı tek başına yakalamaz. Bu yüzden yalnız
DOM/matematik PASS'i görsel PASS sayılmadı. Yeni test, t=0 ekran görüntüsüyle
3030ms görüntüsünü ikinci alt yolun (700,150) CTM izdüşümündeki 9×9 bölgede
karşılaştırır. 1920 ekranında **18 erken kararmış piksel** bulundu; kabul
koşulu sıfırdır. `node tests/s4c2-doc2-e2e.mjs --paint-only` exit **1** ile
hatayı yeniden üretir. Default test de bu piksel kabulünü zorunlu tutar.
Eşik veya <1px sınırı gevşetilmedi. Renderer düzeltmesi izin verilen
`useVefkExperience.js` / canonical consumer kapsamına sığmadığından kaynak
kod değiştirilmedi; gerçek per-subpath çizim düzeltmesi ve tekrar kabul gerekir.

**Diğer doğrulama:** V2 `npm test` **164/164 PASS**, skip 0; `npm run build`
**PASS** (çıktı artifacts/s4c2/build). Frozen v1 belge/JSON/kare/catalog testleri
**4/4 PASS**. JS consumer ve PHP gate kopyaları byte-eşit; tam top fingerprint
ve PHP fixture gate PASS. Mevcut P75 doc1 Chrome kontrolü **4/4 PASS**;
1920/1366/390 + reduced-motion, nib en çok 0,456px. P75 kaynak dosyası
korundu; geçici runner yalnız çıktı dizinini artifacts/s4c2/p75'e ve import/root
yollarını gerçek konumlarına yönlendirdi, assertion'lar aynıdır.

Kanıtlar yalnız `channels/birdesengor/web/artifacts/s4c2/` altında:
`metrics.json`, `paint-reproduction.json`, `*-blank.png`,
`*-future-subpath.png`, `*-doc2.png`, `*-pen-up.png`,
`390-reduced-final.png`, `site-tests.log`, `site-build.log`, `frozen-v1.log`,
`copy-php-check.log`, `doc2-browser-final.log`, `paint-browser.log`,
`p75-browser.log` ve `p75/metrics.json`. İlk test hazırlığında yanlış göreli
çıktı yolu, CSSOM altı anlamlı basamak varsayımı ve canlı örnekte etkin stroke
seçimi düzeltildi; site hatasıyla karıştırılmadı.

Studio/PHP/core/sahne/CSS/kamera/graphics/efekt kaynakları, aktif sunucular,
kullanıcı DB/export/demo verileri korunur. Git yazma/deploy/live hosting veya
Electron testi yapılmadı; fotogerçekçilik kabulü iddiası yoktur. S4c1 PASS
geçerlidir; S4c2 ve genel S4c bu renderer hatası kapanana kadar açık kalır.


Son piksel kontrolü dahil tam DOC2 turu **exit 1**: hareket/DOM üç ekran ve
reduced-motion PASS; erken alt-yol boyaması 1920/1366/390'da sırasıyla
**18 / 27 / 18 piksel**, bu nedenle görsel FAIL. Son tur nib maksimum
**0,8212px**, canlı maksimum **0,0267px**, pageerror 0.
`artifacts/s4c2/results.json` nihai durum özetidir. Test edilen ölçüler yukarıda
açıktır; ayrıca 4:3 viewport denenmedi. İlk turun daha büyük canlı ölçümleri
ayrıca belgelenmiştir; her iki tur da <1px sınırını geçti.

## S4c2a son kabul — 2026-11-04 (önceki S4c2 FAIL notlarını günceller)

**Yerel v2 sahne kabulü PASS.** DOC2 karışık katalog/Studio onaylı paket senaryosu gerçek Chromium'da 1920×1080, 1366×768, 390×844 ve reduced-motion için **4/4 PASS**. Mürekkep ve divit aynı kanonik `frameAt` zamanıyla çalışıyor; kayıtlardaki en yüksek durdurulmuş uç sapması **0,822px** (<1px). V1 P7.5 sahne regresyonu **4/4 PASS**.

Önceki gerçek görsel hata giderildi: tek SVG yolunda birden çok `M` alt-yolu varken global stroke dash'in her alt-yolda yeniden başlaması nedeniyle gelecekteki çizgi erken boyanıyordu (18/27/18 piksel). `web/src/vefk/geometry.js` kaynak mürekkep uzunluğunu alt-yollara bölüyor, `VefkStand.jsx` her alt-yolu kendi kesik çizgi ilerlemesiyle görünür kılıyor; kanonik geometri/ölçüm path'i ve veri sözleşmesi korunuyor. Aynı piksel testinde **erken mürekkep 0/0/0 piksel**, geometri testleri **9/9 PASS**.

**Son tamamlayıcı denetim:** P7.5d'nin tarihsel SHA kilidi yeni kodun üç açık ve test edilen dosyasını (`VefkStand.jsx`, `geometry.js`, `tests/vefkGeometry.test.mjs`) izinli S4c2a kapsamına aldı; bunun dışındaki kaynak hash koruması devam ediyor. `npm test` **169/169 PASS** (skip 0), `npm run build` PASS, dokunulmayan PHP ve JS kanonik tüketici çiftleri birebir eşit, `git diff --check` PASS. Önceki **168/169** ve **18/27/18** kayıtları artık tarihsel bulgulardır, güncel engel değildir.

Kanıtlar `channels/birdesengor/web/artifacts/s4c2/`: `s4c2a-results.json`, `metrics.json`, `s4c2a-doc2-browser.log`, `s4c2a-p75-browser.log`, `s4c2a-site-tests-final.log`, geometri ve derleme logları, ekran görüntüleri. Aktif kullanıcı verileri / gerçek Studio yayın dosyaları / canlı hosting veya Electron üzerinde sınama yok. Git commit/push veya deploy yapılmadı. Sonraki iş S4c'nin Studio–yayın–sahne bütünsel uçtan uca tekrarının raporlanması ve kalan arayüz/gerçek cihaz kabulü.
