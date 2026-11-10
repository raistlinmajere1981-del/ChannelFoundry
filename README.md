# ChannelFoundry

Birden fazla YouTube kanalıyla çalışabilen yerel Electron Studio ve editoryal üretim motoru. Kanal arşivi, altyazı araştırması, AI çözümleme, ayıklama, anlatı, görsel tamamlama ve yayın paketi üretimi Studio'da yürütülür. BirDeSenGör'ün tek web uygulaması V2 sahnesidir.

## Kaynak düzeni

- `apps/studio/`: Electron + React/TypeScript/Vite Studio.
- `packages/`: ortak veri/yayın sözleşmeleri ve altyazı araştırma çekirdeği.
- `channels/birdesengor/channel.json`: kanal proje bağlantısı.
- `channels/birdesengor/web/`: tek V2 frontend; React/Vite, Grabfold defterleri ve veri güdümlü fiziksel sahne.
- `channels/birdesengor/web/public/api/`: aynı web kökünde korunan PHP Studio/Vefk, topluluk ve YouTube backend'i.
- `channels/birdesengor/web/public/index.php`: PHP önizleme erişim kapısı; `.htaccess` doğrudan derlenmiş HTML erişimini sınırlar.
- `apps/web`: `../channels/birdesengor/web` hedefine symlink; ikinci kaynak kopyası değildir.
- `channels/birdesengor/.local-data/studio/`: Git dışındaki özgün yerel Studio verisi ve public export.

Web, aynı `channels/birdesengor/web` yolundaki ayrı [birdesengor-web](https://github.com/raistlinmajere1981-del/birdesengor-web) Git submodule'ü olarak kalır. Ana repo ile web deposunun Git geçmişi ayrıdır. V1 Babylon/React tasarımı, eski CSS/sahne varlıkları ve eski Natro deploy doğrulama araçları emekliye ayrılmıştır; ikinci web kökü veya V1 fallback yoktur. Bu kaynak düzeni canlı dağıtım yapmaz.

## Kurulum

```bash
git clone --recurse-submodules https://github.com/raistlinmajere1981-del/ChannelFoundry.git
cd ChannelFoundry
npm ci
npm ci --prefix channels/birdesengor/web
```

Web'in kanonik efekt motoru ChannelFoundry/packages/effect-engine/src altındadır; dış çalışma alanı veya ortam değişkenine bağımlı değildir. Ayrıntılar: [web README](channels/birdesengor/web/README.md).

## Yerel çalışma ve doğrulama

```bash
npm run start:birdesengor       # kanalın mevcut yerel verisiyle Electron
npm run dev:studio:birdesengor  # Studio geliştirme: 127.0.0.1:5194
npm run dev:web                # tek web kökü: 127.0.0.1:5208
npm run build:web              # web/dist üretimi
npm run verify:web             # web Node testleri + build + Chromium E2E
npm run verify:community-admin # geçici PHP fixture ile ilk admin kontrolü
npm run verify:channel-projects
npm run build:studio
npm run verify:release         # Studio kontrolleri + PHP admin + V2 web verify
```

`dev:birdesengor` ve `build:birdesengor` aynı web kökünü kanal kaydı üzerinden çalıştırır. Web ve Studio yalnız loopback üzerinde sabit port kullanır; dolu porta sessizce alternatif seçmez. Yardımcı Asistan'ın `127.0.0.1:5174` portu başka projeye aittir. Web E2E testleri kendi geçici loopback portunu seçer.

Web geliştirme sunucusu gerçek yerel publication export'unu yalnız `CHANNEL_FOUNDRY_PUBLICATION_FILE` verilirse okur. PHP geliştirme bağlantıları açıkça etkinleştirilen ve yalnız loopback HTTP origin kabul eden proxy'lerdir. API/veri yoksa dürüst boş veya kullanılamıyor durumu gösterilir. Derleme yayın verisi üretmez; PHP endpoint'leri `public/` içinden `dist/` içine kopyalanır. `verify:release` ve web komutları deploy çalıştırmaz.

## Studio üretim akışı

`Çözümleme → Ayıklama → Evrene İşleme → İnceleme → Hikâyeleştir → Görsel Tamamlama → Yayınlama`

Üst çubuktan aktif kanal projesi seçilir; yt-dlp yönetimi ve görünüm ayarları küçük panellerde açılır. **Ayarlar → Kanal ve yayın** YouTube kaynağı, arşiv kapsamı ve yayın hedefinin tek kaydıdır. **Kaydet** yerel kaydı günceller. **Kataloğu bağla** kaynağı doğrulayıp boş kataloğu kaydeder; video/altyazı alımı Video Arşivi'ndeki manuel senkronizasyondur. Yerel site paketi hazırlama ile canlı yayın ayrı eylemlerdir; canlı yayın kanalın `deploymentEnabled` ayarına bağlıdır.

AI ayarlarında Metin ve Görsel servisleri bağımsızdır. OpenCode metin üretiminde Studio'ya ait geçici oturum kullanır; mevcut TUI oturumları değiştirilmez. Servis parolaları Git dışında yerel ayarlarda tutulur. Görsel üretim sağlayıcıları kendi ayarlarıyla çalışır.

## Belgeler

- [Vizyon](docs/00-Vizyon.md), [yol haritası](docs/02-Yol-Haritasi.md), [veri mimarisi](docs/05-Veri-Mimarisi.md).
- [Studio Vefk planı](docs/VEFK_STUDIO_MASTER_PLAN.md) ve [site bağlantı sözleşmesi](docs/contracts/VEFK_SITE_HANDOFF.md).
- [Web sahne planı](channels/birdesengor/web/docs/SCENE_V2_MASTER_PLAN.md) ve [görsel kabul geçmişi](channels/birdesengor/web/docs/VISUAL_ASSETS_P7.md). Önceki paralel V1/V2 çalışma anlatımları tarihsel kayıttır; güncel kaynak düzeni bu README'dedir.
