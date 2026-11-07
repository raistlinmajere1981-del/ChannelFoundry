# Evren Kitabı — yaşayan günlük kabul notu

7 Kasım 2026. Önceki yerel uygulamanın üzerine yapılan tasarım ve editoryal araç dilimi. Commit, push, deploy ve gerçek Studio yayını yapılmadı. Başlangıçtaki iki deponun değişiklikleri korundu. Kamera, Topluluk, Vefk ve kitap hareket dosyaları değiştirilmedi.

## Kitap deneyimi

- Aynı kalıcı Grabfold örneği ve aynı fiziksel kapaklar kullanılıyor. Yeni okuyucu, panel, modal, kitap, kütüphane veya render motoru yok.
- İçindekiler gerçek yapraklara ayrılıyor. Dizi, bölüm ve alt anı farklı diziliyor; mürekkep bağlantıları, noktalı kılavuzlar ve yerel sayfa numaraları hedef anıya gidiyor. Fiziksel anlatı sırası editoryal içindekiler sırasını izliyor.
- Muhataplar, nesneler, mekânlar, hikâyeler ve olaylar Türkçe alfabetik dizinler kullanıyor. Uzun dizinler devam yapraklarına bölünüyor.
- Uzun paragraflar, alıntılar ve listeler metin kaybetmeden bölünüyor; referans span'ları kimlikleriyle korunuyor. Bağımsız referans blokları da mürekkep bağlantısı olarak işleniyor. Bölme sırasında yayın nesnesi değiştirilmiyor.
- Günlük metni serif tipografi, ilk paragrafta büyük başlangıç harfi, sakin bölüm başlığı ve kağıda yerleştirilmiş görselle sunuluyor. Devam yaprağındaki paragrafın ortasına yeniden büyük başlangıç harfi eklenmiyor.
- Görseller sınırlandırılıyor; uzun görsel açıklamaları devam metnine aktarılıyor. Görselin kaynağı veya olay tarihi uydurulmuyor.
- Evren kayıtlarında araştırma notları, ilişkiler ve ilgili anılar ayrı tipografik seviyelerde yer alıyor. Uzun kayıtlar devam yapraklarına ayrılıyor; liste içindeki referanslardan da ilgili anılara dönüş kuruluyor.
- Kaynak izi katlanabilir küçük bir kağıt notu. Yalnız yayın verisindeki video kimlikleri ve mevcutsa video başlığı/yayın tarihi gösteriliyor. Video yayın tarihi günlük olay tarihi yerine kullanılmıyor.
- Her içerik yaprağından içindekilere dönülebiliyor. Ayraç yığını fiziksel konumla birlikte mobil okuma kaydırmasını ve masaüstü metin gövdesi kaydırmalarını saklıyor.
- Mobilde aynı yaprağın ikinci yüzündeki bir hedefe gidildiğinde başlık gerçekten görünür konuma getiriliyor. Son boş motor yüzünde eksik sayfa hatası giderildi.
- Olağandışı başlık veya tek referans uzunlukları için mevcut erişilebilir kaydırma ve dokunma koruması devam ediyor.

## Studio editoryal araçları

- Dizi ve bölüm sırası açıkça düzenlenebiliyor. Başlık düzenlemek eski sırayı sıfırlamıyor veya bölümü sona taşımıyor. Onaylı anılar bölüm içinde sıralanabiliyor.
- Aktif kanalın yerel video başlıklarından salt okunur dizi/bölüm önerisi çıkarılıyor. Ağ veya AI çağrısı gerekmiyor. Seri adı olmadan yalnız bölüm numarası eşleştirme üretmiyor.
- Aynı seri ve bölüm numarasındaki birden çok video ayrı video kimlikleri ve özgün başlıklarıyla birlikte tutuluyor; başka serideki aynı numara ile birleştirilmiyor.
- “Düzenlemeye al” yalnız formu dolduruyor. Dizi ve bölüm kaydı editörün mevcut kaydet işlemleriyle yapılıyor. Kaynak video kimlikleri eşleşen onaylı anılar ayrıca açık seçimle bölüme bağlanabiliyor; diğer anılar etkilenmiyor. İçerik onayı/yayın akışı korunuyor.
- Frozen kaynaklara bağlı ben dili talimatı doğrudan deneyimi, başkasından aktarılan bilgiyi ve kaynağa ait yorumu ayırıyor. Konuşanı belirsiz birinci şahıs alıntı anlatıcının deneyimine dönüştürülemiyor. Kaynakta bulunmayan iletişim, duygu veya olay eklenemiyor. Söz dizimi onarımı içerik üretmiyor.
- Factual doğruluk otomatik dil denetimiyle kanıtlanmış sayılmıyor; frozen kaynak zinciri, izinli kimlik doğrulaması ve Studio editör onayı sürüyor. Bu oturum gerçek AI üretimi veya gerçek anı onayı çalıştırmadı.
- Studio'da fiziksel sayfa/spread alanı eklenmedi; yayın sözleşmesi semantik kaldı.

## Bu oturumun dosyaları

Web:

- `src/App.jsx`: hedef yaprağı görünür kılma ve ayraç kaydırma konumu.
- `src/book/bookModel.js`: metin, içindekiler, dizin ve kayıt yaprakları; editoryal sıra, bağlantılar ve yerel folio.
- `src/book/BookIndexPages.jsx`: içindekiler ve alfabetik dizinlerin kitap tipografisi.
- `src/book/BookPages.jsx`: günlük ve araştırma notları, kaynak izi, sayfa altı bağlantısı, son boş yüz koruması.
- `src/book/GrabfoldJournal.jsx`: Evren'e ait yeni CSS import'u.
- `src/book/journal-pages.css`: yalnız Evren yapraklarında geçerli sunum.
- `tests/bookModel.test.mjs`, `tests/journal-contents-e2e.mjs`, `tests/journal-layout-e2e.mjs`, `package.json`: kayıpsız bölme ve tarayıcı regresyonları; `npm run test:e2e:journal`.

Studio:

- `narrative-outline.cjs`: sıra koruma ve salt okunur başlık önerileri.
- `src/NarrativeOutlineWorkbench.tsx`, `src/narrative-outline.css`: sıra, öneri inceleme ve kaynak kimliğiyle anı yerleştirme.
- `narrative-ipc.cjs`, `preload.cjs`, `src/narrative-api-contract.d.ts`: öneri köprüsü.
- `narrative-ai-generation.cjs`: kaynak atfı ve olay/yayın tarihi ayrımı.
- `verify-narrative-outline.cjs`, `verify-narrative-ipc.cjs`, `verify-narrative-ai-generation.cjs`, `tests/narrative-outline.browser.mjs`: izole backend ve gerçek React/IPC regresyonları.

Başlangıçtan beri değişmiş görünen diğer dosyalar önceki oturumlara aittir. Özellikle `physical-books.css`, yayın normalizasyonu, publication-v2 ve diğer sahne modüllerindeki önceki düzenlemeler bu oturumda yeniden yazılmadı.

## Doğrulama ve görseller

Bütün yeni günlük testleri disposable fixture veya in-memory SQLite kullanır. Eski `public-export` anlatıları gerçek yayın kabul edilmedi; Studio veritabanı veya yayın dosyası değiştirilmedi.

Çıktı dizini: `channels/birdesengor/web/artifacts/evren-journal-design/`.

- Web: 197/197 birim testi; web ve Studio derlemeleri.
- Studio: outline, IPC, AI üretim sözleşmesi, service, structured content, store, editoryal UI, publication-v2 kontrolleri; Vefk tüketicisi 6/6.
- Gerçek Studio React + IPC tarayıcı testi: iki kaynak videonun aynı bölüme önerilmesi, açık kaydet/yerleştirme, dizi/bölüm/anı sıralaması; gerçek DB açılmaz.
- İçindekiler → bölüm → anı → arşiv → ayraç → anı akışı: 1920×1080, 1366×768, 390×844.
- 52 gerçek mantıksal yapraklı sentetik kitap: her ekran boyutunda bütün yapraklara erişim, 31 içindekiler/dizin bağlantısı, beş kayıt kategorisi, uzun paragraf ve kayıt notu, uzun görsel açıklaması, dikey görsel, reduced-motion. Geometri ölçümleri `layout-verification.json` içinde.
- Fiziksel kitap regresyonları: iki kitabın açılması/kapanması, gerçek sayfa sürükleme, klavye, son yaprak, mobil, reduced-motion; `physical-books.log`.

Kamera, Topluluk yenileme (masaüstü, mobil, reduced-motion, servis yokluğu/StrictMode), Vefk belge/DOM ve Vefk fiziksel kullanım regresyonları geçti. Vefk fiziksel testinde 1920×1080, 1366×768, 390×844 ve mobil reduced-motion; gerçek dokunma, klavye, katalog ve okuma kontrolleri başarılı. Gerçek Studio DB/WAL/SHM ve eski publication dosyasının test öncesi/sonrası SHA-256 değerleri birebir aynı (`artifacts/vefk-physical-use/verification.json`).

Yeni günlük testinde mobil sayfa çevirme Chrome dokunma olaylarıyla da doğrulandı. Son `layout-verification.json` her boyutta 52/52 erişilebilir yaprak, 31 izlenen bağlantı ve sıfır taşma gösteriyor. Tüm son loglar hatasız; başlangıçtaki hataları yakalayan eski ekran/JSON kayıtları `iterations/` altında, düzeltilmiş sonuçlardan ayrı tutuluyor. Her iki depoda `git diff --check` geçti.

## Yayın öncesinde kalan

- Kullanıcının yeni gerçek anlatı ve kayıtlarıyla son içerik/kaynak ve görsel inceleme.
- Gerçek başlık çeşitleriyle önerilerin editoryal kontrolü. Belirsiz veya yalnız numaradan oluşan başlıklar kasıtlı olarak önerilmez; elle düzenleme kullanılabilir.
- Eski deneme `public-export` paketinin yayınlanmaması. Güncel gerçek Studio içeriğinden yeni paket, son ortak kontrol ve yayın ayrı bir adımdır.

## 7 Kasım — İlk gerçek görsellerin gösterim düzeltmesi

- Gerçek Studio yayını: 3 bölüm, 31 Evren kaydı, 3 görsel var. İlk iki 54. Davet anlatısına sahne görseli; İbn Necem kaydına portre bağlı. 55. Davet, Anlatıcı ve Yardımcılar kayıtları görselsiz.
- Görseller Studio `publication.json` içinde ve canlı sunucuda mevcut (her üç PNG HTTP 200). Sorun `src/book/bookModel.js` içindeki `paginateSection` fonksiyonunun `section.media` görsellerini sayfa bloklarına aktarmamasıydı.
- Fiziksel kitap artık `section.media` sahne görsellerini bölümün başındaki gerçek yaprakta gösterir, diğer görselleri bölüm sonunda tutar, `assetId` tekrarlarını atlar. Kaynak JSON'a, fingerprint'e, Studio DB'ye dokunulmaz; uzun açıklamalar kayıpsız devam yapraklarına ayrılır.
- İki ek `bookModel` regresyon testi eklendi. 199/199 web testi ve Vite build geçti. Gerçek, salt okunur Studio exportundan yerel Vite + tarayıcı testinde 1920×1080 ve 390×844 boyutlarında iki sahne PNG yüklenip `img.decode()` doğrulandı; görsel kanıt `artifacts/evren-journal-design/studio-media-*.png`.
- `verify:dist` ve FTPS `--plan` geçti. **Canlı siteye yeni web kodu deploy edilmedi**: terminal bağlantısında `CF_NATRO_FTP_*` ve `CF_NATRO_DEPLOY_CONFIRM` değişkenleri bulunmuyor. Studio'dan yeni içerik yayınlamak tek başına kitabın render kodunu güncellemiyor. Canlıya çıkış için içerikleri silmeyen normal V2 web deploy'u gerekiyor; `--reset-test-publications` kullanılmamalı.

## 7 Kasım — Aşama 2 / açılış ve içindekiler

Tek Grabfold, kapak arkası ve fiziksel kapak korunarak günlükler başvuru dizinlerinin önüne alındı. Çok yüzlü içindekiler, kimlikle dizi/bölüm/anı hedefleri, kenar ayracı ve mobil kaydırma dönüşü gerçek Studio paketiyle de doğrulandı. Gerçek pakette dizi eşleştirmesi yok; üç bağımsız anı korunur. Kayıt metni, teknik künye ve AI dönüşümü bu aşamada yapılmadı. Güncel kabul kanıtı ve üç boyuttaki görüntüler: [Aşama 2 raporu](EVREN_JOURNAL_STAGE2.md).
