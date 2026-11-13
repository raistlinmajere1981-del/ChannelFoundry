# BirDeSenGör — Sahne Atölyesi ana nesneler / görünürlük
Tarih: 13 Kasım 2026

## Uygulanan ilk aşama
- Sahne ağacındaki nesne başına göz kontrolü editörün **geçici** görünürlüğünü yönetir. Sitede gizli olan bir nesneyi dahi yalnız önizlemede gösterebilir. Göz düğmeleri taslağı kirletmez, geçmişe/publish paketine yazılmaz ve sahne yeniden açıldığında sıfırlanır.
- Efekt, tıklama ve sınır işaretleri geçici gizlemeyi izler. Arka plan fotoğrafının parçası olan mum, kılıç, tütsü gibi öğeler fotoğraftan silinmez; yalnız ayrık görsel/efekt katmanları ve editör işaretleri gizlenir.
- Evren Kitabı, Topluluk Kitabı, Kamera ve Çizim Atölyesi için doğrulanan `roomVisible` alanı eklendi. Studio'nun Görünüm sekmesinden veya nesne sağ tık menüsünden değiştirilebilir; yalnız açıkça Kaydet/Stage ile siteye hazırlanır. Web odasında görsel ile tıklama hedefini birlikte gizler, kitap/kamera/çizim içerik ve davranış kayıtlarını değiştirmez.
- Bağımsız görsel nesnelerinde zaten bulunan `visible` alanı kendi Nesne sekmesinde kalır; yayınlanabilir görünürlük için aynı kaynak kullanılır.
- İki kitabın kapalı oda pozu (`closedBook.x/y/width/angle/surfaceScaleY`) aynı sürümlü sunum verisinde tutulur. Önizleme ve web oda kitapları bu veriyi tüketir; kitap silueti ve tıklama poligonu yeniden hesaplanır. Mevcut değerler taşınmıştır.
- Kapalı kitabı Studio'nun Görünüm sekmesindeki sayısal alanlardan veya Taşı modunda tuvalden düzenlemek mümkün. Geri al, yinele ve tek nesneyi sıfırla korunur.
- Eski V1 sunum kayıtları eksik opsiyonel alanlarda varsayılanı kullanabilir. Sözleşme rastgele alan, kod, yanlış tür veya sınır dışı yerleşim kabul etmez.
- Studio içine ikinci bir iframe/site runtime kopyası eklenmedi.

## Sonraki aşamalar (bu tur kapsamı dışı)
1. Gerçek web bileşeninden güvenli, kaynakla eşleşen **kapalı / yaklaşma / açık / kapanma** yakın görünüm önizlemesi. Mevcut 2B kadraj yalnız geometrik denemedir, gerçek Grabfold, LCD ya da SVG çizimi değildir.
2. Kamera menteşe/açı, Çizim Atölyesi divit istirahati ve donanım örtüşmeleri; kitap açılma ve kenar hizası kontrolleri. Kanonik video, kitap ve çizim motorları bu ayarların dışındadır.
3. Ekran karşılaştırmaları, çakışma/taşma uyarıları, cihaz/dil/azaltılmış hareket matrisleri. Yeni alanlar açık ve izlenebilir doğrulama sözleşmeleriyle girer.

## Sınırlar
- Fotoğrafa gömülü bir nesnenin gerçekten kaldırılması fotoğrafın değiştirilmesini veya ayrı bir görsel katmana taşınmasını gerektirir.
- Geçici göz ayarı hiçbir yayına veya kaynak dosyasına aktarılmaz.
- Studio'da kayıt, Siteye hazırla, Ön kontrol ve canlı yayın ayrı adımlardır; bu çalışmada deploy/push yapılmaz.
- Kullanıcının mevcut efekt yerleşimleri, dil anahtarı ince ayarları ve onaylı içerikleri korunur.

## 13 Kasım 2026 — ikinci aşama: fiziksel önizleme ve ince ayarlar
- Dört odak nesnesinde Oda / Yaklaşma / Açık / Dönüş aşaması ve masaüstü/mobil seçimleri yerel çalışma tuvalinde görünür. Açık aşamada site tarafından onaylanmış gerçek görselleri kullanan DOM tabanlı **2B temsili** önizleme sunulur. Buradaki kâğıt, LCD ve çizim donanımı gösterimleri gerçek Grabfold sayfa çevirme / kamera video / SVG zaman motoru değildir.
- Açık kitapta etkin sayfa oranı, sayfa iç boşlukları, kapak kenar yüksekliği, ayraç ve kenar indeks bilgileri kullanılır. Kamera görünümünde LCD boyutu, çerçeve boşluğu, arşiv alanı, video alanı ve açık menteşe açısı gösterilir. Çizim Atölyesi'nde parşömen, şasi, mürekkep kabı ve divit mevcut kaynak dosyalarıyla gösterilir.
- Kadraj taşma göstergesi yalnız çalışma anındaki geometrik alanı ölçer. Kaydedilmiş nesne veya efektleri değiştirmez.
- Gerçek kamera LCD açılışına `physical.desktop/mobile.hingeAngle` (-12°…12°), Çizim Atölyesi divit dinlenmesine `quillDockX`, `quillDockY` (-24…24 px), `quillRestAngle` (0°…30°) eklendi. Geçerli aralık dışındaki taslaklar reddedilir. **Çizim sırasında divitin gerçek yolu veya kalibre edilmiş metal ucu değişmez.**
- Şeffaf fiziksel görsellerin (özellikle kapalı kitapların) üstüne gelince koyu dikdörtgen boyayan global buton stili etkisizleştirildi. Art kaynakları değiştirilmedi.
- Önizleme yalnızca seçim yapıldığında çalışır, kullanıcıya başka bir web/React runtime kopyası açılmaz. Nesne geçiş durumları, biçim/yerleşim için geometrik denemedir; gerçek web yakın görünümündeki geçişler ayrıca E2E testlerle doğrulanmalıdır.

### Açık kalan ileri aşama
Gerçek web fiziksel bileşenlerinden geçerli taslağı yalıtılmış biçimde gösteren piksel/doğrudan davranış önizlemesi (site kodunu ikinci kez çalıştırmadan), çoklu ekran yan yana karşılaştırması ve etkileşim çakışmalarının kapsamlı denetimi. Bunlar bu turda **tamamlandı** olarak işaretlenmemelidir.

## 13 Kasım 2026 — üçüncü aşama: gerçek web bileşeniyle salt okunur yakalama

Sahne Atölyesi'nin seçili dört ana nesnesinde `Oda / Yaklaşma / Açık / Dönüş` ve `Masaüstü / Mobil` seçimini yaptıktan sonra **Gerçek web** düğmesine basılabilir. Bu düğme normal 2B tuvalin üzerine kalıcı bir tarayıcı eklemez. Her istekte kısa ömürlü, yalnız `127.0.0.1` arayüzüne bağlı Vite ve geçici Chromium penceresi başlar. Gerçek BirDeSenGör React bileşenleri, kapak açma, LCD, stand ve divit yerleşimi çalıştırılarak JPEG ekran görüntüsü Studio'daki bir modal içinde gösterilir. İşlem sonrasında browser/server kapatılır.

**Doğrulanan sözleşme:** IPC `studio:scene-runtime-preview`; salt okunur `captureSceneRuntime`; kaynak SHA-256 sürümü, sahne/asset/sunum şeması, nesne kimliği, aşama ve cihaz kontrolü. Aynı projede Kaydet/Siteye hazırla/Deploy ile eşzamanlı çalışmaz. Önizlemenin kaynak sürümü yakalama sırasında değişirse görüntü reddedilir. Bu, paralel çalışma oturumlarından kaynaklanan eski görüntüyü yanlışlıkla geçerli göstermeyi engeller.

**Yalıtım:** Taslakta değişen sunum parametreleri tarayıcının bellek içi kayıtlarına tek seferlik aktarılır. Sunum JSON, efekt JSON, yayın içerikleri ve dosyalar yazılmaz. İçerik kayıtları sentetik tarayıcı test fikstüründen gelir; topluluk/analitik API'leri ve uzak istekler engellenir. İlk sürümde yalnız sunum JSON'u aktarılıyordu. Kapanış geliştirmesiyle **kaydedilmemiş efekt sahnesi ve izinli WebP değişiklikleri de yalnız yalıtılmış tarayıcı belleğine aktarılır**. Düzenlenen efektlerin gerçek etkileşimleri, yeni görsellerin URL'leri doğrulanarak gösterilir; kaynak dosyalar yazılmaz.

Oda görünümünde sitede gizlenen nesne görünmez. Yaklaşma/Açık/Dönüş seçiminde gizli nesne yalnız yakalama belleğinde geçici gösterilebilir; kayıtlı `roomVisible` değişmez ve görüntüde bu durum belirtilir.

Ekran görüntüsünden gerçek fiziksel bileşenin kadraj taşma sayıları hesaplanır. Mobil Çizim Atölyesi'nde ilk yakalamada yaklaşık 17,6 px sol ve sağ taşma saptandı; bu gerçek ürün görünümünün tamir edildiği anlamına gelmez, teşhis değeridir.

### Sonraki isteğe bağlı iyileştirmeler
- Üretilen görüntülerde yerel Studio yayın içeriğini kullanmak (şimdiki güvenli varsayılan sentetik içeriktir).
- Video benzeri kesintisiz oynatma ve çift ekran yan yana kare karşılaştırması. Mevcut etkileşim gerçek tarayıcıya iletilen adımlı görüntü güncellemesidir.
- Çizim Atölyesi mobilde ölçülen yaklaşık 18 piksel yatay taşmayı görsel karşılaştırmayla ayrıca azaltmak; tasarlanmış fiziksel ölçeği izinsiz değiştirmemek.

### Geçiş ara kareleri
Gerçek yakalamada `Yaklaşma` ve `Dönüş` aşamalarının ekran görüntüsü alınırken gerçek web kameranın/kitabın ara fiziksel durumu beklenir. Chromium ekran görüntüsü oluşturana kadar site zamanlayıcısı ilerleyebildiği için yalnız yalıtılmış yakalama belleğinde ilgili `focusMs` veya `returnMs` 1800 ms yapılır. Gerçek site derleme, kullanıcı taslağı ve yayın süreleri **değişmez**. Böylece ilk denemelerde fark edilen yaklaşma görüntüsünün zaten tamamen açılmış kitap gibi görünmesi giderildi. İnceleme penceresinde bu yavaşlatma açıkça belirtilir. Anlık görüntü, animasyon hızının canlı sitedeki süreyle bire bir kanıtı değildir.

### Ara kare deterministik yakalama
Yük altındaki gerçek web testinde, yalnız geçiş süresini uzatmak bazen yeterli olmadı; ekran görüntüsü bitene kadar React aktif duruma geçebiliyordu. `Yaklaşma` görüntüsünde Playwright sanal saati, site hazır olduktan sonra oda durumunda kurulur, seçili nesnenin gerçek React `focusing` durumuna geçişiyle 300 ms ilerletilir ve görüntü bitene kadar duraklatılır. İki ardışık gerçek Chrome kontrolünde durum `focusing / approaching` kaldı. Bu saat yalnız geçici test tarayıcısına aittir; Studio, site ve kullanıcı taslağında zamanlayıcı değiştirilmez.

## 13 Kasım 2026 — kapanış: taslak efektler, görseller ve adımlı etkileşim

- Gerçek web önizlemesinde Studio'nun henüz kaydedilmemiş V2 efekt sahnesi, güvenilir kaynak SHA-256 ve şema denetiminden sonra yalnız geçici tarayıcı belleğine aktarılır. Oda, efekt motoru ve Çizim Atölyesi aynı güncel sahneyi kullanır. Üretim sürümünde tek kullanımlık taslak mekanizması etkin değildir.
- Düzenlenmiş ve eklenmiş WebP görselleri validateAssetOverrides izin listesinden geçer. Geçerli dosya baytları yalnız izole tarayıcı içindeki resim isteklerine uygulanır; public, canlı sunucu ve Studio taslak dosyaları yazılmaz. Yüklenen görsellerin sayısı görüntüde belirtilir.
- Gerçek web görüntüsü etkileşimli olarak en fazla 120 saniyelik geçici oturum açabilir. Resme tıklama, Escape, yön ve sayfa tuşları gerçek web uygulamasına iletilir; her adımdan sonra yeni ekran görüntüsü alınır. Kareyi yenile ile yeniden ölçüm yapılır. Oturum kapanışta, süre aşımında, kaynak değişiminde veya hata durumunda kapatılır.
- Tarayıcı yalnız loopback üzerinde çalışır; topluluk, yayın, uzak API ve gerçek kullanıcı içeriğine erişim yoktur. Oturum kimliği, cihaz sınırı ve izin verilen komutlar doğrulanır. Tam akıcı video yerine gerçek tarayıcıya iletilen adımlı etkileşim sunulur.
- Metal sarkacın Studio'da elle düzenlenen x/y konumları korunur. İki eski testte yalnız hareketli sarkaç için ilk fotoğraf koordinatı beklentisi kaldırılmıştır. Boyut, derinlik, bağlantı noktası, tıklama alanı ve sahne sınırı yine kontrol edilir.
