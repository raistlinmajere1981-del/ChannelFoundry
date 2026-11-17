# BirDeSenGör — On üçüncü kaynak paketi / hazır onaylı kohortun tamamlanması

17 Kasım 2026 — Özgün video altyazılarından Evren kitabına sekiz Türkçe anlatı, Studio import run #33.

## Kaynak sadakati ve denetim sistemi

- Sekiz taslak yalnız kendi özgün Türkçe altyazısından üretildi. Ömer birinci şahıs anlatıcıdır. Video yayın tarihi olay tarihi değildir. Harici bilgi kullanılarak gerçeklik hükmü verilmedi; konuşmacının iddiası, gelecekteki plan ve yaşanmış olay birbirinden ayrıldı.
- gpt-6.1-sol / medium ilk taslak ve bağımsız denetim oturumları kullanıldı. Denetim artık 10 videoluk paketi veya diğer proje dosyalarını açtırmadan, yalnız tek doğrulanmış özgün altyazıyı ve ilgili taslak başlık/gövdesini doğrudan veriyor. Betikteki prompt_audit yenilendi.
- Bağımsız kaynak denetimi 8/8 PASS, tüm son taslak ve audit SHA-256 mühürlü. Önceki başarısız veya düzeltme isteyen taslaklar, eski denetim/ölçüm dosyaları silinmeden arşivlendi.

## Sekiz anlatı

| Video | Başlık | Yerleşim |
|---|---|---|
| xHAXV5jUX6A | Muzer’in Anlattığı Yeraltı Şehri ve Kitapları | İstihbarat Davetleri |
| RMeoosHjgiQ | Yaşlı Duman’la Depremler ve Monolitler Üzerine | İstihbarat Davetleri |
| x0MeMxbVUeY | Sessiz Kapılar Üzerine Bir Davet | İstihbarat Davetleri |
| P_iRCO-yzqg | Yeraltı Şehrinin Girişinde: Firavun’un Eşyaları ve Kitapları | Bağımsız kayıt |
| Kp7S7s1e5Xw | Diyalog Adını Taşıyan Ağın Peşinde | İstihbarat Davetleri |
| dBWiqrUt7aE | Babil Yolculuğu Öncesinde Yaşlı Davetliyle Konuşmam | İstihbarat Davetleri |
| -WNsc9DXJzg | Kaf Davetinden Gelen Haberler ve Beklemediğim Dostluk | İstihbarat Davetleri |
| nEOOFyKcROE | Beyaz Sayfadaki Köprü, Merdiven ve Kaybolan Çukur | İstihbarat Davetleri |

## Önemli kaynak düzeltmeleri

1. xHAXV5jUX6A: Muzerin Mısır çölleri altındaki şehir, Firavun kitapları ve getirilebilecek emanetler hakkındaki sözleri Ömerin bizzat yeraltına giderek gördüğü kanıt sayılmadı.
2. RMeoosHjgiQ: Yaşlı Duman ile deprem ve monolitler hakkında haberleşme. Ömerin konuğu bilgili olduğu için çağırması ile sözünde ciddi olması birbirinden ayrıldı; plaketi elinde tuttuğu kaynaksız betimleme çıkarıldı.
3. x0MeMxbVUeY: Dünyanın ekseninin kaydığı iddiaları ve sessiz kapılar üzerine davet. Üç kaynak alıntısının altyazıdaki satır sonları düzeltildi; bu sebeple anlatı gövdesine dokunulmadı.
4. P_iRCO-yzqg: Poyrazla yapılan yeraltı şehri ziyaretinde rehberin beni takip et talimatı ve sallanan nesne doğru özneyle anlatıldı; üç parmaklı elin sahibi kesinleştirilmedi. Yılanların kazanda kaynatılması ile akrepler ayrı anlatıldı. Bozuk transkripsiyondan konuşma güçlüğü çıkarılmadı.
5. Kp7S7s1e5Xw: Diyalog adındaki topluluk hakkındaki iddialar Ömerin/konuğun konuşmalarında tutuldu; odak noktasında olanın hangi kişi olduğu doğru konuşmacıya bağlandı. Gerçek insanlar hakkında kanıtlanmış suç isnadı olarak sunulmadı.
6. dBWiqrUt7aE: Babilin kadim sakinlerinden biri olduğu söylenen yaşlı konuğun görüşmesi ve henüz başlamamış Babil yolculuğu. İbn Zenhur ile davetlinin aynı kişi olduğu kesinleştirilmedi.
7. -WNsc9DXJzg: Kaf davetindeki okyanusa düşen nesne ve yaratık haberi. Ömerin oraya gitmediği kaynaksız kesinliği ve umut ifadesindeki işaret belirsizliği giderildi.
8. nEOOFyKcROE: Büyük deprem, beyaz sayfa, köprü, merdiven ve kaybolan çukur haberleri; konuğun anlatıları Ömerin kendi görüp yaptığı olaylara dönüştürülmedi.

## Veritabanı ve kaynak kapsama

| Ölçüt | Önce | Sonra |
|---|---:|---:|
| Türkçe onaylı anlatı | 225 | 233 |
| Video kapsamı | 232/283 | 240/283 |
| Onaylı İngilizce anlatı | 115 | 115 |
| İstihbarat Davetleri | 50 | 57 |
| Bağımsız kayıt | 34 | 35 |
| Düğümlü numaralı doğrudan davet | 65 | 65 |
| Hazır onaylı kaynak bekleyen video | 8 | 0 |
| Yalnız taslak düğümlü bekleyen video | 43 | 43 |
| Tüm bekleyen video | 51 | 43 |
| Kalan kaynak paketi | 6 | 5 |
| Evren kaydı farkı | 3930 | 3930 |

- Tek aktif Studio DBye önce geçici SQLite kopyasında onaylandıktan sonra import run #33 uygulandı; 8 yeni anlatı ve 10 yeni inline kaynak bağlantısı. Önceki 225 anlatı, 225 revizyon, 225 dil kaynağı, 340 dil varyantı ve eski kitap sıralamaları birebir korundu.
- Otomatik doğrulanmış işlem öncesi DB yedeği: channels/birdesengor/.local-data/studio/backups/before-book-import-2026-11-17T09-37-57-031Z.sqlite.
- Arşiv: channels/birdesengor/.local-data/studio/book-coverage/completed-batches/batch-13-20261117, toplam 105 dosya; 8 son taslak, 8 son denetim, 8 mühür, model ölçümleri ve önceki denetim denemeleri. Önceki DB yedeği üzerinde arşivden yeni aktarım yapıldı; altı temel anlatı, sıralama, dil kaynak ve varyant tablosunun tüm içerik alanları canlı DB ile eşit. Yalnız yeni işlenme/onay zaman damgaları farklı.
- Snapshot c8cabbff1e009ec73e24e06050c89df3c341cff48f4334b63c8f7210861e2ef4, check-snapshot PASS. Hazır/onaylı hikaye-olay kaynaklı bekleyen video sıfır; 43 video yalnız taslak düğümlü, 5 paket. Yeni kohort için taslak düğümler olay kanıtı sayılmadan özgün altyazı ve ayrı editoryal inceleme gerekli.
- Studio build PASS, web 289/289 test PASS, web build PASS, narrative-store, publication-v2, Düğümlü final readiness PASS; quick_check=ok, foreign_key_check=0. Web büyük JS parçacığı uyarısı hataya dönüşmedi. Tam tarayıcı E2E tekrar yapılmadı.
- Codex CLI kullanım raporu: 8 gpt-6.1-sol/medium taslak çağrısı 294574 token; denetim ve düzeltmeler dahil 17 gpt-6.1-sol/medium çağrısı 628009 token; toplam 922583 token. Denetim girişinin 34816 tokeni cache kaynaklıdır. Bu sayılar fiyat değildir; on ikinci partinin 3853760 toplam tokenine göre video başına tüketim yaklaşık yüzde 70 daha düşüktür, fakat video zorlukları eşdeğer değildir.
- İngilizce çeviri, resimler, SEO, site şifresinin kaldırılması, deploy veya push yapılmadı. Kullanıcıya ait web sahne/efekt dosyaları dokunulmadan bırakıldı.
