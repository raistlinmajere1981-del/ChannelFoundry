# Sahne Atölyesi V5 — Proje adaptörü sınırları

## Tamamlanan altyapı
- **Ortak model:** `packages/effect-engine` nesne/efekt doğrulaması ve WebP kaynak doğrulaması. Proje ve kanal bilgisi içermez.
- **Bağlayıcı arayüzü:** `snapshot, validate, validateAssets, readiness, preview, backgroundInfo, previewObjects, stage`. İsteğe bağlı `previewArt, roomObjects, focusTargets`.
- **BirDeSenGör kaynağı:** `scene-workshop-site.mjs`. Mevcut 14 nesne ve efekt yuvalarının koruması ve proje dosyalarına atomik kaynak hazırlığı burada kalır.
- **BirDeSenGör yayın kapısı:** `scene-workshop-birdesengor-publisher.cjs`. FTPS ve canlı onay yalnız bu bağlayıcıya aittir.
- **Yerel proje:** `scene-workshop-local.mjs`. Yeni sahne yalnız Studio kullanıcı veri dizini altındaki `scene-workshop/projects/<id>/` alanına yazılır. 2:1 arka plan, bağımsız WebP nesneleri ve efektleri destekler. Canlı yayın yolu yoktur.
- **IPC/proje seçici:** Her istekte proje kimliği; kaynak kimliği ve taslak ayrı. Projeler arasında istemci ve sunucu kaynakları karışmaz. Kaydedilmemiş düzenleme varken proje değiştirmek kapalıdır.
- **Sahne arayüzü:** Proje listesinden BirDeSenGör veya yerel sahne açma; `＋ Sahne` ile bağımsız sahne oluşturma. Yerel sahnede yalnız `Kaydet` ve `Yerelde hazırla` bulunur.

## Kurallar
- BirDeSenGör Evren Kitabı kayıtları, web içeriği, yayın ayarları ve canlı site değişmedi.
- Yerel sahne yalnız `artwork` nesne türü kullanır; orijinal veri/efekt motoru formatı aynıdır.
- Yeni sahnenin arka planı 2:1 WebP olmalıdır. Diğer en-boy oranları için ayrı görsel düzenleyici/kadraj stratejisi gerekir.
- Bir projenin onayı veya kaynak kimliği başka projede kullanılamaz. Yerel projelerde preflight/deploy sunucuda da reddedilir.
- Canlı siteyi genel bir bağlayıcı olmadan otomatik yayınlamaya çalışmayız.

## Sonraki aşamalar
1. Her website için açıkça yapılandırılan güvenli **web sahne adaptörü** ve görüntü katmanı entegrasyonu; proje klasörlerini otomatik tarayarak kod çalıştırma yok.
2. Bağımsız sahne paketini dışa aktarma/içe aktarma (JSON + bütün görsel dosyaları; kimlik, boyut ve hash kontrolü).
3. Farklı sahne oranları ve gerçek cihaz kadrajı için adaptör tanımlı kurallar.
4. Yerel sahneler için silme/arşivleme ve proje listesinde ileride çoğalan sahnelerin yönetimi.

## Test kapsamı
`npm run verify:scene-workshop`, `npm run verify:scene-workshop-ui`, `npm run verify:effect-engine`, `npm run build:studio`. Gerçek BirDeSenGör testleri ve yerel proje izolasyonu ayrıca kontrol edilir.
