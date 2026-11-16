# BirDeSenGör — 283 Kaynaklı Evren Kitabı / Üçüncü 10'luk Paket

**16 Kasım 2026 · yerel Studio içerik kabulü**

## Editoryal kapsam

Bütün kayıtlar özgün YouTube altyazısı birincil kaynak alınarak ayrı Türkçe anlatıya dönüştürüldü. AI çözümlemesi, Evren düğümleri ve diğer kitap bölümleri yalnız ikincil bağlam olarak kullanıldı; kaynakta anlatılmayan olay, isim veya kronoloji eklenmedi.

| Video kimliği | Onaylı Türkçe anlatı | Kitap yerleşimi |
|---|---|---|
| `sqi0OlDOd4s` | Yedikule’nin İsimsiz Davetlisi | Bağımsız anı |
| `Fmk05zsUkJQ` | Konuşmayan Davetli | Kapsız Kitap |
| `CYkaAE2TwBk` | Yedi Bölgenin Uyarısı | Kapsız Kitap |
| `tdJt61fNkZM` | Kitabın Kralı ve Atlas Haberi | Kapsız Kitap |
| `ss2LLRKQoiM` | Dördüncü Davetlinin Kütle ve Sınır Haberi | Kapsız Kitap |
| `3t0Zak1Gm-I` | Nil’in Batısındaki Emanetler | Kapsız Kitap |
| `YB43rfq13Ck` | Çaylık Düzü’nde Kesilen Davet | Kapsız Kitap |
| `1igYkCt20AE` | Örtülü Kafes ve Ori’nin Sözü | Kapsız Kitap |
| `ZUugXoc0bFM` | Tasın Suyu ve Halkalı Kapılar | Bağımsız anı |
| `eKVzxnJOgng` | Konuşmayan Konuk | Kapsız Kitap |

Kapaksız/Kapsız Kitap içerikleri mevcut `topic-chapter-kapsiz-kitap` altında birleşti. Kitapta önceden bulunan ve Eylül 2026'da yayımlanan **“Yedinci Boyutun Kapısı”**, Ekim–Kasım 2025'te yayımlanmış ilk davet kayıtlarından sonra dokuzuncu sıraya yerleştirildi. Bu konumlandırma kaynakların anlatı bağlantısına ve kayıt dizisine dayanır; yayın tarihi olay tarihi sayılmaz. Eski bölümün gövdesi, başlığı, varlık bağlantıları ve dil varyantları değiştirilmedi.

## Denetim ve düzeltmeler

- **10/10 taslak ve 10/10 bağımsız özgün altyazı denetimi PASS.** Her video kimliği, özgün altyazı parmak izi, taslak ve denetim SHA-256 mühürleriyle eşleştirildi.
- `Fmk05zsUkJQ`: bozuk sesletimden “el/ayak” kesin ayrımı çıkarılması geri alındı; alıntı eşleşmesi temizlendi.
- `CYkaAE2TwBk`: frekansı düşürme planı tamamlanmış eylem gibi aktarılmaktan çıkarıldı.
- `ss2LLRKQoiM`: sadece “yolculuk” olarak söylenen ifade, dayanağı olmayan “boyut yolculuğu” kesinliğinden arındırıldı.
- `eKVzxnJOgng`: araştırmanın küçük bir parçasını “%1 olasılık”a çeviren yorum, kesin olmayan davet sıra numarası ve son bir kişi/iyelik dil hatası düzeltildi.
- `tdJt61fNkZM`: özgün altyazıyla birebir eşleşmeyen bir alıntı çıkarıldı.
- Önceki denetim turları ve değiştirilmiş eski taslakların tamamı `audit-attempts` altında korundu; temiz sonuçların tamamı yeniden mühürlendi.

## Yerel Studio aktarımı

| Metrik | Önce | Sonra |
|---|---:|---:|
| Onaylı Türkçe kitap anlatısı | 125 | **135** |
| Güncel onaylı İngilizce anlatı | 115 | **115** |
| Doğrudan kitap kaynağı olan video | 132 | **142** |
| Kapsız Kitap bölümü | 1 | **9** |
| Düğümlü numaralı davet | 65 | **65** |
| Bu partide eklenen bağımsız anı | — | **2** |
| Eklenen metin içi varlık bağlantısı | — | **37** |
| Bekleyen video kaynağı | 151 | **141** |
| Bekleyen çalışma partisi | 16 | **15** |
| Genel Evren kaynak farkı | 3.930 | **3.930** |

- İşlem önce `/tmp/birdesengor-batch03-preflight-20261116.sqlite` geçici veritabanında sınandı. Sonra doğrulanmış yerel yedek alınarak tek SQLite işleminde uygulandı (kapsam-sınırlı run #23).
- İşlem öncesi veritabanı yedeği: `channels/birdesengor/.local-data/studio/backups/before-book-batch03-20261116.sqlite`.
- Önceki **125 anlatı, 125 revizyon, 125 dil kaynağı ve 240 TR/EN varyant satırı** yedekle birebir aynı kaldı.
- Önceden var olan yerleşim kayıtları içinde **yalnız** Kapsız Kitap'taki “Yedinci Boyutun Kapısı” bölümünün sıra konumu `0 → 8` olarak değişti.
- SQLite `quick_check=ok`, `foreign_key_check=0`; `verify-narrative-store`, `verify-publication-v2` ve `verify-dugumlu-preproduction` geçti.
- Paket arşivi: `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-03-20261116/`. Burada kaynak paketi, kararlar, 10 taslak, 10 denetim, mühürler ve düzeltme geçmişi korunuyor.
- Yedekten arşiv kaynaklarını kullanarak yerel SQLite aktarımını tekrar oynatma testi **125 → 135**, Kapsız Kitap 9/9 sıra doğrulamasıyla PASS.
- Studio derlemesi PASS; web 289/289 birim testleri PASS; web üretim derlemesi PASS. Bu partide web UI güncellenmedi; tam E2E tarayıcı testi tekrar koşulmadı.

## Çeviri, yayın ve sonraki kaynaklar

Yeni 10 anlatının İngilizce çevirisi bu aşamada yapılmadı. **115 eski güncel EN onayı korundu**; yeni 20 Türkçe anlatı için EN metinleri açılış öncesi, bütün 283 video kapsandığında topluca üretilecek. Eski EN metinleri gereksiz yere yeniden çevrilmeyecek.

Son durum: **283 işlenmiş / 142 anlatıya doğrudan bağlı / 141 bekleyen video / 15 çalışma partisi**. Bekleyenlerin 98'inde onaylı hikâye/olay düğümü; 43'ünde yalnız taslak hikâye/olay düğümü bulunuyor.

Şifre kaldırma, SEO, arama motoru kaydı, görsel üretimi, canlı site dosyaları ve deploy değiştirilmedi. Web alt-reposunda bulunan kaftan/kılıç/efekt değişiklikleri korundu; push yapılmadı.
