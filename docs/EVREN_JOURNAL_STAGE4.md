# BirDeSenGör — Evren Kitabı / Aşama 4: kaynak ayrımı, editoryal kontrol, güvenli bölüm eşleşmesi

7 Kasım 2026. Terminal bağlantısı üzerinden, Codex kullanmadan yerelde uygulandı. **Git commit/push, Studio içerik üretimi, gerçek veri dönüşümü veya web deploy yapılmadı.**

## Hedef ve sınırlar

Yeni Hikâyeleştir üretimi teknik ilişki etiketlerinden anı türetmemeli; yeni anlatılar kaynaklı, kanalın kalıcı anlatıcı profilindeki perspektife bağlı ve olabildiğince doğal olmalı. Studio eski deneme yayınlarındaki yanlış kişi, sponsor veya ilişkileri yeniden yazmadı. Kullanıcı eski Evren içeriklerini yalnız test malzemesi sayıyor.

## Uygulama

1. `apps/studio/narrative-evidence.cjs` — `narrative-records-v1` frozen kaynak politikası. Onaylı Evren `node` kayıtları anlatı kanıtı; `relation` kayıtları yalnız grafik kenarı. İlişki etiketleri AI'ye olay, söz, anı veya başlık olarak geçmez. `sourceVideos` yayın tarihine göre kararlı sıralanır; yayın tarihi olay tarihi diye kullanılmaz.
2. `narrative-store.cjs` — Yeni prepared çalışmalara `evidencePolicy` alanını ve fingerprint'e bu sürümü ekler. Eski hazırlanmış çalışma (ör. #3) **değiştirilmez**; eski sözleşmeyle devam eder. Kullanıcı yeni politikayı almak için eski taslağı açıkça Vazgeç ile kapatıp yeni çalışma hazırlar.
3. `narrative-ai-contract.cjs` — Yeni run'larda `input.changes` ve `allowedSources` yalnız node kayıtları taşır. `technicalGraphChanges` ve `relationContext` etiket/metin içermeyen ayrı bağlantı alanlarıdır. Yeni yanıtta `sourceKeys` içine teknik relation kimliği verilirse kayıt reddedilir. Eskiden hazırlanmış run'ların legacy request şekli korunur.
4. `narrative-ai-generation.cjs` — Kaynaklara dayalı birinci şahıs anlatımını ve üçüncü kişilerin iddialarını ayıran; farklı davet ve videoları yanlış birleştirmemeyi, bağlantı etiketlerini metne taşımamayı ve kopuk bitiş/anahtar kelime dizileri üretmemeyi isteyen ek prompt. Kaynak gerçeği yerine geçmez; yeni gerçek kaynaklar gerektiğinde manuel editoryal değerlendirme şarttır.
5. `narrative-quality.cjs` + `narrative-service.cjs` — Taslaklar saklandıktan sonra **salt okunur** editoryal uyarılar: kopuk bitiş/anahtar kelime, son cümle eksikliği, teknik ilişki dili, olası üçüncü şahıs anlatıcı ve 4+ kaynak video. Metni sessizce dönüştürmez; onay kullanıcıda kalır. Mevcut #3 taslağında `Yedi Kapı` ve `Bledum Babil` parçalarını ayrı ayrı yakalar.
6. `NarrativeWorkbench.tsx`, `narrative-workbench.css`, TypeScript sözleşmesi — Açık/koyu temada daha yüksek kontrast ve metin büyüklüğü; video başlıkları açıkça gösterilir, teknik ilişkilerden ayrı gerçek kaynak sayısı belirtilir; uyarılar anlatı altında ayrı kartta görünür. Uyarı varsa onay ek teyit ister.
7. `NarrativeOutlineWorkbench.tsx` — Tek bir ortak kaynağı bulunan bir anı, yanlış dizi/bölüme otomatik bağlanmaz. Otomatik bölüm yerleştirmede **bütün** sourceVideoIds'ın aynı bölüm teklifine ait olması gerekir. Karışık kaynaklı anılar editöre gösterilir; manuel seçim mümkündür, hiçbiri otomatik değiştirilmez.
8. `narrative-service.status` — Bekleyen onaylı `recordChanges` ve `relationChanges` ayrı sayılır; toplam değişiklik sayısı aynı kalır.

## Doğrulamalar

- `npm run verify:narrative-stage4`: izole SQLite kaynak/ilişki, eski frozen run uyumu, gerçek React/IPC bölüm eşleşmesi ve sentetik browser görünümü PASS.
- `npm run build:studio`: TypeScript ve Vite PASS.
- Narrative service, AI generation, editoryal UI, IPC, outline, structured content, Studio appearance, fixed viewport ve publication v2 testleri PASS.
- Gerçek #3 taslağını salt okunur değerlendiren analiz: `Mezna’daki Yolculuk` ve `Bledum Daveti` dört video kaynaklı olduğu için kontrol; `Yedi Kapı` ve `Bledum Babil` kopuk son ifadeleri algılanıyor.
- Sentetik Chromium görselleri: `artifacts/narrative-stage4/narrative-reading-light-1640.png`, `narrative-reading-dark-1366.png`. Açık tema/büyük metin 19px; onay uyarısı ve kaynak bağlantıları geçti.

## Kullanıcının sıradaki adımı

Mevcut #3 çalışma bilinçli şekilde korunuyor. Geliştirmeyi aktif etmek için Studio'yu yenileyip:
1. #3 taslağında uyarıları gözden geçir; henüz **Onayla** yapma.
2. **Vazgeç** ile #3 taslağını kapat.
3. **Çalışmayı hazırla** → **AI taslağını üret** ile yeni kaynak politikası kullanılarak yeni metin üret.
4. Yeni taslakların kaynak kimlikleri, anlatıcı perspektifi ve editoryal kontrol notlarını incele; sonra onaylama kararını ver.
5. Günlük Düzeni'ndeki eski Meseyn / tekrarlanan 3. Davet yaprakları test düzenidir; yeni gerçek anılar sonradan doğru dizi/bölümlere **editör onayıyla** yerleştirilir.

AI modeline herhangi bir çağrı yapılmadı, kullanım limiti tüketilmedi. Kaynak verileri yanlış veya belirsizse sistem o bilgiyi kendiliğinden doğrulayamaz; öneriler ve uyarılar editoryal değerlendirmeyi kolaylaştırır, insan kontrolünü ikame etmez.

## Aşama 4.1 — Metin içi referans güvenliği (8 Kasım 2026)

İlk gerçek #4 taslağında AI paragraf metninin arkasına 8–10 adet art arda `reference` span ekledi. `plainTextFromBlocks` bunları birleştirdiğinden görünen metin `... buldum.ÖmerDüğümlü KitapPoyraz...` biçimine dönüşüyordu. Sorun kaynak dağıtımından değil, yapılandırılmış AI yanıtının bağlamsız bağlantılarının kabul edilmesinden kaynaklandı.

- `narrative-ai-contract.cjs`: Referans örneği artık `text → reference → text` biçiminde ve gerçek bir cümle içinde. Bağlantı kuralları isim listelerinin yasak olduğunu açıkça belirtiyor.
- `narrative-ai-generation.cjs`: AI'ye metin içinde söz edilen ismi `reference` ile değiştirmesi, bölüm sonunda toplu karakter/nesne dizisi üretmemesi, anlatıcının kendisini `Ömer`/`Anlatıcı` karakter kartına bağlamaması söyleniyor.
- `narrative-quality.cjs`: Art arda referanslar, tamamlanmış cümleden sonra eklenen kopuk referanslar, tek başına referans paragrafları ve birinci şahıs anlatıcısına ait karakter referansları **blocker** kontrol notlarıdır. Kaynak metin değiştirilmez.
- `narrative-store.cjs`: Yeni `narrative-records-v1` çalışmalarda bu hatalar taslak yazılmadan reddedilir; eskiden kaydedilmiş modern taslaklar da onay öncesi tekrar denetlenir. Direkt store `applyRun` yolu dahil engelleme uygulanır. Legacy run'lar sessizce dönüştürülmez.
- `NarrativeWorkbench.tsx`: Blocker varsa `Onayla` düğmesi pasif olur, sayısı ve gerekçesi görüntülenir. Kullanıcı `Vazgeç` ile eski çalışmayı kapatıp yeni prompt ile üretebilir.
- `narrative-api-contract.d.ts`: `blocker` kontrol notunun tipi eklendi.

Doğrulamalar: `npm run verify:narrative-stage4`, `verify-narrative-ai-generation`, `verify-narrative-structured-content`, `verify-narrative-service-contract`, `verify-narrative-ipc`, Studio build, appearance, fixed viewport ve `git diff --check` geçti. İzole SQLite'da bağlantı kuyruğunun kaydı ve onayı reddedildi, önceki geçerli taslak korundu, düz metin içine doğru yerleştirilen referans kabul edildi, anlatıcının kendi adı/kimliği linklenmedi. Sentetik Chromium'da `Onay engellendi` butonu disabled doğrulandı. Ekran kanıtı: `artifacts/narrative-stage4/narrative-approval-blocked-1366.png`.

Salt okunur gerçek DB kontrolünde #4 çalışması hazırlanmış halde, 3 taslak ile duruyor; üçünde kopuk referans, ikisinde anlatıcı karakter bağlantısı tespit ediliyor. **#4'ü onaylamak mümkün değil; veri silinmedi, düzenlenmedi veya yeniden üretilmedi.** Kullanıcı, Studio yeniden açıldıktan sonra #4 üzerinde `Vazgeç` ve sonraki çalışma için `Çalışmayı hazırla → AI taslağını üret` kullanabilir. Yeni AI çıktısının doğruluğu bu gerçek üretimden sonra ayrıca incelenecek.

Git commit, push veya deploy yapılmadı. Codex/OpenCode/AI modeli çağrılmadı.
