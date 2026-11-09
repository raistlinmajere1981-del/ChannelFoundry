# BirDeSenGör V2 — iki dilli yayın altyapısı

Çalışma yereldir. Commit, push, canlı deploy ve canlı veri temizliği yapılmaz. Studio arayüzü Türkçe kalır; TR/EN seçimi yalnız düzenlenen yayın metnini değiştirir.

## Veri sözleşmesi ve üretim

- Publication V2 fiziksel sahne sözleşmesi korunur; dil katmanı `languageVersion: 1`, `languages: ["tr", "en"]` ile tanımlanır. Kaynak/nesne/bölüm kimlikleri ortaktır.
- `source_ai_analyses.core_json`, video kimliği, kaynak hash'i, konular/alt konular, kavramlar, anlatı yapısı, kişiler/nesneler/mekânlar, hikâye parçaları, görsel öneriler ve altyazıda doğrulanabilen zaman/alıntı referanslarını taşır. İç Studio başlık/özet notları bu çekirdekten ve yayın varyantlarından ayrıdır.
- Çekirdek sürümü `source-core-2`, istem sürümü `source-core-prompt-2`; kullanılan sağlayıcı/model ve tam altyazının kaynak hash'i kaydedilir. 48 bin karakterlik eski sessiz giriş kesmesi kaldırılmıştır. Modelin bağlam sınırı aşılırsa iş başarısız olur; arşiv korunur.
- Tek temel çözümlemeden sonra TR ve EN metinleri ayrı üretilir. Bu aşama altyazıyı yeniden göndermez. Sonradan yalnız istenen dil yeniden üretilebilir. Çeviri istem sürümü `publication-language-2` (metin alanı yolları / parça birleşimi).
- Review düzeltmesi: çeviri modeline tam `core_json`/kaynak nesnesi yerine yalnızca çevrilebilir metin yolları ve sınırlı bağlam gönderilir. Model yalnız ilgili `path/text` çiftlerini döndürür; alan yolları doğrulanarak orijinal nesneye eklenir. Uzun içerikler gruplara bölünebilir; grup hatasında hiçbir kısmi sonuç yayınlanmaz. Büyük değişmez `core` alanının AI isteğine girmediği ve grupların doğru birleştiği test edildi.
- `publication_language_sources` güncel kaynak sürümünü; `publication_language_variants` dil bazında metni, onayı, revizyonu, manuel düzenleme durumunu, model/istem bilgisini, ayrı AI adayını ve son iş sonucunu tutar. Kaynak hash'i değişince kayıt `stale` olarak sunulur ve yayından çıkar. Diğer dilin metni silinmez.
- AI; manuel veya onaylı metni değiştirmek yerine ayrı aday oluşturur. Adayın dahili revizyonu ile yayındaki onaylı revizyon ayrıdır; kabul edilmemiş aday yayın fingerprint’ini veya mevcut SEO onayını değiştirmez. Adayı düzenlemeye alma ve onaylama insan işlemidir. Arapça metin, kaynak kimlikleri, referanslar ve çizim yapısı doğrulanır. Yarım kalan işler bir sonraki Studio başlangıcında hata/yeniden deneme olarak görünür.
- Yeni kaynak çözümlemesi editoryal incelemeyi yeniden açar. Önceki Evren kayıtları yerinde kalır; değişen kaynaklar mevcut ingest fingerprint mekanizmasıyla ayırt edilir.

## Studio

Mevcut video, anlatı, arşiv kaydı, vefk ve yayın editörlerine küçük Türkçe/İngilizce içerik paneli eklenmiştir. Her dil bağımsız kaydedilir/onaylanır. Eski sürüm, eksik dil, AI adayı ve üretim hatası ayrılır. Kaynak/revizyon denetimi eşzamanlı eski bir editörün yeni metni ezmesini engeller.

Ana sayfanın **Çeviri Durumu** kartı iki dilde hazır, İngilizce eksik, onay bekleyen, eski sürüm ve hatalı üretim sayılarını gösterir. Düğmeler yayın editörünü ilgili süzülmüş kayıtlarla açar. Review düzeltmesinde sayaç ve liste filtresi aynı içerik bazlı `flags` değerlerini kullanır; eksik çeviriler başlığın varlığına bakılarak yanlışlıkla gizlenmez. Site Performansı, analitik ve SEO bölümleri korunur; sabit görünümün satır düzeni yeni kart için güncellenmiştir.

## Sahne ve yayın politikası

Tek global TR/EN durumu `useSyncExternalStore` ile paylaşılır. Açık URL'nin dili, kayıtlı tercih ve tarayıcı dili sırasıyla değerlendirilir. Tercih yalnız arayüz ayarı olarak localStorage'a yazılır; analitik kimliği değildir. Dil değiştirme yeni sayfa yüklemez, sahne girişini tekrarlamaz ve nesne bileşenlerini yeniden oluşturmaz.

Pirinç iki konumlu anahtar, 180 ms eski mürekkep solması ve 420 ms yeni mürekkep görünmesiyle yaklaşık 600 ms geçiş sağlar. Azaltılmış harekette animasyon uygulanmaz. Klavye, odak ve en az 44 px dokunma alanı vardır. Yakın görünümde aynı global mekanizma erişilebilir kalır.

Evren'de aynı bölüm/arşiv kimliği ve bölüm içindeki okuma ilerlemesi korunur; daha önce okunan dildeki konuma dönüş de saklanır. Kamera seçili video ve iframe'i korur. İngilizce metni eksik kayıtta açık bir durum mesajı gösterilir; Türkçe özet İngilizce gibi sunulmaz. Video altyazı dili bundan bağımsızdır.

Vefk dil metinleri `vefkLanguages` yan alanındadır. İmzalı katalog, belge, kare, Arapça sembol, zaman çizelgesi ve oynatıcı aynı kalır; dil değişimi doğrulamayı/oynatıcıyı yeniden başlatmaz. Gelecekte katalogda tek vitrin eseri bulunması bu modeli değiştirmez. Yeni kapak levhası tasarlanmamıştır.

Topluluk sabit arayüzü çevrilir. Konu, mesaj, kullanıcı adı ve kullanıcı taslağı değiştirilmez. Üyelik, çerez, doğrulama, yetki ve özel konu sunucu kuralları korunur.

## SEO ve güvenlik

SEO çalışma alanı ve manifest sürümü 2'dir. Her dilde yalnız güncel, eksiksiz, insan onaylı içerik ve ayrıca manuel onaylı SEO başlık/açıklaması yayımlanabilir. AI önerisi mevcut metnin üzerine yazılmaz. SEO onayı editörün gördüğü kaynak hash'ine bağlıdır.

Rotalar `/tr|en/evren/bolum/<id>`, `/tr|en/kamera/video/<id>`, `/tr|en/vefk/<id>` biçimindedir. Eski tek dilli adresler TR adresine 301 yönlendirilir. PHP doğrudan istenen dilde HTML sunar: `html lang`, canonical, karşılıklı hreflang, uygun TR x-default, Structured Data inLanguage, OG locale ve dil bazlı sitemap kayıtları aynı onaylı kümeden üretilir. Olmayan/onaysız İngilizce sayfa 404'tür.

Şifreli önizleme, noindex, robots.txt ve arama motorlarına kapalı varsayılan korunur. Dil varyantları ve Vefk dışındaki boş kataloglar da PHP'de fingerprint kontrolünden geçer; JSON `{}`/`[]` ayrımı saklanır. Analitik veri modeli ve canlı erişim durumu değiştirilmez.

## Kapak varlıkları

Yerleşik imagegen aracıyla yalnız ikinci altın yazı satırları yerelleştirilmiştir:

- `channels/birdesengor/web/public/scene-assets/books/scene-closed/evren-master-closed-en.png`
- `channels/birdesengor/web/public/scene-assets/books/scene-closed/topluluk-master-closed-en.png`

Tam görsel değiştirilmez: CSS yalnız yazının bulunduğu küçük deri bölgesini örter. Özgün fotoğrafın silueti, alfa kanalı, sırtı, sayfa kenarları, kurdelesi, perspektifi ve gölgesi her dilde aynı kaynaktan gelir.

Üretim istemleri: “Change ONLY the second line of gold embossed cover text from 'Gizli Evren' to exact English 'Hidden Universe'” ve “Change ONLY the second line of gold embossed cover text from 'Topluluğu' to exact English 'Community'”; her ikisinde 1536×1024 çerçeve, özgün malzeme, perspektif, ışık ve diğer bütün öğelerin korunması istendi. Üretilen görseller yerel tarayıcıda incelendi; yalnız yazı bölgesi kullanıldı.

Superdesign incelemesi: https://superdesign.dev/teams/d43e8b12-551a-4b15-a10c-e48c388c4fc6/projects/191a9752-88d7-44a6-b881-54fed81804f9

## Yerel temizlik

`node apps/studio/clean-bilingual-demo.cjs --plan` kapsamı ve korunacak tabloların hash'lerini çıkarır. `--apply-local` yalnız bu deponun BirDeSenGör yerel dizininde çalışır; ağ/SSH/canlı veritabanı desteği yoktur. Önce SQLite ve üretilmiş çıktılar yedeklenir, sonra izinli tablolar transaction içinde temizlenir. Altyazı/video/eşleme ve yetkilendirme tablolarının hash'leri değişirse işlem geri alınır. Ayar dosyalarının hash'leri ayrıca doğrulanır. Sonuçta boş iki dilli yerel yayın yeniden üretilir.

Temizlik uygulandı. Yedek: `/home/raistlin/ChannelFoundry/channels/birdesengor/.local-data/studio/backups/bilingual-clean-2026-11-09T12-50-56-229Z`. Ayrıntılı işlem ve hash raporu yedeğin `report.json` dosyasındadır.

| Veri | Sonuç |
| --- | --- |
| Kaynak altyazı | **606 kayıt**, bütün satır hash'leri aynı |
| Video kaynakları | **618 kayıt**, kimlik/metadata hash'leri aynı |
| İçerik-kaynak eşlemeleri ve kaynak dosyaları | Korundu; yeniden indirme yapılmadı |
| Eski AI çözümlemeleri / kuyruk | **5 / 6** kayıt temizlendi |
| Demo Evren | Anlatı, bölüm/dizi, editoryal ve görsel eşlemeler temizlendi |
| Demo Vefk | **2 belge / 3 revizyon**, seçili katalog temizlendi; özgün sahne/çizim kaynak dosyaları korundu |
| Demo topluluk | **4 konu / 7 mesaj** temizlendi; **1 hesap** ve doğrulama/kimlik bilgileri korundu |
| Model/API/kanal/yönetici ayar dosyaları | **3 dosya** hash ile doğrulandı |
| Diğer Studio metadata ayarları | Yedekle birebir karşılaştırıldı; korundu |
| Yerel SEO ve yayın çıktıları | Eski üretilmiş paket yedeğe taşındı; boş iki dilli paket yeniden üretildi |
| Analitik | Yerel sayaç veritabanı bulunmadığından sayaç silme yapılmadı; canlı sayaçlara dokunulmadı |

SQLite bütünlük denetimi `ok`; foreign key denetimi başarılı. Yayın üretildikten sonra arşiv hash'leri tekrar karşılaştırıldı. Gerçek temiz yerel paket Chromium'da açıldı: giriş tamamlandı, Vefk boş durumu doğrulandı, İngilizce başlangıç ve kameranın dürüst boş durumu geçti.

## Yeniden doğrulama

- `npm run verify:bilingual`: kaynak/dil/PHP/temizlik sözleşmeleri, sağlayıcı sözleşmeleri, yayın/SEO denetimi, web birim testleri, iki derleme ve Studio/web çift dil tarayıcı denetimleri.
- `npm --prefix channels/birdesengor/web run test:e2e`: fiziksel sahne, kitap, topluluk, kamera ve vefk regresyonları.
- `node apps/studio/verify-fixed-viewport.cjs`: Studio sabit görünüm denetimi.

Test verileri geçicidir; gerçek 606 altyazı yeniden analiz edilmez ve gerçek sağlayıcı üzerinden toplu çeviri başlatılmaz. Gerçek içerikler doldurulduğunda anlam, özel ad ve çeviri kalitesi editör tarafından incelenmelidir.

## Son kabul sonuçları

- **212 web birim testi** geçti; TR/EN seçimi, onaylı dil projeksiyonu, eski tek dilli paketten sahte İngilizce üretmeme, görsel alt metinleri, okuma ilerlemesi ve iki dilli PHP SEO dahil.
- **16 backend/PHP testi** geçti: dil üretimi, onay/manuel koruma, yeniden üretme adayı, sürüm eskimesi, yarım kalan işler, güvenli temizlik/rollback, kamera ve imzalı Vefk yayın sözleşmeleri.
- Studio ve web derlemeleri geçti; `verify:dist`, `verify-fixed-viewport`, altyazı analizi ve AI sağlayıcı sözleşmeleri geçti. Sağlayıcı testleri dış AI çağrısı yapmadan istek/yeniden deneme/fallback/iptal davranışlarını doğruladı. Uzun altyazının sonunun gönderildiği ayrıca sınandı.
- Studio React + gerçek geçici SQLite tarayıcı testi geçti: İngilizce tarayıcıda Türkçe arayüz, ayrı dil onayları, AI adayının açıkça alınması, manuel metnin korunması ve eski sürüm göstergesi.
- Çift dil Chromium denetimi 1920×1080 ve 390×844'te, normal/azaltılmış harekette geçti: tercih saklama, klavye, açık kitapta bölüm içi ilerleme, kamera iframe/oynatma korunması ve Vefk zaman/okuma durumunun korunması. Dil geçişi sırasında başka nesneye yaklaşma da sınandı.
- Fiziksel sahne, uzun kitap metinleri/dizinler, sürükleme/klavye/kapanış, topluluk okuma/üyelik/oturum/doğrulama/hatırlama, kamera ve Vefk 1/5/32 kayıt regresyonları geçti. Toplulukta TR/EN değişirken özgün mesaj, konu, oturum ve yazılmakta olan taslak korundu.
- Vefk testlerinde kanonik uç konumu, zaman çizelgesi, hız/adım/tekrar, okuma, yakınlaştırma, azaltılmış hareket, boş/hatalı yayın ve tek fiziksel nesne doğrulandı. Gerçek çalışma verisi bu testler sırasında değiştirilmedi; yerel temizlik tüm testlerden sonra yapıldı.
- Eski bazı regresyonlar beş ortam katmanı varsayıyordu. Mevcut sahne dosyasında tütsü katmanları kapalıdır. Testler yazılmış gerçek etkin katman sayısını denetleyecek biçimde güncellendi; efekt ayarları değiştirilmedi.

Görsel ve tarayıcı kanıtları: `channels/birdesengor/web/artifacts/bilingual/`; gerçek temiz paket denetimi `empty-local-verification.json`. Canlı deploy, push ve commit yoktur.

Kalan pratik sınırlar: gerçek arşiv için yeni AI/çeviri üretimi başlatılmadı. Gerçek içeriklerde anlam, özel ad, anlatıcı kaynak eşlemesi ve SEO onayları editörce gözden geçirilmelidir. Vite'ın mevcut tek JavaScript paketi için 500 kB boyut uyarısı vardır; derleme başarısızlığı değildir. Arama motorlarına açılma kararı verilmedi.
