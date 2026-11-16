# BirDeSenGör — Codex A/B deneme sonuçları

**16 Kasım 2026 · iki kaynak, kaynak-sınırlı üretim ve bağımsız denetim**

**Durum:** Deneme tamamlandı; **kalıcı anlatı aktarımı yapılmadı**. Kaynaklar `ALE-un6L4F4` ve `gqohHX-tl6Y`. Gerçek denemeler, kaynak envanteri 135 onaylı Türkçe bölüm / 142 doğrudan video bağlantısı durumundayken yapıldı.

## 1. Üretim ve bağımsız denetim

| Kaynak | Yöntem | Üretim | Denetim | Toplam token | Toplam süre | Kaynak denetim sonucu | Gövde |
|---|---|---:|---:|---:|---:|---|---:|
| `ALE-un6L4F4` | Sol Medium, tek ajan | 138.184 | 170.382 | **308.566** | 140,86 sn | **pass**, 0 bulgu | 8.851 karakter |
| `ALE-un6L4F4` | Terra High, fiilen tek ajan | 167.860 | 71.947 | **239.807** | 104,73 sn | **pass**, 0 bulgu | 4.390 karakter |
| `gqohHX-tl6Y` | Sol Medium, tek ajan | 154.709 | 86.051 | **240.760** | 170,52 sn | **review**, 1 küçük dil bulgusu | 7.431 karakter |
| `gqohHX-tl6Y` | Terra High, fiilen tek ajan | 111.312 | 50.330 | **161.642** | 97,75 sn | **fix**, 2 engelleyici + 1 gözden geçirme | 3.615 karakter |

**İki kaynak toplamı:** Sol + Sol/High denetim **549.326 token / 311,38 sn**; Terra + aynı denetçi **401.449 token / 202,48 sn**. Terra bu örneklerde yaklaşık %27 daha az raporlanan token ve %35 daha az süre kullandı. Ancak yazdığı iki anlatı toplam **8.005** karakter; Sol'un anlatıları toplam **16.282** karakter. Yalnız hız ve token tüketimi, kaynak kapsaması veya anlatı kalitesi değildir.

### Denetim farklarının niteliği

- Sol'un ikinci video taslağında bir **küçük dil/kişi eki** sorunu çıktı: `Çağrılması beni şaşırtmış…` ifadesi yerine `Kuyuya çağrılmam beni şaşırtmış…` kaynak açısından daha açıktır.
- Terra'nın ikinci video taslağında iki **kaynak anlamını etkileyen** hata çıktı: koruyucu vefkin **kime yaklaşmayı** engellediğini ters kişi zamiriyle aktarmak ve kitabın **tılsımı bulunmadığı** yönündeki anlatımı, Ömer'in kendi açıklamasından emin olamaması biçimine dönüştürmek.
- Ek bir kişi adı denetimi: kaynaktaki `Hurşimi`, Terra metninde `Huşimi` olmuş.
- İki yöntemin ilk video denetimi temiz olsa da Sol metni daha kapsamlı; ikinci videodaki bulgular Terra'yı, metin sadakati bakımından otomatik standart yapmayı desteklemiyor.
- Üretilen **pilot taslakları**, yayın onaylı kitap kayıtları değildir. `review` ve `fix` sonuçları düzeltilmeden aktarım yapılamaz.

## 2. Gerçek native Codex subagent denemesi

İlk Terra pilotunda `--enable multi_agent_v2` açık olmasına rağmen `--ephemeral` yüzünden `collab spawn failed: ... no rollout found` hatası görüldü; bu iki Terra çıkışı **gerçekte tek ajan** sonucudur. Sorunun nedeni keşfedilerek sonraki denemede **native ajanlara ait oturum kayıtlarının tutulması** sağlandı.

Düzeltilmiş `terra-high-native-v2` yöntemi ilk video için gerçekten iki `spawn_agent` çağrısı yaptı: `/root/events` ve `/root/ambiguities`. Aynı denemede kök Codex çağrısının JSONL sayacı **306.109 token** verdi. Yakın zamanda açılan ve kendi ayrı roll-out metriklerini taşıyan iki yardımcı oturum **154.998** ve **120.434 token** bildirdi. **Oturum bazında toplam yaklaşık 581.541 token**, tek video için. Bu üç oturumun maliyetlerini üst çağrıdan bağımsız değerlendirmek gerekiyor: ana oturumun JSONL tüketimi, alt ajanların her birinin ayrı tüketimini tek başına göstermiyor.

Üretilen gövde **6.295 karakterdi**; `sourceAnchors` kaynakta birebir bulunmayan en az bir alıntı içerdiği için yapısal kontrol **başarısız** oldu. Dolayısıyla bağımsız `pass` denetimi veya editoryal onay almadı. İlk video native üretimi ~98 saniye sürdü; aynı videodaki fiilen tek ajan Terra üretimi ~58 saniye ve **167.860 token** idi. Bu örnekte native subagent çözümü **yaklaşık 3,5 kat daha fazla oturum tokenı** harcamış ve daha başarılı sonuç üretmemiştir.

İkinci native video denemesi başlatılmış, ancak yüksek yardımcı oturum tüketimi görüldüğünde **erken durdurulmuştur**; o denemenin kısmi tokenları yukarıdaki 581.541 sayısına dahil değildir. Yeni native kaynak taslakları yayına aktarılmadı. Deneme sonu açık Codex/pilot işi bulunmuyor.

## 3. Teknik sonuç ve güvenlik kararları

- Codex CLI sürümü: `0.169.0`; `multi_agent_v2` özelliği varsayılan kapalıdır, sadece ilgili native pilot çağrısında açıldı.
- Native V2 alt ajanları için `--ephemeral` kaldırıldı. Tek ajanlı görüşmeler hâlâ `--ephemeral` kullanabilir.
- Gerçek native subagent yeniden denemesi için **ayrı** `--allow-expensive-native` onayı zorunlu; yanlışlıkla çalıştırma engellenir. Native çağrı aşamasına ek **120 saniye üst zaman sınırı** kondu. Bu süre token sayısını sınırladığı anlamına gelmez; yeniden deneme önerilmiyor.
- Codex `--json` kayıtlarından `input_tokens`, `cached_input_tokens`, `output_tokens`, süre ve denetim bulguları ayrı kaydedilir. Eksik kullanım değerleri **bilinmiyor** olarak tutulur.
- Klasik kaynak üretim motorunda da `--meter-tokens` seçeneği hazırdır; eski komutların davranışı varsayılan olarak değişmedi.
- Her iki kaynak için çıktı JSON'ları, doğrulama mühürleri, audit ve çalışma metrikleri Git dışındaki `channels/birdesengor/.local-data/studio/book-coverage/pilots/batch04-ab-v1/` klasöründe korunur.
- Genel Studio AI ayarları, SQLite veritabanı, onaylı 135 Türkçe anlatı, 115 İngilizce varyant, 142 video bağlantısı, şifre/SEO ve canlı site **değişmedi**.

## 4. Standart iş akışı önerisi

**Kaynağa sadakat önceliği nedeniyle:** `gpt-6.1-sol / medium` ile kaynak başına ayrı Türkçe taslak, ardından `gpt-6.1-sol / high` ile **ayrı kaynak denetimi**, `--meter-tokens`, en fazla iki paralel kök çalışan ve açık `pass` editoryal kontrolü. `review/fix` gelirse taslak düzeltilip yeniden denetlenir. Native subagent'lı otomatik seri üretim **şimdilik uygun değil**.

Terra High, uzun üretim yerine daha dar kapsamlı **kitap başlıkları / seriler arası ilişki / plan denetimi** için denenebilir. Eğer buna geçilecekse kaynağı okumayan bir genel koordinatörün yayın metnini kendiliğinden düzenlememesine dikkat edilmeli.

**Sonraki işlem:** Dördüncü onluk paketin ilk iki videosunda yapılan A/B denemeleri kalıcı kitaba eklenmediğinden normal kaynak işleme kuyruğu hâlâ `not_started:10` durumunda. Bu paket daha önce belirlenen kaynak-sınırlı Sol üretim/denetim hattıyla tekrar tamamlanmalı; pilot taslakları otomatik içeri aktarılmamalıdır.
