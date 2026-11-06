# Vefk Atölyesi V3 — tek çalışma alanı

2026-11-06. Studio kapsamı: kaynak, inceleme, SVG, revizyon ve yerel yayın hazırlığı. Web sahnesi, kitaplar, kamera ve canlı taşıma değiştirilmedi. Commit, push ve deploy yapılmadı.

## Çalışma modeli

`VefkWorkshop.tsx` koleksiyonu, aşama göstergesini, ana eylemi, tek `VefkViewport` yüzeyini ve bağlamsal özellikler alanını yönetir. `VefkSourceWorkbench` bu yüzeyin içeriğidir; araçlarını ve özelliklerini aynı iki DOM hedefine portal ile yerleştirir. Çizime geçişte kaynak bileşeni kapanmaz. Fotoğraf / Üst üste / SVG görünümleri ve hazırlık aynı çalışma alanındadır. Kaynak incelemesi ve kanonik belge farklı kayıtlar olarak kalır; iki ayrı belge editörü yoktur.

`VefkViewport` en ve boya sığdırır, yakınlaştırır, orta fare veya taşı aracıyla kaydırır. Panel alanları sınırlıdır; sayfa kaymaz. Dar pencerelerde paneller çalışma alanının üstüne açılır, koleksiyon 760 px altında varsayılan olarak kapanır. Panel tercihi kullanıcı değiştirdiğinde korunur. Zaman çizelgesinin taşıma kontrolleri daraltılmış halde de görünür.

Aşamalar: **Kaynak → İncele → Çizim → Onay → Yayına hazır**. Ana eylem sırayla incelemeye başlama, sonraki öğe, incelemeyi kaydetme, çizimi oluşturma, taslak kaydı, önizleme, önizleme doğrulaması, revizyon onayı, katalog seçimi ve paket hazırlamaya dönüşür. Başlıkta kaydedilmemiş değişiklik durumu görünür. Kaynak ve belge teknik kimlikleri ayrıntılardadır.

## İnsan incelemesi ve özgün çizim

- AI güveni 1 olsa da insan onayı verilmez. `appendAnalysis(origin: ai)` bölge, hücre ve kontur onaylarını temizler. Normalizasyon tüm onaysız öğeleri kuyrukta tutar.
- `vefk-review-model.ts` hücre ve bölgeleri tek kuyrukta toplar. Hücre alanları algılanan ızgaranın sınırlarından türetilir; görüntüye hayali tam sayfa ızgarası yerleştirilmez.
- Değer veya bölge tipi düzenlenince onay kalkar. Sınır/doku dışlaması değişince eski kontur kaldırılır. Tek öğe onayı kuyruğu azaltıp sıradaki öğeyi seçer. Yeşil kontur ve ✓ durumu görünür.
- Toplu onayda kullanıcı adayları seçer, sonra ayrı bir onay eylemi uygular. Yüksek güvenlileri seçme kendi başına onay değildir.
- Mürekkep maskesi, üç kontrast önizlemesi, doku dışlama, örnekleme ve noktaları koruma seçili bölgenin gelişmiş kontrolleridir. Kontur üretilince mavi olarak görünür; onaylandığında yeşildir.
- Sayısal kare yalnız tüm hücrelerin açıkça doğrulanmış tam sayı olması halinde sunulur. Sembollü hücreler özgün çizimde korunur. Özgün çizimden sayısal kareye sessiz dönüşüm yoktur.
- İzlenmeyen bölgeler aktarılmaz. Kısmi aktarım açık bir onay sorar; karar ve hariç kalan bölge kimlikleri kaydedilir.

Yeni serbest çizim gerçekten boş açılır. Boş editör yalnız geçici düzenleme durumudur; kanonik çekirdek hâlâ en az bir güvenli SVG yolu ister. Son serbest yol silinebilir; boş belge kaydedilemez. Matematiksel karenin zorunlu hücre ve ızgara yolları korunur.

## Kayıtlar, silme ve yerel dosyalar

`vefk-management.cjs` işlemleri mevcut IPC üzerinden sunar. Koleksiyonun üç nokta menüsü kaynak adlandırma, analiz temizleme, kaynak+analiz silme; belge adlandırma, çoğaltma, revizyon açma, katalogdan çıkarma ve bütün revizyonlarıyla silme sunar. Electron `prompt()` kullanmaz; adlandırma uygulama içi formdur. Onaylı belgenin adını değiştirmek yeni taslak revizyonu oluşturur.

Silme eylemlerinde nesne ve kapsam açıkça gösterilir ve kullanıcı onayı gerekir. IPC de `confirmed: true` arar. Belge silme tek SQLite işlemi içinde katalog seçimini, kaynak karar kaydını ve revizyonları kaldırır. Kaynak silme yalnız o kaynağın analizlerini ve hazırlıklarını kaldırır; ondan türetilmiş belgeleri silmez.

`vefk_document_sources` düzenlenebilir içeriğin kopyası değildir: kaynak kimliği, analiz kimliği, hazırlık revizyonu, üretim yöntemi ve kısmi çizim kararı tutar. Kaynak/analiz kimlikleri tarihsel köken bilgisidir; kaynak silindikten sonra belgeyi kullanılmaz hale getirecek FK ilişkisi kurulmaz. Belgeye FK vardır. Yeni kaynak tabanlı belgenin ilk kaydında son insan incelemesi, tüm hücre/bölge onayları ve ilgili kontur onayları kayıt katmanında doğrulanır. Sonraki belge revizyonları ve çoğaltmalar bu kararı korur.

Dosya temizliği yalnız `vefk-sources/` içindeki hash adlı normal dosyaları inceler. Hem kaynak hem bütün hazırlık revizyonları tarafından kullanılmayan dosyaları temizler; sembolik bağlantıları, bilinmeyen dosyaları, dış klasörleri ve yayın paketini silmez. Veritabanı işlemi tamamlandıktan sonra dosya temizliği yapılır; dosya temizliği tekrar çalıştırılabilir. Başka Studio modüllerinin tabloları/verileri hedeflenmez.

Kaynak fotoğraf karşılaştırması belge üretilirken kullanılan hazırlık revizyonunu açar. Daha sonra yeni kırpma kaydedilse bile eski çizimin altına başka koordinatlı fotoğraf konmaz.

## Kanonik çizim ve yayın sınırı

SVG normalizasyonu, `createVefk`, `drawPlan`, revizyon hash kilidi ve `frameAt(t)` tek kaynaktır. Mürekkep ve divit aynı kanonik kareyi kullanır. Çoklu `M` içeren bir yol yalnız görünür mürekkep dağılımı için alt yollara ayrılır; SVG kesikli çizgi düzeninin her `M` noktasında baştan başlaması engellenir. Bu işlem zamanlama üretmez. Studio ve site dağılımı regresyonla karşılaştırılır.

Önizleme açıkça doğrulandıktan sonra kayıt `checked`, ayrı onaydan sonra `approved` olur. Onaylı revizyon değişmez; sonraki düzenleme yeni revizyondur. Katalog seçimi revizyon ve hash ile sabittir. Yeni bir taslak eski seçili revizyonu otomatik değiştirmez.

**Siteye hazırla** mevcut katalog seçimini yapar. **Paketi hazırla**, mevcut `exportPublicSnapshot()` → `publication-v2.cjs` yolunu çağırır. Ayrı yayın sunucusu veya yalnız Vefk'e ait canlı gönderim yolu yoktur. Paket durumu mevcut katalog fingerprint'ini, gömülü ve ayrı katalog doğrulamasını ve belge dosyalarının hash'lerini okur; uygulama yeniden açıldığında korunur, seçim değiştiğinde veya dosya bozulduğunda düşer.

Yerel silme/yeniden adlandırma/katalogdan çıkarma daha önce hazırlanmış paketi veya canlı siteyi değiştirmez. Paket ancak açık yerel hazırlama işlemiyle yeniden oluşur. Canlı değişiklik yalnız **Yayınlama** modülündeki açık yayın işlemiyle mümkündür.

### Yayın kapısının incelemesi

`publication-v2.cjs` yerel paketi anlatı/görsel tamamlanmadan da oluşturur; hazır olma durumunu ayrıca döndürür. `studio-runtime.cjs:publishPublicExport` canlı gönderimde `readyForTheme` ister: en az bir anlatı bölümü, anlatıya uygulanmamış Evren değişikliği olmaması ve görsel kararların tamamlanması. Dolayısıyla yalnız Vefk değişikliği de başka içerikteki eksik karar nedeniyle canlıda bekleyebilir. Gönderim tam publication snapshot'ını değiştirdiği için bu kapıyı atlamak diğer içeriği de etkiler. Mevcut kapı korunmuştur; Vefk arayüzü yerel paket ile canlı yayın hazır olmasını ayırır. Bağımsız bir canlı Vefk yaması eklenmedi.

## Yerel doğrulama

Ekran ve sonuçlar: `artifacts/vefk-v3/`. Testler kullanıcı veritabanını sıfırlamaz. Chromium senaryosu gerçek fotoğraf, gerçek raster izleme, gerçek IPC işleyicileri ve ayrı SQLite kullanır; vision taşıması deterministiktir. Electron senaryosu gerçek preload/IPC, Studio kabuğu, gerçek yapılandırılmış Codex CLI çözümlemesiyle üretilmiş analiz ve mevcut tam yayın oluşturucusunu kullanır. QA içinde verilen onaylar üretim amaçlı Arapça/semantik doğrulama iddiası değildir.

```bash
npm run build:studio
node --test apps/studio/vefk-*.test.* apps/studio/vefk-core/*.test.cjs apps/studio/src/vefk-*.test.mjs
VEFK_TEST_IMAGE=/tam/yol/fotograf.png node apps/studio/tests/vefk-v3.browser.mjs
node apps/studio/src/vefk-motion-editor.browser.mjs artifacts/vefk-v3/motion-regression
# /tmp/vefk-v3-electron-* altında gerçek AI analizi içeren izole profil:
VEFK_ELECTRON_PROFILE=/tmp/vefk-v3-electron-... VEFK_TEST_IMAGE=/tam/yol/fotograf.png node apps/studio/tests/vefk-v3.electron.mjs
node apps/studio/verify-publication-v2.cjs
node apps/studio/verify-publication-v2-ui.cjs
npm --prefix channels/birdesengor/web run verify
```

V3 için eski UI'yi yaşatan migration, compatibility adapter veya paralel editör eklenmedi. Mevcut yerel test koleksiyonu zorunlu sıfırlanmadı. Kullanımdaki özgün fotoğraf ve hazırlanmış varyantı korunur; artık gereksiz dosyalar koleksiyon altındaki açık temizlik eylemiyle silinebilir.

### Sonuçlar

- Studio derlemesi: PASS. Vefk birim/IPC/SQLite/S6 sözleşme testleri: **299/299**. Son dosya temizliği kontrolü ayrıca 6/6 geçti.
- Chromium: hazırlık, inceleme, açık toplu karar, maske/izleme, kısmi SVG, geometri düzenleme, boş tuval, geri alma, bozuk SVG reddi, revizyon/katalog/silme ve referans bütünlüğü PASS.
- Electron: gerçek Codex CLI analizinden gelen 9 bölge + 25 hücre; gerçek preload/IPC, SQLite, tam yerel export, reload ve açık silme PASS. İnceleme kararları yalnız izole QA profilindedir.
- Hareket editörü: v1/v2, kalıcı eğriler, geri al/yinele, revizyon kilidi, yeniden açma ve kanonik divit/mürekkep PASS.
- Site: 159/159 birim testi ve derleme PASS; 14 Vefk tarayıcı senaryosu, kamera tarayıcı akışı ve publication v2 kontrolleri PASS.
- Genel web `verify` tamamen yeşil değildir: değiştirilmeyen `physical-books-e2e.mjs:89`, ara kapak ilerlemesini beklerken zaman aşımına uğrar. Ayrı tekrar aynı sonucu verdi. Bu Vefk görevi kapsamında kitap motoru veya testi değiştirilmedi.
- Güncel raporlar: `artifacts/vefk-v3/validation.json`, `browser-results.json`, `electron-results.json`, `GIT_STATUS.txt`; son yerel uygulama görünümü `local-electron-ready.png`.
- Mevcut yerel kaynak ve analiz geçmişi korunarak Electron kaynak incelemesinde açık bırakıldı (32 öğe bekliyor). Git `main`; hiçbir değişiklik stage edilmedi, commit/push/deploy yapılmadı.
