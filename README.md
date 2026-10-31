# ChannelFoundry

Birden fazla YouTube kanalıyla çalışabilen yerel Studio ve editoryal üretim motoru. Kanal arşivi, altyazı araştırması, AI çözümleme, ayıklama, anlatı, görsel tamamlama ve publication üretimi tek uygulamada yürütülür. Aktif geliştirilen tek kaynak repo burasıdır.

## Düzen

- `apps/studio`: Electron + React/Vite Studio
- `packages/domain`: ortak veri/yayın sözleşmeleri
- `packages/subtitle-analysis`: altyazı arama çekirdeği
- `channels/birdesengor/channel.json`: kanal proje bağlantısı
- `channels/birdesengor/web`: ayrı [birdesengor-web](https://github.com/raistlinmajere1981-del/birdesengor-web) Git deposu (submodule)
- `apps/web`: tek web kaynağına yerel kısayol (dosya kopyası değil)
- `channels/birdesengor/.local-data`: Birdesengör Studio yerel verisi (Git dışında)

Ana repo ve web repo farklı commit ve Git geçmişine sahiptir. Web repo kendi başına `npm ci && npm run dev` ile geliştirilir. Tasarım offline; hiçbir canlı siteye otomatik deploy yok.

## İlk kurulum

```bash
git clone --recurse-submodules https://github.com/raistlinmajere1981-del/ChannelFoundry.git
cd ChannelFoundry
npm ci
npm ci --prefix channels/birdesengor/web
```

Mevcut çalışma klasöründe web reposunu eşitlemek için: `git submodule update --init`.

## Geliştirme komutları

```bash
npm run start:birdesengor       # kanalın yerel Studio verisiyle Electron
npm run dev:studio:birdesengor  # Studio geliştirme
npm run dev:birdesengor        # bağımsız web Vite
npm run build:birdesengor      # bağımsız web derlemesi
npm run verify:release         # yerel bütünleşik kontroller
```

Studio ve Web ayrı Git depolarıdır. Bir web sitesinde yapılan commit önce o web reposuna gönderilir, ana repodaki submodule işaretçisi ayrı bir ChannelFoundry commitinde güncellenir. `npm run verify:release` her ikisini yerelde bütünleşik kontrol eder.

## Temel üretim hattı

`Çözümleme → Ayıklama → Evrene İşleme → İnceleme → Hikâyeleştir → Görsel Tamamlama → Yayınlama`

Kanal kataloğu çoklu kanal destekler. Kanal özelinde ayrılmış Studio veri kökü kullanılır. Tek Studio oturumunda editoryal kayıtların bütünüyle kanal bazında ayrılması sonraki geliştirme konusudur.

## Dokümantasyon

`docs/00-Vizyon.md`, `docs/01-Manifesto.md`, `docs/02-Yol-Haritasi.md`, `docs/05-Veri-Mimarisi.md` ve diğer belgeler.
