# BirDeSenGör — Divit sahipliği kabul raporu

2026-11-10 · Yerel çalışma; commit, push ve deploy yok.

## Sonuç ve sahiplik

Oda envanteri **14 gerçek nesne / 18 oda ankrajı** içerir. Oda `VefkStand` nesnesini; `VefkStand` tek `VefkQuill` bileşeninin konumunu, görünürlüğünü ve yaşam döngüsünü yönetir. Efekt Atölyesi'nin kaynak modeli, nesne listesi ve önizlemesi bağımsız Divit içermez. Editörde Divit'e özel gizleme koşulu yoktur.

| İncelenen bağlantı | Sınıflandırma ve karar |
| --- | --- |
| `study.scene.json` içindeki `quill`, konum, hitArea, focus, layout ve `ink-drip` ankrajı | Eski oda mimarisi; kaldırıldı. Bu normalize konum gerçek çizim koordinatı değildi. |
| `sceneManifest` CSS anahtarı, `sceneRegistry` zorunlu ankrajı, `SceneRoot` koşullu gizlemesi | Eski oda bağımlılıkları; kaldırıldı. Etkileşim/odak envanterinde Divit yok. |
| `cameraDepth` içindeki Divit istisnası ve `subjectPosition` | Kullanılmayan bağımsız konum yolu; kaldırıldı. Gerçek oda hedefleri için `subjectId` korundu. |
| Efekt JSON'undaki `quill` / `quill.tip` ve editör istisnası | Kaldırıldı. Kaynak adaptörü mevcut kesin envanter doğrulamasını kullanır; özel filtre gerekmez. Bağımsız editör örneğindeki Divit de kaldırıldı. |
| Studio üreticisi, PHP gate ve JS tüketicisindeki `binding.pen` | Gerekli yayın sözleşmesi; kimlikler ve binding sürümleri korundu. `VEFK_WORKSHOP.pen` atölye alanında tanımlıdır. |
| `VefkStand`, `VefkQuill`, geometri, oynatıcı ve görsel ön yükleme | Gerekli iç mekanizma; korunur. SVG nib işareti `data-vefk-anchor`, bileşen `data-vefk-part-id` kullanır; oda/efekt işareti yayımlamaz. |

`quill.tip` yayın doğrulamasının parçasıdır; çizim koordinatının kaynağı değildir. Gerçek konum `frame.pen.position` üzerinden, mevcut viewBox/optik dönüşümle aynı mürekkep SVG'sinde hesaplanır. JS tüketicisi pen kimliğini kesin binding karşılaştırmasıyla, oda bağlantısını yalnız `vefk-stand.ink-plane` üzerinden doğrular. Studio üreticisi ve PHP sözleşmesi değişmedi. Belge/katalog/paket hash'leri yeniden üretilmedi; migration yok.

## Değişen dosyalar

- Web üretim kodu: `src/scene/{data/study.scene.json,sceneManifest.js,sceneRegistry.js,SceneRoot.jsx,cameraDepth.js}`, `src/vefk/{VefkQuill.jsx,vefk-site-consumer.mjs}`, `src/effects/birdesengor-effects.v2.json`.
- Kanonik tüketici ve sözleşme: `docs/contracts/{vefk-site-consumer.mjs,VEFK_SITE_HANDOFF.md}`. Web belgeleri: `docs/{PHYSICAL_VEFK.md,SCENE_MANIFEST_V1.md}`.
- Efekt Atölyesi: `src/editor/scene-main.mjs`, `examples/birdesengor-v2.scene.json`, `docs/SCENE_EDITOR_AND_ADMIN.md`; kaynak, örnek ve model testleri.
- Admin: `tests/{effect-studio-admin-scene-ui,effect-studio-scene-editor-smoke}.test.mjs`. Mevcut `sync-effect-studio.mjs` ile `public/effect-studio` eşitlendi ve Admin derlendi; kanonik, vendor ve derlenmiş editör/örnek dosyaları byte eşittir. Motor modülleri/parametreleri değişmedi; 23 modüllü provenance kontrolü geçti.
- Web testleri: oda manifest/envanter/registry, kamera odağı, efekt adaptörü, P7.5/P8, yayın/tüketici, foundation ve Divit DOM sahipliği sınamaları. Studio: `apps/studio/vefk-s4-motion.test.mjs` içindeki izole PHP fikstürüne güncel API bağımlılığı ve iki dilli zarf eklendi; gerçek veri değiştirilmedi.

Tam dosya envanteri ve koruma karşılaştırması: `channels/birdesengor/web/artifacts/quill-ownership/{changes.json,preservation.json}`.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| Web `npm test` | **232/232 PASS**, skip 0 |
| Studio üretici/tüketici, easing, DOC1/DOC2, kesin şema ve PHP reddi | **60/60 PASS**; PHP fikstürü düzeltildikten sonra ilgili 12 test yeniden geçti |
| Kanonik efekt kaynak/Admin/model/runtime hedefli testleri | **34/34 PASS**; örnek temizliği sonrası etkilenen 11 test yeniden geçti |
| Web ve Admin üretim derlemeleri | **PASS**; web'in mevcut 500 kB chunk uyarısı sürüyor |
| Admin tarayıcı | **PASS**: 14 nesnenin listelenmesi/seçilmesi, Divit'in kaynakta ve önizlemede yokluğu, kaydet/yeniden aç, parametre roundtrip; bağımsız editör 390 px smoke PASS |
| DOC1/DOC2 tarayıcı | **PASS**: 1920×1080, 1366×768, 390×844 ve reduced-motion; tek kalıcı Divit, açılış/kapanış, seek/reset/pause, alt yol mürekkebi ve uç eşleşmesi; ölçülen uç sapması **0 px** |
| Gerçek yerel yayın ve katalog | **PASS**: aynı dört koşul; başlangıçta şişe, oynatma, duraklamada konumu koruma, başa dönüş, tekrar açılış, 32 kaydın tamamı ve boş/bozuk/ulaşılamayan/yüklenen yayın |
| Foundation / optik-hız-okuma kontrolleri | **PASS**: her biri 1920×1080, 1366×768, 390×844 ve reduced-motion; 0.25×/0.5×/2× hız, optik büyütme, kare sonunda bekle, tekrar, okuma ve 1/5/32 katalog |
| Son tütsülük değişikliği | **PASS**: 1920 px, mobil ve reduced-motion; aç/kapat ve canvas temizliği |

Tarayıcı kanıtları: `web/artifacts/vefk-v2/{documents,workshop}`, `web/artifacts/vefk-physical-use`, `web/artifacts/foundation`; test logları `web/artifacts/quill-ownership` altında toplanır.

Foundation testinin mobil kamera tıklaması, mevcut tütsülük hedefinin altında açıkta kalan kamera gövdesine taşındı; uygulama yerleşimi değiştirilmedi ve zorlanmış tıklama kullanılmadı. Fiziksel kullanım testinin gerçek zamanlı hız ölçümü ilk koşularda toleransı aştı; tolerans/motor değiştirilmeden durum tanısı eklendi ve son dört koşul geçti.

## Korunan kapsam

Başlangıç karşılaştırması, iki gerçek sahne JSON'unda **yalnız `quill` nesnesinin kaldırıldığını** doğrular: diğer nesneler, dokuz efekt, hedefleri ve tüm parametreleri aynıdır. Tütsülüğün mevcut yerel dosyaları aynen korunur; `SceneRoot.jsx` üzerinde yalnız eski Divit filtresi ek olarak değişti. Kitap/kamera/topluluk uygulama koduna, üyelik kayıtlarına, kullanıcı veritabanına ve yayın verilerine yazılmadı. Admin kayıt sınamaları geçici dizin/bellek kullanır; mevcut kullanıcı taslakları değiştirilmedi. Eski kaynak sürümlü taslakları reddeden mevcut kaynak hash koruması korunur.

Güncel yerel yayın `birdesengor-channel-drawing` kaydını içerir (472 yol). Bu gerçek paket doğrudan Vite üzerinden oynatıldı ve değişmedi; eski seçilmemiş demo kayıtları yeniden yayımlanmadı. DOC1/DOC2 ve sihirli kare altyapısı ayrıca Studio'nun izole ürettiği kayıtlarla sınandı.
