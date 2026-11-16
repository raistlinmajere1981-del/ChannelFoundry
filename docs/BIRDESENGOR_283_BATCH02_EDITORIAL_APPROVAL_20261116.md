# BirDeSenGör — 283 Kaynaklı Evren Kitabı / İkinci 10'luk Parti

**16 Kasım 2026 · Yerel Studio içerik kabulü**

## Editoryal karar

Özgün altyazıların kaynak-sınırlı anlatımı ve bağımsız kaynak denetimi tamamlandı. Bu on kayıt önceki 115 anlatının doğrudan kaynakları değildi; ayrı görüşme veya olay anlatımları oldukları için mevcut bölümleri sıfırlamadan yeni bölüm olarak eklendi.

| Video | Kaynaktan oluşturulan Türkçe başlık | Yerleşim |
|---|---|---|
| `zkIB4xgKLW8` | Kapıda Kalan İki Kabile | Düğümlü / Ara Kayıtlar |
| `XUdUJMxp72E` | Boynuzlu Reisin Kitap Talebi | Düğümlü / Ara Kayıtlar |
| `jrp0eIG-4Xk` | Kapalı Geçitten Dönüş İsteği | Düğümlü / Ara Kayıtlar |
| `sF6jGupoqh8` | Karanlık Devrin İsimsiz Konuğu | Bağımsız anı |
| `aRvd2DcU0as` | Zincirli Kralla Görüşme | Düğümlü / Ara Kayıtlar |
| `rRgycOAt13M` | Yardımcının Yarım Kalan Rehberliği | Düğümlü / Ara Kayıtlar |
| `3D4Ffx5lNFY` | Çöl Kulübesinden Mariana’ya | Düğümlü / Ara Kayıtlar |
| `FeBjP_mry04` | Hezmina’nın Dostluk Teklifi | Düğümlü / Ara Kayıtlar |
| `PHxpm74oSIE` | Bakır Taslar ve Yer Değiştiren Kitap | Bağımsız anı |
| `5A9AezH36g4` | Solomon’dan Gelen İsimsiz Konuk | Bağımsız anı |

**Yerleşim ilkesi:** Karanlık Devrin Kitabı, Meseyn ve Solomon görüşmeleri, yalnız bağlantı ihtimali nedeniyle Düğümlü Kitap veya Mezna dizisine zorla bağlanmadı. Yayın tarihinden olay kronolojisi çıkarılmadı. Mariana zincirindeki kayıtlar da tek görüşme gibi birleştirilmedi.

## Denetim sonuçları

- **10/10 Türkçe taslak** kaynak özgün altyazısıyla bağımsız `audited_pass` sonucu aldı.
- `jrp0eIG-4Xk`: “ona kötülük yapanlar” özne kayması, kaynakta “bize kötülük yapanlar” olduğu için düzeltildi; yeniden denetim geçti.
- `rRgycOAt13M`: Poyraz'ın görüş alanıyla ilgili özne/yer ilişkisi kaynak doğrultusunda düzeltildi; yeniden denetim geçti.
- `FeBjP_mry04`: birebir altyazıda bulunmayan tek bir `sourceAnchors` alıntısı çıkarıldı; kalan 11 alıntı geçerli. Gövde değiştirilmedi; bağımsız kontrol geçti.
- Belirsiz özel adlar, gerçekleşmeyen eylemler ve konuşmacıların birbirine karıştırılması konusundaki `reviewNotes` saklandı.
- Her taslak, kaynak paketi ve bağımsız denetim **SHA-256** mühürleriyle eşleştirildi.

## Yerel Studio aktarımı

| Kalem | Önce | Sonra |
|---|---:|---:|
| Aktif onaylı Türkçe kitap anlatısı | 115 | **125** |
| Onaylı güncel İngilizce kitap anlatısı | 115 | **115** |
| Kitaba doğrudan bağlı video | 122 | **132** |
| Düğümlü Kitap / numaralı davet | 65 | **65** |
| Düğümlü Kitap / Ara Kayıtlar | 18 | **25** |
| Yeni bağımsız anı | — | **3** |
| Yeni metin içi varlık referansı | — | **20** |
| Genel Evren kaynak farkı | 3.930 | **3.930** |
| Yeni kaynak kapsamı isteyen video | 161 | **151** |
| Kalan çalışma partisi | 17 | **16** |

- Kaynak kanıtları: `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-02-20261116/` — özgün paket, kararlar, 10 taslak, 10 denetim ve hash mühürleri burada korunur.
- Önceki paket: aynı `completed-batches/batch-01-20261116/` altında temiz biçimde arşivlendi.
- Aktarım öncesi doğrulanmış SQLite yedeği: `channels/birdesengor/.local-data/studio/backups/before-book-batch02-20261116.sqlite`.
- Aynı işlem önce `/tmp/birdesengor-batch02-preflight-20261116.sqlite` kopyasında onaylandı. Gerçek yerel Studio aktarımı tek SQLite transaction içinde `video-editorial:` kapsamlı run #22 ile uygulandı.
- **Önceki 115 anlatı, 115 revizyon, 115 kaynak ve 230 TR/EN varyant satırı** eski yedekle birebir eşit. SQLite `quick_check=ok`, `foreign_key_check=0`.
- Evrendeki 1.663 onaylı varlık ve 3.619 ilişki değişmedi; bütün kaynağı tüketen genel hikâyeleştirme baseline'ı ilerletilmedi.
- `verify-dugumlu-preproduction`, `verify-narrative-store`, `verify-publication-v2` kontrolleri geçti.
- Studio build PASS; web tarafında **289/289 birim testi PASS** ve Vite production build PASS. Tam E2E zinciri bu partide yeniden yürütülmedi.
- Tamamlanan paketi arşivden tekrar oynatma denemesi de `--draft-dir` ile geçici SQLite kopyasında **115→125** sonucunu verdi.

## Çeviri kararı

**İngilizceyi kalan Türkçe kitap tamamlandıktan sonraya bırakıyoruz.** İlk 115 bölümün önceden onaylı İngilizce metinleri korunur. Yeni on bölümde geçici olarak yalnız Türkçe metin onaylıdır; eksik EN bu tasarım aşamasında yayın engeli değildir, ancak **283/283 tamamlanmadan gerçek site yayını açılmayacaktır**. Nihai aşamada 125 ve sonrasında onaylanan bütün Türkçe metinlerin sürüm/hashleri temel alınarak EN üretilir; var olan güncel EN metinleri gereksiz yere yeniden oluşturulmaz.

## Sonraki aşama

Güncel kuyruk: **283 kaynak / 132 kapsanan / 151 bekleyen / 16 parti**. Bunların **108** tanesinde onaylı hikâye/olay düğümü, **43** tanesinde yalnız taslak hikâye/olay düğümü var. Aktif kuyruk ve paketler yeniden oluşturuldu; ilk 10 kayıt `not_started`.

Yeni paket için aynı kaynak-sınırlı akış:

```bash
cd /home/raistlin/ChannelFoundry
python3 -B apps/studio/birdesengor_book_batch.py --action status --batch 1
python3 -B apps/studio/birdesengor_book_batch.py --action generate --batch 1 --limit 10 --workers 2 --model gpt-6.1-sol --effort medium
python3 -B apps/studio/birdesengor_book_batch.py --action audit --batch 1 --limit 10 --workers 2 --model gpt-6.1-sol --effort medium
```

**Önemli sınırlar:** Bu çalışma canlı siteyi, şifreyi, SEO/indekslemeyi, görsel üretimini veya deploy'u değiştirmedi. Önceden bekleyen kaftan/kılıç/efekt değişiklikleri aynen korunuyor. Bu oturumda web sayfasında görünüm değiştirilmedi ve tam E2E testi tekrar koşulmadı.
