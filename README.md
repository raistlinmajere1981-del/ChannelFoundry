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

## Paralel geliştirme portları

- Yardımcı Asistan masaüstü geliştirme portu: `127.0.0.1:5174` (başka projeye ait; değiştirilmez)
- ChannelFoundry Studio: `127.0.0.1:5194`, port sabit ve sunucu kimliği zorunludur.
- BirDeSenGör web tasarımı: `127.0.0.1:5195`, port sabittir.

Başlatmak için `npm run dev:studio:birdesengor` ve bağımsız web için `npm run dev:birdesengor` kullanılır. Port doluysa işlem başka porta sessizce taşınmaz; hata verir. Studio Electron yalnızca kendi kimlik doğrulama endpointini sunan Vite sunucusunu açar.

Kontrol: `npm run verify:dev-isolation`.


## Studio üst çubuk ve kanal yönetimi

Tüm ekranlarda üst çubuktan aktif **kanal projesi** değiştirilebilir.
Sağdaki simgeler **yt-dlp** yönetimini (kurulum, sürüm, otomatik kontrol) ve
**Studio görünümünü** (tema, metin boyutu) küçük panellerde açar.

**Ayarlar → Kanal ve yayın** tek kaynak kaydıdır: YouTube kanal adresi,
tüm kanal veya playlist arşiv kapsamı ve web yayın hedefi burada belirlenir.
**Kaydet** yalnız yerel proje kaydını değiştirir; video indirmez ve web yayını
yapmaz. **Kataloğu bağla** seçilen YouTube kaynağını doğrular ve boş katalog
olarak kaydeder; video/altyazı alımı Video Arşivi'ndeki manuel senkronizasyondur.
Ayarlar'ın diğer bölümleri AI, Topluluk, Yerel veri şeklinde ayrıdır.

Projenin `deploymentEnabled` bayrağı kapalıyken Studio canlı web yayınını
engeller; Birdesengör Natro kurulumu için bu durum değiştirilmedi. Temiz
başlangıç öncesi mevcut indirilen arşiv verilerine dokunulmadı.

## AI servisleri ve OpenCode

Ayarlar > AI servisleri iki bağımsız Metin / Görsel sekmesi kullanır. OpenCode yalnız metin için desteklenir. OpenCode sunucusu yerel uygulama ayarlarından belirlenir; Ortak servis düğmesi aktif opencode service status adresini bulur (bu bilgisayarda 127.0.0.1:49374). Ayrı opencode serve sunucusu (ör. 4096) başka kimlik ve kota durumuna sahip olabilir. Ortak servisin parolası Studio içinde kullanıcı tarafından girilir. HTTP API ile yalnız Studio'ya ait geçici, araç izinleri kapalı bir oturumda metin üretimi yapılır ve bu oturum tamamlandığında silinir. Mevcut OpenCode TUI oturumlarına müdahale edilmez. OpenCode V2 ücretsiz metin modelleri read yeteneği tamamen kapatılan oturumlarda yanlış kota hatası döndürebildiği için geçici boş çalışma alanında read açık, diğer bütün araçlar ve external_directory kapalıdır. Parola yalnız yerel ai-config.json içinde dosya izni 0600 olarak tutulur, GitHub'a gönderilmez. Görsel tarafında Codex CLI, Cloudflare ve OpenAI uyumlu servisler bağımsız çalışır. Testler ayarları kaydetmez ve AI kuyruğunu başlatmaz. Modelin gerçek kotası sunucu tarafından belirlenir.
