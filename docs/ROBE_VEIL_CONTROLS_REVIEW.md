# Kaftan görünmezlik ayarları — Studio ve site

2026-11-17

## Bulgu ve düzeltme

Silüet kenarı eski uygulamada optik kırılma tuvalinin CSS gölgesiydi. `distortionPx=0` olduğunda motor bu tuvali bilerek boş bırakıyor; dolayısıyla `edgeOpacity` 0,06'dan 0,35'e değiştirilse de çizilecek bir kenar kalmıyordu.

Kenar artık kaftanın alfa silüetinden bağımsız bir tuvale çiziliyor. Optik kırılma, kumaş izi ve kenar birbirinden bağımsızdır: üçü sıfırken görünmezlikte çizim kalmaz; yalnız kenar yükseltildiğinde sadece dış kontur görünür. Çizim ayar/durum değişiminde bir kez yapılır; sürekli çalışan bir animasyon eklenmedi. Aynı ortak çizici hem Studio hem web tarafından kullanılır.

Kumaş izi değeri zaten kumaş görselinin opaklığına doğru uygulanıyordu. Ancak seçili tıklama alanının turuncu dolgusu %6,5 gibi düşük kumaş izi değerlerinin üzerinde kalıyordu. Görünmezlik önizlemesinde bu dolgu ve alan çerçevesi kaldırıldı. Açıkça tıklama alanı düzenleme moduna geçildiğinde düzenleme alanı ve tutamaçları korunur.

## Tarayıcı kanıtı

- Studio, optik kırılma ve kumaş izi 0 iken kenar 0 / 0,06 / 0,35 karşılaştırıldı.
- 0,06 kenarda alfa toplamı 21.933; 0,35 kenarda 129.404. Gerçek çizilmiş pikseller değişiyor; içi dolu bir kaftan yerine kontur çiziliyor.
- Kumaş izi 0 / 0,065 / 0,30 hem hesaplanmış opaklık hem ekran görüntüsüyle karşılaştırıldı.
- Optik kırılma 0 / 0,5 / 7 değerlerinde karşılaştırıldı; sıfırda tuval boş, pozitif değerlerde duvar pikselleri farklı.
- Görünür duruma dönüldüğünde kumaş opaklığı 1, kırılma ve kenar katmanlarının opaklığı 0.
- Studio kaynak kabul kontrolü geçti. Ayar değişimleri kaftanın yerleşimini ve diğer nesnelerin verilerini değiştirmedi.
- Web: 1600×900 ve 390×844 normal hareket; 390×844 azaltılmış hareket. Tıklama, yeniden yüklemede durumun korunması ve görünür duruma dönüş kontrol edildi.

Kanıtlar: `artifacts/robe-veil-controls/zero.png`, `edge-006.png`, `edge-035.png`, `fabric-030.png`, `results.json`.

## Doğrulama

- Ortak efekt motoru: 63/63 birim testi geçti.
- Web: 289/289 birim testi geçti.
- Studio görünmezlik tarayıcı testi geçti.
- Web görünmezlik tarayıcı testi üç durumda geçti. İlk eşzamanlı derleme/test denemesinde tarayıcı kapanmıştı; sıralı tekrar tamamlandı.
- Studio (TypeScript dahil) ve web üretim derlemeleri geçti.

Bu düzeltmede görseller veya kayıtlı görünmezlik değerleri değiştirilmedi. Mevcut diğer yerel değişiklikler korundu. Commit, push ve canlı yayın yapılmadı.
