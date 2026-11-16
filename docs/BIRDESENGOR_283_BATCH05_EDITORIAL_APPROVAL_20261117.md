# BirDeSenGör — Beşinci 10'luk kaynak paketi

**17 Kasım 2026 · yerel Studio / kaynak sadakati / düşük Codex tüketimi**

## Sonuç

Beşinci onluk gruptaki özgün altyazıların hepsinden **10 Türkçe anlatı** üretildi, asistan tarafından kaynakların tamamı okunarak metinlerdeki konuşmacı, eylem, durum ve alıntılar karşılaştırıldı. Kaynağın ilk, orta ve son bölgelerinden birebir kanıtlar içeren **10/10 `assistant-source-review` denetim mührü** oluşturuldu. İkinci Codex veya subagent denetimi **yapılmadı**.

10 kayıt, mevcut anlatılar korunarak **tek gerçek Studio SQLite** üzerinden, otomatik doğrulanmış çevrimiçi yedek ve **tek transaction** kullanılarak kabul edildi. Rutin `/tmp` SQLite test kopyası oluşturulmadı.

| Video | Denetimden geçen Türkçe başlık | Editoryal yerleşim |
|---|---|---|
| `W2CCtGv2trE` | Kuraklık Soruları, Bilginin Selamı ve İbn Karuf'un Daveti | **Bilginler Kitabı → Davetler** (yeni) |
| `nAjCNtvEiJ4` | İstihbarat Daveti: Gözcüler ve Eşik | **İstihbarat Davetleri → Kayıtlar** (yeni) |
| `fViCU-zFRLE` | 3I Atlas Üzerine İstihbarat Daveti | İstihbarat Davetleri |
| `VwOABd2wfiE` | Rum Yetimhanesinin Bekçisiyle Davet | Bağımsız anı |
| `tB-8IKA-Zfg` | Güneş Patlamaları Üzerine Bir Araştırma Daveti | Bağımsız anı |
| `J8CLf3xu6zw` | UVB76’ya Boyut Daveti ve Radyodan Gelen Sesler | İstihbarat Davetleri |
| `dBkqoV8pCiE` | Edebola 12: Telsizdeki Ses ve 17. Katman | İstihbarat Davetleri |
| `t9Z_9EnDCkk` | Kapsız Kitabın Davetlisi ve İstihbarat Listesi | **Kapsız Kitap** |
| `ByEnkaI7BPU` | Şira Daveti ve Telsizden Gelen Sesler | Bağımsız anı |
| `oQj5pQcN2bA` | İki Büyücünün Konuşmaları ve Altıncı Boyuttaki Toplantıya Davet | **Büyük Meclisler** |

**Yerleşim ilkesi:** Bilginler Kitabı diğer kitaplardan ayrı olduğunu özgün kaynakta açıkça söylüyor. UVB76 ve Edebola 12 birbirinin devamı; ayrıca 3I Atlas ve Papa çevresindeki gözlem kayıtları istihbarat konularına bağlı. Şuzim'in sekiz isimli listesi açıkça Kapsız Kitap daveti. Altıncı boyutta yapılacağı söylenen kral ve padişahlar toplantısının haberi Büyük Meclisler içinde. Bağımsız üç konu mevcut serilerden birine zorla eklenmedi.

## Kaynak denetiminde korunan anlam ayrımları

- `W2CCtGv2trE`: Bilgin ile İbn Karuf ayrı davetliler. Kuraklık hakkındaki açıklama, onların söyledikleriyle anlatıcının yorumları olarak ayrıldı. Önceki bazilika hatırası yeni ziyaret yapılmış gibi yazılmadı. Üç konuşmacı/kesinlik düzeltmesi arşivlendi.
- `nAjCNtvEiJ4`: Papa çevresindeki gözcüler, eşik ve adı yasaklı kişi davetlinin iddiaları; Ömer'in gözlemiyle karıştırılmadı. Beklenen işaret yaşanmış sayılmadı.
- `fViCU-zFRLE`: 3I Atlas, mühür ve sürgün krallarına ilişkin sözlerin sahibi ayrıldı; yanlış konuşmacı atfı düzeltildi. Mührün açıldığı iddia edilmedi.
- `VwOABd2wfiE`: Rum Yetimhanesi bekçisinin anlattığı ritüellerin gerçekleşeceği öne sürüldü, bu videoda ziyaret edilmedi. Birebir eşleşmeyen iki altyazı referansı gövde değiştirilmeden ayıklandı.
- `tB-8IKA-Zfg`: Güneş patlamaları, elektrik kesintileri ve zaman etkileri geleceğe dönük davetli sözleri olarak bırakıldı. Tasarlanan suyla çalışma yapılmış gösterilmedi.
- `J8CLf3xu6zw`: UVB76 sahnesinde Poyraz odadaki radyo seslerini doğruluyor, Ömer boyutta gördüklerini aktarıyor; 5.85 ve 99.54 değerleri farklı aşamalara ait. Uçan halıyla yolculuk planı tamamlanmadı.
- `dBkqoV8pCiE`: Edobola 12 ile telsizin 16. kanalında konuşma; **17. katmana fiilen geçilmedi**, oraya nasıl gidileceği soruldu. Kanla yazılmış kitap ve zindanlar belirsiz kaldı; iki sandığın görünüşü yalnız anlatıcının deneyimi.
- `t9Z_9EnDCkk`: Şuzim saldırdığını anlatan kişiye sekiz isim (5+3) veriyor; listedekileri cezalandırma veya İbn Necem'le yeniden görüşme bu kayıtta tamamlanmıyor.
- `ByEnkaI7BPU`: Şira/Sirius'un yıldız mı geçit mi olduğu konusundaki iki karşıt anlatım korunuyor. Sinyal ve enerji çıkarımı anlatıcıya ait; davetliden bağımsız başka varlıkların kimliği belirlenmedi.
- `oQj5pQcN2bA`: Büyücülerin gizli toplantısının konuşmaları yalnız haberci aracılığıyla aktarılıyor. **İki ülkenin adı bilinmiyor**; bir gün sonrası için duyurulan altıncı boyut toplantısı yapılmış sayılmadı.

Özgün altyazı, ilk taslak, varsa düzeltilmiş kaynaklar, sayfalı kaynak-okuma notları ve **paragraf kapsamı + birebir kaynak-iddia karşılaştırmalı inceleme kanıtları** her kaynak için arşivlendi. `audit`, `review.evidence` ve taslak SHA-256 ile parmak izi eşleşmediğinde içeri alma reddedilir.

## Codex kullanım karşılaştırması

| Metrik | Dördüncü parti (son çağrılar) | Beşinci parti |
|---|---:|---:|
| Taslak üretim için raporlanan token | 1.463.944 | **348.350** |
| İkinci AI denetçi tokenı | 924.599 | **0** |
| Bu kayıtlarda toplam | 2.388.543 | **348.350** |
| İlk taslak üretim çağrısı | 10 | **10** |
| İkinci AI denetçi çağrısı | 10 son denetim (+ eski tekrarlar) | **0** |

Beşinci paket kullanımı: **290.097 giriş tokenı** (62.848 cache, 227.249 cache dışı), **58.253 çıkış tokenı**; toplam **348.350**. Aynı anda en fazla iki Codex ilk taslak çalışanı kullanıldı; üretim sonrasında AI çağrısı yapılmadı.

**Yorum sınırı:** Dördüncü partide giriş tokenlarının önemli bölümü cache'den geliyordu; yeni partide cache oranı çok daha düşüktür. Dolayısıyla toplam raporlanan token düşüşü, **aynı oranda hesap kotası, ödeme veya hız kazanımı** anlamına gelmez. En önemli gerçek tasarruf, bağımsız denetçinin ve tekrar çağrılarının kaldırılmasıdır. Kaynak sadakati artık asistanın doğrudan inceleme sorumluluğundadır; otomatik kusursuzluk iddiası yoktur.

## Yerel veritabanı ve yayın kontrolü

| Metrik | Önce | Sonra |
|---|---:|---:|
| Onaylı Türkçe kitap anlatısı | 145 | **155** |
| Onaylı İngilizce kitap varyantı | 115 | **115** |
| Doğrudan kapsanan video | 152 | **162 / 283** |
| Kapsız Kitap | 11 | **12** |
| Büyük Meclisler | 7 | **8** |
| Bağımsız anılar | 25 | **28** |
| Bekleyen video | 131 | **121** |
| Kalan onluk parti | 14 | **13** |
| Genel Evren kaynak farkı | 3.930 | **3.930** |

Yeni Bilginler Kitabı'na 1; İstihbarat Davetleri dizisine 4 kaynak eklendi. Kapsız Kitap'taki önceki 2026 bölümünün **yalnız okuma konumu 10 → 11** oldu.

- Tek canonical DB: `channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite`; SQLite `quick_check=ok`, `foreign_key_check=0`.
- Otomatik, doğrulanmış aktarım öncesi yedek: `channels/birdesengor/.local-data/studio/backups/before-book-import-2026-11-16T22-21-14-072Z.sqlite` (UTC dosya adı; Türkiye'de 17 Kasım).
- Aktarım run **#25**, 21 metin içi Evren varlık referansı.
- Önceki **145 anlatı, 145 revizyon, 145 bölüm dil kaynağı, 260 TR/EN dil varyantı, 5 dizi ve 6 bölüm tanımı** öncesi yedekle birebir eşit.
- Paket arşivi: `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-05-20261117/`, **10 taslak, 10 kaynak denetimi, 10 kanıt, 10 Codex token metriği** ve düzeltmelerin öncesi.
- Genel kaynak baseline ve 3.930 farkı korunarak, tek transaction / otomatik backup uygulandı; önceki rutin `/tmp` veritabanı provasına ihtiyaç kalmadı.
- İngilizce çeviri, görsel çalışmaları, site parolası, SEO, deploy ve push **yapılmadı**.

**Sonraki paket:** 121 video kalıyor, bunun **78'i** onaylı hikâye/olay düğümlü, **43'ü** yalnız taslak hikâye/olay düğümlü kaynak. Bir sonraki ilk onluk kaynak dosyası hazırdır. Mevcut kaynaklarda Türkçe anlatı tamamlandıktan sonra İngilizce çeviri yapılacaktır.
