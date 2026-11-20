# BirDeSenGör — Son Web ve Studio Eşitlemesi (20 Kasım 2026)

## Canlı durum ve doğrulama

- Resmî site: https://birdesengorgizlievren.com/
- Son canlı publication: `pub-2a4ab008d9109f19abe2c125`
- İçerik fingerprint'i: `2a4ab008d9109f19abe2c125e1d97669bc7ed7a2e5aa27f170b0ee41b52c14ef`
- Evren: 2.684 geçerli TR / 2.684 geçerli EN; 2.717 toplam kayıt; 5.519 ilişki.
- Görseller: mevcut 15 korundu, **5 yeni eklendi**, toplam **20**. Yeni görseller: Dinoran, Nezrin, Hezmina, Kapaksız Kitap ve Kâruf'un 99'luk inci tespihi.
- Karakter ve diğer Evren özellikleri: Studio ile canlı içerikte aynı **54 kayıt**. Henüz yayınlanmamış AI önerileri otomatik onaylanıp sergilenmedi. Sitede karakter özellikleri listesi, ilerideki toplu görselleştirmeye kadar gizli kaldı.
- SEO: mevcut **6.027** kaynak-onaylı sayfa korunarak yeni fingerprint'e bağlandı; sitemap **6.029** URL. Canonical/hreflang, robots.txt ve index/follow resmî erişim doğrulandı.
- Kamera: 286 kayıt, metinleri ve arşiv kimlikleri değiştirilmeden korundu.
- Yayın için beş görselin SHA-256 değerleri sunucudan yeniden okunarak tek tek doğrulandı.
- Yetkili sunucu içerik, SEO ve canlı doğrulama kontrol noktaları: `channels/birdesengor/.local-data/studio/final-web-sync-20261120/release/` (Git dışı).
- Studio SQLite bağımsız anlık yedeği: `channels/birdesengor/.local-data/studio/final-web-sync-20261120/studio-snapshot.sqlite`. Canlı yayınla eşleşmiş yerel önizleme paketinde de 20 SHA-doğrulanmış görsel bulunmaktadır.

## Tasarım düzeltmeleri

- Evren kitabı anlatı başlıkları, içindekilerdeki bölüm/konu başlıkları ve kamera başlıkları ekranda **ilk harf büyük, diğerleri küçük** olarak gösterilir. Türkçe `İ/ı/I/i` kuralları uygulanır. Kaynak başlıklar, video araması, ilişkiler, onaylı TR/EN içerik ve SEO metinleri değişmedi.
- El yazısı baş harfin sonraki harfe taşması için başlangıç harfi çevresine güvenli yatay açıklık eklendi; mobil harf boyutu dengelendi.
- İçindekiler arama alanının ölçeklenmesi ve mobil okuma modlarının satır aralığı doğrulandı.
- Geçmişten kalma kamera başlık ve tarih satırı yerleşimi testleri mevcut resmî görünüme uyumlu hâle getirildi.
- Yalnız görsel ekleyen yayın güvenlik kontrolü, kaynak-sabitli nesne görsellerini ve onaylı kaynağı bulunan ancak bağımsız EN/TR varyantı bulunmayan karakter portrelerini destekliyor. Onaylı metin, mevcut diğer görseller ve ilişkileri değiştirme yasağı devam ediyor.

## Kod doğrulaması

- Web birim testleri: **297/297 PASS**.
- Kamera mobil/masaüstü uçtan uca, Evren kitabı içindekiler (3 ekran), kitap başlığı/tarih yerleşimi (TR/EN mobil/masaüstü), okuma tipografisi (masaüstü/mobil) başarılı.
- Web derlemesi ve `verify:dist`: PASS; sunucuda dağıtılan JS SHA yerel derlemeyle eşleşiyor.
- `verify:live`: HTTP 200 / resmî indeksleme / dil / robots / içerik karşılaştırmaları PASS.
- Studio derlemesi ve karakter özellik önerisi, altyazı kanıtı, publication-v2 ve SEO doğrulayıcıları: PASS.

Studio altyazı dayanaklı karakter önerisi geliştirmeleri kod olarak saklandı. Bunlar mevcut onaylı yayın verisini kendiliğinden değiştirmiyor. Yayında veri ve görünüm ayrımı sürdürülüyor.

Son kaynak durumunda Studio'da resmî yayına alınmamış boş bir anlatıcı etiketi vardı; yayın sırasında mevcut **Ömer** etiketi bilinçli olarak korundu. Yalnız gerekli beş görsel bağlantısı değişti.

Bu rapor ve özellik düzeltmeleri, web alt deposunun güncel Git commit'iyle birlikte kök depoya aktarıldı. Canlı sitedeki PHP/API topluluk ayarları ve `content/` altındaki yönetilmeyen dosyalar silinmedi.
