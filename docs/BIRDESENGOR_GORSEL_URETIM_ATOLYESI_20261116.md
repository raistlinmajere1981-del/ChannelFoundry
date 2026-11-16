# BirDeSenGör — Kaynak temelli görsel üretim atölyesi (16 Kasım 2026)

## Amaç ve sınırlar
Evren kitabı için kaynakla eşleşen görseller üretmek; önce **muhataplar ve nesneler**, sonra **olaylar ve mekânlar**. 50+ anlatının ve Universe kaynak işleme sürecinin metni, bağlantısı, onayı, sırası ve yayınına dokunulmaz. Görsel çalışma yalnız `entity_visual_profiles`, `visual_reference_links` ve kendi geçici alanları üzerinde yürür. Her görselin kaynak izi kayıt bazında korunur.

## Kullanım akışı (hedef)
1. **Bul:** Görsel Tamamlama'da muhatap veya nesneyi seç. İlişkili videolar ilk sırada gelir. Katalogda başlık/ID ara. İstenirse, ilgili videonun zaman kodlu altyazısını anlık getirip belirli ifadeyi ara; bulunan saniyeye git. Altyazı araması dış servisin erişilebilirliğine bağlıdır.
2. **Yakala:** İç oynatıcıda görüntüyü incele veya saniyeyi elle gir; +-5 sn ile düzelt. `yt-dlp` ve `ffmpeg` tek kareyi geçici dosyaya çıkarır. Önizleme kabul edilmeden kayda geçmez. Gerekirse mevcut “Videodan kare ekle” dosya seçimi kullanılır.
3. **Referans ver:** Onaylanan kare ayrı WebP olarak `visual_reference_links` içinde kayıtla eşleşir; kaynak video ID ve saniye korunur. Görsel profilinin önceki kitabî çizimi bu aşamada değişmez. Mevcut karakalem presetleri ve Codex CLI tekil referansı kullanabilir.
4. **Çiz ve denetle:** Kaynak kare, onaylı görsel tasvir ve karakalem standardıyla üretim yapılır. Sistem kaynak/tasvir çelişkisi ve kimlik sürekliliği için otomatik kontroller yürütür; sonuçlar toplu aday kuyruğuna alınır. Ayrıntılı insan incelemesi kitap görünümüne bırakılabilir; yalnız açık çelişki ve kaynak belirsizliği olanlar istisna kuyruğunda gösterilir. Nihai olarak kabul edilen çizimler diğer sahnelerde ana referans kütüphanesinin öğesi olur. Kaynakta belirtilmeyen detaylar eklenmez.
5. **Sahneye taşı (sonraki aşama):** Onaylı kişiler/nesnelerden gerekli 2–4 çizim, sahneyle ilişkili anahtarları üzerinden bir referans levhasında birleştirilir. Sahne üretimi kaynak anlatı ve bu levhayı beraber kullanır; isim ve rol eşlemesi korunur. Revizyonların kendi ayrı geçmişi olmalıdır.

## Seri üretim tasarımı — sonraki iş paketi
- **Kuyruk:** Tür, görselli/görselsiz, kaynak referansı var/yok, son kullanıldığı bölüm, onay durumu filtreleri. Kullanıcı toplu seçer. Varsayılan üretim eşzamanlılığı 1; gerekirse 2, ama aynı Codex oturumu ve kayıt üstüne çakışan işler çalıştırılmaz.
- **İş birimi:** Tek kayıt tek üretim işi; çalışma parametreleri: entity ID, prompt ve seed açıklamaları, preset ID/revizyonu, kaynak referansları, model, oran, üretim talebi, sonuç durumu, hata ve tekrar hakkı. Bir başarısızlık diğerlerini engellemez. Yarıda kesilen işlem kalanlardan yeniden devam eder. Birim başına 20–25 dk kontrol sınırı.
- **Çoklu kare (opsiyonel):** Aynı görsel standardı ve oranı paylaşan **2** veya **4** farklı hedef için tek kompozisyon üretilir. Yaprak birimleri sınırları net, eşit boyutlu, aralarında içerik taşması olmadan oluşturulur. Çıktı `sharp` ile karelere ayrılır; önizleme ile her karo ayrı kayda eşlenir. **Onay öncesi mevcut görseli değiştirmez.** Yanlış karo / kalite bozulması halinde tekil üretime düşer.
- **Kalite:** 2x1 düzeni figür portreleri için başlangıç önerisi; 2x2 ancak yeterli ana çözünürlük sağlanırsa. 1536x1024 bir 2x2 kompozisyonda her karonun 768x512 olması kart ayrıntısı için zayıf kalabilir. Amaç toplam token azaltmak kadar karakter devamlılığıdır; grid üretimi her modelde bağımsız iki görsel kadar sadık davranmayabilir.
- **Kanonik referanslar:** Ham video karesi, onaylı ana varlık çizimi, olay/mekân çizimi ve sahnede kullanılan türevler ayrı tutulsun. Tek kayıt için birden çok referans, seçili “ana referans”, versiyon ve kaynak izi taşınsın; mevcut tek referans tablosundan uyumlu biçimde geçiş yapılsın.
- **Gözden geçirme:** İnceleme panosunda “bekliyor / referans hazır / üretildi / otomatik kontrol geçti / istisna / onaylandı / yeniden dene / görselsiz” durumları ve kayıtlar arası tutarlılık denetimi gösterilsin. Kayıtları tek tek onaylamak zorunlu olmasın: toplu geçiş ve kitap üzerinden son inceleme desteklensin. Çizimden evrene bilgi geri yazılmasın.

## Şu an entegre edilen ilk dilim
- `video-frame-capture.cjs`: kaynak kataloğunu doğrulayan, yerel video dosyası kalıcı saklamayan tek kare önizlemesi, isteğe bağlı kabul, iptal, geçici dosya temizliği.
- `video-cue-search.cjs`: yalnız seçili video için zaman kodlu VTT'yi geçici olarak getirir; saniye bazında ifadeyi arar, bellekte 20 dakika önbellekler.
- `VideoFrameSelector.tsx`: video kataloğunda arama, kaynak ID önceliği, zaman kodu ve +-5 sn, içeride oynatıcı, altyazıdan zaman bulma, kare önizleme ve onay.
- `visual-references.cjs`: eski referansları koruyan `source_seconds` ek sütunu; mevcut `source_video_id` devam eder.
- Bağlantı: `VisualProfileEditor`, `VisualCompletionWorkbench`, IPC/preload/type sözleşmeleri.

## Doğrulama
- `node apps/studio/verify-video-frame-capture.cjs`: video ID ve zaman doğrulaması, önizleme→WebP kayıt, silme/temizlik, kaynak saniyesi: başarılı (yerel simülasyon).
- `node apps/studio/verify-video-cue-search.cjs`: VTT zaman kodu, tekrar temizleme, Türkçe eşleşme ve seçili video: başarılı (yerel simülasyon).
- `node apps/studio/verify-visual-presets-reference.cjs`: mevcut stil, referans, Codex referans taşıma testleri: başarılı.
- Studio TypeScript/Vite derlemesi ve `git diff --check`: başarılı.
- Gerçek YouTube / canlı Studio arayüzü / gerçek Codex görsel üretimi henüz test edilmedi; dış kaynak ve uygulama ortamı doğrulaması yayın öncesi kapı olmalı.
- Commit, push, deploy ve Evren verisi işleme başlatılmadı.

## Sonraki bağımsız işler
A. Zaman kodu araması ve kare yakalamayı gerçek kaynak videosunda doğrula; gerekirse erişim hatasında alternatif yerel kare alma yöntemini iyileştir.
B. Çoklu kaynak referans kütüphanesi ve sahneler için referans levhası. Önce varlık ana çizimleri onaylansın.
C. Seri üretim kuyruğu, adayları ayrı saklama ve karo kesme / eşleme onayı. Yeterli çözünürlük ve gerçek kalite testinden sonra varsayılanlaştır.
D. İki aşamalı kalite kontrol: varlık tutarlılığı, sonra sahne/mekân sürekliliği. En son yayına hazırlık paketlerine görsel ilişkilerini taşı.

Not: Paralel davet/anlatı üretimi sürerken bu işlerden hiçbiri anlatı işleme dosyalarına veya çalışan veritabanı birleştirme görevlerine bağımlı hale getirilmemeli.

## 16 Kasım devamı — Sepet ve overlay entegrasyonu

### Tamamlanan
- Kayıt Dosyaları ve Görsel Tamamlama içindeki görsel editöründe ayrı **Video karesi seç ve kırp** overlay'i: seçili kaydın kaynak videoları önce gösterilir; arşivin diğer videoları isteğe bağlı açılır. Seçilen video içinde zaman kodlu altyazı aranabilir, doğrudan doğru saniyeden oynatılabilir, ±1/5 sn ve zaman çizgisiyle ayarlanabilir.
- Tek karenin ffmpeg üzerinden alınması, tam görsel önizlemesi, fare/kalem ile normalize koordinatlı kırpma alanı, onaydan önce arşive yazmama; onaylanınca WebP referans ve kaynak video ID/zaman/kırpma koordinatlarının saklanması. Daha önce üretilmiş kitap resmi etkilenmez.
- Görsel editöründe tekil **Görsel üret** korunurken **Sepete ekle** ve **Üretim sepeti** kontrolleri eklendi. Sepet arşivdeki onaylı Evren kayıtlarından tür filtresiyle toplu kayıt seçmeyi de destekliyor (görünen ilk 30 kaydı tek seferde seçme).
- Ayarlar → Görsel standartları altında **1 / 2 / 4 görsel/istek** seçimi kalıcı saklanıyor. Çoklu üretim tek yatay/2×2 kompozisyon olarak üretilip Sharp ile hücrelere bölünüyor; eşleşen preset ve boyutlardaki kayıtlar gruplanıyor, kalanlar tekil/ikili üretilebiliyor.
- Bekliyor / çalışıyor / aday hazır / hata durumları, duraklatma (mevcut istek tamamlandıktan sonra), yeniden dene, aday önizleme, tekil veya toplu kitaba uygula. Sonuçlar ayrı aday dizininde saklanıyor; kabul edilince mevcut görselin üzerine geçiyor, kabul öncesi mevcut kitabı değiştirmiyor. AI sağlayıcı/model üretim kaydından aktarılıyor.
- Evren anlatı üretimi, hikâye/editoryal onaylar, ilişkiler, SEO veya yayın/çeviri tablolarında değişiklik yapılmadı. Yeni bağımsız sepet tablosu ve referans metadata sütunları kullanılıyor.

### Teknik doğrulama ve sınırlar
- Studio TypeScript + Vite derlemesi başarılı.
- verify-video-frame-capture.cjs: zaman, kaynak izi, alan sınırı, kırpma, WebP dönüşümü ve temizleme.
- verify-video-cue-search.cjs: zaman kodlu VTT, Türkçe eşleşme.
- verify-visual-basket.cjs: kalıcı ayar, 1/2/4 gruplama, tek levhayı bağımsız karolara ayırma, model/sağlayıcı izi, onay öncesi resim koruması ve onay.
- Canlı YouTube oynatıcı/yt-dlp/ffmpeg akış erişimi ve gerçek Codex görsel üretimi burada uçtan uca çalıştırılmadı; üretim başlatılmadı. Dört hücreli 1536×1024 levhada hücre çözünürlüğü sınırlıdır; kalite denetimi ve yeniden deneme kullanılması önerilir.
- Electron ana süreç IPC yeniliklerini yüklemek için Studio'nun bir sonraki açılışta yeniden başlatılması gerekir. Mevcut paralel işlemleri kesmemek adına burada zorla kapatılmadı.
- Commit, push veya deploy yapılmadı.
