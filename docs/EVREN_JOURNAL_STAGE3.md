# BirDeSenGör Evren Kitabı — Aşama 3 / Okuma yüzeyini sadeleştirme

7 Kasım 2026. Aşama 1/2 değişiklikleri ve mevcut Git çalışma ağaçları korunarak, Codex kullanmadan Desktop Commander üzerinden uygulandı. Studio'nun gerçek veritabanı, mevcut üç günlük anlatısı, 31 Evren kaydı ve yayın dosyaları **değiştirilmedi**.

## Ürün kararı

Eski Evren kayıtları, karışmış sponsor/anlatıcı/muhatap bilgilerinin de bulunduğu **test verisidir**. Eski veri üstünde editoryal onarım, anlatıcı ismini üçüncü şahıstan zorla birinci şahsa dönüştürme, migration veya yayın temizliği yapılmadı. Yeni anlatı kuralları uygulanarak gerçek kaynaklardan tekrar içerik hazırlanması **Aşama 4** işidir.

## Uygulananlar

- `channels/birdesengor/web/src/book/bookModel.js`: Evren kayıtlarının okuyucu yapraklarından otomatik `Diğer adlar`, `Roller`, `Bu anılarda`, `İlişkili izler`, `Araştırma notları` başlık ve listelerini çıkarır. Kaynağa dayalı `summary`, `details`, portreler ve açıklamalar **aynen korunur**. Verideki ilişki kimlikleri kaybolmaz: bir Evren kaydında açık ilişki bulunan başka kayıtların **gerçekten geçen adları**, mevcut `sourceReferenceSpans` ile yalnız görünür metinde mürekkep bağlantısına dönüşür. Hiç geçmeyen isimler ayrı listeye dönüşmez. Belirsiz ad eşleşmesinde rastgele hedef atanmaz.
- Teknik `colophon` / `BirDeSenGör Araştırma Günlüğü` yaprağı kaldırıldı. `publicationId`, fingerprint, tarih ve sayı bilgileri yayın sözleşmesinde kalır.
- `BookPages.jsx`: İç kapaktaki bölüm/arşiv/ilişki sayacı ve katalog/kayıt ağırlıklı kapak metinleri kaldırıldı; kaynak izi başlığı okuyucuya `Kaynaklar` olarak gösterilir. Arşiv açıklamasındaki metin içi kaynaklı referanslar aktiftir. Gerçek bir anlatı bağlantısından dönmek için mevcut fiziksel ayraç korunur.
- `BookIndexPages.jsx`: İçindekilerde `Ömer · Anılar ve araştırma notları` türü üçüncü şahıs kimlik alt başlığı kaldırıldı; anlatıcı ayarı hâlâ Studio yayın sözleşmesinde durur.
- MIT atıf için eski teknik künye sayfası yerine tam lisans metni `public/licenses/grabfold-LICENSE.txt` altında tutulur.
- `physical-books.css`: kullanılmayan teknik künye ve otomatik anı listesi CSS'i çıkarıldı. Grabfold, sahne, kamera ve Topluluk kitap sistemlerine müdahale edilmedi.

## Doğrulama

- `npm test`: **203/203 PASS**.
- `npm run build` ve `npm run verify:dist`: PASS.
- `node tests/journal-contents-e2e.mjs`: 1920×1080, 1366×768, 390×844; dizi → bölüm → anı → Evren kaydı → ayraçla dönme PASS.
- Gerçek `publication.json` normalizasyonu ve model kontrolü: **3/3 anı**, **31/31 kayıt** erişilebilir; **48 fiziksel yüz**; `colophon` veya otomatik veri alanı yok.
- `tests/bookModel.test.mjs`, `tests/p7-book-artwork.test.mjs`, `tests/journal-contents-e2e.mjs` yeni okuma davranışını sınayacak şekilde güncellendi. Çıktılar yalnız test yüzeyinde değişti, Studio/AI kayıtlarında değil.
- Gerçek Studio DB, WAL, SHM, `publication.json` ve `channel.json` SHA-256 değerleri Aşama 2'nin `artifacts/evren-stage2/protected-files-verification.json` kayıtları ile birebir aynı kaldı.

## Kapsam dışı

- Deneme verisindeki `Anlatıcı`, `Ömer`, sponsor ya da yanlış kişi/ilişki öznelerini düzenlemek.
- Canlı site deploy'u; gerçek Studio kayıtlarını silme/yeniden yazma.
- Aşama 4'te yapılacak yeni kaynaklı anlatım ve editoryal üretim.
- Commit/push/deploy.

## Kontrollerin durumu

Fiziksel kitap / gerçek açılış E2E testleri bu çalışmanın sonunda ayrıca izlendi. Nihai test sonuçları kontrol tamamlandığında aşağıda eklenir.

## Nihai tarayıcı kabulü

- Gerçek Studio paketiyle `JOURNAL_STAGE2_WIDTH=1920 node tests/journal-opening-e2e.mjs`: normal + reduced-motion açılış, İçindekiler, günlük, kaynak kelimesi, Evren kaydı, ayraç, yeniden açılış ve 4 gerçek içindekiler devam yüzünde 31 kararlı bağlantı PASS.
- `node tests/journal-contents-e2e.mjs`: 1920, 1366, 390 boyutlarında PASS.
- `node tests/physical-books-e2e.mjs` **izole tekrar PASS**: 1920, 1366, 390 normal, 390 reduced-motion; her iki fiziksel kitap, sürükleme, klavye, kapanış, geri dönüş, kamera ve Vefk odası sınırları kontrol edildi. Paralel tarayıcı yükü altında ilk denemede RAF kapak ara-kare assertion'ı başarısız olmuştu; aynı test başka tarayıcı koşmadan tekrarlandığında 0 hata ile geçti. Herhangi bir animasyon özelliği bu sırada değiştirilmedi.
- Bu aşamada Codex çalıştırılmadı. Test/derleme çıktıları çalışma alanında; **Git commit/push, web deploy, Studio yayını yapılmadı.**
