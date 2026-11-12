# BirDeSenGör — nesne efektleri çalışma notu (12.11.2026)

## 12 Kasım — Arşiv Sandığı: kapak aralanması ve kehribar ışığı (yerel)

- Orijinal kaynaklar assets/birdesengor/source/2026-11-12/ altına arşivlendi. Narrowed Hanger in the Arcane Study.png de aynı milestoneun son oda arka planı kaynağıdır.

- Kaynak: assets/birdesengor/source/2026-11-12/ dizinindeki dört kullanıcı PNG dosyası `ChatGPT Image Nov 12, 2026, 08_22_45 PM-1.png` (referans/kapalı sandık), `...46 PM-2.png` (gövde), `...47 PM-3.png` (kapak), `...48 PM-4.png` (ışık). Orijinaller korunur. Gövde, kapak ve ışık aynı 768×768 sahne alanına hizalandı; `public/scene-assets/chest/` altında sırasıyla 121 KB, 85 KB, 49 KB WebP üretildi. Gövde ve kapak kaydedilmeden önce birleşim kontrol edildi; kapalı durumda uyumlu.
- Site `archive-chest` nesnesini bağımsız `lid` hareket katmanı ve sabit gövdeyle çiziyor. Başlangıç pozisyonu x=.84 y=.38 w=.16 h=.34; malzeme %150 genişlikte, sağ dış kenarı kadraj dışında kalıyor. Kesin yerleşim Studio Görsel Taşı ile yapılacak.
- Ortak motorun iki sonlu ve eş zamanlı pulse efekti `chest-lid-open` ve `chest-light-leak`: kapak başlangıç/yaylanma/bekleme/kapanma, içeriden sıcak amber çizgi + küçük halo. Tıklamadan önce Canvas üretmiyor; azaltılmış harekette çalıştırmıyor. Kapak yalnız atanmış `lid` motion layer üzerinden tilt/lift alıyor, diğer motion tipleri korunuyor.
- Studio'da **Sandık aralanması** ile açılma açısı, yükselme, süre, hız, bekleme payı; **İçeriden ışık** ile şiddet, yayılım ve zamanlama düzenlenebiliyor. İki türün de Hafif/Doğal/Belirgin profilleri var. Yeni sahne görselleri ve ışık maskesi aynı kaynak hash doğrulamasında kapsanıyor. Kaydet → Siteye hazırla tek authored JSON'a yazar.
- Mobilde sandık tıklama alanı tütsülük alanını kesiyordu; sandık hedefi görünür kapağın daha üst kısmına taşındı (x=.865 y=.375 w=.127 h=.12). Tütsü nesnesine veya görseline dokunulmadı; mobilde gerçek kullanıcı tıklamasıyla sandık tetiklenmesi doğrulandı.
- Kabul (son test turu): Efekt motoru **56/56**, web **259/259**, Studio sahne servisi **5/5**, iki üretim derlemesi başarılı. Studio Chromium önizleme/yerleşim/staging ile web masaüstü/mobil/reduced-motion sandık kabulü geçti. Diğer nesnelerin tarayıcı regresyonları ayrıca çalıştırıldı.
- **Canlı deploy ve Git commit/push yapılmadı.** İnce konum ayarları en son Studio'da yapılacak.

## 12 Kasım — Tören Hançeri: karanlık yansıma (yerel)

- Yeni görsel üretimi gerekmiyor: kaynak arşivindeki `ceremonial-dagger.webp` ve webde önceden mevcut `p8/ceremonial-dagger.webp` aynıdır. Hançer artık sahnede ayrı şeffaf `blade` malzeme katmanı. Arka plan V4 değişmedi.
- `public/scene-assets/dagger/dagger-blade-mask.webp`: orijinal hançer alfa kanalından ve bıçak geometrisinden oluşturulmuş yumuşak maske. `transparent-fixed.webp` şeffaf taban dosyası. Maske, yansımayı metal yüzeyine hapsediyor.
- Ortak motor yeni `dagger-shadow` / **Yabancı yansıma**: yüzü belli olmayan karanlık yansıma ve çok hafif soğuk kenar ışığı, tek dokunuşla yaklaşık 1,9 sn geçiş. Süre bitince katman kalkar, boşta animasyon/ticker yok. Azaltılmış harekette animasyon başlamaz.
- Studio ve site aynı authored efekt yuvasını kullanıyor: `ceremonial-dagger-shadow`; Hafif / Doğal / Belirgin ve şiddet, süre, hız, siluet genişliği parametreleri. Studio `Efekti dene` görüntüsü maske verisiyle doğrulanır. Hançer için bağımsız görsel X/Y/ölçek/sürükleme açıldı; diğer nesneler kilitli kaldı.
- Konum hassas ayarına girilmedi. Hançer başlangıç pose'u önceki authored kayıttan aynen korundu, yalnız tıklama çerçevesi kitaplarla çakışmayacak şekilde daraltıldı.
- Stage servisi bıçak maskesini de source hash ve önizleme paketine dahil ediyor; tek kalıcı yazma authored JSON. **Git commit/push ve canlı deploy yapılmadı.**
- Kabul: ortak motor 55/55, web 259/259, Studio 5/5, her iki üretim derlemesi başarılı; yeni hançer mobil, masaüstü, reduced-motion tarayıcı testleri geçti. Studio maskeli önizleme/yerleşim ve izole site hazırlama geçti. Kılıç, bakır tas, taş, kaftan regresyonları da geçti.

## 12 Kasım — kaftan: kalıcı görünmezlik ve askı uyumu (yerel)

- Kaynak: kaynak arşivindeki `Antique Gold-Embroidered Fur-Trimmed Kaftan.png` (1024×1536, gerçek alfa şeffaflığı). Optimize edilmiş şeffaf WebP `public/scene-assets/robe/ceremonial-kaftan.webp` (~158 KB). Kaynak görsele dokunulmadı.
- Kaftan artık ayrı `fabric` görsel katmanı. Metal askı yeni oda fotoğrafında sabit. Katman başlangıçta askı altına yerleşir ve masa üst sınırında (%57 sahne Y) kırpılır. Nesne Studio'dan X/Y/ölçek ile hareket ettirilebilir; tıklama alanı da isteğe bağlı birlikte taşınabilir.
- `RobeVeil.jsx`: tıklamayla görünür/görünmez durum değişir, ikinci tıklamaya kadar korunur; tarayıcı oturumu boyunca `sessionStorage` ile yenilemede de korunur. Görünmez durumda yalnız düşük opaklıklı kumaş izi, kaftan alfa maskesine sınırlanmış tek seferlik duvar kırılması ve siluet kenarı kalır. Sürekli ticker/canvas animasyonu yok. Azaltılmış hareket tercihinde geçiş süresi sıfır.
- `packages/effect-engine/src/runtime/robe-refraction.mjs`: yalnız geçişte fotoğraftan uyumlu arka plan şeritleriyle kaftan maskeli kırılma çizer. Her durum için yeni 3D/görsel motoru yok.
- Kaftan durumu bağımsız `veil` sahne nesnesi ayarıdır; durumu kalıcı pulse efektine zorla sokmadık. Düzenlenebilir parametreler: etkin, geçiş ms, kalan kumaş izi, kırılma px, kenar opaklığı. Canonical JSON modeli ve site doğrulaması bu parametreleri doğrular.
- Studio: Kaftan için Görsel Yerleşimi ve ayrı Görünmezlik bölümü; “Görünmezliği dene” önizleme düğmesi yalnız önizlemede etkiler, görünmez durumda kayda yazılmaz. Gerçek parametreler `Kaydet → Siteye hazırla` ile tek authored dosyaya alınır.
- Yeni tür veya ek hover/pulse efekti üretilmedi. Önceki efekt slotları ve diğer 13 nesnenin hareket ve bağlantı kimlikleri korunur. Canlı yayın/commit/push yok.
- Tarayıcı kabulü: 1600×900 masaüstü, 390×844 mobil normal ve reduced-motion; görünür→görünmez→sayfa yenileme→görünür, masada kırpma, siluet piksel testi ve Studio kaydı geçti.

## 12 Kasım — üçüncü tur: Studio görsel yerleşimi ve yakınlaştırma (yerel)

- Terminal bağlantısı Ghost üzerinden doğrulandı; Studio kapalıyken geliştirildi.
- **Görsel Taşı** modu: şimdilik yalnız bağımsız `stone-specimen / rock` görseli fareyle sürüklenebiliyor. Klavye yön tuşları 0,1%, Shift+yön 1% hassas hareket sağlıyor.
- Sağda Görsel Yerleşimi: Sol X, Üst Y, en-boy oranı koruyan %30–250 ölçek, bağlı efekt/tıklama alanını birlikte taşıma, Y için ±0,1% ve sıfırlama.
- Üstte önizleme yakınlaştırması %50–300, ±%25, %100'e dönüş ve Ctrl/⌘+fare tekeri. Yalnız sahne önizleme boyutunu etkiler, kaynak koordinatları veya kayıt dosyası bozulmaz.
- Sadece taşın pose'u site kaynağından düzenlenebilir; diğer 13 nesnenin kimlikleri, pozları, anchor yapısı ve efekt yuvaları kilitli kalır. Studio ve canlı webin okuduğu tek kayıt `birdesengor-effects.v2.json` içindeki taş pose'udur. Çok dosyalı yazma işlemi yapılmadı.
- Varsayılan taş görseli 1,5 yüzde puanı aşağı taşındı (`pose.y=.474`, `hitArea.y=.474`). Manifest sabit fotoğrafı temsil ediyor; görsel pozunun kaydı artık authored JSON'da.
- İzole kaynak kopyasında `site.stage()` ile görsel pose kaydı, kaynak hash doğrulaması ve diğer nesnelere dokunmama kontrol edildi.
- Regresyonlar: efekt motoru 53/53, Studio servis 5/5, web 259/259, Studio üretim derlemesi ve web üretim derlemesi geçti. Chromium: zoom, görsel sürükleme, bağlı/bağımsız tıklama-efekt hedefi, ölçek, sıfırlama, sarı işaretler ve gerçek web taş yerleşimi/damla/titreşim geçti.
- **Canlı yayın, Git commit/push yapılmadı.** Studio yeniden açıldığında yeni kontrol hazır.

## 12 Kasım — ikinci tur: yeni oda ve yeşim taşı (yerel, yayına çıkmadı)

- Yeni kaynak fotoğraf: proje kökündeki `Moody Fantasy Study with Darkened Swords.png` (1670×942, 16:9). Üstteki askıyı ve masayı mümkün olduğunca koruyarak altından 55 piksel kırpıldı, 1774×887 WebP üretildi: `channels/birdesengor/web/public/scene-assets/approved/room-effects-v3-2to1.webp` (~291 KB). Eski `room-natural-sash-2to1.webp` dosyasına dokunulmadı. Studio önizleme kaynağı ve web sahnesi aynı V3 dosyasını gösteriyor.
- Taş: kaynak arşivindeki `Faceted Green Jade Rock Cutout.png` ile `public/scene-assets/stone/jade-rock.webp` (512×512, ~59 KB) üretildi. Bakır kaide arka planda sabit; bağımsız taş görüntüsü `rock` hareket katmanına bağlı. Vitrin konumu yaklaşık `.245, .459`, ince ayarı Studio'da kullanıcı yapacak.
- `stone-drop` damla Canvas'ı ve yeni `stone-tremor` fiziksel hareketi aynı tıklamayla tetikleniyor. Titreşim damlanın temasından önce başlamıyor, bitince sıfırlanıyor. Studio'da iki ayrı profil ve parametre grubu var. Azaltılmış harekette çizim/titreşim oluşmuyor.
- Web birim testleri 258/258, efekt motoru 52/52, Studio servis 5/5; Web + Studio üretim derlemeleri ve taş/işaretler tarayıcı testleri geçti. Mevcut pulse/hover efektleri masaüstü, mobil ve azaltılmış hareket regresyonlarından geçti.
- Kalanlar: Studio'da hassas efekt yerleşimleri; sandık kapak/ışık, hançer yansıması, kaftan mercek görünmezliği. **Git commit/push ve canlı deploy yapılmadı.**

## Birinci tur (yerel çalışma ağacı; canlı yayın yok)

- Studio üst çubuk: **İşaretler** düğmesi, efekt hedef numaralarını geçici olarak gizler. Bu görünüm değişikliği sahne JSON'unu kirletmez, efektleri durdurmaz ve nesne değişiminde korunur.
- Kanonik `stone-drop` efekt türü: bir damla, ıslak temas izi, iki küçük halka ve kısa titreşim izleri; Hafif / Doğal / Belirgin profilleri ve düzenlenebilir parametreler.
- Site yuvası `stone-specimen-drop`: yalnız tıklama üzerine, süreli kanonik Canvas; işaretleri kapalı nesnelere otomatik tıklama alanı üretmez.
- Taşın **gerçek görselinin sallanması bu turda henüz yok**. İlk katman yalnız damlayı ve titreşim izlerini çizer. Fiziksel hareket için şeffaf taş görseli ve temiz arka plan gerekecek.
- Performans: Effect dururken kalıcı Canvas/ticker istemiyor. reduced-motion tercihinde yeni çizim başlamıyor.
- Studio / site / motorun sahiplik ve yayın doğrulama sınırları değiştirilmedi.

## Kullanıcıdan istenecek varlıklar

Hepsi orijinal **1774×887** `public/scene-assets/approved/room-natural-sash-2to1.webp` sahnesiyle aynı açı, ışık ve perspektifte olmalı. Orijinali değiştirme.

1. `room-effects-base.webp`: aynı 1774×887 oda; yalnız kaftan, sandık, hançer ve taş kaldırılmış; arka plan gerçekçi biçimde tamamlanmış. Diğer piksel alanları mümkünse tamamen aynı.
2. `stone-specimen.webp`: fotoğraftaki taşın şeffaf kesiti; gerçek dış görünümü, perspektifi, formu korunacak.
3. `chest-body.webp` ve `chest-lid.webp`: mevcut `public/scene-assets/p8/archive-chest-v2.webp` nesnesinin gövde ve kapağı. Aynı tuval koordinatlarına yerleştirilmiş şeffaf WebP katmanları; kapak mafsal sınırı dikkatli.
4. Kaftanın `p8/ceremonial-robe.webp` ve hançerin `p8/ceremonial-dagger.webp` kesitleri zaten mevcut; ilk turda yenileri gerekmiyor.

İlk gerekli paket: temiz oda ve şeffaf taş. Geri kalan katmanlar ikinci aşamada alınabilir.

## İleri turlar

- **Taş V2:** damla/temas efektinden sonra şeffaf taş görüntüsünün küçük, sönümlü fiziksel sarsılması. Mevcut fotoğrafta baked-in taş bırakılmayacak.
- **Hançer:** insanı andıran karanlık figürün yalnız dar parlak bıçak yüzeyinde ve perspektifle bozulmuş yansıması; görünür figür/kapı/sahne nesnesi üretilmeyecek. Kanonik süreli efekt ve metal yüzey maskesi.
- **Sandık:** kapak katmanı 2–5 derece aralanıp kapanırken çok dar amber sızıntı ışığı; kapak arkasındaki iç hacim açık gösterilmeyecek.
- **Kaftan:** tıklama ile kalıcı görünmez/görünür durum (ikinci tıklamaya kadar); kumaş silueti içerisinde düşük genlikli lens/bükülme etkisi, çevre odanın perspektifi aynı. Durum yönetimi efekt motorunun kısa pulse davranışından ayrı tutulacak.
- Yeni efektlerin hepsi kanonik kayıtta ve Studio'da profil/parametrelerle düzenlenebilir olmalı. Son turda tüm objeler ayrı ayrı aktifleştirilerek ölçüm yapılacak; erkenden performans gerekçesiyle tür iptal edilmez.

## Kabul testleri (ilk tur)

- `npm run verify:effect-engine` — 51/51
- `npm run verify:scene-workshop` — 5/5
- `cd channels/birdesengor/web && npm test` — 258/258
- Studio ve web Vite üretim derlemesi — başarılı
- `node apps/studio/tests/scene-markers.browser.mjs` — işaretler aç/kapat, yeniden çizim, efektler etkilenmiyor
- `node channels/birdesengor/web/tests/stone-drop-e2e.mjs` — damla görünür, bitince yok, reduced-motion
- `node channels/birdesengor/web/tests/pulse-effects-e2e.mjs` — 4 görünüm / mevcut efekt regresyonu
- `HOVER_REVIEW_ORIGIN=<vite adresi> node channels/birdesengor/web/tests/hover-effects-e2e.mjs` — 4 görünüm

**Yayın / deploy:** yapılmadı. Önce Studio ve gerçek web sahnesinde görsel kabul.
