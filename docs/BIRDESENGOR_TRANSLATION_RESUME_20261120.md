# BirDeSenGör — Evren İngilizce Çevirileri, 20 Kasım 2026 Devam Noktası

## Doğrulanmış son durum (20 Kasım 2026, ~02:55 Türkiye saati)

- Resmî canlı yayın: `pub-1ccc2f5f3c4c0584ada7e4e2` (fingerprint: `1ccc2f5f3c4c0584ada7e4e28b0ad422e5ca4520158e7368805d9408c59cbc22`).
- Geçerli onaylı TR Evren: **2.684**; geçerli onaylı EN Evren: **1.879**; **kalan gerçek eksik: 805**.
- Bu oturumda 921 yeni EN Evren çevirisi tamamlandı, otomatik kaynak/yapı kontrollerinden geçti, Studio SQLite'a kaynak/revizyon bağımlılığı ve `manual=0` işaretiyle aktarıldı ve canlıya çıktı. İnsan tarafından tek tek denetlendiği iddia edilmiyor.
- Kaydedilmiş yerel Evren adayları: **1.472**, tamamı teknik denetimde temiz; bunun 551'i önceki oturumda, 921'i bu oturumda tamamlandı.
- Canlı Evren toplam 2.717, ilişkiler 5.519, görseller 15. Canlı SEO: 5.222 sayfa; sitemap: 5.224 URL. Türkçe, sahne, kitaplar, görseller ve ilişkiler korunmuş; canlı publication sunucudan tekrar okunarak birebir doğrulandı.
- Eski manifestin 1.727 bekleyen kaydı ile gerçek 1.726 açığı arasındaki fark, Hakan/Hakan Demir birleştirmesinden kaldırılan `universe-character-3e78846d1ca1c3` kimliğinden geliyor. Bu kimliği **yeniden üretme**.
- Git ana dalı: `bf2f55a` commit'i Huşimi QA özel isim regresyonunu ekleyerek GitHub'a gönderildi; 18/18 test geçti. Bu belge de ayrıca commit ediliyor.

## Kalan 805 kaydın çakışmasız dağılımı

| Durum | Kayıt |
|---|---:|
| DeepSeek A/B/C kuyruklarında, henüz tamamlanmamış | 327 |
| Codex kısa grup kuyruğu 2, planlanmış ve bitmemiş | 333 |
| Eski DeepSeek hata/kurtarma kuyruğu (boş yanıt, ECONNRESET) | 8 |
| Henüz modele atanmadı | 137 |
| **Toplam** | **805** |

Ortak kayıt defteri ve güncel kaynak hash'leri:
`channels/birdesengor/.local-data/studio/translation-work-20261119/evren-ledger-20261120.json`.

İhtiyaç duyuldukça defteri güncelle:

```bash
cd /home/raistlin/ChannelFoundry
w=channels/birdesengor/.local-data/studio/translation-work-20261119
node "$w/evren-ledger.cjs"
node apps/studio/translation-durable.cjs audit --batch universe
BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-2 node "$w/codex-universe-bulk-terra.cjs" status
node "$w/parallel-deepseek-universe.cjs" status
```

## Model kotası ve güvenli devam

- DeepSeek `opencode/deepseek-v4.1-flash-free`, reasoning max; OpenCode sunucu `127.0.0.1:4096`. DeepSeek ücretsiz kota sınırına ulaştı. `$w/quota-paused.json` işareti duruyor. Sunucunun HTTP 200 dönmesi kotanın yenilendiğini göstermez.
- Codex `gpt-6.1-terra`, reasoning high. Son doğrulanan kullanım haftalık **%88**, beş saatlik **%98**. Koruma: haftalık %95, beş saatlik %98. `$w/codex-universe-bulk-terra-2/budget-paused.json` işareti korundu. Yeni model isteği gönderilmedi; çalışan işçi kalmadı.
- Güncel kota penceresi yenilenmeden veya gerçek telemetri görülmeden işaretleri kaldırma.
- Codex beş saatlik kota sıfırlandıktan sonra yalnız lane 2'nin `budget-paused.json` işaretini tarihli bir arşiv adıyla taşı ve aşağıdaki komutla **kaldığı 48 paketten** devam et. 333 kayıt bu lane'e kaynak hash'iyle atanmış durumda:

```bash
cd /home/raistlin/ChannelFoundry
w=channels/birdesengor/.local-data/studio/translation-work-20261119
# Önce güncel Codex kullanım verilerini ve %95 haftalık sınırını doğrula.
# SADECE beş saatlik kota yenilenmişse, eski koruma işaretini yedekle:
# mv "$w/codex-universe-bulk-terra-2/budget-paused.json" "$w/codex-universe-bulk-terra-2/budget-paused-before-reset.json"
BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-2 node "$w/codex-universe-bulk-terra.cjs" run 3
```

- Eski A/B/C DeepSeek manifestleri ve zaten tamamlanmış İngilizce kayıtlar tekrar modele gönderilmemeli. DeepSeek kota yenilenirse yalnız kendi durdurma işaretleri güvenle temizlenebilir. Eğer DeepSeek yine sınırlıysa, kuyrukları Codex'e aktarırken **tek sahipli, açıkça kilitlenmiş handoff** kullan; model hatlarını aynı kayıtta eşzamanlı çalıştırma.
- `codex-universe-bulk-terra.cjs` sonraki bağımsız dalgayı `BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-3` gibi ayrı bir lane'e planlayabilir; önce tamamlanmamış lane2'yi bitir. Yeni dalga, önceki tüm DeepSeek/Codex manifest kimliklerini rezerve ederek çakışmayı önler.
- Kurtarma için eski `universe/errors` altındaki sekiz kimliği defterden belirle. Tamamlanmış adayların eski ham cevapları ve editoryal düzeltmeler yerinde saklanıyor; tekrar model çağrısından önce bunları kullan.
- Kaynak sadakati, özel adlar, sayı ve yönler, Ömer'in birinci kişi anlatımı, gerçekleşen/iddia edilen/planlanan ayrımı önceki oturumun kurallarıyla aynıdır.

## Yayın ve yedek dosyaları

Güncel ve **canlıyla doğrulanmış** yerel baseline dosyaları:

- `channels/birdesengor/.local-data/studio/public-export/publication-live-baseline.json`
- `channels/birdesengor/.local-data/studio/public-export/seo-live-baseline.json`

**ÖNEMLİ:** `official-release-20261120/real/` içindeki dosyalar resmî ilk açılışın eski yayınıdır, artık güncel baseline olarak kullanılmamalı. Yeniden yayınlamak için `$w/prepare-evren-release.cjs` / `publish-evren-release.cjs` / `apply-evren-release-local.cjs` hazırlanmıştır; bu betikler artık güncel `public-export` baselinelarını kullanır. Varsayılan yeni iş klasörü `$w/evren-release-20261120-r2`; farklı tur için `BDS_EVREN_RELEASE_DIR=evren-release-20261120-r3` kullanılabilir.

Doğrulanmış bu turun yedekleri ve yetkili yayın kanıtları:

`$w/evren-release-20261120/` içinde `pre-release-studio.sqlite`, `pre-existing-live-publication.json`, `pre-existing-seo-manifest.json`, `pre-existing-seo-workspace.json`, `translation-candidate-snapshot.tar.gz`, `backup-checksums.sha256`, `release-publication.json`, `release-seo.json`, `release-report.json`, `remote-verified.json` ve `studio-applied.json`.

Bu turda önceki geçersiz ama veritabanında `approved` duran **10 eski EN varyantı** tespit edildi; hiçbiri canlıda geçerli EN olarak yayınlanmamıştı. Yeni geçerli EN'e geçmeden eski varyantlar `obsolete-approved-english-backup.json` ve `obsolete-approved-english-from-live-sqlite.json` dosyalarına kaydedildi. Geçerli yayın onayları değiştirilmedi.

Son yayında açıkça şu korumalar doğrulandı: 2.717 Evren, 15 görsel, 5.519 ilişki, 1.879 İngilizce; 5.222 SEO sayfası; 5.224 sitemap URL'si; SQLite `PRAGMA quick_check=ok`; 18/18 QA testi. Git depolarını yeni çalışmaya başlamadan kontrol et.

## Hedef

Yeni oturumun hedefi mevcut **805** eksik Evren kaydını, kaydedilmiş sonuçları değiştirmeden bitirmek; son kontrol sonrasında kontrollü yayın + SEO güncellemesi yapmak ve yeni fingerprint ile canlı içerik/SEO/SQLite eşleşmesini doğrulamak. Bu oturumda kullanıcıdan tek tek onay istenmiyor; fakat teknik doğrulama insan editoryal incelemesi diye etiketlenmeyecek.

---

## 03:18 Türkiye saati — kota yenilenmesi sonrası ikinci çalışma

Önceki oturum kapanışındaki 805 eksik kaydın 54'ü bu turda tamamlanarak **751 eksik** kaldı. Kullanıcı ekranında Codex haftalık %11, beş saatlik %2 kalan gösterdi; oturumda doğrulanan yeni telemetride Codex haftalık **%89 kullanılmış**, beş saatlik **%99 kullanılmış** düzeyindeyken koruma devreye girdi. Beş saatlik kotanın raporlanan sıfırlanma tarihi **20 Kasım 2026, 03:35 Türkiye saati**. Model isteklerini kota yenilenmeden başlatma.

Güncel durum:

- Geçerli Studio/canlı Evren İngilizce **1.879/2.684**; canlı yayın hâlâ `pub-1ccc2f5f3c4c0584ada7e4e2`.
- Yerel kaynak-hash sabitli **1.526** Evren adayı, tamamı temiz; bunun 54'ü bu turda üretildi, henüz Studio'ya onaylı EN olarak aktarılmadı ve canlıya gönderilmedi.
- Bu turdaki +54: DeepSeek A/B/C ile **40**, Codex Terra kısa paketleriyle **14**.
- DeepSeek ücretsiz kota ikinci kez doldu: `$w/quota-paused.json` açık, OpenCode sunucusunun çalışıyor olması kotanın yeterli olduğu anlamına gelmiyor.
- İlk eşzamanlı A/B/C denemesinde B'nin SQLite okuması `database is locked` ile durdu; kodda `PRAGMA busy_timeout=15000` ve kilidi hazırlık okumasından sonra alma değişikliği yapıldı. B güvenli yeniden başlatıldı. Artık çalışan DeepSeek işçisi veya pasif `.worker.lock` kalmadı.
- DeepSeek'in **287** eksik A/B/C kayıt kimliği, kota durdurma kaydı doğrulanarak atomik `$w/deepseek-handoff-to-codex-20261120.json` dosyasıyla Codex'e devredildi. Kaynak ID/hash/TR revizyonu değişmedi. `parallel-deepseek-universe.cjs` bu devri görürse A/B/C'yi yeniden açmıyor; `translation-durable.cjs` devredilen ID'leri model çağrısından önce atlıyor.
- Codex toplu lane2 83/129 paket tamamlandı; toplam plan 900, 575 kayıt başarılı; bu tur +14. Kalan **319**.
- Codex toplu lane3: 144 yeni plan (136 daha önce atanmamış + 8 eski DeepSeek hata kurtarması), **30** paket, tamamı bekliyor.
- Codex toplu lane4: yukarıdaki **287** DeepSeek devir kaydı, **41** paket, tamamı bekliyor.
- Codex tekil `codex-universe-terra.cjs`: `universe-character-9486e8fa3bbfb1`, 13.181 karakter, dört parçalı tek uzun kayıt; planlı, henüz yeni model çağrısı yok.
- Toplam bekleyen: 319 + 144 + 287 + 1 = **751**. Ortak `evren-ledger.cjs` bunu onaylı 1.879 + temiz aday 54 + atanmış 751 = 2.684 olarak doğruluyor.
- 1.526/1.526 yerel adayda QA temiz, 0 flagged/invalid/stale. Tamamlanan 54 adayın ham çıktıları saklı.
- GitHub `main` en son `55f6130` ile kaynak kilidi/devir kontrolü düzeltmesini aldı; 18/18 regresyon testi geçti.

Yenilenmiş Codex kullanımını onaylamadan `budget-paused.json` işaretini kaldırma. Eski işareti tarihli yedeğe taşıdıktan sonra, şu sırayla kaldığı yerden devam et:

```bash
cd /home/raistlin/ChannelFoundry
w=channels/birdesengor/.local-data/studio/translation-work-20261119
# Yeni beş saatlik kotayı (ve haftalık %95 durma eşiğini) telemetriden doğrula.
# Dosya duruyorsa yalnız lane2'nin eskimiş budget-paused.json işaretini arşivle.
BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-2 node "$w/codex-universe-bulk-terra.cjs" run 1
# Sıfırlama doğrulandıysa uygun paralellik (üç) ile devam:
BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-2 node "$w/codex-universe-bulk-terra.cjs" run 3
BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-3 node "$w/codex-universe-bulk-terra.cjs" run 3
# Codex lane4 DEVRE DIŞI: devir geri alındı; A/B/C tekrar DeepSeek sahibi.
node "$w/codex-universe-terra.cjs" run 1
node "$w/evren-ledger.cjs"
node apps/studio/translation-durable.cjs audit --batch universe
```

**Notlar:** Her yeni Codex isteği öncesi son usage yüzdesi yeniden kontrol edilir. Toplu Codex yürütücüsü `fiveHourResetAt` alanını kullanıyor; eski telemetri sıfırlanma tarihinden önceyse durur, gerçek sıfırlanma saati geçtikten sonra yalnız yeni kota durumunu doğrulamak için küçük bir denemeye izin verir. Haftalık %95 koruması değişmedi. İki modelin aynı ID'ye istek yapması engellendi.

Son yayın `public-export/publication-live-baseline.json` ve `public-export/seo-live-baseline.json` dosyaları üzerinden hazırlanmalı; `official-release-20261120/real` artık eski bazdır. Tamamlanan adayların tümü QA'yı geçerse yeni yayın klasörü varsayılan `evren-release-20261120-r2` olacaktır. Önce yeniden bütün yedekleri al; daha sonra `prepare-evren-release.cjs`, `publish-evren-release.cjs`, `apply-evren-release-local.cjs` adımlarını kontrollü çalıştır ve yayındaki Türkçe, 15 görsel, 5.519 ilişki, SEO/sitemap ve SQLite eşleşmesini denetle.

Codex kota yenilenmesini takiben 03:37 Türkiye saatine tek seferlik devam görevi tanımlandı; yalnız bu otomasyonun doğrulanmış çıktıları gerçek tamamlanma ve yayın sonucu olarak kabul edilmeli.


---

## 03:26 Türkiye saati — DeepSeek yenilenen kota sonrası son durum (önceki 03:18 bölümünün üstüne geçer)

Kullanıcı OpenCode kotasının yenilendiğini bildirdi, Codex beş saatlik pencere sıfırlanmasına yaklaşık 15 dakika vardı. İlgili **287 A/B/C kaydının tamamı henüz Codex tarafından işlenmemiş** olduğundan geri devir güvenle gerçekleştirildi:

- Eski Codex lane4 planı/41 paketi, bir ham Codex cevabı veya `finished.json` üretmeden `$w/codex-universe-bulk-terra-4-revoked-20261120-0323/` dizinine atomik taşındı. **Bu arşivdeki işleri çalıştırma.**
- Eski devir bildirimi `$w/deepseek-handoff-to-codex-20261120.revoked.json` adıyla arşivlendi; iade kanıtı `$w/deepseek-ownership-restored-20261120.json`. Kimlikler, sourceHash ve trHash bire bir kontrol edildi.
- Açık A/B/C DeepSeek manifestleri aynı kaldı; bu kayıtlardaki tek model sahibi **DeepSeek**. Codex 03:37'de tekrar çalıştığında eski lane4'ü asla başlatmasın.
- DeepSeek A/B/C tekrar üç paralel oturumla çalıştı; bu turda **40 yeni aday** daha tamamlandı. Üç işçi kapandı ve ücretsiz kota işareti tekrar oluştu. Tekrar kota yenilenmeden bu işareti kaldırma.
- `parallel-deepseek-universe.cjs merge` ile 40 aday ana Evren sonuçlarına aktarıldı. `translation-durable.cjs audit --batch universe` sonucu **1.566 temiz, 0 flagged, 0 invalid, 0 stale**. Kaydedilmiş 40 ham aday korunuyor.
- **Canlı geçerli EN: 1.879 / TR: 2.684.** Yeni yerel temiz aday **94**; gerçek eksik çeviri **711**.
- Kalan 711 dağılımı: **DeepSeek A/B/C 247**, Codex lane2 **319**, Codex lane3 **144**, uzun tekil Codex **1**. Revoked Codex lane4 bu dağılımda YOK.
- A/B/C'yi ileride yeniden açmak yalnız DeepSeek kotasının gerçekten yenilenmesi halinde güvenli; daha önceki 287 kayıt planı yerinde, kalan 247 aynı 3 manifestin eksik kayıtlarıdır.
- 03:37'deki kayıtlı otomatik devam görevi güncel dağılıma göre düzenlendi: Codex yalnız lane2/3 ve tek uzun kayda bakacak, eski lane4 yok.
- Git değişiklikleri bu belgeyle kaydedilmiştir. Üretim dosyaları `.local-data` içinde kalır, git'e eklenmez.

Kısa denetim:

```bash
cd /home/raistlin/ChannelFoundry
w=channels/birdesengor/.local-data/studio/translation-work-20261119
node "$w/evren-ledger.cjs"
node apps/studio/translation-durable.cjs audit --batch universe
node "$w/parallel-deepseek-universe.cjs" status
BDS_CODEX_BULK_LANE=codex-universe-bulk-terra-2 node "$w/codex-universe-bulk-terra.cjs" status
```

**Sonraki güvenli işlem:** Codex kotası doğrulanınca lane2'de kaldığı paketten devam. Haftalık %95 kullanım koruması değişmez. DeepSeek kota yenilenmemişse 247 kayıt DeepSeek'in duraklatılmış özgün A/B/C manifestlerinde saklanır. Yayın için güncel `public-export` baseline, yedekler, kaynak hash kontrolü, SEO ve canlı yeniden okuma şarttır; insan incelemesi yapılmış gibi işaretleme.
