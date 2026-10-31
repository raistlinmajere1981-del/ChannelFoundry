"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  STUDIO_DEV_PORT,
  STUDIO_DEV_URL,
  STUDIO_IDENTITY_PATH,
  STUDIO_IDENTITY,
  validateDevServerUrl,
  verifyStudioDevServer,
} = require("./dev-server-identity.cjs");

async function run() {
  const packageFile = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
  const config = fs.readFileSync(path.join(__dirname, "vite.config.ts"), "utf8");
  const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  assert.equal(STUDIO_DEV_PORT, 5194);
  assert.equal(STUDIO_DEV_URL, "http://127.0.0.1:5194");
  assert.match(config, /strictPort:\s*true/);
  assert.match(config, /STUDIO_IDENTITY_PATH/);
  assert.match(config, /STUDIO_IDENTITY/);
  assert.match(packageFile.scripts.dev, /vite --strictPort/);
  assert.ok(packageFile.scripts.dev.includes(`wait-on ${STUDIO_DEV_URL}${STUDIO_IDENTITY_PATH}`));
  assert.ok(packageFile.scripts.dev.includes(`CHANNEL_FOUNDRY_DEV_SERVER_URL=${STUDIO_DEV_URL}`));
  assert.match(main, /await verifyStudioDevServer\(devServerUrl\)/);
  assert.match(main, /await window\.loadURL\(verifiedUrl\)/);
  assert.equal(validateDevServerUrl(STUDIO_DEV_URL), STUDIO_DEV_URL);
  assert.throws(() => validateDevServerUrl("http://127.0.0.1:5174"), /yalnız/);
  assert.throws(() => validateDevServerUrl("http://localhost:5194"), /yalnız/);
  assert.throws(() => validateDevServerUrl("https://example.com"), /yalnız/);
  assert.throws(() => validateDevServerUrl("http://127.0.0.1:5194/foreign"), /yalnız/);

  // Bağlantı testi yalnız ChannelFoundry için ayrılan portta yapılır.
  // Uygulama zaten açıksa gerçek kimliğini doğrular; kapalıysa
  // port üzerinde sahte sunucu yanıtına karşı güvenceyi sınar.
  const server = http.createServer((_request, response) => {
    response.setHeader("content-type", "text/html");
    response.end("<html>Başka uygulama</html>");
  });
  let started = false;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(STUDIO_DEV_PORT, "127.0.0.1", resolve);
    });
    started = true;
  } catch (error) {
    if (error?.code !== "EADDRINUSE") throw error;
  }
  if (started) {
    try {
      await assert.rejects(verifyStudioDevServer(STUDIO_DEV_URL), /port|sunucu|kimlik/i);
      server.removeAllListeners("request");
      server.on("request", (_request, response) => {
        response.setHeader("content-type", "application/json");
        response.setHeader("X-Channel-Foundry-Studio", STUDIO_IDENTITY);
        response.end(JSON.stringify({ app: STUDIO_IDENTITY }));
      });
      assert.equal(await verifyStudioDevServer(STUDIO_DEV_URL), STUDIO_DEV_URL);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } else {
    assert.equal(await verifyStudioDevServer(STUDIO_DEV_URL), STUDIO_DEV_URL);
  }
  console.log("Studio dev isolation PASS: port 5194, strictPort, identity guard, Electron URL verification.");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
