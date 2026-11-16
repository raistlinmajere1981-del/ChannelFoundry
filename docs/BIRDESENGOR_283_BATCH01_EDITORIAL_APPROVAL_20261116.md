# BirDeSenGör — 283 Kaynaklı Evren Kitabı / İlk 10 Ek Video Editoryal Kapanışı

**16 Kasım 2026 · ChannelFoundry / yerel Studio**
Bu adım Düğümlü Kitap ile ilişkili ancak önceki 105 kitabın doğrudan video kaynaklarında bulunmayan 10 ayrı kaydı kapsar.

## Kabul edilen kapsam

| Video | Onaylı yeni Türkçe anlatı |
|---|---|
| `Q8e_Zar_dIM` | Zifir Kuyusu ve Okyanusun Dibi |
| `VMcU2s8e-II` | Siyah Kitapların Peşindeki |
| `83zRrtHOLpY` | Kesilen Davet: Esina'nın Bağı |
| `FyvUpngfLd4` | Arohan’ın Uyarısı ve Saray Daveti |
| `OovsEH9pndA` | Sandukanın Altındaki Kitap |
| `ciYiOuOXNoQ` | Lahitteki Kapı |
| `ssIoRuvNVVI` | Açık Kapıdaki Haberci |
| `PMDOb0u04D4` | Yoris’in Anahtar Talebi |
| `ElOFz7iDwos` | Davetsiz Geçiş ve Elmas Küre |
| `lblvPtk5poE` | Saklı Kitabı İsteyen Konuk |

Karar: on video, kaynakta ayrı sahne ve görüşmeler oluşturdukları için **Düğümlü Kitap → Ara Kayıtlar** altında on ayrı yeni bölüm. 43/44/47/48. davetler öncesindeki müdahaleler doğrudan numaralı davetli görüşmesi olarak gösterilmedi. Video yayın tarihi olayın gerçek zaman çizelgesi sayılmadı.

## Üretim ve denetim

- Özgün altyazı her bölümün tek birincil olay kaynağı; çözümleme ve Evren kayıtları bağlamsal indeks.
- Gpt-6.1-sol ile kaynak-sınırlı taslak; ayrı çağrıda özgün altyazı ile kişi, sıralama, olmuş/planlanmış eylem denetimi.
- **10/10 taslak `audited_pass`**. Kaynakla uyuşmayan kişi atfı, güvensizlik cümlesi ve İznik konsülü/yer ifadesi gibi somut sapmalar düzeltilip tekrar denetlendi.
- Altyazıdan birebir alınmayan `sourceAnchors` düzeltildi; hatalı önceki taslak ve denetimler `audit-attempts` içinde tutuldu.
- Her taslağın, bağımsız denetimin ve kaynak paketinin SHA-256 parmak izleri eşleştirildi.
- Yerleştirme dosyası: `channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-01-20261116/editorial-decisions.json`.
- Kaynak paketleri ve ilk envanter, aynı `completed-batches` dizininde saklandı. Yayımlanmış kitap ve kaynak videosu arasında sonradan yanlış eşleşme engellendi.

## Güvenli aktarım ve sonuç

| Kontrol | Önce | Sonra |
|---|---:|---:|
| Aktif onaylı kitap anlatısı | 105 | **115** |
| Kitaba doğrudan kaynak olan video | 112 | **122** |
| Ara Kayıtlar anlatısı | 8 | **18** |
| Düğümlü numaralı davetler | 65 | **65** |
| 3.930 genel Evren kaynak farkı | 3.930 | **3.930** |
| Yeni metin içi varlık referansı | — | **26** |
| Kaynak kapsamı için bekleyen video | 171 | **161** |
| Kalan video partisi | 18 | **17** |

- Öncesinde gerçek SQLite'ın verified backup kopyası alındı: `channels/birdesengor/.local-data/studio/backups/before-book-batch01-20261116.sqlite`.
- Aynı işlem önce `/tmp/birdesengor-batch01-preflight-20261116.sqlite` üzerinde denendi; 115 bölüm, 122 video kaynağı, 26 referans ve sıfır yabancı anahtar hatası elde edildi.
- Yerel Studio'da `narrative_runs` #21, `video-editorial:` kapsam işaretiyle tek SQLite transaction içinde uygulandı. Genel kaynak baseline #13 değişmedi; `narrative-store` bu tür kapsam-sınırlı işleri 3.930 kaynak farkını tüketmiş saymıyor.
- Önceki 105 bölümün başlık/gövde/structured kaynak ve ilgili TR/EN yayın varyantları aktarım sırasında eşitlik testiyle korundu.
- SQLite `quick_check=ok`, `foreign_key_check=0`; Düğümlü 65 davet ve genel kaynak-baseline testleri geçti.
- Güncel kaynak envanteri yeniden üretildi: **283 kaynak / 122 bağlı / 161 bekleyen / 17 parti**.

## İngilizce yayın metinleri

Yeni on bölümün **10/10 İngilizce varyantı** onaylı Türkçe metinden Codex CLI ile üretildi ve Studio'da onaylandı. Önceki 105 ile birlikte kitapta **115/115 güncel onaylı TR, 115/115 güncel onaylı EN** bulunuyor. Kaynak yapısı, özel ad/kimlik, referans biçimi ve metin uzunluğu doğrulandı; 10 çevirinin tamamı başarıyla tamamlandı ve hata yok.

Doğrulama: `publication-languages.validateVariant` tüm 115 bölüm için her iki dilde çalıştı; eski 105 bölümün kaynak kayıtları, revizyonları ve toplam 210 TR/EN varyant satırı canlı öncesi SQLite yedeğiyle tek tek eşleştirildi. **Değişmiş eski bölüm veya eski dil kaydı: 0.** Yeni EN çevirileri anlamsal gözden geçirme bakımından nihai site sahibi kontrolüne açıktır.

## Kapsam dışı ve sonraki iş

- Canlı sitedeki `publication.json`, parola, SEO, arama motoru, görsel üretim veya deploy **değiştirilmedi**.
- 105 eski bölümün taslakları veya orijinal video analizleri yeniden üretilmedi.
- Web alt-reposunda bekleyen kaftan/kılıç/efekt düzenlemeleri bilinçli olarak korunuyor.
- Sıradaki video partisi, yenilenen `source-packets/batch-01-*.json` dosyasında **sonraki on kaynak** olarak hazırlanmış durumda.

## Çift dilli yayın paketi için kuru deneme

Güncel yerel SQLite'ın "/tmp/birdesengor-batch01-bilingual-export-check.sqlite" kopyasında tam `buildPublicationV2` (salt-okunur çıktı denetimi, canlı export/deploy değil) PASS: **115 bölüm, 115 onaylı TR, 115 onaylı EN, 122 benzersiz video kimliği, 1.663 arşiv varlığı, 3.619 ilişki**, foreign key hatası 0. Kaynak görselleri işin bu aşamasında tamamlanmadığı için paket hazır varlık sayısının sıfır olabilmesi yayın önkoşulu sayılmaz. Kuru denemenin geçmesi otomatik site açılışı veya eksik 161 videonun hazır olması demek değildir.

## Tarayıcı regresyonları ve tasarım uyumu

- Studio production build PASS; web birim testleri ve production build PASS (ilk genel doğrulama çalışmasında).
- Web açılış `foundation-e2e` PASS: 1920×1080, 1366×768, 390×844 normal ve azaltılmış hareket; 4 aktif hedef, 15 pasif tıklama, tarayıcı hatası yok.
- `journal-contents-e2e` PASS: 1920, 1366 ve 390; gruplu İçindekiler açılıp numaralı davet satırına erişim.
- `journal-layout-e2e` PASS: 1920, 1366 ve 390; uzun metin, tüm İçindekiler bağlantıları, folio, uzun görsel, kaydırma ve reduced-motion.
- `contents-search-e2e` PASS: 1920, 1366, 390 normal/azaltılmış hareket; TR/EN, kaydırma, ayraçlar.
- `contents-view-e2e` PASS: 1920 ve 390; listeleme ve görünüm kontrolleri.
- `book-illustrations-e2e` PASS ve `book-scroll-spine-e2e` PASS (masaüstü/mobil kaydırma/omurga).
- `foundation-e2e` testinde gerçek sahne tarafından gizlenmiş taş ve sandık artık yanlışlıkla görünür varsayılmıyor. Açılışta DOM'a eklenmiş, ancak tamamen gizli kitap-hover kanvasları etkin efekt sayılmıyor. Sadece test beklentisi değiştirildi; yayın sahnesi değişmedi.
- `journal-contents-e2e` ve `journal-layout-e2e` testleri yeni varsayılan **kapalı** İçindekiler gruplarını önce açarak devam ediyor; kullanıcı görünümü değişmedi.
- Genel `npm --prefix channels/birdesengor/web run verify` tüm testleri kapsayacak biçimde son düzeltmeden sonra tekrar **başarıyla bitirilmedi**: önceki çalışmada eski `journal-layout` beklentisinde durdu; bu test sonradan tek başına başarılı oldu. Geri kalan topluluk/kamera/vefk gibi E2E testleri sonraki genel kapanışta tekrar koşulmalı. Bunlar bu raporda PASS olarak gösterilmiyor.
- Web alt-reposunun test değişiklikleri, kullanıcıya ait kaftan/kılıç/efekt düzenlemelerinden ayrı commit edildi. Sahne objelerinin asıl `visible` değerleri değiştirilmedi.
