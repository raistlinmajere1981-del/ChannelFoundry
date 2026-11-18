# BirDeSenGör — 18 Kasım 2026 Session Devir Notu

## Kapsam
- Tek sahnede kamera/projeksiyon düzeni, ekransız kamera yüzeyi, kapalı kitap görsel revizyonları, sahne varlık optimizasyonları ve 2:1 arka plan revizyonları web deposunda.
- Kayıt Dosyaları görsel sepeti üst bara taşındı. Kaydın içinde yalnız “Sepete ekle” var; başarı sonrası bekleyen görsel profili otomatik kaydediliyor, kayıt değiştirirken gereksiz uyarı çıkmıyor.
- Studio OpenCode yerel sunucuyu algılıyor, opsiyonel parolayla test ediyor, bağlantıdan sonra modelleri getiriyor ve modelin gerçek reasoning variant'larını kullandırıyor.
- Evren Özellikleri overlay'i: Muhatap/Nesne/Mekân grid, seçim, paralel 1–4 AI oturumu, incelenenleri atla, 8'li gruplar, kaynak alıntılı AI önerisi, manuel/toplu onay, kaydedilen kaynak dayanağı.
- Muhatap taraf durumu altı seçenek: Belirsiz, Nötr, Aydınlık, Karanlık, Karanlık → Aydınlık, Aydınlık → Karanlık. Anlatının kendi sınıflandırmasındaki Müslümanlık/sonradan şehadet ilişkisi değerlendirilir; başka kişinin dönüşümü muhataba mal edilmez.
- Yüzeysel tür/mevki önerileri sınırlı tutuluyor: Bir mahkemeye bir defa başkanlık etmek, kalıcı Mahkeme Başkanı unvanını doğrulamaz.
- İlk eski parti etiketleri yedeklendi ve silindi. Gerçek AI testinde Tuji, Hednuriş, Yaşlı Deha için Karanlık → Aydınlık, Artum için Karanlık bulundu; Reşum ve İbni Kâruf için alan önerilmedi.
- Daha sonraki küçük partilerde AI az öneri oluşturdu. Kullanıcı etiketleme kalite çalışmalarına şimdilik ara verdi.

## Yayın ve veri durumu
- Yerel DB inceleme geçmişi yayınlanmaz. Yalnız onaylı profil alanları archive.entities[].attributes içine girer.
- Son kontrol: 18 onaylı profil, 0 bekleyen öneri, 333 AI inceleme kaydı.
- Canlıya yönelik güvenli güncelleme kuru denemesi: yalnız 18 arşiv kaydının attributes alanı değişiyor; 276 bölüm, 2.695 varlık, 5.477 ilişki, dört portre ve mevcut çeviri metinleri korunuyor. Yeni görsel yüklemesi gerekmiyor.
- publication-updates.cjs yeni attributes alanını güvenli güncellemede taşır ve yerelde eksik profil yüzünden canlıdaki portreleri silmez.
- BookPages.jsx görselden bağımsız özellik şeridini kullanır ve geçmiş/mevcut tarafı tek okunabilir etiket olarak gösterir.
- Tam yayın yalnız gerekirse; mevcut onaylı özellikler için güvenli güncelleme yeterli. AI taslakları aktarılmamalı.

## Sonraki session öncelikleri
1. Kullanıcı ve site sahibinin canlı sahne, kamera, kitap kapakları ve özellik şeritlerini gözle değerlendirmesi.
2. Görsel sepetindeki görselleri kullanıcı kendi üretir; görsel tamamlanma zorunluluğu yayını engellememeli.
3. Özellik/atlas işine dönüldüğünde önce taraf–boyut–mevki kalitesini küçük örneklemde kontrol etmek; bütün 570/651/551 kayda toplu AI taraması yapmamak.
4. Serbest özellik metinlerinin EN çevirisi için ayrı bir onaylı çeviri akışı gerekebilir. Şu an EN'de çevrilmemiş değerler gizlenir.
5. Atlas için kitabın son iki yaprağında etkileşimli taraf/boyut görselleştirmesi sonraki aşamadır; bugün atlas geliştirmesi yapılmadı.

## Git, deploy ve güvenlik
- Ana repo ~/ChannelFoundry, git submodule channels/birdesengor/web ayrı GitHub deposudur. Web önce commit/push, sonra ana repoda güncel gitlink commit/push gerekir.
- FTPS yapılandırması korumalı ~/.config/channel-foundry/birdesengor-natro.env dosyasındadır. Git'e ekleme veya içeriğini gösterme.
- Statik deploy: channels/birdesengor/web/scripts/deploy-natro.mjs; site kökünde content/ hariçtir.
- Güvenli içerik güncellemesi: publication-updates.cjs ile canlı manifestle karşılaştırma; sonra scripts/deploy-publication-review-natro.mjs ile yalnız content/ manifestini atomik güncelleme.
- Tasarım inceleme giriş kapısı ve arama motorlarına kapalı durum şimdilik korunmalı. SEO ve açılış bu session kapsamı dışındadır.
- Sahne testlerindeki eski kaynak ölçüsü ve sabit koordinat beklentileri yeni fiziksel nesne konumlarına uyumlandı.

## 18 Kasım canlı yayın tamamlanma sonucu
- Web ana dal commit/push: 8ebdc51, sahne/kamera/kapak görselleri ve özellik şeridi.
- Studio/ana dal ilk commit/push: cfbb12b, özellik sistemi/OpenCode/sepet/publish güncellemeleri ve web gitlink.
- Webin statik V2 deploy'u doğrulanmış FTPS hattından tamamlandı, content/ klasörü bu aşamada korunarak aktarıldı.
- Sonra yalnız 18 onaylı özelliği taşıyan güvenli Evren manifesti atomik FTPS deploy ile güncellendi. Öncesinde canlı paketin özel geri dönüş kopyası alındı.
- Eski manifest: pub-9d5a9dd539d0bd8d356cb42f
- Yeni canlı manifest: pub-67e6c237405e9868fd316870
- Canlıdan tekrar okuma: 18 kayıt, 276 anlatı, 2695 varlık, 5477 ilişki, 4 görsel. Tuji ve Hednuriş birleşik taraf etiketleri doğrulandı.
- npm run verify:live PASS: HTTPS şifreli giriş, API okuma, sahne varlığı SHA ve eski sahne dosyalarının bulunmaması.
- Sonuç kullanıcı gözlemi için hazır: https://birdesengorgizlievren.com
- Bu session'da arama motoru kısıtlaması, giriş şifresi ve topluluk yönetimi değiştirilmedi.

## Test notu
- Web birim testleri: 289/289 geçti, üretim derlemesi geçti.
- Studio sahne ölçüsü/görünürlük testleri güncellendi ve geçti; yayın merkezi tarayıcı testi güncellendi ve geçti.
- Geniş Studio release zinciri ve web foundation e2e zinciri bazı eskimiş beklentilerden dolayı ilk seferde tamamen yeşil olmadı; kamera yerleşimi ve reduced-motion davranışı nedeniyle foundation testleri yeniden gözden geçirilmek üzere sonraki kalite turuna bırakıldı. Dağıtım planı, çalışma derlemeleri ve canlı doğrulama betikleri başarılıdır.
- Kullanıcı ve site sahibi görsel kabul turunda sahne, kamera ve Evren sayfalarındaki şeritleri incelemeli; hatalar bir sonraki session'da topluca ele alınabilir.
