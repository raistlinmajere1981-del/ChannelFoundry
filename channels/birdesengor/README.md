# BirDeSenGör · ChannelFoundry kanal çalışma alanı

Kanalın AI, araştırma ve YouTube üretim motoru `ChannelFoundry` reposundadır. Site ise ayrı `birdesengor-web` GitHub reposudur.

- Kanal bağlantısı ve repo: `channel.json`
- Site kaynakları: `web/` (ayrı Git reposu; ana repo yalnızca submodule commit işaretçisini tutar)
- Studio'nun yerel verileri: `.local-data/` (Git dışında)
- Site durumu (2026-11-04): V2 önizlemesi Natro üzerinde canlı, geçici PHP şifre kapısı etkin; nihai sanat/gerçek cihaz kabulü devam ediyor.
- Site: `https://birdesengorgizlievren.com` (V1 Babylon kaynakları ve eski yayın test dosyaları sunucudan kaldırıldı).
- Yerel Natro dağıtım komutu: `birdesengor-natro deploy` (normal yayınları korur). Site detayları: `web/README.md`.

Ana dizinden komutlar:

```bash
npm run start:birdesengor
npm run dev:studio:birdesengor
npm run dev:birdesengor
npm run build:birdesengor
```

Site repo tek başına `npm ci && npm run dev` ile çalıştırılabilir.

Bu düzen Studio'nun ortak motorunu tüm kanallarla paylaşır; her sitenin kaynak kodu kendi deposundadır. Editoryal alanın YouTube kanal seçimiyle tümüyle yalıtılması ayrı geliştirme konusudur. Şimdilik bu kanalın Studio verileri proje klasörüne özgüdür.
