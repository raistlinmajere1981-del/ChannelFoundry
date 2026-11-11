# BirDeSenGör ilk 50 video — TR/EN yayın hazırlığı (2026-11-11)

Yerel çalışma. Canlı deploy, commit ve push yok. Ayrıntılı sözleşme:
`docs/BIRDESENGOR_BILINGUAL_PUBLICATION.md`.

## Kapsam

Onaylı Türkçe içeriği yeniden üretmeden iki dilli yayına hazırlamak:

- 40 günlük bölümü (`section`)
- 434 onaylı Evren kaydı (`entity`)
- 50 video başlığı/özeti/açıklaması (`video`)
- 4 bölüm + 1 dizi başlığı (`outline`)
- Ana vefk yayın metinleri (`vefk`)

23 taslak Evren kaydı ve 21 taslak ilişki kapsam dışıdır; kaynak geçmişi
silinmez, yalnız çeviri/yayın kapsamına alınmaz.

## Karar ve yaklaşım

1. **Kaynak:** Onaylı yayın paketi metin taşımadığı için (`apply()` yayın
   metinlerini söker, onaylı dili olmayan videoları düşürür) dili
   `publication_language_sources` tablosuna doğrudan Studio DB'sindeki son
   onaylı içerikten eşitliyoruz (`language.records(snapshot)`).
2. **Türkçe:** Mevcut metin `tr` varyantı olarak aynen kaydedilir ve
   `validateVariant` sonrası onaylanır. İçerik değiştirilmez.
3. **İngilizce:** Yalnız yayın metin alanları (`textKeys`) AI'ya gider; çeviri
   istemcisi Studio `ai-client.cjs` üzerinden DeepSeek'tir. Kaynak değişirse
   varyant `stale` olur ve yayından çıkar; manuel/onaylı metin ezilmez.
4. **Görünen ad:** `name` kanonik kimlik olarak sabit kalır. Nesne ve mekân
   kayıtları için isteğe bağlı `displayName` alanı eklendi (karakter, olay ve
   hikâye kayıtlarında reddedilir). Web arşiv listesi/detayı `displayName ||
   name` gösterir; arama, ilişki ve fingerprint değişmez.
5. **Inline referans:** `reference.entityId` değişmez; görünen `label` çevrilen
   metne uyar, çünkü label cümlenin kelimeleridir. Kanonik ad olan label'lar
   çeviride aynen korunur (istem + çalıştırıcı denetimi).

## Çalıştırma

- Türkçe partisi: `--phase tr`
- İngilizce partileri: `--phase en --kind section|video|entity|outline|vefk`
- Her kayıt kendi transaction'ında onaylanır; kesintide yalnız eksik kayıtlar
  yeniden üretilir (`resetInterrupted` yarım işleri hata olarak işaretler).
- Model: `tokenharbor/deepseek-v4.1-flash:free` (Studio `opencode-cli`
  sağlayıcısı, kalıcı `ai-config.json` değiştirilmeden geçici istemci).

## İlerleme

Bu dosya yalnız kalıcı kararları tutar; ölçüm ve parti sonuçları çalışma
raporunda bildirilir.

### Durum günlüğü

- 2026-11-11: Türkçe 530/530 kayıt onaylandı; 50/50 video İngilizcesi onaylandı.
- 2026-11-11: Eksik 9 günlük bölümü tek tek (eşzamanlılık 1) üretilip onaylandı;
  toplam 40/40. Korunması istenen 31 onaylı bölümün verisi sha256 düzeyinde
  değişmedi.
- Karar: Korumalı 31 bölümden 10'unda başlık, 21'inde cümle içi referans
  etiketi İngilizceye çevrilmemiş durumda. Talimat gereği bu kayıtlar
  değiştirilmedi; kalite raporunda ayrı liste olarak bildirilir.
- Karar: Özel ad koruması şema düzeyinde tutulur (`name` çevrilemez alan,
  referanslarda `entityId` sabit). Tanımlayıcı varlık başlıkları serbest metin
  olduğu için çevrilebilir; kaybolan özel adlar kalite raporunda listelenir.
