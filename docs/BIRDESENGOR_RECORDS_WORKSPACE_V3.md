# BirDeSenGör — Kayıt Dosyaları V3 / birleşik editoryal çalışma ortamı

## Sahiplik ve ekran mimarisi (13 Kasım 2026)

Üretim Studio ekranı `apps/studio/src/EditorialWorkspaceV3.tsx` üzerinden çalışır. Üstte altı alt-sekme, kayıt ayrıntısında beş iç sekme ve her bölümün ayrı listesini kullanan V2 yüzeyleri kaldırıldı. Tek kayıt arşivi, tek seçili kayıt editörü ve görünür görsel/bağlam paneli vardır.

- **Arşiv:** AI evren düğümleri, manuel/YouTube kayıtları, sponsor ve katkıda bulunanlar tek aramada; tür/durum/sıra filtreleri. 100 satırlık sayfalı görüntüleme, özet/alias/kaynakta arama. Aynı kayda çift yol sunulmaz; içerik sahipliği korunur.
- **Düzenleyici:** `EditorialRecordDetail.tsx` hikâye, muhatap, olay, mekân, nesne ve manuel kayıtları bir yüzeyde düzenler. Anlatı akışı ve bağlam özellikleri ihtiyaç üzerine açılır. Onaylı AI ilişkileri, yalnızca belge/kaynak izi olarak okunur.
- **Destek kayıtları:** `RecordSupportDetail.tsx` kaynak video geçerliliğini korur, sponsor/katkıda bulunan türünü, isim ve kaynak eşlemesini editoryal düzeltme olarak kaydeder. Yayın dışı ve geçersiz kaynaklar belirtilir.
- **Görseller:** `VisualProfileEditor.tsx` yeni `dock` görünümüyle seçili kaydın yanında kalıcı önizleme ve görsel ekleme, üretim, kaldırma, dosyayı gösterme kontrolleri sunar. Açılır ayarlar görsel tarifi, özellikler, atmosfer ve promptu içerir. Prompt boşken üretim düğmesi ayarları açar. Kayıt görüntüsü/üretim servisi değiştirilmedi.
- **Bağlam:** seçilen kayda ait ilişkiler, karşı kayıt bağlantıları ve kaynak video adları sağ panelde; ayrıntılı bağlantı keşfi aynı orta çalışma alanında. Hikâyenin sıralı anlatı akışı doğrudan hikâye editöründe.
- **Toplu işlemler:** manuel kayıtlar için çoklu seçime bağlı `bulkApply` çağrıları. AI evren ve sponsor kayıtları genel silme/yayınla işlemlerine dahil edilmez. Gerçek site yayını ayrı işlem olarak kalır.
- **Gezinme:** kayıt listesi sağ tuş menüsü; bağlam/görsel ayarlarına doğrudan geçiş; `Ctrl/Cmd+K` arama odağı. Kaydedilmemiş metin ve görsel profili, uzun süren görsel üretimi, kayıt değiştirme, Studio sayfa değiştirme, proje değiştirme ve pencere kapatma sırasında korunur.
- **Yerleşim:** Studio'nun sıcak açık, koyu ve soft-dark temaları semantik tokenlarla desteklenir. Kayıt Dosyaları menüyü varsayılan ikon modunda açar. 1280×720–1500×870 tarayıcı kabulü sayfa taşıması olmadan çalışır.

## Veri sözleşmeleri

AI onay/taslak düzenlemesi `universeWorkspaceUpdate`, görseller `visualProfileGet/Save`, `visualImagePick/Generate/Clear`, destek kayıtları `aiAnalysisSupportSave`, manuel kayıtlar `saveItem`, çoklu işlemler `bulkApply` ile yapılır. Bunların yayın/SQLite davranışı ve kayıt kimlikleri değiştirilmedi. `onReload` Studio arşiv verisini yeniler. Yerel kaydetme canlı deploy değildir.

## Temizlik

Üretim tarafından artık kullanılmayan `EditorialWorkspaceV2`, `EditorialWorkspaceEditor`, `EditorialRelationsView`, `EditorialTimelineView`, `SupportRecordsEditor`, `BulkOperations` ve beş yalnız bu yüzeylere ait eski CSS dosyası kaldırıldı. `verify-visual-completion` kaydı artık eski Görsel Profil sekmesini değil, seçili kaydın sürekli görünür görsel modülünü denetler.

## Kabul

- `npm run build:studio`
- `npm run verify:records-workspace` — React tarayıcı entegrasyonu: arşiv, resim üretme/ekleme, sağ tuş, taslak koruması, sponsor CRUD, güvenli toplu işlemler, 1280×720–1500×870 çalışma alanı
- `npm run verify:studio-shell`
- `npm run verify:workspace-design`
- `npm run verify:fixed-viewport`
- `npm run verify:visual-completion`
- `npm run verify:support-records`
- `node apps/studio/verify-universe-workspace.cjs`
- `node apps/studio/verify-publication-v2-ui.cjs`

Canlı siteye deploy yapılmadı; gerçek evren kayıtları, görseller, SQLite ve web yayını değiştirilmedi.
