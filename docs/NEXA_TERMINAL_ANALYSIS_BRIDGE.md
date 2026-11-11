# BirDeSenGör — Nexa Terminal Çözümleme Köprüsü

Köprü, bu ChatGPT sohbetindeki Nexa'nın yetkili terminal bağlantısı ile kullanımı içindir. Bağımsız bir ChatGPT API bağlantısı değildir; Codex/OpenCode/başka bir AI sağlayıcısı başlatmaz. Studio'nun normal AI kuyruğu korunur.

## Günlük kullanım

**İlk 50'lik gerçek içerik bloğu sabittir:** `channels/birdesengor/.local-data/studio/nexa-analysis/block-2026-11-09-50.json`. Pazartesi/perşembe/cumartesi yayınlanan, en az 20 dakikalık son 50 altyazılı video seçilmiştir. Her 10'lu grup kendi içinde eskiden yeniye işlenir. Aşağıdaki genel `next` komutu bütün arşivde en eskiden seçer; **sabit blok seçiminin yerine kullanılmaz**. İlk 10 zaten işlenmiştir; Evren birleştirmesi 10 video üzerinden, görsel üretimi ise 50 video sonunda planlanmıştır.

Proje kökünde:

    node apps/studio/nexa-analysis-cli.cjs next --count 3

Aktif kanalın yalnızca altyazısı olan, tamamlanmamış videolarını yayın tarihi artan sırada seçer. Aynı tarihlerde video kimliğiyle sabit sıra kullanılır. Normal AI kuyruğundaki işleri atlar. Altyazısı değişmiş ve kaynağı artık uyuşmayan çözümlemeler yeniden aday olur; eski kaynak hash'i bulunmayan analizler otomatik tekrar seçilmez.

Her video için üç dosya oluşturur:

- requests/VIDEO-HASH.transcript.txt — Orijinal altyazı, satır satır okunabilir.
- requests/VIDEO-HASH.request.json — Başlık, tarih, dil, SHA-256 kaynak hash'i ve çözümleme kuralları.
- responses/VIDEO-HASH.response.json — Nexa'nın dolduracağı Studio sonuç şablonu.

Varsayılan dizin: channels/AKTIF-KANAL/.local-data/studio/nexa-analysis/. Kaynak altyazılar gerçek çalışma verisidir; Git'e eklenmemelidir.

Nexa bütün altyazıyı okuyup yapılandırılmış çözümlemeyi hazırlar. İçerikler anlatıcının kendi Evren'inin olayları olarak işlenir; çözümlemeye dışarıdan doğruluk, gerçek dünya uyarısı veya değer yargısı eklenmez. Kaynakta bulunmayan sahne, neden, kişi veya konuşma da uydurulmaz. Özel isimler ve Arapça yazılar korunur; kanonik karakter ve mekân adları `docs/BIRDESENGOR_ANLATI_TUTARLILIK_DEFTERI.md` üzerinden eşleştirilir. Ham altyazılar değiştirilmez. Destekçiler Evren muhatabı yapılmaz. Evidence alıntıları transkriptte birebir bulunmak zorundadır. Kaynakta zaman yoksa saniye uydurulmaz (0 kullanılır).

Doğrula (veritabanına yazmaz):

    node apps/studio/nexa-analysis-cli.cjs check --file /tam/yol/VIDEO-HASH.response.json

İçe aktar:

    node apps/studio/nexa-analysis-cli.cjs import --file /tam/yol/VIDEO-HASH.response.json

Mevcut çözümlemeyi özellikle yenilemek için --replace gerekir. Eski yanıtın altyazı hash'i değişmişse içe aktarım reddedilir; önce yeniden dışa aktarmak gerekir.

## Studio davranışı

- Kaydedilen çözümlemeler mevcut source_ai_analyses ve ai_analysis_jobs tablolarına girer; iş durumu done olur.
- Kaynak ChatGPT GPT-6 / Nexa (terminal) olarak işaretlenir.
- **Ek onay ekranı yoktur.** Evren'e ekle / bağlam / dışarıda bırak şeklindeki mevcut pending editoryal inceleme korunur.
- Dil kaynağı eşitlenir, ancak sistem başka AI ile otomatik çeviri üretmez.
- Studio penceresi yeniden odaklandığında çözümleme listesi güncellenir.
- Bu işlem Evren birleştirme, anlatı onayı, yayınlama veya deploy yapmaz.

## Güvenlik ve sınırlar

Köprü yalnız aktif kanalın videolarına erişir; JSON yapısını, kaynak hash'ini ve alıntıların doğruluğunu denetler. Çalışmakta olan normal AI işinin üzerine yazmaz. Tekrar oluşturulan şablon, üzerinde çalışılan cevap dosyasını ezmez.

VTT kaynakları şu anda düzleştirilmiş metin olabilir. Bu durumda alıntı için kesin saniye verilemez; gerekirse orijinal video/ses ayrıca kontrol edilir.

## Test

    node --test apps/studio/nexa-analysis-bridge.test.cjs
    node apps/studio/verify-ai-analysis.cjs
    node apps/studio/verify-analysis-editorial.cjs

Testler gerçek kanal veritabanına analiz yazmaz.

## Örnek sohbet talimatı

Nexa, tarih sırasına göre çözümlemesi yapılmamış sıradaki 3 videoyu çözümle. Altyazıları eksiksiz oku, Studio şemasında doğrula ve sonuçları mevcut çözümleme kayıtlarına aktar. Evren onaylarını veya yayını değiştirme.
