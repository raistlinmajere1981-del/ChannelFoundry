# BirDeSenGör — 283 Kaynaklı Evren Kitabı / Yayın Öncesi Editoryal İş Planı

**Tarih:** 16 Kasım 2026
**Çalışma dizini:** `/home/raistlin/ChannelFoundry`
**Kapsam:** İçerik/kaynak tamamlığı; görseller, şifre kaldırma, SEO/indeksleme ve deploy bu planın dışında.

## Kesin yayın ölçütü

- Evren'e işlenmiş **283 videonun her biri**, kitapta **en az bir onaylı bölümün açık kaynak video kimliğine** bağlanmalı.
- Kaynak kimliği tek başına yeterli değildir; ilgili videonun olay/konuşma içeriği bağımsız olarak o bölümde karşılanmış olmalı.
- Tek video tek bölüm zorunlu değildir. Aynı zincirin ayrı kayıtları birlikte işlenebilir, fakat farklı sahne veya farklı davet tek kesintisiz görüşmeymiş gibi anlatılmayacak.
- Yayın tarihi yalnız kaynak metadata bilgisidir; olay kronolojisi kaynaktan kurulacak.
- Kitabın TR ve EN yayın metinleri birbirini karşılamalı; isim, yer, kimlik, sayı ve belirsizlik notları kaynak dışında kesinleşmemeli.
- Eksik sahne/varlık görselleri açılışa engel değil. Özgün 105 bölüm gereksiz yere sıfırlanmayacak; yanlış veya eksik kaynak yansıtıyorsa sürümlü revizyon yapılacak.

## 16 Kasım başlangıç çizgisi

| Ölçü | Sayı |
|---|---:|
| İşlenmiş / ayıklanmış kaynak video | 283 |
| Kitapta doğrudan kaynak bağlantısı bulunan video | 112 |
| Onaylı kitap anlatısı | 105 |
| Yeni kapsam isteyen video | **171** |
| Bekleyen, onaylı hikâye veya olay düğümü mevcut video | 128 |
| Yalnız taslak hikâye/olay düğümü bulunan video | 43 |
| Bekleyen özgün altyazısı eksik video | 0 |
| Çalışma paketi | **18** (13 normal + 5 özel inceleme) |

Ek veri: Onaylı Evren 1.663 düğüm ve 3.619 ilişkidir. Hikâyeleştir ekranındaki 3.930 fark, genel kaynak baseline #13'e kıyasla 1.233 düğüm ve 2.697 ilişki değişimidir; ayrı bir **171 anlatı farkı** sayacı değildir.

## Çalışma dosyaları

- **Yeniden çalıştırılabilir ve salt-okunur denetim:** `apps/studio/birdesengor_book_coverage.py`
- **Kaynak envanteri / bölüm hashleri:** `channels/birdesengor/.local-data/studio/book-coverage/manifest.json`
- **İnsan okunur çalışma raporu:** `channels/birdesengor/.local-data/studio/book-coverage/REPORT.md`
- **18 delil paketi:** `channels/birdesengor/.local-data/studio/book-coverage/source-packets/batch-*.json`
- **Onaysız taslaklar:** `channels/birdesengor/.local-data/studio/book-coverage/drafts/` (kitap veya yayın değildir)

Kaynak paketleri altyazının tamamını, analiz özetlerini, olay sırası ipuçlarını, o videonun onaylı/taslak Evren düğümlerini ve mevcut kitaba olası bağları taşır. Paketler **kanıt dosyası** olarak değerlendirilir, otomatik yeni olay çıkarmak için kullanılmaz. Manifest, paketlerin ve mevcut bölüm metinlerinin hashlerini tutar. Yerel `.local-data` Git'e eklenmez.

## Aşamalar

**Aşama 0 — Kaynak envanteri / güvenlik (tamamlandı).** 283 kaynağın analizi, altyazısı ve bağlantıları test edildi. Envanter ve 18 paket hazır. Son genel kaynak farkı ve önceki 105 anlatı değişmedi. Snapshot bütünlük kontrolü çalışıyor.

**Aşama 1 — İlk 10 kaynak için yöntem sınaması (tamamlandı, TR/EN onaylı ve yerel kitapta).** Öncelik, onaylı olay/hikâye düğümü bulunan ilk pakete. Özgün altyazıdan kaynak-sınırlı taslak, başka model/kontrol turuyla kaynak denetimi, alternatif olarak mevcut bir bölümde yer alma kararı. Çalışma sadece özel taslak dosyalarına yazacak.

**Aşama 2 — Kalan 48 onaylı hikâye/olay kaynaklı video (sekizinci parti tamamlandı).** En fazla 10 videoluk partiler. Her video: bağımsız altyazı denetimi, doğal olay sınırları, mevcut kitap bağları, birleştirme/ayırma kararı, TR anlatı taslağı. Model tarafından önerilen belirsiz isimler doğrulanmış kimlik olarak otomatik yazılmaz. Taslaklar yayınlanmaz.

**Aşama 3 — 43 yalnız taslak kaynaklı video.** Onaylı olay düğümü yokluğu, video dışlanmış veya öyküsüz demek değil. Altyazıdan gerçek anlatı kapsamı denetlenir. Taslak varlıkları onaylamak gerekiyorsa kaynak bazında ve ayrıca; genel toplu onay yapılmaz. Anlatı kaynağı doğrudan video olabilir.

**Aşama 4 — Kontrol ve kitaba aktarım (17 Kasım'da yalınlaştırıldı).** Rutin işlemde geçici SQLite kopyası üretme. Tek gerçek Studio veritabanı üzerinde önce otomatik bütünlük kontrollü yedek al, sonra tek transaction ile yalnız kaynakça onaylı bölümleri ekle. Önceden onaylı bölümlerin birebir eşitliğini, genel kaynak baseline/3.930 farkını ve yabancı anahtar bütünlüğünü aynı işlemde denetle; hata varsa rollback et. Geçici kopya yalnız istisnai, yapısal/destrüktif şema geçişlerinde kullanılabilir.

**Aşama 5 — TR/EN ve son kalite.** Önce onaylanmış TR bölümlerinden EN üretilir; son iki dil metni, kaynak kimlikleri, linkler, folio ve konu ağacıyla birlikte sınanır. Doğrudan bağlanan 45 eksik EN Evren varlığı açıklaması da tamamlanır; diğer arşiv EN açığı ayrı kapsamda değerlendirilir.

**Aşama 6 — Yayın ölçütü.** 283/283 doğrudan bağlantı, tüm yeni metinlerin kaynak denetimi, önceki bölümlerde regresyon yokluğu, SQLite/FK, Studio/web unit/build, kitap masaüstü/mobil ve TR/EN okuyucu kabulü. Ancak bu noktada içerik **gerçek yayına hazır** denebilir. Şifre, SEO, indeksleme ve deploy ayrı son adımlar.

## Hızlı çalışma komutları

```bash
cd /home/raistlin/ChannelFoundry

# DB'ye veya çıktı dosyalarına dokunmadan durum sayımı:
python3 -B apps/studio/birdesengor_book_coverage.py --verify-only

# Mevcut çalışma envanterini ve 18 kaynak paketini yeniden doğrula:
python3 -B apps/studio/birdesengor_book_coverage.py --check-snapshot

# Yalnız kaynak değiştiğinde, mevcut TASLAKLARI koruyarak kaynak paketlerini yenile:
python3 -B apps/studio/birdesengor_book_coverage.py

# Nihai yayın kapısı (şu an kasıtlı olarak BAŞARISIZ olmalı):
python3 -B apps/studio/birdesengor_book_coverage.py --require-complete
```

## Değişiklik sınırı

- Önceki 105 onaylı bölüm, onların TR/EN varyantları, Evren düğüm/ilişkileri ve mevcut canlı yayın paketi korunur.
- Komutlar herhangi bir yeni bölüm onaylamaz, içerik yayımlamaz veya baseline farkını tüketmez.
- Yeni metinler için **kaynağın karşılandığını kanıtlayan kayıt** olmadan yalnız yeni kaynak ID ekleyip 283/283 gösterilmez.
- Kaftan, kılıç ve efekt üzerinde web alt-reposunda bulunan commit edilmemiş değişikliklere dokunulmaz.
- Olayların gerçekliği hakkında dış dünya filtresi uygulanmaz; metnin **anlatı içi kaynağa sadakati** kontrol edilir.

## Kapanış için tekrar kontrol

- `git status` root + web alt-repo;
- kayıt/veritabanı ve onaylı anlatı hashlerinin değişip değişmediği;
- paket hashleri ve 283 sayısı;
- ilk kaynak taslağı oluşturulduysa kaynak denetimi statüsü;
- açık Codex/AI süreçleri (oturum sonunda bırakılmamalı).

## Kaynak-sınırlı parti motoru

Tekrar eden üretim ve denetim çağrılarını yönetmek için `apps/studio/birdesengor_book_batch.py` eklendi. Video dosyaları **sıra numarasına değil, 11 karakterlik video ID'sine** bağlanır; yeni bölüm aktarıldığında iş listesi değişse bile taslak yanlış videoya taşınmaz. Kaynak paketi checksum'ı, taslak alıntılarının altyazıyla birebir eşleşmesi, denetimdeki hatalı alıntıların reddedilmesi ve audit/hash mührü kontrol edilir. Komutun kendisi **yalnız yerel taslak/denetim dosyaları üretir**; otomatik kitap onayı yoktur.

```bash
cd /home/raistlin/ChannelFoundry

# Bütün 171 kaynağın yerel taslak/denetim durumu:
python3 -B apps/studio/birdesengor_book_batch.py --action status

# Sadece ilk parti:
python3 -B apps/studio/birdesengor_book_batch.py --action status --batch 1

# Yalnız ilk partinin 10 kaynağında kaynak-sınırlı taslak üret:
python3 -B apps/studio/birdesengor_book_batch.py --action generate --batch 1 --limit 10 --model gpt-6.1-sol --effort medium

# Hazır taslaklar için bağımsız özgün altyazı denetimi:
python3 -B apps/studio/birdesengor_book_batch.py --action audit --batch 1 --limit 10 --model gpt-6.1-sol --effort medium
```

Parti yöneticisindeki `audited_pass` yalnız **otomatik kaynak karşılaştırması temiz** anlamına gelir. Bölümün editoryal olarak yayımlanacağına veya başka bir mevcut bölümle birleştirileceğine karar verilmiş değildir. `audited_review` manuel/ikinci tur gerektirir; `audited_fix` kaynak düzeltmesi gerektirir; `invalid_audit` ise alıntı/sözleşme denetimini geçmemiş rapordur.

**Uygulama notu:** İlk kaynak Q8e_Zar_dIM ("Zifir Kuyusu ve Okyanusun Dibi") ve ikinci kaynak VMcU2s8e-II ("Siyah Kitapların Peşindeki") ayrı kaynak-sınırlı taslaklara dönüştürüldü; ikisi de bağımsız kaynak denetiminde `pass` aldı ve metin/denetim/source hashleri mühürlendi. İkinci kaynağın ilk denetiminde AI taslakta bulunmayan bir cümleyle alakasız bir Ömer kimliği gerekçesi üretti; sözleşme bunu reddetti, hatalı rapor arşivlendi ve kurallar netleştirilerek denetim tekrarlandı. Hiçbir metin otomatik olarak değiştirilmedi veya kitaba aktarılmadı.

**Yayın kapısı sınırı:** `--require-complete` teknik olarak doğrudan video bağlantı sayısını 283/283'e çıkarma koşuludur; bunun geçmesi, nitel kaynak sadakatinin denetlendiği anlamına **tek başına gelmez**. Ayrı editoryal kanıt kayıtları tamamlanmadan yayına onay verilmez.


## 16 Kasım — İlk kaynak partisinin kapanışı

- **10/10 kaynakta taslak üretim ve özgün altyazıya bağımsız denetim PASS.** 3 gerçek ifade/kaynak atfı düzeltmesi ile yanıltıcı alıntı özetleri giderildi.
- Yeni on kayıt Düğümlü Kitap → Ara Kayıtlar içinde yerel Studio'da onaylandı: **105→115 anlatı**, **112→122 doğrudan kaynak video**.
- Kaynak-sınırlı run #21; önceki 105 anlatı/dil kaydının birebir eşitliği doğrulandı. 3.930 genel Evren kaynak farkı tüketilmedi.
- **TR 115/115, EN 115/115** güncel onaylı; İngilizce on bölüm kaynak yapısı ve dil doğrulamasını geçti.
- Yedek: `channels/birdesengor/.local-data/studio/backups/before-book-batch01-20261116.sqlite`.
- Geçmiş ilk kaynak/denetim/yerleşim dosyaları: `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-01-20261116/`.
- Güncel yeni başlangıç çizgisi: **283 işlenmiş / 122 kitapta / 161 kalan / 17 parti**; bunun **118** kaynağında onaylı olay-hikâye, **43** kaynağında yalnız taslak olay-hikâye var.
- Canlı site, şifre, SEO ve görsellerin yayını değiştirilmedi. Ayrıntılı rapor: `docs/BIRDESENGOR_283_BATCH01_EDITORIAL_APPROVAL_20261116.md`.


## 16 Kasım — İkinci kaynak partisinin kapanışı ve çeviri kararı

- **10/10 taslak + bağımsız kaynak denetimi PASS**, iki anlam/özne düzeltmesi ve bir geçersiz alıntı kaydı temizlendi.
- Yeni yerel kitap kapsamı: **125 onaylı TR anlatı**, **132/283 doğrudan video bağlantısı**, **151 video ve 16 parti bekliyor**.
- İkinci paket yedi Düğümlü/Ara Kayıtlar ve üç bağımsız anı olarak konumlandırıldı. Yeni metin içi varlık bağlantısı 20; önceki 115 anlatı, 230 TR/EN varyant ve 3.930 genel Evren farkı değişmedi.
- Yerel aktarım SQLite yedeği ve geçici kopya testi sonrası tek transaction ile yapıldı; veritabanı `quick_check=ok`, yabancı anahtar hatası 0.
- İlk iki kaynak partisi, taslakları ve denetim mühürleriyle `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/` altında ayrı arşivlerde. Aynı veriyi ikinci parti yedeğinden tekrar aktarma testi PASS.
- **Çeviri kararı:** Yeni her partinin EN tercümesi yapılmayacak. Önce **283 kaynağın tamamı Türkçe kitapta bitirilecek**, son Türkçe sürümler sabitlenip kaynak kontrolleri tamamlanınca **toplu EN** üretimi yapılacak. Mevcut 115 güncel EN metni korunacak.
- Tekrar kullanılabilir araçlar: `apps/studio/birdesengor_book_batch.py` (taslak ve denetim), `import-audited-video-batch.cjs` (yerleşim, yedekli yerel aktarım), `birdesengor_book_archive.py` (kanıt arşivi).
- Studio build PASS, web 289/289 unit PASS ve web build PASS; web tam E2E zinciri bu partide tekrar yürütülmedi.
- Ayrıntılar: `docs/BIRDESENGOR_283_BATCH02_EDITORIAL_APPROVAL_20261116.md`.
- Canlı site/SEO/parola/görsel/deploy işlemleri değiştirilmedi.

## 16 Kasım — Üçüncü kaynak partisinin kapanışı

- **10/10 kaynak-denetimli Türkçe anlatı kabul edildi**; **135 onaylı TR bölüm, 142/283 video kapsaması, 141 kaynak ve 15 parti kaldı**.
- Yeni kayıtların sekizi Kapsız Kitap'a, Yedikule ve İbni Kâruf kaydı bağımsız anılara yerleştirildi; mevcut Kapsız dizisi ilk kayıtların arkasına taşındı, gövdesi değiştirilmedi.
- Eski 125 metin/revizyon/dil kaynağı ve 240 dil varyantı korundu; 3.930 genel Evren farkı değişmedi.
- Güncel **115 İngilizce** onay korundu; bütün 283 kaynak tamamlanmadan yeni EN üretimi yok.
- Yedekli geçici ve gerçek yerel SQLite aktarımı, kanıt arşivinden yeniden oynatma, Studio derlemesi, web **289/289** birim testi ve web derlemesi PASS.
- Arşiv: `completed-batches/batch-03-20261116/`; rapor: `docs/BIRDESENGOR_283_BATCH03_EDITORIAL_APPROVAL_20261116.md`.
- Canlı yayın, şifre, SEO, görseller, deploy ve push kapsam dışında kaldı.


## 16 Kasım — Dördüncü parti kaynak hazırlığı (AI limiti nedeniyle üretim aşaması bekliyor)

- On özgün altyazı ve kaynak düğüm bağlantısı doğrulandı; envanter hashleri değişmedi.
- İki Kapsız Kitap kaydı, yedi Meclis/Elçi kaydı, bir bağımsız İznik kaydı için *henüz onaylanmamış* editoryal yerleşim önerisi hazırlandı.
- `Büyük Meclisler` yeni dizi oluşturma yeteneği yalnız geçici SQLite kopyasında başarıyla test edildi; gerçek veritabanına uygulanmadı.
- Codex kullanım limiti dolduğu için **0 taslak ve 0 denetim** tamamlandı. OpenCode/DeepSeek bağlantısı da zaman aşımı verdi.
- Güncel kitabın durumu değişmedi: **135 TR, 115 EN, 142/283 video kapsaması, 141 bekleyen kaynak ve 15 parti**. Kullanım limiti hatalarında toplu başarısız çağrıların sürmesini engelleyen koruma eklendi.
- Ayrıntılı rapor: `docs/BIRDESENGOR_283_BATCH04_SOURCE_PREP_20261116.md`.

## 16 Kasım geç saat — Codex çok ajanlı iki kaynak pilotu hazırlandı

- Dördüncü partinin ilk iki kaynağında A/B karşılaştırma için `gpt-6.1-sol/medium` tek ajan ve `gpt-6.1-terra/high` + `multi_agent_v2` (en fazla iki Sol/Medium subagent) akışları hazır.
- Her ikisini de `gpt-6.1-sol/high` ile bağımsız kaynak denetiminden geçiren ölçümlü pilot script'i ve sahte Codex ile çevrimdışı testler oluşturuldu.
- Codex JSONL `turn.completed.usage` bilgisi, giriş/cache/çıkış tokenları ve süreyi ayrı topluyor; metrik yoksa bilinmiyor diye bırakılıyor. Her belge ve model izole klasöre yazılıyor.
- Klasik 10'luk script'e **opsiyonel** `--meter-tokens` eklendi; eski komut davranışları varsayılan olarak değişmedi.
- *Bu hazırlık kontrol noktasında* gerçek model çağrısı yapılmadı. Ardından kota yenilenmesiyle ölçümlü A/B pilotu gerçekleştirildi; gerçek token ve denetim sonuçları aşağıdaki ek bölümde kayıtlıdır.
- Hiçbir anlatı onaylanmadı/aktarılmadı. Kapsam hâlâ **135 TR / 115 EN / 142/283 video**.
- Tam plan ve yönergeler: `docs/BIRDESENGOR_283_CODEX_AB_PILOT_20261116.md`.


## 16 Kasım gece — İki kaynak A/B ve native subagent deneyi tamamlandı

- Sol/Medium üretim + Sol/High denetim, iki kaynakta toplam **549.326 raporlanan token / 311 sn**; denetimlerde ilk kaynak **pass**, ikinci kaynak yalnız **1 küçük dil bulgusu** verdi.
- Terra/High fiilen tek ajan üretim + aynı denetçi toplam **401.449 token / 202 sn**: daha hızlı ve az token, ancak ikinci kaynak **2 engelleyici anlam hatası + 1 inceleme** taşıyordu. İki taslağın uzunluğu da Sol anlatılarının yaklaşık yarısıydı.
- Gerçek `multi_agent_v2` deneyinde iki Sol/Medium yardımcı ajan açıldı. İlk kaynakta kök **306.109 token**, yardımcı oturumlar **154.998** ve **120.434** token bildirdi: oturum bazlı yaklaşık **581.541** token, buna rağmen geçersiz kaynak alıntısı. İkinci native deneme maliyet yükselirken durduruldu.
- Karar: **kaynak-sınırlı anlatı için Sol/Medium**, bağımsız **Sol/High** denetimi ve `--meter-tokens`; native alt ajanlı toplu içerik üretimi kullanılmayacak. Terra High ileride dar kapsamlı seri/yerleşim kontrolünde ayrıca denenebilir.
- Native çalışma artık `--allow-expensive-native` açık onayını gerektiriyor; başarısız / hatalı taslaklar başka kaynaklarla karıştırılmadan saklandı.
- Deneme **Studio kitabına aktarım yapmadı**; güncel durum **135 TR, 115 EN, 142/283 kaynak, 141 bekleyen video**. Sıradaki onluk partinin statüsü hâlâ `not_started:10`.
- Ayrıntılı kaynak hata ve token raporu: `docs/BIRDESENGOR_283_CODEX_AB_RESULTS_20261116.md`.

## 17 Kasım — Dördüncü 10'luk paketin kapanışı

- **10/10 kaynak-denetimli Türkçe anlatı** yerel Studio kitabına eklendi. Kaynak denetimi Sol/High, üretim Sol/Medium; Terra pilot taslakları içeri aktarılmadı.
- Yeni durum: **145 onaylı TR / 115 onaylı EN / 152/283 doğrudan video / 131 bekleyen / 14 parti**. Bunların 88'i onaylı, 43'ü yalnız taslak hikâye/olay düğümlü video.
- Yeni `Büyük Meclisler → Kayıtlar` dizisinde 7 bölüm; Kapsız Kitap'a iki 2025 kaynaklı bölüm, bir İznik Bazilikası bağımsız anısı. Mevcut Kapsız kitabındaki 2026 kaydının yalnız okuma sırası 8 → 10 değişti.
- Önceki 135 anlatı, 135 revizyon, 135 dil kaynağı, 250 TR/EN varyantı, 4 dizi ve 5 bölüm metadata'sı korundu. **3.930 genel Evren farkı** hâlâ bekliyor.
- Yedekli yerel aktarım, arşivden geri oynatma, SQLite, Düğümlü/Anlatı/Yayın testleri, Studio build, web 289/289 birim testi ve web build PASS. Tam tarayıcı E2E yapılmadı.
- Kaynak/dil/AI log arşivi: `completed-batches/batch-04-20261117/`. Raporda kaynak editörlüğü ve mevcut token metriklerinin sınırları açıklanıyor.
- İngilizce tercümeler, görseller, SEO, site şifresi, canlı yayın ve push kapsam dışında.
- Detay: `docs/BIRDESENGOR_283_BATCH04_EDITORIAL_APPROVAL_20261117.md`.

## 17 Kasım — Codex kotasını koruyan yalın iş akışı

- Bir önceki onluk paketin **2.388.543** raporlanan son çağrı tokenının **924.599'u (%38,7)** kaynak denetimiydi; ek yeniden denetimlerin tamamı bu sayıya dahil değildi.
- Artık Codex'e yalnız gerekli ilk anlatı taslağını veriyoruz. Prompt **tek videonun orijinal altyazısını doğrudan** taşıyor; on videoluk kaynak paketini, analiz ve Evren düğümlerini tekrar okutma kaldırıldı. Native subagent kapalı, yeni oturum kalıcı geçmiş bırakmıyor; token metrikleri otomatik açılıyor.
- Kaynak/konuşmacı/zaman kipi/yerleşim/izlenebilirlik kontrolünü asistan üstlenecek. Manual denetim, her paragrafın incelendiği kayıt, ilk-orta-son kaynaktan 5+ karşılaştırma kanıtı, taslak ve kaynak SHA-256 mühürleri olmadan `pass` olamaz. Codex ile yeniden denetleme varsayılan olarak engellendi.
- Veritabanında **tek aktif Studio SQLite** var. Önceki `/tmp` kopyaları yalnız prova amaçlıydı; rutin akıştan çıkarıldı ve bu geçici klonlar temizlendi. Uygulamanın gerçek `backups/` güvenlik yedekleri korundu.
- `--apply --live --backup-auto` önce SQLite online backup API ile doğrulanan yeni yedek üretir, ardından tek transaction'da asıl veritabanına yazar. Otomatik öncesi/sonrası kontroller korunuyor.
- Güncel kural: görsel, çeviri, SEO, canlı deploy, push yok; **283/283 kaynak** hedefi sürüyor.
- Uygulama ve kullanım ayrıntısı: `docs/BIRDESENGOR_283_YALIN_KAYNAK_AKISI_20261117.md`.


### 17 Kasım — Yalın yöntemle ilk gerçek kaynak denemesi

- Beşinci partide `W2CCtGv2trE` tek-altyazı promptuyla ilk taslağını aldı: **35.578 raporlanan token**, cache 0, **132 sn**. Yeni prompt öncekinden daha küçük kaynak kapsamına sahip.
- **35 paragraf ve 11 kaynak kanıtıyla asistanın doğrudan incelemesi** tamamlandı, üç düzeltme yapıldı; ikinci Codex çağrısı yapılmadan kaynak incelemesi `audited_pass` oldu.
- Yeni manuel kanıt SHA mührü tek Studio DB aktarım aracının salt-okunur `IMPORT_READY` doğrulamasından geçti. **Gerçek kitaba aktarılmadı**, dokuz yeni kaynak henüz başlanmadı.
- Üretim modellerinin toplam token düşüşü cache etkisinden ayrılmadan kota/ücret tasarrufu ilan edilmiyor.


## 17 Kasım — Yalın iş akışıyla beşinci 10'luk paketin tamamlanması

- 10 kaynak, yalnız **10 tek-altyazı Codex/Sol Medium ilk taslak** çağrısıyla üretildi. Toplam **348.350 raporlanan token**; herhangi bir ikinci AI denetçisi veya subagent yok.
- Asistan her videonun özgün altyazısını ve tüm taslak paragraflarını ayrı okudu; kaynakla karşılaştırma kanıtlarını, gerekliyse metin/alıntı düzeltmelerini ve **10/10 kaynak denetimi mühürlerini** oluşturdu.
- Yalnız gerçek Studio SQLite kullanıldı. Salt-okunur plan kontrolü, otomatik doğrulanmış yedek ve tek transaction ile **145 → 155 TR**, **152 → 162 / 283** video, mevcut **115 EN** aynı kaldı.
- Yeni dizi: **Bilginler Kitabı (1)** ve **İstihbarat Davetleri (4)**. Kapsız Kitap 11 → 12, Büyük Meclisler 7 → 8, üç bağımsız kaynak.
- Önceki **145 bölüm, 145 revizyon, 145 dil kaynağı, 260 dil varyantı ve 5 dizi/6 bölüm tanımı** birebir korunmuştur; yalnız Kapsız Kitap'taki eski bir bölümün konumu 10 → 11 oldu. Genel Evren farkı **3.930** olarak kaldı.
- **121 video / 13 parti** kaldı: 78 onaylı hikâye/olay düğümlü, 43 yalnız taslak düğümlü. İngilizce çeviriler en sona, görseller ve canlı yayın daha sonraya kaldı.
- Ayrıntılar: `docs/BIRDESENGOR_283_BATCH05_EDITORIAL_APPROVAL_20261117.md`.


## 17 Kasım — Altıncı 10'luk paket, kaynak denetimi ve lokal onay

- **10/10** özgün altyazıdan üretilen Türkçe kaynak anlatısı asistan tarafından tüm paragraf ve özgün alıntılarıyla incelendi, ikinci Codex denetçisi kullanılmadı; **341.244 token** raporlanan toplam ilk üretim.
- Babil gerçek Büyük Saray toplantısı ve siyah yüzük, Mısır/Aruhan/Edebola/Natra Tapınağı/Petrus hattı, Şenu Kuyusu deneyi, Üç Dağlar kabileleri, Doğubayazıt rahibi ve Anunaki davetçisi ayrı kaynak kayıtları olarak bağlandı.
- Bir altyazı çapası birebir eşleşmediği için gövde korunarak çıkarıldı. **Edebola 12** yanlışlıkla on ikinci davet sayılmıştı; kod adına düzeltildi ve eski taslak muhafaza edildi.
- **Tek Studio DB**, salt-okunur plan doğrulaması, otomatik doğrulanmış yedek ve tek transaction: **155 → 165** TR anlatı, **162 → 172 / 283** kaynak, **115** eski EN korundu, **3.930** genel Evren kaynak farkı saklandı.
- Önceki **155 bölüm, 155 revizyon, 155 dil kaynağı, 270 dil varyantı ve eski kitap konumları** yedekle birebir eşitti. **289/289** web test geçti, Studio ve web derlemeleri başarılı.
- Tamamlanan altıncı paket arşivlendi. **111 video / 12 paket** kaldı; 68'i onaylı hikâye/olay düğümlü, 43'ü henüz taslak düğümlü. İngilizce tercümeler 283 Türkçe tamamlanınca.
- Detay: `docs/BIRDESENGOR_283_BATCH06_EDITORIAL_APPROVAL_20261117.md`.


## 17 Kasım — Yedinci 10'luk paketin kapanışı

- Önceki mesaj akışı kesildiğinde 10 ilk taslak üretilmiş, 2 denetim mühürlenmişti. Terminalden durum doğrulandı; **kalan 8 kayıt** özgün altyazılarla karşılaştırılıp **10/10 kaynak denetimi** tamamlandı. Yeni Codex denetçisi çalıştırılmadı.
- Yeni yerleşimler: Bilginler Kitabı'na 1, Büyük Meclisler'e 4, İstihbarat Davetleri'ne 5. Suman/Şandina toplantısı, ilk iki boynuzlu padişah daveti ve sonraki Mitna görüşmesi ayrı aşamalar olarak korundu.
- Son iki ada anlatısında ağır iddialar yalnızca anlatıcıya ve davetliye atfedildi; yaşadığı iddia edilen kişinin kimliği/nerede bulunduğu ve adalardaki fiiller bağımsız kanıt olarak doğrulanmadı.
- Tek kanonik SQLite, salt-okunur preflight, otomatik doğrulanmış yedek ve tek transaction: **165 → 175 TR**, **172 → 182/283 video**, mevcut **115 EN** aynen korundu; genel **3.930 Evren farkı** değişmedi.
- Önceki 165 anlatı ve revizyon, 165 dil kaynağı, 280 dil varyantı, seri/bölüm metadata'sı ve kitap konumları birebir yedekle eşitti.
- Codex ilk üretimi **343.778 raporlanan token**, ikinci AI denetçi **0**. Studio build, 289/289 web birim testi, web build ve anlatı/yayın denetimleri PASS.
- **101 video / 11 parti** kaldı: 58 onaylı hikâye/olay düğümlü, 43 yalnız taslak düğümlü kaynak. Tercüme/görsel/SEO/deploy/push ertelendi.
- Rapor: docs/BIRDESENGOR_283_BATCH07_EDITORIAL_APPROVAL_20261117.md


## 17 Kasım — Sekizinci 10’luk kaynak paketi tamamlandı

- 10/10 özgün altyazı ve Türkçe anlatı kaynak denetimi mühürlendi, ikinci Codex denetçisi kullanılmadı. Mesaj teslimi zaman aşımı sonrası statü ve salt-okunur ön kontrol doğrulanıp gerçek aktarım yapıldı.
- Karima meclisi Büyük Meclisler’e, diğer dokuz kayıt İstihbarat Davetleri’ne eklendi. Eski kitap sıraları değişmedi.
- Tek Studio SQLite, otomatik doğrulanmış yedek, tek transaction: **175 → 185 TR**, **182 → 192/283 video**, **115 EN** korundu. 3.930 genel Evren kaynak farkına dokunulmadı. Kaynak run **#28**.
- Önceki **175 anlatı, 175 revizyon, 175 dil kaynağı, 290 dil varyantı**, tüm dizi ve bölüm konumları yedekle birebir aynı. Arşivde 10 taslak, 10 kaynak kanıtı, 10 denetim mührü ile Codex alternatifi sürümleri saklandı.
- İlk yedi Codex çağrısında ölçülebilen **249.447 token**; kota sınırına takılan üretim ve yenilenme sonrası üç Codex yeniden üretimi için toplam kullanım bu sayıya dahil değil.
- Studio build, **289/289 web testi**, web build ve Düğümlü/anlatı/yayın kontrolleri PASS. İngilizce/görsel/SEO/şifre/deploy/push yapılmadı.
- **91 video / 10 parti** kaldı: **48 onaylı düğümlü**, **43 yalnız taslak düğümlü**. Detay: docs/BIRDESENGOR_283_BATCH08_EDITORIAL_APPROVAL_20261117.md.
