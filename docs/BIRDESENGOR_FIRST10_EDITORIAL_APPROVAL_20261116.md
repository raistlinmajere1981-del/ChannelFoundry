# BirDeSenGör — Düğümlü Kitap 1–10. Davet / Editoryal Onay ve Kitaba Aktarım

16 Kasım 2026 · Yerel Studio veritabanı

## Son durum

- Düğümlü Kitap'ın 1–10. davetleri, her biri kendi özgün Türkçe YouTube altyazısına bağlı ayrı kitap anlatılarına dönüştürüldü.
- 10 davetin AI metni bağımsız kaynak denetimi ve kaynak destekli metin düzeltmeleriyle gözden geçirildi.
- Son kaynak denetiminde sıfır engelleyici bulgu var: 2 davet pass, 8 davet review (özel isimlerin otomatik altyazıdaki yazım belirsizliği). Belirsiz isimler kendiliğinden kesinleştirilmedi.
- 10 taslak editoryal olarak reviewed yapıldı; 10 yeni onaylı sürümlü kitap anlatısı eklendi.
- Kitap bölümü sayısı 40 → 50. Önceki 40 anlatının başlık, metin, blok, video ve referans verileri SHA-256 karşılaştırmasıyla korunuyor.
- Düğümlü Kitap altında 1.–10. davetler doğru sıralı; önceki 8 anlatı onların ardından gösteriliyor. Diğer ana başlıklar Bledum, Mezna, Kapsız Kitap.
- Metin içinde onaylı Evren varlıklarına 18 referans oluşturuldu. Her bölümün kaynak video kimliği ayrıca saklanıyor.
- Yeni anlatılar için 10 onaylı Türkçe yayın metni varyantı eklendi; İngilizce varyantlar üretilmedi.
- Genel kaynak baz çizgisi #13 korunuyor. Ayrı kaynak-sınırlı editoryal işlem #14 eklendi. Önceden bekleyen 3.930 Evren değişikliği aynı sayıda devam ediyor.
- Davet taslakları artık Studio'da Kitapta statüsünde; yanlışlıkla yeniden üretim veya taslağı değiştirme engellendi. Yeni değişiklikler sürümlü anlatı revizyonuyla yapılmalı.

## Kaynak denetim sınırları

335.703 karakterlik ilk 10 Türkçe özgün video altyazısı, AI destekli kaynak karşılaştırmasına alındı. Gerçek düzeltmeler kişi, olay, zaman, konuşma atfı ve tamamlanmış/tasarlanmış eylem ayrımlarına göre uygulandı. Olay olduğu gösterilmeyen kapanış, kaybolma, saklama veya teslim fiilleri kesin hükümden çıkarıldı.

Otomatik altyazıda farklı yazılan özel adlar (Selanur/Selor, Tamruş, Menşun, Mnu Estera, Şem, Huşimi/Hurşimi ve önceki karakter adları) kontrol notlarında korundu. Ses kaydından bütün isimlerin ayrıca kesinleştirildiği iddia edilmiyor.

İlk 10 kaynak videosuna bağlı bazı Evren olay/hikâye düğümlerinin taslak statüsü değiştirilmedi. Yeni anlatılar doğrudan video/altyazı kaynaklarına bağlandı ve onaylı Evren kişi/nesnelerine referanslandı; tüm Evren düğümleri topluca onaylanmadı.

## Teknik güvence

- İşlem öncesi yedek: channels/birdesengor/.local-data/studio/backups/before-first10-invitation-approval-20261116-141355.sqlite (86.876.160 bayt)
- Önce /tmp/birdesengor-first10-import-test.sqlite üzerinde import; 50 anlatı, 50 folio, konu ağacı, Türkçe yayın metinleri, eski 40 bölümün hash eşitliği ve 3.930 değişiklik kuyruğu doğrulandı.
- Daha sonra yerel Studio SQLite tek transaction ile güncellendi. PRAGMA quick_check = ok, FK kontrolü boş.
- Kaynak denetim raporları: channels/birdesengor/.local-data/studio/invitation-audits/1.json ... 10.json.
- Production derlemeleri, narrative IPC ve masaüstü/mobil editoryal arayüz testleri.
- Siteye deploy, Git commit veya push yapılmadı. Kamuya açık kitap paketi ayrı dağıtılmadı.

## Sıradaki aşama

Aynı kaynak sınırlı akışla 11–20. davetlerin hazırlığı, üretimi, bağımsız kontrolü ve kitaba alınması. 25., 56. ve 66. davetlerin doğrudan kaydı bulunmadığı; 53. ve 65. davetlerin birden çok kaynakla anıldığı notu korunacak. Görseller, EN tercüme ve SEO ayrı aşamalardır.

## Kapanış testleri

Web 289/289 birim testi geçti; web production build başarılı, İçindekiler 1920×1080 ve 390×844 E2E geçti. Studio build, narrative IPC/outline ve davet editörünün masaüstü/mobil testleri başarılı. Önceki sahne revizyonları yüzünden eski kalan iki testin beklentileri yeni görünür tütsülük ve 16 aktif efekt durumuna uyarlandı; sahne/efekt verileri bu düzeltmede değiştirilmedi.
