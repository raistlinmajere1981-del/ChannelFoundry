# BirDeSenGör — Çizim Atölyesi kabul kaydı

## Okuma alanı yalnız sponsorluk başlığı ve iletişim — 2026-11-10

Ana kaydın görünen adı **Kanal Çizimi → Sponsorluk** olarak değiştirildi. Kaynak açıklaması yalnız `Sponsorluk için hakandemir@gmail.com adresinden Hakan'a ulaşabilirsiniz.` cümlesidir. Web okuma alanında eski çizim açıklaması ve tekrarlanan alt Sponsorluk başlığı kaldırıldı; yalnız tek başlık ve tek iletişim paragrafı kalır. E-posta `mailto:` bağlantısı korunur. Eski yayın paketindeki açıklama da aynı ana kimlik için gizlenir; diğer çizimlerde açıklama/provenance varsayılanları değişmez. İngilizce arayüz mevcut çevirileri kullanır.

Normal yerel export aynı `birdesengor-channel-drawing` kimliğini **revizyon 8** olarak güncelledi. Bütün çizim geometrisi, sponsor harfleri, mührün ink stilleri, accessibility verisi ve çizim zaman planı revizyon 7 ile birebir aynı; süre 209430 ms ve 472 path/stroke korunur. Diğer yayın alanları başlangıçla aynı. Yedek/kurulum raporu ve yerel doğrulamalar `artifacts/channel-drawing-sponsorship-copy/` altında. Başlangıç tutarlı yedek: `channels/birdesengor/.local-data/studio/backups/channel-drawing-sponsorship-copy-2026-11-10T01-06-58-622Z/`.

Studio ana kayıt/yayın testleri 8/8, ilgili web testleri 7/7, web build ve Studio TypeScript kontrolü geçti. Kaynaklar: `apps/studio/channel-drawing.cjs`, ilgili Studio testi/README, web `src/vefk/{channelDrawing.js,VefkReading.jsx,VefkReading.d.ts,VefkStand.jsx}`, mevcut ana çizim E2E okuma metni kontrolü ve kabul notları. Paylaşılan okuma bileşeninin açıklama gösterimi varsayılan olarak açık kalır; yalnız ana kaydın web sunumunda kapatılır. Commit/push/deploy yapılmadı.

Odaklı tarayıcı doğrulaması dört durumda geçti: masaüstü Türkçe, mobil Türkçe, eski yayın paketiyle Türkçe ve İngilizce. Her birinde tek ana başlık, tek paragraf, sıfır alt başlık ve tek `mailto:` bağlantısı doğrulandı; beklenen metin birebir karşılaştırıldı. Masaüstü ekranı görsel olarak kontrol edildi. Güncel rapor `artifacts/channel-drawing-sponsorship-copy/verification.json`.

---

## Ayrıntılı fotoğraf gravürü, çizgi tasarrufu kısıtı kaldırıldı — 2026-11-10

Kullanıcı, revizyon 6'nın yüzü fazla şematikleştirdiğini belirterek orta portreyi çizgi sayısında tasarruf yapmadan yeniden tasarlamayı istedi; **mühür ve destekçi metni aynı kalacak**. Bu talep önceki 130/157 path ve kısa süre hedeflerini portre için geçersiz kılar. Mevcut çekirdek/belge/yayın sınırları, oynatıcı, ana kimlik ve sponsor hattı korunur.

Şematik elle kurulmuş yüz kaldırıldı. Loading'deki gerçek `observer-portrait.webp` fotoğrafı, yüz benzerliğini koruyan bir gravüre dönüştürüldü: **üç ton seviyesinde 71 kaynak konturu**, iki yönde **335 ince tarama**, toplam **406 portre hamlesi**. Göz/kaş, burun, ağız, kulak ve sakalın biçim/tonları artık fotoğraftan gelir. 160×160 kaynak 640×640 işleme ızgarasında yumuşatılır; büyütmenin yeni fotoğraf ayrıntısı ürettiği iddia edilmez. Kaynağın daire içindeki koyu zemin tonu da çapraz taramayla karşılanır; daire dışına parıltı/çerçeve eklenmez. Çizgi kalınlığı konturlarda 0,75, taramada 0,95 birimdir. Her çizgi gerçek M/L ve zamanlanan kalem hareketidir; bitmap, dolgu/reveal katmanı veya yeni motor yoktur.

Mührün **34 path'i**, bütün koordinat/kalınlıkları ve ilk **19675 ms** zaman çizelgesi revizyon 6 ile birebir aynı. Sponsorun bütün harf path'leri, boyutları/kalınlığı/yerleşimi de aynı. Ana kayıt `birdesengor-channel-drawing`, normal `exportPublicSnapshot` hattında **revizyon 7** oldu; revizyon 6 imzalı belgesi korundu. Katalog seçimleri silinmedi. `journal`, `assets`, `archive`, `youtubeAnalysis`, `support` başlangıçla birebir aynı; yalnız ana çizim/kaynak notları ve paket imzası/tarihi değişti.

| Ölçüm | Revizyon 6 | Revizyon 7 |
| --- | ---: | ---: |
| Toplam path / stroke | 114 / 114 | **472 / 472** |
| Portre path | 48 | **406** |
| Mühür path | 34 | 34 |
| Gerçek M alt yolları | 153 | 1216 |
| L çizgi parçaları | 7324 | 10025 |
| Kanonik süre / 1× | 53556 ms | **209430 ms (3:29,43)** |
| İmzalı belge, kompakt JSON | 141195 B | 266886 B |
| Publication dosyası | 250837 B | 462535 B |
| Publication gzip | 55304 B | 82122 B |

Bu tur kalite önceliklidir; süre ve boyut artışı gizlenmez veya motor saatini hızlandırarak maskelenmez. Mevcut hız kontrolleri çalışır. Sponsorsuz sürüm 467 path/stroke ve 204566 ms. Önceki düşük hamle/süre testleri kaldırılıp gerçek belge doğrulaması ve kaynak konturlarının göz/burun/ağız/kulak/sakal bölgelerini kapsaması kontrolüne geçirildi; mührün sabit hash testi korundu.

Başlangıç tutarlı SQLite/public-export yedeği: `channels/birdesengor/.local-data/studio/backups/channel-drawing-detailed-portrait-2026-11-10T00-41-49-679Z/`. Ölçümler, eski paket/artwork, imzalı son belge, SVG ve kaynak/önce/sonra karşılaştırması `artifacts/channel-drawing-detailed-portrait/`. Web logları `artifacts/channel-drawing/detailed-portrait-*` altında. Değişen dosyalar: `apps/studio/channel-drawing.cjs`, `channel-drawing.test.cjs`, `channel-drawing/{artwork.json,trace-source.py,README.md}`, web `tests/channel-drawing-e2e.mjs`, bu rapor ve web `docs/VEFK_ACCEPTANCE.md`. Seed, loading, oynatıcı/okuma/katalog ve sponsor/yayın seçim kodları değiştirilmedi; paralel değişiklikler korundu. Commit/push/deploy yapılmadı.

Doğrulama: ana çizim 8/8 dahil ilgili Studio testleri **28/28**, web **223/223**, web build ve Publication V2 sözleşme doğrulaması geçti. Mevcut 500 kB JS derleme uyarısı sürer. Son revizyonla ana çizim E2E dört koşulda geçti: 1920×1080, 1366×768, 390×844 normal ve 390×844 reduced-motion. Tamamlanmış açılış, gerçek oynatma/duraklatma, başa dön, hız, tekrar, dört zoom, okuma/iletişim, katalog, kapanış, 44 px hedefler ve divit eşleşmesi kontrol edildi. İlk turda yalnız son reduced-motion giriş hazırlığı 30 saniyede zaman aşımına uğradı; aynı koşul tek başına ve ardından **dört koşullu turun tamamı** eşik veya oynatıcı değişmeden geçti. İlk/tekrar logları korunur. Teste hata durumunda mevcut revizyonun kısmi raporunu/DOM hazırlık durumunu yazma eklendi; eski revizyonun başarılı raporu yeni sonucun yerine kalmaz. Kaynak/önce/sonra, masaüstü ve mobil final görünümler görsel olarak incelendi. Turun kalıcı tarayıcı kopyaları `artifacts/channel-drawing-detailed-portrait/browser/{desktop.png,mobile.png,verification.json}`. Offline yeniden üretimde artwork SHA-256 aynı kaldı.

---

## Mühür sabit, yüz hatları daha belirgin — 2026-11-10

Kullanıcının Studio revizyon 5 ve loading ekranı görüntüleri incelendi. Yalnız portre yeniden işlendi: parlaklık eşiğinden çıkan kesik konturlar yerine, loading portresinin 160×160 kaynak koordinatlarında elle yerleştirilmiş 29 anatomik eğri kullanılır. Kaş, üst/alt göz kapağı, iris, burun köprüsü/profili/burun deliği, yanak, kulak kıvrımları, bıyık, üst/alt dudak, sakal sınırı, boyun ve şapka ayrı okunur çizgilerdir. Göz ve ağız gibi küçük ayrıntılar 2,1 birim `portraitFeature` çizgisiyle vurgulanır. Bunlar offline M/L örneklerine dönüşür; raster katmanı veya yeni çizim motoru eklenmedi. Çıktı, fotoğrafın stilize çizgi portresidir.

Mühür **34 path**, koordinatlar, kaynak oranı, çizgi kalınlıkları ve ilk **19675 ms** zaman çizelgesi revizyon 5 ile birebir aynı. Tam mühür geometrisi/ink stili kanonik SHA-256 regresyon testiyle korunur. Sponsorun path verisi, harf boyutları, kalınlığı ve yerleşimi de birebir aynı. Portre gölge maskesi yalnız şapka ve sakalı kapsar; taramalar 28'den 19'a indi. Anatomik çizgiler 9'dan 29'a çıktı; toplam portrede net **11 ek hamle** kullanıldı.

| Ölçüm | Revizyon 5 | Revizyon 6 |
| --- | ---: | ---: |
| Toplam path / stroke | 103 / 103 | **114 / 114** |
| Portre path | 37 | 48 |
| Mühür path | 34 | 34 |
| Kanonik süre | 53850 ms | **53556 ms** |
| Publication dosyası | 240676 B | 250837 B |
| Publication gzip | 52584 B | 55304 B |

Net artış 11 hamle; süre yaklaşık aynı, **294 ms daha kısa**. Publication 10161 B, gzip 2720 B büyüdü; bu artış yeni yüz ayrıntılarını taşır. Sponsorsuz sürüm 109 path/stroke ve 48692 ms. Aynı `birdesengor-channel-drawing` kimliği normal onay/export hattında revizyon 6 oldu; eski imzalı revizyon 5 korundu. Diğer yayın alanları (`journal`, `assets`, `archive`, `youtubeAnalysis`, `support`) başlangıç paketiyle aynı. Kullanıcı verisine sahte sponsor eklenmedi. Başlangıç SQLite/public-export yedeği `channels/birdesengor/.local-data/studio/backups/channel-drawing-2026-11-10T00-24-35-099Z/`.

Doğrulama: ana çizim 8/8 ve ilgili Studio çekirdek/kayıt/yayın/dil testleri birlikte **28/28**; web **223/223**, web build ve Publication V2 doğrulaması geçti. Yeni test mührün sabit hash'ini ve zamanlanan anatomik konturların varlığını doğrular. Ana çizim E2E dört ekran/hareket koşulunda geçti: 1920×1080, 1366×768, 390×844 normal hareket ve 390×844 azaltılmış hareket. Oynat/duraklat, başa dön, tekrar, hız, zoom, okuma/iletişim, katalog, kapanış, taşma/çakışma, dokunma hedefleri ve divit eşleşmesi kontrol edildi. Kaynak/önce/sonra karşılaştırması ile masaüstü/mobil son görünümler incelendi. Derlemedeki mevcut 500 kB JS uyarısı devam ediyor.

Ölçümler, önceki paket/artwork, imzalı son belge, SVG ve karşılaştırma `artifacts/channel-drawing-face-refinement/`; web ham logları `artifacts/channel-drawing/face-refinement-*` altında. Değişen kaynaklar: `apps/studio/channel-drawing.cjs`, `channel-drawing.test.cjs`, `channel-drawing/{artwork.json,trace-source.py,README.md}`, bu rapor ve web `docs/VEFK_ACCEPTANCE.md`. Seed, loading, web oynatıcı/okuma/katalog, sponsor/yayın seçimi ve paralel kitap/mum/topluluk düzenlemeleri değiştirilmedi. Commit/push/deploy yapılmadı.

---

## Portre ve mühür referansına düzeltme — 2026-11-10

Kullanıcı, referansın loading'deki **portre ve çevresindeki mührün tamamı** olduğunu doğruladı; mühür az hamleyle ve süreyi şişirmeden aktarılmalı. Yeşil kareli ek bu oturumda görünmediği için bu doğrulama ve projedeki gerçek loading SVG'si esas alındı. `index.html` içindeki `.entrance-seal` geometrisinden yalnız portre/mühür alınır; alt BirDeSenGör yazısı, alt çizgi, ışık halesi, vurgular ve engraving deseni alınmaz. Bu HTML veya loading görseli değiştirilmedi.

Önceki örneğin portresi halkaya göre büyüktü. Şimdi portre/dış mühür yarıçapı kaynakta olduğu gibi **92/134**, merkez `(500,320)`, ortak ölçek **2**. Altı kaynak halka sınırı korunur; çok yakın üç tekrar halka ve highlight yayları çıkarılır. 24 dış indeks 12'ye indirilir; sekiz özgün bölme işareti, dört yön çizgisi ve dört kilit pimi kaynak konumlarında kalır. Mühür toplam **34 stroke**, **19675 ms**. Yeni simge, köşe süsü veya kare dışı çerçeve eklenmedi.

Portre, dağınık iskelet çizgileri yerine sekiz devamlı kapalı kontur, bir göz detayı ve 73 yerine **28 seyrek tarama** ile çizilir. Bağımsız küçük arka plan lekeleri çıkarıldı; yüz yönü, göz/burun, kulak, sakal ve boyun sınırları kaynak üzerinden korunur. Gövde **71 path**, mevcut sponsorun 32 harf path'iyle toplam **103 path/stroke**. Sponsor etiketi/adı, harf koordinatları, boyutları ve satır yerleşimi revizyon 3 ile birebir aynı; oynatıcı veya sponsor seçim mantığı değiştirilmedi.

| Ölçüm | Başlangıç revizyon 3 | Son revizyon 5 |
| --- | ---: | ---: |
| Path / stroke | 157 / 157 | **103 / 103** |
| Kanonik süre | 61958 ms | **53850 ms** |
| Gerçek M alt yolları | 258 | 160 |
| L çizgi parçaları | 6631 | 7058 |
| İmzalı belge, kompakt JSON | 138812 B | 133840 B |
| Publication dosyası | 258249 B | 240676 B |
| Publication gzip | 51381 B | 52584 B |

Hamle sayısı **%34,4**, toplam süre **%13,1**, publication dosyası **%6,8** azaldı. Mühür yeni ayrıntılar taşıdığı için L parçası sayısı %6,4, gzip boyutu 1203 B (%2,3) arttı; her ölçütün azaldığı iddia edilmiyor. Gzip Node zlib varsayılan ayarlarıdır. Sponsorsuz sürüm 98 path/stroke, 48986 ms. Harf sayısına bağlı uzun sponsor listeleri ayrıca path ekleyebilir; isimler kırpılmaz.

Ana kimlik `birdesengor-channel-drawing`. Yerel revizyon 4 görsel inceleme adımıdır; küçük arka plan lekeleri çıkarılınca final revizyon 5 normal onay/export hattıyla üretildi. Önceki revizyon 3 imzalı belgesi korundu. Başlangıç/final `journal`, `assets`, `archive`, `youtubeAnalysis`, `support` alanları aynı; yalnız Vefk kataloğu, Vefk metni ve paket kimliği/zamanı değişti. Gerçek destekçi **Tufan Akkaya**, kaynak bölüm ve katalog seçimi korundu; sahte sponsor yazılmadı.

Başlangıç tutarlı SQLite/public-export yedeği: `channels/birdesengor/.local-data/studio/backups/channel-drawing-2026-11-09T23-57-13-953Z/`. Rapor, önceki paket, imzalı son belge ve bağımsız SVG: `artifacts/channel-drawing-seal-correction/`. Web ekran görüntüleri/raporu: `channels/birdesengor/web/artifacts/channel-drawing/`.

Doğrulama: web **222/222**, ilgili Studio çekirdek/kayıt/yayın/sponsor/kamera/dil testleri **29/29** ve son portre temizliğiyle ana çizim testleri **7/7** geçti. Web build ve Publication V2 sözleşme doğrulaması geçti; mevcut 500 kB JS uyarısı sürüyor. Kaynak oranı, yalnız kaynak halkaların kullanılması, portrenin kaynak kırpımı içinde kalması ve süre/hamle bütçesi ayrı testte doğrulandı. Son revizyonla ana çizim E2E 1920×1080, 1366×768, 390×844 ve mobil reduced-motion senaryolarında geçti: final açılış, oynat/duraklat, başa dön, hız, tekrar, dört zoom kademesi, okuma, katalog, kapanış, 44 px hedefler ve çakışma/taşma kontrol edildi. En büyük divit sapması **0,000170 px altında**. Genel atölye E2E dört koşulda, masaüstü/mobil 32 kayıtlık katalog ve boş/bozuk/ulaşılamayan/yüklenen yayın durumları geçti; gerçek export değişmedi. Masaüstü ve mobil son görüntüler görsel olarak incelendi. Kalıcı tur kopyaları `artifacts/channel-drawing-seal-correction/browser/{desktop.png,mobile.png,verification.json}`, kaynak/çizim karşılaştırması aynı tur dizinindeki `comparison.html` / `comparison.png`; ham loglar web `artifacts/channel-drawing/seal-correction-*` ve kök tur dizinindedir.

Değişen dosyalar (yalnız bu düzeltme turu): `apps/studio/channel-drawing.cjs`, `apps/studio/channel-drawing.test.cjs`, `apps/studio/channel-drawing/{artwork.json,trace-source.py,README.md}`, web `tests/channel-drawing-e2e.mjs`, bu belge ve web `docs/VEFK_ACCEPTANCE.md`. Seed, oynatıcı, okuma/katalog, dil/sponsor seçim kaynakları, loading ve diğer paralel değişiklikler bu turda değiştirilmedi. Commit/push/deploy yapılmadı.

---

## Ana çizimin sadeleştirilmesi — 2026-11-10

Ana kayıt `birdesengor-channel-drawing`, mevcut yerel revizyon 2'den **revizyon 3**'e normal Studio onay/yayın hattıyla geçirildi. Destekçi **Tufan Akkaya** ve aynı bölüm kaynağı korundu. Çizimin tek kaynağı loading ekranındaki `observer-portrait.webp`; 50 kontur, 73 seyrek gölge taraması ve iki ince halka kullanılır. Dış çerçeve, köşe bezemeleri ve yoğun halka sistemi kaldırıldı. Portre ve sponsor yazıları gerçek zamanlanan vektör çizgileridir; yeni resim/HTML katmanı veya oynatıcı yoktur.

Etiket **23 → 34**, destekçi adı **23 → 46** birim oldu. Ad ayrı satırda; uzun adlar sözcük sınırlarından bölünür, tek uzun sözcük de kayıpsız bölünebilir. Alt alan satır sayısına göre uzar. Sponsorsuz teşekkür yazısı 38 birimdir.

| Ölçüm (gerçek yerel sponsorlu yayın) | Önce | Sonra |
| --- | ---: | ---: |
| Path / stroke | 567 / 567 | **157 / 157** |
| Kanonik süre | 184766 ms | **61958 ms** |
| Gerçek M alt yolları | 2137 | 258 |
| L çizgi parçaları | 14566 | 6631 |
| İmzalı belge, kompakt JSON | 350209 B | 138812 B |
| Publication dosyası | 568078 B | 258249 B |
| Publication gzip | 96069 B | 51381 B |

Path/stroke **%72,3**, süre **%66,5**, publication **%54,5** azaldı. Sponsorsuz sürüm 152 path/stroke ve 57094 ms. İsim uzunluğuna bağlı ilave harfler/satırlar doğal olarak bu sayıları değiştirir; çok uzun sponsor listelerine 200 üst sınırı dayatılıp isim kırpılmaz. Gzip karşılaştırması Node zlib varsayılan ayarlarıyla yapıldı; sunucu aktarım ölçümü değildir.

Kurulum sırasında göreli görsel yolunun sahibi olan Studio veri kökü atanmadığı için ilk export'un evren görselini dışarıda bıraktığı fark edildi. `seed-channel-drawing.cjs`, normal Studio gibi `visual-profiles.ensureSchema(db,folder)` çağıracak şekilde düzeltildi ve tekrar export edildi. Son pakette `journal`, `assets`, `archive`, `youtubeAnalysis`, `support` başlangıçla birebir aynı; yalnız Vefk kataloğu, Vefk dil metni ve paket kimliği/zamanı değişti. Başlangıçtaki sponsor/bölüm, diğer belgeler ve katalog seçimi korundu; ikinci kurulum yeni revizyon üretmedi.

SQLite ve public-export başlangıç yedeği: `channels/birdesengor/.local-data/studio/backups/channel-drawing-2026-11-09T23-15-12-604Z/`. Ham ölçümler, imzalı belge, bağımsız SVG ve loglar `artifacts/channel-drawing-simplified/` altında. Ekran görüntüleri ve dört ekran/hareket senaryosunun raporu `channels/birdesengor/web/artifacts/channel-drawing/` altında.

Doğrulama: web birim testleri **222/222**, ilgili Studio çekirdek/kayıt/katalog/sponsor/kamera/dil testleri **28/28**, Publication V2 sözleşme doğrulaması ve web üretim derlemesi geçti. Derlemedeki mevcut 500 kB paket uyarısı devam ediyor. Ana çizim tarayıcı testi 1920×1080, 1366×768, 390×844 ve mobil reduced-motion senaryolarında geçti; en büyük divit sapması **0,000098 px altında**. Tamamlanmış açılış, gerçek oynatma/duraklatma, başa dön, hız, tekrar, dört zoom kademesi, okuma/iletişim, katalog, kapanma, 44 px hedefler ve taşma/çakışma kontrol edildi. Masaüstü/mobil tamamlanmış çizimler görsel olarak incelendi. Uzun/çoklu adlar ve sponsorsuz fallback kayıpsız geometri testinden geçti.

Genel Vefk DOC1/DOC2 testleri dört koşulda, gerçek Studio atölye testi dört koşulda, masaüstü/mobil 32 kayıtlık katalog ve empty/tampered/unavailable/loading durumları geçti. İlk genel zincirin fiziksel kullanım testinde 1366 ekranında gerçek saatli 0,25× ölçümü başarısız oldu. Aynı test değiştirilmeden tek başına tekrar çalıştırıldı; **dört koşulun tamamı geçti**. Studio edit/save/check/approve/select/package, 1/5/32 katalog, klavye/dokunma, adım/hız/hücre durması/tekrar/okuma ve gerçek DB/WAL/SHM/publication dosyalarının değişmediği doğrulandı. İlk başarısızlık `simplified-vefk-e2e.log`, başarılı tekrar `simplified-physical-retry.log` içinde korunur. Bu tur sırasında başka bir çalışma kitap ve WebP kaynaklarını değiştirdi; bu değişikliklere dokunulmadı ve bu çalışmanın dosya listesine eklenmedi.

Değişen kaynaklar: `apps/studio/channel-drawing.cjs`, `channel-drawing.test.cjs`, `seed-channel-drawing.cjs`, `channel-drawing/{artwork.json,trace-source.py,README.md}`, web `tests/channel-drawing-e2e.mjs` ve iki kabul belgesi. Web `src/vefk/channelDrawing.js` ve mevcut oyuncu/okuma/katalog kaynaklarında değişiklik gerekmedi. Yeni font/bitmap zinciri eklenmedi; commit, push ve deploy yapılmadı.

---

2026-11-09. Yerel çalışma; commit, push ve deploy yapılmadı. Başlangıçtaki paralel Studio, dil, topluluk, kamera, kitap ve efekt değişiklikleri korundu.

## Uygulanan davranış

Web alanının adı **Çizim Atölyesi**. Görsel başlık ve çerçeveye gömülü pirinç isim kartı kaldırıldı. Eser başlığı ekran okuyucu için korunuyor. Üst raydaki kontroller dengelendi; çizim yüzeyi `723×579` yerine `723×625` ve daha yukarıdan başlıyor. Uzun zaman sürgüsü, alt düğmeler ve hız ayarı gerçek ahşap yüzeyde kalıyor; dokunma alanları ayrık.

Katalog, başlat/duraklat, başa dön, adımlar, tekrar, hız, dört yakınlaştırma kademesi, okuma ve kapatma mevcut işlevlerini kullanır. Kare gruplama, stroke easing, intrastroke seyahat, RAF saati, geometrik yakınlaştırma ve divit motoru yeniden yazılmadı. Yüzey ölçüleri divit hokkasının ters projeksiyonuna ve katalog maskesine aynı kaynaktan verilir.

Kalıcı kayıt: `birdesengor-channel-drawing`, başlık: **Kanal Çizimi**. Şimdiki katalog yalnız bu kayıt. Yeni Studio eserleri serbest ad/tür ile eklenebilir; ana kayıt katalogda daima ilk sıraya alınır. Ana kayıt ilk doğrulamada tamamlanmış ve duraklamış açılır. Başa dön sıfır zamanı seçer; Oynat mevcut motorla gerçek çizgileri oluşturur. Diğer kayıtların varsayılan sıfırdan başlama davranışı korunur. Ana kayda doğrudan bağlantı tamamlanmış açılışı bozmaz.

## Çizim ve kaynak

Gerçek örnek, proje kökündeki `Screenshot_20261109_151819.png` içinde bulundu ve incelendi. Kökteki `logo.png` ChannelFoundry logosudur; bu çizimin kaynağı değildir. Ekran görüntüsündeki yalnız `(488,198)-(1430,825)` kompozisyon alanı kullanıldı; tarayıcı arayüzü ve yeşil seçim çizgisi alınmadı. Kaynak parmak izi `apps/studio/channel-drawing/artwork.json` içindedir.

535 temel path; bunların 175'i portre konturu/taramasıdır. Teşekkür satırıyla toplam **562 path / 562 stroke**, **181864 ms**. Çerçeve ve süslemeler kaynak konturlarından, soluk eş merkezli geometri kaynak ölçülerinden, portre kontur ve ton taramalarından üretildi. Her öğe mutlak M/L çizgi verisidir. Yazı Noto Serif konturlarından harf harf örneklenir. Logo/portre/yazı için HTML, CSS veya ayrı bir resim katmanı yoktur. Mevcut SVG içindeki tek resim nesnesi divit varlığıdır.

Kaynağın tam kâğıt dokusu, metalik ışığı ve sürekli portre tonları tek renk çizgi motorunda birebir üretilmiyor. Bunların yerine gerçek kontur ve divit taraması kullanılıyor. Kaynaktaki geometri ve portre oranları korunuyor; yeni sembol eklenmedi. Motor sınırı sahte görüntü açılmasıyla gizlenmedi.

## Sponsor otomasyonu ve sınırlar

`apps/studio/publication-v2.cjs` normal yayın paketi oluştururken, önceden kurulmuş ana kayıt için `channel-drawing.cjs.synchronize` çağırır. Ham keşif veya altyazıdan çıkarım yapılmaz.

Son onaylı/yayınlanabilir bölüm; mevcut kamera izin listesi, tamamlanmış ve güncel analiz, editoryal curated durumu, onaylı güncel yayın dili ve geçmiş yayın tarihiyle sınırlandırılır. Üyelere özel, gelecekteki, eski analizli veya yayın metni onaysız bölüm alınmaz. Bölümün yalnız açıkça kaydedilmiş sponsor confirm kararları ve elle girilen sponsorları kullanılır. İnceleme ekranının varsayılan confirm görünümü onay sayılmaz. Katkıda bulunanlar sponsor sayılmaz.

Sponsor değişince aynı kimlikte yeni onaylı revizyon, yeni harf konturları, zaman çizelgesi ve içerik hash'i üretilir; eski revizyon korunur. Aynı veriyle tekrar paketleme revizyon artırmaz. Geçerli yeni bölüm sponsorsuzsa teşekkür satırı çizilir. Geçerli yayın kaynağı geçici olarak yoksa önceki gerçek sponsor korunur. Yönetilen Türkçe metin mevcut dil sözleşmesiyle birlikte güncellenir; İngilizce varyant mevcut inceleme hattında kalır ve eski çeviri yeni revizyona otomatik taşınmaz.

Mevcut yerel yayınlarda uygun sponsor kaynağı bulunmadı; ana revizyon 1'de **Destekçilerimize teşekkürler** çiziliyor. Sponsorlu senaryolar gerçek Studio üreticisi ve SQLite ile izole testlerde doğrulandı; gerçek kullanıcı/bölüm verilerine test sponsoru yazılmadı.

Otomasyon **yerel yayın paketi üretimine kadar** bağlıdır. Çalışan sitede zamanlanmış Studio sorgusu yoktur. Güncellenen paketin mevcut yayın hattıyla gönderilmesi gerekir; bu turda uzak yayın yapılmadı. Ham kaynak konturlarını yeniden hazırlamak offline Python araçları gerektirir; normal export yalnız Node ve paketlenmiş konturlarla çalışır. 1351 yazı karakteri/Türkçe desteklenir; kapsam dışı karakter veya motorun 1024 path / katalog boyutu sınırı açık hata verir, metin sessizce değiştirilmez.

Okuma içeriğinde şu bağlantı vardır: **Sponsorluk için hakandemir@gmail.com adresinden Hakan'a ulaşabilirsiniz.** `mailto:` kullanılabilir. Bölüm dizisi genişletilebilir, boş Hakkımızda yoktur. Teknik üretim notları ziyaretçiye gösterilmez; Studio belgesinde ve üretim dokümanında korunur.

## Değişen dosyalar

Bu listenin kapsamı bu turda yapılan düzenlemelerdir; mevcut Git farklarının tamamı bu çalışmaya ait değildir.

- `apps/studio/channel-drawing.cjs`, `channel-drawing.test.cjs`, `seed-channel-drawing.cjs`.
- `apps/studio/channel-drawing/artwork.json`, `letter-outlines.json`, `trace-source.py`, `FONT-LICENSE.txt`, `README.md`.
- `apps/studio/publication-v2.cjs`: küçük sponsor eşitleme bağlantısı; önceki dil değişiklikleri korundu.
- `apps/studio/vefk-publication.cjs`: ana kaydın ilk sırada kalması.
- `channels/birdesengor/web/src/vefk/channelDrawing.js`.
- Aynı dizinde `VefkStand.jsx`, `VefkQuill.jsx`, `VefkReading.jsx`, `VefkReading.d.ts`, `useVefkExperience.js`, `verify-publication.js`, `physical-vefk.css`.
- `VefkAtmosphere.jsx`: mevcut tek malzeme ışığından önce tam kaynak sahnesini doğrulama; kanonik efekt motoru değişmedi.
- `src/scene/data/study.scene.json`, `src/effects/birdesengor-effects.v2.json`: yalnız atölye görünen adı.
- `src/language/messages.json`: web genel çizim adları ve iletişim çevirileri.
- `public/scene-assets/vefk/chassis-no-nameplate.png`: eski varlığı koruyan, isim kartı kaldırılmış yeni çerçeve.
- `tests/channelDrawing.test.mjs`, `tests/channel-drawing-e2e.mjs`, `tests/vefkPublication.test.mjs`, `tests/vefk-workshop-e2e.mjs`, `tests/physical-books-e2e.mjs`.
- Bu kabul raporu ve yerelde `.superdesign/resume.json` / taslak v4.

Studio Vefk Atölyesi editörünün bu turda kaynak değişikliği yapılmadı. Belge şeması, divit/zaman çizelgesi çekirdeği ve kayıt yaşam döngüsü değiştirilmedi. Paylaşılan okuma bileşeninin Studio varsayılanları korundu.

## Doğrulama

Web birim testleri 221/221; Studio çekirdek/kayıt/yayın/destek/kamera testleri 53/53, yeni ana çizim testleri 5/5 ve editör/zaman çizelgesi/IPC testleri 31/31 geçti. Web ve Studio TypeScript + Vite derlemeleri başarılı. Web derlemesinde 500 kB paket boyutu uyarısı var; hata yok. Kamera, Topluluk Defteri, mevcut çizim v1/v2 ve fiziksel kullanım tarayıcı kontrolleri geçti. Fiziksel kitaplar yeniden çalıştırmada tüm dört ekran/hareket senaryosunu geçti. Yeni ana çizimin son tarayıcı sonucu aşağıdaki tabloda verilir. Tarayıcı delilleri `channels/birdesengor/web/artifacts/channel-drawing/` altında; tamamlanmış açılış, sıfırlama, çerçeve, portre, sponsor, final, okuma ve katalog görüntüleri bulunur. `verification.json` ekran ölçüleri ve gerçek SVG CTM'si üzerinden ölçülen divit sapmasını içerir. Ek bağımsız vektör ve imzalı belge `artifacts/channel-drawing/` altındadır; bunlar oynatıcı yerine kullanılmaz.

Genel kitap/atölye testlerinin eski ortam katmanı sayımı, paralel pulse efektlerini kalıcı oda canvas'ı sayıyordu (2 yerine 5 bekliyordu). Testler mevcut candle/passive izin listesine bağlandı. İlk kitap denemesindeki RAF gözlemleme zamanlama hatası ayrıca yeniden denendi. Üretim kitap/kamera/topluluk kaynakları değiştirilmedi.

## Yerel veri ve geri alma

Kurulum öncesi tutarlı SQLite ve public-export yedeği:
`channels/birdesengor/.local-data/studio/backups/channel-drawing-2026-11-09T18-37-41-135Z/`.

Başlangıçta seçili başka demo bulunmuyordu; kurulumdan sonra katalog yalnız ana kaydı içeriyor. Eski Studio belgeleri silinmedi. Yeni paket `.local-data/studio/public-export/content/publication.json` ve standart `vefk/documents/` dosyalarında.

## İsim kartı varlığının üretimi

Yerleşim için Superdesign mevcut taslağının v4 sürümü kullanıldı:
https://superdesign.dev/teams/d43e8b12-551a-4b15-a10c-e48c388c4fc6/projects/bbe1c1c0-3365-4bfa-93a9-8e94e1426586

Çerçevedeki karta yönelik yerel raster düzenleme yerleşik image_gen ile yapıldı, CLI kullanılmadı. Son varlık: `channels/birdesengor/web/public/scene-assets/vefk/chassis-no-nameplate.png`. 1024×1536 oranı ve alfa kanalı doğrulandı. Bu görsel çizimin kendisi değildir.

Kullanılan istem:
> Use case: precise-object-edit. Edit target: the supplied 1024x1536 transparent physical wooden easel chassis asset. Remove ONLY the central rectangular brass nameplate at x413..611 y115..175, including its four screws, and restore continuous matching antique wood grain in that exact area. Keep every other pixel, edge, frame dimension, corner brass fastener, shelf, legs, transparency and the open central window unchanged. No text, no new objects. Exact same front camera angle and aspect ratio. Preserve existing alpha transparency precisely. This is a production UI chassis, do not redesign or recolor it.

## Ana çizim son tarayıcı sonucu

| Görünüm | Sonuç | En büyük divit sapması |
| --- | --- | --- |
| 1920×1080 / no-preference | Geçti | 0.000061 px |
| 1366×768 / no-preference | Geçti | 0.000039 px |
| 390×844 / no-preference | Geçti | 0.000031 px |
| 390×844 / reduce | Geçti | 0.000031 px |

Her senaryoda tamamlanmış açılış, başa dönme, okuma/iletişim, katalog, taşma/çakışma ve 44 px dokunma hedefleri doğrulandı. Normal harekette gerçek RAF oynatma, duraklama, bütün çizim bölümleri, final, tamamlanmış çizimden tekrar başlatma ve dört yakınlaştırma kademesi kontrol edildi. Hareket azaltmada varsayılan final ve animasyonun devre dışı kalması doğrulandı.

Son genel atölye tarayıcı turu da tamamen geçti: dört gerçek Studio görünümü, masaüstü/mobil 32 kayıtlık katalog seçimi, boş/bozulmuş/ulaşılamayan/yükleniyor yayın durumları. Gerçek yerel Kanal Çizimi paketi PHP yayın kapısından da geçti. Ham test/derleme günlükleri `artifacts/channel-drawing/validation/` altında korunur.
