# BirDeSenGör — Sahne V4 · Tek Master Kompozisyon Sözleşmesi

Karar: 13 Kasım 2026. Eski/yeni sahne geçişi, karşılaştırma düğmesi, iki ayrı konum kaydı veya geçmiş oda görselini koruma gereksinimi yoktur. Sahnenin tek kaynağı yeni soğuk/berrak 1774 × 887 (2:1) WebP master görselidir.

## Tek kaynak sözleşmesi
- Ana oda: channels/birdesengor/web/public/scene-assets/approved/room-effects-v4-2to1.webp
- Studio scene-workshop-site.mjs aynı dosyayı ROOM_BACKGROUND_ASSET ile okur; Fotoğraf ve Arka plan ayarları bu master üzerinde çalışır.
- Web SceneRoot.jsx aynı tek kaynağı çalışma odasında ve masa kenarı maskesinde kullanır. scenePreview query anahtarı, eski sahne anahtarı ve iki resim üst üste bindirme düzeni kaldırıldı.
- Ana kompozisyonun yerleşim kılavuzu yalnız Studio Plan düğmesindedir; gerçek sayfa/efekt/veri koordinatları ile karışmaz.
- Her objenin bir gerçek pozisyonu kanonik birdesengor-effects.v2.json içindeki objects[].pose kaydıdır. Efekt ankrajı, görünür malzeme ve tıklama alanı bu pozisyondan birlikte hesaplanır.
- İlk bağımsızlaşan üç kaynak: water-basin, guardian-sword-left, guardian-sword-right. Web hepsini gerçek görsel katmanı olarak çizer; Studio Taşı ve Konum ve boyut kontrollerinden hareket ettirir. Üçü için paralel v4Materials kaydı tutulmaz.
- Diğer bağımsız kaynaklarda var olan efekt, kaftan görünmezliği, kapanıp açılan kitap, kamera ve Çizim Atölyesi bileşenleri korunur. Eski odanın demirbaşları ve sahne koordinatları referans zorunluluğu değildir.

## Görsel yön
- Soğuk, berrak, düşük genel ışık; solda hafif sıcak fener, sağdan soğuk ay ışığı.
- Tek masa düzlemi, ortak perspektif, fiziksel temas gölgeleri, temiz kenarlar ve gözle hissedilen ağırlık.
- Görsel üretim, yalnız efekti değil gövdenin malzemesini, kırpmasını, maskesini, gölgesini de kapsar.
- Sönük başlangıç: ortam animasyonları varsayılan pasif, kullanıcı tetiklemesine bağlı hareketler tutarlı.

## Görsel kimliği korunacaklar
1. Kaftanın kumaş rengi ve kuşak formu: /scene-assets/robe/ceremonial-kaftan.webp
2. Yeşil taşın doğal rengi ve dış hattı: /scene-assets/stone/jade-rock.webp
3. Tören hançerinin şekli ve deseni: /scene-assets/p8/ceremonial-dagger.webp
4. Tütsülüğün özgün görsel kimliği (yeni bağımsız kesim için referans).
5. Metal sarkacın gövdesi ve hareketli parçalarının formu.

Bu beş nesnenin ışık/ton/gölge düzeltmesi serbest, tanımlayıcı biçimleri değişmemelidir. Geriye kalan nesne, duvar, raf, pencere, kitap kapağı, masaüstü çizim cihazı ve dekor yeniden yapılabilir.

## Fiziksel obje ilkeleri
- Oda masterında yalnız mekân: duvar, kitaplık, pencere, masa, tek askılık gibi değişmeyen mimari parçalar.
- Bağımsız nesneler: kitaplar, kaftan, kamera, Çizim Atölyesi, sandık, taş-altlık-damlalık sistemi, hançer, metal sarkaç, mum, tütsü, bakır su tası, sol/sağ kılıçlar.
- Kaftan kaybolunca kumaş dışında duvar ve sabit askılık bozulmaz.
- Sandık kapağı sabit arka menteşe etrafında döner; ön kenar yükselir, iç ışık yalnız kapak açılınca görünür.
- Taşın su damlası için görünür fiziksel çıkış, damla yolu ve taş üzeri çarpma noktası gerekir.
- Vefk/Çizim Atölyesi alçak, masaya oturan ayaksız şasi olarak yenilenecek.
- Kamera LCD son bölüm afişinin kadraj, parlaklık ve yakınlaştırması Studio Görünüm içinden yönetilir.
- Evren kitabı koyu kapak alacak; kapağın çizgilerini dolaşan hafif tılsım ışığı hover/focus ile tetiklenecek, reduced-motion desteği olacak.
- Mum, tütsü, taş altlığı ve damlalık ayrı fiziksel kaynaklara dönüştürüldü. Bakır damlalık ilk tasarım olarak gerçek efekt sistemine bağlandı.

## Takip sırası
1. Üç hazır WebP obje: yeni master üzerinde Studio ile konum/ölçek, efekt ve hit alanını kalibre et.
2. Mum, tütsü, bakır su yüzeyi, taş altlığı ve damlalık için aynı ışık/perspektif altında kesilmiş kaynak üret.
3. Kaftan ve askılığın görünmezlik sınırını kontrol et; korunan beş nesneyi fiziksel malzemeyle eşleştir.
4. Sandık gövdesi/kapak/iç ışık maskesini ve Çizim Atölyesi'nin ayaksız şasisini yenile.
5. Dil anahtarı yuvasını ve ana kitap kapaklarını sahneyle uyumlu hale getir; tılsım efektini ekle.
6. Masaüstü/mobil, TR/EN, reduced-motion, tıklama, odak, efekt/perf ve yayın hazırlığı testleri.
7. Görsel ve animasyonlar birlikte onaylandıktan sonra ayrı stage/deploy/push.

## Yayın sınırı
Bu çalışma yerel kaynakları günceller; siteye deploy veya Git push yapılmadı. Studio kaydet/yayınlama güvenlik akışı geçerli; kitap ve topluluk içerikleri değiştirilmez.

## V4.4 — Fiziksel objeler
- Orijinal mum/oyma tütsü biçimleri arşiv fotoğrafından kesilip bağımsız WebP olarak bağlandı.
- Taş korunarak bakır altlık, ayrı bakır kol, kaynak çıkışı ve çarpma ankrajı kuruldu.
- Metal kolun foto-gerçekçi doku ince ayarı sonraki kompozisyon aşamasında geliştirilebilir.
- 14 nesne, 22 efekt tanımı; Studio ve web tek master. Yerel değişiklik; yayın yok.


## V4.5 — Işık ortaklığı ve temas gölgeleri (yerel)

Kaynak: packages/effect-engine/src/model/material-grounding.mjs

- Fiziksel masaya temas etmesi gereken altı nesnenin (candle, stone-specimen, incense-holder, water-basin, metal-pendulum, ceremonial-dagger) gölgesi nesneye göre normalize edilmiş koordinatlarla hesaplanır. Sahne görseline veya geçici piksel pozisyonlarına gölge işlenmez; nesne Studio'da taşındığında gölge de taşınır. Tıklama olaylarını engellemez.
- Studio'nun gerçek oda önizlemesi artık webdeki soğuk renk katkısı ve kenar karartmasını da kullanır. Kitap, kamera ve çizim cihazı webde olduğu gibi atmosfer katmanının üzerinde çizilir; efekt işaretleri ve yerleşim planları okunur kalır.
- Studio'nun görsel malzeme parlaklık/doygunluk hesaplamaları webde kullanılan fotoğraf malzemeleriyle eşlendi. Kitap ve kamera kaynaklarına ayrıca materialBrightness faktörü uygulanır.
- Metal sarkacın gövde kimliği sabit, sadece merkez pozisyonu ve tıklama alanı birlikte 0.018 sahne birimi indirildi. Amaç masa arkasıyla fiziksel temas.
- Kaftanın kumaş/kuşak formu, taş, hançer, tütsülük ve sarkacın ana şekli değiştirilmedi.
- Bu turda kırpma, fiziksel SVG/WebP kaynağı üretimi, gerçek oda fotoğrafını yeniden boyama veya video/kitap içeriği değişikliği yapılmadı.
- Sonraki görsel ince ayar: Çizim Atölyesi'nin masaüstü ayaksız gövdesi, kameranın LCD afişi, sağ duvar sandığı ile pencere ilişkisi ve kaftan duvar temas sınırı.
- Deploy / yayın / Git push yok. Bu değişiklikler yeni masterın tek yerel taslağında.


## V4.6 — Çizim Atölyesi alçak masaüstü şasisi

- Tek kaynak: channels/birdesengor/web/public/scene-assets/vefk/chassis-tabletop.webp. Aynı WebP hem webdeki VefkStand hem Studio oda / yakın görünümü / fiziksel kaynak panelinde kullanılır.
- 1024 × 1536 saydam çalışma tuvali korunuyor. Eski şövalenin üç uzun ayağı silindi; mevcut üst işleme çerçevesi ve kontrol rafı, alçak yatay ahşap/metal bir masa kaidesi ile bitirildi. Gerçek görünür alt sınır yaklaşık y=1203 piksel; geriye kalan alan saydam.
- Masa çizgisindeki eski clip-path ile bacakları örtme geçişi kaldırıldı. Ayrı kaide gölgesi tablanın altına takıldı. İkinci stand veya ikinci çizim saati yok.
- Parşömen, divit, mürekkep kabı, katalog, butonlar, ilerleme çizgisi, odak ve yakınlaşma koordinatları korundu. Fiziksel cihazın yerleşimi Studio üzerinden daha sonra ayarlanabilir.
- Studio nesne ailesindeki şasi artık ready; kaynağı orijinal çalışma koordinatlarında doğrulanır.
- Eski chassis-no-nameplate.webp artık yayımlanan kaynaklarda yok; yalnız Git geçmişinde izlenebilir. Tek aktif şasi.
- Etkileşim, düşük hareket ve masaüstü/mobil alfa kanalı testleri deploy öncesi çalıştırıldı. Deploy / commit / push yok.


## V4.7 — Kamera LCD ve sandık menteşesi (yerel)

Kamera:
- Web sahnesindeki kapanmış LCD artık yalnız onaylı yayımlanmış ve çözümlemesi tamamlanmış katalog kayıtlarının küçük resimlerini seçer; son kayıt yüklenemezse sıradaki uygun kayda düşer.
- Tek kaynaklı ikili görünüm: arka yüzde aynı küçük resmin hafif bulanık atmosfer katmanı, önünde tam görünen (object-fit:contain) 16:9 afiş. Gerçek video başka panele oynatılmaz, otomatik başlatma yok; görüntü kırpılıp gerilmez.
- Studio oda/yakın görünüm panelinde yalnız yerel dışa aktarılmış yayın kataloğunun güvenilir YouTube küçük resim URL'si önizleme olarak gösterilir. Yayın kaydı yoksa görsel uydurulmaz. Önizleme sadece metadata, scene source hash / draft / staging / deploy dışında.
- Studio'da Son bölüm afişi altında Afiş/Arşiv temsili görünüm değiştirilebilir; parlaklık, konum, yakınlaştırma ve cihaz bazlı ayarlar aynı canonical presentation alanlarında kalır. Önizleme çevrimdışıysa açık durum bilgisi verilir.
- Üretim sahnesindeki LCD açılma/kapanma animasyonunun, videonun yayından seçiminin ve oynatıcı mantığının kimliği değişmedi.

Sandık:
- Arşiv sandığı üç fiziksel katmana devam eder: body WebP, lid WebP ve önceden hazırlanmış interior-light-mask.webp.
- Menteşe layer transformOrigin yüzde 50 / yüzde 30 canonical rear-hinge ankrajından. Kapak sırf rotateX(-açı) ile açılır; tüm kapağı geren scaleY ve sahte lift parametresi kaldırıldı. Doğal açı 42'den 62 dereceye çıkarıldı, üst sınır 78 derece.
- Kehribar ışık 150% geniş olan gövde/lid ile aynı 150% görsel düzleme taşındı; maske +112 piksel aşağı indirildi ve ışık merkezi y=%44 düzeyine hizalanarak açılan sandık ağzında sınırlı kaldı. Parlama kapağın arkasında, gövdenin önünde ve yalnız kısa click pulse sırasında. Azaltılmış hareket modunda kapak hareketi / canvas yok.
- Studio önizlemesinin efekt canvas maskesi de aynı fiziksel genişliğe taşındı; efekt motoru tek finite clock kullanıyor.
- Kapak ve gövde dosyalarının ayırt edici dış biçimi/işlemesi korundu. Dışarıdan yeni içerik veya paralel yayın sahnesi eklenmedi.

Test sınırı:
- Gerçek web tarayıcılarında masaüstü/mobil, küçültülmüş hareket, sandık kapağı dönüşü, maske pikseli, kamera kırpılmayan afiş, yayın kaydı yok / görsel yüklenemiyor durumları.
- Studio'da onaylı son afiş yalnız read-only local exporttan geliyor; kitap/veri güncellemesi yok.
- Kompozisyonun genel son renk/ışık ve tam konum ince ayarı kullanıcıya bırakıldı.
- Deploy, Git commit/push yok.

## V4.8 — Koyu deri evren kitabı

- Kitap fotoğrafı, İngilizce lettering maskelemesi ve cilt hacmi değişmez. Evren kitabı book.coverBrightness varsayılan %79; yakın kapak ve masa portresinde aynı değer uygulanır. Topluluk kitabı %100 kalır.
- Studio → Evren kitabı → Görünüm → Kapak ve sayfalar: deri kapak parlaklığı %52–105. Kayıtlı canonical presentation dışında sabit maske uygulanmaz.

## V4.8 — Dil anahtarı masa yuvası

- Tek onaylı arka plan değişmedi. Ahşaba oyulmuş gibi görünen ve pirinç/kızıl bakır plakanın altına oturan özel yuva CSS ile tasarlandı.
- Yuvalanmış plaka perspektifini, X/Y konumunu, ölçeğini ve eğimini birebir dil anahtarının canonical Studio kontrolünden alır. Mobil yuvanın da aynı geometriyle küçülmesi sağlandı.
- Yuva yalnız görsel, tıklama/klavye TR/EN ve dil değiştirme süresi aynen korunur.

## V4.8 — Kapak tılsımı

- Eski research-journal-seal-hover efekt yuvası aynı kimlik altında seal-trace tipine çevrildi. Yeni nesne veya tıklama bölgesi eklenmedi; sahne 14 nesne / 22 efekt yuvası. 15 efekt etkin.
- research-journal.talisman-path kanonik ankrajı gerçek kitap kabuğundaki pusula gravürüne bağlıdır; fotoğraf ve onaylı TR/EN kapak yazıları yeniden üretilmedi.
- Tılsım ışığı arka plana değil kapalı kitabın fotoğraf yüzeyine çizilir. İmleç/görünür klavye odağı başlatır, ayrılınca söner, sonraki tetiklemede desen başlangıcına sıfırlanır; kitap açılırken geride kalmaz.
- Studio önizlemesinde aynı efekt motoru gerçek oda kitabı görüntüsünü kullanır. seal-trace Efekt sekmesinde opacity, speed, stroke değerleri ve Sakin/Doğal/Canlı profilleriyle ayarlanır.
- Tek canonical overlay/ticker, görünürlük, azaltılmış hareket ve temizleme davranışları korunur.


## V4.9 — İnce ayar öncesi görünürlük ve yayın bütünlüğü (yerel)

- Gizleme sözleşmesi ikiye ayrıldı:
  - **Yalnız önizlemede göster:** Studio tuvali için geçici. Gerçek site veya kayıtlı sahne JSON'u değişmez.
  - **Nesne → Sitede nesneyi göster:** 14 kanonik nesnenin tamamında görünür. object.visible Boole alanı Studio taslağına kaydedilir ve yalnız açık hazırlama işlemiyle site efekt sahnesine uygulanır.
  - Dört odak nesnesinde **Görünüm → Sitede oda görünümünde göster** ikinci, yalnız oda sunumuna özgü bir kontroldür. Her iki kapı da oda sahnesinde geçerlidir.
- Web çalışma odası, sahne nesnesi görünmezse fiziksel kesimi, kaftanı, tıklama alanını, hover/parlama/yansıma/duman efektlerini ve gölgesini birlikte kaldırır. Gizli nesneler için pulse ve hover motoru iş başlatmaz.
- Kaftan görünmezken duvara gömülü askılık ve ana arka plan kaynağı değişmez. Kaftan kırılma efekti, kaftanın kendi görüntüsüne uygulanır. Sabit fotoğraf pikselleri görünürlük kontrolüyle silinmez.
- İkinci oda fotoğrafı, nesne pozisyon kopyası veya ikinci efekt motoru gerekmez.
- Site hazırlama, visible alanında true/false dönüşümüne izin verir; ama nesne kimliği, sabit katmanlar, ankraj, tip ve site efekt yuvası değişikliklerini engeller. Hatalı metin türleri geçersizdir.
- **Salt geçici dosya kopyasında** site hazırlama testi: altı nesne gizlendi, yalnız web efekt JSON'u değişti, gerçek kaynak SHA-256 aynı kaldı, eski revizyonla tekrar hazırlama engellendi. Gerçek siteye hazırlama yapılmadı.
- Tarayıcı testleri: Studio görünürlük / preview-eye / yayımlanacak flag / geri alma, web kaftan–askılık, fiziksel nesneler, koyu kitap ve dil anahtarı (masaüstü/mobil).
- Sonraki aşama Studio'da **manuel görsel kalibrasyon**: perspektif ve ölçek, masa/duvar temas gölgeleri, soğuk ortam–sıcak vurgu dengesi, mobil kadraj ve son tıklama alanları. Kullanıcının kalibrasyonu öncesi kaba kompozisyon tekrar yenilenmeyecek.
- Commit, push ve deploy yok.


## V4.10 — Studio yerleşim ve panel kontrolleri

- Sağ özellik panelinin gerçek kaydırma alanı scene-inspector-page olarak tespit edildi; artık bu alan ve soldaki liste scroll konumu her yeniden çizimde kaydedilip geri yüklenir.
- Dil anahtarının plaka ölçeği/eğimi daha önce Object.assign(style, CSS değişkenleri) şeklinde yazıldığı için görsel etkisiz kalıyordu. setProperty ile gerçek CSS değişkenleri uygulanıyor. Plaka ve ahşap yuva aynı oranda ve açıda hareket eder; erişilebilir tıklama alanının boyutu bağımsızdır.
- Plaka ölçeği %45–225, eğimi -55 ile +15 derece arasında ayarlanabilir. Mobil ve masaüstü profilleri korunur.
- Kamera ve Çizim Atölyesi, Görünüm → Oda üzerinde konum ve boyut panelinde X/Y merkez ve %55–175 ölçek alanlarıyla düzenlenebilir; Görsel Taşı modunda fotoğraf önizlemesi üzerinde sürüklenebilir.
- Oda koordinatları mevcut scene-presentation.v1.json içine isteğe bağlı roomPlacement olarak kaydedilir. Eski dosyalar geçerlidir; siteyi hazırla ile webde gerçek kamera ve cihaz gövdeleri taşınır. Semantic camera ve Vefk ters projeksiyon hitbox da birlikte taşınır.
- Yakın görüntünün LCD ve çizim donanımı ayarları ayrı tutulur, oda yerleşiminden etkilenmez. Oda katman sırası korunur; elle aşırı örtüştürülen nesnelerin dekoratif tıklama alanları kalibrasyonda ayrıca kontrol edilir.
- Tarayıcı kapsamı: bakır plakanın ölçülmüş genişliği ve eğimi; kaydırma pozisyonunun korunması; kamera/tahta numerik düzenleme, sürükleme, reset ve site doğrulama; masaüstü/mobil fiziksel nesne+hit alanı. Geçici kopyada staging roundtrip. Gerçek sahne taslağına otomatik kalibrasyon uygulanmadı.
- Deploy, commit ve push yok.

## V4.11 — Site görünürlüğü göz düğmesi (yerel, canlıda yayın bekliyor)

- Sorun: Studio nesne ağacındaki göz yalnız önizleme belleğini güncelliyordu, yayın kaydı aynı kalıyordu. Onaylı sahnede 14 nesnenin tamamı görünür olduğundan Arşiv Sandığı ve Ahşap Tütsülük canlıda görünüyordu. FTPS hatası değil.
- Çözüm: Site projelerinde ağacın göz düğmesi kalıcı object.visible alanını değiştirir; Kaydet / Siteye hazırla / Ön kontrol / Canlı yayın akışı geçerlidir. Sağdaki Nesne sekmesindeki Yalnız önizlemede göster ayrı ve geçicidir.
- Yalnız kullanıcının görüntüsünde üzeri çizili görülen archive-chest ve incense-holder kalıcı false durumuna getirildi. Diğer 12 nesnenin ayarlarına dokunulmadı. Efekt tanımları saklanır, gizliyken çalışmaz.
- Web masaüstü, mobil, reduced-motion tarayıcılarında gizli gövde, tıklama ve efekt hostunun yokluğu test edildi. Studio göz butonu / Inspector uyumu / Undo ve önizleme ayrımı doğrulandı.
- Yeni yerel değişiklikler canlı sunucuya henüz gönderilmedi. Studio Yenile veya yeniden başlat, ardından yeni Ön kontrol ve onaylı Canlı yayın gerekir.


## V4.12 — Sahne statik medya önbellek sürümleme (yerel, canlıya aktarılmadı)

- Kanıtlanan canlı sorun: PHP giriş HTML no-store, fakat /scene-assets/ görselleri Cache-Control: public, max-age=604800 ile 7 gün saklanıyor. Aynı dosya adı kullanıldığında eski tarayıcı yeni JS ile eski oda görselini birleştirebiliyor.
- Vite üretim derlemesine sceneAssetRevisionPlugin eklendi: sahne görsellerinin, SVG, font, sahne JSON'u katman varlıklarının tüm derlenmiş JS ve CSS URL'leri dosyanın SHA-256 ilk 12 hanesiyle ?v=hash olur. Görsel değişmezse URL değişmez; güncellenirse yeni URL ile otomatik indirilir. Manuel tarayıcı geçmişi temizliği gerekmez. Yalnız build çıktısı değişir, Studio taslak JSON'larının asıl yolları aynı kalır.
- 53 benzersiz varlığın 68 üretim referansı kontrol edildi. verify:dist ve doğrudan deploy:natro plan/dry-run/deploy komutları gerçek dist dosyaları ve içerik hash'leri eşleşmezse yayını engeller.
- Sıkı varlık yolu doğrulaması isteğe bağlı 12 haneli hex sürüm parametresine izin verecek şekilde uyumlandı; keyfi URL query'leri veya harici kaynaklar kabul edilmez.
- Yerel üretim önizlemesinde Chromium 1600×900 ve 390×844 cihazlarda oda görselinin gerçek HTTP isteği aynı hash ile ve başarılı yanıtla doğrulandı. Statik Vite preview PHP publication API sağlamaz; test PHP giriş akışını değil, arka plandaki gerçek sahne medya isteğini ölçer.
- Ziyaretçi daha önce açık bıraktığı sekmede kendiliğinden güncellenmez; yeni gezinme/yenileme HTML no-store sayesinde yeni hashli JS ve sahne varlıklarını getirir. Giriş oturumu, yayın verisi ve dekor yerleşimleri korunur.
- Manuel yayın, commit ve push yapılmadı; ön kontrol / onaylı Canlı yayın akışı gerekir.
