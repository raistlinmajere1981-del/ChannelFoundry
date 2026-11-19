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
