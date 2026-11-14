# Sahne Atölyesi V6 — Tek Merkezli Düzenleme Planı

**Durum:** V6.1 ilk UI toparlama uygulandı, diğer aşamalar planlandı.
**Tarih:** 14 Kasım 2026
**Kapsam:** Studio `apps/studio/src/SceneWorkshop.tsx`, `scene-workspace/`; site runtime ve efekt motoru sözleşmesi korunur.

## Sorun teşhisi
- Studio light/dark semantik tema değişkenlerine rağmen sahne düzenleyicisinin eski bağımsız koyu paleti kalmıştı.
- Üstteki birden çok göster/gizle düğmesi; sağdaki arka plan, nesne, efekt, odak ve dil sekmeleri; soldaki ağaç; gerçek web önizlemesi arasında kullanıcı sürekli bağlam değiştiriyor.
- Nesne, nesne resmi, tıklama kutusu ve efekt hedefi birbirinin üzerine binebiliyor. Etkin seçim katmanı ve doğrudan sürükleme davranışı açık bir araç modeline bağlı değil.
- `scene-editor.mjs` yaklaşık 2.6k satırda görsel, nesne, efekt, kamera/kadraj, seçim, history ve olayları bir arada barındırıyor.
- Kritik aralıkları belli birçok sayı alanı yalnız klavyeyle kullanılıyordu. Sağ panelde açıklamalar yönetim alanını tüketiyordu.

## Tasarım ilkesi
**Sol: Ne üzerinde çalışıyorum?  Merkez: Nerede ve nasıl görünüyor?  Sağ: Seçtiğim öğeye ne yapabilirim?**

**Üstte:** proje / kaydet / hazırla / onaylı yayın; ikinci satırda yalnız seçim, taşıma, görünür katmanlar, zoom, geri al-yinele ve duraklat. Yayınlama yanlışlıkla tetiklenemez. Studio'nun tek tema ve gezinme sistemi geçerlidir.

### V6.1 — İlk arayüz temizliği (uygulandı)
- Studio `--surface-*`, `--text-*`, `--border-*`, `--accent-*` semantik değişkenlerini kullan. Sahne fotoğrafı ve tematik görsel katmanlarının renklerini değiştirme.
- Genel katman görünürlüğünü açılır tek menüde topla: fotoğraf, plan, nesne, nesne sınırı, tıklama sınırı, efekt, hedef işaretleri.
- Temiz önizleme işaretleri yalnızca geçici gizler; önceki işaret durumlarını geri getirir ve sahne kaydına yazmaz.
- Sağ panelde sahne/genel ve seçilen öğe sekmelerini iki küçük grupta göster. Açıklamaları sağda kaldır; teknik alan ipuçlarını alanın üzerine gelince göster. Uyarıları gizleme.
- Aralıkları tanımlı sayılarda slider + hassas sayı girdisi; mouse wheel, Shift ile ince, Alt ile hızlı ayar. Değişikliği sürükleme bitince kaydet, her pikselde `draw` çalıştırma.
- İlgili tarayıcı regresyonlarını yeni katman menüsünü açarak kullanacak şekilde güncelle.

### V6.2 — Seçim ve işlem modeli (sonraki öncelik)
- Modlar: **Seç**, **Görseli taşı**, **Tıklama alanı**, **Efekt hedefi**, **Kadraj**. Aynı anda bir düzenleme modu aktif; diğer modların sürükleme yakalayıcıları pasif.
- Sahnenin üzerindeki objede sol tık = seç; sağ tık = yalnız o objeyle ilgili kısa menü. Örtüşen nesneler arasında seçmek için döngü / katman sırası / ağaçtan `Sahneye odaklan` işlevi.
- Sürükleme tutamaçları: köşeden boyut, merkezden taşı; Shift oran koru, ok tuşu ince hareket, Shift+ok daha büyük adım. Geometri saklanmadan önce mevcut validator'a gider.
- Görsel kutusu, hit area, asset kırpma ve efekt anchor alanlarını ayrı renk/stilde göster. Nesneyi seçince sağ panel ilgili bölümü açsın ve gerekli kılavuzu geçici görünür kılsın.
- Nesne kilidi, gizleme ve tek nesneye odaklanma: düzenleyiciye özel durum; sitedeki `visible` alanından ayrı. Yanlışlıkla canlı görünürlük değiştirmemeli.
- `scene-editor.mjs` içinden `selection/modes`, `inspector-controls`, `stage-overlays`, `viewport` modüllerini çıkar; `SceneWorkshop.tsx` proje/kayıt sahibi kalır.

### V6.3 — Sahne ve ekran merkezi
- Sağ özellik panelinde **Sahne** seçilince arka plan kaynağı, orijinal/aktif ölçü, görünür alan, kırpma, ekran profili ve karşılaştırma bir arada.
- Ekran seçicisi: oda doğal oranı, masaüstü, tablet, mobil, ultrawide; gerçek web görüntüsü ve geometrik önizleme açıkça ayrılır.
- Ekran dışı alanı üst/alt/sağ/sol px ve yüzde olarak göster; ana görselin kaymasını, boşluk oluşmasını saptamak kolaylaşsın.
- Dil anahtarı fiziksel sahne kontrolüdür; efekt nesnesine dönüştürme. Tek bir öğe gibi seçilip cihaz bazlı ayarlanır.
- BirDeSenGör'e özel adaptör kodu `scene-workshop-site.mjs` içinde kalır; yerel sahne ve yeni siteler çekirdek UI'yı paylaşır.

### V6.4 — Yayın güvenliği, temizlik ve son kabul
- Sadece önizleme işaretleri / geçici görünürlük / zoom sahne JSON'una yazılmaz.
- Kaydet, hazırla, ön kontrol ve açık onaylı yayın arasındaki sınırlar korunur. Yapılan çalışma siteye otomatik deploy edilmez.
- Her araç için Undo/Redo, masaüstü/mobil, 14 nesne/22 efekt, katman seçimi, görsel taşımak, hit area sürüklemek, gerçek web karşılaştırması regresyonu.
- Temel işleyiş doğrulanınca kullanılmayan eski DOM/CSS ve test harness parçaları kaldırılır; demo sahneleri temizlenebilir. **Onaylı gerçek içerik ve sitenin aktif varlıkları rastgele silinmez.**
- Son tur: açık/koyu tema karşılaştırması, 1366/1920 masaüstü yerleşimi, 390 mobil kadraj, uzun nesne listesi ve yüzlerce efekt senaryosu.

## Kabul koşulları
- Kullanıcı 2 tıklamadan fazla yapmadan bir nesnenin tıklama alanını ve sahne konumunu seçip düzenleyebilmeli.
- Tuval üzerinde tek satır temel araç, ikincil araçlar açılır menüde.
- Sağ panelde gereksiz açıklama ve yatay kaydırma yok.
- Sayısal alanların izinli sınırları, ince ayar ve Undo/Redo korunmalı.
- Studio tema değişikliği Sahne Atölyesi kontrol yüzeyine yansımalı; sahnenin fotoğrafını boyamamalı.
- `npm run build:studio`, `npm run verify:scene-workshop-ui`, `npm run verify:scene-workshop` ve ilgili görsel browser testleri geçmeli.

## Notlar
Önerilen modülerleşme mevcut `packages/effect-engine` sahipliğine dokunmadan Studio editöründe yapılmalı. 14 nesne ve 22 efekt yuvası kullanıcı deneyiminde düzenlenebilir olsa da motorun doğrulama sözleşmesini değiştirmek ayrı bir iş olmalıdır.

## V6.1 doğrulama sonucu — 14 Kasım 2026
- `npm run build:studio`: PASS (TypeScript ve Vite).
- `npm run verify:scene-workshop`: 18/18 PASS.
- `npm run verify:scene-workshop-ui`: 7 tarayıcı senaryosu PASS.
- Ek: `scene-v3-integrated.browser.mjs` tema/kaydırıcı/temiz görünüm testi PASS; `scene-markers.browser.mjs` ve `scene-focus-states.browser.mjs` PASS.
- `scene-foreground-art.browser.mjs`: kaynak `foundation` yerine kanonik `roomDevicePlacement`/kapalı kitap sunum verisi referans alınacak şekilde beklenti düzeltildi; bağımsız fiziksel görseller testi PASS.
- Canlı site, onaylı içerik, kayıtlı sahne taslağı ve veri deposu **değiştirilmedi**. Deploy, push ve git commit yapılmadı.

## V6.2 — Doğrudan sahne düzenleme (14 Kasım 2026)
**Uygulandı:**
- Birbirini dışlayan Seç (V), Görsel (G), Alan (A), Hedef (H) araçları. Mevcut oda/kitap/cihaz sürükleme kodu görsel aracı üzerinden korunur; seçme aracı sürükleyerek kayıt değiştirmez.
- Tıklama alanında seçili çerçeveyi taşıma, dört köşe tutamaçla boyutlandırma ve ok tuşlarıyla küçük konum ayarı. Seçili görselde de dört köşe tutamaç ve boyutlandırma.
- Shift+köşe sürükleme en-boy oranını korur; normalleştirilmiş sahne sınırları dışına çıkmaz. Düzenleme bitince tek history kaydı; Undo/Redo ve validator geçerlidir.
- Efekt hedeflerini sadece Hedef aracıyla sürükle. Diğer araçlarda işaretler tıklama alabilir ancak görsel/alan sürüklemesini engellemez; Alan ve Görsel araçlarında marker pointer yakalama kapalıdır.
- Sağ tık bağlamında Görseli düzenle / Tıklama alanını düzenle / Efekt hedeflerini düzenle, Tuvalde bul ve çakışan nesneler için alt katman seçimi.
- Önizleme-özel sürükleme kilidi ve yalnız seçilen nesneyi gösterme; JSON'a veya yayına yazılmaz. Proje yüklenince sıfırlanır.
- Sahne içi görsel kontrollerde yinelenen dönüş, katman ve boyut girişleri kaldırıldı.
- Editör modları ile normalize kutu hesapları ayrı saf `scene-editing.mjs` modülüne çıkarıldı.
- Regresyon: `scene-editing.test.mjs` ve `scene-edit-modes.browser.mjs`, devam eden standart verify komutlarına eklendi.

**Not:** Daha kapsamlı kod modülerleşmesi ile cihaz/kadraj merkezi V6.3/V6.4 aşamasında kalır. Bu turda sahne taslakları silinmedi, web yayın/deploy ve Git commit/push yapılmadı.

**V6.2 son kabul:**
- `npm run verify:scene-workshop-ui`: 8/8 tarayıcı senaryosu PASS.
- `npm run verify:scene-workshop`: 22/22 PASS.
- `npm run verify:effect-engine`: 63/63 PASS.
- `node apps/studio/tests/scene-v4-artwork.browser.mjs`: PASS.
- `npm run build:studio`: PASS.
- `git diff --check`: PASS.
- Testler nesne/dokunma alanı/hedef geometrisi, kaynaklar, taslak ayrımı, geri al/yinele, gerçek web kadrajı, dil anahtarı ve yerel sahne izolasyonunu kapsıyor.

## V6.3 — Merkezi ekran, kaynak ve gerçek web yönetimi (14 Kasım 2026)
**Uygulandı (Studio):**
- Ana çalışma alanında tek görünür **Sahne ekran profili** seçicisi: doğal oda (2:1), masaüstü 1920×1080, laptop 1366×768, ultra geniş 2560×1080, tablet 768×1024, telefon 390×844 ve özel çözünürlük.
- Yeni `scene-viewport-profiles.mjs` saf modülü mevcut `roomFrameGeometry` kontratını kullanarak ekrandaki oda alanını, dört kenardaki boşluğu ve ekran doluluk yüzdesini hesaplar. **Görselin kırpılması ile ekranın boş kalması farklı kavramlar:** fotoğrafın %100’ü korunur.
- Kaynak boyutu, etkin görsel, kadraj diyagramı, ekranın dört kenarındaki px boşluk, ekran doluluğu ve kaynak görünürlüğü sağdaki Sahne/Arka plan panelinde bir aradadır. Fotoğrafın değiştirilmesi/indirilmesi daraltılabilir kaynak bölümüne taşındı.
- Aynı panelde fotoğraf, fiziksel TR/EN dil anahtarı ve seçili odak nesnesi için gerçek web görüntüsüne hızlı geçişler vardır. Çalışma alanının merkezi çubuğunda da profil, boşluk özeti, dil anahtarı ve koşula bağlı gerçek web karşılaştırması görünür.
- Ekran profili seçimleri `presentationDevice` ve `controlDevice` değerlerini birlikte günceller. Dil anahtarı cihaz seçimi ve yakın görünüm cihaz seçimi de aynı profil uygulayıcısını kullanır. Başka bir cihaz seçiliyken eski önizlemenin kalması engellendi.
- Gerçek web görüntüsü yalnız seçili odak nesnesinin izole tarayıcı karşılaştırmasıdır; **bütün oda ekranı için gerçek bir tam sayfa ekran görüntüsü olduğu iddia edilmez.** Üretim sitesine yazılmaz, taslak değiştirmez.
- Önizleme profili, açıkladığı boşluklar, kaynak diyagramı ve TR/EN önizleme durumu site JSON'una kaydedilmez. Sahnenin resim, görünürlük, efekt ve yayınlama sözleşmeleri korunur.

**Kabul ölçütleri:**
- Merkezi profil ve Arka plan içi profil birbirini takip etmeli; dil anahtarı ve yakın görünüm cihazı eşlenmeli.
- Telefon ve ultra geniş görünüm için boşluklar gerçek 2:1 web kadrajıyla aynı olmalı; ekran doluluğu ile kaynağın görünürlüğü ayrı sunulmalı.
- Kaynak dosya içe/dışa aktarma, orijinale dönme, Undo/Redo ve gerçek web görüntüsü eski düzenle aynı doğrulamayla çalışmalı.
- V6.4 kod modülerleşmesi/eskimiş CSS temizliği ve erişilebilirlik ayrıntılarının son turu olarak kalıyor.

**V6.3 nihai doğrulama (14 Kasım 2026):**
- `npm run verify:scene-workshop-ui`: **8/8 PASS** (yeni ekran çubuğu ve senkronizasyon dahil).
- `npm run verify:scene-workshop`: **26/26 PASS** (dört ekran profili/özel boyut/letterbox saf model testleri dahil).
- `npm run verify:scene-runtime-preview`: **3/3 PASS** ve gerçek web görüntüleme tarayıcı testi PASS; taslak izolasyonu ve kapatma doğrulandı.
- `npm run build:studio`: PASS.
- `git diff --check`: PASS.
- Sahne verileri, gerçek görseller ve web yayınına dokunulmadı; commit, push, deploy yapılmadı.

## V6.4 — Mimari Temizlik ve Son Toparlama (14 Kasım 2026)
**Uygulama durumu: tamamlandı; yerel çalışma ağacında, deploy/commit yok.**

### Ayrıştırılmış Studio modülleri
- `scene-inspector-controls.mjs`: sayı alanı + kaydırıcı + fare tekerleği + hassas giriş; Boolean girişler. Editor state veya yayın koduna bağımlı değil.
- `scene-overlays.mjs`: Studio'ya özel kompozisyon kılavuzları ve efekt hedef işaretlerinin çizimi. Olayların gerçek veri mutasyonları ana denetleyiciye bırakıldı.
- `scene-viewport-layout.mjs`: gerçek web'in `roomFrameGeometry` sözleşmesini kullanan viewport yerleşimi ve merkezi ekran çubuğu; doğal 2:1 görseli kırpmıyor.
- `scene-appearance-inspector.mjs`: ton/aydınlatma kontrolleri; yalnız doğrulanmış `mutatePresentation` callback'ini kullanıyor.
- `scene-object-family-inspector.mjs`: nesne ailesi/varlık parçası, **mevcut ve planlanan ankrajlar** ve efekt durumunu okunur kompakt biçimde gösteriyor.
- Önceden çıkarılmış `scene-editing.mjs` (seçim-geometri) ve `scene-viewport-profiles.mjs` (cihaz profili ve boşluk hesapları) aynen kullanılıyor.
- Ana `scene-editor.mjs` ilk 2843 satırdan **2701 satıra** indi. Karmaşık yayın, gerçek web snapshot ve history sahipliği hâlâ tek denetleyicide; ileride bölünürse mutlaka davranış koruyan testlerle ayrıştırılmalı. Modül sayısını artırmak için gereksiz yeni katman eklenmedi.

### Stil ve kullanılabilirlik temizliği
- Studio'ya ait çalışma alanı, sahne araç başlığı, ağaç seçimi, menüler, girişler ve panel renkleri semantik `--surface-*`, `--text-*`, `--accent-*`, `--border-*` değişkenlerine bağlandı; eski koyu sabit kuralların aktif kontrol yüzeylerine etkisi azaltıldı.
- Eski bağımsız editörün artık kullanılmayan header/mark/sürüm/uyarı CSS kuralları kaldırıldı. V2 test ekranının kendi CSS'i korunuyor.
- Sahne fotoğrafı, bakır dil anahtarı, efekt işaretleri ve görsel tutamaçların sahne kimliği/renkleri değiştirilmedi.
- Nesne ailesi panelinde gereksiz açıklama blokları çıkarıldı, ancak kaynak/gövde/ankraj verileri korunuyor.
- Açık ve koyu tema için gerçek hesaplanan panel/çalışma başlığı renkleri, kaynak fotoğraf sabitliği, **1366/1920** masaüstü genişliklerinde yatay taşmama otomatik tarayıcı testine eklendi.

### Korunan sözleşmeler
- Yayın kaynakları, kayıtlı gerçek site sahnesi, SQLite ve onaylı TR/EN içerikler değiştirilmedi.
- Kaydet/Siteye hazırla/Ön kontrol/Canlı yayın sınırları ve elle yayınlama zorunluluğu korundu.
- Studio işaretleri, mod/katman görünümü, solo/gizle/kilit, zoom ve ekran simülasyonu site JSON'una yazılmaz.
- Efekt motoru, sahne projeksiyonu, gerçek web izole karşılaştırması, cihaz/dil geometri kontrolleri aynı veri sözleşmelerini kullanır.

### Kontrol notu
- Ayrıştırma sonrası V4 artwork, kompozisyon kılavuzu, efekti taşıma, yakın görünüm, arka plan kaynak yönetimi gibi odaklı tarayıcı testleri geçti.
- Son tam test ve derleme sonuçları bu bölümün sonuna ayrıca kaydedilir.

### V6.4 nihai kabul (14 Kasım 2026)
- `npm run verify:scene-workshop-ui` — **8/8 PASS**.
- `npm run verify:scene-workshop` — **26/26 PASS**.
- `npm run verify:effect-engine` — **63/63 PASS**.
- `npm run verify:scene-runtime-preview` — **3/3 PASS** ve gerçek web dialog/oturum/iptal tarayıcı testi PASS.
- Ek olarak `scene-markers.browser.mjs`, `scene-focus-states.browser.mjs`, `scene-v4-artwork.browser.mjs` ve arka plan akışı PASS.
- `npm run verify:workspace-design` — PASS.
- `npm run verify:fixed-viewport` — PASS.
- `npm run build:studio` — PASS; `git diff --check` — PASS.
- Ana editör modülü yaklaşık **2700 satıra** indirildi; UI/viewport/overlay/appearance/family sorumlulukları ayrı modüllerde.
- İçerik ve onaylı siteyi değiştirmeden, yalnız yerel Studio çalışma ağacında tamamlandı. Kayıt silme, commit, push, site deploy yapılmadı.

**Takip gerektiren nokta:** Sahne Atölyesi'nin gerçek kullanım sırasında nesnelerin üst üste gelmesi, uzun ayar listeleri, kalabalık efektler ve üretim ortamında yüksek DPI altındaki fare hassasiyeti son kullanıcı ince ayarında ayrıca gözlemlenebilir. Bunlar testlerin otomatik olarak kanıtlayabileceğinin dışındaki ergonomi ayrıntılarıdır; yeni bir mimari açılım gerektirmediği sürece ayrı bakım düzeltmeleri olarak ele alınabilir.


## V6.5 — Fiziksel cihaz alanlarının entegrasyonu (14 Kasım 2026)

**Yerel uygulama tamamlandı; site yayını ve Git commit/push yapılmadı.**

- Kullanıcı eski oda pozisyon kalibrasyonlarını korumayı zorunlu tutmadı. Ayrı geçiş/migration veya çoğaltılmış konum kaydı oluşturulmadı. Mevcut fiziksel oda konumu (presentation.objects[id].roomPlacement) Kamera ve Çizim Atölyesi'nin merkezi yerleşim kaynağıdır.
- Studio fiziksel görseli, nesne sınırını, tıklama alanını ve efekt hedeflerini tek normalize oda dönüşümünden türetir (scene-room-geometry.mjs). Eski pose ve hitArea web/efekt sözleşmesinin normalize referans koordinatları olarak kalır; kullanıcı bunları ikinci kez hizalamaz.
- Görsel aracı fiziksel cihazı sürükleyip ölçekler; nesne sınırı otomatik takip eder. Alan aracı, taşınmış hit kutusunu ayrıca düzenler; ters dönüşüm kaynak veriyi kaydeder. Efekt hedefi aynı dönüşümle gösterilir ve sürükleme native ofset birimlerine çevrilir.
- Katmanlar / Nesneler kapatıldığında fiziksel görsellerle birlikte eski soyut nesne/animasyon/canvas katmanları da kaybolur. Nesne alanı, Tıklama alanı ve Hedef kılavuzları ayrı tutulur. Düğmeler yalnız Studio önizlemesini etkiler; soldaki ağaç göz simgesi gerçek yayın görünürlüğünü yönetir.
- Katman kontrollerinin hover açıklamaları yenilendi. Site verisi, yayın durumları, efekt sayıları ve varlıklar değiştirilmedi.
- Test: scene-room-geometry.test.mjs Kamera+Çizim Atölyesi dönüşüm/ters dönüşüm; scene-room-device-placement.browser.mjs görsel/kutu hizası, siteyle aynı tıklama kutusu, Alan ve Hedef sürükleme, Undo, geçici katman gizleme ve taslak veri izolasyonu.
- V6.5 test turu: Studio 28/28, tarayıcı 8/8, efekt motoru 63/63, build:studio PASS. Son efekt sürükleme değişikliği ayrıca bağımsız tarayıcı testinden geçti.

## V6.6 — Görsel optimizasyon adaptörü ve mevcut sahne medyası (14 Kasım 2026)

Yerel uygulama; canlı deploy / Git commit / push yapılmadı.

- Sahne Atölyesi görsel yüklemeleri tek scene-image-optimizer.mjs hattına bağlandı: yeni görsel nesne, görselin hareketli katmanı, fiziksel nesne/kitap kaynak değişimi ve 2:1 oda arka planı. PNG/JPEG/WebP kabul edilir, WebP çıktı üretilir; saydamlık kanalı korunur.
- Sağ Kaynak görsel / Arka plan bölümünde Dengeli, Detay koruma, Daha küçük dosya profilleri, isteğe bağlı en uzun kenar ve WebP kalite seçicisi, ayrıca yükleme sonrası gerçek dosya boyutları/çözünürlük bilgisi vardır. Küçük veya zaten iyi optimize edilmiş WebP yeniden sıkıştırılmaz; kaliteli yeniden kodlama en az %10-12 tasarruf sağlamazsa dosya korunur.
- Kapalı kitap görselleri 1536×1024 ve 3:2, oda arka planı 2:1 kuralını korur. Varsayılan ayrıntı profili kitap, kaftan, silah, kamera, Çizim Atölyesi ve taş kimliği için yüksek kalite kullanır. Orijinal dosyalar kullanıcı yükleme kaynağında değiştirilmez.
- Mevcut WebP medyası boyut ve içerik açısından tarandı. Yalnız en az %20 tasarruf ve saydamlık birebir eşitliği sağlayan altı varlık Q96 kalitesiyle yeniden kodlandı. Ölçü ve alfa değerleri piksel piksel korundu, örnek öncesi/sonrası kompozisyonlar görsel olarak karşılaştırıldı.
- Değişen varlıklar: evren-master-closed.webp (1500→554 KiB), evren-master-closed-en.webp (1963→746), topluluk-master-closed.webp (1286→474), topluluk-master-closed-en.webp (1817→691), books/community-welcome-tree.webp (1112→715) ve vefk/chassis-tabletop.webp (705→294). Toplam yaklaşık 8584→3557 KB; 5.027.026 bayt tasarruf. Diğer görsellerde anlamlı kazanç olmadığı veya mevcut kalite yeterli olduğu için değişiklik yapılmadı.
- Kaynak görsellerin dosya adları, efektlerin malzeme yolları, nesne koordinatları ve CSS katmanları değişmedi. Mevcut içerik-hashli URL yayını, dosya byte'ı değiştiği için yeni tarayıcı önbellek anahtarı üretecek.
- Doğrulama: Profil/ölçü koruma ve tekrar kodlamama birim testleri; gerçek tarayıcıda sentetik saydam PNG→WebP ve Studio kaynak paneli/dışa aktar/Undo kabulü; Studio/web tam testleri ve build/verify:dist kontrolleri.


## V6.7 — TR/EN kapak görsellerinin bağımsız sürümlenmesi (14 Kasım 2026)

- Canlı semptom: ?lang=en içeriği İngilizceye geçirirken Evren ve Topluluk kitabının kapak yazıları Türkçe kalıyordu.
- Kök neden: coverSource() gelen Türkçe URL'nin .webp sonunu -en.webp ile değiştiriyordu. V4.12 içerik-odaklı URL önbelleği ?v=TR-hash eklediğinden regex artık eşleşmiyor ve İngilizce katman da aynı Türkçe dosyayı kullanıyordu.
- Çözüm: locale.js içinde iki İngilizce kaynak açık literal olarak tanımlandı. TR/EN dosyaları derlemede birbirlerinden bağımsız SHA-256 kaynak kimlikleri alıyor; kaynak seçimi Türkçe URL'den hash türetmiyor. Kapak geometrisi/efekt/klip değişmedi.
- Yayın ön kontrolü dört kaynak dosyanın (Evren TR/EN, Topluluk TR/EN) ayrı ayrı hashli olarak üretim paketinde bulunmasını zorunlu kılıyor. Yeni bir dil dosyasının yanlışlıkla atlanması artık yayını durdurur.
- Testler: kaynak seçimi cover-source-versioning.test.mjs, gerçek Vite TR→EN→TR geçişi masaüstü/mobil (v48-cover-switch-e2e.mjs), PHP girişli üretim derlemesinde bağımsız hashler, görsel yükleme, doğrudan İngilizce URL ve Türkçeye dönüş (scene-asset-cache-php-e2e.mjs).
- Kod yerelde düzeltildi. Mevcut yayındaki site henüz güncellenmedi; kullanıcı Yayın Atölyesi üzerinden canlı yayına aldığında eski cache kullanmadan iki dil kapağı ayrı adresten alınır.


## V6.8 — Evren ayraç, Topluluk görseli, mum oda ışığı ve temiz yayın (14 Kasım 2026)

- Evren kitabında içindekiler ilk sayfasındaki kalıcı yeşil ayraç yazının üstünü kapatmıyor: ilk yaprakta yalnız kitabın altından çıkan uç görünür; sonraki sayfalarda standart dar uç sürer, tüm dönüş bağlantıları korunur.
- Topluluk resim ekleri kitap kağıdına bağlı daha küçük iki bantlı fotoğraflar olarak görünür. Görsel eklerde dosya adı ve KB satırları kaldırıldı; görsel olmayan dosyaların isim ve indirme bağlantıları korundu. Fotoğrafa dokunulduğunda gerçek görüntü, bant olmadan karanlık çevreli yakın önizlemede açılır. Önizleme sayfa animasyonu ve mobil yeniden yerleşimden bağımsız native dialog üzerinde yaşar; Escape, kapat düğmesi ve dış alana tıklama ile kapanır.
- Mum yandığında yalnız sol mum çevresindeki masa, kitaplık ve bakır yansımaları sıcak amber oda ışığı alır. Sağdaki ayışığı soğuk kalır; mum sönünce ışık opaklığı tekrar 0 olur. Hareket azaltma tercihinde geçiş animasyonu kaldırılır. Yeni tıklama katmanı yoktur.
- Test: journal-contents-e2e üç ekranda, community-taped-images-e2e masaüstü/mobil, candle-room-light-e2e masaüstü/mobil, PHP girişli üretim paketi ve TR/EN kapak sürümü; web birim testleri ve Studio/efekt motoru testleri.
- Temiz deploy, deploy-natro.mjs --deploy --prune-managed-assets ile yalnız siteye ait yönetilen assets/, scene-assets/ ve eski V1 scene/ kaynaklarını eşler; content/, Topluluk veritabanı, üyelikler, yüklenen dosyalar, yayın içerikleri ve API veri dizinleri için silme bayrağı kullanılmaz. İlk önce --dry-run ile uzaktaki hedef doğrulandı.
