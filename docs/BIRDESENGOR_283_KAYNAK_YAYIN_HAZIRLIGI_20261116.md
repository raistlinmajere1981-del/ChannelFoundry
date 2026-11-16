# BirDeSenGör — 283 Kaynaklı Evren Kitabı / Yayın Öncesi Editoryal İş Planı

**Tarih:** 16 Kasım 2026
**Çalışma dizini:** `/home/raistlin/ChannelFoundry`
**Kapsam:** İçerik/kaynak tamamlığı; görseller, şifre kaldırma, SEO/indeksleme ve deploy bu planın dışında.

## Kesin yayın ölçütü

- Evren'e işlenmiş **283 videonun her biri**, kitapta **en az bir onaylı bölümün açık kaynak video kimliğine** bağlanmalı.
- Kaynak kimliği tek başına yeterli değildir; ilgili videonun olay/konuşma içeriği bağımsız olarak o bölümde karşılanmış olmalı.
- Tek video tek bölüm zorunlu değildir. Aynı zincirin ayrı kayıtları birlikte işlenebilir, fakat farklı sahne veya farklı davet tek kesintisiz görüşmeymiş gibi anlatılmayacak.
- Yayın tarihi yalnız kaynak metadata bilgisidir; olay kronolojisi kaynaktan kurulacak.
- Kitabın TR ve EN yayın metinleri birbirini karşılamalı; isim, yer, kimlik, sayı ve belirsizlik notları kaynak dışında kesinleşmemeli.
- Eksik sahne/varlık görselleri açılışa engel değil. Özgün 105 bölüm gereksiz yere sıfırlanmayacak; yanlış veya eksik kaynak yansıtıyorsa sürümlü revizyon yapılacak.

## 16 Kasım başlangıç çizgisi

| Ölçü | Sayı |
|---|---:|
| İşlenmiş / ayıklanmış kaynak video | 283 |
| Kitapta doğrudan kaynak bağlantısı bulunan video | 112 |
| Onaylı kitap anlatısı | 105 |
| Yeni kapsam isteyen video | **171** |
| Bekleyen, onaylı hikâye veya olay düğümü mevcut video | 128 |
| Yalnız taslak hikâye/olay düğümü bulunan video | 43 |
| Bekleyen özgün altyazısı eksik video | 0 |
| Çalışma paketi | **18** (13 normal + 5 özel inceleme) |

Ek veri: Onaylı Evren 1.663 düğüm ve 3.619 ilişkidir. Hikâyeleştir ekranındaki 3.930 fark, genel kaynak baseline #13'e kıyasla 1.233 düğüm ve 2.697 ilişki değişimidir; ayrı bir **171 anlatı farkı** sayacı değildir.

## Çalışma dosyaları

- **Yeniden çalıştırılabilir ve salt-okunur denetim:** `apps/studio/birdesengor_book_coverage.py`
- **Kaynak envanteri / bölüm hashleri:** `channels/birdesengor/.local-data/studio/book-coverage/manifest.json`
- **İnsan okunur çalışma raporu:** `channels/birdesengor/.local-data/studio/book-coverage/REPORT.md`
- **18 delil paketi:** `channels/birdesengor/.local-data/studio/book-coverage/source-packets/batch-*.json`
- **Onaysız taslaklar:** `channels/birdesengor/.local-data/studio/book-coverage/drafts/` (kitap veya yayın değildir)

Kaynak paketleri altyazının tamamını, analiz özetlerini, olay sırası ipuçlarını, o videonun onaylı/taslak Evren düğümlerini ve mevcut kitaba olası bağları taşır. Paketler **kanıt dosyası** olarak değerlendirilir, otomatik yeni olay çıkarmak için kullanılmaz. Manifest, paketlerin ve mevcut bölüm metinlerinin hashlerini tutar. Yerel `.local-data` Git'e eklenmez.

## Aşamalar

**Aşama 0 — Kaynak envanteri / güvenlik (tamamlandı).** 283 kaynağın analizi, altyazısı ve bağlantıları test edildi. Envanter ve 18 paket hazır. Son genel kaynak farkı ve önceki 105 anlatı değişmedi. Snapshot bütünlük kontrolü çalışıyor.

**Aşama 1 — İlk 10 kaynak için yöntem sınaması (ilk iki kaynak tamamlandı, parti sürüyor).** Öncelik, onaylı olay/hikâye düğümü bulunan ilk pakete. Özgün altyazıdan kaynak-sınırlı taslak, başka model/kontrol turuyla kaynak denetimi, alternatif olarak mevcut bir bölümde yer alma kararı. Çalışma sadece özel taslak dosyalarına yazacak.

**Aşama 2 — 128 onaylı kaynaklı video.** En fazla 10 videoluk partiler. Her video: bağımsız altyazı denetimi, doğal olay sınırları, mevcut kitap bağları, birleştirme/ayırma kararı, TR anlatı taslağı. Model tarafından önerilen belirsiz isimler doğrulanmış kimlik olarak otomatik yazılmaz. Taslaklar yayınlanmaz.

**Aşama 3 — 43 yalnız taslak kaynaklı video.** Onaylı olay düğümü yokluğu, video dışlanmış veya öyküsüz demek değil. Altyazıdan gerçek anlatı kapsamı denetlenir. Taslak varlıkları onaylamak gerekiyorsa kaynak bazında ve ayrıca; genel toplu onay yapılmaz. Anlatı kaynağı doğrudan video olabilir.

**Aşama 4 — Kontrol ve kitaba aktarım.** Her paket önce geçici SQLite kopyasında; eski 105 bölümün hash eşitliği ve genel kaynak baseline/3.930 farkın kaybolmaması kontrol edilir. Yedek ve tek işlemle yalnız denetlenmiş bölüm revizyonları eklenir. Kaynak/ilişki otomatik çoğaltılmaz. Yayın kapsamına alacağımız bölümlerin konu sırası gerçek kaynak bağlamından belirlenir.

**Aşama 5 — TR/EN ve son kalite.** Önce onaylanmış TR bölümlerinden EN üretilir; son iki dil metni, kaynak kimlikleri, linkler, folio ve konu ağacıyla birlikte sınanır. Doğrudan bağlanan 45 eksik EN Evren varlığı açıklaması da tamamlanır; diğer arşiv EN açığı ayrı kapsamda değerlendirilir.

**Aşama 6 — Yayın ölçütü.** 283/283 doğrudan bağlantı, tüm yeni metinlerin kaynak denetimi, önceki bölümlerde regresyon yokluğu, SQLite/FK, Studio/web unit/build, kitap masaüstü/mobil ve TR/EN okuyucu kabulü. Ancak bu noktada içerik **gerçek yayına hazır** denebilir. Şifre, SEO, indeksleme ve deploy ayrı son adımlar.

## Hızlı çalışma komutları

```bash
cd /home/raistlin/ChannelFoundry

# DB'ye veya çıktı dosyalarına dokunmadan durum sayımı:
python3 -B apps/studio/birdesengor_book_coverage.py --verify-only

# Mevcut çalışma envanterini ve 18 kaynak paketini yeniden doğrula:
python3 -B apps/studio/birdesengor_book_coverage.py --check-snapshot

# Yalnız kaynak değiştiğinde, mevcut TASLAKLARI koruyarak kaynak paketlerini yenile:
python3 -B apps/studio/birdesengor_book_coverage.py

# Nihai yayın kapısı (şu an kasıtlı olarak BAŞARISIZ olmalı):
python3 -B apps/studio/birdesengor_book_coverage.py --require-complete
```

## Değişiklik sınırı

- Önceki 105 onaylı bölüm, onların TR/EN varyantları, Evren düğüm/ilişkileri ve mevcut canlı yayın paketi korunur.
- Komutlar herhangi bir yeni bölüm onaylamaz, içerik yayımlamaz veya baseline farkını tüketmez.
- Yeni metinler için **kaynağın karşılandığını kanıtlayan kayıt** olmadan yalnız yeni kaynak ID ekleyip 283/283 gösterilmez.
- Kaftan, kılıç ve efekt üzerinde web alt-reposunda bulunan commit edilmemiş değişikliklere dokunulmaz.
- Olayların gerçekliği hakkında dış dünya filtresi uygulanmaz; metnin **anlatı içi kaynağa sadakati** kontrol edilir.

## Kapanış için tekrar kontrol

- `git status` root + web alt-repo;
- kayıt/veritabanı ve onaylı anlatı hashlerinin değişip değişmediği;
- paket hashleri ve 283 sayısı;
- ilk kaynak taslağı oluşturulduysa kaynak denetimi statüsü;
- açık Codex/AI süreçleri (oturum sonunda bırakılmamalı).

## Kaynak-sınırlı parti motoru

Tekrar eden üretim ve denetim çağrılarını yönetmek için `apps/studio/birdesengor_book_batch.py` eklendi. Video dosyaları **sıra numarasına değil, 11 karakterlik video ID'sine** bağlanır; yeni bölüm aktarıldığında iş listesi değişse bile taslak yanlış videoya taşınmaz. Kaynak paketi checksum'ı, taslak alıntılarının altyazıyla birebir eşleşmesi, denetimdeki hatalı alıntıların reddedilmesi ve audit/hash mührü kontrol edilir. Komutun kendisi **yalnız yerel taslak/denetim dosyaları üretir**; otomatik kitap onayı yoktur.

```bash
cd /home/raistlin/ChannelFoundry

# Bütün 171 kaynağın yerel taslak/denetim durumu:
python3 -B apps/studio/birdesengor_book_batch.py --action status

# Sadece ilk parti:
python3 -B apps/studio/birdesengor_book_batch.py --action status --batch 1

# Yalnız ilk partinin 10 kaynağında kaynak-sınırlı taslak üret:
python3 -B apps/studio/birdesengor_book_batch.py --action generate --batch 1 --limit 10 --model gpt-6.1-sol --effort medium

# Hazır taslaklar için bağımsız özgün altyazı denetimi:
python3 -B apps/studio/birdesengor_book_batch.py --action audit --batch 1 --limit 10 --model gpt-6.1-sol --effort medium
```

Parti yöneticisindeki `audited_pass` yalnız **otomatik kaynak karşılaştırması temiz** anlamına gelir. Bölümün editoryal olarak yayımlanacağına veya başka bir mevcut bölümle birleştirileceğine karar verilmiş değildir. `audited_review` manuel/ikinci tur gerektirir; `audited_fix` kaynak düzeltmesi gerektirir; `invalid_audit` ise alıntı/sözleşme denetimini geçmemiş rapordur.

**Uygulama notu:** İlk kaynak Q8e_Zar_dIM ("Zifir Kuyusu ve Okyanusun Dibi") ve ikinci kaynak VMcU2s8e-II ("Siyah Kitapların Peşindeki") ayrı kaynak-sınırlı taslaklara dönüştürüldü; ikisi de bağımsız kaynak denetiminde `pass` aldı ve metin/denetim/source hashleri mühürlendi. İkinci kaynağın ilk denetiminde AI taslakta bulunmayan bir cümleyle alakasız bir Ömer kimliği gerekçesi üretti; sözleşme bunu reddetti, hatalı rapor arşivlendi ve kurallar netleştirilerek denetim tekrarlandı. Hiçbir metin otomatik olarak değiştirilmedi veya kitaba aktarılmadı.

**Yayın kapısı sınırı:** `--require-complete` teknik olarak doğrudan video bağlantı sayısını 283/283'e çıkarma koşuludur; bunun geçmesi, nitel kaynak sadakatinin denetlendiği anlamına **tek başına gelmez**. Ayrı editoryal kanıt kayıtları tamamlanmadan yayına onay verilmez.
