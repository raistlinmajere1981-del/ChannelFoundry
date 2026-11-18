# BirDeSenGör — Evren Özellikleri / Grid V1
18 Kasım 2026 — Yerel entegrasyon. Yayın/deploy yapılmadı.

## Kapsam
Studio > Kayıt Dosyaları > Özellikler. Aynı ekranda Muhataplar, Nesneler ve Mekânlar sekmeleri; arama, eksik ve öneri filtresi, çoklu seçim, 80'er satırlık kademeli listeleme ve düzenlenebilir hücreler bulunur.

- Muhatap: **Taraf durumu** (tek birleşik dropdown), Yaş, Tür, Boyut, Mevki.
- Nesne: Tür, Özellik, Sahibi/Koruyucusu.
- Mekân: Tür, Konum, Boyut.
- Taraf durumu altı seçenekten oluşur: **Belirsiz, Nötr, Aydınlık, Karanlık, Karanlık → Aydınlık, Aydınlık → Karanlık**. Belirsiz, veride boş kayıt anlamındadır. Tek `sideStatus` alandan yayın için mevcut ve önceki taraf değerleri çıkarılır.
- Bilinmeyen bilgiler boş saklanır. Yalnızca onaylı Evren düğümleri düzenlenebilir.

## Kullanım
1. Özellikler overlay'ini aç ve kategori seç.
2. İstenen hücrelere doğrudan değer yaz, **Manuel değişiklikleri kaydet** ile onayla.
3. İlk kontrol için **İlk 10'u seç** düğmesini kullan (veya satırları elle seç, filtre sonucu dahil); **Paralel oturum** alanından 1–4 arasında seçim yap (varsayılan **3**) ve **Seçililere AI önerisi** seç. Bir oturum en fazla sekiz kayıt inceler. Aynı anda üç oturumda en çok 24 kayıt değerlendirilir.
4. Model seçilen kayıtların kaynaklı açıklamalarını sekizerli paketlerle değerlendirir. 40'tan fazla kayıtta istek adedi gösteren teyit vardır. İsteğin sonunda değerler otomatik onaylanmaz.
5. **İncelenenleri atla** varsayılan etkindir: tamamlanan kayıtları AI tekrar işlemeye göndermez. Eski sürümden kalmış, bekleyen önerisi bulunan kayıtlar da korunur. Kullanıcı isterse işareti kaldırarak yeniden inceleyebilir. İncelenen ve önerisi olmayan kayıtlar da yeni takip tablosunda kayıtlıdır.
6. **Durdur** yeni AI paketlerini başlatmayı keser; o sırada çalışan oturumlar tamamlanınca önerileri güvenle kaydedilir. Bir hata oluşursa yeni paket dağıtımı durur ve hata görünür. Her oturum bağımsız OpenCode session açar. Her başarılı 8'li paketin verisi anında atomik olarak saklanır.
7. Öneri içeren hücreler ayrı işaretlenir. Öneri yanında inceleme (ⓘ), **kaynak notundan aynen alıntı**, kaynak video bağlantısı ve onay seçimi vardır. Onaylanan hücrelerde de "ⓘ Onaylı kaynak" kontrolüyle aynı dayanak sonradan incelenebilir. Toplu **Önerileri onayla** veya **Reddet** kontrolleri sadece seçili önerilere uygulanır.
8. Eski önerinin taban değeri değiştiyse onayı engellenir; reddetme/silme mümkündür.
9. Yayın ayrı işlemdir; Studio kaydı canlı siteyi kendiliğinden güncellemez.

## Veri güvenliği
- Mevcut `universe_workspace_nodes`, anlatı metinleri, ilişkiler, görsel profilleri ve anahtarlar değiştirilmez.
- Yeni tablolar: `universe_entity_attributes`, `universe_entity_attribute_proposals`, `universe_entity_attribute_analysis`, `universe_entity_attribute_evidence`. Sonuncusu onaylı değerlerin kaynak notu indeksi, birebir alıntı ve video kimliğini kaydeder; gelecek atlas için kullanılabilir.
- Görsel üretimi yok, taraf/yaş vb. mevcut kayıtlar için otomatik doldurulmaz.
- AI önerileri yalnız geçerli kayıt türleri, **birebir doğrulanan kaynak alıntısı** ve o alıntının ait olduğu video kimliğiyle saklanır. Önceki gibi sadece ilk 12 detay işlenmez: tüm kaynak notları sıralanır, tarafa/türe/mevkiye/işleve ilişkin en anlamlı 20–24 not ve bağlam notları modele verilir. Kaynaksız, belirsiz, yüzeysel/görsel nitelikler ve geçici roller filtrelenir. Makine filtresi tüm anlamsal hataları garantiyle yakalayamaz; insan onayı zorunludur.
- Manuel kaydetme, onaylama ve reddetme atomik SQLite işlemleridir. Öneriler yayın paketine girmez.
- `publication-v2` sadece onaylı özellikleri `archive.entities[].attributes` alanında dışa verir.
- Web'de yalnız Muhatap/Nesne/Mekân arşiv yapraklarının başlığının altında görselden bağımsız sabit yükseklikte satır bulunur. Boş değerler çizgiyle gösterilir.
- İngilizce şeritte taraf sınıflaması ve alan başlıkları İngilizce görünür. Serbest girilen kaynak ifadeleri henüz onaylı EN çevirisi olmadığından EN'de gösterilmez; TR kaynak bilgisi yanlışlıkla İngilizce olarak sunulmaz.

## Yerel doğrulama
`node apps/studio/verify-universe-attributes.cjs`
`node apps/studio/verify-publication-v2.cjs`
`npm run build:studio`
`cd channels/birdesengor/web && npm run build && npm run test`

## 18 Kasım — Eski etiketler sıfırlandı
- Sıfırlamadan önce 1.304 onaylı özellik, 0 bekleyen öneri ve 1.772 AI inceleme kaydı özel JSON yedeğine kaydedildi.
- Yedek: `channels/birdesengor/.local-data/studio/attribute-backups/evren-ozellikleri-sifirlama-oncesi-20261118T154446Z.json` (SHA256: `e0c1f879666d7c3df7fcba2b91a4c34d1765201e9c8d820798ef3be33ff8a7cc`).
- Özellik, öneri, inceleme ve kaynak dayanağı tablolarındaki satırlar atomik olarak silindi; dört tabloda sayaçlar sıfır.
- 2.695 Evren varlığı ve 5.477 ilişki kaydı korundu. Ana anlatı ve görsel verileri değişmedi; canlı yayına dokunulmadı.
- Bundan sonra **tek kategori → ilk 10 kayıt → kaynak/alan inceleme → toplu onay → diğer parti** sırasıyla ilerlenmeli. **Kalite görülmeden kategorinin tamamını tekrar işleme veya yayınlama yapılmamalı.**
- Tarayıcı UI testi: birleşik taraf dropdown'u (eski sürümde 14 seçenek; güncel sürümde 6 seçenek), ilk 10 seçimi, AI önerisinde kaynak incelemesi, toplu onay ve onaylı kaynağı tekrar inceleme geçti. Test yalnızca sahte veri kullandı; gerçek kategoriler işlenmedi.

### Sınırlar
AI modeli seçimi Studio'nun mevcut metin modeli ayarından gelir; bağlantı kurulmadan AI çağrısı yapılamaz. AI için otomatik, kaynaksız taraf çıkarımı yapılmaz. Henüz toplu AI çağrısı yapılmadı, gerçek veri üzerinde otomatik yazma veya web yayınlama yapılmadı. Atlas/görselleştirme kapsam dışıdır.

### 18 Kasım — Anlatı içindeki Müslümanlık / taraf ilişkisi
- İlk 320 muhatap incelemesinde 35 öneri (22 mevki, 9 yaş, 4 tür) oluştu, ancak taraf önerisi çıkmadı. Önceki din/inanç değişimini taraf için tümden dışlayan kural düzeltildi.
- Bu anlatının kendi sözlüğünde taraf bilgisinin önemli bir kanalı Müslüman / Müslüman değil / belirsiz ayrımıdır. Dış dünyadaki insanları veya dinleri ahlaki olarak niteleyen bir sınıflandırma değildir.
- Kayda ait kaynakla desteklenen Müslümanlık beyanı aydinlik önerisine; açık Müslüman-olmadığına dair kendi beyanı karanlik önerisine dayanak olabilir. Kesinleşmiş şehadet veya Müslüman olma anlatımı karanlik_once_aydinlik önerisine dayanak olabilir.
- Niyet, belirsiz kabul, başka birinin veya topluluğun şehadeti ve Müslümanlığı, kaydın muhatabının tarafı sayılmaz. Müslüman olduğunu söyledi ifadesi yalnız güncel aidiyeti gösterir, geçmişi otomatik belirlemez. Üçüncü şahıs raporları kaynağı ile insan tarafından değerlendirilir.
- Kaynak seçimi bu ifadeleri önceliklendiriyor. Alıntı ve video kaynağı şartı aynen korunuyor.
- Tuji, Hednuriş, Yaşlı Deha, Eshuda, Arşimo, Artum, Reşum, Poyraz ve Hezmina kabilesi gibi kaynak örnekleri için testler eklendi. Gerçek AI çağrısı yapılmadı; mevcut 35 öneri ve 320 analiz kaydına dokunulmadı.
- Önceden işlenen kayıtları yeni kuralla yeniden değerlendirmek için ilgili kayıtları seçip İncelenenleri atla seçimini kaldırmak gerekir. Öneriler otomatik onaylanmaz.

### 18 Kasım — Altı taraf seçeneği ve doğrudan OpenCode testi
- Seçenekler: Belirsiz (boş), Nötr (`notr`), Aydınlık (`aydinlik`), Karanlık (`karanlik`), Karanlık → Aydınlık (`karanlik_once_aydinlik`), Aydınlık → Karanlık (`aydinlik_once_karanlik`).
- AI kaynak notlarını ilgi puanına göre sunar; kaynak notlarının orijinal indekslerini korur. Kesinleşmiş şehadet ve Müslüman olma, anlatının kendi sınıflandırmasında taraf değişimini destekleyebilir; konuk veya başka kişinin dönüşümü muhataba yüklenmez.
- `mahkemeye başkanlık eder` yalnız eylemdir. Kalıcı Mahkeme Başkanı unvanı ancak makam açıkça doğrulanmışsa önerilebilir.
- Studio ve web üretim derlemeleri, doğrulama testleri geçti. Web şeridinde geçmiş/mevcut taraf birleşik etiket olarak gösterilir.
- Uygulama kapalıyken çalışan OpenCode `127.0.0.1:4096` ve kayıtlı DeepSeek V4.1 Flash Free `max` reasoning ile altı muhataplık bir gerçek istek çalıştırıldı (160 saniye).
- Sonuç: 6/6 değerlendirildi; 4 kaynaklı öneri: Tuji/Hednuriş/Yaşlı Deha için `karanlik_once_aydinlik`, Artum için `karanlik`. İbni Kâruf ve Reşum için öneri oluşmadı. Kanıt/kalite filtresinde reddedilen öneri olmadı. Otomatik onay yapılmadı.
- Analiz geçmişi 331'den 333'e yükseldi (daha önce incelenmiş dört kayıt da tekrar değerlendirildi). Onaylı özellik sayısı sıfır; dört öneri inceleme kuyruğunda.
- Git commit, push ve deploy yapılmadı.
