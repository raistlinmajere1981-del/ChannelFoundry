# BirDeSenGör — Dördüncü kaynak partisi / çalışma hazırlığı

**16 Kasım 2026 · yalnız kaynak envanteri ve güvenli aktarım altyapısı**

## İşe girerken korunan çizgi

- **283** işlenmiş video; **142** tanesi aktif onaylı kitabın doğrudan kaynağı.
- **135** onaylı Türkçe anlatı, **115** güncel İngilizce yayın metni.
- Kitaba işlenmeyi bekleyen **141** kaynak, **15** parti; 98'i onaylı olay/hikâye, 43'ü yalnız taslak olay/hikâye düğümüne sahip.
- Genel hikâyeleştirme baseline farkı **3.930**; hiçbir toplu kaynak onayı yapılmayacak.
- Üçüncü parti tamamlandı; onun metinleri, kaynakları, denetimleri ve yedekleri korunacak.

## Dördüncü partinin on kaynağı

Özgün altyazıların tamamı kaynak paketinde mevcut; 10 video da en az iki onaylı hikâye/olay düğümüyle ilişkilendirilmiş. Aşağıdaki konu yerleşimleri **editoryal öneridir**; metinler hazırlanıp denetlenmeden son karar olarak kullanılmaz.

| # | Video ID | Konu/analiz başlığı | İlk yerleşim önerisi |
|---:|---|---|---|
| 1 | `ALE-un6L4F4` | Kapsız Kitap’ın yeni konuğu; İznik kitabı, Nil kapsülleri | Kapsız Kitap |
| 2 | `gqohHX-tl6Y` | Zifir Kuyusu bekçisi; ilk meclisin çağrısı | Büyük Meclisler |
| 3 | `BFltnnuKtzA` | İbni Kâruf, Necemin ve yöneticilerle Babil toplantısı | Büyük Meclisler |
| 4 | `CHwBS65s7SU` | İkinci sözcü; emanet ve sonraki toplantı | Büyük Meclisler |
| 5 | `z657i58LUVI` | Mezna’daki ikinci büyük meclis | Büyük Meclisler |
| 6 | `J_8tVRM68ys` | Meclisleri sorgulayan haberci | Büyük Meclisler |
| 7 | `kxGJFmjwzbo` | Velzeber’in uyarısı ve casus haberi | Büyük Meclisler |
| 8 | `3l3QpxBV0bw` | Naşirun ve gizli altılı toplantı | Büyük Meclisler |
| 9 | `_63wsJEGx4I` | Kapsız Kitap’tan kaçan konuğun yeniden bağlanması | Kapsız Kitap |
| 10 | `fkyufQK4oiU` | İznik Bazilikası mahzeni ve Ernus kitabı | Bağımsız anı |

Bu listenin kaynağı `channels/birdesengor/.local-data/studio/book-coverage/batch-04-source-plan.json`; dosyada orijinal video ID'leri, yayın metadata tarihleri, onaylı kaynak düğüm sayıları ve mevcut kaynak paketinin SHA-256 bilgisi yer alıyor. **Yayın tarihi olay tarihi değildir.**

Yeni `Büyük Meclisler → Kayıtlar` dizisi yalnız editoryal **öneri** düzeyindedir. Birinci ve ikinci toplantı, haberciler ve müdahaleler aynı geniş anlatının parçaları görünse bile bağımsız video görüşmelerini tek kesintisiz sahne gibi birleştirmeyeceğiz.

## AI üretimi neden durdu?

- `codex exec` ile kaynak-sınırlı üretim denendi; servis **“You've hit your usage limit … try again at 11:39 PM”** hatasını verdi. On çağrının hiçbiri geçerli JSON taslağı üretmedi.
- Yerel `opencode/deepseek-v4.1-flash-free` modeli listeleniyor ama iki bağlantı testi (normal ve `--standalone`) çıktı üretmeden zaman aşımına uğradı. İnternet HTTPS kontrolü ise başarılı; sorunun model/servis katmanında olması mümkün.
- Sistemdeki `ollama/qwen2.5:7b` modeli bu kritik içerik için **sessizce yedek model** olarak kullanılmadı.
- Sonuç: **0 yeni anlatı üretildi, 0 kaynak denetimi tamamlandı, 0 bölüm onaylandı ve veritabanına aktarılmadı.**
- Kullanım sınırı hatasına karşı `birdesengor_book_batch.py` içine **fail-fast kota devre kesicisi** eklendi: benzer hatalarda sırada bekleyen tüm videolara istek gönderilmesini engelleyecek. Önceki Codex hata loguyla yazılım testi geçti.

## Yeni dizi açma için geçici veritabanı denemesi

`apps/studio/import-audited-video-batch.cjs`, denetlenmiş bir kaynak paketini aynı SQLite transaction'ında yeni bir diziye ve bölümüne yerleştirebiliyor. İşlem:
- yalnız açıkça belirtilmiş, mevcut olmayan seri/bölüm ID'leriyle çalışır;
- eski dizi ve bölüm metadata'sını **birebir karşılaştırarak** korur;
- başarısızlıkta tamamını geri alır;
- genel Evren kaynak baseline farkını tüketmez;
- mevcut onaylı anlatı gövdelerini veya TR/EN varyantlarını değiştirmez.

Yeni dizi özelliği, üçüncü partinin arşiv kaynaklarıyla `/tmp/birdesengor-new-series-preflight.sqlite` kopyasında test edildi: yeni dizi ve iki kayıt eklendi, mevcut 9 Kapsız Kitap bölümü ve 135 toplam bölüm korundu, SQLite bütünlük kontrolü geçti. **Gerçek Studio veritabanında yeni dizi henüz oluşturulmadı.**

## Kaynak üretimi yeniden erişilebilir olduğunda

```bash
cd /home/raistlin/ChannelFoundry
python3 -B apps/studio/birdesengor_book_coverage.py --check-snapshot
python3 -B apps/studio/birdesengor_book_batch.py --action status --batch 1

# Kaynak-sınırlı taslaklar, en fazla iki eşzamanlı Codex çağrısı:
python3 -B apps/studio/birdesengor_book_batch.py --action generate --batch 1 --limit 10 --workers 2 --model gpt-6.1-sol --effort medium

# Taslak tamamlandıktan sonra bağımsız kaynak denetimi:
python3 -B apps/studio/birdesengor_book_batch.py --action audit --batch 1 --limit 10 --workers 2 --model gpt-6.1-sol --effort medium
```

Her denetim sonucu `pass` olmadan ve tarih/özne/konuşmacı hataları gözden geçirilmeden kalıcı anlatı veya yeni seri **oluşturulmayacak**. Gerekirse mevcut 135 anlatı korunarak yeni seri yerine bağımsız anı kararı verilebilir.

**Kapsam dışı:** İngilizce çeviri, görsel üretimi, SEO, parola, arama motoru kaydı, canlı site dosyaları, deploy/push. Web alt-reposunda bekleyen kaftan/kılıç/efekt çalışmaları korunuyor.
