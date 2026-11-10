# Kanal Çizimi üretimi

Bu üretici yeni editör, şema veya çizim motoru oluşturmaz. `channel-drawing.cjs`, mevcut `manualPaths` v2 sözleşmesiyle imzalı belge, her path için tek stroke ve göreli zaman çizelgesi üretir. Studio Vefk Atölyesi adı ve editör akışı korunur.

## Kaynak

Portre kaynağı, loading ekranında da kullanılan `channels/birdesengor/web/public/scene-assets/opening/observer-portrait.webp` (160×160) dosyasıdır. Mühür kaynağı, web `index.html` içindeki `.entrance-seal` SVG'sidir. Kullanıcının doğruladığı referans portre ile çevresindeki mührün tamamıdır. Yalnız SVG'nin içindeki seçili geometri alınır; alttaki BirDeSenGör yazısı/çizgisi, arka plan parıltısı, grain/engraving deseni, ışık vurguları alınmaz. İki kaynağın SHA-256 değerleri ve dönüşüm ölçüleri `artwork.json` içinde kayıtlıdır; mühür hash'i seçili kaynak geometriyi kapsar, HTML'nin diğer bölümlerini kapsamaz.

`trace-source.py`, loading'in ortak merkezini ve **92/134 portre/dış halka yarıçap oranını** korur; kaynak SVG bütün olarak 2× ölçeklenir. Mühür **34 path**: altı mevcut halka sınırı, 24 yerine 12 indeks, sekiz mevcut bölme işareti, dört yön işareti ve dört kilit pimi. Son yüz iyileştirmesinde mührün bütün path'leri, çizgi kalınlıkları ve zamanları revizyon 5 ile aynıdır; bu görünüm bir regresyon hash'iyle korunur.

Kullanıcının son düzeltmesinde az hamle kısıtı kaldırıldı; portrede gerçek fotoğrafa benzerlik önceliklidir. Şematik elle çizilmiş yüz kaldırıldı. 160×160 loading portresi 640×640 işleme ızgarasında yumuşatılır (yeni fotoğraf ayrıntısı üretilmez), üç parlaklık seviyesinde **71 gerçek kaynak konturu** ve iki yönde **335 ince gravür taraması** çıkarılır. Göz, burun, ağız, kulak ve sakalın kontur/tonları fotoğraftan gelir; profil veya yüz biçimi tahmin edilmez. Tarama boşlukları mevcut motorun gerçek kalem kaldırmalarıdır. Tonlar portre dairesi içinde kalır; dış ışık halesi veya yeni çerçeve yoktur. Kaynak fotoğrafın daire içindeki koyu zemin tonu da gravürle karşılanır. Mühür ve sponsor ink stilleri aynı kalırken, portre konturları 0,75 ve taramalar 0,95 birimdir. **406 portre + 34 sabit mühür = 440 temel path**. SVG'ye bitmap, dolgu/reveal katmanı veya yeni motor eklenmez.

Offline yeniden hazırlama için Python ortamında `pillow numpy opencv-python-headless fonttools` gerekir:

```sh
python apps/studio/channel-drawing/trace-source.py
```

Yazı konturları Noto Serif Regular'dan önceden örneklenmiştir; 1351 karakter ve Türkçe harfler desteklenir. Lisans `FONT-LICENSE.txt` içindedir. Çalışma zamanı font/Python indirmez; paketlenmiş `letter-outlines.json` kullanılır. Desteklenmeyen bir karakterde açık hata verilir, isim tahmin edilmez veya gizlice değiştirilmez. Uzun adlar kırpılmadan satırlara bölünür. Belge motorun 1024 path / 5 MB katalog sınırını aşarsa mevcut doğrulayıcı yayını durdurur.

Destekçi etiketi 34, isim 46 birim Noto Serif konturuyla ayrı satırlarda çizilir. İsimler 820 birim alanda önce sözcük sınırından; tek uzun sözcük gerekiyorsa harf sınırından bölünür. Satırlar arttığında viewBox uzar. Sponsorsuz teşekkür metni 38 birimdir. Sponsor path'leri revizyon 6 ile birebir aynıdır. Güncel gerçek `Tufan Akkaya` kaydı **472 path/stroke, 209430 ms (3:29,43 / 1×)**; sponsorsuz sürüm **467 path/stroke, 204566 ms**. Eski 130/157 hamle ve 61,958 saniye sınırlamaları kullanıcı isteğiyle kaldırıldı; mevcut çekirdeğin 1024 path/belge ve yayın boyutu sözleşmeleri korunur. Mühür yine 34 hamle/19675 ms. İsim uzunluğu path sayısını ve süreyi doğal olarak değiştirir; isimler kırpılmaz.

## Yerel kurulum

```sh
node apps/studio/seed-channel-drawing.cjs
```

Yalnız etkin BirDeSenGör kanalında çalışır. Önce SQLite'ın tutarlı yedeğini ve mevcut public-export paketini `.local-data/studio/backups/channel-drawing-*` altına alır. Sabit `birdesengor-channel-drawing` kimliğini onaylı revizyon olarak kaydeder; mevcut katalog seçimlerini kaldırarak yalnız ana eseri seçer. Eski belgeler editörde kalır. Yerel yayın paketi üretilir; ağ çağrısı/deploy yoktur.

Kurulum, göreli `visual-assets/…` yollarını gerçek Studio dizinine bağlar; yeniden export sırasında kitap/evren görselleri korunur. Sadeleştirme sonrası normal hatla üretilen pakette `journal`, `assets`, `archive`, `youtubeAnalysis` ve `support` başlangıç paketiyle aynıdır.

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

Ana kaydın görünen adı **Sponsorluk**. Okuma alanı yalnız bu başlık ve `Sponsorluk için hakandemir@gmail.com adresinden Hakan'a ulaşabilirsiniz.` cümlesini içerir. Web iletişim içeriği eserin kimliğine bağlı genişletilebilir bölüm dizisindedir: `web/src/vefk/channelDrawing.js`; ayrı alt başlık yoktur. Ana kaydın eski yayın açıklaması web okuma alanında gösterilmez. `mailto:hakandemir@gmail.com` korunur ve çizim geometrisinin parçası değildir. Diğer çizimlerin açıklama/provenance gösterimi aynı kalır.

Ana eserin Studio'da henüz onaylanmamış bir taslak revizyonu varsa otomatik eşitleme açık hata ile durur ve taslağın üstüne yazmaz. Devam etmeden önce mevcut taslak normal editör inceleme/onay akışından geçirilmelidir.
