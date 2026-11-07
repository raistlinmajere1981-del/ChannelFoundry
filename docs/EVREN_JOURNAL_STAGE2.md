# Evren Kitabı — Aşama 2 / Fiziksel açılış ve içindekiler

7 Kasım 2026. Aşama 1 ve başlangıçtaki iki deponun commit edilmemiş değişiklikleri korunarak çalışıldı. Tek kalıcı Grabfold kitabı, fiziksel kapak ve mevcut sahne kullanılır. Yeni modal, okuyucu veya yan panel yok. Aşama 3 uygulanmadı.

## İnceleme bulguları

Salt okunur gerçek Studio paketiyle başlangıç görüntüleri `artifacts/evren-stage2/baseline/opening-*.png` dosyalarında. Yerel kodun ilk açılışı zaten Grabfold `-1` konumundaydı: sol tarafta gerçek kapak arkası, sağ tarafta mantıksal sayfa 0 / İçindekiler. Yanlış bir offset varsayarak kapak veya motor konumu değiştirilmedi.

Görünürlüğü ve okuma akışını zayıflatan somut noktalar:

- Eski fiziksel sıra İçindekiler → dört Evren kategori dizini → günlük idi. Bağlantı kullanmayan okuyucu önce dizinleri çevirmek zorundaydı.
- Mobil ilk yaprak, içindekilerle ilk kategori dizinini aynı kaydırma yüzeyinde taşıyordu. Kapanışta `jumpTo(-1)` yapılmasına rağmen aynı DOM yaprağının kaydırması sıfırlanmıyordu; tekrar açılış başlığı görünür kılmayı garanti etmiyordu.
- Gerçek pakette 3 onaylı anlatı, 31 Evren kaydı, 3 görsel ve **0 dizi/bölüm eşleştirmesi** var. Önceki sentetik dizi testleri bu gerçek içerik durumunun kanıtı değildi. Bu aşamada Studio eşleştirmesi üretilmedi.
- Gerçek anlatılar `sourceKeys` taşıyor, ancak paragraflarında açık `reference` span'ı bulunmuyor. Bu nedenle mevcut bağlantı kodu gerçek anı metninde tıklanabilir kaynak adı göstermiyordu.

## Uygulanan davranış

Her yeni fiziksel açılışta kağıt ve ilk yaprağın kaydırması kapak kapalıyken başlangıca alınır. Kapak açılınca aynı ilk sağ yaprakta açıkça İçindekiler görünür. Kapak arkası, açılış menteşesi, kapanış pozu ve Grabfold motoru değiştirilmedi.

İçindekiler Studio'nun yayınladığı gerçek dizi ve bölüm kimliklerini kullanır. Dizi başlığı, alt bölüm ve anılar ayrı seviyelerde görünür. Eşleştirilmemiş onaylı içerikler **Bağımsız anılar** altında kalır; boş diziler uydurulmaz. **Evren Dizini** altında yalnız yayında kaydı bulunan kategoriler görünür. Gerçek pakette Olaylar kaydı yoktur; beş kategori birlikte izole fixture ile doğrulanır.

Uzun içindekiler gerçek kağıt yüzlerine devam eder; önceki/sonraki yaprak bağlantıları bulunur. **Günlüğe başla** bağlantısı bütün içindekileri çevirmeden ilk anıya gider. Günlük ilk recto'dan başlar; tek sayıda içindekiler yüzü varsa arkasında boş verso bulunur. Mobil bu boş verso'yu gereksiz bir kaydırma yüzeyi olarak göstermez. Bütün anlatılar kategori dizinlerinden ve arşivden önce yer alır.

Dizi, bölüm, anı, kategori ve kayıt hedefleri stable kimliklerden güncel yerel sayfa/Grabfold konumuna çözülür; Studio'ya sayfa numarası eklenmez. İçindekilere dönüş için kitabın sağ kenarında ince fiziksel ayraç bulunur; mevcut sayfa altı mürekkep bağlantıları ve arşivden önceki pasaja dönen ayraç korunur.

Gerçek metindeki **tam ad eşleşmeleri**, yalnız o anının yayınlanmış `sourceKeys` kimlikleri içindeyse, render sırasında mürekkep bağlantısı olur. Aynı ad birden fazla kaynak kimliğine karşılık geliyorsa rastgele hedef seçilmez. Harfler, paragraflar ve yayın JSON'u aynen kalır. Açık `reference` span'ları korunur. Tüm arşivden tahminî ad/olay eşleştirmesi, metin yeniden yazımı, AI üretimi, kayıt migration'ı veya eski kayıt şeması desteği eklenmedi.

## Aşama 1 hata yolunun sağlamlaştırılması

`channel-projects.cjs` içinde proje kimliğinin doğrulanması ile anlatıcı aktarımı hatası ayrıldı. Aktarımın SQLite okuması veya atomik JSON yazımı başarısız olursa `readProject` aynı kanal kimliğini ve güvenli `narratorMigrationError` bilgisini döndürür. Böylece `listProjects` kanalı sessizce gizleyemez ve `activeProjectId` başka kanala düşmez. Aynı hata günlük çıktısını doldurmaz; ham SQLite hatası, dosya yolu veya içerik yazdırılmaz.

Kanal Ayarları hatayı gösterir. Aktarım çözülene kadar ayar kaydı ve Hikâyeleştir profil tüketimi engellenir; varsayılan profil eski ayarın üzerine yazılamaz. Sorun giderilince aynı kanalın normal tek yönlü aktarımı tekrar denenir. Anlatıcı alanları, perspektif, frozen sözleşme ve mevcut ayar önceliği değiştirilmedi.

## Bu aşamada değişen dosyalar

Web:

- `src/App.jsx`: kapak açılmadan önce ilk yaprak/kaydırma sıfırlama; dizi/bölüm hedeflerini çözme.
- `src/book/bookModel.js`: günlükten sonra başvuru dizinleri, recto başlangıç, kimlik haritaları, gerçek içindekiler devam yaprakları, kaynak adına dayalı salt render bağlantıları.
- `src/book/BookIndexPages.jsx`: hiyerarşi, başlıklar, devam ve ilk anı bağlantıları.
- `src/book/BookPages.jsx`: kaynaklı metin bağlantılarını mevcut okuma yüzeyinde gösterme.
- `src/book/GrabfoldJournal.jsx`, `src/book/journal-pages.css`: aynı kağıt örneğinde kenar ayracı ve mobil boş verso davranışı.
- `tests/bookModel.test.mjs`, `tests/journal-contents-e2e.mjs`, `tests/journal-layout-e2e.mjs`, yeni `tests/journal-opening-e2e.mjs`: okuma sırası, kimlik/folio hedefleri, gerçek paket, kaydırma ve fiziksel gezinme doğrulamaları.
- `package.json`: gerçek yayınla salt okunur kabul için ayrı `test:e2e:journal:opening` komutu. Normal sentetik test zinciri özel Studio verisi bulunmayan checkout'ta da çalışabilir.

Studio:

- `apps/studio/channel-projects.cjs`: aktarım hatasında kimlik/aktif seçim korunması ve güvenli hata.
- `apps/studio/src/ChannelProjectsSettings.tsx`, `studio-api.d.ts`: aktarım hatasının görünür ve kaydı koruyan durumu.
- `apps/studio/verify-channel-narrator.cjs`, `tests/channel-narrator.browser.mjs`: bozuk SQLite, başarısız yazma, seçim korunması, varsayılan profilin kullanılmaması, tamir sonrası aktarım ve React hata görünümü.

Başlangıçtaki diğer Studio ve web değişiklikleri bu aşamanın uygulaması değildir. Özellikle fiziksel kapak CSS'i, Grabfold bağımlılığı, yayın normalizasyonu, gerçek kanal ayarları ve gerçek Studio içeriği yeniden yazılmadı.

## Doğrulama ve görseller

Ana akış raporu: `artifacts/evren-stage2/after/verification.json`. Son kodla ekran başına tamamlanan üç rapor birleştirildi: `verification-1920.json`, `verification-1366.json`, `verification-390.json`.

- Gerçek Studio: **1920×1080, 1366×768, 390×844**, her birinde normal ve reduced-motion. Kapalı kitap → İçindekiler → günlük anısı → metin içindeki kaynak adı → Evren kaydı → ayraçla önceki anıya dönüş → İçindekiler → kapat/yeniden aç. Altı vaka geçti. Gerçek içindekilerdeki **7 bağlantı** (3 anı, 4 kategori) her vakada doğru fiziksel hedef ve başlıkla kontrol edildi. Tek Grabfold örneği korundu. Mobilde sıfırdan farklı okuma kaydırması ayraçla aynı değere döndü; kenar ayracı dokunmayla da çalıştı.
- İzole dizi örneği: her boyutta **4 içindekiler yüzü, 31 bağlantı**, iki ayrı dizi, 54./55. Davet, bağımsız anı ve beş kategori. Bütün kimlik/folio hedefleri, devam bağlantıları ve başlıkların ilk alt öğeyle kalması geçti. Kaydırılmış ilk mobil içindekiler yaprağını kapatıp yeniden açma da doğrulandı.
- Komut: web dizininde `JOURNAL_STAGE2_WIDTH=1920 npm run test:e2e:journal:opening`; 1366 ve 390 için aynı komut. Varsayılan komut üç boyutu birlikte çalıştırır. Uzun toplu deneme süreç sinyaliyle kesildiği için nihai kabul ekranlara bölünerek tamamlandı. Son üç grup başarılı; ilk iterasyonlar `artifacts/evren-stage2/iterations/` altında final kanıttan ayrıdır.
- Web birimleri: **202/202**. Günlükten sonra başvuru dizinleri, recto başlangıcı, boş dizi filtresi, bağımsız anılar, editoryal sıra değişince kimliklerin doğru hedefe gitmesi ve metnin/referansların kayıpsız korunması dahil.
- `journal-contents-e2e.mjs`: üç boyutta dizi → bölüm → anı → arşiv → anı geçti. `journal-layout-e2e.mjs`: masaüstlerinde **52/52** yüz; mobilde özel boş içindekiler verso'su atlanarak **51/51** yüz. Uzun metin/açıklama, dikey görsel, hedef/folio ve erişilebilir taşma kontrolleri geçti.
- `physical-books-e2e.mjs`: iki kitapta kalıcı örnek, gerçek sürükleme, klavye, tek/son yaprak, açılış sırasında kapanış, resize, kapak ve odaya dönüş; üç ekran + mobil reduced-motion geçti.
- `camera-e2e.mjs`: arşiv/arama, oynatma, hata sonrası toparlanma, yoğun/boş arşiv ve kitaplara dönüş geçti.
- `community-renewal-e2e.mjs`: 1920 normal, 1366 reduced-motion, 390 normal/reduced-motion; servis yokluğu ve StrictMode geçti. Fiziksel kitap testi de ortak Topluluk cildini kontrol etti.
- `npm run test:e2e:vefk`: belge/DOM, atölye ve fiziksel kullanım testlerinin üçü de geçti. Üç ekran + mobil reduced-motion, seek/reset/pause, tek stand/kalem, 32 mührün erişimi, boş/geçersiz/servissiz durumlar ve izole Studio düzenle/onay/paket akışı dahil.
- `npm run verify:channel-narrator`: backend + gerçek React/IPC geçti. Bozuk SQLite ve atomik yazma hatasında kanal/aktif seçim korunur, hata görünür, yanlış varsayılan profil kaydedilemez/kullanılamaz; onarım sonrası aynı kanalda aktarım tamamlanır. Mevcut migration, izolasyon ve frozen kontrolleri korundu.
- Diğer Studio kontrolleri: `verify-channel-projects`, `verify-studio-data-paths`, `verify-narrative-store`, `verify-narrative-outline`, `verify-narrative-service-contract`, `verify-narrative-ipc`, `verify-narrative-ai-generation`, `verify-publication-v2` geçti.
- Web ve Studio production derlemeleri geçti. İki depoda `git diff --check` temiz. Tam release/deploy zinciri çalıştırılmadı.

Gerçek DB, WAL, SHM, `publication.json`, canlı publication baseline'ı ve BirDeSenGör `channel.json` dosyalarının **altısında da başlangıç/son SHA-256 aynı**. Kanıt: `artifacts/evren-stage2/protected-files-verification.json`. Başlangıçtaki ilgisiz Git patch'leri karşılaştırıldı; `physical-books.css`, `publication.js` ve Aşama 1'in anlatı/AI kodu korundu. Test logları `artifacts/evren-stage2/logs/` altında.

Gerçek paket görüntüleri:

| Ekran | Açılış / İçindekiler | Günlük | Evren kaydı |
| --- | --- | --- | --- |
| 1920×1080 | [İçindekiler](../artifacts/evren-stage2/after/real-contents-1920.png) | [Anı](../artifacts/evren-stage2/after/real-diary-1920.png) | [Kayıt](../artifacts/evren-stage2/after/real-archive-1920.png) |
| 1366×768 | [İçindekiler](../artifacts/evren-stage2/after/real-contents-1366.png) | [Anı](../artifacts/evren-stage2/after/real-diary-1366.png) | [Kayıt](../artifacts/evren-stage2/after/real-archive-1366.png) |
| 390×844 | [İçindekiler](../artifacts/evren-stage2/after/real-contents-390.png) | [Anı](../artifacts/evren-stage2/after/real-diary-390.png) | [Kayıt](../artifacts/evren-stage2/after/real-archive-390.png) |

Dizi hiyerarşisinin yalnız fixture olduğunu belirten ek görüntüler `series-contents-*`; devam yüzleri `multi-contents-*` dosyalarıdır.

## Sonraki aşamaya bırakılanlar

Kayıt/İlişkiler/Roller alanları ve teknik künye temizliği, eski Evren metinlerinin dönüşümü, görsel/AI anlatım çalışmaları ve editoryal dizi eşleştirmelerinin gerçek Studio'da oluşturulması. Gerçek yayın paketi üretilmedi; commit, push veya deploy yapılmadı.

## Belgeler ve teslim anındaki Git durumu

Bu belgeyle birlikte `docs/EVREN_JOURNAL_IMPLEMENTATION.md` ve `docs/EVREN_JOURNAL_DESIGN_ACCEPTANCE.md` içine yalnız Aşama 2 bağlantısı eklendi. Aşama 1 raporu değiştirilmedi.

İki depo da `main` / `main` dalında; stage edilmiş dosya yok. Aşağıdaki listeler başlangıçtaki çalışmaları da içerir.

ChannelFoundry:

```text
 M apps/studio/channel-projects.cjs
 M apps/studio/main.cjs
 M apps/studio/narrative-ai-contract.cjs
 M apps/studio/narrative-ai-generation.cjs
 M apps/studio/narrative-ipc.cjs
 M apps/studio/narrative-store.cjs
 M apps/studio/preload.cjs
 M apps/studio/publication-v2.cjs
 M apps/studio/src/ChannelProjectsSettings.tsx
 M apps/studio/src/NarrativeWorkbench.tsx
 M apps/studio/src/channel-projects.css
 M apps/studio/src/narrative-api-contract.d.ts
 M apps/studio/src/studio-api.d.ts
 M apps/studio/studio-runtime.cjs
 M apps/studio/verify-narrative-ai-generation.cjs
 M apps/studio/verify-narrative-ipc.cjs
 M apps/studio/verify-narrative-service-contract.cjs
 M apps/studio/verify-publication-v2.cjs
 M channels/birdesengor/channel.json
 m channels/birdesengor/web
 M package.json
?? apps/studio/narrative-outline.cjs
?? apps/studio/src/NarrativeOutlineWorkbench.tsx
?? apps/studio/src/narrative-outline.css
?? apps/studio/tests/channel-narrator.browser.mjs
?? apps/studio/tests/narrative-outline.browser.mjs
?? apps/studio/verify-channel-narrator.cjs
?? apps/studio/verify-narrative-outline.cjs
?? docs/CHANNEL_NARRATOR_STAGE1.md
?? docs/EVREN_JOURNAL_DESIGN_ACCEPTANCE.md
?? docs/EVREN_JOURNAL_IMPLEMENTATION.md
?? docs/EVREN_JOURNAL_STAGE2.md
```

Web:

```text
 M package.json
 M src/App.jsx
 M src/book/BookPages.jsx
 M src/book/GrabfoldJournal.jsx
 M src/book/bookModel.js
 M src/book/physical-books.css
 M src/data/publication.js
 M tests/bookModel.test.mjs
?? src/book/BookIndexPages.jsx
?? src/book/journal-pages.css
?? tests/journal-contents-e2e.mjs
?? tests/journal-layout-e2e.mjs
?? tests/journal-opening-e2e.mjs
```
