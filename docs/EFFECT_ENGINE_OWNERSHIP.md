# Efekt mimarisi — sahiplik ve devir planı

## Tamamlandı: Aşama 1 — tek motor

- Tek kanonik kaynak: packages/effect-engine/src/model, registry, runtime.
- BirDeSenGör V2 web, @effect-engine alias'ı ile Channel Foundry paketini kullanır. Dış EfektAtolyesi kaynak yolu kaldırıldı.
- Fotoğraf v1 / objectScene v2 sözleşmeleri ve tek ticker korunur.
- Test: npm run verify:effect-engine

## Tamamlandı: Aşama 2 — Studio Sahne Atölyesi

- Studio üretim menüsüne Sahne Atölyesi eklendi.
- Kanonik editör: packages/effect-engine/src/editor.
- İkinci Vite HTML giriş noktası apps/studio/scene.html; geliştirme ve dist modları src/scene-editor-entry.mjs üzerinden editörü açar.
- apps/studio/scene-workshop-site.mjs, BirDeSenGör sahne kaynağı, manifest, adaptör, bağlı efekt yuvaları ve kaynak hash'ini doğrular.
- apps/studio/scene-workshop.cjs, taslağı yalnız Studio userData içindeki scene-workshop dizinine atomik kaydeder; eski migration verisi aktarılmaz.
- Akış: Oku → Kaydet → Siteye hazırla → Ön kontrol → Canlı yayın.
- Kaydetmek site dosyasını değiştirmez. Hazırlama yalnız src/effects/birdesengor-effects.v2.json dosyasını atomik günceller.
- Kaynak sürümü değişmişse kayıt/hazırlama reddedilir. Nesne ve ankraj yerleşimleri sitenin yetkisinde kalır.
- Kaydedilmemiş değişikliklerde gezinme uyarısı verilir.

## Channel Foundry yayın yolu — kod hazır, canlı yayın doğrulanmadı

- 10 dakikalık, tek kullanımlık onay token'ı ve yeniden hash kontrolü var.
- Ön kontrol: Vite derlemesi, Natro planı ve uzak FTPS kuru deneme.
- Kullanıcı ikinci kez onay verirse gerçek FTPS deploy ve canlı site doğrulaması çalışır.
- Mevcut makine-özel ~/.local/bin/birdesengor-natro aracı ~/.config/channel-foundry/birdesengor-natro.env bağlantısını kullanır. Ayrı Studio FTP ayarı veya ikinci şifre deposu açılmaz. Kuru deneme clean-dry-run, deploy clean-deploy komutuyla yapılır; canlı deploy bu aşamada denenmedi.
- Eski Yardımcı Asistan Admin hâlâ BirDeSenGör hedefini içeriyor. Tek yazar sınırı Yardımcı Asistan temizliği sonunda sağlanacak.

## Kabul ve testler

- Kanonik motor: 48/48 PASS.
- Studio sahne servisi: 5/5 PASS; izole gerçek dosya yazma ve stale hash engeli test edildi.
- Studio sabit ekran, shell ve derleme testleri PASS.
- Tarayıcı: 14 nesne, 13 efekt, 0 JavaScript hatası.
- React Studio ekranı + editör (Vite geliştirme modu): Kaydet, Siteye hazırla, Ön kontrol, yayın onayını reddetme PASS.
- Gerçek BirDeSenGör kaynak dosyasına test verisi yazılmadı.

## Tamamlandı: Aşama 3 — Yardımcı Asistan sınırı

- Admin BirDeSenGör scene_v2 hedefi, ön kontrol/deploy IPC ve özel release servisi kaldırıldı.
- Admin kendi site fotoğraf efektlerini YA apps/admin-control-center/effects-source altında yönetir.
- Eski Editor HTML/CSS ve fotoğraf örnekleri Admin kaynaklarına taşındı.
- Motor ve editor JS tek kanonik Channel Foundry paketinden fingerprint SHA-256 doğrulanarak web-site-template ve Admin snapshot'ına dağıtılır.
- BlackSea, Teknikel, Gündoğdu ve Demo LOCAL ortak şablonları 0.8.0/95 common dosyayla eşitlendi; hiçbir canlı site güncellenmedi.
- Admin test: 9/9 fotoğraf/yayın regresyonu, 2/2 sahiplik testi, test:admin ve TypeScript build PASS.
- Yerel site parity 5/5 PASS.
- Studio yayın aracı ~/.local/bin/birdesengor-natro üzerinden mevcut makine-özel FTPS ayarını kullanıyor.
- Gerçek clean-dry-run geçti; canlı deploy yapılmadı.

## Tamamlandı: Aşama 4 — eski bağımsız deponun kapanışı

- Kullanıcı iki panelin kendi site/sahne yönetimini görsel olarak kabul etti.
- Eski EfektAtolyesi checkout yeniden adlandırılıp erişilemez hale getirildikten sonra Studio, BirDeSenGör, Yardımcı Asistan ve site şablon testleri başarılı çalıştı.
- Gündoğdu ve Teknikel kanonik-cutover testleri artık sadece Channel Foundry motorunu doğruluyor; Gündoğdu'nun eski asset retirement snapshot hash kayıtları değiştirilmedi.
- Eski checkout yerelde silindi. GitHub üzerindeki tarihi bağımsız repo arşiv olarak korunur; ona commit/push yapılmaz.
- Kabul: motor 48/48, sahne servisi 5/5, web 233/233, site template 10/10, Gündoğdu 9/9, Teknikel 11/11, BlackSea 4/4 PASS.
- FTPS clean-dry-run daha önce PASS, canlı deploy YAPILMADI.
- Projeler için yeni sahiplik: Channel Foundry kanonik geliştirme + BirDeSenGör; Yardımcı Asistan Admin site fotoğraf efekt yönetimi; tüm siteler sabit hash motor snapshot.
