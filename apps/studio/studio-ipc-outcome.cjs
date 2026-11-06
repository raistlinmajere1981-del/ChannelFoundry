"use strict";
const diagnostics = require("./studio-diagnostics.cjs");

function expectedError(channel, error) {
  const message = String(error?.message || error || "Islem tamamlanamadi.");
  if (channel === "studio:ai-opencode-service") return /OpenCode ortak servis/.test(message);
  if (channel === "studio:transcript-fetch-youtube")
    return /YouTube altyazısı alınamadı|Bu video için kanal tercihlerindeki dillerde|Altyazı arşivleme iptal edildi|eksik altyazı listesinde|Eksik altyazılar listesine eklendi|yt-dlp kurulu olmalı|Altyazı dosyası alındı ancak|Geçersiz arşiv işlem kimliği|Başka bir altyazı arşivleme|YouTube kaynağına bağlı değil|Video yerel YouTube kataloğunda bulunamadı/.test(message);
  return false;
}

async function returnOutcome(channel, promise) {
  try {
    return {status: "success", value: await promise};
  } catch (error) {
    const expected = expectedError(channel, error);
    diagnostics.record(expected ? "info" : "error", channel, error?.stack || error?.message || error);
    if (!expected) console.error("[ChannelFoundry] Beklenmeyen " + channel + " hatasi:", error);
    let message = String(error?.message || "Islem basarisiz.");
    if (channel === "studio:transcript-fetch-youtube" && message.startsWith("YouTube altyazısı alınamadı.")) {
      message = /429|Too Many Requests/i.test(message)
        ? "YouTube çok sayıda istek nedeniyle altyazı indirmeyi geçici olarak sınırladı (429)."
        : "Bu video için seçili dillerde manuel veya otomatik altyazı alınamadı.";
    }
    return {status: "failure", message, code: String(error?.code || "")};
  }
}
module.exports = {returnOutcome, expectedError};
