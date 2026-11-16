# BirDeSenGör — 283 kaynaklı Evren Kitabı / Dördüncü 10'luk paket

**17 Kasım 2026 · yerel Studio içerik onayı**

## Sonuç

Dördüncü paketin **10/10 Türkçe anlatısı** birincil `originalTranscript` kaynağıyla ayrı ayrı üretildi; bağımsız `gpt-6.1-sol/high` denetiminden **`audited_pass`** alarak yerel kitaba aktarıldı. Kaynağa yazım sırasında `gpt-6.1-sol/medium` kullanıldı. Önceki iki kaynaklık Terra pilotundaki alternatif taslaklar bu kabul paketine alınmadı.

| Video | Denetimden geçmiş kitap anlatısı | Yerleşim |
|---|---|---|
| `ALE-un6L4F4` | Reisin Görevi ve Kapsüllerin Tuzağı | Kapsız Kitap |
| `gqohHX-tl6Y` | Zifir Kuyusunun Bekçisi | Büyük Meclisler |
| `BFltnnuKtzA` | Saraydaki Meclisin Tanığı | Büyük Meclisler |
| `CHwBS65s7SU` | Sözcünün Getirdiği Hediye Haberi | Büyük Meclisler |
| `z657i58LUVI` | Üç Vadi Arasındaki Meclis | Büyük Meclisler |
| `J_8tVRM68ys` | İsimsiz Habercinin Masası | Büyük Meclisler |
| `kxGJFmjwzbo` | Kayıp Dillerin Bekçisine Sorularım | Büyük Meclisler |
| `3l3QpxBV0bw` | Sarmaşıkların Dibindeki Kutu | Büyük Meclisler |
| `_63wsJEGx4I` | Kapsız Kitabın Kaçan Davetlisi | Kapsız Kitap |
| `fkyufQK4oiU` | Bazilikanın Altındaki Sandık | Bağımsız anı |

Yedi kaynak için **Büyük Meclisler → Kayıtlar** başlığı oluşturuldu. Kapsız Kitap'a iki yeni 2025 kaynaklı anlatı, 2026 tarihli mevcut **Yedinci Boyutun Kapısı** bölümünden önce yerleştirildi. Önceden onaylanmış içeriğin yalnız okuma sırası değişti (8 → 10); yayın tarihleri olay tarihi sayılmadı. İznik Bazilikası anlatısı başka kitap dizisine zorla bağlanmadı.

## Kaynak denetimindeki önemli düzeltmeler

- `ALE-un6L4F4`: daveti kapatma sözünün, sonradan söylenen tehdidin ve saldırı sorusunun **konuşma sırası** kaynakla eşleştirildi. Altyazıdaki belirsiz bir sözcük kesin yorumlanmadı; son bir hâl eki düzeltildi.
- `CHwBS65s7SU`: “okulu mum” dökümü kesin “okunmuş mum” sayılmadı; önceki davetliyle ilgili **sözcü/Ömer kişi zamiri** ve geçişin görünürlüğü düzeltildi.
- `3l3QpxBV0bw`: konuk tarafından söylenen “beni toplantıda görmüşsün” sözünün anlatımdaki **görülen kişi** tersine çevrilmedi; kutuyu kaftanda saklama **niyeti**, gerçekleşmiş eylem olarak sunulmadı.
- `fkyufQK4oiU`: Poyraz'ın doğrulamadığı göz kırpma bilgisi Poyraz'a atfedilmedi; bilginin seslenişindeki kişi zamiri düzeltildi.
- Diğer altı anlatı bağımsız denetimi doğrudan geçti. Önceki başarısız ve düzeltmeli denetim sürümleri arşivde tutuldu.

**Sert güvence:** On taslağın her biri, kaynak video kimliği, özgün kaynak fingerprint'i, taslak SHA-256 ve bağımsız audit SHA-256 eşleşmeden kabul edilmedi. Metinler değiştirilirse mühür geçersizleşir.

## Yerel içerik durumu

| Metrik | Önce | Sonra |
|---|---:|---:|
| Onaylı Türkçe kitap bölümü | 135 | **145** |
| Onaylı güncel İngilizce bölüm | 115 | **115** |
| Doğrudan kitap kaynaklı video | 142 | **152** |
| Kapsız Kitap bölümü | 9 | **11** |
| Yeni Büyük Meclisler bölümü | 0 | **7** |
| Yeni bağımsız anı | 0 | **1** |
| Düğümlü Kitap / numaralı davet | 65 | **65** |
| Bu partide oluşturulan metin içi varlık bağlantısı | — | **36** |
| Genel Evren kaynağı için bekleyen fark | 3.930 | **3.930** |
| Kapsanmayı bekleyen video | 141 | **131** |
| Kalan çalışma partisi | 15 | **14** |

Bekleyen 131 video arasında **88** onaylı hikâye/olay düğümlü kaynak, **43** yalnız taslak hikâye/olay düğümlü kaynak bulunuyor.

## Yedekleme, test ve arşiv

- Önce geçici kopyada, ardından doğrulanmış **107 MB SQLite yedeği** alınarak gerçek yerel Studio'da tek transaction ile aktarıldı. Yerel kaynak kapsamlı run **#24**, model etiketi `video-editorial:gpt-6.1-sol`.
- Yedek: `channels/birdesengor/.local-data/studio/backups/before-book-batch04-20261117.sqlite`.
- Kaynak/draft/audit/mühür/ölçüm arşivi: `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-04-20261117/`.
- Arşivde 10 taslak, 10 denetim, 20 Codex token metrik dosyası ve **21 önceki düzeltme/denetim denemesi** kanıtı bulunuyor. Son deneme metriklerinin toplamı **2.388.543 raporlanan token**; yeniden denemelerin önceki tüm tokenları için bu toplam **eksik**, gerçek tüketim olarak sunulmuyor.
- Önceki **135 anlatı, 135 revizyon, 135 dil kaynağı ve 250 TR/EN varyantı** öncesi yedekle birebir eşit. Eski 4 dizi ve 5 bölüm metadata'sı da korundu. Yalnız mevcut Kapsız Kitap bölümünün sırası 8 → 10 olarak değişti.
- SQLite `quick_check=ok`, `foreign_key_check=0`; `verify-narrative-store`, `verify-publication-v2`, `verify-dugumlu-preproduction` PASS.
- Bütün kaynak arşivinden eski SQLite yedeğinin kopyasına paketi **yeniden oynatma testi** PASS: 145 kitap bölümü, 11 Kapsız Kitap, 7 Büyük Meclisler ve yerleşim sırası birebir tekrarlandı.
- `npm run build:studio` PASS; web birim testleri **289/289 PASS**; web Vite üretim derlemesi PASS (mevcut 500 kB üzeri bundle uyarısı sürüyor). Tam web tarayıcı E2E zinciri bu partide yeniden koşulmadı.
- Kullanıcıya ait bekleyen web sahne görselleri (kaftan, kılıç ve efekt JSON'u) değiştirilmedi.
- Yeni çalışma manifesti: **283 ingested / 152 covered / 131 pending / 14 batches**, `--check-snapshot` PASS; ilk sıradaki 10 kaynak `not_started`.

## Yayın ve çeviri sınırı

Yeni **30 Türkçe anlatı** için İngilizce onay henüz yok; mevcut 115 güncel EN bölüm korunmuştur. Karar gereği **283 video için Türkçe kitap tamamlandığında** eksik EN çeviriler üretilip yayın kontrollerinden geçirilecek.

Canlı web sitesi, parola, SEO ve arama motoru indeksleme ayarları değiştirilmedi. Görsel üretimi, gerçek deploy ve push yapılmadı.

## Sıradaki işlem

Beşinci 10'luk kaynak paketi için yeni snapshot hazır. Aynı düzende `gpt-6.1-sol/medium` tek-video Türkçe taslak, bağımsız `gpt-6.1-sol/high` denetimi ve geçici/yedekli kitap aktarımı uygulanacak. Native subagent'lı yüksek tüketimli pilot tekrar edilmeyecek.
