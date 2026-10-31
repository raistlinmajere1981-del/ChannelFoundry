"use strict";

const http = require("node:http");

const STUDIO_DEV_PORT = 5194;
const STUDIO_DEV_URL = `http://127.0.0.1:${STUDIO_DEV_PORT}`;
const STUDIO_IDENTITY_PATH = "/__channel-foundry-studio-identity__";
const STUDIO_IDENTITY = "channel-foundry-studio-dev-v1";

// Electron asla sadece portun açık olmasına güvenerek başka bir uygulamanın
// Vite arayüzünü yüklememeli. Yalnız kendi localhost sunucusu kabul edilir.
function validateDevServerUrl(value) {
  let target;
  try { target = new URL(String(value ?? "")); }
  catch { throw new Error("ChannelFoundry geliştirme adresi geçersiz."); }
  if (target.origin !== STUDIO_DEV_URL || target.pathname !== "/" ||
      target.search || target.hash || target.username || target.password) {
    throw new Error(`ChannelFoundry geliştirme sunucusu yalnız ${STUDIO_DEV_URL} olabilir.`);
  }
  return target.origin;
}

function verifyStudioDevServer(value, timeoutMs = 3500) {
  const origin = validateDevServerUrl(value);
  return new Promise((resolve, reject) => {
    const req = http.get(`${origin}${STUDIO_IDENTITY_PATH}`, {
      timeout: timeoutMs,
      headers: { Accept: "application/json" },
    }, (response) => {
      let payload = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        payload += chunk;
        if (payload.length > 2048) req.destroy(new Error("Geçersiz sunucu kimlik yanıtı."));
      });
      response.on("end", () => {
        try {
          const parsed = JSON.parse(payload);
          if (response.statusCode !== 200 ||
              parsed?.app !== STUDIO_IDENTITY ||
              response.headers["x-channel-foundry-studio"] !== STUDIO_IDENTITY) {
            throw new Error("Bu portta ChannelFoundry yerine başka bir uygulama çalışıyor.");
          }
          resolve(origin);
        } catch (error) {
          reject(error instanceof SyntaxError
            ? new Error("Bu port ChannelFoundry Studio sunucusu değil.")
            : error);
        }
      });
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("ChannelFoundry geliştirme sunucusu zaman aşımı.")));
    req.on("error", reject);
  });
}

module.exports = {
  STUDIO_DEV_PORT, STUDIO_DEV_URL, STUDIO_IDENTITY_PATH, STUDIO_IDENTITY,
  validateDevServerUrl, verifyStudioDevServer,
};
