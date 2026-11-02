# Yayın Atölyesi brand assets

## Source

`source/logo1-source.png` is the supplied 1254x1254 RGBA source containing the
stacked full logo and the standalone emblem. It must stay in the repository so
the derivatives can be regenerated without redrawing the brand.

## Derivatives

- `yayin-atolyesi-logo.png` — full stacked logo (emblem, wordmark and STÜDYO),
  772x686, cropped to content plus 16px transparent breathing room.
- `yayin-atolyesi-mark.png` — standalone emblem only, 419x400, cropped to
  content plus the same transparent breathing room.

Both PNGs use real alpha. The source already carries a transparent matte; only
near-invisible alpha noise (alpha <= 8) was removed before cropping. No colors,
proportions or shapes were redrawn.

The running sidebar uses `yayin-atolyesi-mark.png` with the `Yayın Atölyesi`
name and `STÜDYO` subtitle rendered as CSS text, so the wordmark follows the
active light, dark or soft-dark theme without a second baked asset.
