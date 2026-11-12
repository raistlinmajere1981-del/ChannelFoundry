# BirDeSenGör — Sahne Atölyesi V3 / birleşik Studio çalışma ortamı

## Mimari ve sahiplik (13 Kasım 2026)

- Üretim uygulamasında `iframe`, `scene.html` ve ikinci Vite HTML girişi **yok**. `SceneWorkshop.tsx` çalışma alanını doğrudan Studio React kökü içine yerleştirir ve `scene-workspace/scene-editor.mjs` yaşam döngüsünü yönetir.
- Studio editörün sahibi: `apps/studio/src/scene-workspace/` (`scene-editor`, `scene-ux`, `history`, `dom`, `template`, kapsüllenmiş CSS). `window.postMessage` üzerinden Studio içinde iletişim yapılmaz. React, taslak kaydetme/yayın köprüsüne doğrudan bağlanır.
- `packages/effect-engine` üzerindeki çalışma motoru/model/registry **korunur**; BirDeSenGör web hâlâ aynı kanonik V2 efekt sözleşmesinin tüketicisidir. Eski ortak paketteki Sahne Atölyesi DOM editörü ve Studio'ya özel UX katmanı çıkarılmıştır.
- Eski bağımsız sayfa yalnız testte `/tests/scene-v2-harness.html` olarak bulunur; `dist/scene.html` üretilmez. 10 tarayıcı regresyon dosyasının bağlantıları bu test fikstürüne taşınmıştır.

## Kullanım

- Sol panel: nesne/efekt ağacı, kategoriler, arama, efektli nesne filtresi ve etkin efekt sayıları.
- Merkez: gerçek 1600×900 sahne, ana oda görselleri, nesne/tıklama/hedef işaretleri, taşıma, zoom, oynatma, geri al/yinele. Yan paneller tek düğmeyle gizlenebilir.
- Sağ panel: Nesne / Efekt / Görünüm sekmeleri. Görünüm içinde geçiş süreleri, kadraj/yakınlık ve kitaba/cihaza özgü diğer kapatılabilir alt gruplar bulunur.
- Nesne/efekt veya boş çalışma tuvalinde sağ tuş ilgili eylemleri açar; form alanlarının yerleşik sağ tuş davranışı engellenmez.
- Ana Studio menüsü yalnız Sahne Atölyesi açılırken varsayılan olarak ikon şeridine daralır, diğer sayfaların kalıcı menü tercihi değiştirilmez.
- Studio kontrolündeki sahne kaynak hash'i, draft, stage, preflight ve kullanıcının ayrıca onayladığı deploy akışı değişmedi.

## Kabul

- `npm run verify:effect-engine`
- `npm run verify:scene-workshop` (Studio yayın servisi ve Studio-özel editör profilleri)
- `npm run build:studio` (tek üretim HTML giriş noktası)
- `npm run verify:scene-workshop-ui` (React içinde doğrudan mount, 14 nesne/22 efekt, gerçek oda görselleri, kayıt, sağ tuş, panel daraltma, iframe=0)
- `node apps/studio/tests/{scene-image-edit,visual-placement,scene-focus-presentation,scene-book-presentation,scene-markers,scene-foreground-art}.browser.mjs` (ayrı komutlarla)

Bu değişiklikler canlı siteye aktarılmadı. Demo nesne/efekt kayıtları test karşılaştırması için korunmuş; web yayınına veya onaylı içeriklere yazılmamıştır.
