# BirDeSenGör — Evren İngilizce çevirileri tamamlandı

**Tarih:** 20 Kasım 2026
**Durum:** Tamamlandı; kaynak bağımlılığı doğrulanmış bütün onaylı Türkçe Evren kayıtlarının geçerli İngilizce karşılığı canlı yayında.

## Kesinleşmiş sayılar

- **Onaylı ve geçerli Türkçe Evren:** 2.684
- **Onaylı ve geçerli İngilizce Evren:** 2.684
- **Eksik çeviri:** 0
- **Canlı toplam Evren varlığı:** 2.717
- **Korunan görseller:** 15
- **Korunan ilişkiler:** 5.519
- **SEO manifesti:** 6.027 sayfa
- **Sitemap:** 6.029 URL
- **Mevcut resmî publication ID:** `pub-38fb798f65705c03770e8cbe`
- **Publication content fingerprint:** `38fb798f65705c03770e8cbe8e5c3f2430e2908c5e949b87e7fcaa80afd48932`
- **Yerel tamamlanmış çeviri adayları:** 2.277; 0 flag, 0 invalid, 0 stale
- **Otomatik doğrulama testleri:** 19/19 PASS
- **SQLite:** `PRAGMA quick_check=ok`

Bu sayıların dayanağı: `apps/studio/translation-durable.cjs audit --batch universe`, `evren-ledger.cjs`, Studio SQLite kaynak/revizyon karşılaştırması, canlı publication yeniden okuması ve uzak SEO/sitemap doğrulaması.

Eski manifestte kalan `universe-character-3e78846d1ca1c3` kimliği, Hakan/Hakan Demir birleştirmesinde kaldırılan kayıttır. **Aktif/onaylı TR kaydı değildir; çeviri açığı sayılmaz.**

## Son tamamlanan yayınlar

| Yayın | Yeni Evren EN | Toplam geçerli Evren EN |
| --- | ---: | ---: |
| `pub-1ccc2f5f3c4c0584ada7e4e2` | Önceki oturumların tamamlananları | 1.879 |
| `pub-19e31b713fc8d93bc551f179` | +187 | 2.066 |
| `pub-38fb798f65705c03770e8cbe` | +618 | **2.684** |

Yalnız kaynakla eşleşen İngilizce alanlar eklendi. Türkçe metinler, mevcut geçerli İngilizce kayıtlar, görseller, ilişkiler ve kitaplar korunarak yayın fingerprint'i yeniden üretildi. İngilizce içerikler otomatik kaynak ve yapı denetimine dayanarak toplu onaylıdır; **tek tek insan editoryal incelemesi yapılmış olarak gösterilmez** (`manual=0`).

## Çeviri yöntemi ve korunmuş iş durumu

Çalışma deposu `/home/raistlin/ChannelFoundry`; çalışma dizini `channels/birdesengor/.local-data/studio/translation-work-20261119`.

- OpenCode `opencode/deepseek-v4.1-flash-free` reasoning `max`; A/B/C geçmiş bağımsız kuyrukları, kotaya ulaşınca durduruldu.
- Codex `gpt-6.1-terra`, reasoning `high`; kısa kayıtlar kaynak kimliği ve hash ile gruplanarak, uzun kayıtlar ayrı alan parçalarıyla çevrildi.
- DeepSeek'ten kalan son 168 kayıt kaynak-hash kilitli `codex-universe-bulk-terra-5` kuyruğuna devredilerek tamamlandı. `deepseek-handoff-to-codex-20261120.json` devir kaydını saklar.
- Codex kuyrukları `codex-universe-bulk-terra-2`, `codex-universe-bulk-terra-3` ve `codex-universe-bulk-terra-5` tamamlandı; `codex-universe-terra` içindeki uzun dört parçalı kayıt da tamamlandı.
- Kodun haftalık Codex %95 güvenlik sınırı korundu. Son ölçülen kullanım haftalık %92, beş saatlik %21 civarındaydı.
- Kaydedilmiş model cevabının otomatik kontrolden takıldığı sayılar, saat gösterimleri, `telsiz`/radyo, `Yaşlı Duman`, `Karanlık Devrin Kitabı` ve diğer özel adlar kaynak metne dayanılarak düzeltildi. Ham model yanıtları ve düzeltme gerekçeleri saklanıyor.
- Yayınlanmış içeriği modele tekrar çevirme yapılmadı.

## Canlı yedekler ve doğrulama

Son yayın dosyaları:
`channels/birdesengor/.local-data/studio/translation-work-20261119/evren-release-20261120-r3/`.

Bu dizinde şu kanıtlar bulunur: `pre-release-studio.sqlite`, `pre-existing-live-publication.json`, `pre-existing-seo-manifest.json`, `pre-existing-seo-workspace.json`, `translation-candidates-2277-clean.tar.gz`, `backup-checksums.sha256`, `release-publication.json`, `release-seo.json`, `release-report.json`, `remote-verified.json`, `studio-applied.json`, eski geçersiz İngilizce varyantlarının ayrı yedekleri.

Güncel ve canlıyla eşitlenmiş yerel baseline dosyaları:

- `channels/birdesengor/.local-data/studio/public-export/publication-live-baseline.json`
- `channels/birdesengor/.local-data/studio/public-export/seo-live-baseline.json`

Yeni yayın paketinin fingerprint'i ve sunucudan indirilen JSON birebir eşleşti. Canlı sitemap 6.029 URL olarak doğrulandı. Studio SQLite'da 2.684 onaylı geçerli EN ve 2.684 onaylı geçerli TR vardır. Yayın aktarımında 618 yeni kaydın `manual=0` olduğu ayrıca doğrulandı.

## Oturum sonrası çalışma ilkesi

**Evren için yeniden çeviri veya yeni çeviri kuyruğu başlatma.** Ancak yeni onaylı Türkçe kaynak eklenirse veya mevcut Türkçe kaynak revizyonu/hash'i değişirse yalnız yeni eksikleri hedefleyen kaynak karşılaştırması yap.

Web alt deposunda çalışma sırasında başka bir süreçten gelen `src/book/BookPages.jsx` yerel değişikliği vardı; çeviri tamamlamasında bu dosyaya dokunulmadı. Git genel temizliği yapılırken bu ayrı, eşzamanlı çalışmaya ait değişiklik kullanıcı bilgisi dışında silinmemeli.
