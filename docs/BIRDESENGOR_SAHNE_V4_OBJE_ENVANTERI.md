# BirDeSenGör — V4 Bağımsız Obje Envanteri

Kaynak: kanonik manifest ve efekt sahnesi; 13 Kasım 2026. Bu tablo mevcut kod ile planlanan parçaları ayırır.

| Nesne ID | Aile | Durum | Bileşenler | Etkin / toplam efekt |
|---|---|---|---|---|
| `research-journal` | Kitap | Bağımsız web katmanı | Kapalı deri kapak, Tılsım desen yolu | 0 / 1 |
| `community-journal` | Kitap | Bağımsız web katmanı | Topluluk kitabı | 0 / 1 |
| `camera` | Cihaz | Bağımsız web katmanı | Kamera gövdesi, Kapak LCD / son afiş | 0 / 1 |
| `candle` | Masa objesi | Bağımsız web katmanı | Mum gövdesi, Mum altlığı, Alev / duman / ışık | 3 / 3 |
| `vefk-stand` | Cihaz | Bağımsız web katmanı | Çizim cihazı kasası, Parşömen / çizim alanı, Divit ve mekanizma | 0 / 1 |
| `water-basin` | Masa objesi | Bağımsız web katmanı | Bakır kap gövdesi, Su yüzeyi | 1 / 1 |
| `stone-specimen` | Taş sistemi | Bağımsız web katmanı | Yeşil taş, Taş altlığı, Bakır damlalık mekanizması | 2 / 3 |
| `ceremonial-robe` | Duvar objesi | Bağımsız web katmanı | Kaftan ve kuşak, Sabit askılık | 0 / 1 |
| `guardian-sword-left` | Duvar objesi | Bağımsız web katmanı | Sol kılıç, Kılıç duvar bağlantısı | 1 / 1 |
| `guardian-sword-right` | Duvar objesi | Bağımsız web katmanı | Sağ kılıç, Kılıç duvar bağlantısı | 1 / 1 |
| `archive-chest` | Duvar objesi | Bağımsız web katmanı | Sandık gövdesi, Menteşeli kapak, Sandık iç boşluğu ve ışık maskesi | 2 / 3 |
| `incense-holder` | Masa objesi | Bağımsız web katmanı | Tütsülük gövdesi, Köz / duman | 2 / 2 |
| `ceremonial-dagger` | Masa objesi | Bağımsız web katmanı | Hançer gövdesi | 1 / 2 |
| `metal-pendulum` | Masa objesi | Bağımsız web katmanı | Sabit sarkaç gövdesi, Hareketli metal parça | 1 / 1 |

Toplam 14 kanonik nesne: 14 bağımsız temel görsel / obje grubu. Kanonik 22 efekt tanımından 14 tanesi etkin.

Bağımsız durumu sadece en az bir temel görselin ayrı bir web katmanında çizildiğini gösterir; bütün alt parçaların bitmiş olduğu anlamına gelmez.

## Efekt, kaynak ve ankraj ayrıntıları

### research-journal

- Aktif ankraj kimlikleri: `journal.spine`.
- Efekt kimlikleri: `research-journal-seal-hover`.
- Fiziksel bileşenler: Kapalı deri kapak [Bağlı]; Tılsım desen yolu [Planlandı].
- Sadece planlanan, henüz olmayan ankrajlar: `cover.talisman-path`.

### community-journal

- Aktif ankraj kimlikleri: `community-journal.spine`.
- Efekt kimlikleri: `community-journal-tree-hover`.
- Fiziksel bileşenler: Topluluk kitabı [Bağlı].

### camera

- Aktif ankraj kimlikleri: `camera.lens`.
- Efekt kimlikleri: `camera-lcd-hover`.
- Fiziksel bileşenler: Kamera gövdesi [Bağlı] `/scene-assets/camera/research/camera-body.webp`; Kapak LCD / son afiş [Bağlı].

### candle

- Aktif ankraj kimlikleri: `candle.flame-base`, `candle.smoke`.
- Efekt kimlikleri: `flame-1`, `glow-1`, `smoke-1`.
- Fiziksel bileşenler: Mum gövdesi [Bağlı]; Mum altlığı [Bağlı, mumla birleşik kesim]; Alev / duman / ışık [Bağlı].
- Sadece planlanan, henüz olmayan ankrajlar: `candle.body-contact`.

### vefk-stand

- Aktif ankraj kimlikleri: `vefk-stand.ink-plane`.
- Efekt kimlikleri: `vefk-stand-nib-hover`.
- Fiziksel bileşenler: Çizim cihazı kasası [Yenilenecek]; Parşömen / çizim alanı [Bağlı]; Divit ve mekanizma [Bağlı].
- Sadece planlanan, henüz olmayan ankrajlar: `vefk.table-contact`.

### water-basin

- Aktif ankraj kimlikleri: `water-basin.water-surface`, `water-basin.body`.
- Efekt kimlikleri: `water-basin-ripple`.
- Fiziksel bileşenler: Bakır kap gövdesi [Bağlı] `/scene-assets/p8/copper-basin.webp`; Su yüzeyi [Yenilenecek].
- Sadece planlanan, henüz olmayan ankrajlar: `water-basin.table-contact`.

### stone-specimen

-  Aktif ankraj kimlikleri: `stone-specimen.glint`, `stone-specimen.impact`, `stone-specimen.dropper-outlet`.
- Efekt kimlikleri: `stone-specimen-drop`, `stone-specimen-tremor`, `stone-specimen-preview-hover`.
- Fiziksel bileşenler: Yeşil taş [Bağlı] `/scene-assets/stone/jade-rock.webp`; Taş altlığı [Bağlı]; Bakır damlalık mekanizması [İlk tasarım bağlı].
- Bağımsız damlalık çıkışı ve damla çarpma ankrajı gerçek sahne verisine eklendi.

### ceremonial-robe

- Aktif ankraj kimlikleri: `ceremonial-robe.fabric`, `ceremonial-robe.gold-reflection`.
- Efekt kimlikleri: `ceremonial-robe-preview-hover`.
- Fiziksel bileşenler: Kaftan ve kuşak [Bağlı] `/scene-assets/robe/ceremonial-kaftan.webp`; Sabit askılık [Bağlı].
- Sadece planlanan, henüz olmayan ankrajlar: `ceremonial-robe.shoulder-hook`.

### guardian-sword-left

- Aktif ankraj kimlikleri: `guardian-sword-left.metal-glint`.
- Efekt kimlikleri: `guardian-sword-left-glint`.
- Fiziksel bileşenler: Sol kılıç [Bağlı] `/scene-assets/p8/guardian-sword.webp`; Kılıç duvar bağlantısı [Yenilenecek].
- Sadece planlanan, henüz olmayan ankrajlar: `guardian-sword-left.wall-mount`.

### guardian-sword-right

- Aktif ankraj kimlikleri: `guardian-sword-right.metal-glint`.
- Efekt kimlikleri: `guardian-sword-right-glint`.
- Fiziksel bileşenler: Sağ kılıç [Bağlı] `/scene-assets/p8/guardian-sword.webp`; Kılıç duvar bağlantısı [Yenilenecek].
- Sadece planlanan, henüz olmayan ankrajlar: `guardian-sword-right.wall-mount`.

### archive-chest

- Aktif ankraj kimlikleri: `archive-chest.lock`, `archive-chest.rear-hinge`.
- Efekt kimlikleri: `archive-chest-preview-hover`, `archive-chest-lid-open`, `archive-chest-light-leak`.
- Fiziksel bileşenler: Sandık gövdesi [Bağlı] `/scene-assets/chest/archive-body.webp`; Menteşeli kapak [Bağlı] `/scene-assets/chest/archive-lid.webp`; Sandık iç boşluğu ve ışık maskesi [Yenilenecek].
- Sadece planlanan, henüz olmayan ankrajlar: `archive-chest.inner-light`.

### incense-holder

- Aktif ankraj kimlikleri: `incense-holder.ember`, `incense-holder.smoke`.
- Efekt kimlikleri: `incense-holder-smoke`, `incense-holder-ember`.
- Fiziksel bileşenler: Tütsülük gövdesi [Bağlı]; Köz / duman [Bağlı].
- Sadece planlanan, henüz olmayan ankrajlar: `incense-holder.table-contact`.

### ceremonial-dagger

- Aktif ankraj kimlikleri: `ceremonial-dagger.blade-glint`.
- Efekt kimlikleri: `ceremonial-dagger-preview-hover`, `ceremonial-dagger-shadow`.
- Fiziksel bileşenler: Hançer gövdesi [Bağlı] `/scene-assets/p8/ceremonial-dagger.webp`.
- Sadece planlanan, henüz olmayan ankrajlar: `ceremonial-dagger.table-contact`.

### metal-pendulum

- Aktif ankraj kimlikleri: `metal-pendulum.suspension`.
- Efekt kimlikleri: `metal-pendulum-sway`.
- Fiziksel bileşenler: Sabit sarkaç gövdesi [Bağlı] `/scene-assets/metal-pendulum/fixed.webp`; Hareketli metal parça [Bağlı] `/scene-assets/metal-pendulum/pendant.webp`.
- Sadece planlanan, henüz olmayan ankrajlar: `metal-pendulum.table-contact`.

## Tek master çalışma sözleşmesi

1. Tek 2:1 oda kaynak görseli, web/public altındaki approved klasöründedir. Studio ve web sahnesi aynı kaynağı yükler.
2. İki kılıç ve bakır tas ayrı fiziksel WebP olarak doğrudan gerçek web DOM içinde çiziliyor. Studio onların tek kanonik pozisyonunu, bağlı efekt hedefini ve tıklama alanını birlikte taşır.
3. Eski oda fotoğrafı, compare anahtarı, ikinci WebP kopyası, geçici kaynak ya da bağımsız V4 pozisyon tablosu tutulmuyor.
4. Mum ile oyma ahşap tütsülüğün özgün gövdeleri eski arşiv fotoğrafından saydam WebP olarak ayrıldı. Gerçek efekt ankrajıyla Studio/Web üzerinde taşınabiliyor.
5. Bakır altlık eski fotoğraftan ayrıldı ve bakır damlalığın ilk çizimi ayrı WebP olarak eklendi. Gerçek çıkış ağzı ile temas noktası bulundu.
6. Sandık kapağı arka menteşeye bağlı; gövde ve kapağın yeni odada ışık ve perspektife göre yeniden görselleştirilmesi gerekiyor.
7. Kaftan, yeşil taş, hançer, tütsü ve sarkacın kimlikleri korunacak; her yeni cutout ortak ışık ve temas gölgesiyle üretilecek.
8. Kitap kapağında koyu motif üzerinde ışığın dolaştığı tılsım açılma animasyonu sonraki aşama.
9. Master henüz tüm nesnelerle tamamlanmadığından deploy veya Git push yok.

## Studio kullanım yolu

Sahne Atölyesi → Fotoğraf (tek master) → Plan: Sabitler / Ana nesneler / Detaylar → sahne ağacından nesne → Nesne → V4 · Nesne ailesi ve kaynak durumu. Üç bağımsızlaşan gövde için Konum ve boyut bölümü/Şimdi Taşı kullanılabilir. Nesne, efekt ve hit alanı tek sahne veri akışını izler.

## V4.4 yerel fiziksel nesne turu
- Kesilmiş mum ve tabak görseli: /scene-assets/physical/melted-candle.webp
- Kesilmiş özgün oyma tütsülük: /scene-assets/physical/carved-incense-holder.webp
- Taşın altlığı: /scene-assets/stone/ornate-copper-plinth.webp
- Damlalık mekanizması: /scene-assets/stone/copper-drip-arm.webp
- Taşın kendisi eski kaynak /scene-assets/stone/jade-rock.webp ile korunur.
- Damlalık ayrı, metal görüntüsü daha sonra foto-gerçekçi kaynakla değiştirilebilir.
- Eski ve yeni iki master yok; tek sahne, tek nesne konumu. Deploy, commit ve push yok.


### V4.6 Çizim Atölyesi notu

Ayaklı şasi yerine /scene-assets/vefk/chassis-tabletop.webp aktif. 1024×1536 koordinat sistemi korunarak üst çerçeve, parşömen ve kontrol rafı aynı kalır; alt ayaklar silinip 1190. pikselde alçak kaideyle tamamlanmıştır. Studio ve web aynı kaynak görsele bağlıdır; ikinci gövde veya önizleme anahtarı yoktur.


### V4.7 Kamera/Sandık

- Kamera gerçek son onaylı bölüm küçük resmini kapalı LCD'ye iki katmanda taşır; ön afiş 16:9 korunur, arka katman hafif bulanıktır. Studio yerel onaylı export önizlemesiyle aynı fiziksel coverX/Y/Scale/Brightness parametrelerini kullanır. Afiş düzenlemesi sonradan manuel yapılabilir.
- Sandık: /scene-assets/chest/archive-body.webp sabit; /scene-assets/chest/archive-lid.webp tek arka menteşede rigid rotateX; /scene-assets/chest/interior-light-mask.webp sandık ağzına bağlı ışık. Ön kenar esnetme ve lift parametresi yoktur.

### V4.8 Kitap tılsımı ve dil anahtarı

- Evren kapak fotoğrafı ve 3B kapak kimliği aynı, coverBrightness %52–105 aralığında, varsayılan %79. Topluluk kapağı %100.
- Var olan research-journal-seal-hover yuvası seal-trace; fiziksel kapağın pusulasında ışık yolu, research-journal.talisman-path ankrajı. 14 nesne / 22 efekt / 15 etkin.
- Dil anahtarının ikinci tıklaması yok; mevcut bakır plaka altında konum/ölçek/eğim verilerini takip eden görsel bir gömme yuvası.
