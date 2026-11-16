# BirDeSenGör — Yalın kaynak işleme akışı (17 Kasım 2026)

## Tasarrufun kaynağı

Dördüncü 10'luk pakette 20 son üretim/denetim çağrısının kaydedilen toplamı **2.388.543 token** idi: ilk üretimlerin toplamı **1.463.944**, son denetimlerin toplamı **924.599** token. Denetim başlığı bu toplamın **%38,7'sini** oluşturuyor. Düzeltme sonrası eski denetim çağrılarının tamamı bu 20 dosyaya dahil değil.

Bu nedenle yeni varsayılan düzen:

1. **Asistan:** kaynak envanteri, içerik yerleşimi, kimlik ve karar sınırları, mevcut kitap bölümleriyle ilişkileri.
2. **Codex / yalnız gerektiğinde bir defalık ilk taslak:** `gpt-6.1-sol`, reasoning `medium`; tek videonun özgün altyazısı doğrudan prompt içinde. **On videoluk JSON paketini okumuyor.** Native ajan ve geçmiş oturumu kapalı. Token metrikleri otomatik.
3. **Asistan:** tamamı görülen özgün altyazı ile her paragrafın konuşmacı, plan/eylem, gözlem/iddia, bağlam, kronoloji ve ad belirsizliklerinin kontrolü; gerekirse metni kendisi düzeltir. **İkinci Codex denetçisi yok.**
4. **Kanıtlı manuel kaynak denetimi:** her paragrafın kontrolü, en az beş birebir altyazı→taslak karşılaştırması (kaynağın başı, ortası, sonu), açıklama ve SHA-256. Bulgu varsa `review`/`fix`; temizse `pass`.
5. **Asistan + mevcut kod:** kitapta yerleşim kararı, eski metinlerin korunması, tek gerçek Studio SQLite'ına yedekli ve işlemsel kabul, arşiv ve yeni kuyruk.

Asistanın kendi kaynak incelemesi de kusursuzluk garantisi değildir; şüpheli/belirsiz kayıtlar zorlanarak onaylanmaz. Sonraki bir düzeltme gerektiğinde eski onaylı gövde gizlice değiştirilmez.

## Komut akışı

```bash
cd /home/raistlin/ChannelFoundry
python3 -B apps/studio/birdesengor_book_coverage.py --check-snapshot
python3 -B apps/studio/birdesengor_book_batch.py --action status --batch 1

# Codex bu aşamada yalnız bir ilk taslak üretir; token metriği otomatik.
# Aynı komut --limit 10 --workers 2 ile toplu üretim için kullanılabilir.
python3 -B apps/studio/birdesengor_book_batch.py \
  --action generate --batch 1 --limit 1 --workers 1 \
  --model gpt-6.1-sol --effort medium

# Asistan altyazı ve taslağı inceler. Bu çağrı yalnız boş inceleme
# şablonu ve numaralı okuma dosyası hazırlar; AI çağrısı yapmaz.
python3 -B apps/studio/birdesengor_book_manual_audit.py \
  prepare --video-id VIDEO_ID

# Hazırlanan *.review.evidence.json kanıt dosyası kaynak okunarak
# doldurulur. Her paragraf ve kaynak baş/orta/son kanıtı gerekir.
python3 -B apps/studio/birdesengor_book_manual_audit.py \
  commit --video-id VIDEO_ID

# On kaynak gerektiği gibi gözden geçirilince asistan dosyasını yazdıktan
# sonra sadece plan/kanıt uygunluğunu doğrulayan dry-run (CANLI DB'ye yazmaz).
node apps/studio/import-audited-video-batch.cjs \
  --plan channels/birdesengor/.local-data/studio/book-coverage/PLAN.json \
  --packet channels/birdesengor/.local-data/studio/book-coverage/source-packets/PAKET.json

# Aynı doğrulanmış planla tek gerçek DB + otomatik, doğrulanmış SQLite yedeği
# + tek transaction (ek /tmp veritabanı kopyası YOK).
node apps/studio/import-audited-video-batch.cjs \
  --apply --live --backup-auto \
  --plan channels/birdesengor/.local-data/studio/book-coverage/PLAN.json \
  --packet channels/birdesengor/.local-data/studio/book-coverage/source-packets/PAKET.json
```

Ön kontrol gerçek SQLite üzerinde **salt-okunur bağlantıyla** çalışır. Otomatik yedek, yalnızca tam `--apply --live --backup-auto` komutunda ve aktarımın hazırlık/sürüm kontrollerinden **önce** oluşturulur; böylece hazırlık kodunun olası şema değişikliği bile yedekten önce yapılamaz.

İçerik onayı hâlâ `--apply --live` ile açıkça istenir; hiçbir taslak otomatik kabul edilmez. Yedek otomatik üretildiğinde mevcut dosya üzerine yazmaz. SQLite `quick_check`, yabancı anahtar denetimi, eski metin/dil varyantı eşitliği, kaynak run baseline ve sürüm kontrolü işlemden sonra transaction **COMMIT** edilmeden doğrulanır. Hata varsa SQLite **ROLLBACK** yapar.

## Veritabanı kopyalarının ayrımı

**Tek etkin çalışma kaynağı:** `channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite`.

Önceki partilerin `/tmp/birdesengor-*.sqlite` deneme kopyaları gerçek içerik kaynağı değildi; çalışma/test kopyalarıydı ve temizlendi. Bu durum **3.930 bekleyen kaynak farkıyla ilgili değil**; fark genel Evren kaynak baseline denetiminin aynı aktif SQLite'tan hesapladığı bir fark kümesidir.

`channels/birdesengor/.local-data/studio/backups/` klasöründeki yedekler korunur. `nexa-analysis/` altında bulunan eski tarihlenmiş SQLite dosyaları tarihsel çalışma/checkpoint kayıtlarıdır, canlı uygulamanın kullandığı ikinci veritabanı değildir; kendiliğinden silinmez.

Rutin içerik aktarımı artık geçici veritabanında prova gerektirmez. Buna karşın **şema göçleri, veri silme veya çok tablolu yıkıcı dönüşümler** gibi riskli işlemlerde ayrıca bir prova kopyası kullanmak yeniden gerekebilir. Buradaki tek-kopya politikası, güvenilir yedeği ve işlem geri dönüşünü koruyarak sıradan onluk içerik alımlarını hızlandırır.

## Kaynak kanıt kayıtları

`*.review.evidence.json` yalnız asistanın gerçekten kaynakla karşılaştırdığı bölümler için doldurulur. `prepare` şablonu bilerek `verdict=review`, boş paragraf kontrolü ve kanıtsız oluşturur; hiçbir otomatik geçiş `pass` sağlamaz.

`commit`, tüm paragraflar doğrulanmadan, ilk/orta/son kaynak örnekleri bulunmadan, eski taslak SHA ile eşleşmeden veya kaynak video parmak izi yanlış olduğunda reddeder. Onaylanan audit ve mühür, kanıt SHA değerini de içerir; geçmiş AI denetimli onaylı paketlerin kayıtları değiştirilmez.

Rutin Codex denetimi devre dışıdır. Yalnız istisnai bir gerekçeyle ayrıca `--allow-codex-audit` açıkça yazılırsa eski Codex denetçisi kullanılabilir. Rutin işlem bu seçeneği kullanmaz.

## Başlangıç durum ve ölçüm

Yeni düzen başlamadan kitapta **145 Türkçe anlatı, 115 İngilizce varyant ve 152/283 doğrudan kapsanan video** vardır. Kaynak kuyruğunda 131 video kalmıştır; yeni düzenin kalite ve kota etkisini ilk bir-iki videonun ölçümünden sonra somut olarak değerlendirmek gerekir. Henüz eski/yeninin kesin tasarruf oranı iddia edilmez.

17 Kasım'daki geçişte mevcut veritabanından **doğrulanmış 109.903.872 baytlık yedek** alındı: `backups/before-lean-workflow-20261117.sqlite`. Eski onaylar ve canlı yayın/görseller değişmedi.

## İlk canlı test: Beşinci partinin birinci kaynağı

- Kaynak: `W2CCtGv2trE`, **Kuraklık Soruları, Bilginin Selamı ve İbn Karuf'un Daveti**; orijinal altyazı **31.337 karakter**.
- Sadece bir `gpt-6.1-sol / medium` tek-ajan çağrısı: **35.578 raporlanan token**, giriş **29.845**, önbellekli giriş **0**, çıkış **5.733**, süre **132,13 saniye**.
- 35 paragraflık, 15.596 karakterlik kaynak-sınırlı Türkçe anlatı. Asistan özgün altyazıyı baştan sona, tüm paragraflarla karşılaştırdı. Üç kaynak-özne/zamir/kesinlik düzeltmesi yapıldı; düzeltme öncesi taslak saklandı.
- İkinci Codex çağrısı **yok**. 35/35 paragraf için inceleme kaydı, kaynağın ilk/orta/son bölümlerinden **11 açık kanıt**, `assistant-source-review` ve kaynak/taslak/kanıt audit SHA-256 mühürleriyle **`audited_pass`**.
- Tek veritabanlı aktarım aracında **`--apply` olmadan** manuel kaynak mühürlü taslak için salt-okunur `IMPORT_READY` denemesi PASS. İzole testteki bağımsız bölüm yerleşimi yalnız örnekti; gerçek bölüm kararı verilmedi, gerçek SQLite'ya aktarım yapılmadı.
- Güncel kuyruk: 10 kaynak içinde **1 onaylı taslak, 9 henüz başlamadı**. Eski onaylı kitabın durumu aynen **145 TR / 115 EN / 152/283 video**.

### Token farkını doğru yorumlamak

Önceki dördüncü paketin son üretim çağrılarında ortalama yaklaşık **146.394 raporlanan token/video** vardı; bunun ortalama **107.290'u önbellekli giriş**, **35.534'ü önbelleksiz giriş** ve **3.571'i çıkış** idi.

Yeni ilk kaynakta **35.578 toplam** bulundu; önbellekli giriş **0** ve önbelleksiz giriş **29.845**. Raporlanan *toplam* token düşüşü güçlü görünse de **önbellek etkisi nedeniyle bu düşüşü doğrudan aynı oranda Codex kota azalması** saymıyoruz.

Asıl güvenilir tasarruf kaynağı, önceki yöntemde kaynak başına ayrıca yapılan bağımsız Sol/High denetim çağrılarının kaldırılmasıdır. Daha kesin karşılaştırma için sonraki videoların kullanım miktarı da izlenecek.
