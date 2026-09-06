# Channel Foundry

Channel Foundry, uzun soluklu video arşivlerini **yerel-first bir editoryal üretim hattı** ile işleyip kontrollü bir yayına dönüştürmek için geliştirilen bağımsız bir Studio + Web projesidir.

Studio yerel veriyi yönetir; AI destekli çözümleme, editoryal ayıklama ve anlatı üretim akışlarını yürütür. Onaylanan içerik bir publication paketi olarak Web katmanına aktarılır. Kaynak ağaç gerçek çalışma verisi, hesap bilgisi, API anahtarı veya üretim sunucusu hedefi içermez.

## Mimari

- **Studio (`apps/studio`)** — Electron + React/Vite tabanlı yerel üretim uygulaması.
- **Web (`apps/web`)** — Onaylanmış publication paketini ziyaretçiye sunan React/Vite arayüzü ve gerekli PHP uçları.
- **Domain (`packages/domain`)** — Studio ile Web arasındaki ortak yayın sözleşmeleri.
- **Subtitle analysis (`packages/subtitle-analysis`)** — Altyazı arama ve ilişki raporlamasının yerel analiz çekirdeği.
- **Dokümantasyon (`docs`)** — Ürün kimliği, veri modeli, anlatı akışı, tema sözleşmesi ve yayın mimarisi.

Studio üretim hattı:

`01 Çözümleme → 02 Ayıklama → 03 Evrene İşleme → 04 İnceleme → 05 Hikâyeleştir → 06 Görsel Tamamlama → Yayınlama`

AI çıktısı doğrudan yayınlanmış içerik değildir. Yayınlanacak veri editoryal karar ve publication sınırlarından geçer.

## Studio yetenekleri

### YouTube katalog ve altyazı arşivi

- Birden fazla YouTube kanalını aynı yerel çalışma alanında yönetme ve aktif kanal bağlamını Studio genelinde kullanma.
- Kanal bazlı ayarlar: Shorts, canlı yayın ve üyelere özel içerik kapsamı; başlık/metadata dili; öncelikli ve yedek altyazı dili; thumbnail boyutu.
- Yakın zamanda eklenen veya tam kapsamlı katalog senkronizasyonu; iptal edilebilir ilerleme bildirimi ve kapsam dışı kayıtların kontrollü güncellenmesi.
- Video başlığı, süre, tarih, altyazı durumu, arşiv durumu ve yerel thumbnail önbelleği üzerinden filtreleme.
- Seçili videoların altyazılarını tek tek veya kuyruk halinde yerel arşive alma.

### Altyazı Araştırma v3

- Tekil/çok kelimeli terim araması ve kavram gruplarıyla ilişki araması.
- İçerir veya tam kelime eşleşmesi; bağımsız sonuç veya aynı video bağlamı.
- Kelime, cümle veya video yakınlığı; terim sırası; kanal ve tarih aralığı filtreleri; tarih, oluşum ve mesafe sıralaması.
- Kayıtlı sorgu presetleri, bağlam içinde eşleşme vurgusu ve ilişki matrisi.
- Sonuçları Markdown ve JSON olarak dışa aktarma; video, terim, oluşum ve kanıt bağlamını birlikte taşıma.

### AI destekli editoryal çalışma

- Yapılandırılmış AI sağlayıcı ayarları ve yerel/uyumlu sağlayıcılarla çalışma.
- Kaynak çözümleme, konu/varlık çıkarımı, editoryal ayıklama, revizyon incelemesi ve Evren çalışma alanı.
- Anlatı taslağı, kanıt/provenance görünümü, görsel tamamlama ve kontrollü publication hazırlığı.
- AI aktivite görünümü, aşama bazlı çalışma alanı ve her aşamada insan onayı.

### Görünüm ve erişilebilirlik

- Koyu ve açık tema, ortak semantic design token'ları üzerinden aynı bileşen yüzeylerini kullanır.
- Standart, rahat ve büyük metin ölçekleri; uzun okuma metinlerinde satır genişliği ve satır aralığı desteği.
- Klavye odağı ve azaltılmış hareket tercihleri desteklenir.
- Görünüm tercihi bu bilgisayarda saklanır; varsayılan Studio görünümü koyu tema + rahat metindir.

## Web / publication katmanı

Web uygulaması Studio'dan onaylanmış publication paketini alır ve bunu araştırma/okuma odaklı bir arayüzde sunar. Kitap benzeri arşiv sunumu, bölüm ve kategori gezinmesi, topluluk not defteri, YouTube kamera arşivi ve Babylon tabanlı kitap kabuğu bu katmanın parçalarıdır.

Web içeriği yerel Studio verisinden otomatik olarak public edilmez; yayınlama akışı seçilmiş ve doğrulanmış publication verisiyle sınırlıdır.

## İlk çalıştırma

Önerilen ortam:

- Node.js 22+
- npm
- YouTube katalog ve transkript özellikleri için isteğe bağlı `yt-dlp`
- AI özellikleri için yerel Ollama veya yapılandırılmış uyumlu bir sağlayıcı

```bash
npm ci
npm run verify:release
npm run start:studio
```

Web'i yerelde çalıştırmak için:

```bash
npm run dev:web
```

Geliştirme sunucusuyla Studio çalıştırmak için:

```bash
npm run dev:studio
```

Studio ilk çalıştırmada yerel veri kökünü oluşturur. Varsayılan konum:

`local-data/studio/`

Başka bir konum kullanılabilir:

```bash
CHANNEL_FOUNDRY_DATA_ROOT=/mutlak/yol npm run start:studio
```

## Public kaynak / yerel veri sınırı

Aşağıdakiler kaynak repoya dahil edilmez ve release kopyasına taşınmamalıdır:

- Studio SQLite veritabanları
- gerçek kanal katalogları ve transkriptleri
- yerel görsel çalışma dosyaları ve thumbnail önbelleği
- AI ayarları, API anahtarları ve debug çıktıları
- `.env` dosyaları
- hosting kimlik bilgileri ve üretim sunucusu hedefleri

`local-data/` çalışma alanıdır ve Git tarafından yok sayılır. Public/release kopyası bu nedenle sıfır veriyle başlar; içerik kullanıcının kendi Studio kurulumunda oluşturulur.

## Doğrulama

Tam yerel doğrulama:

```bash
npm run verify:release
```

Önemli alt kontroller:

```bash
npm run build:studio
npm run verify:appearance
npm run verify:youtube-channels
npm run verify:subtitle-analysis
npm run build:web
npm run verify:web-dist
```

`verify:release`, Studio derlemesini, görünüm/erişilebilirlik sözleşmesini, çok kanallı katalog ve altyazı araştırmasını, AI/editoryal akışları, publication kontrollerini ve Web derlemesini birlikte çalıştırır.

## Dev → release akışı

Geliştirme çalışmaları `ChannelFoundry-dev` içinde doğrulanır. Release/public kopyaya aktarım öncesinde temiz bir checkout üzerinde:

1. Dev dalının güncel halini alın.
2. Bağımlılıkları kurup `npm run verify:release` çalıştırın.
3. Yalnızca kaynak kodu, dokümantasyon ve gerekli public asset'leri aktarın.
4. `local-data/`, SQLite dosyaları, gerçek transkriptler, thumbnail önbelleği ve sırları release kopyasına taşımayın.
5. Public kopyada diff'i gözden geçirip ardından normal GitHub push akışını kullanın.

## Yayınlama

Web deploy scripti herhangi bir canlı hesaba gömülü değildir. SSH hedefi ve uzak web kökü açıkça verilmelidir:

```bash
export CHANNEL_FOUNDRY_DEPLOY_HOST=user@example.com
export CHANNEL_FOUNDRY_DEPLOY_ROOT=/srv/www/site
export CHANNEL_FOUNDRY_PUBLIC_URL=https://example.com

npm run deploy:web -- --dry-run
npm run deploy:web
```

`CHANNEL_FOUNDRY_PUBLIC_URL` verilmezse script uzak dosya doğrulamasını yapar, HTTP smoke testini atlar.

GitHub Actions içindeki deploy workflow'u bilerek yalnız manuel çalıştırılır ve hedef bilgilerini repository secrets üzerinden bekler. Böylece fork veya yeni public kurulumlar bir `main` push'unda istemeden bir üretim ortamına yayın yapmaz.

## Dokümantasyon

Başlangıç için:

- `docs/00-Vizyon.md`
- `docs/01-Manifesto.md`
- `docs/02-Yol-Haritasi.md`
- `docs/03-Web-Tasarim-Rehberi.md`
- `docs/04-Studio-Tasarim-Rehberi.md`
- `docs/05-Anlati-Katmani-ve-Yasatma-Akisi.md`
- `docs/05-Veri-Mimarisi.md`
- `docs/06-Web-Tema-Veri-Sozlesmesi.md`
- `docs/06-Yerel-Mimari-ve-Yayin.md`
- `docs/07-Release-Checklist.md`
- `docs/identity.md`
- `docs/visual-system.md`

Public kaynak ağacı ürün ve mimari belgeleri taşır; tarihsel session devir notları, kişisel çalışma checkpoint'leri ve coding-agent oturum talimatları dağıtımın parçası değildir.
