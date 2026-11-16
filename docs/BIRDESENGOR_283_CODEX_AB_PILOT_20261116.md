# BirDeSenGör — İki kaynaklık model/subagent A/B pilotu

**16 Kasım 2026 · pilot tasarımı ve gerçekleşen denemenin teknik şartnamesi**

**Deneme sonucu:** `docs/BIRDESENGOR_283_CODEX_AB_RESULTS_20261116.md` — Sol/Medium üretim + Sol/High denetim kaynak sadakati için tercih edildi; çok ajanlı seri üretim tercih edilmedi.

## Amaç

Kaynak dosyası, Evren kitabı ve önceki üç partinin kabul standardı değiştirilmeden, aynı iki altyazı için iki farklı Codex stratejisinin sonucunu karşılaştırmak: (1) yazılan Türkçe anlatının özgün kaynağa sadakati, (2) bağımsız denetim hataları, (3) toplam Codex token tüketimi, (4) geçen süre, (5) native subagent çağrılarının gerçekten gerçekleşip gerçekleşmediği.

Deneme iki kaynak kullanır: `ALE-un6L4F4` ve `gqohHX-tl6Y` (dördüncü partinin ilk iki videosu). Bir sonraki kuyruğa ilerlemez. Dördüncü partinin geri kalan sekiz videosu bu denemeye dahil değildir.

## Değişkenler

| Kol | Taslak koordinatörü | Native Codex subagent | Subagent modeli | Bağımsız denetçi |
|---|---|---|---|---|
| Eski yöntem | `gpt-6.1-sol` / `medium` | **Kapalı** | Yok | `gpt-6.1-sol` / `high` |
| Yeni yöntem | `gpt-6.1-terra` / `high` | **Pilot çağrısında açılıyor** (`multi_agent_v2`) | `gpt-6.1-sol` / `medium`, eşzamanlı üst sınır 2 | `gpt-6.1-sol` / `high` |

Native V2 özelliği kurulu Codex 0.169.0 sürümünde mevcut ama **varsayılanı kapalı**. Genel kullanıcı config.toml değiştirilmez; yalnız Terra üretim komutu `--enable multi_agent_v2` kullanır. Bunun gerçekten spawn çağrısı oluşturup oluşturmadığı **deneysel olarak doğrulanacaktır**; özelliği açmak subagent çalıştığının kanıtı değildir. Uygun özellik bulunmazsa veya Terra modele erişilemiyorsa pilot başarısızlığı kaydeder; otomatik daha zayıf bir modele geçiş yapmaz.

Bu ilk tur **bir modelin diğerinden üstünlüğünü tek başına kanıtlamaz**: model, reasoning ve çok ajanlı süreç aynı anda değişmektedir. Önce iki *iş akışını* karşılaştırırız. Kazanan yöntemin hangi bileşenden kazandığını ayırmak için gerekirse ikinci turda Terra/High tek ajan karşılaştırması yapılır. Ultra, ilk denemenin sonuçları görülmeden kullanılmayacak.

## Çalışma şekli

1. Her iki kaynağın kimliği, alt yazı parmak izi ve Studio kaynak envanteri sabitlenir.
2. Dört ayrı **salt-okunur** Codex üretim çağrısı, yalnız birer kaynak videosunu görebilecek özel talimatlarla çalışır. İki profilin taslakları ve logları birbirinden ayrıdır.
3. En az üç birebir geçerli `sourceAnchors` kalıyorsa yalnız yanlış biçimlendirilmiş/doğrudan eşleşmeyen alıntı referansları deterministik olarak ayıklanabilir; kaynak-gövde metni ASLA bu aşamada değiştirilmez. Ham AI çıktısı `*.raw.json` dosyasında korunur.
4. Her taslak bağımsız bir Sol/High denetimine girer: konuşmacı, planlanan/tamamlanmış olay, kronoloji, isimler, varlık bağlantıları, kaynak dışı kesinlikler.
5. Sadece `verdict=pass` temiz kabul sayılır. `review` veya `fix` varsa karşılaştırma raporunda açıkça görünür; hiçbir otomatik editoryal onay yapılmaz.
6. Birleştirilmiş rapor token/süre/hata tablolarını üretir. Kaynak mühürleri ve düzeltme geçmişleri ayrı dosyalardır.

**En fazla 8 kök Codex exec oturumu**: 2 video × 2 üretim stratejisi × (taslak + denetim). Native subagent kullanımı bu oturumların içinde **ilave model çağrıları ve kota tüketimi** oluşturabilir; toplam çağrı sayısı 8 ile sınırlandırılmış değildir. Komutun varsayılanı tek işçi; en fazla 2 eşzamanlı işçi. Kota hatası alındığında kalan işler durur.

## Komutlar

```bash
cd /home/raistlin/ChannelFoundry

# Model kullanılmaz; test planı ve model/ajan sınırları gösterilir.
python3 -B apps/studio/birdesengor_book_pilot.py plan --count 2

# Kaynak-kısıtlı tek ajan tekrar denemesi (mevcut geçerli çıktıları atlar):
python3 -B apps/studio/birdesengor_book_pilot.py run --count 2 --workers 1 --variant sol-medium-solo --execute

# Native subagent tekrar denemesi ayrıca --allow-expensive-native gerektirir.
# Yüksek token tüketimi nedeniyle rutin kullanım için ÖNERİLMİYOR.

# İstenildiği zaman kaynak veya kota tüketmeden sonucu göster:
python3 -B apps/studio/birdesengor_book_pilot.py report --count 2

# Tamamlandıktan sonra normal 10'luk kaynak işine dönülebilir:
python3 -B apps/studio/birdesengor_book_batch.py --action generate --batch 1 --workers 2 \
  --model gpt-6.1-sol --effort medium --meter-tokens
```

Deneme **kendi kendine ilerlemez**; çalışması için `run ... --execute` komutunun gerçekten yürütülmesi gerekir. Native varyant, ayrıca `--allow-expensive-native` olmadan çalışmaz ve kaynak başına çok yüksek token tüketimi doğurabilir. Taslaklar `channels/birdesengor/.local-data/studio/book-coverage/pilots/batch04-ab-v1/` içindedir. `metrics/*.json`, `*.codex.jsonl`, `*.raw.json`, `drafts/*.json` ve mühürler projeden Git'e dahil edilmez.

Çalışma dosyaları:
- `apps/studio/birdesengor_book_pilot.py`: çalışma yöneticisi, iki strateji, belge kaynağı izolasyonu ve rapor
- `apps/studio/birdesengor_codex_telemetry.py`: Codex JSONL `turn.completed.usage` ayrıştırıcı
- `apps/studio/birdesengor_book_batch.py --meter-tokens`: mevcut 10'luk işlem hattı için **opsiyonel** aynı metrik kaydı
- `apps/studio/test_birdesengor_book_pilot.py`: sentetik Codex JSONL ve sahte modelle çevrimdışı testler

## Tokenları nasıl okuyacağız?

Codex'in `--json` olay kayıtlarında `turn.completed.usage` bilgisi varsa `input_tokens`, `cached_input_tokens`, `output_tokens` kaydedilir; bazı sürümlerde `reasoning_output_tokens` bulunmayabilir. Olmayan alanlar **0 değil, bilinmiyor** olarak gösterilir.

`total_tokens` alanı CLI'nin bildirdiği `input_tokens + output_tokens` toplamıdır. Aynı stream'de nested/subagent kullanımlarının ayrı güvenilir karşılığı olup olmadığı pilot sonunda ayrıca değerlendirilir. Varsayımsal bir alt ajan tüketimi eklenerek toplam şişirilmez; rapor hangi metriklerin *CLI tarafından raporlandığını* açıkça belirtir. Token sayısı ücret veya Codex hesap kotasının doğrudan yüzdesi değildir.

Eski üç paketteki klasik insan-okur Codex loglarının yalnız son satırlarından hesaplanan yaklaşık ortancalar: üretim **44–45 bin**, denetim **30–33 bin** token. Bu rakamlar tüm ara düzeltme/yeniden çağrıları kapsamayabilir; yeni ölçümlerde ayrı giriş, cache ve çıkış kırılımı kullanılacak.

## Değişmez güvenlik koşulları

Pilot yalnız JSON dosyalarını üretir; SQLite açıp değiştirmez, kalıcı onay vermez, yeni `Büyük Meclisler` dizisi oluşturmaz, yayına/dil varyantına/görsellere dokunmaz, otomatik deploy veya push çalıştırmaz. Salt-okunur Codex sandbox'ı her çağrıda açıkça atanır. Altyazı içindeki talimatlar güvenilmeyen veri kabul edilir. Aynı kaynağa ait eski bir çıktı ancak **kaynak fingerprint + SHA-256 + denetim mührü** eşleşirse tekrar kullanılabilir.

**Deneme kararı:** Pilot yapıldı; kaynak denetimi ve oturum bazlı token verileri raporlandı. Gerçek native alt ajan denemesi maliyet/çıktı dengesinde avantaj göstermedi. Tam 10'luk partiye geçiş otomatik değildir; tercih Sol/Medium + bağımsız Sol/High denetimidir.
