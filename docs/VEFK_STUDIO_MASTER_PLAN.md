# BirDeSenGör — Studio Vefk Üretim Sistemi V1 / Mimari Plan

> **Studio V3 — 2026-11-06:** Kaynak incelemesi, SVG düzenleme, zaman çizelgesi, kayıt yönetimi ve yerel yayın hazırlığı tek çalışma yüzeyinde birleştirildi. Güncel Studio mimarisi ve doğrulama: [Vefk Atölyesi V3](VEFK_WORKSHOP_V3.md). Aşağıdaki eski ekran önerileri tarihsel kayıttır.
> **P7.5 bağlayıcı son karar — 2026-11-04:** Aşağıdaki eski rulo/parşömen durum makinesi ve paralel oturum sınırları tarihsel plan kaydıdır. Güncel uygulama tek `VefkStand`, üç ahşap ayak/pirinç cihaz, sabit dokulu panel ve mevcut tek `quill`dür. Rulo açma/sarma/örtme yoktur; yakınlaşma/dönüş yalnız mevcut kamera sistemiyle olur. Mekanik kol play/pause, native oyuk range seek, mühür onaylı revizyon seçimi, süpürme taşı yalnız seek(0). Binding v2 `vefk-stand.ink-plane` + aynı `quill.tip` olarak iki uçta atomik değişti; publication/catalog/document şemaları 2/1/1 kalır. Eski demo için migration/fallback eklenmez; eski binding fail closed olur. Bu birleşik görev site P7.5 kodu, Studio yayın bağlamı, ortak contract/tests/docs ile sınırlıdır; mum/kamera/kitap/efekt motoru korunur. S6 yerel doğrulama PASS; canlı dağıtım yapılmadı. Güncel test sonuçları: [birleşik kapanış](VEFK_SINGLE_SESSION_HANDOFF.md).

**Tarih:** 2026-11-03
**Durum:** S1/S2/S3 ve S3.5 görsel kaynak, AI çözümleme, mürekkep izleme ve fotoğraf hazırlığı işlevsel. Gerçek Codex CLI görsel analizi kullanıcı testinde geçti. **S4 zaman çizelgesi editörü, geri sarılabilir çizim önizlemesi, çoklu alt-yol kalem kaldırma/geçişi ve S5 site bağlantı paketi uygulandı (2026-11-04).** S6 canlı siteye nihai entegrasyon/deploy, fiziksel divit animasyonunun görsel cilası ve canlı PHP derin doğrulama bekliyor; V2 sahnesinin tüketici adaptasyonunu paralel oturum yapacak.
**Sınır:** Bu oturum yalnız ChannelFoundry Studio'nun Vefk üretim kodunu ve planını geliştirir. Paralel BirDeSenGör V2 sahne dosyalarına, EfektAtolyesi'ne, sunucuya ve canlı yayına dokunulmaz; Git commit/push yapılmaz.

## 1. Gözlenen mimari

- Studio: `apps/studio/` — Electron main/preload + React/TypeScript arayüz + IPC.
- Her kanalın yerel verisi `channels/<id>/.local-data/studio/channel-foundry-studio.sqlite` altındadır. `node:sqlite` (DatabaseSync), WAL ve STRICT tablolar kullanılır; kanal değişiminde yeniden başlatılır.
- Yayın oluşturucu: `apps/studio/publication-v2.cjs`; kaynaklar onaylı anlatı, arşiv, görseller, video özetleri ve destek verisidir. `publication.schemaVersion = 2`, kanonik JSON SHA-256 içerik fingerprint'i taşır.
- Yerel paket: `.local-data/studio/public-export/content/publication.json` ve `assets/`. Canlı yayın: `studio-runtime.cjs` → `community-admin.cjs` → Natro PHP; önce hash'li görseller, sonra publication.json atomik etkinleştirilir.
- Mevcut görsel yükleme API'si PNG/JPG/WebP ile sınırlıdır; JSON/SVG için hazır taşıma yolu yoktur. Yayın POST boyutu 16 MiB'dir. Server, publication nesnesinin herhangi bir derinliğinde fiziksel kitap sayfası anahtarlarını reddeder.
- Canlı yayın kapısı `readyForTheme` mevcut anlatı ve görsel tamamlamaya bağlıdır; Vefk için ayrı onay ve yerel önizleme kapısı tasarlanmalıdır, mevcut kapı sessizce aşılmamalıdır.
- V2 çalışma alanı: `channels/birdesengor/web/`. Sahne `birdesengor-study-v2`; nesneler `parchment` ve `quill`; bağlantı noktaları `parchment.ink-plane` ve `quill.tip`.
- EfektAtolyesi örnek dosyasında sahne `birdesengor-v2`, parşömen için `seal/corner` gibi farklı adlar kullanılmıştır. Bu kimlik uyuşmazlığı entegrasyon öncesi diğer oturumlarla çözülmeli; sessiz alias uygulanmamalıdır.

## 2. Sorumluluklar

1. **Studio Vefk Modülü:** Kaynak/provenans, yöntemin seçimi, hesaplama, doğrulama, manuel vektör düzenleme, vektör çizim planı, revizyon, onay, yerel önizleme, paketleme.
2. **V2 Efsunlu Parşömen Motoru:** Tek kalıcı rulo ve divit; çizimi aynı veriyle sürme, oynat/durdur/sar, mühürle seçme/geçme, erişilebilirlik. Hesaplama yapmaz; site içinde ayrı vefk katalog mantığı yaratmaz.
3. **Kanonik EfektAtolyesi:** `sceneObject` hedefli ışık, mürekkep belirip çözünme, parıltı ve parçacıklar. Vefk hücresi hesaplamaz, metin/SVG çizmeyi sahiplenmez.
4. **Paylaşılan sözleşme:** Taşınabilir kanonik JSON ve ayrı sahne bağlama manifesti. Efekt sözleşmesinden bağımsız sürümlenir.

## 3. Bağımsız Vefk belge sözleşmesi

Önerilen belge biçimi `birdesengor.vefk`, `schemaVersion: 1`. Tek revizyonun eksiksiz, değiştirilemez yayın çıktısıdır. Çalışma taslağı ile yayımlanan paket aynı semantiği korur, ancak taslakta editöre özgü geçici değerler olabilir.

- `id`: kalıcı vefk kimliği (başlık veya sıra değişse bile korunur); `revision`: pozitif tam sayı.
- `title`, `description`, `language`, `accessibility`: kullanıcıya ve erişilebilir çıktıya dönük açıklamalar.
- `provenance`: yöntem kaynağı (`manual | traditional-reference | algorithmic`), kaynak künyesi, olası Studio video/arşiv kimlikleri, izin/atıf ve yorum notu. Geleneksel bir anlatım ile matematiksel doğrulamayı ayrı ifade eder.
- `construction`: `kind`, `algorithmId`, `algorithmVersion`, normalleştirilmiş parametreler, hücre matrisi / geometrik kurallar, metodolojik doğrulama sonuçları. Aynı girdi aynı sonucu üretmelidir.
- `geometry`: bağımsız `viewBox`, sıralı katmanlar, kararlı ID'li vektör yolları, orijinal metinler ve harf/sayı konturları. Tüm görünür mürekkep yollarının ID'si vardır; site font şekillendirme algoritması çalıştırmaz.
- `drawPlan`: her `pathId` için `startMs`, `durationMs`, kalem kaldırma/indirme ve çizim stili. Mutlak saat değil göreli milisaniye kullanılır. Renk/kalınlık mürekkep token'larıyla belirlenir.
- `checks`: doğrulama sonucu (kare toplamları, boşluk/duble değerler, tüm çizim yolları kapsanmış mı, süre taşmaları), düzenleyici onay bilgisi. AI önerisi kesin onay sayılamaz.
- `contentHash`: kanonik semantik + geometri + çizim planından SHA-256. `generatedAt`, arayüz konumu, oynatma ilerlemesi, önizleme zoom'u hash'e girmez.

Belgenin içinde **sceneId, objectId, anchorId, efekt yapılandırması, kameranın konumu veya fiziksel parşömen ölçüsü bulunmaz.** Bunlar ayrı bağlama manifestinde tutulur. Sözleşme, 3. oturumun ortamından bağımsız olarak test edilebilir.

İsimlendirme örneği ve minimum veri biçimi: `docs/contracts/vefk-v1.example.json`.

## 4. Üretim yöntemleri

- **Serbest çizim / editör:** Boş artboard, ızgara, çizgi, eğri, daire, çember, çokgen, yol, metin, mühür ve simgeler. Her şey bağımsız primitive/vektör ID'sidir.
- **Matematiksel kareler:** İlk sürümde 3×3 ve genel tek dereceli (5×5, 7×7) Siamese algoritması. Başlangıç ve ortak artış belirlenebilir; satır/sütun/çapraz toplamları doğrulanır. Örn. 3×3, 1..9 için toplam 15; 5×5 için 65. Çift dereceli üretimler yalnız ayrı doğrulanmış algoritma ve testlerle sonraki aşamada.
- **Ebced/harf değerleri:** İlk sürümde açıkça seçilen alfabe/eşleme tablosu, yazım normalizasyonu, yön (RTL/LTR), harf değerleri ve kaynak notu. Çeşitli geleneklerin kuralları tek bir evrensel doğru gibi sunulmaz. İlk aşamada değer hesabı ve manuel yerleşim; otomatik vefke dönüştürme ayrı, kaynak belgeli yöntemle.
- **Geometrik/sembolik bileşim:** Kare, halka, iç içe geometriler, yazı kuşakları ve serbest çizim; editörün kütüphanesini çoğaltmadan aynı geometry/drawPlan hattına dönüşür.
- **Görselden AI ile vefk çözümleme (ANA üretim yolu, S3.5):** Kullanıcı PNG/JPEG/WebP fotoğraf veya tarama yükler; isteğe bağlı kırpma, perspektif düzeltme ve kontrast temizliğinden sonra Studio'daki mevcut AI modeli resimdeki kare, sayı, yazı, sembol ve çizgileri konumlarıyla yapılandırılmış öneri olarak çözümlemeye çalışır. Orijinal görsel korunur, belirsiz alanlar işaretlenir; deterministik geometri/vektör çıkarma, kullanıcı düzeltmesi ve açık onayıyla aynı `birdesengor.vefk` çıktısına dönüşür. AI çizim veya matematik doğrulamasının yerine geçmez. Ayrıntılı akış ve kabul koşulları için bkz. Bölüm 16.
- **Sıfırdan üretim (ikinci yol):** Matematiksel kare, manuel kare ve serbest vektör çizimi S1–S3 altyapısıyla sürer. Kaynak metninden taslak, etiket ve biçim önerileri AI desteğinin ikincil parçalarıdır.

Bu sistem kültürel/sembolik bir üretim aracıdır. Matematiksel doğrulama, metafizik etkilerin doğrulandığı iddiası değildir.

## 5. Vektör editör ve Studio kullanıcı deneyimi

Ana navigasyonda **Vefk Atölyesi**, üretim bölümünde bağımsız çalışma alanı olur; **Yayınlama** ekranı yalnız onaylanmış içeriklerin paket/diff/aktif etme durumunu yönetir.

- **Varsayılan başlangıç:** belirgin **Görselden vefk oluştur** eylemi ve ikinci seçenek **Sıfırdan oluştur**. Birincisi kaynak görsel → AI çözümleme → görsel/SVG üst üste kontrol → düzeltme akışını, ikincisi mevcut S3 matematiksel/manuel editörü açar.
- Üstte sade başlık, kaynak ve yöntem, çözümleme/düzeltme durumu, kayıt/önizleme/onay.
- Solda filtrelenebilir vefk koleksiyonu, kaynak görseller ve şablonlar (daraltılabilir).
- Ortada SVG vektör artboard: zoom/pan, snap, kılavuz ızgara, çizim nesnesi seçimi, hücre ve yazı düzeni, doğrudan şekil taşıma.
- Sağda seçime bağlı mini özellikler: `Kaynak`, `Hesaplama`, `Geometri`, `Çizim sırası`, `Doğrulama`. Karmaşık kontroller gerektiğinde overlay; tek çalışma alanı.
- Altta isteğe bağlı yatay **çizim zaman şeridi**: yol listesi, sıralama, süreler, duraklar, grup gecikmeleri.
- Tam ekran fiziksel parşömen önizlemesi ve ayrıca yalın teknik SVG önizleme. Önizleme gerçek yayımlanacak JSON paketini tüketir; çift renderer yapılmaz.
- Küçük ekranlarda yan sütunlar içeri kapanır; vektör alanı birincil kalır.

## 6. Çizim zamanlaması — tek doğruluk kaynağı

`drawPlan` ayrı fiziksel animasyon üretmez; salt çizim süreleri, sıra ve hareket ipuçlarını tutar. Her anda görünür yol uzunluğu ve divit ucu aynı `progress = clamp((t-startMs)/durationMs,0,1)` hesabından çıkar.

Önerilen aşamalar: `prepare → outline → grid → inscriptions → symbols → seal → hold`. Bunlar serbest adlandırılmış grup işaretleridir; her SVG yolunun bağımsız zaman aralığı vardır. Çizim bittiğinde durağan tam vektör görünür. Oynatma hızına göre oynatıcı saati ölçeklenir; belge yeniden hesaplanmaz. Seek ve reverse animasyonun gerçeğini izlemeye çalışmaz; doğrudan aynı `t` noktasına deterministik yeniden hesaplar.

Kalem hareketi için her strokun referans geometrisinden (yol, teğet, başlangıç ve bitiş) nib pozisyonu hesaplanır. Lift ve travel hareketleri ayrı olaylardır; divit mürekkep bırakmadığı zaman görünür olabilir. Pointer pozisyonu ile mürekkep uzunluğu ayrı kaynaklardan türetilmez.

Parşömendeki durum makinesi: `closed → opening → ready → drawing ↔ paused → complete → dissolving → ready(next) → closing`. Rulo, DOM içinde kalıcı ve tektir; mühür geçişi içerik değiştirir, fiziksel nesne değiştirmez.

## 7. Sahne bağlama sınırı

Vefk belgesi dışında ayrı manifest:

```json
{
  "bindingVersion": 2,
  "sceneId": "birdesengor-study-v2",
  "surface": { "objectId": "vefk-stand", "anchorId": "vefk-stand.ink-plane" },
  "pen": { "objectId": "quill", "anchorId": "quill.tip" },
  "coordinateSpace": "svg-viewBox",
  "fit": "contain"
}
```

Buradaki `svg-viewBox` vefk çizim koordinatıdır; EfektAtolyesi'nin `object-local-normalized` sahne koordinatı değildir. İki sistem arasındaki dönüşüm V2 adaptöründedir. Yanlış veya eksik object/anchor ID'si sessiz fallback yerine doğrulama hatası üretir. Efektlerin `ink-reveal`, `ink-dissolve` vb. isimleri ayrı efekt manifestinde seçilir; çizim zamanlaması Vefk'in kaynağı olarak kalır.

## 8. Yerel veri modeli ve revizyon

Studio SQLite'ta iki ana tablo yeterlidir:

- `vefk_documents`: `id`, `title`, `active_revision`, `status`, `created_at`, `updated_at` (+ opsiyonel sıralama/etiket).
- `vefk_revisions`: `document_id`, `revision`, `definition_json`, `geometry_json`, `draw_plan_json`, `validation_json`, `content_hash`, `status`, `approved_at`. Birleşik benzersiz anahtar `(document_id, revision)`.

Durumlar: `draft → checked → approved → published`. Yayınlanmış revizyon değiştirilemez; düzenleme yeni revizyon açar. Gereksiz migration, fallback, backup katmanı yapılmaz; tek kopya test dönemi geçerlidir. Kullanıcı aksiyonu sonucu taslak kaydı yerel SQLite'a gider, canlı sahneye doğrudan gitmez.

## 9. Yerel önizleme ve yayın

**Aşama 1 — Yerel:** `vefk_document.json` (onaylı kanonik veri) ve `vefk_catalog.json` (kimlik, sıralama, revizyon, SHA) Studio'nun yerel public-export yapısında üretilir. Dosya ve fingerprint doğrulanır; V2 önizleyici bu dosyayı doğrudan okuyabilir. Canlı API değişmez.

**Aşama 2 — Yayın transportu:** Sunucuya ayrı hash'li JSON vefk asset aktarımı eklenir (yalnız statik, şema doğrulanmış JSON; SVG kodu veya script yüklenmez). Önce bundle'lar sunucuya yüklenir ve hash doğrulanır, sonra `publication.json` atomik etkinleştirilir. Yeni kök alan örneği:

```json
"vefkCatalog": {
  "schemaVersion": 1,
  "entries": [
    { "id": "vefk-3x3-001", "revision": 1,
      "url": "vefk/vefk-3x3-001-<sha-prefix>.json",
      "sha256": "<full-sha256>", "order": 1 }
  ]
}
```

Mevcut `publication.schemaVersion = 2` korunur. Ek alan geriye dönük isteğe bağlıdır; V1 tüketicisinin yokluğunda çalışması bozulmaz. Ancak Natro PHP validator bu alanı ve bundle hash'lerini açıkça kontrol edecek şekilde genişletilmeden canlı vefk referansı yayınlanmaz. Vefk yeni içerikse toplam publication fingerprint'i de değişir. Yalnız yayın içeriğinden fingerprint türetilir; tarih/önizleme ayarı etkileyemez.

**Aşama 3 — Yayın ekranı:** Onaylı vefk sayısı, bekleyen değişiklik sayısı, son yayın hash'i ve yerel/canlı diff görünür. Mevcut `readyForTheme` kapısı korunduğundan Vefk'in kendi `vefkReady` kapısı ayrıca hesaplanır; tüm siteyi yayınlama kararından bağımsız yerel vefk önizlemesi mümkündür. Silinen/eski bundle'ların temizliği, aktif manifestin referanslarını koruyacak şekilde yapılır.

## 10. Doğrulama ve kabul

- Algoritma: 3×3, 1..9 ve 5×5, 1..25 sabit testleri; eşit satır/sütun/çapraz toplamları; parametrik başlangıç/artış.
- Aynı girdi + sürümlü algoritma = aynı semantik hücreler, path sırası ve SHA. Oluşturma tarihi sonucu değiştirmez.
- Arapça/RTL yazıda kaynak Unicode metin korunur; dışa verilen glifler fonta bağımlı runtime metin değil, doğrulanabilir vektör konturudur.
- SVG/JSON validation: tanımsız pathId, tekrarlı id, NaN, negatif süre, taşan viewBox, eksik glif konturları, sınır üstü boyut/derece reddedilir; dış betik/HTML çalıştırılmaz.
- Timeline: aynı `t` için ileri oynatma, geri sarma, doğrudan seek ve pause sonrasında aynı vektör görünür; divit ucu aynı yoldadır.
- Editör: seçim, taşıma, hücre güncelleme, çizim sırası, kaydet/yükle, revizyon karşılaştırma, onay/red.
- Yayın: yalnız onaylı revizyonlar, sabit ID, fingerprint, sunucudaki bundle doğrulama, noktasal değişim diff'i, eski V1 yayın akışının bozulmaması.
- Entegrasyon: aynı vefk paketini Studio teknik önizleme ve tek V2 parşömeni açar; efekt motorunu kapatınca doğru statik çizim değişmez.

## 11. Uygulama sırası ve bağımsız oturum sınırları

**S0 — Sözleşmeyi dondur:** Doküman + örnek JSON + object/anchor ID eşleşmesi. Studio, V2 ve EfektAtolyesi ayrı sözleşme sürümleri taşır.

**S1 — Deterministik üretim çekirdeği:** Hiç UI olmadan yöntem kütüphanesi (manuel + 3×3 / tek dereceli kareler), açıklanabilir doğrulamalar, geometry builder, immutable document serializer ve birim testleri.

**S2 — Yerel Studio kayıtları:** SQLite tablolar, IPC/preload API'si, revizyon, arşiv ve statü. Mevcut anlatı tabloları değiştirilmez.

**S3 — Vektör editör:** SVG artboard, şablonlar, hücreler, metin/kontur, katman, seçim, snap, özellikler, undo/redo.

**S3.5 — ANA YOL: Görsel içe alımı ve AI çözümleme (S4 öncesinde zorunlu):** Mevcut Studio AI ayarlarından görsel-anlama yeteneği doğrulanan modelle yerel görsel yükleme, kaynak arşivi, kırpma/perspektif düzenleme, yapılandırılmış AI tespiti, güven dereceleri, SVG yol çıkarma, kaynak/vektör overlay karşılaştırma ve editör düzeltmesi. Birden fazla gerçek kaynakla uçtan uca test. Ayrıntı Bölüm 16. Yeni AI sistemi/ikinci model ayar yüzeyi oluşturulmaz.

**S4 — Çizim yöneticisi:** Path ID'leri, drawPlan, süre editörü, kalem teğeti, deterministik seek, teknik ve fiziksel önizleme.

**S5 — Onay ve yerel yayın paketi:** Şema doğrulama, onaylı revizyon, catalog, hash, diff, yerel V2 prova akışı.

**S6 — Canlı yayın uzantısı (yalnız ayrı onayla):** JSON bundle transport, PHP doğrulama, atomik manifest, V2 tüketici, bütünleşik uçtan uca test. Canlı deploy ve Git push ayrı yetki gerektirir.

### Diğer paralel oturumlara teslim

- **V2 sahnesi:** Yalnız belge JSON, catalog, drawing clock + dışarıdan verilen binding alacak. Hücre hesabı/yöntem algoritması yazmayacak.
- **Efekt Atölyesi:** `parchment.ink-plane` ve `quill.tip` nesne yuvalarını doğrulayacak; `ink-reveal/dissolve` efektlerini önerilen ortak efekt sözleşmesi üzerinden bağlayacak. Mürekkep efektleri vefk çizim verisini değiştirmeyecek.
- **Studio:** İlk gerçek çalışmada yalnız S1–S5; V1 canlı yayın, V2 kodu ve EfektAtolyesi değiştirilmez.

## 12. Henüz kesinleştirilmeyen bilimsel/edisyon kararları

Ebced için hangi tarihsel çizelgelerin ilk paketle geleceği, geleneksel vefk ailesi adlarının listesi ve harflerin vektör kontur kaynağı ayrı kaynak incelemesiyle seçilmelidir. Bunlar sözleşmenin değişmesini gerektirmez; yöntem kütüphanesi sürümlü genişler.

## 13. S1 Uygulama Kaydı (2026-11-03)

- Çekirdek: `apps/studio/vefk-core/{squares,geometry,timeline,document,index}.cjs`
- Testler: `apps/studio/vefk-core/vefk-core.test.cjs`; komut: `node --test apps/studio/vefk-core/*.test.cjs`
- Kapsam: deterministik Siamese 3×3/5×5/7×7; parametrik ilk değer/adım ve BigInt ara hesaplarıyla güvenli tamsayı denetimi; manuel kare veya SVG path girdisi; fonttan bağımsız şematik rakam konturları; `svg-viewBox` geometrisi; sabit path kimlikleri; `drawPlan` ve rastgele erişimli hesaplanan ilerleme; `contentHash` doğrulaması ve kanonik JSON serileştirme.
- S1 çıktısı mevcut `docs/contracts/vefk-v1.example.json` dosyasını değiştirmeden doğrular.
- Kod yalnız yeni `vefk-core/` dizinindedir. IPC/DB/UI, web, EfektAtolyesi, yayın API'si, deployment ve Git push yapılmadı.
- S2 öncesi karar: vefk revizyon depolama/IPC bu çekirdeği kullanacak; şematik rakam konturları S3 görsel editörde değiştirilebilir. S1 veri sözleşmesi sahne koordinatlarından bağımsız kalacak.

## 14. S2 Uygulama Kaydı (2026-11-03)

**Kapsam ve sahiplik:** `apps/studio/vefk-store.cjs` bağımsız SQLite saklama katmanıdır. `apps/studio/vefk-ipc.cjs` ayrı, test edilebilir IPC kayıt katmanıdır. Minimal bağlantı `studio-runtime.cjs` içindeki `database()`, `studio-ipc.cjs`, `preload.cjs` ve `src/studio-api.d.ts` üzerinden kuruldu; `src/vefk-api-contract.d.ts` vefk türlerini tanımlar. Yeni UI henüz yoktur.

**Veri:** `vefk_documents` ve `vefk_revisions` STRICT tabloları yalnız aktif kanalın `.local-data/studio/channel-foundry-studio.sqlite` dosyasında oluşturulur. S1 kaynak belgesi kanonik JSON + SHA-256 olarak saklanır; hatalı veri reddedilir. Türkçe Unicode başlık araması için `title_search` anahtarı tutulur. Tüm yazmalar `BEGIN IMMEDIATE` işlemiyle atomiktir. Kullanıcı test verileri üzerinde migration, fallback veya backup eklenmedi.

**Durum ve revizyon:** Yeni belge revizyon 1 taslaktır. `draft → checked → approved`; kontrol sonrası düzeltme gerektiğinde `checked → draft` mümkündür. `approved` içeriği değişmez; yeni taslak açmak için sonraki revizyon kullanılır. `expectedContentHash` taslak değişiklikleri ve durum geçişlerinde eskimiş düzenlemeleri reddeder. Önceki onaylı revizyon, yeni taslak varken `vefkApproved()` aracılığıyla hâlâ görülebilir. `published` SQLite durum sözlüğünde geleceğe ayrılmıştır; S2 bu statüye geçiş yapmaz ve canlı yayın entegrasyonu içermez.

**Electron köprüsü (8 IPC):** `vefkGenerate`, `vefkValidate`, `vefkList`, `vefkGet`, `vefkRevisions`, `vefkSaveDraft`, `vefkReview`, `vefkApproved`. Mutasyonlar mevcut `studio:data-changed` güncellemesiyle Studio'yu haberdar eder; salt-okuma çağrıları güncelleme tetiklemez. Studio site yayınına, `publication-v2.cjs` şemasına veya V2/EfektAtolyesi'ne bağlanmaz.

**Doğrulama:** `node --test apps/studio/vefk-core/vefk-core.test.cjs apps/studio/vefk-store.test.cjs apps/studio/vefk-ipc.test.cjs` — 30/30 PASS (S1+S2); TypeScript `tsc --noEmit`, mevcut `verify-narrative-ipc.cjs` ve `verify-publication-v2.cjs` PASS. Testler birden fazla kanal/veritabanı izolasyonu, tekrar açma, revizyon kilidi, yanlış hash, bozuk veri, Türkçe arama ve IPC yenileme davranışını kapsar.

**Sonraki aşama S3:** Kaydetme ve onay için hazır IPC uçları kullanılarak tek ekranda SVG editör, yöntem/şablon seçimi, katmanlar ve güncel taslak revizyonu gösterilecek. S3'te mevcut S1 sözleşmesi ve S2 onay/revizyon kuralları korunacak. Zaman şeridinin tam düzenlenebilir arayüzü ve parşömen önizleme S4'e bırakılacak.

## 15. S3 Uygulama Kaydı (2026-11-03)

**Arayüz:** `apps/studio/src/VefkWorkshop.tsx` ve `vefk-workshop.css` Studio'nun ÜRETİM menüsünde bağımsız **Vefk Atölyesi** bölümünü sağlar. `StudioPipeline.tsx` içinde lazy-loaded, yeni `StudioIcon.tsx` vefk simgesiyle gelir; mevcut Yayınlama sayfasına müdahale etmez. Karanlık/açık tema Studio token'ları kullanılır. Küçük ekranlarda koleksiyon ve özellik panelleri daralabilir; SVG alanının kendi zoom/scroll'u vardır.

**Tek çalışma alanı:** Sol koleksiyon/arama/durum filtreleri/revizyonlar; orta SVG artboard, araçlar ve konum göstergesi; sağ belge başlığı, yöntem/hesaplama, seçili vektör nesnesinin özellikleri, katmanlar, onay işlemleri. `apps/studio/src/vefk-editor-model.ts` editörün saf çizim matematiğidir ve görüntüden bağımsız test edilebilir.

**İşlevler:** Siamese 3×3/5×5/7×7 ve parametrik ilk değer/adım; manuel tam sayı hücreleri; başlangıç motifli serbest yol kompozisyonu; vektör nesnesini seçme, fareyle taşıma, 10 birim ızgara snap, kılavuz görünürlüğü, zoom/scroll, yeni çizgi/dikdörtgen/baklava/serbest stroke, 2D taşıma/ölçek, mürekkep stili ve genişliği, katman sırasını değiştirme, kullanıcı eklemişse yol silme, geri al/yinele. S1'de zorunlu sayı/hücre yolları belge doğrulaması nedeniyle silinemez; eklenen serbest yollar `mark.###` biçiminde kararlı kimlik alır.

**S2 bütünleşmesi:** Düzenleme yalnız bellek içi taslakta; açık **Kaydet** eylemiyle S1 `createVefk` üzerinden yeniden doğrulanmış kanonik JSON üretilir, S2 `vefkSaveDraft` üzerine yazılır; eskimiş hash reddedilir. `draft → checked → approved` editöre bağlandı. Kontrolden taslağa dönmek ve onaylanmış en son revizyondan `revision+1` açmak desteklenir; geçmiş onaylı revizyon korunur. Kaydedilmemiş taslakla koleksiyon, bölüm, proje değiştirmede uyarı verilir.

**Doğrulama:** S1/S2/S3 birlikte `node --test apps/studio/vefk-core/vefk-core.test.cjs apps/studio/vefk-store.test.cjs apps/studio/vefk-ipc.test.cjs apps/studio/src/vefk-editor-model.test.mjs apps/studio/src/vefk-workshop.test.mjs` — **39/39 PASS**. Vektör çizim → S1 şema → S2 SQLite → kontrol/onay uçtan uca yerel testtir. `npm run build --workspace @channel-foundry/studio` TypeScript ve Vite derlemesinde PASS; Electron görsel/manual tıklama incelemesi henüz bu oturumda yapılmadı. Git push/deploy yoktur.

**Sınırlar:** Bu aşamadaki sayı konturları şematik 7-segment vektörlerdir; tarihî kaligrafi/ebced yazıları için ayrı kontur kaynağı ve kaynaklı yöntem tanımı sonraki tasarım iterasyonunda gerekir. Bağımsız Unicode metni SVG `<text>` olarak sahne sözleşmesine eklemiyoruz; SVG path dışında HTML/script taşımıyoruz. S4 ayrıntılı zaman şeridi, stroke süre/sıra editörü, divit ucu geometrisi, deterministik pause/scrub ve fiziksel parşömen önizlemesini geliştirecek. S5 yerel vefk katalog/yayın paketi hazırlayacak. Canlı deploy ve site/efekt kodu ayrı onay gerektirir.

## 16. ANA ÜRETİM YOLU — Görselden vefk sayısallaştırma / S3.5 (2026-11-03 plan revizyonu)

**Ürün kararı:** BirDeSenGör Studio'da vefklerin çoğunun kaynağı mevcut bir vefk resmidir. **Görselden oluştur** ana eylemdir; **Sıfırdan oluştur** ikincil fakat tam desteklenen yöntemdir. Kullanıcı kaynak eserle çalışıyormuş gibi hissetmeli; editör teknik kalabilir, V2 site ziyaretçisi yalnız fiziksel parşömen/divit etkileşimini görür. S3'ün sıfırdan üretim arayüzü çöpe atılmaz; görüntüden çıkan vektörleri de düzenleyen ortak editördür.

### 16.1 Tek akış

1. **Kaynak al:** PNG/JPEG/WebP fotoğraf, tarama veya çizimi yerel dosyadan içe al. Önizlemede isteğe bağlı kırpma, döndürme, perspektif düzeltme, kontrast ve gürültü giderme uygula; orijinali silme/değiştirme. Bir görselde birden çok vefk varsa kullanıcı bölgeyi seçebilir.
2. **Görseli AI ile çözümle:** Studio'nun **mevcut AI ayarları/sağlayıcı bağlantısı** kullanılır. Modelin görsel giriş yeteneği (vision / multimodal input) ayrıca doğrulanır; yalnız metin üreten veya yalnız resim üreten model uygun sayılmaz. Özel vefk AI sağlayıcısı, ayrı kimlik bilgisi/ikinci model konfigürasyonu oluşturma.
3. **Yapılandırılmış bulgu:** AI serbest uzun açıklama yerine sürümlenmiş ara şema üretir: önerilen kare/ızgara sınırları, satır-sütun, hücre koordinatları, okunan sayı/harf/diller, yazı yönü, çizgiler, semboller, mühür/şekiller, tespit bölgeleri, kaynak açıklaması ve **her öğe için belirsizlik/güven işareti**. Önce kaynak görüntü koordinatlarında çalışır; modeli SVG'nin tek gerçek kaynağı saymayız.
4. **Matematik ve görsel ayırımı:** Örüntü algoritmik kareye uyuyorsa hesaplamayla doğrula; uymuyorsa **manualSquare** veya **manualPaths** olarak aktar, zorla 'sihirli kare' düzeltmesi yapma. Okunamayan Arapça/Osmanlıca yazı veya sembolü uydurma; görüntü üzerinde işaretleyerek kullanıcı incelemesine bırak.
5. **Sayısallaştır:** Bölge/çizgi/karakter önerisini fonta bağımlı olmayan, zamanla çizilebilir **merkez-hattı / kalem yolu** vektörüne çevir. Geometrik çizgiler deterministik izlenir; karmaşık kaligrafi, iç içe motifler, lekeli alanlar AI'nın önerdiği bölge üzerinde kullanıcının elle düzelteceği yol takibiyle aktarılır. Kaynak görüntünün dekoratif yüzey dokusu ile çizilebilir mürekkep geometrisi ayrı kalır.
6. **Yan yana / üst üste kontrol:** Sol/orta kaynak fotoğraf ve sağ/üstündeki şeffaf SVG konturları aynı koordinat dönüşümüyle göster; görünürlüğü, opacity'yi ve yakınlaştırmayı değiştir. Belirsiz hücre/karakter listesi, tıklayınca kaynağın o bölümüne götürür. Kullanıcı sayıları, harfleri, kontur konumlarını düzeltebilir; tekrar analiz tüm elle yapılan düzeltmeleri sessizce ezmez.
7. **Onayla ve yayın hattına hazırla:** Kaynak doğrulama ve kullanıcı incelemesi bitince mevcut S1 `createVefk` / S2 revizyon/onay hattında kanonik `birdesengor.vefk` belgesi oluştur. S4 aynı pathId listesine hareket/zaman ekler; S5 onaylı belgeyi ve katalog referansını yerel V2 provaya götürür. Canlı yayın S6 ve ayrı onay konusudur.

### 16.2 Sahiplik, veri ve sözleşme

- **Yayınlık vefk JSON'u:** S1'deki `construction`, `geometry`, `drawPlan`, `accessibility`, `contentHash` değişmeden tüketilebilir. Kaynak resim, AI ara sonucu ve editörün güven/inceleme işaretleri zorunlu olarak siteye gönderilmez. Sahne ID, efekt hedefi veya kamera verisi vefk içine gömülmez.
- **Studio kaynak kaydı:** Aktif kanalın yerel arşivinde orijinal dosya, MIME/boyut, SHA-256, kaynak/atıf/lisans notu, hizalama dönüşümü, görüntü revizyonu, analiz modeli/versiyonu ve öneri JSON'u saklanır. S2'nin mevcut `vefk_documents / vefk_revisions` tabloları genişletilir veya yanına `vefk_sources / vefk_analysis_runs` gibi ayrı tablolar eklenir; kaynak ile vefk ilişkisi kalıcı, test verileri sıfırlanabilir. Orijinal fotoğraf otomatik kamusal asset sayılmaz.
- **AI altyapısı:** `apps/studio/ai-config.cjs`, `ai-client.cjs`, `ai-service.cjs` mevcut ortak ayar ve çağrı mimarisi olarak temel alınır. Mevcut `ai-image.cjs` ağırlıklı **görsel üretimi** sunuyor; görsel **anlama/çözümleme** için bağımsız işlev eklemek gerekir, mevcut bağlantı/kuyruk/hata ve model politikaları yeniden kullanılmalı. Vision desteği sağlayıcıya/modellere göre doğrulanır; yoksa desteklemiyor uyarısı ve manuel yol kalır.
- **Vektör sınırlaması:** Mevcut S1 doğrulayıcı yalnız güvenli mutlak `M/L/Z` SVG yol sözdizimini tanır. Yüksek kaliteli el yazısı ve eğrisel motif için S3.5'te ya bu biçime hassas segmentleme ya da doğrulayıcı/testler birlikte genişletilerek sınırlı güvenli eğri komutları sağlanmalı; ham SVG/HTML, dış bağlantı veya kod çalıştırma kabul edilmez. Görselden çıkan kalem yolu S4'te kesintisiz, ters/ileri sürülebilir `drawPlan` ile uyumlu olmalı.

### 16.3 S3.5 uygulama kırılımı ve geçiş kapısı

- **S3.5a — Yerel görsel kaynak akışı:** Dosya seçme, orijinal/hizalanmış görüntü arşivi, kaynak hash'i, proje izolasyonu, içe aktarım UI. İki başlangıç seçeneği **Görselden** / **Sıfırdan** mevcut S3 ekranında görünür.
- **S3.5b — Mevcut AI ile çözümleme:** Vision capability kontrolü; görsel + isteğin mevcut sağlayıcıya iletilmesi; ara çıktı JSON şeması, belirsiz öğelerin işaretlenmesi, yeniden analiz ve hata yönetimi. Görsel üretme çağrısı çözümleme çağrısının yerine kullanılmaz.
- **S3.5c — Vektöre çevirme ve kullanıcı incelemesi:** Görsel/SVG overlay, satır/hücre/sembol düzeltme, kararlı path ID'leri, kaynakla fark/örtüşme kontrolü, S1 belge ve S2 revizyonuna transfer.
- **Kabul koşulu:** En az bir düzgün taranmış, bir eğik fotoğraflanmış ve bir el yazısı/karmaşık motifli örnek üzerinde; yükleme → çözümleme → belirsiz alanların manuel düzeltmesi → kaydet → onay → geri yükleme başarıyla doğrulanmalı. AI başarı yüzdesi kaynak tipine göre raporlanır; yanlış okunan işaretler sessizce onaylanmaz. Aynı kaynak ve onaylanan geometri, tekrar dışa aktarımda aynı kanonik hash'i üretir.

**Öncelik:** S3.5, S4 animasyonunu gerçek vefk örnekleri üzerinde geliştirebilmek için **S4'ten önce** tamamlanmalıdır. Sahne V2 ve Efekt Atölyesi paralel çalışmalarını beklemez; onlar bağımsız veriye/nesne yuvalarına göre ilerler.

## 17. S3.5 İlk Uygulama Dilimi — Görsel/AI kaynak akışı (2026-11-03)

**Tamamlanan:**
- Studio'da **Görselden oluştur** birincil başlangıç; **Sıfırdan oluştur** korunur. `VefkWorkshop.tsx` kaynak koleksiyonuna ve `VefkSourceWorkbench.tsx` görsel/AI inceleme ekranına bağlandı. SVG editör S1/S2 ile aynı kalır.
- `vefk-sources.cjs`: kaynak PNG/JPEG/WebP dosyaları 12 MB sınırıyla aktif kanalın `userData/vefk-sources/` altında içerik SHA-256 adıyla bir kez saklanır; `vefk_sources` ve eklemeli `vefk_source_analyses` tablolarıyla metadata ve analiz tarihçesi SQLite'tadır. Aynı dosya tekrar içe alınırsa var olan kaynak açılır. Orijinal görsele müdahale edilmez, web yayınına veya `publication-v2.cjs` paketine katılmaz.
- `vefk-vision.cjs`: mevcut `ai-config.cjs` / `ai-client.cjs` yapılandırması ve çağrı altyapısı kullanılarak **görsel giriş** içeren analiz isteği gönderilir. OpenAI-compatible/Ollama OpenAI uçları ve Gemini native `inlineData` görüntü biçimi desteklenir; yalnız metin taşıyan Studio OpenCode/Codex CLI modları açıkça desteklenmiyor olarak gösterilir. Provider/modelin gerçekten vision desteklediği kullanıcı tarafından başlatılan ilk istekte anlaşılır; model katalogunda text-only olup olmadığı garanti edilemez. Base64 görüntüler AI etkinlik geçmişine yazılmaz.
- Model çıktısı `vefk.source-analysis.v1` ara şeması: 0..1000 kaynak koordinatları, tahmini `region` tipleri (grid/sayı/yazı/sembol/çizgi/mühür/belirsiz), bounding box, etiket, güven, kullanıcı inceleme durumu ve opsiyonel tam sayı hücreleri. Sınır dışı/bozuk JSON reddedilir, eksik hücreler inceleme bekler; AI kendi kendini `reviewed` yapamaz.
- Görsel üzerindeki renklendirilmiş kutular, bölgeleri/hücreleri seçip metni düzeltme ve kullanıcı tarafından işaretleme, değişiklikleri yeni **append-only** `review` kaydında saklama, eski analiz kimliğiyle optimistic-lock, tekrar AI çözümleme yaparken eski düzeltme tarihçesinin korunması. Kaydedilmemiş kaynak düzeltmesi de bölümler/proje geçişinde uyarılır.
- Kare tümüyle gözden geçirilmiş, 3–9 boyutlu ve güvenli tamsayı hücreler içeriyorsa **manuelSquare SVG taslağı** olarak S1 üzerinden üretilir. Orijinal kaynak kimliği/sha ve analiz ID'si `provenance` içine konur. Kullanıcı taslağı S2 revizyon/onay hattından geçirir; AI önerisi otomatik onaylanmaz. Rakamlar şu an S1'in şematik rakam konturlarına dönüşür, fotoğraftaki özgün kaligrafiye değil.
- IPC: `vefk-source-ipc.cjs` ile yedi ayrı kaynak/AI işlemi, preload ve TypeScript sözleşmeleri eklendi.

**Doğrulamalar:** S1–S3.5 birlikte 49/49 `node:test` PASS; SQLite/IPC, kaynak kopyası ve hash, desteklenmeyen giriş, belirsizlik, yanlış koordinat, eksik kare hücresi, editör inceleme çakışması, Gemini multimodal aktarımı ve mock AI analizi dâhil. `npm run build --workspace @channel-foundry/studio` ve mevcut Studio regresyon komutları ayrıca çalıştırılır. Gerçek fotoğraf üzerinde bağlı vision modelinin uçtan uca saha testi henüz yapılmadı.

**S3.5 kalan ve S4'e geçiş kapısı:**
1. S3.5a: Dört köşeden kırpma/perspektif doğrultma, 90° döndürme, kontrast/parlaklık ve kaynak koordinat dönüşümü eklendi. Kalan: gerçek fotoğraflarda görsel UX/kalite, lekeli kâğıtta ileri gürültü temizliği.
2. S3.5b ek: Bu dönem Gemini görsel çözümleme yeterli; OpenCode görsel desteği ertelendi. Gemini gerçek vision modelleriyle kalite/timeout testleri ve model bazlı destek saptama.
3. S3.5c ana: İlk seçili bölge **mürekkep orta-hat izleyici** ve kaynak/vektör katmanı tamamlandı. Kalan: özellikle Arapça/Osmanlıca kaligrafi, karmaşık motif ve lekeli kâğıt için yüksek çözünürlüklü izleme/kalite, stroke birleştirme/sıraya koyma, eğri yollar, kaynak boy-en oranının nihai vektörde korunması ve görüntüyle hizalama iyileştirmeleri. Otomatik geometrinin tarihî özgün yazıyı hatasız oluşturduğu iddia edilmez.
4. Tam kabul: gerçek düz tarama, eğik fotoğraf ve karmaşık el yazılı üç kaynakla karşılaştırmalı ve görsel/manüel Electron denemeleri; sonra S4 çizim/timeline.

**Sınırlar:** Canlı yayın, site V2, EfektAtolyesi, Git commit/push yapılmadı. Bu S3.5'in ilk çalışır dilimidir; tarihî vefklerin eksiksiz vektör üretimi için tamamlandığı anlamına gelmez.

## 18. S3.5c — Yerel Mürekkep Yolu İzleyici (2026-11-03)

**Saf vektör dönüşümü:** apps/studio/src/vefk-image-trace.ts ikili mürekkep eşiği, küçük lekelerin temizliği, Zhang–Suen inceltme, 8-yönlü komşulukla orta-hat izlemesi ve Ramer–Douglas–Peucker çizgi sadeleştirmesi kullanır. Çıkış yalnız güvenli S1 SVG M/L yollarıdır. Tek örnek en fazla 512 piksel/kenar, tüm kaynak 850 yol, tek yol S1 uzunluk sınırına bağlıdır. Boş, aşırı koyu ve karmaşık alanlar sessizce eksiltilmek yerine hata verir.

**Kaynak üstünde çalışma:** VefkSourceWorkbench.tsx, AI'nın tespit ettiği bölgeyi veya kullanıcının elle çizdiği dikdörtgeni seçip mürekkep merkez-hatlarını çıkartır. Eşik, ters renk, kaynak fotoğraf opaklığı, tespit kutuları ve vektör yolu görünürlüğü ayrı kontrol edilir. Kaynak resmi gerçek boy/en oranında görünür; SVG katmanı görüntüyle aynı 0–1000 koordinat sistemine yerleşir. Bulunan konturlar ayrı ayrı insan incelemesine tabidir.

**Veri ve onay:** vefk.source-analysis.v1 ara kayıtlarına traces grupları eklendi; her yol kaynak region-### öğesine, deterministik trace.region-###.### kimliğine ve reviewed bayrağına sahiptir. Kaydetme append-only revizyon olarak çalışır. Tüm vektör yolları S1 geometrisi ile, ayrıca kaynak bölge sınırıyla doğrulanır; bozuk SVG, komut ve bölge dışı yol reddedilir. AI'nın kendiliğinden vektör onayı koyması engellenir.

**İki farklı çıktı:** Sayısal kareyi SVG'ye aktar yalnız incelenmiş tam sayı hücrelerini manualSquare olarak, İzlenen çizgileri SVG'ye aktar ise yalnız onaylanan gerçek fotoğraf konturlarını manualPaths olarak S1/S2 taslağına taşır. Kaynak hash/analiz kimliği ve bu iki yöntemin farkı provenance/açıklama alanında kalır. S1 drawPlan aynı pen path'leri kullanır; otomatik onay veya yayın yoktur. İzlenmeyen bölgelerin sayısı görünürdür.

**Doğrulama:** S1–S3.5c birleşik testleri 56/56 PASS. İnce/kalın çizgi, ayrık ve kapalı şekil, noise, eşik/limit, tekrar üretilebilir ID, kaynak analizi, kontur sınır güvenliği, S1 ve S2 uçtan uca taslak testleri eklendi.

**Henüz kalan:** S3.5a kaynak hazırlığı ayrıca tamamlandı (Bölüm 19). Lekeli kaynaklarda yüksek çözünürlüklü eğrisel kaligrafi izleme, nihai vektörün kaynak boy/en oranını taşıması, gerçek Gemini ve Electron ekran testleri. OpenCode çok modlu desteği kullanıcı kararıyla sonraya bırakıldı. V2 sahnesi/Efekt Atölyesi/Git push/canlı deploy kapsam dışıdır.

## 19. S3.5a — Orijinali koruyan fotoğraf hazırlığı (2026-11-03)

**Ürün akışı:** Vefk Atölyesi > Görselden oluştur > kaynak görseli aç > **Kırp / hizala**. Sol tarafta orijinal fotoğraf üzerinde sürüklenebilen 4 köşe (sol üst, sağ üst, sağ alt, sol alt); sağda perspektif/renk düzeltmesi önizlemesi vardır. 90° döndürme, tam görüntüye dönme, sıfırlama, kontrast ve parlaklık kontrolleri eklenmiştir. Kontroller yalnız Studio'nun teknik atölyesinde bulunur; V2 ziyaretçi sahnesinin parşömen deneyimi değişmedi.

**Geometri:** apps/studio/src/vefk-image-prepare.ts, dört köşeye uydurulan ters projektif dönüşüm ve bilinear RGB örnekleme kullanır. Görsel işlem saf fonksiyon olarak test edilebilir; çıktı boy/en oranı kırpılan kâğıdın ölçülerine göre belirlenir, 1400 px sınırla PNG üretilir. Önizleme yaklaşık 420 px çözünürlükte, köşe sürüklemeleri sırasında 120 ms gecikmeli yenilenir. Perspektif geometrisi dışbükey dörtgen, 0–1000 kaynak koordinatı ve asgari alan kurallarıyla doğrulanır.

**Depolama:** apps/studio/vefk-preparations.cjs, aktif kanal SQLite'ında eklemeli vefk_source_preparations tablosu ve kaynak arşivinde SHA-256 adlı hazırlanmış PNG oluşturur. Orijinal resim ve hash değişmez. Her yeni hazırlık artan revizyondur; aynı revizyon üzerinde yarışan kayıtlar optimistic-lock ile reddedilir. Kullanıcı eski görseli yeniden hazırlamak için her zaman orijinalini açabilir.

**AI / vektör tutarlılığı:** apps/studio/vefk-sources.cjs artık imageDataUrl olarak güncel hazırlanmış görüntüyü, originalImageDataUrl olarak orijinal görüntüyü ve preparation metadata'sını döndürür. Gemini (mevcut Studio AI yapılandırması) ve vektör izleyici aynı güncel görüntüyü kullanır. Analiz JSON'undaki preparationRevision sürümleme nedeniyle eski kaynak koordinatları yeni hazırlığa taşınmaz; eski analizlerin satırları silinmeden arşivde kalır. AI isteği çalışırken hazırlık değişirse eski AI sonucu yanlış görsele bağlanmamak için reddedilir. SVG taslağının kaynak notları artık orijinal hash, hazırlanmış görüntü hash, hazırlık revizyonu ve analiz kimliği içerir.

**Doğrulama:** S1–S3.5a tam paketi **65/65 PASS**; TypeScript + Vite Studio derlemesi PASS. Ek testler perspektif dört köşe matematiği, kimlik dönüşümü, kırpma ve 90° döndürme, piksel düzeyi kontrast/parlaklık, hatalı dörtgen, hazırlık kayıt zinciri, orijinal hash, eski analiz izolasyonu ve eşzamanlı AI yarışı durumlarını kapsar. Studio shell, narrative IPC, Publication V2 ve AI provider sözleşme kontrolleri PASS. Ek geniş kapsamlı verify-ai-service kontrolü, **önceden değişmiş video analiz sistem mesajını arayan eski test beklentisi** nedeniyle FAIL: testte 'kanalın anlatı arşivini yapılandıran', mevcut ai-analysis-content.cjs'de 'kanalın kaynak videosunu yapılandıran' yazıyor. Bu oturumda söz konusu Vefk dışı test/üretim kodu değiştirilmedi. Gerçek Gemini çağrısı veya manuel Electron görsel testi yapılmadı.

**Kalan S3.5 kapısı:** Lekeli tarihî fotoğraflarda ek gürültü azaltma, el yazısında vektör kalite/süreklilik, kaynak boy/en oranının nihai sahne vekf geometrisine aktarılması, gerçek farklı kaynak görüntüleriyle Gemini ve Electron görsel uçtan uca kontrol. Kullanıcının isteğiyle OpenCode görsel girişini şimdi geliştirmiyoruz. Site V2, Efekt Atölyesi, Git commit/push veya canlı deploy kapsam dışıdır.

## 20. Gemini Sınır Dışı Kutu Hatası — S3.5b Düzeltmesi (2026-11-03)

**Gerçek kullanıcı testi:** Studio Vefk Atölyesi, görsel hazırlığı r1 üzerinde `studio:vefk-source-analyze` çağrısında `RangeError: Bölge görsel koordinatları dışında` verdi. Sebep: Gemini JSON çıktısındaki en az bir `region.box=[x,y,w,h]` için `x,y,w,h` alanları normalize 0–1000 sınırına sığmıyor. Kaydedilmiş ham model yanıtı olmadığı için hangi bölgenin hangi sayıları döndürdüğü kesin olarak ölçülmedi; hata uygulamanın strict `normalizeAnalysis` kontrolünde doğrulandı.

**Düzeltme:** `apps/studio/vefk-ai-region-sanitizer.cjs` yalnız **AI'dan gelen yeni öneriler** için eklendi; onaylı/manual S1 ve S2 vektör/analiz doğrulaması gevşetilmedi. Bir kutunun sınır dışında kalan kısmı en fazla 35/1000 birimse görünen kısmına kırpılıp `needsReview=true`, `reviewed=false`, `confidence<=0.5` uygulanır. Koordinatı yorumlanamayacak derecede bozuk, negatif boyutlu, tümü görüntü dışında veya daha çok taşan kutu atlanır; diğer tespitler ve tanınan grid korunur. Bilinmeyen region türü `unknown` ve inceleme bekleyen olarak işaretlenir. Modelin JSON'unu farklı köşe formatından sessizce yeniden yorumlama yapılmaz.

**Uyarılar:** Her müdahale için `coordinateWarnings` listesinde özgün AI bölge indeksi, özgün bbox, varsa düzeltilen bbox, aksiyon ve gerekçe saklanır. `vefk.source-analysis.v1` üzerinden SQLite ve review kaydına taşınır; sağ panelde **Koordinat denetimi** ayrıntıları gösterilir. Model prompt'u `[left,top,width,height]` düzeni ve `x+width<=1000` / `y+height<=1000` ile netleştirildi.

**Doğrulama:** Yeni 7 hedefli sanitizer/integrasyon testi; tam Vefk paketi **72/72 PASS**. `npm run build --workspace @channel-foundry/studio` ve Studio shell/narrative IPC/publication V2/AI provider contract kontrolü PASS; `git diff --check` temiz. Gerçek Gemini uçtan uca ikinci deneme kullanıcı tarafından yapılacak. Orijinal kaynak, görsel hazırlığı r1, eski analizler, V2 sahnesi, Efekt Atölyesi, Git push ve canlı yayın değiştirilmedi.

## 21. S3.5b — Codex CLI yerel görsel girişi (2026-11-03)

**İhtiyaç:** Gemini model erişimi pratikte kararsız olduğundan Studio'nun zaten kurulu Codex CLI oturumu üzerinden fotoğraf analizi talep edildi. Ghost makinesinde `codex-cli 0.166.0`, `codex exec --image FILE`, `--output-schema`, `--output-last-message` ve `codex login status` (ChatGPT oturumu açık) doğrulandı.

**Uygulama:** `apps/studio/vefk-codex-vision.cjs` ile mevcut `ai-cli.cjs` çalıştırıcısı (`codexArgs`, `runProcess`, CLI binary çözümleme, timeout/abort, read-only sandbox, araçları kapatma) yeniden kullanıldı. Geçerli/12 MB altı PNG/JPEG/WebP kaynak veya hazırlanmış görüntü, sadece tek analiz çağrısı için 0600 izinli geçici görsel dosyasına kaydedilip `codex exec --image` argümanıyla iletiliyor; Codex'e JSON çıktı şeması veriliyor, yanıt `--output-last-message` üzerinden okunuyor. Geçici görsel, çıktı ve şema dosyaları hata/iptal dahil siliniyor. Görsel metin içindeki base64'e dönüştürülmedi; mevcut Studio metin sağlayıcısı ayarları kullanıldı, görüntü üretimi servisi ile karıştırılmadı.

**Entegrasyon:** `vefk-vision.cjs` Studio AI ayarlarındaki **Metin → Codex CLI** seçiliyse bu görsel yolu kullanıyor; Gemini/Ollama/OpenAI uyumlu görsel hattı aynen korunuyor. Modelin vereceği bölge/hücre önerileri mevcut `vefk-ai-region-sanitizer`, sıkı `vefk-sources` doğrulaması, SQLite inceleme ve vektör onayı üzerinden devam ediyor. Codex model seçimi boş bırakılırsa CLI varsayılanı kullanılabilir; vision desteği mevcut binary varlığına göre görüntülenir. Araç kapatma ve read-only kısıtları korunur.

**Test:** Yeni 4 mock CLI/vision testi; toplam **76/76 Vefk testleri PASS**. Studio TypeScript + Vite build, Studio shell, narrative IPC, Publication V2, AI provider contracts ve `git diff --check` PASS. Gerçek Codex CLI çağrısı yapıldı ancak model yanıtından önce hesap **kullanım limiti** uyarısı verdi (bir sonraki limit sıfırlama: 2026-11-04 12:08, CLI mesajına göre). Bu nedenle canlı modelin ürettiği JSON'u henüz onaylanmış uçtan uca başarı olarak saymıyoruz. Kullanıcı Codex hesabını kendisi değiştirdikten sonra Studio'yu yeniden açıp aynı görselde AI çözümlemesini deneyecek.

**Kapsam:** Codex giriş/hesap verilerine dokunulmadı; Git commit/push, web deploy, paralel V2 sahnesi ve Efekt Atölyesi dosyaları değiştirilmedi.

## 22. S5 — Studio → V2 Site Kataloğu ve Yerel Yayın Köprüsü (2026-11-03)

**Öncelik kararı:** V2 parşömen/divit görünüm tasarımı başlamadan önce Studio'nun gerçek onaylı Vefk üretimini siteye taşınabilir hale getirmek. Sahne dosyaları paralel V2 oturumuna ait olduğundan bu oturum V2 kodunu değiştirmedi.

**Tamamlanan Studio tarafı:**
- apps/studio/vefk-publication.cjs: STRICT SQLite vefk_publication_selection tablosu, yalnız onaylı revizyonu açık kullanıcı kararıyla kataloğa alma/çıkarma, revizyonu ve contentHash'i sabitleme, sıralama, en fazla 32 entry ve 5 MiB paket sınırı.
- apps/studio/vefk-ipc.cjs, preload.cjs, studio-api.d.ts ve VefkWorkshop.tsx: katalog listesi, onaylı revizyon için Site kataloğuna ekle/çıkar, seçili vefk sayacı, Site paketini hazırla. Bu eylem yerel publication export'u kullanır, canlı deploy tetiklemez.
- apps/studio/publication-v2.cjs: publication schemaVersion 2 değişmez. Yalnız gerçekten seçilmiş onaylı vefk bulunursa vefkCatalog kök alanı eklenir. Fingerprint onaylı vefk içeriğini kapsar; seçim yoksa eski yayın çıktısı ve fingerprint korunur. Aynı anda yerel public-export/content/vefk/vefk_catalog.json ve content-addressed tekil belge JSON'ları üretilir.
- docs/contracts/vefk-site-consumer.mjs: bağımsız ESM doğrulayıcı ve gerçek geometri/zaman çizelgesinden üretilen deterministik frame/kalem pozisyonu. Tek seferlik createVefkPlayer(document), frameAt(timeMs), SHA-256 ile catalog/document/publication bütünlük denetimi ve sahne bağlantı kontrolü; HTML, XML veya keyfi SVG çalıştırılmaz.
- Sahne bağlama: sceneId birdesengor-study-v2; surface parchment / parchment.ink-plane; pen quill / quill.tip; coordinateSpace svg-viewBox; fit contain. V2 scene manifestiyle okuma amaçlı karşılaştırmalı test yapıldı.
- Mevcut PHP publication_validate işlevi, imzalı Studio katalog alanı içeren yerel sentetik publication ile sınandı: PHP_PUBLICATION_ACCEPTED (1 katalog öğesi). Sitenin image-only asset upload servisini değiştirmeden katalog ve belgeler publication.json içerisinde taşınıyor. PHP'de Vefk özel derin doğrulama henüz yok, bu canlı yayın öncesi koordinasyon kapısı.

**Site ekibine devir:** docs/contracts/VEFK_SITE_HANDOFF.md. V2 oturumu mevcut ham publication.json içindeki vefkCatalog alanını almalı, readVefkPublication(raw,sceneManifest) ile hash/binding kontrol etmeli, createVefkPlayer ile zaman bazlı path görünürlüğü ve nib koordinatı üretmeli. Yeni kalıcı parşömen/divit nesnesi yaratmamalı, hesaplama veya AI çalıştırmamalı. Mevcut V2 publication normalizer vefkCatalog'u bugün çıkışına taşımıyor; bu sahne oturumunun somut entegrasyon işi.

**Doğrulama:** S5 yerel seçilmiş onaylı revizyon, yeni taslakta eski sabit onay, seçimden çıkarma, deterministik fingerprint, hash'li tekil belge export, bozuk/tahrif edilmiş veri ve yanlış binding reddi, gerçek V2 sahne manifesti, eski publication çıktı uyumluluğu, tam Studio → publication v2 → ESM site tüketicisi → kalem/çizgi frame akışı Node testleriyle doğrulandı. Canlı deploy yapılmadı.

**Kalan:** S4 Studio zaman çizelgesi ince ayar UI'sı ve fiziksel divit kaldırma/geçiş süresi, kaynak el yazısı vektör kalitesi, V2 tarafında site tüketicisinin gerçek parşömenle bağlanması ve görsel E2E, PHP sunucu tarafı Vefk derin doğrulaması, son S6 canlı yayın testi. Bu işler tek oturumda gizlice V2 sahne dosyalarını düzenleyerek yapılmayacak.

## 23. S4 — Studio Zaman Çizelgesi ve Fiziksel Divit Hareketi (2026-11-04)

**Uygulandı:**
- apps/studio/src/VefkTimelineEditor.tsx ve vefk-timeline-editor.css: çizim ekranının altında daraltılabilir zaman çizelgesi. Stroke sırası yukarı/aşağı, çizim süresi, kalem geçişi, final bekleme, 0.5×/1×/2× hız, duraklat/oynat, başlangıca dön, zaman sürgüsü ve tam görünüm bulunur. Ekrana ikinci fiziksel parşömen eklenmez.
- apps/studio/src/vefk-timeline-model.ts: path kimliğini ve eski özel zaman sürelerini koruyan deterministik yeniden zamanlama. SVG yolu eklendi/silindiğinde kalan stroke'lar korunur, yeni yola tek yeni zaman aralığı eklenir. Mevcut S1 sürelere, marker sırasına ve çakışmalara ilişkin doğrulama aynen uygulanır. EditorInput artık özgün drawPlan'ı da gönderir. Kaynak görsel ya da sayı hücresi güncellemelerinde planın korunmasına dikkat edilir.
- Studio SVG artboard, paylaşılan docs/contracts/vefk-site-consumer.mjs oynatıcısından frameAt(t) alır; stroke-dashoffset ve divit uç konumu aynı hesaplamadan çıkar. Önizleme sırasında vektör düzenleme jestleri durur, Tam görünümle geri dönülür.
- Paylaşılan ESM oynatıcı, tek SVG path içindeki tekrarlanan M komutları ve Z kapanışı sonrasındaki yeni M alt yolu arasında kalemi kaldırır. Yeni alt yola penDown=false geçerken mürekkep görünürlüğü ilerlemez. İki path arasındaki zaman boşluğunda divit bir bitişten sonraki başlangıca mürekkep bırakmadan geçer.
- Oynatıcıda geriye uyumlu ek alan: frame.pen.phase = ready | drawing | travel | hold. Eski frame.pen.penDown, frame.pen.position, frame.visibility[].fraction ve pathId alanları korunur.
- Belge/yayın JSON sözleşmesi değişmedi: birdesengor.vefk schemaVersion 1, drawPlan timeUnit ms, publication v2, vefkCatalog ve sahne ankorları aynı. phase yalnız oynatıcı çıktısında bulunur. Güncellenen drawPlan içerik hash'ine girer.
- Testler: apps/studio/src/vefk-timeline-model.test.mjs ve apps/studio/vefk-pen-motion.test.mjs. Tekrarlı M, inter-stroke pen-up hareket, duration/gap/hold/reorder, SQLite revizyon onay ve deterministic seek/reverse testleri.

**Site ekibine not:** Güncel docs/contracts/vefk-site-consumer.mjs modülü kullanılmalı. V2 ayrıca pen koordinatı hesaplamamalı. frame.visibility[].fraction artık yalnız gerçekten çizilen mürekkebin uzunluk payıdır; path içi pen-up travel sırasında sabit kalabilir. frame.pen.phase divit kaldırma indirme ve bekleme pozları için kullanılabilir. M/L/Z yol grameri ve bağlama koordinatları değişmez.

**Açık kalan:** Fiziksel divit görsel animasyonunun hız/ivme ve uç pozunun görsel cilası, gerçek Electron fare/klavye testi, V2 sahne görsel E2E, PHP sunucu tarafı derin Vefk doğrulaması ve S6 deploy. Paralel V2 sahne dosyalarına veya Efekt Atölyesi'ne dokunulmadı.

## 24. S3.5c — Tarihî Kâğıt ve İnce Kaligrafi Mürekkep Ayrıştırması (2026-11-04)

**Amaç:** Gerçek vefk görsellerindeki ışık/kâğıt ton farklarının yanlış kontur çıkarmasını azaltmak, küçük Arapça/Osmanlıca yazı noktalarını kaybetmeden vektör izleyebilmek. S4 zaman çizelgesi ve S5 yayın bağlantısı bu üretimden çıkan aynı S1 yolu kullanıyor.

**İşlevsel değişiklikler:**
- apps/studio/src/vefk-ink-mask.ts: global sabit eşik korunarak, 2D integral görüntüyle O(1) piksel başına yerel ortalama/kontrast sınıflandırması eklendi. 12–512 px tek bölge rasterı, yerel kontrast 6–65 sınırında. Yerel mod eski kâğıt rengine ve kısmi ışık gradyanına karşı daha dayanıklı. Bunun bir OCR modeli veya tarihî metin doğrulayıcısı olduğu iddia edilmiyor.
- apps/studio/src/vefk-image-trace.ts: 8-komşu iskelet grafiğinin fazladan diyagonal dallanma oluşturmasını önleyen ortogonal bağlantı önceliği; kaynak bileşen analizi; tercihe bağlı, yalnız büyük mürekkep bileşenlerine yakın 2–12 px karemsi küçük noktaları S1 uyumlu kısa çizgilerle saklama; uzaktaki küçük lekeleri atma; dönüştürülen çizgilerin sayısını, küçük işaret/toz sayısını ve mürekkep oranını döndüren tanılama. İzler aynı M/L/Z sözleşmesine bağlı.
- Studio VefkSourceWorkbench.tsx: seçili bölgeyi 320 (dengeli) veya 480 px (ince yazı) üst sınırıyla örnekleme; Sabit eşik veya Eski kâğıt/yerel kontrast yöntemleri, ters renk, küçük noktaları koru seçeneği; bölgenin son çizim kalitesi ve örnek büyüklüğünü sağ panelde görme. Yeni izlemede eski o bölgenin konturu değiştirilir ama sonucunun onayı sıfırlanır; kaynak resim ve diğer bölgeler değişmez.
- İnce işaretler görsel yakınlık sezgisidir; otomatik tarihî harf/sayı tanıma veya garanti edilen doğruluk değildir. Her izleme grubu hâlâ review gerektirir, veri kaydı yeni onaylı analiz revizyonuna gider. 160 çizgi/bölge, 850 toplam sınır, kaynak görsel boyutu, optimistic source version, S1 SVG validation ve S2 immutable revizyonları korunur.
- Kodun doğrudan import edildiği Node TS testleri için Studio tsconfig'de yalnız noEmit derlemesinde allowImportingTsExtensions etkin; genel modül sistemini değiştirmedik.

**Doğrulama:** Düzgün çizgi, ayrı çizgiler, kapalı sınır, gürültü, bozuk bölge, eğimli parlaklık arka planı, yakındaki iki piksellik küçük noktanın korunması ve uzaktaki lekenin elenmesi, geçersiz kontrast/metod ve arayüz sözleşmesi testleri. Vefk birleşik paketi 97/97 PASS; Studio TypeScript + Vite build PASS; Studio shell/narrative IPC/Publication V2/AI provider contract ve git diff --check PASS. Gerçek eski vefk fotoğraflarıyla manuel Electron görsel doğrulama henüz yapılmadı.

**Açık kalite sınırları:** Tek bir AI alanında aşırı iç içe yazı varsa Zhang–Suen iskelet hâlâ küçük dallara ayırabilir; nokta/lekeler belirli yüzeylerde karıştırılabilir; 480px ince mod tüm büyük bölgelerde otomatik başarı garantilemez. Gerçek görsel üzerinde kaynak/vektör örtüşmesi karşılaştırılmasıyla kalite sınırı belirlenecek. Canlı site/parşömen/efekt dosyaları ve yayın sözleşmesi değiştirilmedi, Git commit/push/deploy yapılmadı.

## 25. Ters Renk İyileştirmesi ve Katalogdan Reasoning Seçimi (2026-11-04)

**Saha raporu:** Kullanıcının 2026-11-03 tarihli üç görselinde sağ kenardaki dikey Arapça yazı, normal yerel kontrast izinde 39 yol / %8,2 mürekkep; ters renk açıkken aynı bölgede 142 yol / %10,4 sahte mürekkep, 32 küçük işaret ve 67 parça raporladı. Bu, görünürde kâğıt dokusunu izleyen yalancı pozitiflerin üremesine yol açıyordu.

**Ters renk çözümü:** Studio'nun saf raster sınıflandırıcısı (vefk-ink-mask.ts) ters renk açıkken seçili görsel bölgesinin kaynak kenar parlaklık ortancasını kontrol eder. Açık parşömen / koyu mürekkep görselinde ters renk seçimiyle izleme başlatılırsa yeni kontur üretilmeden açıklayıcı hata döner; önceki onaylanmış veya inceleme bekleyen izler değişmeden kalır. Gerçek koyu zemin / açık mürekkep testinde ters renk çalışmaya devam eder. UI etiketi “Ters renk · koyu zemin” olarak netleştirildi. Bu otomatik zemin analizi, tarihler/işaretler için kesin OCR değildir.

**AI ortak reasoning sözleşmesi:** ai-reasoning.cjs metin/görsel model kataloglarında yalnız sağlayıcının fiilen bildirdiği `supportedReasoningEfforts`, `supportedThinkingLevels` ya da (OpenCode) `variants` değerlerini normalize eder. Model adından ultra, max, high vb. tahmin edilmez. Metadata seçenek belirtmiyorsa menü boş kalır ve modelin varsayılan ayarı kullanılır. Desteklenen literal seçenek adları mevcut modelin katalog cevabına özgüdür. Codex CLI model/list seçeneklerine mode=effort; OpenCode metadata varyantlarına mode=variant; Gemini metadata thinking seviyelerine mode=thinkingLevel; uygun OpenAI uyumlu metin/görsel modellerine mode=effort bağlanır. Cloudflare text-to-image genel bir reasoning parametresi bildirmediği için model arayüzünde geçersiz kontrol gösterilmez.

**Ayarlar:** AiProviderSettings.tsx'de aynı model-bazlı reasoning seçicisi Metin ve Görsel sekmelerine uygulandı. Farklı provider/model/endpoint'e geçişte eski seçenekler temizlenir; kaydedilmiş diğer sekme ayarları yalnız ilgili katalog yeniden çekilmediği için silinmez. api-config.cjs'de reasoningEffort/reasoningMode ve imageReasoningEffort/imageReasoningMode ayrıdır. Bu seçim Codex CLI metin/vision/görsel kontrolcüsünde metin ve görsel bazında, OpenCode isteklerinde variant alanında, Gemini generateContent thinkingConfig.thinkingLevel alanında ve destekleyen OpenAI-uyumlu metin/görsel JSON isteklerinde reasoning_effort alanında iletilir. Ana model hata ile yedek modele düşerse ana modelin reasoning ayarı yedek modele zorla verilmez.

**Sınır:** Bir sağlayıcının model listeleme endpoint'i gerçek reasoning seçeneklerini yayınlamıyorsa otomatik tahmin veya gizli model denemesi yapılmaz; Varsayılan kullanılır. Görsel üretim API'sinde standart olmayan, model özelinde doğrulanmamış reasoning parametreleri zorlanmaz. Gerçek üçüncü taraf API çağrılarında model bazlı runtime geçerlilik ayrı sahada doğrulanmalıdır.

**Doğrulama:** Sentetik ters renk (açık parşömen reddi + gerçek koyu zemin izin), 8 reasoning metadata/transport/kaydetme testi, OpenCode authenticated model/variant propagasyon kontrolü PASS. Birleşik Vefk+reasoning paketi 105/105 PASS, Studio TypeScript/Vite build PASS, AI provider contract, narrative IPC, Studio shell ve Publication V2 kontrolü PASS. verify-ai-service.cjs'de bu çalışmadan önce de mevcut olan video başlık testi farkı ("Düzenlenmiş Başlık" vs "Onarılan Video Başlığı") devam ediyor; ilgisiz anlatı/video testini bu turda değiştirmedik.

**Sınırlar:** Paralel V2 sahnesi, Efekt Atölyesi, canlı deploy, Git commit/push ve mevcut orijinal kaynak görsel verileri değiştirilmedi.

## 26. Studio kalan işler ve Yayınlama Vefk sayacı (2026-11-04)

**Yayınlama paneli tamamlayıcısı:** Kullanıcının önceki yayına hazırlama/yayınlama sorusunun ardından `PublishCenter` kartına mevcut `publicationPreview().counts.vefks` gösterimi, son yerel paketin kalıcı `vefkCount` değeri ve canlı yayın onay metninde vefk adedi eklendi. `publication-v2.cjs` yerel export dönüşü ile `storage-publication.cjs` metadata kayıt/okuması güncellendi. Demo seed artık metadata yazan tek Studio export hattını kullanıyor. Değişiklik `publication.json` şemasını, seçili vefkleri veya site tüketici kodunu değiştirmez. Yerel demo yayını yeniden hazırlanıp Studio metadata `vefkCount=1` kontrol edildi; V2 geliştirme API'si mevcut belgeyi doğruladı. Studio build PASS, sekiz katalog/site testinin tamamı PASS, Publication V2 verify PASS, diff check temiz.

**Studio öncelikli açık işler:**
1. Görselden çıkan çok parçalı iskelet çizgilerini birleştirme/sadeleştirme, kaynak boy-en oranını nihai vektörde koruma, el yazısı ve mühürlerin çizim doğruluğunu gerçek fotoğrafla karşılaştırma (S3.5c).
2. Studio Vefk Atölyesi üzerinde gerçek Electron fare/klavye QA: fotoğraf hazırlama, AI bölge/hücre kontrolü, ince çizgi izleme, SVG'ye aktarma, revizyon/onay, timeline, site kataloğuna seçme, yerel paket üretme. Dar ekran ve uzun içerik kaydırma/yerleşim kontrolleri.
3. Zaman çizelgesi ve divit mürekkep bırakma/kaldırma, çoklu alt-yol geçiş hızı, hız eğrisi ve stroke/nib pozları için görsel ince ayar (S4). Bu deneyin V2 sahne tasarımının fiziksel görünümüne dokunan kısmı paralel oturumda yapılır.
4. Yayın güvenliği: PHP sunucu tarafında `vefkCatalog` şemasının derin doğrulaması, paket boyutu/katalog sayısı/hash/ankor kontrolleri, canlı yayın öncesi uçtan uca test (S6).
5. Son oturum sınırı: paralel V2 site adaptasyonuyla birleşik gerçek sahne E2E, sonra kapsamlı regresyon ve kontrollü Git checkpoint/commit; canlı deploy/push yalnız açık izinle.

Katalogda zaten bulunan yerel `demo-vefk-5x5-v2` r1 kullanılır; gerçek fotoğraf henüz onaylıymış gibi siteye gönderilmez. OpenCode vision eklenmesi kullanıcı kararıyla ertelendi.

## 27. S3.5c — Kavşak Birleştirme, Halka Koruması ve Kaynak Oranı (2026-11-04)

**Bu geliştirme diliminin sonucu:** `apps/studio/src/vefk-image-trace.ts` üzerinde deterministik, korumacı iskelet birleştirme eklendi. Yalnız ortak **aynı mürekkep pikselinde** buluşan iki açık yolun uçları yaklaşık ters doğrultuda (teğet skoru < -0,86) ise birleştirilir; aradaki boşluk, ayrı Arapça noktalar ve farklı Y-kolları tahminle doldurulmaz. T/X kesişimlerinde doğrusal süreklilik korunur; kapalı çizgiler birleştirmenin dışında kalır. `simplifyStroke`, kapalı halkadaki eşit başlangıç/bitiş noktalarının RDP ile tek çizgiye çökmesini, uzak bir ankorda ikiye ayırarak engeller. Yeni sayısal ölçüm `quality.joinedSegments` yalnız Studio izleme ekranında görünür; veritabanı veya yayın şeması alanı değildir. S1'in güvenli M/L/Z kısıtı, 160 yol/bölge, 850 yol/kaynak, uzunluk, kaynak versiyonu ve insan kontrolü korunur.

**Kaynak geometrisi:** Fotoğraftaki bölgeler ve kayıtlı incelemeler yine `normalized-1000` düzlemindedir. Yalnız yeni onaylanmış izler `manualPaths` SVG taslağına aktarılırken kaynak görselin gerçek `naturalWidth/naturalHeight` oranı ile x koordinatları dönüştürülür ve yeni belge `geometry.viewBox` bu orana göre belirlenir. `VefkWorkshop.tsx` artboard boyutları, yüzeyi ve kılavuzları da belge viewBox'ını kullanır. Eski onaylı kareler/yayın paketleri dönüştürülmez; `birdesengor.vefk` schemaVersion 1 ve `publication` schemaVersion 2 aynen kalır. Yeni portre geometri S1 createVefk/contentHash, mevcut `createVefkPlayer` ve divit frameAt doğrulamasından geçti. Site el değiştirme sözleşmesine yeni alan gerekmedi.

**Gerçek fotoğraf denemesi (salt okunur):** Yerel kaynak arşivindeki 1448×1086 ve 1306×981 iki gerçek vefk fotoğrafı ve mevcut AI bölge kayıtları incelendi; hiçbir kaynak PNG, analiz revizyonu veya SQLite satırı değiştirilmedi. Birinci görselin üst Arapça yazı bölgesinde 144 yol / 76 birleştirme, yuvarlak mühür bölgesinde 159 yol / 58 birleştirme, sağ düşey yazıda 120 yol / 64 birleştirme gözlendi (480 px, yerel kontrast 22, küçük noktaları koru). Geçici örtüşme görüntüleri, mürekkep gövdelerini genel olarak izlese de AI bölgesine giren yırtık kâğıt kenarı ve ahşap liflerinin sahte kontur oluşturduğunu gösterdi; bu sonuçlar otomatik olarak doğru Arapça kaligrafi diye kabul edilmez. Çözüm olarak Studio kaynak inceleme ekranına seçili bölge için X/Y/en/boy düzeltmesi eklendi. Kutunun değişmesi yalnız kendi eski izlerini kaldırır, o bölgenin inceleme/onay durumunu sıfırlar, diğer bölgelere dokunmaz. Kullanıcı bölgeyi daraltıp yeniden izler ve SVG'de gözle kontrol eder.

**Doğrulama:** 18/18 `vefk-image-trace` testi PASS; bunların içinde T/X/Y kavşakları, kopuk kollar, kapalı mühür, portre/yatay görünüm, eski izlerin geçersiz kılınması ve yeni çizimin S1 → site oynatıcısı akışı var. Diğer seçili Vefk S1/S2/S4/S5/kaynak/yayın testleri 68/68 PASS; Studio TypeScript + Vite build PASS; `verify-publication-v2.cjs` PASS; demo 5×5 gerçek yerel V2 tüketici bağlantısı `ready` (34 yol/34 stroke, 35,41 sn). Site V2, Efekt Atölyesi, PHP canlı doğrulayıcı, Git commit/push veya canlı deploy yapılmadı.

**Bölüm 26'daki sonraki sıra:** (1) S3.5c'nin gerçek fotoğraflarda bölge düzeltme sonrası manuel Electron/kaynak vektör örtüşme QA'sı ve kaligrafi/mühür biçimi ince ayarı; (2) S1→S5 tam Electron fare/klavye ve dar ekran/scroll QA; (3) Studio içindeki S4 divit hareketi, uç/nib ve zaman eğrisi görsel cilası; (4) paralel site oturumu ile koordine edilerek S6 PHP derin yayın doğrulaması; (5) V2 sahne birleşik E2E ve geniş regresyon, Git checkpoint/deploy yalnız açık kullanıcı izniyle. **İzole Electron arayüz QA:** Studio mevcut kullanıcı veri kökü yerine `CHANNEL_FOUNDRY_DATA_ROOT=/tmp/bdg-vefk-electron-qa` ile Xvfb sanal ekranında ve geliştirici protokolüyle başlatıldı. 1280×800 ve 1080×720 görünümlerinde Vefk Atölyesi açıldı; global yatay taşma görülmedi. Yeni geçici 3×3 taslakta 14 yol ve 14,61 sn çizim planı render edildi. Dar ekranda %75 başlangıç yakınlaştırması çizimi fazla kesiyordu: bu yüzden `VefkWorkshop.tsx` çalışma alanına göre ilk yüklemede otomatik genişliğe sığdırma, manuel zoom tercihini koruma ve `Görünüme sığdır` kontrolü eklendi. 1080×720 sanal testinde sol menü açıkken merkez 364 px / artboard 320 px / zoom %32, sol menü dar iken merkez 536 px / zoom %50; kullanıcı zoom %42'ye getirdiğinde menü değişikliği bu tercihi bozmadı, tekrar sığdırma %50 verdi. İşlem yalnız geçici QA verisiyle yapıldı; gerçek Studio kaynakları/SQLite ve aktif masaüstü etkilenmedi. Tam gerçek görsel üstünde fareyle kaynak kırpma→AI/inceleme→SVG çizim→revizyon ve zaman çizelgesi manuel E2E kontrolü hâlâ açık.

## 28. S3.5c Gerçek Electron E2E ve S4 Studio Divit Pacing (2026-11-04)

**İzole gerçek-fotoğraf E2E:** Aktif BirDeSenGör Studio veritabanı ve kaynakları salt okunur incelendi; kullanımdaki hazırlanmış 1306×981 PNG, ilgili AI bölge önerilerinden yalnız üçü alınarak `/tmp/bdg-vefk-e2e-*` altında bağımsız SQLite/PNG test fixtürüne aktarıldı. Fixtürdeki mühür alanının normalize 1000 genişliği 194'ten 168'e daraltıldı; yeniden izleme **45 SVG yol, 13 birleştirme, 6 korunmuş küçük işaret, 8 atılmış toz izi** üretti. Bu değerler yalnız o daraltılmış seçim içindir; sayı azalması tek başına semantik kaligrafi doğruluğu kanıtı değildir. Alan sınırı değişince inceleme sıfırlandı; mühür etiketi ve konturlar insan onayı simülasyonuyla doğrulandı ve yeni inceleme revizyonu kaydedildi. Yeni `manualPaths` taslağı Studio Electron'da açıldı: gerçek fotoğraf oranı `viewBox=[0,0,1331.295,1000]`, 45 yol ve S4 zaman çizelgesi 49,65 sn. Taslak yerel fixtürde r1 kaydedildi, kontrolden geçip onaylandı, **sadece fixtürün yerel** site kataloğuna eklendi ve `public-export/content/publication.json` üretildi. Gerçek aktif Studio DB/katalog, orijinal fotoğraflar, demo 5×5 yayını ve canlı site değişmedi.

**S3.5c görsel kalite:** Geniş AI kaynak bölgeleri kâğıt/ahşap sınırını da kapsadığında doku çizgileri sahte kontur olabiliyor. Bölgenin gerçek işarete daraltılmasıyla daha temiz izleme elde edildi; bu otomatik Arapça harf tanıma veya kesin özgün vektör olduğu anlamına gelmiyor. Kaynak inceleme başlığı, uzun dosya adı işlem butonlarıyla yarışmasın diye iki satırlı düzenlendi; geçici Electron'da başlık 922 px genişlik ve 143 px yüksekliğe indi. Kaligrafi kaynakları her bölgede manuel karşılaştırma/onay gerektiriyor.

**S4 önizleme diviti:** `vefk-pen-pose.ts` saf Studio modülü, kanonik `createVefkPlayer.frameAt` örneklerinden hareket yönünü hesaplar. Çizim evresinde altın uç temas noktası gerçek konumda, çoklu alt-yol ve stroke-arası geçişlerde kalem 11 birim kalkık ve kesikli temas halkasıyla, bekleme evrelerinde 16 birim kalkık görünür. Yeni pozlar yalnız Studio SVG önizlemesinde; ortak site tüketicisi, hız eğrisi ve `birdesengor.vefk` / `publication` şemaları **değişmedi**. İzole Electron'da 0,35 sn için `is-drawing`/lift 0; 1,00 sn için `is-travel`/lift 11 gözlendi.

**S4 isteğe bağlı süre dengeleme:** `vefk-timeline-model.ts` içindeki `balanceStrokeDurations` güvenli M/L/Z mürekkep uzunluğu + sınırlı pen-up alt-yol payına göre 180 birim/sn varsayılan hızla süre önerir (her yol 180–6000 ms). Stroke sırası, ID, kalemler arası geçiş ve son bekleme aynen kalır; tüm öneri S1 çizim planı doğrulamasından geçer. Öneri yalnız Studio zaman çizelgesindeki saat kontrolüyle yeni **taslakta** uygulanır; kullanıcının ayrıca kaydetmesi gerekir, mevcut onaylı revizyon değişmez. Gerçek 45 yolluk test fixtüründe onaylı r1'in 49,65 sn süresi, kaydedilmemiş r2 önerisinde 20,78 sn oldu; site paketini değiştirmedik. Görsel cihaz testleri ile sayısal pacing testleri birbirinden bağımsız.

**Dar ekran:** 1080×720'de iki yan panel ve genişletilmiş timeline merkez çizim yüzeyini fazlaca daraltıyordu. 1200 px ve altında özellikler paneli isteğe bağlı sağ overlay; ilk açılışta kapalı; S4 timeline açık yüksekliği 200 px ve 950 px altında 180 px olarak sınırlandı. Kaynak modunun kendi inceleme paneline ve V2 site CSS'ine dokunulmadı.

**Doğrulama/kısıtlar:** 17 Vefk test dosyasında 112/112 PASS; divit poz, süre önerisi ve dar ekran regresyonu dâhil. Studio TypeScript/Vite derlemesi PASS. 1080×720 izole Electron tekrar kontrolünde özellikler kapalıyken merkez 777 px, çizim alanı görünür boyutları 767×211 px, zaman çizelgesi 199 px; sayfa genelinde yatay taşma yok. Özellikler paneli sağda 285 px overlay olarak açılıyor, çizim alanını daraltmıyor. Demo 5×5 V2 tüketici doğrulaması tekrar `ready` (34 yol/34 stroke, 35,41 sn, mevcut fingerprint değişmedi); Publication V2 doğrulayıcısı ve `git diff --check` PASS. Gerçek kaynak üzerinden fotoğraf hazırlama + AI model çağrısı fixtürde yapılmadı: AI sonuçları mevcut arşivden salt okunur alındı; dolayısıyla tam AI OCR doğruluğu bu testin kapsamı değil. Paralel V2 site/Efekt Atölyesi, S6 PHP doğrulayıcı, Git commit/push, canlı deploy yapılmadı.

**Sonraki iş sırası:** Sonraki gerçek fotoğraf/Arapça kaligrafi örneklerinde yüzey dokusunu semantik mürekkepten ayıran seçmeli maske önizlemesi/filtreleme kalite çalışması; gerekli ise Studio S4 easing parametrelerinin **kanonik oynatıcı ile site tarafıyla eşgüdümlü** tasarlanması; PHP sunucu tarafı S6 doğrulamasının paralel V2 oturumu ile çakışmadan ayrı onaylı dilimde ele alınması; bütünleşik gerçek sahne E2E. Önceden belirlenen Git ve canlı deploy yasağı sürüyor.

## 29. S3.5c — Seçmeli Mürekkep Maskesi ve Doku Dışlama (2026-11-04)

**Temel karar:** Kaynak fotoğraflar üzerinde renk histogramı incelendiğinde mühürdeki koyu iz ile kâğıt belirgin ayrışırken soluk Arapça kaligrafide koyu piksellerin renk tonu parşömen dokusuna yaklaşabiliyor. Otomatik renk elemesi harfleri ve ayrı noktaları yanlış silebileceğinden agresif renk filtresi uygulanmadı. Bunun yerine aynı mevcut `global/adaptive` sınıflandırıcının **tam gerçek piksel maskesini** fotoğraf üzerine pembe RGBA olarak koyan, isteğe bağlı geçici bir önizleme eklendi.

**Seçmeli alan dışlama:** Studio'nun kaynak inceleme ekranına `Mürekkep maskesi` ve `+ Doku dışla` kontrolleri eklendi. Seçili AI bölgesinin içinde fareyle çizilmiş dikdörtgenler normalleştirilmiş `0–1000` koordinatında tutulur; çizim alanına kırpılır. `vefk-ink-exclusions.ts` saf maske işleyicisi kaynak pikselleri değiştirmeden yalnız bu alanlardaki aday mürekkep piksellerini kaldırır, tekrar eden dışlamaları iki kez saymaz, 24 alan/bölge sınırını uygular ve geçersiz koordinatları reddeder. Aynı işleyici önizleme ve `traceInk` hattında çağrıldığı için gösterilen maskeyle yeni kontur örneklemesi aynı seçimleri kullanır. Son alanı geri al / alanları temizle kontrolü var. Maske önizlemesi, bölge/koordinat/eşik/kontrast/örnekleme/ters renk/dışlama değişiminde geçersiz kılınır.

**Güvenlik ve veri:** Dışlamalar **yalnız aktif Studio oturumu içindir**; onaylanan konturlar zaten mevcut analizde SVG `M/L` yolları olarak saklanır. Kaynak PNG, önceden kaydedilmiş analizler ve V2 katalog şeması değişmedi. Bölgenin dışlama maskesi değiştirilirse yalnız o bölgenin eski (hatta onaylı) konturları çalışma belleğinden kaldırılır, ilgili bölge yeniden doğrulama bekler; diğer bölgelere ve canlı/paketlenmiş sürümlere dokunulmaz. Kaydetmeden kaynak arşivine dönüldüğünde eski kalıcı analiz yerinde kalır. Maske **otomatik OCR/semantik doğrulama değildir**; ayrı Arapça noktaların yanlış dışlanmaması insan gözlemine bağlı.

**Gerçek fotoğraf GUI deneyi:** 1306×981 hazırlanmış kaynak ve mevcut analizler bağımsız `/tmp/bdg-mask-electron-*` SQLite/PNG kopyasıyla Xvfb Electron'da açıldı. `region-003` mühür seçiminde ilk maske 9.215 piksel gösterdi; fareyle çizilen ilk dışlama 400 mürekkep adayını kaldırdı ve maske 8.815'e düştü; PNG değişmedi. Daha önce onaylı 34 kontur bulunan `region-005` Arapça yazı bölgesine dışlama çizildiğinde bu 34 yol çalışma alanından temizlendi; tekrar izleme 23 yeni **onaysız** yol, 13 iskelet birleştirme, 2 korunan küçük işaret, 15 toz izi eleme ve 61 elle dışlanan aday piksel raporladı. **34 ve 23, farklı kaynak izleme ayarlarından geldiği için doğrudan doğruluk ölçümü olarak karşılaştırılamaz**. UI ve gerçek fare olayları gözlendi, gerçek Studio/yerel demo ve siteye yazılmadı.

**Doğrulama:** `vefk-ink-exclusions.test.mjs` beş yeni regresyon, önceki 112 test ile birlikte 18 dosyada **117/117 PASS**. Rect maske sınırları, kaynak alt-bölge koordinatları, tekrar eden dışlama, bağımsız diakritik, kontur deterministikliği ve geçersiz girişler denetlendi. Studio TypeScript/Vite build PASS. İmzalı yayın sözleşmesi veya divit oynatıcısı değişmedi.

**Kalan sıra:** S3.5c gerçek fotoğraflarda birden fazla harf/mühür bölgesinin gözle nokta-uzantı kaybı karşılaştırması ve gerekirse *oturum içi* maske iyileştirmeleri; S4 kanonik easing önerisinin site V2 paralel oturumuyla koordinasyonu; S6 sunucu tarafı derin katalog doğrulaması ayrı dosya sahipliğiyle; gerçek sahne E2E. Paralel site V2/Efekt Atölyesi dosyaları, Git commit/push ve canlı deploy mevcut sınırlarıyla korunur.

## 30. S3.5c — Altı Gerçek Alanın Kontrast Kıyaslaması ve Seçmeli Maske Galerisi (2026-11-04)

**Kapsam ve kaynak:** Mevcut `c5e0468b…png` hazırlanmış 1448×1086 fotoğrafının analiz #7 kaydındaki altı ayrı alan (region-002 üst Arapça, -003 daire mühür, -004 sol yazı, -005 sağ yazı, -006 üst sembol, -007 alt Arapça) salt okunur alındı. Aynı kaynak bölgesi, 480 px'e kadar örneklemede sabit `adaptive` kontrast 16/22/30/38 ve `global` 100/135 ile karşılaştırıldı; geçici PNG/maskeler yalnız `/tmp/bdg-arabic-qa` altında tutuldu. Karşılaştırma otomatik yazı tanıma doğruluğu ölçütü değildir.

**Gözlemler:** Region-002 için kontrast 22'de 144 yol/34 küçük işaret; kontrast 30'da 103 yol/26 işaret görüldü. Region-003 mühürde 159 yol/61 küçük işaret → 92 yol/34 küçük işaret; region-004 sol yazıda 67/26 → 30/5; region-005 sağ yazıda 120/49 → 72/14; region-006 sembolde 21/6 → 13/5; region-007 alt yazıda 9/2 → 8/1. Bunlar **aynı örneklem ve farklı eşik** sonuçlarıdır. Yol sayısının düşmesi harfin doğruluğunu kanıtlamaz: özellikle sol/sağ yazıdaki küçük noktalar ve ince uzantılar yüksek kontrastta kaybolabiliyor. Mühür AI alanı ahşap zemini ve yırtık kâğıt kenarını kapsıyor. Region-007'de alt satır yazısının önemli bölümü AI kırpması dışına düşüyor; yalnız kontrast değiştirmek bu geometriyi onaramıyor. Bu nedenle tek bir otomatik filtre varsayılan yapılmadı.

**Uygulama:** `vefk-ink-compare.ts` Studio'ya ait saf `compareInkMasks` yardımcı modülüdür; aktif kontrast/eşik değeri etrafında arayüzün geçerli sınırlarına kırpılmış üç deterministik seçenek üretir (adaptive ±8 / global ±20). Her alternatif gerçek `classifyInk + excludeInkFromMask` hattında hesaplandığından eldeki elle çizilmiş dışlama alanlarını eşit uygular; kaynak pikselleri ve analiz kaydını değiştirmez. Çıktıda aday mürekkep yoğunluğu (%), ince 2–5 px dış çerçevedeki aday yoğunluğu (%) ve önizleme maskesi bulunur. Kenar yoğunluğu için görünür uyarı yalnız **bilgilendiricidir**, otomatik silme veya semantik etiketleme yapmaz.

**Arayüz:** `VefkSourceWorkbench.tsx` içinde `3 maskeyi karşılaştır` düğmesi, fotoğraf+yarı geçirgen pembe piksel katmanlı üç küçük görüntüyü ve yoğunluk ölçümlerini gösterir. Her alternatif tıklanarak yalnız mevcut yerel kontrast/eşik ayarına geçirilir; SVG onayı, revizyonu, yolları veya yayın paketi **değişmez**, yeniden izleme hâlâ ayrı kullanıcı işlemidir. Parametre seçimi sonrası diğer iki alternatif ekranda kalır; kaynak bölgesi, dışlama, örnekleme, polarite veya algılama türü değişirse kıyaslama geçersiz olur. 1080 px ve dar inceleme panelinde karşılaştırma kartları üç dar sütun yerine üç dikey satır, her satırda solda fotoğraf ve sağda ölçümler olarak düzenlendi. Karşılaştırmanın kapanması ve ayarların değiştirilmesi kayıt veya canlı yayın işlemi değildir.

**Doğrulama:** Yeni `vefk-ink-compare.test.mjs` içindeki dört test; sabit/yerel eşik kısıtları, piksel değişmezliği, dışlama koordinatı, deterministik çıktı ve seçim sonrası eski yol onayının korunması için statik kontrol içerir. Tüm ilgili 19 Vefk test dosyası **121/121 PASS**, Studio TypeScript/Vite build PASS. İzole Electron 1080×720 denemesinde Arapça region-005'in onaylı 34 yolu, 22→30 ayar seçimi sonrasında aynı şekilde onaylı kaldı; üç karşılaştırma kartı ekranda kaldı, sağ panel karşılaştırma alanında `clientWidth=scrollWidth=189px`, sayfada `scrollWidth=1080px` (yatay taşma yok). Gerçek fotoğraf ve SQLite yalnız geçici bağımsız kopyada test edildi.

**Sonraki sıra:** S3.5c'de kalan gerçek referansların manuel, semantik nokta/harf karşılaştırması (otomatik model kararı değil); Studio S4 hız eğrilerinin siteyle *ortak* kanonik oyuncu sözleşmesini değiştirmeden yalnız öneri ve test tasarımı; S6 sunucu tarafı derin yayın doğrulaması ve V2 sahne E2E, site V2 oturumunun dosya sahipliği boşalınca. Bu bölümde site/web, Efekt Atölyesi, sözleşme şemaları, Git commit/push veya canlı deploy yapılmadı.

## 31. S4 — Kanonik-uyumlu Yollar Arası Tempo Eğrileri (2026-11-04)

**Önemli sözleşme ayrımı:** Kanonik `docs/contracts/vefk-site-consumer.mjs` oynatıcısı mevcut `schemaVersion=1` içinde her `drawPlan.stroke` içindeki çizgiyi **doğrusal zamana** göre oynatır; yol-altı `M` hareketleri ve stroke-arası `penDown=false` hareketler ayrı `travel` evreleridir. Bu tüketicide hiçbir `ease`, `curve`, özel faz kimliği veya şema alanı bulunmaz. Bu yüzden Studio içinde kullanılan, siteye aktarılamayan sahte bir intra-stroke hız eğrisi yapılmadı; S4 geliştirmesi mevcut `startMs / durationMs / gap / hold` bileşenleriyle tam yayın uyumlu **yollar arası tempo** olarak tamamlandı. Tek yol içi ivmelenme ileride V2 sahne oturumuyla ortak kanonik protokol tasarımı gerektirir; bu oturumda site koduna ve el değiştirme sözleşmesine dokunulmadı.

**Uygulama:** `apps/studio/src/vefk-timeline-model.ts` içinde `applyStrokeTempoCurve` üç isteğe bağlı profil sağlar: `slow-opening` (yavaş açılış), `slow-ending` (yavaş kapanış), `ceremony` (açılış ve kapanışta ağır ritim). Profil, SVG güvenli `M/L/Z` kalem çizim uzunluğu ve kanonik oynatıcının sınırlandırılmış pen-up maliyeti üzerinden hesaplanır. Bir yolun nokta sayısına veya eskiden eğrilmiş sürelerine değil, gerçek geometrisine dayanır; aynı profilin iki defa uygulanması veya profilden profile geçişler **sonucu katlayarak değiştirmez**. Değişen yalnız sıralı stroke süreleridir; orijinal zaman bütçesi tam sayı milisaniye ve deterministik en büyük kalıntı dağıtımıyla **birebir korunur** (her stroke en az 1 ms). Yol ID'leri, mürekkep katmanı, vektör koordinatları, yol sırası, yol-arası kalem geçişleri ve sondaki bekleme aynıdır. Planın S1 normalizasyonu ve V2 `createVefkPlayer.frameAt` ile eşlenik görünümü doğrulanır.

**Studio kullanım yüzeyi:** `VefkTimelineEditor.tsx` zaman çizelgesine `Yollar arası tempo eğrisi` seçimi ve `Eğri uygula` eklendi. Onay veya yayın sırasında değil yalnız düzenlenebilir taslakta çalışır. Oynatma düğmesindeki `½×/1×/2×` görünüm hızı ile kaydedilen çizim temposu birbirinden bağımsızdır. Uygulama sonrası ayrıca `Kaydet` gerekir. Tek çizgi içindeki hızın hâlâ doğrusal olduğu denetimin açıklamasında belirtilir. `vefk-timeline-editor.css` mevcut dar ekran düzeninde kontrolleri korur.

**İzole gerçek Electron E2E:** Studio `CHANNEL_FOUNDRY_DATA_ROOT=/tmp/bdg-s4-tempo-electron-*` ile geçici SQLite verisinde Xvfb altında açıldı, yeni 3×3 vefk oluşturuldu (14 yol, toplam 14,61 sn). `Yavaş kapanış` uygulandığında ilk çizim 700→468 ms, son çizim 950→1263 ms oldu; toplam 14,61 sn, 13×140 ms geçiş ve 740 ms bitiş beklemesi korundu. Taslak r1 olarak kaydedildi: geçici SQLite `vefk_revisions` satırında `draft|1|b77237c1c626…|durationMs=14610|strokes=14|ΣstrokeDuration=12050`. Bu test verileri gerçek Studio katalog/demoya aktarılmadı. Kullanıcının önceki demo 5×5 yayını artık yalnız atılabilir test örneğidir: yeni eğriler için onu korumaya dönük uyarlama/fallback/migration yok.

**Görüntü ve erişim:** 1080×720 gerçek renderer boyutu CDP ile doğrulandı: genel yatay taşma yok (`document.scrollWidth=1080`), çizim zamanı paneli 199 px, zaman çizelgesi kontrolleri erişilebilir. Geniş→dar geçişte özellikler overlay'i varsayılan kapatılır; kullanıcı sağ paneli elle açtıktan sonra sonraki dar/geniş geçişleri bu tercihi zorla değiştirmez. Bu değişiklik yalnız Studio `VefkWorkshop.tsx` bileşenindedir.

**Sınır/regresyon:** Yollar arası eğrilerin kanonik yayın uyumu, içerik hash'i, beklemeler, milisaniye toplamı, pen-up ve multi-`M`, kapalı mühür `Z`, dikey/yatay görünüm kutusu, 1 ms yol sınırı, tek-yol ve yeniden-uygulama deterministikliği yeni testlerle doğrulandı. Geniş Vefk testleri 19 dosyada **127/127 PASS**; Studio TypeScript/Vite derlemesi PASS (son doğrulama). Site V2 / Efekt Atölyesi / PHP canlı doğrulama / Git commit-push / canlı deploy kapsam dışı.

**Sonraki sıra:** (1) S4 yol-içi eğriler için V2 site oturumuyla yazılı ortak gereksinim ve geri uyumlu veri modelinin tasarlanması; mevcut playerı tek taraflı değiştirmeme. (2) S6 PHP sunucu tarafı derin katalog doğrulaması, V2 dosya sahipliği koordinasyonuyla. (3) Yeni oluşturulmuş/atılabilir test vefkleriyle sahne divit+grid eşzamanlılığı uçtan uca testleri, yayın dağıtımı ayrı izinle.

## 32. S4 Çizgi-İçi Easing Laboratuvarı + S6 PHP Kabul Denetimi (2026-11-04)

**S4 sözleşme kararı:** V2 kanonik oyuncu `drawPlan.strokes[].durationMs` içinde doğrusal ilerler ve tek çizgi içi `easing` alanı tanımaz. Bu oturumda **ortak sözleşmeye veya siteye sessiz alan eklemedik**. `apps/studio/src/vefk-intrastroke-preview.ts` ile yalnız Studio belleğindeki deneysel oyuncu oluşturuldu: `linear/ease-in/ease-out/ease-in-out`. Bu oyuncu güvenli ve değişmez `createVefkPlayer(document)` temelinin zamanını, yalnız aktif stroke aralığında eğriyle yeniden örnekler; tüm mürekkep, çoklu `M` pen-up, kapalı `Z`, divit konumu ve yol görünürlüğü **aynı kanonik kareden** alınır. Stroke'lar arasındaki boşluk, son hold, uç noktalar ve toplam süre değişmez; sonuç `frameAt(t)` ile deterministik, ileri/geri seek bağımsızdır. Doğrusal varsayılan eski oynatıcıyla birebir eşlenir. Kod S1 belgesine/SQL'e/publication'a herhangi yeni alan yazmaz.

**Studio arayüzü:** `VefkTimelineEditor.tsx` zaman çizelgesinde `Çizgi içi · Deney` seçim kutusu görünür: `Doğrusal (site)`, `Hızlanan`, `Yavaşlayan`, `Yumuşak giriş/çıkış`. Açıklama doğrudan kullanıcıya **yalnız önizleme; kaydedilmez, yayınlanmaz; site doğrusal** mesajı verir. Seçim geçici React durumudur, yeni belge/revizyonda doğrusal moda sıfırlanır. Studio `VefkWorkshop.tsx` görünür yol ilerlemesi ve divit ucunu aynı deneysel kareden alır. Kanonik oyuncu ve `docs/contracts/VEFK_SITE_HANDOFF.md` / `vefk-site-consumer.mjs` dosyaları değişmedi. İleride tek yol içi ivmenin siteye aktarılması **ayrı, karşılıklı** schema/hash/validator kabulü ve çift uçlu test gerektirir.

**İzole Electron kanıtı:** `CHANNEL_FOUNDRY_DATA_ROOT=/tmp/bdg-s4-curvelab-*` ve Xvfb; yeni 3×3, 14-yolluk geçici vefk; 1080×720 pencerede zaman 200 ms. İlk yol dashoffset değeri doğrusal `0.7142857143`, hızlanan `0.9183673469`, yavaşlayan `0.5102040816`, tekrar doğrusala dönünce **aynen ilk değer** oldu. R1 taslak kaydı çalıştı; geçici SQLite `vefk_revisions` satırı `draft, r1, hash=00497e7e51bf…, durationMs=14610, 14 strokes`. SQL içindeki `drawPlan` anahtarları ve stroke alanları kanonik kaldı; `easing` ya da deney profili kaydedilmedi. Genel yatay sayfa taşması yok (`scrollWidth=1080`), timeline açık 199 px. Test, gerçek Studio kataloğuna veya sunucuya yazmadı.

**S6 okuma/karşılaştırma:** `channels/birdesengor/web/public/api/studio/publication.php` içindeki `publication_validate()` gerçek yerel `publication.json` üzerinde **salt-okunur PHP CLI** ile gözlemlendi. Sağlıklı yayın kabul edildi; belge başlığı sahteciliği, güvensiz SVG, sahte quill ankordu, katalog hash sahteciliği, `../` URL, yanlış revizyonun **6/6'sı PHP tarafından kabul edildi**. `docs/contracts/vefk-site-consumer.mjs` ise aynı değişikliklerin **6/6'sını reddetti** (üst yayın içerik fingerprint'i dahil). Bunun anlamı PHP sunucu **girdi kabulünde derin Vefk doğrulaması eksik**; tek başına istemci sahnesinin güvenlik ihlali kanıtı değildir. Bu açığı gizlemiyor, bir test kusuru olarak da kapatmıyoruz.

**S6 araç ve devir:** `apps/studio/vefk-s6-boundary-audit.mjs` hiçbir POST/deploy/SQL yazma yapmadan aynı 7 fixtürü PHP ve kanonik ESM'e sürer. Şu an `S6_ACCEPTANCE_BLOCKED=6`/exit 2, PHP düzeltilince `S6_ACCEPTANCE_PASS`/exit 0 beklenir. Ayrıntılı sunucu hash/JSON/scene/asset doğrulama ve değiştirmeme kriterleri `docs/VEFK_S6_SERVER_ACCEPTANCE.md` içinde. Site PHP / V2 sahne / Efekt Atölyesi dosyaları paralel oturuma aittir; **değiştirilmedi**. Demo 5×5 yalnız atılabilir test verisi, ona özel uyumluluk veya migration/fallback eklenmedi.

**Son doğrulama:** 20 Vefk test dosyası **133/133 PASS**, Studio TypeScript/Vite build PASS, Publication V2 doğrulaması PASS ve `git diff --check` PASS. Deneysel `frameAt` doğrusal modda mevcut kanonik tüketiciyle birebir; 1080×720 Electron'da deneme/geri dönüş/SQLite kaydı doğrulandı. S6 salt-okunur 7-fixtür denetiminde 1 sağlıklı kabul, PHP tarafında 6 istenmeyen kabul ve kanonik JS tarafında 6 doğru ret; PHP S6 kapısı BLOCKED.

**Sonraki sıra:** Ortak yol-içi motion şeması site oturumunun dosya sahipliği uygun olduğunda iki taraflı koordine edilecek; S6 PHP girdi doğrulaması site tarafında düzeltildikten sonra aynı audit 7/7 geçmeli; devamında yeni test vefkiyle parşömen/divit mürekkep eşzamanlılığı E2E. Git commit/push ve canlı deploy açık izne kadar yasak.

## 33. S4–S6 Sentetik Saha Sözleşmesi ve PHP Referans Kapısı (2026-11-04)

**Önemli dosya sahipliği:** Site V2 ve Efekt Atölyesi dosyaları **salt okunur** incelendi. PHP, V2 sahne/kamera/parşömen/divit/efekt dosyası değiştirilmedi; Git commit/push ve canlı deploy yok. Studio/OpenCode bağlantısı denetim boyunca 200 döndü. Kullanıcının eski demo 5×5 vefki bağlayıcı veri değildir. Yeni sentetik 3×3 vefk (14 yol) üretildi, tüm yayın/animasyon testleri bununla da çalıştı.

**S4 çapraz sahne sözleşmesi:** `apps/studio/src/vefk-s4-site-sync.test.mjs` ile kanonik `docs/contracts/vefk-site-consumer.mjs` ve V2 site içindeki tüketici **byte-byte eşit**. İki oyuncu da 3×3 yeni vefk ve 1331.295×1000 viewBox'lu, çoklu `M` Arapça çizgisi + `Z` mühür + nokta içeren manuel örneği yüzlerce zaman noktasında aynı yorumluyor. `visibility` → `pathLength=1` / `strokeDashoffset`, pen konumu → `fitContainViewBox` ve ekran koordinatı 760×430 / 360×280 / 900×900 / 481×210 yüzeylerinde aynı. Kalem `travel` sırasında `penDown=false` ve mürekkep sabit; seek ve son reduced-motion kare deterministik. V2 `useVefkExperience.js` aynı `frameAt(timeMs)` kaynağını kullanıyor; ayrı 110ms CSS gecikmesi yok, `transitionMs:0`. Dört çapraz test **4/4 PASS**. Bu sözleşme/görüntü geometrisi testidir; gerçek tarayıcı fiziksel E2E'nin yerini tutmaz.

**S6 ilk güvenlik açığı ve onarım adayı:** Güncel PHP `publication_validate` mevcut Vefk alanını derin doğrulamadan kabul ediyor. Referans `docs/contracts/vefk-s6-php-gate.php` **siteye entegre edilmedi**. Bu PHP kapısı güvenli SVG M/L/Z, benzersiz path/stroke/marker, zaman sınırları, v1 izinsiz `easing`, sahne ankorları, belge/katalog/üst publication hash bütünlüğünü ve UTF-8/JSON nesne türünü denetler; Vefk katalogsuz genel V2 yayını eski davranışla bırakır. Özellikle gerçek yayındaki boş JSON `visual: {}` alanlarını PHP ilişkisel `[]` ile karıştırmamak için orijinal isteğin typed `stdClass` biçimi zorunlu. Referans PHP lint PASS; `vefk-s6-php-gate.test.cjs` **15/15 PASS**. Ayrı 11 senaryolu audit: sağlam ve tam hash'li yeni başlık **2 kabul**, bozulmuş (3'ü tutarlı yeniden hash'lenmiş) **9 ret**; eski demo bağımsız tamamen yeni 3×3 yayında da **11/11 PASS**. Mevcut gerçek PHP bağlantısı ise bunları hâlâ kabul ediyor; üretim S6 **BLOCKED**. Sunucuya POST, HTTP yayın veya asset yazımı yapılmadı.

**S6 ikinci şema tutarlılık açığı:** `apps/studio/vefk-s6-consumer-schema-audit.mjs` sentetik schemaVersion 1 vefke izinsiz `stroke.easing` ekleyip tüm SHA katmanlarını tutarlı yeniledi. S1 çekirdeği ve PHP referansı **REJECT**, site ESM tüketicisi **READY**; bu, JS'te v1 stroke alan izin listesinin eksikliğini gösterir (tek başına kod çalıştırma açığı göstermez). `S6_SITE_SCHEMA_STRICTNESS_BLOCKED` exit 2 kasıtlı uyarıdır. Kalıcı tek çizgi easing özelliği için `docs/contracts/VEFK_STROKE_MOTION_V2_PROPOSAL.md` önerisi hazır: v1 kesin doğrusal kalır; yeni capability kabul edilirse ayrı schemaVersion 2, kanonik oyuncu/PHP/site ortak sürüm kapısı gerekir. Site oturumu koordinasyonu olmadan v1'e easing yazılmayacak.

**Kanıt toplamı:** 22 Vefk test dosyası **152/152 PASS**; Studio TypeScript/Vite build PASS, Publication V2 doğrulaması PASS, `git diff --check` PASS. S6 başvuru/uygulama talimatı `docs/VEFK_S6_SERVER_ACCEPTANCE.md` içinde. Bir sonraki dilimde site sahibi PHP kabulü (4xx+hiçbir dosyaya yazmama) ve JS v1 katılık hatasını kendi oturumunda düzelttikten sonra iki audit exit0 olacak; daha sonra gerçek parşömen/divit/browser E2E ve v2 motion desteği karşılıklı tasarımla tamamlanacak.

## 34. S6 Matematiksel Semantik Kapanışı ve Tek Oturum Devri (2026-11-04)

**Çakışma kararı:** Kullanıcı paralel BirDeSenGör V2 görsel oturumunun sürdüğünü bildirdi (ekran görüntüsünde mum P7.4). Bu Studio oturumu `channels/birdesengor/web`, `channels/birdesengor/web/public/api/studio`, efekt motoru ve ortak `docs/contracts/vefk-site-consumer.mjs` dosyalarını **değiştirmedi**. Ortak PHP ve kanonik site oynatıcısını değiştirmek zorunlu hale geldiği anda çalışmalar tek oturumda birleştirilecek; ara el değiştirme kuralları `docs/VEFK_SINGLE_SESSION_HANDOFF.md` dosyasında yazılıdır. Git temizleme/commit/push, gerçek HTTP yayın ve canlı deploy yok.

**Yeni S6 fark analizi:** S1 `vefk-core` ile PHP referans doğrulayıcısının semantik kuralları karşılaştırıldı. Tüm SHA katmanları yeniden üretildiği halde PHP'nin kabul ettiği **7 başlangıç doğrulama farkı** yakalandı: sahte matematik karesi, geçerli sayıların değiştirilmiş yerleşimi, sahte algoritma kimliği, normalize edilmemiş SVG, hücre semantik değeri uyuşmazlığı, beklenmeyen mürekkep stili alanı ve hatalı tasarlanmış erişilebilirlik test varsayımı. Sonuncusunda gerçek S1'in erişilebilirlik açıklamasına özel metni **izin verdiği** görüldü; test doğru kabul olarak düzeltildi, fazladan kısıt eklenmedi.

**S1 ile matematik eşlemesi:** `docs/contracts/vefk-s6-php-gate.php` şimdi 3/5/7 `siamese-odd` algoritmasının `first/step/order` değerlerini, deterministik hücre yerleşimini, satır/sütun/çapraz toplamlarını, `checks` raporunu ve her `cell.rNcM` SVG yolunun `semanticValue` değerini doğrular. `manualSquare` için **yapısal** (sihirli toplam zorunlu olmayan) kontrol; `manualPaths` için yalnız geometri kontrolü geçerlidir. Tüm bu kontroller kriptografik hash'ten **ayrıca** uygulanır. Geçerli 5×5 ve 7×7, negatif/azalan sayılar, çok parçalı `M` yolu ve kapalı mühür sentetik testleri geçti.

**Ek dil/ölçü kuralları:** PHP utf-8 kod noktalarını değil JS S1'in **UTF-16 kod birimi** uzunluğunu sayar. Tek başına Unicode boşluklarından oluşan zorunlu başlık reddedilir. SVG mutlak noktaları `-100000..100000` aralığında olmalı (viewBox daha geniş olsa bile). Stroke/marker kimlikleri, SVG yolları, stiller ve erişilebilirlik alanları da referans kurallarına göre denetlenir; `mbstring` bağımlılığı yok.

**Kanıt/sınır:** PHP referans `vefk-s6-php-gate.test.cjs` artık **31/31 PASS**; 3×3, 5×5, 7×7 ve `manualSquare/manualPaths` pozitif/negatif testler dahil. Bunun, gerçek site sunucusunun PHP kabul açığının kapandığı anlamına gelmediği tekrar teyit edildi. Gerçek PHP endpoint ile JS site tüketicisinin iki bağımsız uyarısı (`S6_ACCEPTANCE_BLOCKED` ve `S6_SITE_SCHEMA_STRICTNESS_BLOCKED`) **kasıtlı açık** tutulur. Dosya sahibi site oturumu PHP yetkili isteği/4xx/yazma-sıfır kanıtını ve JS v1 alan katılığını ortak sürüm halinde tamamlayacaktır.

**Birleşme sınırı:** Bağımsız Studio S6 referans, test ve doküman işleri güvenli çalışma sınırına geldi. Bundan sonraki ortak site PHP + vefk tüketici + kalıcı motion v2 + gerçek fiziksel E2E dosyaları için **tek çalışma oturumu** seçilmelidir. Genel doğrulama ve devir adımları `docs/VEFK_SINGLE_SESSION_HANDOFF.md` içinde; demo 5×5 arşivine özel geri uyum veya migration yok.

**34. bölüm son doğrulama (aynı gün):** 22 Vefk test dosyasında **168/168 PASS**; PHP semantik/doğrulama testi **31/31 PASS** (genel testin içindedir), PHP `-l` PASS, Studio TypeScript/Vite build PASS, Publication V2 doğrulaması PASS, `git diff --check` PASS. Aktif OpenCode sunucusu 200. Gerçek PHP ve site v1 alan katılığı entegrasyonu **BLOCKED** olarak kalır; referans testlerinin başarısı canlı kabul kapısının düzeldiği anlamına gelmez.

## 35. Tek Oturum S6 Yerel Entegrasyon Kapanışı (2026-11-04)

**Bu bölüm, 33–34. bölümlerdeki S6 BLOCKED kayıtlarından daha yenidir.** Görsel P7.4 tamamlanıp diğer site oturumu durdurulduktan sonra, PHP kabul ve kanonik JS v1 tüketici katılığı tek oturumda birleştirildi. Codex CLI `gpt-6.1-sol` / yüksek reasoning ile kullanıldı; ilk sandbox oturumundaki PHP stdin EOF sorunu nedeniyle kullanıcı onayıyla sonraki oturum **sandbox dışına** alındı. Bu, canlı deploy/git işlem izni değildir.

**Entegrasyon:** `channels/birdesengor/web/public/api/studio/bootstrap.php` JSON gövdesini tek kez sınırlandırılmış boyutta okur ve typed `stdClass` biçimini de sunar. `index.php` önce mevcut admin auth, legacy yayın ve asset denetimlerini uygular, sonra `publication_validate_vefk` ile S6 kapısını **dosya yazma ve asset temizliğinden önce** çalıştırır. `publication.php` Vefk içeren geçerli yayını `{} / []` türlerini bozmadan saklar; Vefk içermeyen eski yayın davranışı korunur. Site içine taşınabilir `publication-vefk.php` ve `vefk-s6-php-gate.php` yerleştirildi. Bu ikinci dosya, `docs/contracts/vefk-s6-php-gate.php` ile **byte-byte eşittir**. Kaynak ve build kopyalarında PHP izinleri **644**. Güvenli SVG M/L/Z koordinatları sayıya dönüştürülmeden önce token türü denetlenir.

**Kanonik tüketici:** `docs/contracts/vefk-site-consumer.mjs` ve `channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs` **byte-byte eşit**. v1 belge/geometry/style/plan/stroke/marker alanlarında bilinmeyen anahtarlar fail-closed reddedilir. Yeniden hash'li izinsiz `stroke.easing` kabul edilmez. V1 hareket ve `frameAt` zamanlama davranışı değişmedi; S4 kalıcı motion v2 hâlâ ayrı şema tasarısıdır.

**Doğrulama sonuçları (yalnız yerel):**
- Birleşik Vefk regresyonu: **216/216 PASS**.
- Site V2 Node testleri: **146/146 PASS**.
- S6 endpoint ve v1 strictness test paketi: **46/46 PASS**.
- PHP S1 referans regresyonu: **33/33 PASS** (216 içindedir).
- PHP ile kanonik JS arasındaki yayın kabul audit'i: **11/11 PASS**, `S6_ACCEPTANCE_PASS`.
- Yasak v1 easing schema audit'i: `S6_SITE_SCHEMA_STRICTNESS_PASS`.
- Publication V2, Studio TS/Vite build, V2 site build, PHP taşıyan web build, PHP lint, `git diff --check`: **PASS**.
- İzole PHP localhost HTTP testlerinde yeni 3×3 katalog, önceki başarılı yayına zarar vermeden 4xx ret, admin/rol doğrulaması, 16MiB limitleri (sized/chunked), asset/credits/DB değişmezliği ve JSON `{} / []` türleri kontrol edildi. Tamamı geçici test dizinlerinde; canlı sunucuya POST yok.

**Kapanış sınırı:** Yerel S6 entegrasyonunun bilinen engeli kalmadı. Canlı hosting/SAPI/izin ve gerçek deploy onayı **yapılmadı**, bu nedenle üretim kabulü sayılmaz. P7.5 parşömen/divit fiziksel görsel geliştirmeleri ve gerçek Chromium browser görsel E2E henüz bu S6 oturumuna dahil edilmedi. Sonraki sıra `channels/birdesengor/web/docs/VISUAL_ASSETS_P7.md` P7.5 → yeni sentetik 3×3 ve manuel kaligrafiyle fiziksel sahne E2E → onaylı motion v2 sözleşmesi. Git reset/clean/stash/commit/push, canlı deploy yapılmadı; çok sayıda önceden var olan çalışma dosyası korundu. Detaylı kanıt/tekrar komutları: `docs/VEFK_SINGLE_SESSION_HANDOFF.md`.

## 36. P7.5 şövalye aygıtı — son yerel kabul (2026-11-04)

Bağımsız açılan parşömen kaldırıldı. Masadaki tek `vefk-stand` nesnesi üç ayaklı ahşap/pirinç occult çalışma sehpasıdır; çizim yüzeyi üzerindeki gerilmiş kâğıt yalnız sabit malzemedir. Tek `quill` fiziksel kalemle `vefk-stand.ink-plane` üzerinde kanonik mürekkep gösterilir; açılma/sarma/kapanma animasyonu yok, mevcut `CameraRig` yalnız yakınlaşıp uzaklaşır. Gerçek mekanik kol play/pause, zaman oyuğu native range seek, mühür nişi kayıt/revizyon, süpürme taşı `seek(0)` ile yalnız oynatma görüntüsünü sıfırlar. Studio onaylı kayıtları değişmez. Yeni binding v2 site/Studio/PHP/JS arasında atomik olarak eşitlendi; eski binding fail-closed, atılabilir demo için migration yok. Manifestte 16 nesne/21 anchor.

**Kapanış kanıtı:** Site Node **150/150 PASS**, Studio Vefk **218/218 PASS**, Vite build PASS, `npm run test:e2e` tam Chromium **PASS**, P7.5 üç ekran (1920×1080/1366×768/390×844) ve reduced-motion özel testleri **4/4 PASS**; divit uç sapması sırasıyla 0,001 / 0,675 / 0,001 px; canlı çizimde en çok ~0,002 px. S6 PHP/JS audit'leri PASS, tüketici/PHP kopyaları byte-eşit, PHP lint/diff check PASS. Mobil `ink-plane.height > 220px` katı E2E eşiğini düşürmeden, oda/odak aygıt alt yüksekliği `clamp(234px,57vw,280px)` olarak büyütülerek çözüldü. Yerel görseller `web/artifacts/p75/` altında.

**Tamamlanan:** P7.5 işlevsel sahne geçişi ve ilk CSS görsel taslak. **Açık:** nihai fotogerçekçi malzeme/ışık, gerçek cihaz üzerinde manuel görsel kabul; ayrı S4 motion v2. Git commit/push, temizleme, canlı deploy yapılmadı. Bu güncel bölüm 1–34'teki eski parşömen/rulo takviminin yerine geçer.

## 37. P7.5c — fiziksel divit malzemesi ve organik tüy (2026-11-04)

P7.5b'nin son test kapanışı baseline alındı. Divitin polygon/gradient tüyü,
Pillow ile sabit seed'lerden üretilen özgün 1024×1536 RGBA WebP ile
değiştirildi: eğri/asimetrik rachis, 2.120 yönlendirilmiş barb ve gevşek dip
lifleri. Ayrı krem sap ve patinalı fırçalı pirinç yüzey dokuları eklendi.
Üç görsel toplam 893.308 byte; lossless ve tek kare. `VefkQuill.jsx`'te
yalnız dekor CSS import'u vardır; DOM, `.quill-nib`, iç marker, tip anchor,
transform-origin, aygıt geometrisi/kamera, Studio frameAt/ink değişmedi.
Stiller yalnız yeni `src/vefk/quill-materials.css` içindedir.

Üç viewport × normal/reduced-motion gerçek Chromium oda/odak görüntüleri
ve makro incelendi; ilk denemeden sonra tepe/dal ayrımı/sap birleşimi
iyileştirildi. Tek divit/tek ink SVG, 16 nesne/21 anchor, sıfır yeni hareketli
dekor/canvas; öncesi/sonrası hesaplanan nib/object/shaft/marker geometrisi
birebir aynı. Canlı ölçüm tamamlanmamış kanonik stroke ve aynı metal
nib iç marker'ı üzerinden yapılır. Kanıtlar
`channels/birdesengor/web/artifacts/p75c/` ve ayrıntılı varlık/kıyas/test
açıklaması `channels/birdesengor/web/docs/VISUAL_ASSETS_P7.md` sonundadır.

Sanat sınırı: gerçek fotoğraf/fotogerçekçilik onayı yok; makroda prosedürel
paralellik, düzlemsel malzeme ve mevcut sap–metal ayrımı kalır. Masaüstü
odakta tüy tepesinin baseline kadrajı dışına çıkması korunur. Bu tur yalnız
divit malzemesidir. Sonraki sıra kullanıcı sanat/gerçek cihaz kabulü;
S4 motion v2 ve yeni revision/mühür kontrolleri ayrı iş olarak kalır.
Studio/S6/PHP/kanonik JS ve P7.5b varlıkları korunur; commit/push veya
deploy yapılmaz. Kesin test kapanışı aşağıdaki kayıtta verilir.

**P7.5c son yerel kabul:** `npm test` **160/160 PASS**, build **PASS**, tam
`npm run test:e2e` **PASS**, ayrıca değiştirilmemiş `node tests/p75-e2e.mjs`
**4/4 PASS**; hepsi **exit 0**. Önce/sonra capture **6+6 PASS**. Son capture
üst nib–ink sapmaları 1920/1366/390 için **0,001425 / 0,653388 / 0,000793px**;
59 gerçek canlı kısmi stroke örneği `<1px`. Tam E2E'nin canlı üst değeri
0,309px, bağımsız P7.5'in 0,267px. Reduced-motion divit uçuşunu durdurur.
Başlangıç 2.562 dosyanın kapsam denetiminde yalnız izinli mevcut üç dosya
değişti; yedi yeni kaynak/asset eklendi, silme yok. Kanonik JS/PHP çiftleri
başlangıçla aynı SHA ve birbirleriyle byte-eşit. Studio/S6 kaynakları
değişmedi; ek Studio testi gerekmedi. `git diff --check` exit 0. Testler
P7.5b görsellerini korumak için geçici kaynak kopyasında koşturuldu; 79
uygulama/asset/mevcut E2E girdisi SHA ile doğrulandı. Çıktılar yalnız
`channels/birdesengor/web/artifacts/p75c/`; yerel işlevsel kabul kapanır,
fotogerçekçilik veya kullanıcı sanat kabulü anlamına gelmez.


## P7.5d — ortak statik ortam ışığı (2026-11-04)

`stand-materials.css` ve `quill-materials.css` üzerinde sıcak üst-sol / soğuk
sağ-alt paleti işlendi. Ceviz ayak ve traverslerde temas gölgeleri, mat pirinç
köşe/kol yüzeylerinde geniş yansımalar, parşömende düşük kontrastlı dağınık
ışık, kemik sap ve metal uçta ortak renk yönü kullanılır. Mevcut tüyün alfa
kenarı korunur; ortak materyal CSS'indeki divit köküne yalnız 1.06 parlaklık
uygulanır. Aynalanmış üç köşede yalnız gradient açısı terslenir. Yeni katman,
asset veya sahne değişikliği yoktur. Native hover/focus stilleri korunur.

P7.5d statik testi mevcut iki materyal dosyasının özellik sınırlarını, dokuz
özgün yerel asset URL'sini, geometri/hareket yasağını ve korunan kaynakların
başlangıç SHA'larını denetler. 16 nesne / 21 anchor ve nib `<1px` gerçek
Chromium doğrulaması değiştirilmemiş `tests/p75-e2e.mjs` tarafından yapılır.
Capture betiğinde `page.clock` ve PNG bayt eşitliği beklentisi kaldırıldı;
canlı mum/video kareleri görsel inceleme kanıtıdır. Capture içindeki yinelenen
nib örnekleyicisi çıkarıldı; eski nib E2E kontrolleri gevşetilmedi.

Kanıt dizini: `channels/birdesengor/web/artifacts/p75d/` (site içinden
`artifacts/p75d/`). `npm-test.log`, `build.log`, `p75-e2e.log`, `full-e2e.log`,
`capture-after.log`, `after/evidence.json` ve `scope-check.json` bu tura aittir.
E2E/build geçici kaynak kopyasında çalıştırılır; eski P7.5b/c çıktıları ve
`artifacts/p75c/after` referansları korunur. Başlangıçtaki yarım P7.5d before
capture tamamlanmış bir kıyas olarak sunulmaz. Bu yerel teknik/görsel kontrol,
kullanıcının gerçek cihaz sanat kabulünün yerine geçmez. S4 motion v2 ayrı
sonraki etaptır; burada uygulanmadı. Commit/push/deploy yapılmadı; mevcut
OpenCode/Vite oturumları korunur.

**P7.5d son yerel kapanış:** `npm test` **164/164 PASS** (skip yok),
`npm run build` **PASS**, değiştirilmemiş `node tests/p75-e2e.mjs` **4/4 PASS**,
`npm run test:e2e` **tam PASS**; tümü **exit 0**. Son CSS capture **6/6 PASS**:
1920/1366/390 × normal/reduced-motion; oda, keyboard-focus odak ve malzeme
makroları `artifacts/p75d/after/` içindedir. Native hit/focus/hover ve mühür
keyboard aktivasyonu geçti. Bağımsız P7.5 nib üstü 0,577px; tam E2E son P7.5
ölçüm üstü 0,670px; hepsi `<1px`. 2.925 dosyalık başlangıç manifestinde
yalnız iki CSS ve bu iki doküman değişti, eksik dosya yok; manifest dışında
önceden bulunan P7.5d test/capture düzeltildi. Kanonik JS/PHP `cmp`,
`git diff --check` ve görev kapsamı kontrolü **PASS**. Yeni asset **0**, sahne
modifikasyonu **0**. Sonuç/exit kayıtları `artifacts/p75d/results.json` içindedir.

## 38. S4a motion v2 — ortak model / doğrudan oynatıcı adayı (2026-11-04)

**Kısmi durum:** Core açık `schemaVersion:2` ile immutable belge üretebilir;
varsayılan doc1 ve kanonik SHA korunur. Yalnız doc2 stroke alanında dört kesin
easing enum'u kabul edilir; eksik alan linear, bilinmeyen değer/alan strict
reject. İki JS tüketicisi byte-eşittir. V2 tek eased progress ile hem mürekkebi
hem divit/pen-up durumunu örnekler; v1 işlem sırası ve kesirli seyahat
koordinatları değişmez. Studio deney eğrileriyle matematik eşleşir;
gap/hold/marker/süre, pause/seek/reduced son-kare modeli korunur.

**S4b yayın engeli korunur:** `serializeVefk(doc)` doc1-only;
doc2 aday serileştirmesi açık `serializeVefk(doc,2)` gerektirir. Bu core kapısı
mevcut storage ve publisher'ın doc2 kaydetme/build/validate/export işlemlerini
yayıncı dosyasını değiştirmeden reddeder; geçici in-memory approved doc2
üzerinden ayrıca test edildi. Site doğrudan doc2 oynatabilir fakat
`readVefkPublication` catalog1/binding2 için doc1-only kalır, catalog2 reddedilir.
PHP gate değiştirilmedi; gerçek handler geçici depoda geçerli doc2/catalog2
paketlerine **422** döndürdü, depolama byte'ları aynı kaldı. V2 yayın tamamlanmadı.

**Kontroller:** Tam Studio Vefk kök/core/src testleri **235/235 PASS**, skip 0;
Studio workspace build **PASS**. Değişiklikten önceki iki v1 contentHash,
kanonik JSON SHA ve tam kare dizisi SHA sabiti; taze 3×3, manualPaths çoklu M/Z,
linear eşitlik, dört eğri, pen-up mürekkep sabitliği, sınırlar ve ters seek
regresyonları geçer. Kopya eşitliği ve kapsam/diff kontrolü geçti.

V2 `npm test` geçici kaynak kopyasında **158 PASS / 2 FAIL**: harici
`YardimciWorkspace/EfektAtolyesi/src/model/project.mjs` bulunamadığı için
`effectsAdapter.test.mjs` import hatası; P7.5d tarihsel tüm-kaynak SHA testi
`vefk-s6-fixtures.cjs` değişikliğini reddeder. V2 build aynı harici yol
eksikliğinde durdu. Kullanıcının hata sınırı uyarınca retry, baseline/test
gevşetme veya kapsam dışı düzeltme yapılmadı. Kesin detaylar
`docs/contracts/VEFK_STROKE_MOTION_V2_PROPOSAL.md` S4a kaydında;
loglar `/tmp/vefk-s4a-4j8jiw5a/` altında. Build/test çıktıları geçici kopyadadır.

UI, publisher kaynağı, PHP, site API/sahne/manifest, kamera/kitap/efekt/CSS,
P7.5 malzemesi, aktif DB ve demo/public verisi korunur. Görsel E2E ve S4b
ayrı açık işlerdir. Commit/push/stash/reset/clean/checkout/deploy yapılmadı.


### S4a düzeltici doğrulama eki — 2026-11-04

Önceki S4a kapanışında geçici test kopyasında raporlanan V2 `158 PASS / 2 FAIL` ve derleme hatası artık **tarihsel ilk deneme sonucudur**. Etki eden üretim kodu değiştirilmeden test ortamı tamamlandı: `BIRDESENGOR_CANONICAL_EFFECTS_ROOT` gerçek Efekt Atölyesi kaynağına yöneltildi; geçici kopyaya mevcut `grabfold` bağımlılığı ve web altmodül `.git` işaretleyicisi bağlandı. `p75d-light-unity.test.mjs` tarihsel malzeme SHA korumasına yalnız S4a tarafından bilerek değiştirilen, ayrı v1 frozen-hash ve frame testleriyle korunan hareket kaynaklarının açık listesi eklendi; diğer kaynakların SHA denetimi korunuyor. S4a kapsamı dışındaki sahne/asset/efekt/PHP dosyaları değiştirilmedi.

**Son test:** `npm test` V2 **164/164 PASS** (skip 0); `npm run build` **PASS**. İkisi de `/tmp/vefk-s4a-4j8jiw5a/verification/channels/birdesengor/web` geçici kopyasında, kaynağa dokunmadan çalıştı. Çıktılar `/tmp/vefk-s4a-4j8jiw5a/site-tests-final.log` ve `site-build-final.log`. Orijinal S4a testleri **235/235 Studio**, Studio build PASS, v2 yayın PHP 422 ret, v1 kimlik/hash/kare eşitliği PASS kalır. Bu **v2 canlı yayın kabulü değildir**; Studio publisher ve PHP gate hâlâ v1-only. Git commit/push/deploy yoktur.


## 39. S4b — sürümlü yerel doc2 yayın dilimi (2026-11-04)

**Tamamlandı, yerel opt-in:** Studio store/publisher, JS referans/site reader ve
PHP referans/site gate aynı sürüm eşlemesini uygular. Catalog1/binding2/doc1
çıktı byte'ları ve v1 hash/kareleri değişmez. Yalnız seçilmiş onaylı immutable
doc2 varsa publisher catalog2/binding3 üretir; binding içindeki kesin
`motion:{strokeEasing:"v2"}` zorunludur. Catalog2 karma doc1/doc2 kabul eder;
Catalog1 doc2 kabul etmez. Stand/quill anchor'ları aynıdır. Varsayılan üretim
doc1; store yalnız belgenin açık schemaVersion2'sini saklar, yeni UI yok.

ContentHash, kanonik dosya SHA/SHA16 yolu, katalog fingerprint'i ve üst yayın
fingerprint'i zinciri korunur. Unselected doc2 veya sonraki taslak onaylı seçimi
kendiliğinden değiştirmez. 32 girdi/5 MiB, typed PHP object/list ve mevcut HTTP
auth/rol/16 MiB/asset/layout kapıları sürer. Hatalı istek yazmadan reddedilir.
JS ve PHP kopyaları ayrı ayrı byte-eşittir; core/player/sahne değiştirilmedi.
P7.5d baseline korunur, yalnız gerekli S4b kaynak/test/sözleşme istisnaları eklendi.

**Nihai kanıt:** Studio Vefk **283/283 PASS** (skip 0); V2 Node **164/164 PASS**
(skip 0); Studio ve V2 build **PASS**, tümü exit 0. S6 doc1, karma doc2 ve çoklu
M/Z doc2 audit'leri ayrı **11/11 PASS**; v1 şema audit PASS. Gerçek geçici PHP
HTTP sunucusu doc2'yi 200 kabul eder, malformed/version/easing/binding/hash/
boyut/role deny 4xx'lerinde publication/credits/assets/DB byte ve metadata
korunur. Mevcut P7.5 Chromium **4/4 PASS**, üç ekran ve reduced motion, nib
üstü 0,456px. Ayrıntılar güncel motion sözleşmesi S4b bölümünde ve
`/tmp/vefk-s4b-7ivdbpht/` loglarında.

İlk hedef turdaki iki test hatası düzeltildi (explicit sıra ve bozuk top hash'i
onararak yanlış ret bekleyen fixture); son toplu tur temiz. Aktif DB, gerçek
`.local-data`/export/demo 5×5 ve diğer oturum kaynakları korunur. Build/V2/browser
geçici repo kopyasında; Studio testleri bellek/geçici veriyle çalışır. Git yazma,
migration, live POST, deploy veya mevcut Vite/OpenCode sürecine müdahale yok.

**Açık sonraki dilim:** S4c kalıcı easing UI ve doc2 gerçek sahne görsel E2E
(16:9/4:3, play/pause/seek, pen-up sabit mürekkep/nib eşleşmesi). Mevcut P7.5
tarayıcı PASS doc1 regresyonudur; doc2 görsel kabulü veya canlı hosting kabulü
olarak sunulmaz. Önceki 38. bölümün “S4b kapalı” durumu bu yerel dilimle aşılmıştır.

## 40. S4c1 — Studio kalıcı v2 çizgi içi eğri editörü (2026-11-04)

**S4c1 tamamlandı; S4c2 açık.** Studio TS sözleşmesi belge/girdi sürümü 1|2 ve
stroke başına dört easing literalini taşır. Model çağrıları belge sürümünü açık
geçirir. v1 satır/plan çıktıları, düzenleme/tempo/denge/geometri uzlaştırma
byte'ları ve kaydetme hash'i önceki modelden alınmış sabit SHA'larla korunur;
v1'e easing enjeksiyonu model/core/store tarafından reddedilir. doc2 eğrisi
yol kimliğine bağlı olarak sıra, süre, geçiş, bekleme, geometri, tempo ve denge
işlemlerinde korunur; yeni yollar linear, eksik doc2 easing ortak kurala göre
linear okunur. Saklanan doc1 kendiliğinden değiştirilmez.

Yalnız Yeni/Taslak kullanıcı eylemiyle «Kalıcı v2 eğrilerini aç» kullanılabilir.
Opt-in tüm stroke'lara açık linear koyup mevcut bridge `vefkGenerate` ile
geçerli doc2 oluşturur; id/revizyon ve kayıt durumu korunur. İşlem dirty ve
geri al/yinele geçmişine girer. Kaydetme girdisi açık schemaVersion taşır;
yükleme doc2 planını geri getirir. Kontrolde/Onaylı/Yayınlandı kayıtlar kilitli;
onaylı v1 için önce mevcut «Yeni revizyon oluştur», sonra ayrıca opt-in gerekir.
v1 deney seçicisi «kaydedilmez» etiketlidir. doc2 satırlarında native kalıcı
eğri seçimi vardır ve önizleme deney state'inden bağımsız kanonik oynatıcıdır.
Bridge dönüşündeki yeni geometri nesnesi, opt-in planını eski v1 planıyla ezmez.

**Doğrulama:** Tüm Studio Vefk kök/core/src **294/294 PASS** (skip 0), bunun
11'i yeni S4c1 testidir; S4b gerçek geçici PHP HTTP doc2 kabulü ve retlerde
byte/metadata yazmama testleri dahildir. Son UI düzeltmesinden sonra tüm src
**80/80 PASS**, Studio workspace TypeScript/Vite build tekrar **PASS**.
V2 **164/164 PASS**, V2 build **PASS**. P7.5d tarihsel SHA baseline değişmedi;
yalnız yedi kasıtlı Studio UI/model/tip/CSS/mevcut test kaynağına açık S4c1
istisnası eklendi; son guard **4/4 PASS**. Diğer korumalar aynıdır.
JS/PHP kopya eşitliği, v1 şema audit ve kapsam/whitespace denetimi PASS.

**Gerçek Chromium Studio kontrolü PASS:** 1366×900'de gerçek Workshop bileşeni,
gerçek core ve bellek SQLite bridge ile v1 geçici deney, açık opt-in, tüm
stroke'larda linear, sürümler arası undo/redo, native klavye seçimi, süre
düzenleme, kayıt/reload, kanonik SVG mürekkep/divit örneği, checked/approved
kilidi ve yeni revizyon akışları doğrulandı; pageerror 0. Bu Electron IPC veya
site doc2 görsel E2E kabulü değildir. Yeni çalıştırılabilir kontrol:
`node apps/studio/src/vefk-motion-editor.browser.mjs <kanıt-dizini>`;
Chromium için mevcut `CHROME_PATH`/`CHROME_BIN` kullanılabilir.

Kanıtlar `/tmp/vefk-s4c1-658b0hx5/`: `studio-vefk-tests.log`,
`studio-src-tests-final.log`, `studio-build-final.log`, `site-tests.log`,
`site-build.log`, `sha-guard-final.log`, `schema-audit.log`, `studio-browser.log`,
`browser/studio-browser.json`, `browser/studio-doc2-1366.png`, `scope-check.json`.
Build ve toplu testler geçici repo kopyasında; DB testleri bellek/geçici veridir.
Aktif local-data/demo/export, site sahne/playback/kamera/PHP, efekt/mum/Android
ve önceden var olan çalışma ağacı korunur. Git commit/push/clean/reset/stash/
checkout/deploy veya mevcut Vite/OpenCode durdurma yapılmadı.

**Kalan S4c2 / genel S4c henüz tamamlanmadı:** doc2'nin gerçek site sahnesinde
16:9 ve 4:3 Chromium görsel E2E'si; play/pause/seek, pen-up sırasında sabit
mürekkep ve divit/mürekkep uç eşleşmesi henüz çalıştırılmadı. Bu dilimde engel
bir test hatası değil, ayrı tutulan S4c2 kapsamıdır. Yeni Studio tarayıcı PASS'i
ve önceki doc1 P7.5 PASS'i bu kabulün yerine geçmez. Canlı hosting kabulü de
bu dilimin dışındadır.


## 41. S4c2 — gerçek DOC2 sahne kabulü (2026-11-04)

**S4c2 FAIL / açık; S4c1 PASS korunur.** Yeni izole
`web/tests/fixtures/s4c2-doc2-fixture.mjs`, gerçek core + bellek SQLite
approve/select + publisher/buildPublicationV2 ile sabit zamanlı catalog2 /
binding3 üretir. Çoklu M/Z ease-in + ease-out + ease-in-out DOC2 ve aynı
geometri/zamanlı doğrusal DOC1 vardır. Gerçek veri/export yazılmaz.

Yeni `web/tests/s4c2-doc2-e2e.mjs` bağımsız localhost Vite/Chrome'da
1920×1080, 1366×768, 390×844 ve reduced-motion kullanır. Hareket/DOM turu:
16/21, tek kalıcı stand/quill/SVG, ready DOC2, kanonik fraction (1e-10),
üç eğri, gerçek kontrollerle pause/geri-ileri seek/reset, pen-up sabit
mürekkep ve hareketli nib, DOC1 mühür seçimi/geri dönüş, kamera oda dönüşü,
reduced-motion tam son kare ve güvenli scrub PASS. İlk turda nib maksimum
0,8213px, canlı rAF maksimum 0,6300px (<1px). Canlı DOM saatinin ms yuvarlaması
±0,501ms kanonik zarfla sınanır; SEEK 1e-10 kalır.

**Görsel engel:** 3030ms intra-M/Z pen-up sırasında ikinci M alt yolu henüz
ziyaret edilmeden boyanır. Tek SVG path'in toplam fraction dash'i her alt
yolda yeniden başlar. 1920'de (700,150) izdüşümündeki 9×9 bölgede t=0'a göre
18 erken kararmış piksel bulunur; beklenen sıfır. `node tests/s4c2-doc2-e2e.mjs
--paint-only` exit 1 ile yeniden üretir; default test de bu kontrolü içerir.
DOM/nib eşitliği bu gerçek boyama hatasını gizlemek için yeterli sayılmadı.
VefkStand render düzeltmesi izin verilen hook/consumer kapsamı dışında;
sahne/renderer/CSS değiştirilmedi. Per-subpath çizim düzeltmesi ve tekrar
Chrome kabulü gerekir; S4c2/genel S4c kapanmadı.

V2 **164/164 PASS**, build PASS; frozen v1 **4/4 PASS**, JS/PHP byte kopya
eşitliği/top fingerprint/PHP stdin fixture gate PASS. Mevcut P75 DOC1
**4/4 PASS**, nib ≤0,456px; geçici runner yalnız artifact/import/root yollarını
yönlendirdi, kaynak/assertion değişmedi. HTTP publication isteği yok.

Ayrıntılı bulgu ve yöntem: `docs/contracts/VEFK_STROKE_MOTION_V2_PROPOSAL.md`
S4c2 bölümü. Kanıtlar `channels/birdesengor/web/artifacts/s4c2/`:
metrics.json, paint-reproduction.json, ekran görüntüleri, test/build/frozen/
PHP/copy/browser logları ve p75/metrics.json. Kaynak art üretilmedi; gerçek
DB/.local-data/export/demo, aktif sunucular, Studio/core/PHP/kamera/efektler
korundu. Git yazma/deploy, canlı hosting, Electron veya fotogerçekçilik
kabulü yoktur.


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


## 2026-11-04 — V1 site tasarımının kaldırılması, tek kanonik web

BirDeSenGör'ün aktif web kaynağı artık yalnız **channels/birdesengor/web/**. Daha önce ayrı geliştirilmiş V2 fiziksel sahne (tek Grabfold kitap, kamera, topluluk defteri, VefkStand/divit, S4 v2 stroke motion) bu konuma taşındı. **web-v2/** dizini kaldırıldı; V1 Babylon/React tasarımı, V1 CSS/scene görselleri, obsolete test/derleme/deploy betikleri mevcut çalışma kopyasından çıkarıldı. Tarihsel Git commit'leri silinmedi.

**Korunan API:** web/public/api/community, api/studio (S6 PHP v1/v2 gate ve yönetici/asset/publication), api/youtube; web/public/index.php PHP önizleme kapısı ve .htaccess. apps/web sembolik bağlantısı bu tek web köküne gider. web/.git altmodül kimliği ve project.json korundu. V1 arayüzüne fallback, ikinci React uygulaması veya paralel eski sahne motoru yok. Studio ile site tüketicisinin PHP/JS kanonik kopyaları aynı; publication/document schemaVersion ve vefk-stand/quill binding kontratları yeniden adlandırılmadı.

Root npm dev:web/build:web/verify:web ve Studio kanal komutları aynı kökü çalıştırır; tarihsel V1 kitap-tema/Natro verify/deploy araçları kaldırıldı. Release doğrulaması V2'nin Node/build/Chromium suite'ine yönlendirildi. Yeni V2 canlı dağıtımı henüz ele alınmadı; eski Natro dağıtım betiği bilerek taşınmadı. **Git commit/push ve canlı deploy yapılmadı.** Yeni tek-kök regresyonu web/tests/single-web-retirement.test.mjs, P7.5d SHA kilidi (yalnız taşınmış kaynakların sınırlı yeniden tabanlanması), Studio/PHP entegrasyon testleriyle doğrulanır. Son tarayıcı E2E sonucu ayrı doğrulama günlüğündedir.
