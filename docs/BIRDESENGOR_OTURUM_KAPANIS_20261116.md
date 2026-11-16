# BirDeSenGör — Kitap, yayın hazırlığı ve Git kapanış notu

**16 Kasım 2026 — Yerel Studio.** Görsellere, şifreye, SEO kayıtlarına, robots/arama motoru ayarlarına ve canlı yayına müdahale edilmedi.

## Kitap / editoryal kapanış

- **105/105 aktif anlatı onaylı.** Türkçe 105/105 ve İngilizce 105/105 güncel, geçerli yayın varyantı.
- **112 özgün video**, kitapta **327 metin içi Evren varlık referansı**. Kaynaksız, boş veya yinelenmiş bölüme rastlanmadı.
- **65 doğrudan Düğümlü Kitap daveti** (1–68 aralığı); 25, 56 ve 66'nın doğrudan görüşmesi yok. 53 ve 65 iki ayrı kaynakla bağlantılı. Ara Kayıtlar, Bledum, Mezna, Kapsız Kitap ve bağımsız kayıtlar korunuyor.
- Evren kaynak işleme 283/283; bekleyen revizyon 0. SQLite quick_check ok; yabancı anahtar hatası 0.
- Yeni kitap onayı gerekmiyor; 105 onaylı kayıt için gereksiz yeniden onay veya yeni revizyon oluşturulmadı.

## Kullanıcının görsel/şifre/SEO dışında kalan işleri

1. **3.930 genel Hikâyeleştir kaynak farkı**: 1.233 onaylı Evren düğümü ve 2.697 ilişki; 105 onaylı kitap anlatısından ayrı bekliyor. Yeni anlatı gerektirip gerektirmediği kaynak bazında karar verilmeden topluca hikâyeleştirilmemeli. Kamuya açık son yayından önce kapsamı kararlaştırılmalı.
2. **Kitabın bağladığı 108 varlıktan 45'inin İngilizce açıklaması eksik/eski** (63/108 EN güncel; 108/108 TR güncel). Ana 105 bölümün EN metni tamdır.
3. Genel arşiv: 1.663 onaylı varlıktan 411 EN geçerli; diğer 1.252 için çeviri/güncelleme var. 1.054 taslak Evren düğümü ve 1.858 taslak ilişki kaynak bazlı incelemede; toplu onay, kesin olmayan kimlikleri ve olayları birleştirebilir.
4. Görseller tamamlandığında gerçek telefon/masaüstü son kabul testi: yatay/dikey sahne, üyelik, destekçiler, kitap sürükleme/çevirme, TR/EN, kaynak bağlantıları ve ekran oranları.
5. **Özel önizleme erişimi:** Kullanıcı arayüzü şifreli olsa da /content/publication.json doğrudan HTTP 200 ile alınabiliyor. Metnin gerçek erişim gizliliği önemliyse yayın JSON/API erişimi ayrıca korunmalı; parola kaldırma ve SEO ayarlarıyla ayrı değerlendirilir.

## Kullanıcının kendisine bıraktığı işler

- Kaftan ve diğer nesnelerin Codex görsel ince ayarı; Studio üretim sepetinde parti parti görsel ekleme ve yayın.
- Gerçek public açılış sırasında şifre kaldırma, SEO metin onayı, canonical/hreflang/sitemap ve arama motorlarına açma.

## Teknik doğrulama

- Kaynak / TR+EN anlatı / numara / referans bütünlüğü: 105 kayıt, 112 video, 327 inline referans, 65 davet ve 0 bekleyen revizyon.
- Düğümlü preproduction ve davet numarası denetimleri PASS.
- Davet üretim servisi + kaynak bazlı editorial baseline regresyonları yalnız ayrı /tmp SQLite kopyasında PASS.
- Studio production build, yayın V2, anlatı IPC, görsel sepet ve zamanlı altyazı arama PASS.
- Web 289/289 test, production build, dist PHP/API doğrulaması PASS.
- İçindekiler tarayıcı kontrolü: 1920×1080 ve 390×844 PASS.
- Bu kapanışta içerik yayını, veritabanı toplu onayı veya görsel üretimi yapılmadı.

**Kaynak ilkesi:** Belirsiz karakterler, eski kayıtlar, gelecek planları ve kimliği ispatlanmamış nesneler sırf taslak sayısını sıfırlamak için otomatik onaylanmayacak.
