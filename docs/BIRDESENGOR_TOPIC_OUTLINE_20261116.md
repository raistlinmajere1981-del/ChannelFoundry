# BirDeSenGör — İçindekiler konu ağacı (16 Kasım 2026)

## Karar
Ana kategoriler birbirinden ayrı: Düğümlü Kitap, Bledum, Mezna, Kapsız Kitap.
Mezna geçici konu başlığı olarak izlenecek. Diğer temalar kanıtlanmadan açılmayacak.
Başlıklar kitapta konu başlığı; Studio'daki iç "Kayıtlar" bölümü webde gizleniyor. "Yayınları" tarih grupları kaldırıldı.

## Uygulama
Eski "Evren Günlüğü" ve dört tarih başlığı yerel Studio SQLite'dan kaldırıldı.
Yeni ana konu kayıtları ve karşılık gelen iç yapısal bölümler açıldı.
TR başlık varyantları onaylandı; EN varyantları sonraki çeviri aşamasına bırakıldı.
Bölüm metinleri, onaylı revizyonlar ve kaynak video bağlantıları değiştirilmedi.

- Düğümlü Kitap (8): 64. Davet ve Babil Hazırlığı; Zifir Kuyusu’ndaki Sandık; Orman Emaneti ve Babil Taşı; 65. Davetlinin Uyarısı; Şamzera ve Babil Düğümü; Merkez Mührü ve 66. Davet; 67. Davet ve Defterin Mezna Planı; 68. Davetlinin Mezna Kutusu.
- Bledum (10): Beş Emanet, Bledum ve Mezna Taşı; Bledum’un Bekçisi ve Yedi Tepe; On İkinci Sayfa ve Küçük Emanet; Bledum’u İsteyen Davetli; Loca Elçileri ve Makros’un Teklifi; Bledum Davetinde Eron Ginas; Eron’un Geçmişi ve Bledum’un Eksik Basamağı; Rumkale Bekçisi ve İki Altın Baston; Bledum’un Koruma İşaretleri; Ruşun’un Davetine Sızan Elçi.
- Mezna (2): Mezna Taşı ve On Sekiz Bağlı Kardeş; Mezna Büyük Mahkemesi.
- Kapsız Kitap (1): Yedinci Boyutun Kapısı.
- Bağımsız anlatılar (19): mevcut özgün sıra korunarak İçindekiler'de bağımsız gösteriliyor.

## Kapsız / Kapaksız ayrımı
Analiz verisinde Kapsız Kitap geçen 5, Kapaksız Kitap geçen 12 farklı video çözümlemesi var; bir video her iki adı kullanıyor, toplam 16 benzersiz kayıt. Kapaksız Kitap varlık kaydı, "Kapsız Kitap" adını diğer adlar arasında tutuyor. Aynı zamanda müstakil "Kapsız Kitap" varlık kaydı var. Varlık/alias kayıtlarını doğrulamadan birleştirmedik. Tek konu başlığında yeni anlatıların eklenmesine açık kaldı; güncel 40 anlatının yalnız biri ilgili.

## Güvence ve kabul
- Geçiş öncesi doğrulanmış SQLite yedeği:
  channels/birdesengor/.local-data/studio/backups/before-topic-outline-20261116-124239.sqlite
- Kaynak anlatı revizyonları işlem öncesi ve sonrası SHA-256 bütünlük kontrolüyle eşit.
- 21 konu altında, 19 bağımsız anlatı; toplam 40/40.
- Web testleri 287/287; masaüstü 1920x1080 ve mobil 390x844 kontrolleri; production build başarılı.
- Studio outline kabul testi başarılı.
- Geçici yerel kopyada yayın hazırlama → kitap modeli bütünleşme kontrolü: 4 grup, 40 gerçek folio, hiçbir kayıp veya yinelenen anlatı yok.
- Canlı yayın, içerik export, Git commit, push, deploy yapılmadı.

## Sonraki aşama
1. 19 bağımsız anlatıyı okuyup tek ve güçlü bir yeni anlatı zinciri olup olmadığına bak; zayıf bağlantılarla kategori üretme.
2. Dört ana başlığın İngilizce sürümlerini güncel Türkçe onaylardan üret ve onayla.
3. SEO kayıtları ve ardından video kareleri/karakalem görsel üretimine geç.

## 16 Kasım 2026 — Davet numarası düzeni

Kaynak denetimi: 283/283 çözümlenmiş video, Evren düğüm ve ilişki kayıtlarında kaynak olarak bulunuyor. 30 uygulanmış Evren aktarımı toplam 283 kaynağı kapsamış. Buna karşılık 40 onaylı kitap anlatısının kaynak video toplamı yalnız 50; geriye kalan 233 video Evren kaydına girmiş ama kitapta ayrıca bir anlatı bölümüne dönüştürülmemiş.

Davet numarasını yeni anlatının başlık metninden bağımsız tutan Studio editör alanı eklendi:
- İçindekiler → seçili onaylı anlatı → Davet numarası + kaynak video (kaynak video başlığı ve ID listelenir).
- Kaydedilen metadata ayrı bir SQLite tablosundadır: narrative_invitation_numbers.
- Aynı ana konuda yinelenen davet numarası engellenir; kaynak video seçimi mevcut anlatının sourceVideoIds listesiyle eşleşmek zorundadır. Başlıktaki açık sayıya aykırı sayı reddedilir.
- Kaynak video silinir/değişirse veya anlatı başka konuya taşınırsa numara yanlış yerde gösterilmez.
- Yayın modeline yalnız davet numarası eklenir; anlatı kaynak metinleri, çeviri metinleri, bölüm ID'leri ve kaynak videolar değişmez.
- Webde Türkçe örnek görünüm: "1. Davet — Başlık". İngilizce: "Invitation 1 — Title". Zaten numaralı eski başlık ikinci kez numaralanmaz.
- Numaralandırılmış konu kayıtları sayıya göre dizilir; numarası kanıtlanmayanlar kendi editoryal sıralarını korur.
- Düğümlü Kitap ve Kapsız Kitap gibi farklı ana konuların davet sayıları birbirinden bağımsızdır.
- İlk 40 anlatıya topluca tahmini numara atanmadı. Başlık ve kaynak video eşleşmesi onaylandıkça doldurulacak.

Doğrulama: yeni Studio davet metadata testleri, mevcut narrative outline/IPC testleri, web 289/289 birim testi, Studio ve web production derlemesi, web 1920x1080/390x844 e2e görünüm testleri ve gerçek Evren verisinin geçici kopyasında numara taşınması (64/65. davetler) başarılı. Önceki çalışmalarda olduğu gibi canlı yayın/export, commit veya deploy yapılmadı.

Bir sonraki editoryal aşama: 233 videodaki davetleri kaynak bazında eşleştirerek, gerekiyorsa tek davet = tek kitap anlatısı yaklaşımıyla yeni hikâyeleştirme partilerini başlatmak. Bir video ile bir daveti özdeş kabul etme; videonun kaydedilme/yayınlanma tarihi olay kronolojisinin garantisi değil.

## 16 Kasım 2026 — 68 davetin kaynak eşlemesi

- 283/283 çözümleme Evren kayıtlarına aktarılmış; kitap anlatılarında kaynak olan yalnız 50 video, 40 onaylı bölüm.
- 1–68 numaralı Düğümlü Kitap haritasında 65 numaranın doğrudan videosu bulundu, 25/56/66 doğrudan kaydedilmiş görüşme değil.
- 53 ve 65 numaraları iki ayrı videoda doğrudan tekrarlandığı için otomatik birleştirilmeyecek.
- 76 benzersiz video kaynağı eşleştirildi; 70'i mevcut anlatı bölümlerinin kaynaklarında yok.
- İlk 10'luk kaynak paketi hazır; 10 videonun özgün çözümleme özeti, storyBeats/storyHints ve video bazlı Evren kanıtları saklandı.
- İlk 10 için 4 benzersiz story düğümü ve 19 event düğümü halen taslak. Otomatik onay veya anlatı yaratma yapılmadı.
- Mevcut genel Hikâyeleştir farkı 1.233 düğüm + 2.697 ilişki = 3.930 değişiklik. Bunun tek istekle çalıştırılması yerine davet başına kaynak-sınırlı üretim ve onay akışı gerekiyor.
- Kaynaklar ve kontrol dosyaları: docs/BIRDESENGOR_INVITATION_SOURCE_INVENTORY_20261116.md, docs/BIRDESENGOR_FIRST10_SOURCE_READINESS_20261116.md, channels/birdesengor/.local-data/studio/invitation-inventory.json ve dugumlu-first10-source-packet.json.
- Sonraki üretim: ilk 10'un kaynak doğrulaması/onay seçimi, davet başına bir bölüm olarak AI taslakları, gözden geçirme ve Studio Evren kitabına aktarma. Yayın tarihi çekim tarihi olarak kullanılmaz.

- İlk 10 davetin tam Türkçe altyazıları (335.703 karakter), özgün AI çözümlemeleri ve video bazlı Evren kaynak izleri ile ayrı JSON dosyasında tutuldu; SHA-256 değerleri veritabanına karşı doğrulandı.

## Editoryal onay / 1–10 davetler

16 Kasım 2026: 10 kaynak-sınırlı davet metni onaylanıp Düğümlü Kitap ana başlığına eklendi. Kitapta toplam 50 anlatı var; 3.930 Evren değişikliği kuyruğunda kaldı. Rapor: docs/BIRDESENGOR_FIRST10_EDITORIAL_APPROVAL_20261116.md.

## 16 Kasım 2026 — Nihai kitap kapanışı

1–68 aralığında 65 doğrudan kaynaklı davet kaydı onaylı TR anlatı olarak kitaba aktarıldı; 25,56,66 için görüşme kaydı bulunmuyor. Eski sekiz Düğümlü anlatısı Ara Kayıtlar altına taşındı. Toplam 105 anlatı korunuyor. Son kaynak denetimi ve çeviri/SEO/görsel eksik envanteri: docs/BIRDESENGOR_PRETRANSLATION_SEO_IMAGE_READINESS_20261116.md. Genel kaynak farkı 3.930 olarak ayrıca bekliyor.
