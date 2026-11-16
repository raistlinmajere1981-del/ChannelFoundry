# BirDeSenGör — İçindekiler ve görsel hazırlığı (16 Kasım 2026)

## Tamamlanan teknik işler

1. İçindekiler sayfasına mürekkep tonlu gruplanmış/düz liste ve eskiden yeniye/yeniden eskiye tarih sıralama kontrolleri eklendi. Tarih seçimi tekrar tıklanarak kaldırılır.
2. Muhataplar, Nesneler, Mekânlar sabit; düz listede anlatılar tekil hedeflerini ve gerçek folio bağlantılarını koruyor. Fiziksel kitap yaprağı sırası değişmiyor.
3. Mevcut tarih grup adlarının sonundaki «yayınları» sözcüğü web İçindekiler görünümü ve aramasında gizlendi; kalıcı SQLite başlıkları henüz değiştirilmedi.
4. Studio Ayarlar içine Görsel standartları sekmesi eklendi. Üç başlangıç karakalem standardı, düzenleme, ekleme, kaldırma ve varsayılan seçimi proje SQLite studio_meta içinde kayıtlı.
5. Görsel editöründe üretim için başka preset seçilebiliyor. Stil, mevcut kaynak ve varlık açıklamalarına ekleniyor.
6. Kayıt bazında kaynak video karesi dosyadan seçilip WebP'ye dönüştürülerek görselden ayrı saklanıyor. Önizleme, değiştirme, kaldırma ve kullanma seçimleri mevcut.
7. Codex CLI app-server görsel üretim turuna referans kare localImage ile doğrudan ekleniyor. Geçici kare üretim sonrasında siliniyor. Diğer sağlayıcılarda bu yetenek açık değil. Video URL'sinden otomatik kare yakalama henüz yok.

## Kontrol sonuçları

- Web birim testleri: 286/286 başarılı.
- Eski İçindekiler arama E2E: 1920x1080, 1366x768, 390x844, mobil reduced-motion, TR/EN başarılı.
- Yeni görünüm kontrolleri E2E: 1920x1080, 390x844 başarılı.
- Studio TypeScript ve production build başarılı.
- Preset / arşiv / Codex görsel taşıma testleri başarılı.
- Visual profiles, visual completion, AI service, Records V3, Settings V3 ve görsel tamamlanma yerleşim testleri başarılı.
- Gerçek AI üretimi, canlı yayın, commit, push veya deploy yapılmadı.

## Sonraki editoryal karar

Mevcut 40 onaylı anlatıdan 31'i «Evren Günlüğü» altındaki dört tarih adlı grupta, dokuzu bağımsız. Ana konu adayları Düğümlü Kitap, Bledum, Mezna, Babil/geçişler ve diğer karşılaşmalar. Aynı olay birkaç konuya değinebiliyor.

Öneri: her anlatı tek ana dala bağlansın, ilgili diğer konulara kayıt referanslarından erişilsin. Konu sınırları kararlaştırılınca Studio narrative-outline transaction hareketleriyle yerleşim değiştirilsin; kaynak videolar ve anlatı metinleri korunarak. Ardından TR/EN eksik ve stale kayıtlar, SEO onayları ve görsel üretimine geçiş kararı ele alınsın.
