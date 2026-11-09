# BirDeSenGör · Günlük Düzeni / İçindekiler ağacı

## İşlevsel sözleşme (9 Kasım 2026)

Yayın Atölyesi → AI Atölyesi → 05 Hikâyeleştir içindeki **Günlük Düzeni** iki sütunlu, tek çalışma alanında yönetilir: solda sürüklenebilir İçindekiler ağacı, sağda seçilen dizinin/alt bölümün başlık editörü veya seçilen onaylı anının bölüm seçimi. Görsel rötuşlar daha sonraki Codex turuna bırakılmıştır.

- Muhataplar/Nesneler/Mekânlar kitap dizinlerinin sırası sabittir ve kayıtlara bağlıdır; editörden üretilen ayrı bir “Hikâyeler” grup başlığı yoktur.
- Dizi > alt bölüm > onaylı anı ve bağımsız anılar ağacı, kalıcı stable key'lerle çalışır. Yeni dizi ve alt bölüm oluşturulabilir. Başlık, numara ve açıklama aynı görünümde düzenlenir.
- Başlıkların üzerine tıklamak editörü açar; anının üzerine tıklamak atanacağı bölümün seçimini açar. Kaynak videolardan yalnız başlık önerileri üretilebilir; doğrudan yayımlanmaz.
- Sol tutamaktan sürükle-bırak veya ↑/↓ ile kardeşler sıralanır. Alt bölüm başka bir diziye, anı başka bir alt bölüme ya da bağımsız alana taşınabilir. Boş bölüm ve bağımsız alan bırakma hedefidir.
- Tek hareket = tek SQLite transaction (moveNode). Hedefin varlığı, kayıt türü ve onaylı anı zorunlu tutulur. Hata durumunda tüm hareket geri alınır. Hiçbir anlatı metni, onay, kaynak anahtarı veya video ilişki kaydı değiştirilmez.
- Bağımsız anılar narrative_independent_order tablosunda sıralanır. publishedOutline.ungroupedSectionIds bu sırayı dışa verir; web kitabı normalizeOutline ve bookContents üzerinden gerçekten bu sırada gösterir.
- Henüz onaylı anı yoksa dizi/alt bölüm iskeleti hazırlanabilir ancak boş yapı site yayınına çıkmaz. Yayın onayı ve deploy ayrı akıştır.
- Anlatıcı kimliği Kanal Ayarları’nda kalır. Çeviri katmanı ve diğer Studio modülleri değiştirilmez.

## Kod yüzeyleri

- Studio UI: apps/studio/src/NarrativeOutlineWorkbench.tsx ve narrative-outline.css
- Veri: apps/studio/narrative-outline.cjs; köprü: narrative-ipc.cjs, preload.cjs, src/narrative-api-contract.d.ts
- Kitap: channels/birdesengor/web/src/data/publication.js ve src/book/bookModel.js

## Kontrol

- node apps/studio/verify-narrative-outline.cjs: onay, transaction, farklı grup, rollback, bağımsız sıra
- node apps/studio/tests/narrative-outline.browser.mjs: gerçek React + IPC + sentetik SQLite, sürükle ve editör
- npm run build:studio; node apps/studio/verify-publication-v2.cjs
- npm --prefix channels/birdesengor/web test; npm --prefix channels/birdesengor/web run build
