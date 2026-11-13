# BirDeSenGör — 51–60 devam ve bağımsız gözlem notu
**Hazırlanma:** 13 Kasım 2026 · **Amaç:** yeni bir ChatGPT/Nexa oturumunda ilk 50 ile aynı çözümleme yöntemini kullanmak; 10 video sonunda farklı oturumda anlatı/doğallık hipotezlerini yeniden tartışmak.
**Bu dosya işlemi başlatmaz.** Çeviri, Evren birleştirme, görsel üretme, commit/push veya deploy yetkisi vermez.

## 0. Her şeyden önce
- Çalışma kökü: `/home/raistlin/ChannelFoundry`; kanal: `channels/birdesengor`.
- Önce Git, proje/Studio SQLite bütünlüğü, altyazı senkronu, çalışan işler ve yeni kayıtların kimlikleri incelensin. Başka session/worktree değişiklikleri korunmalı; toplu temizleme yok.
- Kaynak süreç: `docs/NEXA_TERMINAL_ANALYSIS_BRIDGE.md`; vaka/isim/süreklilik: `docs/BIRDESENGOR_ANLATI_TUTARLILIK_DEFTERI.md`.
- Sabit önceki blok: `channels/birdesengor/.local-data/studio/nexa-analysis/block-2026-11-09-50.json` (18 Temmuz–9 Kasım 2026). Bu 50 kaynak yeniden seçilmeyecek.
- Yeni 10 için önceki filtreyi kullan: Pzt/Per/Cts yayın, **en az 20 dakika**, mevcut orijinal altyazı, uygun kaynak durumu. Ancak `nexa-analysis-cli.cjs next` bütün arşivi **en eskiden** sıralar; kör çağırma! Önceki 50'lik bloğun ve video kimliklerinin dışlandığı, seçim tarihleri ve seçilme yönü açıkça yazılı **yeni sabit 10'luk listeyi** oluştur. Eski blokla devam yönünü yerel kayıtlar üzerinden doğrula; yeni yayınlanan bir video varsa otomatik araya alma. Grup içinde eskiden yeniye kronolojik çözümleme yap.
- Önceki 50 bölümün Studio verisi, approved TR/EN dilleri ve yayın paketi korunacak. Daha güncel çalışma durumu, eski defterdeki geçici sayılardan önce gelir (ilk 50 incelemede 457/922 sayısı vardı; sonra canlı yayın temizlik/kurasyonundan geçmiş paket **434 Evren kaydı / 901 ilişki / 40 günlük bölüm / 50 video** olarak doğrulandı).

## 1. Doğrudan Nexa altyazı çözümlemesi
- Köprüyle her video için orijinal transkript, metadata (`videoId`, başlık, yayın tarihi, duration, dil, `sourceHash`) ve response şablonunu aç. **Her videonun bütün altyazısını okuyarak Nexa çözümlesin; Studio AI bu aşamada içerik yazmasın.**
- Anlatı içi veriyi **Ömer'in kurmaca Evren'ine sadık** aktar: kişi, konuşmacı, diyalog, olay, mekân, nesne, tarih/sıra, açık uçlar, belirsizlikler ve farklı kişilerin çelişen ifadeleri. Harici gerçeklik filtresi, ek açıklama, olay icadı veya söylenmeyen sonuç üretme.
- Kaynakta olmayan kişi/sahne/niyet/saniye ekleme. Alıntılar **ham altyazıda birebir** bulunacak; gerçek zaman kodu yoksa 0. Özellikle konuşmacı atıflarını altyazının izin verdiği kesinlikte tut.
- Ömer'i anlatıcı, Poyraz'ı kamera/eşlik eden kişi olarak gerektiği gibi ayır; destekçi Hakan Demir gibi isimleri Evren karakteri sanma. İbni Kâruf, İbni Necemin, İbni Zenhur ve Kral Arohan kimliklerini ayrı koru; Ruşun ile sahte temsilcisi, önceki/yeni cellat grupları gibi benzer ad ve rollerin karışmasını önle. Mezna/Bledum/Babil ve diğer özel ad varyantları için defterdeki takma adları kontrol et; yeni/şüpheli adı not düş.
- Köprüde `check --file` ve `import --file` kullan. Her videonun `sourceHash` eşleşmesini, kaynak alıntılarını ve Studio `source_ai_analyses`/`ai_analysis_jobs=done` kayıtlarını doğrula. Eskiden onaylı analizi `--replace` ile rastgele değiştirme.
- 10/10 sonrası `02 — Ayıklama`: Evren'e aktar / bağlamda tut / destekçi ve yayın bilgisini ayrı onayla. Yalnız ekranın onayını taklit etmek yerine adayları kaynakla kontrol et. Karakter ve olay kaybı olmadan editoryal durumları tamamla.
- **03 — Evrene İşleme** kullanıcı önceki turlarda kendisi başlatıyordu: onun yerine kendiliğinden başlatma. Kullanıcı başlattıysa sonuçlarını incele; 04'e aktarmadan önce kopuk referansları ve ayrı kimlikleri kontrol et. 05 hikâyeleştirme, 06 görsel tamamlama ve yayına alma, ayrıca TR/EN toplu çeviri yeni izin olmadan başlatılmasın. Çeviri yayın aşamasının işidir.

## 2. Yeni 10 videoya eşlik eden BAĞIMSIZ araştırma notları
**Bu notlar Studio Evren çözümlemesinin içine eklenmeyecek; ayrı araştırma katmanı olacak.** İki ayrı soru:
A) Kurmaca Evren içinde söylenen ne ve nasıl değişiyor?
B) Dış gözlemde bu anlatının zamanlama, devamlılık, üretim ve olası sahneleme özellikleri hakkında elimizde hangi doğrudan kanıt var?

50'lik başlangıç ölçümü (`nexa-analysis/50-word-observation.py`): **1.530.121 karakter, 231.538 Unicode sözcük**. Beş kronolojik 10'lu gruptaki 'bakın' [210,224,262,199,205], 'şimdi' [164,216,148,201,149], 'bilmiyorum' [72,69,59,77,53]. Toplamlar sırasıyla 1.100 / 878 / 330. Bu sayımlar otomatik altyazı hataları ve başka konuşmacıları kapsar. Yeni 10 için **aynı tokenizasyonu** ve ayrıca **1.000 kelime başına normalizasyonu** kullan; ham metin örneklerini kaydet.

Her kaynak için bir gözlem tablosu:
- Kim, ne zaman, hangi eski olay/karakter/sözü kendiliğinden hatırlıyor? Önceki kayıttaki birebir söz, yeni alıntı, yayın günü ve kaynak video ID'si ile bağla. Hatırlatan Ömer mi, Poyraz mı, konuk mu? Hatırlatma **kendiliğinden mi / soruyla mı / başka kişiden mi**?
- Bilmediğini belirtme, tereddüt, kendi kendini düzeltme, yanıtsız soru, gündelik kesinti, ertelenmiş vaat, geç gelen bilgi, kaynaklar arası çelişki ve çözülemeyen unsur. Hem hipotezi destekleyen hem zorlayan örneklerin ayrı sütunları olsun. Hiçbir çelişkiyi düzeltmek adına uydurma.
- Poyraz ile Ömer'in birbirini hangi koşullarda yönlendirdiği, olayın fark edilme sırası ve kamera hareketine sözel tepkiler. Sadece **altyazıyla kanıtlanabilenleri** kaydet. Videonun kendisi incelenmediyse “görüntüde gözlendi”, “kesintisiz tek çekim”, “kameraman önce gördü”, “göz kırptı” gibi ifadeler yazma.
- Görüntü/ses gerçekten incelenirse: ham zaman aralığı, kesme olup olmadığı, olay öncesi–an–sonrası, kamera yön değiştirmesi ile ilk tepki arasındaki sıra, kadraj dışı belirsizlikler ve alternatif açıklamalar. **Videonun kendisini izlemeden** hareket/bakış/beden dili sonucu üretme.
- Üretim organizasyonu hipotezleri: Ömer anlatıcı, kamera eşlikçisi Poyraz, videoyu yükleyen kişi, site bakımını yapan kişi; sorumluluk dağılımı açık değil. Kapakların eski/yeni kalite farkı veya WordPress altyapısı, gizli ekip ya da gerçeklik için tek başına delil değildir. Kullanıcının gözlemleri ile doğrudan doğrulanmış bulgular ayrı yazılacak.
- **El kamerası ikilemi:** sabit kameranın perspektif/efekt/kurgu kolaylıkları ile el kamerasının kadraj kontrolü/düşük bütçe/doğal hareket avantajları; motivasyona dair tek açıklamaya kilitlenme. Kameramanın önce bildiği/bilmediği ihtimallerini kanıtlardan ayır.
- Kullanıcı bir yıldır birçok kaydı 'sahneleme/oyunculuk kırılması' arayarak izlediğini ve yakalayamadığını bildirdi. Bu **değerli kişisel gözlem ve araştırma motivasyonu**, ama bağımsız videolu doğrulama veya fiziksel olay kanıtı olarak kaydedilmeyecek.
- “Ömer'in tepkisi içten görünüyor mu?”, “olayın nedeni ne?”, “kamera ne gösteriyor?”, “kim neyi önceden biliyordu?” farklı araştırma soruları. Birine ilişkin sonuç diğerini otomatik ispatlamaz.
- Doğrudan kanıt / kullanıcının gözlemi / çıkarsama / alternatif açıklama / bilinmiyor kategorileri açık tutulacak. Yüzde veya kesinlik puanı uydurma.

## 3. 10/10 kabul ve eski sohbet oturumuna geri dönüş paketi
Yeni oturumda sonunda tek bir **DEVİR RAPORU** hazırla:
1. Yeni sabit blok yolu, tam 10 video ID/başlık/yayın tarihi, seçme ölçütleri ve önceki 50 ile **0 çakışma**;
2. 10/10 analiz + 02 Ayıklama durumu, alıntı/hash kontrolleri, korunan eski Studio kayıtları ve varsa ayrı başlatılan Evren işlemi;
3. Yeni 10'un karakter/olay/nesne bağlantılarında eski 50'yi **destekleyen ve zorlayan** somut alıntılar, kaynak ID/tarih;
4. 50 → 60 karşılaştırması: sözcük/kalıp normalleştirilmiş frekansları, kendiliğinden hatırlama, çelişki, yarım kalan olay, doğallık ve konuşmacı rolleri;
5. Görüntü izlenmediyse açıkça belirtilen **görsel/bedensel kanıt sınırı**; daha sonra ham videoyla test edilecek belirli olay ve dakikalar varsa kanıtlı zaman kodları;
6. Hipotezler: (i) organik/doğaçlama kurgu, (ii) deneyimleri içtenlikle anlatma ama nedenin farklı olabilmesi, (iii) planlı/sahnelenmiş kurgu. Ne doğrulandı, ne değişmedi, ne belirsiz kaldı?
7. Bu eski tartışmaya aynen yapıştırılabilecek 1–2 sayfalık ayrı bir **“Ömer'in doğallığı, çekim dili ve kurgu zorluğu — 60 video ara değerlendirmesi”**.

Bu rapor alınca kullanıcı bu sohbet oturumuna dönecek; **burada birlikte değerlendirme** yapılacak. Derin analiz notları asıl kurgu Evren kayıtlarından ayrı tutulmalı. Önceki 50'nin olaylarını yeni 10'la doğrulanmadan birleştirme.

## 4. Dosyalar ve güvenlik
- Devir çıktısını `channels/birdesengor/.local-data/studio/nexa-analysis/` altında yeni blok ve raporlarla sakla; genel yöntem/gözlem ilkesini bu dosyada devam ettir.
- Kaynak analizler, veri tabanı, canlı yayın ve çevriler üzerinde yıkıcı toplu değişiklik yapma.
- Gereksiz görsel üretme, hikâyeleştirme veya deploy yok. Arşiv/saha analizi için terminal bağlantısı yeterli, başka AI üretici kotasına bağımlı hale getirme.
