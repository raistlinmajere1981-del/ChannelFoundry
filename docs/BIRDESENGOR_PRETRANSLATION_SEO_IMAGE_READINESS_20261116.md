# BirDeSenGör — Çeviri, SEO ve Görsel Üretimi Öncesi Kapanış

Tarih: 16 Kasım 2026. Ortam: ChannelFoundry yerel Studio. Site deploy, Git commit veya push yapılmadı.

## Tamamlanan kaynak-anlatı işi

- 283 analiz edilmiş video kaydı Evren kaynak çalışmasında yer alıyor. Evren düğümlerinde 1.663 onaylı, 1.054 taslak durum korunuyor.
- Düğümlü Kitap 1–68 aralığında 65 doğrudan kayıtlı davet görüşmesinin her biri için ayrı Ömer anlatısı üretildi, özgün altyazılarla denetlendi, kesin olmayan olay ifadeleri düzeltildi ve Türkçe anlatı onayı verildi.
- 25, 56 ve 66'nın doğrudan görüşme videosu yok. Görüşme uydurulmadı; numaralar atlanarak korunuyor.
- 53 ve 65 numaralı davetlerin ikişer doğrudan videosu aynı davet bölümüne ayrı kaynak olarak bağlı.
- 52. davetin kaynak altyazısı İngilizce; buna sadık Türkçe anlatı hazırlandı. Türkçe altyazı varmış gibi gösterilmedi.
- İlk 40 anlatının metin, kanıt, video kimliği ve kaynak bağlantıları aynen korundu. Yeni davetler kısa onay gruplarında, disposable SQLite denemesi ve doğrulanmış canlı yedek sonrasında aktarıldı.
- Toplam 105 aktif/onaylı anlatı, 105 onaylı Türkçe yayın metni var. Davetlerin tamamı numara doğrulamasından geçti.

## Son İçindekiler ağacı

| Ana başlık | Alt başlık | Anlatı |
|---|---|---:|
| Düğümlü Kitap | Davetler | 65 |
| Düğümlü Kitap | Ara Kayıtlar | 8 |
| Bledum | Kayıtlar | 10 |
| Mezna | Kayıtlar | 2 |
| Kapsız Kitap | Kayıtlar | 1 |
| Bağımsız | — | 19 |
| **Toplam** | | **105** |

Eski sekiz Düğümlü anlatısı silinmedi, Ara Kayıtlar'a taşındı. Bu eski anlatıların dördünde 64,65,67,68 ile başlayan başlıklar, İçindekiler'de yeni davetler gibi tekrarlanmaması için yalnız Türkçe gösterim katmanında Önceki Kayıt öneki aldı; özgün onaylı anlatı metinleri korunuyor. Gruplu/düz görünüm, tarihe göre sıralama ve gerçek folio bağlantıları korunuyor.

## Sıradaki üretim aşaması envanteri

### Çeviri

- Kitap: 105/105 TR geçerli. Güncel yayın paketinde 36/105 EN geçerli; **69 kitap bölümünün EN çevirisi/güncellemesi gerekiyor**. Veritabanında 40 EN approved satırı olması, tamamının paket için geçerli olduğu anlamına gelmiyor.
- Arşiv: 1.663 onaylı Evren varlığı; güncel yayın paketinde 408 varlığın TR ve EN karşılığı geçerli. Kalan 1.255 varlığın dil kapsamı tamamlanmış değil.
- Konu ağacında dokuz Türkçe başlık onaylı, İngilizce başlıklar ayrıca üretilecek.
- Kamerada yayın adayı video metinleri 50 TR + 50 EN. Bu sayı, 283 analiz edilmiş videonun tamamı için çift dilde yayın metni olduğu anlamına gelmez.

### Görseller

- Kitabın 105 sahne slotu: 0 hazır / 105 bekliyor.
- Kitapta referans verilen 108 Evren varlığı: 3 hazır görsel (Kral Arohan, Poyraz, Tuji) / 105 eksik.
- Merkezi karakalem presetleri, varsayılan preset seçimi, kayda özel override, video altyazısında zamanlı arama, videodan kare seçimi ve referans kareyi Codex görsel üretimine bağlama alt yapısı hazır ve testli. Görselleri üretmiş gibi saymıyoruz.
- Önce çekirdek kişilerin ve belirgin nesnelerin kaynak görsel kimliğini sabitlemek, sonra sahne illüstrasyonlarını yalnız anlatıda belirtilen fiziksel ayrıntılarla üretmek uygun.

### SEO

- Güncel yayın adayı dil-sayfa kombinasyonlarından 242 SEO kaydı inceleme ve onay bekliyor: 105 TR bölüm, 36 EN bölüm, 50 TR video, 50 EN video, 1 TR çizim kaydı.
- Şu an bu 242 kaydın hiçbiri SEO onaylı değil. Çeviriyle yeni EN sayfaları eklendikçe sayı büyür.
- Canonical, hreflang, x-default, sitemap ve özel noindex önizleme sistemi ve ilgili testler mevcut. SEO kayıtları onaylı metin kesinleşince üretilmeli.

## Saklanan ayrı karar ve riskler

- Genel Hikâyeleştir kaynak farkı: 3.930 Evren düğüm/ilişki değişikliği. Davetlere özel onaylar bunu yanlışlıkla bitmiş saymadı. Genel kaynak içeriğinin diğer anlatılarla mutabakatı **kamuya açık son yayın öncesinde ayrı değerlendirilmelidir**.
- Otomatik altyazıda belirsiz özel isimler editoryal notlarda tutuluyor, kesin oldukları varsayılmıyor.
- Şu anki canlı web sitesi yeniden deploy edilmedi. Studio uygulamasının açık tutulması gerekmedi, terminal üzerinden işlem yapıldı.
- Yayına geçmeden önce tüm kaynaklar için çeviri, SEO ve görsel eksikleri, son mutabakat ve şifreli önizleme kontrolü tamamlanmalı.

## Test ve yedekler

- Kalıcı doğrulama: apps/studio/verify-dugumlu-preproduction.cjs — 65 numaralı direkt kaynak, 25/56/66 boşluğu, 53/65 iki video, 52 İngilizce kaynak, 105 TR bölüm, başlık ağacı, kaynak kimliği, editoryal talimat filtresi, 3.930 küresel değişiklik, SQLite/FK bütünlüğü.
- Web: 289/289 birim testi geçti; üretim derlemesi başarılı; 1920x1080 ve 390x844 İçindekiler tarayıcı testi başarılı.
- Studio: TypeScript/Vite üretim derlemesi, anlatı IPC, 1366/390 editör tarayıcı testleri (68 numara, 3 kaynaksız, 52 EN, 53 iki kaynak), karakalem preset, kaynak kare yakalama ve zamanlı altyazı arama testleri geçti.
- Her aktarma paketi önce geçici veritabanında denendi, canlıdan önce SQLite yedeği alındı. Son TOC yedeği: channels/birdesengor/.local-data/studio/backups/before-dugumlu-toc-reorganization-20261116-150512.sqlite.gz (~22,4 MB).
- SQLite PRAGMA quick_check = ok, foreign_key_check boş.
- Site deploy, Git commit ve push yapılmadı.

## Önerilen sonraki sıra

1. Kaynak karelerle karakalem varlık kimliklerini sabitle; ardından 105 sahne için seçici görsel üretimi.
2. Onaylı Türkçe metinlerden İngilizce üretimi (önce 69 eksik/güncellenmesi gereken kitap anlatısı), EN konu başlıkları ve gerektiği ölçüde arşiv varlıkları.
3. Dil metinleri son hâlini aldıktan sonra iki dilli SEO başlık/açıklama onayı, canonical/hreflang/sitemap doğrulaması.
4. Son yayına çıkmadan önce ayrı 3.930 Evren farkının kapsama etkisini kararlaştır, gizli önizlemede insan okuması yap, ardından deploy/push.

Bu not bir sonraki session'a devredilebilecek kapanış envanteridir; burada açıklanan çeviri, SEO ve görsel üretimi henüz yapılmadı.
