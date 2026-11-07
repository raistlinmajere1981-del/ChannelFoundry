# BirDeSenGör — Kanal kimliği ve kalıcı anlatıcı ayarları / Aşama 1

7 Kasım 2026. Yalnız Studio anlatıcı ayarları ve Hikâyeleştir bağlantısı. Aşama 2 uygulanmadı; commit, push, deploy ve gerçek yayın üretimi yapılmadı.

## Mevcut altyapı ve sonuç

Kanal Ayarları ekranı `ChannelProjectsSettings.tsx`, kalıcılık katmanı `channel-projects.cjs` ve proje başına `channels/<id>/channel.json` dosyasıdır. Bu ayarlar SQLite'ta tutulmuyordu. SQLite'taki `studio_meta` uygulama metaverisidir; anlatıcının eski kaydı `narrative_narrator_profile(id=1)` tablosundaydı. Yeni SQLite ayar tablosu veya bağımsız ayar deposu eklenmedi.

Mevcut proje oluşturma/güncelleme IPC'si `channel.json.narrator` alanını kaydeder: `displayName`, `mode` (`source_bound_first_person` / `neutral`), `editorialNote`. Başka proje ayarları kaydedilirken anlatıcı gönderilmese de mevcut değerler korunur. Kanal Ayarları aynı Kaydet düğmesini kullanır; anlatıcı başka ekrandan düzenlenemez. Proje IPC kayıtları testlerde de üretimdeki aynı handler'ları çalıştırmak için mevcut `channel-projects.cjs` modülüne taşındı.

Mevcut izolasyon korunur: proje başına `.local-data/studio/channel-foundry-studio.sqlite`; proje değişimi mevcut AI/YouTube bekleme denetimleriyle Electron'u yeniden başlatır. AI profili açık veritabanının sahibi üzerinden bulunur; yeniden başlatma aralığında değişen `.channel-active.json` başka kanalın profilini açık veritabanına bağlamaz. Özel veri dizininde runtime proje bağlantısını açıkça kurar; başka bir kanalın standart DB yoluna bağlanma reddedilir. Bağlantısız test DB'leri gerçek etkin kanala erişmez.

## Eski profilin geçişi

- Kanal JSON'unda `narrator` alanı **yoksa**, yalnız o projenin eski SQLite profili salt okunur açılır. Normal Studio bootstrap/temizleme işlemleri çağrılmaz.
- Eski satır varsa alanlar JSON'a mevcut atomik geçici dosya/rename yazıcısıyla aktarılır; geçişte diğer JSON alanları aynen korunur.
- `narrator` zaten varsa, adı bilinçli olarak boş bırakılmış olsa bile eski satır okunmaz ve ayarların üzerine yazılmaz. Geçiş tekrar çalıştırıldığında dosya tekrar yazılmaz.
- Eski tablo/satır silinmez veya güncellenmez; tarihsel geçiş girdisi olarak kalır. Uygulamada onu yazan fonksiyon, IPC, preload ve React yolu kaldırıldı. Güncel tek doğruluk kaynağı kanal JSON'udur.
- Gerçek BirDeSenGör profili aktarıldı: **Ömer / kaynaklara bağlı birinci şahıs / boş editoryal not**. Kanal adı, YouTube, hosting, web adresi ve yayın etkinliği korundu.

Gerçek SQLite dosyası, yayın JSON'u ve canlı yayın baseline dosyasının işlem öncesi/sonrası SHA-256 değerleri aynı. SQLite içindeki 19 `narrative_*` / `universe_*` / `publication*` tablosunun satır hash'leri de aynı: 3 aktif onaylı anlatı, eski applied run ve anlatıcı karakteri dahil hiçbir içerik dönüştürülmedi. Kanıt: `artifacts/channel-narrator-stage1/real-data-preservation.json`.

## AI ve frozen sözleşme

Anlatıcı snapshot'ı ortak `narrative-store.prepareRun` sınırında kanal ayarlarından alınır ve `input_json` ile fingerprint'e girer. İstemci `narrator` göndererek bunu geçersiz kılamaz. Aynı kaynaklarla aynı ayarlar aynı prepared run'ı kullanır; ayar değişirse sonraki hazırlık yeni snapshot/fingerprint alır. Eski run'ın JSON'u, durumu, taslakları veya onaylı anıları değiştirilmez.

`narrative-ai-contract` canlı profil fallback'i kullanmaz. Çok eski, snapshot içermeyen run'lar deterministik, adsız tarafsız fallback alır; eski run verisi dönüştürülmez. Snapshot'ı bulunan eski run aynen kullanılır.

Model talimatı kaynakla doğrulanmış doğrudan deneyimde ben dilini, misafir/duyum/yorum ayrımını, belirsiz kimlikte tarafsız atfı ve metafizik iddiaların deneyim/aktarım niteliğini korur. Ad, günlükte varsayılan üçüncü şahıs öznesi yapılmaz; gerekli kaynak bağlamında kullanılabilir. Editoryal tercih kaynak kanıtının yerine geçmez. JSON onarımı yalnız sözdizimi/şemayı onarmaya devam eder.

Gerçek AI servisine üretim çağrısı yapılmadı. Testler kontrollü AI transport'u ile frozen girdi ve talimatı doğrular; ortaya çıkan anlatının kaynak doğruluğuna dair editör onayının yerine geçmez.

## Bu aşamada değiştirilen dosyalar

- Ayarlar/izolasyon: `apps/studio/channel-projects.cjs`, `main.cjs`, `studio-runtime.cjs`; `channels/birdesengor/channel.json`.
- React/tipler: `apps/studio/src/ChannelProjectsSettings.tsx`, `channel-projects.css`, `NarrativeOutlineWorkbench.tsx`, `studio-api.d.ts`, `narrative-api-contract.d.ts`.
- Anlatı/AI: `apps/studio/narrative-outline.cjs`, `narrative-store.cjs`, `narrative-service.cjs`, `narrative-ai-contract.cjs`, `narrative-ai-generation.cjs`, `narrative-ipc.cjs`, `preload.cjs`.
- Testler: `apps/studio/verify-channel-narrator.cjs`, `verify-narrative-outline.cjs`, `verify-narrative-ipc.cjs`, `verify-narrative-ai-generation.cjs`; `apps/studio/tests/channel-narrator.browser.mjs`, `narrative-outline.browser.mjs`.
- Komutlar/notlar: kök `package.json`, `docs/EVREN_JOURNAL_IMPLEMENTATION.md`, bu belge.

Listede başlangıçta zaten değiştirilmiş veya untracked dosyalar bulunur; onların önceki geliştirmeleri korunarak yalnız bu aşamaya ait kısımlar düzenlendi. `narrative-service.cjs` bu aşamada ortak store üzerinden hazırlığa geçirildiği için HEAD ile aynı hale geldi. Başlangıçtaki web alt deposu, yayın modülü ve diğer Studio değişiklikleri bu aşamanın uygulaması değildir.

## Doğrulama

- `npm run verify:channel-narrator`: tek yönlü/idempotent geçiş, mevcut ayar önceliği, kalıcılık, üç proje, IPC oluşturma/güncelleme, çalışan iş sırasında kanal geçişi engeli, frozen sözleşme, sonraki tur, eski yayın/onaylı hafıza ve kaynak atfı kontrolleri geçti. Gerçek React + üretimdeki proje/anlatı IPC handler'ları ile iki kanal arasında kaydet/yeniden aç/geçiş testi de geçti. StrictMode kullanıldı; gerçek kullanıcı DB'si açılmadı.
- `node apps/studio/tests/narrative-outline.browser.mjs`: dizi/alt bölüm önerileri, iki video kaynağı, açık yerleştirme, sıra koruma ve anlatıcı formunun bulunmaması geçti.
- Birim/sözleşme/IPC kontrolleri geçti: `verify-channel-projects`, `verify-studio-data-paths`, `verify-narrative-store`, `verify-narrative-outline`, `verify-narrative-structured-content`, `verify-narrative-service-contract`, `verify-narrative-ipc`, `verify-narrative-ai-generation`, `verify-narrative-editorial-ui`, `verify-publication-v2`, `verify-publication-v2-ui`, `verify-visual-completion`, `verify-studio-shell`, `verify-studio-appearance`, `verify-first-run-flow`, `verify-dev-isolation`, `verify-workspace-design`, `verify-fixed-viewport`.
- Vefk: `node --test apps/studio/vefk-*.test.cjs apps/studio/vefk-*.test.mjs apps/studio/src/vefk-*.test.mjs`: **281/281**, atlama yok. Store, IPC, kaynak, hazırlık, hareket, yayın ve site/PHP tüketici kapıları dahil.
- `node apps/studio/tests/vefk-reading.browser.mjs`: React/IPC düzenle-kaydet-kontrol-onay-katalog/paket ve değişmezlik akışı geçti; yalnız scratch yayın kullanıldı. Derlemeyle aynı anda başlatılan ilk deneme boş renderer'da zaman aşımına uğradı; bağımsız tekrar, Vefk kodu değiştirilmeden geçti.
- `npm run build:studio`: TypeScript ve Vite production derlemesi geçti.
- İki depoda `git diff --check` geçti. Web kaynak kodunda bu aşamaya ait değişiklik yok.

Test görselleri/sonuçları: `artifacts/channel-narrator-stage1/`. Yeni `verify:channel-narrator` komutu eklendi; backend kontrolü mevcut `verify:release` zincirine de dahil edildi. Tam release zinciri bu aşamada çalıştırılmadı; yukarıdaki ilgili kontroller çalıştırıldı.

## Sonraki aşamaya bırakılanlar

Grabfold motoru, fiziksel kitap ve görsel sayfa düzeni; Anlatıcı karakteri ve eski Evren kayıtlarının içerik dönüşümü; mevcut anlatıların yeniden üretilmesi; gerçek yayın paketi/dağıtım. Bu aşama bunları başlatmaz.

## Teslim anındaki Git durumu

Her iki depo `main` dalında. Aşağıdaki durum başlangıçtan gelen işleri de içerir; web alt deposunun durum listesi başlangıçla aynıdır. Stage edilmiş dosya yok.

ChannelFoundry:

```text
 M apps/studio/channel-projects.cjs
 M apps/studio/main.cjs
 M apps/studio/narrative-ai-contract.cjs
 M apps/studio/narrative-ai-generation.cjs
 M apps/studio/narrative-ipc.cjs
 M apps/studio/narrative-store.cjs
 M apps/studio/preload.cjs
 M apps/studio/publication-v2.cjs
 M apps/studio/src/ChannelProjectsSettings.tsx
 M apps/studio/src/NarrativeWorkbench.tsx
 M apps/studio/src/channel-projects.css
 M apps/studio/src/narrative-api-contract.d.ts
 M apps/studio/src/studio-api.d.ts
 M apps/studio/studio-runtime.cjs
 M apps/studio/verify-narrative-ai-generation.cjs
 M apps/studio/verify-narrative-ipc.cjs
 M apps/studio/verify-narrative-service-contract.cjs
 M apps/studio/verify-publication-v2.cjs
 M channels/birdesengor/channel.json
 m channels/birdesengor/web
 M package.json
?? apps/studio/narrative-outline.cjs
?? apps/studio/src/NarrativeOutlineWorkbench.tsx
?? apps/studio/src/narrative-outline.css
?? apps/studio/tests/channel-narrator.browser.mjs
?? apps/studio/tests/narrative-outline.browser.mjs
?? apps/studio/verify-channel-narrator.cjs
?? apps/studio/verify-narrative-outline.cjs
?? docs/CHANNEL_NARRATOR_STAGE1.md
?? docs/EVREN_JOURNAL_DESIGN_ACCEPTANCE.md
?? docs/EVREN_JOURNAL_IMPLEMENTATION.md
```

Web alt deposu:

```text
 M package.json
 M src/App.jsx
 M src/book/BookPages.jsx
 M src/book/GrabfoldJournal.jsx
 M src/book/bookModel.js
 M src/book/physical-books.css
 M src/data/publication.js
 M tests/bookModel.test.mjs
?? src/book/BookIndexPages.jsx
?? src/book/journal-pages.css
?? tests/journal-contents-e2e.mjs
?? tests/journal-layout-e2e.mjs
```
