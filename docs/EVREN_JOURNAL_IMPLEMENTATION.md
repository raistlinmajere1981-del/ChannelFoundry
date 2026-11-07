# BirDeSenGör — Evren Kitabı / Yaşayan Günlük

7 Kasım 2026 — uygulama notu. İlgili repolar: ChannelFoundry ve `channels/birdesengor/web` (ayrı Git deposu/submodule).

## Ürün sınırları

- Studio: kanal sahibinin onaylı anlatıları, değişmeyen bölüm kimlikleri, seri/alt bölüm düzeni, anlatıcı profili, kaynak izi.
- Web: **tek kalıcı fiziksel Grabfold kitap**; içindekiler, arşiv dizini, gerçek sayfalar, gezinme ve ayraç. Studio sayfa/spread numarası üretmez.
- Her iddia kaynak zincirinde kalır. Birinci şahıs yalnız anlatıcıya gerçekten atfedilen eylemlerde kullanılabilir; misafir anlatımı ve duyumlar ayrıştırılır. Kaynaklanmamış deneyim/duygu/olay icat edilmez.
- Onaysız Evren kayıtları / video katalog adayları kendiliğinden kamuya yayınlanmaz.
- Vefk, kamera, topluluk defteri ve bağımsız yayın sözleşmeleri korunur.

## Uygulanan ilk dilim

### Studio

- `apps/studio/narrative-outline.cjs`: `narrative_series`, `narrative_chapters` ve `narrative_section_chapters` tabloları. Onaylı aktif `sectionKey` olmadan anı eşleştirmesi yapılamaz. Tek anı bir dizide bir alt bölüme ait olabilir; arşiv referansları çoktan çoğa ayrı ilişki katmanında kalır. Eski `narrative_narrator_profile` yalnız tek yönlü ayar geçişinin girdisidir; yeni veritabanlarında oluşturulmaz.
- `narrative-ipc.cjs`, `preload.cjs`, `NarrativeOutlineWorkbench.tsx`: dizi, alt bölüm oluşturma/düzenleme, anıları içindekiler ağacına bağlama. Anlatıcı yalnız **Ayarlar → Kanal Ayarları** içinde düzenlenir; mevcut `channel-projects.cjs` / `channel.json` altyapısında tutulur. Ayar değişiklikleri hazırlanmış turun frozen profilini etkilemez. Ayrıntılar: [Aşama 1 teslim notu](CHANNEL_NARRATOR_STAGE1.md).
- `narrative-ai-contract.cjs`, `narrative-ai-generation.cjs`: kaynaklara bağlı ben dili / tarafsız mod; doğrudan yaşama, aktarma, yorumlama ayrımı. Profil prepared run içinde frozen saklanır.
- `publication-v2.cjs`: `journal.outline` altında narrator, series / chapters / sectionIds, ungroupedSectionIds. Yayın yalnız mevcut onaylı anlatı kimliklerini taşır; kimlikler ve değişiklikler içerik fingerprint'ine girer.

### Web

- `src/data/publication.js`: geriye uyumlu `journal.outline` normalizasyonu ve section kaynak kimliklerinin korunması.
- `src/book/bookModel.js`: içindekiler ve kategori dizini için fiziksel yapraklar; section/entity/index için `id -> pageIndex -> Grabfold position`. Sayfa numarası sadece tarayıcıda üretilir.
- `BookIndexPages.jsx`, `BookPages.jsx`, `GrabfoldJournal.jsx`, `App.jsx`: içindekilerden anlatıya, evren dizininden arşive, arşivden ilgili anlatıya dönme. Aynı kitap ve mevcut ayraç yığını kullanılır.
- Boş yayın: hayalî/deneme içerik göstermeyen boş yaprak.

## Gerçek kaynak durumunun yorumu

İnceleme anında Studio SQLite içinde **0 onaylı anlatı** ve **0 onaylı Evren kaydı** vardı. Önceki `public-export/content/publication.json` dosyası hâlâ **4 eski anlatı, 33 kayıt ve 2 video** içeriyordu; donmuş dosya aktif Studio kayıtlarını temsil etmiyor. Canlı site de eski yayın içeriğini koruyor; bu dilim deploy yapmadı.

`journal.outline` ile ilgili tarayıcı doğrulaması için yalnız disposable, izole sentetik fixture kullanıldı. Gerçek editoryal seri atamaları kullanıcı yeni içerikleri onayladıkça yapılabilir.

## Kabul / test

- `node apps/studio/verify-narrative-outline.cjs`: profil, stable dizi/bölüm anahtarı, bölüm yerleştirme, eksik/retire veri filtresi.
- `node apps/studio/verify-publication-v2.cjs`: semantik outline fingerprint ve yayın.
- `node apps/studio/verify-narrative-ai-generation.cjs` ve ilgili store / service / IPC kontrolleri.
- `node apps/studio/vefk-site-consumer.test.mjs`: yeni alanlar Vefk seçimi/oynatıcı hash testlerini bozmamalı.
- `npm --prefix channels/birdesengor/web test`: bütün kitap/web birim kontrolleri.
- `node channels/birdesengor/web/tests/journal-contents-e2e.mjs`: 1920x1080 + 390x844, dizi -> bölüm -> anlatı -> arşiv -> anıya dönüş.
- Studio ve web derlemeleri.

## Sonraki dilim — Codex ile birlikte

1. İçindekiler ve indeks yapraklarının foto-gerçekçi tipografi/yerleşim/papirüs kalite turu (masaüstü/mobil; yeni panel veya ikinci kitap yok).
2. Kayıt sayfasındaki ansiklopedi ağırlıklı bloklar ile günlük içeriği arasındaki görsel ağırlığı dengeleme. Yalnız doğrulanabilir kaynak olayları ve görsel provenance.
3. Gerçek video işleme turunda `Düğümlü Kitap` gibi seri/alt bölüm adaylarını öneren, AI kararı değil editoryal seçim olan eşleme. `54. Davet` birden fazla videoda geçebilir; salt video başlığı benzersiz kimlik değildir.
4. Kaynaklı olay aktarımını güçlendirme: yaşanma tarihi, video yayın tarihi, anlatıcının doğrudan deneyimi / misafirden aktarım / yorum ayrımı. Ardından mevcut anlatım biçimini kontrollü yeniden üretme.
5. Büyük birikimli kitap için içindekiler sayfasının erişilebilir kaydırma, otomatik dizin ve E2E performans kontrolü.
6. Gerçek Studio içeriği oluştuğunda son yayın + canlı doğrulama ve Git kapanışı **ayrı onayla**. Eski yayın paketi elle sonradan yanlışlıkla yeniden deploy edilmemeli.

## Çakışma uyarısı

Diğer Vefk/sahne oturumlarının çalışma dosyalarına dokunma. Bu dilim yalnız anlatı, yayın ve kitap modüllerini değiştirdi. Commit/push/deploy otomatik yapılmadı.

## 7 Kasım — Aşama 2

Fiziksel sıra artık İçindekiler → günlük anlatıları → Evren kategori dizinleri → kayıtlar. İlk sağ yaprak ve yeniden açılış kaydırması tutarlı; dizi/bölüm kimlik haritaları, gerçek devam yüzleri ve kenar ayracı kullanılır. Gerçek yayındaki 3 eşleştirilmemiş anı bağımsız görünür; Studio verisi veya yayın paketi yeniden üretilmedi. Anlatıcı aktarım hatasında kanalın gizlenmesi/aktif seçimin kayması da giderildi. Kabul, gerçek paket bulguları, üç ekran görüntüsü ve dosya listesi: [Aşama 2 teslim notu](EVREN_JOURNAL_STAGE2.md).
