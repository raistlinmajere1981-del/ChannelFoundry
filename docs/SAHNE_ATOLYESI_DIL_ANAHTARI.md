# Sahne Atölyesi — Dil anahtarı yönetimi

## Amaç
BirDeSenGör'ün mevcut TR/EN bakır masa anahtarını nesne gibi seçip yerleşimini değiştirmek, fakat onu V2 efekt motoruna veya bağımsız WebP nesnelerine taşımamak.

## Kaynak ve sınırlar
- Kontrol kimliği: `languageSwitch`; Sahne Atölyesi'nin `Sahne kontrolleri` grubunda ayrı satır.
- Kanonik değerler: `channels/birdesengor/web/src/scene/data/scene-presentation.v1.json` içindeki `controls.languageSwitch.desktop/mobile`.
- Validasyon: `packages/effect-engine/src/model/language-switch-layout.mjs` ve sahne sunumu V1 validator'ı. Kimliği, alanları, aralıkları doğrulanır; keyfî CSS veya kod kabul edilmez.
- Gerçek site: `LanguageSwitch.jsx` kontrolü `languageSwitchStyle(...)` ile CSS değişkenlerini alır. `language.css` seçilen cihazın CSS medya sorgusunu uygular.
- Davranış: TR/EN değişimi, gecikme/perde, rol ve klavye kontrolleri aynı kalır; kitap veya cihaz yakınına girilince butonun yerini pasif plaka alır.
- Siteye hazırlama: Yalnız değişen `scene-presentation.v1.json` aktarılır. Sahne V2 nesneleri, 22 efekt yuvası, Evren Kitabı verileri ve canlı site etkilenmez.

## Studio kontrol alanı
- Masaüstü: sol X (%), üst Y (%).
- Mobil: sol X (%), alt kenar mesafesi (px).
- Her cihaz için bakır plakanın ölçeği, açısı, tıklama alanı genişlik/yüksekliği.
- TR/EN seçimi yalnız yerel görsel önizlemedir; site dil ayarını değiştirmez.
- Taşı modunda sürükleme, Geri Al/Yinele ve cihaz varsayılanını sıfırlama.

## Onay
`npm run verify:scene-workshop`, `npm run verify:scene-workshop-ui`,
`node apps/studio/tests/scene-v4-artwork.browser.mjs`,
`npm --prefix channels/birdesengor/web run test:e2e:language-layout`.
