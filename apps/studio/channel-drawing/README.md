# Kanal Çizimi üretimi

Bu üretici yeni editör, şema veya çizim motoru oluşturmaz. `channel-drawing.cjs`, mevcut `manualPaths` v2 sözleşmesiyle imzalı belge, her path için tek stroke ve göreli zaman çizelgesi üretir. Studio Vefk Atölyesi adı ve editör akışı korunur.

## Kaynak

Gerçek kaynak: proje kökündeki `Screenshot_20261109_151819.png`. Bu, istenen portreli kanal kompozisyonunun ekran görüntüsüdür; kökteki `logo.png` ChannelFoundry Studio logosudur ve bu eser için kullanılmamıştır. Kullanılan kırpım `(488,198)-(1430,825)`; tarayıcı arayüzü ve yeşil seçim çerçevesi dışarıda bırakılır. Kaynak SHA-256 ve kırpım `artwork.json` içinde kayıtlıdır.

`trace-source.py` konturları sadeleştirir, soluk eş merkezli çizgileri kaynak ölçülerinden örnekler ve portre tonlarını divit taramalarıyla karşılar. Yeni sembol eklemez. Gri tonların tümünü ve kâğıt dokusunu birebir yeniden üretmez. Her kontur/tarama gerçek M/L adımlarından oluşur; statik görüntü gösterimi yoktur.

Offline yeniden hazırlama için Python ortamında `pillow numpy opencv-python-headless scikit-image fonttools` gerekir:

```sh
python apps/studio/channel-drawing/trace-source.py Screenshot_20261109_151819.png
```

Yazı konturları Noto Serif Regular'dan önceden örneklenmiştir; 1351 karakter ve Türkçe harfler desteklenir. Lisans `FONT-LICENSE.txt` içindedir. Çalışma zamanı font/Python indirmez; paketlenmiş `letter-outlines.json` kullanılır. Desteklenmeyen bir karakterde açık hata verilir, isim tahmin edilmez veya gizlice değiştirilmez. Uzun adlar kırpılmadan satırlara bölünür. Belge motorun 1024 path / 5 MB katalog sınırını aşarsa mevcut doğrulayıcı yayını durdurur.

## Yerel kurulum

```sh
node apps/studio/seed-channel-drawing.cjs
```

Yalnız etkin BirDeSenGör kanalında çalışır. Önce SQLite'ın tutarlı yedeğini ve mevcut public-export paketini `.local-data/studio/backups/channel-drawing-*` altına alır. Sabit `birdesengor-channel-drawing` kimliğini onaylı revizyon olarak kaydeder; mevcut katalog seçimlerini kaldırarak yalnız ana eseri seçer. Eski belgeler editörde kalır. Yerel yayın paketi üretilir; ağ çağrısı/deploy yoktur.

## Sponsor bağlantısı

Normal `buildPublicationV2`/yerel export sırasında, yalnız bu ana kayıt daha önce kurulmuşsa eşitleme çalışır. `sourceOnly` dil hazırlama paketleri sponsor değiştirmez.

1. Mevcut kamera/site yayın izin listesindeki tamamlanmış, editoryal olarak ayıklanmış bölümler alınır.
2. Mevcut dil hattında onaylı ve güncel yayın metni bulunması gerekir. Eski analiz, üyeye özel kayıt, gelecekteki yayın tarihi ve yayınlanmamış kayıt dışlanır.
3. En yeni geçerli bölüm, `publishedAt` ile deterministik seçilir.
4. Yalnız kalıcı `decisions_json` içinde açık `confirm` bulunan sponsorlar ve `manual_sponsors_json` kullanılır. İnceleme ekranının varsayılan confirm görünümü onay sayılmaz. Katkıda bulunanlar sponsor sayılmaz.
5. Sponsor yoksa `Destekçilerimize teşekkürler`; varsa `Son bölümün destekçisi: …` gerçek harf konturlarıyla oluşturulur.
6. Değişiklikte aynı kimliğin yeni onaylı revizyonu, yeni path/stroke/zamanlar ve hash üretilir. Eski revizyon değişmez; aynı veri ikinci kez export edilirse revizyon artmaz.
7. Geçerli yayın kaynağı geçici olarak yoksa daha önce gerçek sponsora bağlanmış ana çizim korunur. Son onaylı bölüm sponsorsuzsa teşekkür satırı yeni revizyona girer.
8. Yönetilen eserin deterministik Türkçe okuma metni revizyonla birlikte mevcut dil sözleşmesine yazılır. İngilizce metinler mevcut inceleme akışında kalır; eski onaylı çeviri yeni çizim revizyonuna taşınmaz.

Otomasyon export/paket üretimine kadar bağlıdır. Site kendiliğinden Studio'ya sorgu yapmaz; yeni paketin mevcut yayın işlemiyle ayrıca gönderilmesi gerekir. Bu turda uzak yayın/deploy yapılmamıştır.

Web iletişim içeriği eserin kimliğine bağlı genişletilebilir bölüm dizisindedir: `web/src/vefk/channelDrawing.js`. `mailto:hakandemir@gmail.com` çizim geometrisinin parçası değildir. Boş Hakkımızda bölümü yoktur.

Ana eserin Studio'da henüz onaylanmamış bir taslak revizyonu varsa otomatik eşitleme açık hata ile durur ve taslağın üstüne yazmaz. Devam etmeden önce mevcut taslak normal editör inceleme/onay akışından geçirilmelidir.
