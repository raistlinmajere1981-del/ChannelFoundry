# BirDeSenGör — Sahne ve sarkaç kabul raporu

10 Kasım 2026. Yerel kaynak çalışmasıdır. Commit, push ve canlı deploy yapılmadı. Gerçek yayın ve üyelik kayıtlarına yazılmadı.

## Sonuç

- İki kapalı kitabın masa yüzeyine oturuşu çok hafif düzeltildi: Evren 3° → 2°, Topluluk −5° → −4°, düşey projeksiyon %97,5. Aynı dönüşüm tıklama siluetine ve açılışın başlangıç pozuna uygulanır; fotoğrafın mevcut perspektifi ve hacmi korunur.
- Topluluk kapağındaki `community-inside-head` kâğıt bandı kaldırıldı. Kâğıt başlıkları yalnız gerçek sayfalarda kalır. Mobil kapak üyelik görünümünde kâğıt başlığı gizlenir.
- Evren'in uzun yeşil ayracı ilk hover kıvrılması dahil sayfa kaldırılırken yalnız dışarıdaki kısa kuyruğa çekilir. Dönüş başlangıcındaki işaretleme aynı motor callback'inde yapılır; React commit'i beklenmez.
- Dil kontrolü mevcut sol alt köşede alçak ahşap/pirinç kaideye dönüştürüldü. TR/EN okunur; aktif dil sıcak altın ışıkla belirginleşir. Tıklama, ok tuşları, Home/End ve reduced-motion korunur.
- Kaftanın büyük tokalı kemeri doğal bağlı kumaş kuşakla değiştirildi; yeni oda asset'i ayrı dosyadır.
- Referans metal obje, soldaki kılıcın solunda işaretlenen masa bölgesine yerleştirildi. 2:1 odada yaklaşık merkez (0,407; 0,54), kutu (0,364; 0,415; 0,086; 0,25). Görünen yükseklik yaklaşık iki mumdur. Halka/ağaç/geyik/kaide sabittir; yalnız merkez parça salınır.
- 320/390 px'de hedefin tamamı en az 44×44 CSS px'dir. Görsel taşınmadan dokunma genişlemesi kılıcın yanına alınır; sarkacın merkezi hedef içinde kalır. Kılıç, mum ve kitap hedefleriyle kesişme yoktur.

## Efekt modeli ve API

`pendulum-sway` canonical registry'de `trigger: pulse`, `output: motion` olarak tanımlıdır. Parametreler: `amplitude=3°`, `frequency=2 Hz`, `damping=2.7 s⁻¹`, `duration=1.8 s`, `speed=1`. Hafif/Doğal/Belirgin profilleri kaynak registry'den gelir.

Nesne `motionLayers: ["pendant"]`, efekt ise `target.layerId: "pendant"` tanımlar. Hedef, nesnenin doğrudan altındaki tek `data-effect-layer` öğesiyle eşleşmek zorundadır. Pivot mevcut normalize anchor + offset'tir. Tam nesne kutusunu kaplayan hareket katmanının içindeki gerçek görsel ve yerleşim siteye aittir.

Sönümlü sinüs ve bitişte yumuşak sıfıra oturma canonical fabrikadadır. Site içinde ikinci formül, CSS salınımı, fizik motoru veya yeni kütüphane yoktur. Canvas efektleri aynı motorda çalışmaya devam eder; hareket efekti Canvas ayırmaz. Tamamlanma ticker aboneliğini kapatır. Disable, görünmezlik, reduced-motion, pagehide, unmount ve hedefin ayrılması dönüşü güvenle sıfırlar.

Admin kaynakta tanımlı 15 nesne ve 9 efekt yuvasını okur; yeni yuva oluşturmaz. `previewObjects` görsel paketi Admin kabuğundan editöre aktarılır; efekt JSON'una kaydedilmez. Önizleme gerçek görseller ve aynı motorla çalışır. Oda önizlemesi 2:1 görüntü oranını kullanır; eski 1600×900 mantıksal efekt viewport sözleşmesi korunur.

API ayrıntıları: [/home/raistlin/YardimciWorkspace/EfektAtolyesi/docs/PENDULUM_SWAY.md](/home/raistlin/YardimciWorkspace/EfektAtolyesi/docs/PENDULUM_SWAY.md).

## Asset'ler

- `public/scene-assets/metal-pendulum/fixed.webp` — sabit halka/ağaç/geyik/kaide; gerçek alfa.
- `public/scene-assets/metal-pendulum/pendant.webp` — askı halkaları ve asılı merkez parça; gerçek alfa.
- `public/scene-assets/approved/room-natural-sash-2to1.webp` — 1774×887 oda, doğal kumaş kuşak.

Yerleşim, tonlama ve temas gölgesi sahne tarafından yönetilir. Built-in imagegen kullanıldı; üretilen dosyalar proje içine WebP olarak alındı, saydamlık korundu. Prompt seti, dosya boyutları ve SHA-256 değerleri [assets.json](../channels/birdesengor/web/artifacts/scene-pendulum/assets.json) içinde. Dil kontrolü CSS ile üretildi. Superdesign taslağı [güncel kontrol görünümünü](https://p.superdesign.dev/draft/1f6bf3d2-8286-40a1-af52-fe743b5fa1c2) taşır; sahnenin yerel ekran görüntüleri uygulama kabulünün esas kanıtıdır.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Web `node --test tests/*.test.mjs` | 225/225 geçti |
| Canonical model/runtime/editor/source ve V1 regresyonu | 39/39 geçti |
| Vendor/provenance senkronizasyon testleri | 5/5 geçti |
| Senkronize Admin editörü + gerçek derlenmiş Admin kabuğu | 2/2 geçti |
| Eski metal-glint/water-ripple Admin önizlemesi | Geçti |
| Admin TypeScript kontrolü | Geçti |
| Admin renderer build | Geçti |
| Web production build | Geçti; mevcut 500 kB chunk uyarısı sürüyor |
| Eski kılıç/su pulse E2E | 1920, 1366, 390 ve reduced-motion geçti |
| Yeni sahne E2E | 1920×1080, 1366×768, 390×844, 320×740 ve 390 reduced-motion geçti |
| Git whitespace kontrolü | Değişen repolarda geçti |

Yeni E2E: oda, hedef ayrımı, sadece merkez parçanın hareketi, yeniden tetikleme/cooldown, sıfıra dönüş, visibility/blur/pagehide/reduced-motion, dil tıklaması/klavyesi, Topluluk üyelik/sohbet, Evren açılış/ilk kıvrılma/ilk dönüş/kapanış. Sabit görselin transform'u değişmez. İki kalıcı kitap DOM'u korunur.

Gerçek Admin kabuğunda görsel aktarımı, parametre değişikliği, kaydetme ve bölümü yeniden açınca değerin korunması doğrulandı. Test kaydı tarayıcı belleğine/izole geçici dizine yapıldı; gerçek Admin taslağı veya site JSON'u test amacıyla değiştirilmedi.

Deterministik kareler hem site hem editörde aynı sonuçları verir: 0 s → 0°, 0,108 s → 2,190255°, 0,65 s → 0,493334°, 1,8 s → 0°. Son karede ticker durur. [Birleştirilmiş test kanıtı](../channels/birdesengor/web/artifacts/scene-pendulum/results-final.json).

## Ekran görüntüleri

- [Masaüstü oda](../channels/birdesengor/web/artifacts/scene-pendulum/room-1920-no-preference.png)
- [390 px mobil oda](../channels/birdesengor/web/artifacts/scene-pendulum/room-390-no-preference.png)
- [320 px mobil oda](../channels/birdesengor/web/artifacts/scene-pendulum/room-320-no-preference.png)
- [Topluluk kapağı / üyelik](../channels/birdesengor/web/artifacts/scene-pendulum/community-membership-1920-no-preference.png)
- [Topluluk sohbeti](../channels/birdesengor/web/artifacts/scene-pendulum/community-chat-1920-no-preference.png)
- [Evren ilk kıvrılma](../channels/birdesengor/web/artifacts/scene-pendulum/universe-first-peek-1920-no-preference.png)
- [Evren ilk sayfa dönüşü](../channels/birdesengor/web/artifacts/scene-pendulum/universe-first-turn-1920-no-preference.png)
- [Dil kontrolü EN](../channels/birdesengor/web/artifacts/scene-pendulum/language-en-1920-no-preference.png)
- [Sarkaç başlangıç](../channels/birdesengor/web/artifacts/scene-pendulum/motion-start-1920-no-preference.png) · [tepe](../channels/birdesengor/web/artifacts/scene-pendulum/motion-maximum-1920-no-preference.png) · [sönümleme](../channels/birdesengor/web/artifacts/scene-pendulum/motion-damped-1920-no-preference.png) · [durma](../channels/birdesengor/web/artifacts/scene-pendulum/motion-rest-1920-no-preference.png)
- [Admin editörü](../channels/birdesengor/web/artifacts/scene-pendulum/admin/editor-rest.png) · [gerçek Admin kabuğu](../channels/birdesengor/web/artifacts/scene-pendulum/admin/admin-shell.png)
- Admin karşılıkları: `artifacts/scene-pendulum/admin/motion-{start,maximum,damped,rest}.png`.

## Sınırlar ve mevcut çalışmalar

Görsel E2E yayın verisi izole fikstürdür; Topluluk servisi kontrollü yanıtlarla denenmiştir. Canlı hesap, e-posta gönderimi ve canlı servis oturumu bu turda denenmedi. Mobil oda mevcut 2:1 panorama ve letterbox düzenini korur.

Yardımcı Asistan'daki önceden değişmiş iki Admin test dosyası ve pulse-preview testi korunmuştur. Senkronizasyondan önce mevcut vendor motorunun canonical görev-öncesi HEAD ile birebir eşleştiği doğrulandı; sonraki kopyalama paralel bir motor varyantını ezmedi. Efekt Atölyesi, template vendor ve Admin motoru 23 modül için aynı SHA-256 fingerprint'i taşır: `9b3c7de4b995bbb900e26ab084f53c088f5832031d87983e4096468616611458`.

## Dosya listesi

Üretilen Admin editör kopyası `apps/admin-control-center/public/effect-studio/` altında ignored snapshot'tır; canonical senkronizasyon komutuyla yenilendi. Görev kapsamındaki diğer dosyalar:

### ChannelFoundry

- `docs/BIRDESENGOR_SCENE_PENDULUM_REVIEW.md`


### birdesengor-web

- `public/scene-assets/approved/room-natural-sash-2to1.webp`
- `public/scene-assets/metal-pendulum/fixed.webp`
- `public/scene-assets/metal-pendulum/pendant.webp`
- `src/book/GrabfoldJournal.jsx`
- `src/book/SceneClosedBooks.jsx`
- `src/book/book-ribbons.css`
- `src/book/closedBookLayout.js`
- `src/book/scene-closed-books.css`
- `src/community/CommunityPages.jsx`
- `src/community/community-journal.css`
- `src/effects/birdesengor-effects.v2.json`
- `src/effects/effectsAdapter.js`
- `src/effects/useObjectEffects.js`
- `src/language/language.css`
- `src/language/messages.json`
- `src/scene/SceneRoot.jsx`
- `src/scene/data/study.scene.json`
- `src/scene/sceneManifest.js`
- `src/scene/sceneRegistry.js`
- `src/scene/study-foundation.css`
- `tests/effectsAdapter.test.mjs`
- `tests/p7-room-assets.test.mjs`
- `tests/p75-stand.test.mjs`
- `tests/p8-room.test.mjs`
- `tests/pulse-effects-e2e.mjs`
- `tests/scene-pendulum-e2e.mjs`
- `tests/sceneActionModes.test.mjs`
- `tests/sceneInventory.test.mjs`
- `tests/sceneManifest.test.mjs`


### EfektAtolyesi

- `docs/PENDULUM_SWAY.md`
- `scene.html`
- `scripts/admin-studio.mjs`
- `scripts/birdesengor-site.mjs`
- `src/editor/scene-main.mjs`
- `src/editor/scene-ux.mjs`
- `src/model/project.mjs`
- `src/registry/effects.mjs`
- `src/runtime/effects/pendulum-sway.mjs`
- `src/runtime/object-compile.mjs`
- `src/runtime/object-motion.mjs`
- `src/runtime/object-overlay.mjs`
- `tests/birdesengor-site.test.mjs`
- `tests/scene-editor-ux.test.mjs`
- `tests/scene-object-runtime.test.mjs`


### YardimciAsistan

- `apps/admin-control-center/effect-engine-provenance.json`
- `apps/admin-control-center/shared/contracts.ts`
- `apps/admin-control-center/src/EffectStudio.tsx`
- `apps/admin-control-center/tests/effect-studio-pendulum.test.mjs`
- `scripts/test-effect-engine-sync.mjs`
- `web-site-template/public/assets/vendor/effect-engine/provenance.json`
- `web-site-template/public/assets/vendor/effect-engine/src/model/project.mjs`
- `web-site-template/public/assets/vendor/effect-engine/src/registry/effects.mjs`
- `web-site-template/public/assets/vendor/effect-engine/src/runtime/effects/pendulum-sway.mjs`
- `web-site-template/public/assets/vendor/effect-engine/src/runtime/object-compile.mjs`
- `web-site-template/public/assets/vendor/effect-engine/src/runtime/object-motion.mjs`
- `web-site-template/public/assets/vendor/effect-engine/src/runtime/object-overlay.mjs`


- `docs/dev/CONTINUATION_BACKLOG_2026-10-29.md` — çalışma kanıtı ve devam sınırı notu.

## Ek kapsam — Evren İçindekiler araması

Aynı yerel çalışmaya İçindekiler'in anlık TR/EN başlık araması, hover kıvrılmasında kaydırma konumunun korunması ve Çizim Atölyesi yaklaşma balonunun kaldırılması eklendi. Uygulama ayrıntıları, güncel test sonuçları ve boş/sonuçlu/sonuçsuz ekran görüntüleri [İçindekiler araması kabul raporundadır](BIRDESENGOR_CONTENTS_SEARCH_REVIEW.md). Önceki sahne/sarkaç kapsamı korunur; commit, push ve deploy yapılmaz.
