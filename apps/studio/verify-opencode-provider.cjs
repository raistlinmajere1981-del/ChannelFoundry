"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const config = require("./ai-config.cjs");
const registry = require("./ai-provider-registry.cjs");
const openCode = require("./ai-opencode.cjs");
const aiClient = require("./ai-client.cjs");

(async () => {
  // Electron integration source syntax must be valid before release.
  for (const name of ["ai-opencode.cjs", "studio-ipc.cjs", "preload.cjs"]) {
    const check = spawnSync(process.execPath, ["--check", path.join(__dirname, name)], { encoding: "utf8" });
    assert.equal(check.status, 0, name + ": " + check.stderr);
  }
  assert.ok(registry.list("text").some((item) => item.id === "opencode-cli"));
  assert.ok(!registry.list("image").some((item) => item.id === "opencode-cli"));
  assert.ok(registry.list("image").some((item) => item.id === "codex-cli"));
  assert.equal((fs.readFileSync(path.join(__dirname, "ai-opencode.cjs"), "utf8").match(/function sharedService\(\)/g) || []).length, 1);
  const settingsUi = fs.readFileSync(path.join(__dirname, "src/AiProviderSettings.tsx"), "utf8");
  assert.match(settingsUi, /bridge\.aiProviders\(\)/, "Provider options must come from the backend");
  assert.match(settingsUi, /Modelleri getir/, "Model discovery must be explicit");
  assert.match(settingsUi, /Bağlantıyı dene/, "Connection check must be separate");
  assert.match(settingsUi, /Modeli dene/, "Selected model test must be separate");
  assert.doesNotMatch(settingsUi, /Model kimliğini elle gir|function ModelPicker/, "Manual model IDs removed");
  assert.equal(openCode.modelId("opencode/deepseek-v4.1-flash-free"), "opencode/deepseek-v4.1-flash-free");
  assert.equal(openCode.serverEndpoint({endpoint: "http://127.0.0.1:4096"}), "http://127.0.0.1:4096");
  assert.throws(() => openCode.serverEndpoint({endpoint: "http://example.com:4096"}), /localhost/);
  assert.throws(() => openCode.modelId("bad; rm -rf /"), /modeli katalogdan/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "ai-opencode.cjs"), "utf8"), /--standalone/, "Studio must never start isolated OpenCode sessions");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cf-open-code-contract-"));
  try {
    const saved = config.saveConfig(root, {
      provider: "opencode-cli", model: "opencode/deepseek-v4.1-flash-free",
      imageProvider: "codex-cli", imageMode: "enabled", imageModel: "gpt-controller",
    });
    assert.equal(saved.configured, true);
    assert.equal(saved.endpoint, "http://127.0.0.1:4096");
    assert.equal(saved.image.provider, "codex-cli");
    assert.equal(saved.image.model, "gpt-controller");
    assert.equal(config.readConfig(root).apiKey, "");
    const draft = { provider: "opencode-cli", endpoint: "", model: "opencode/deepseek-v4.1-flash-free" };
    // Candidate is transient: trying a nonexistent model must not mutate the saved configuration.
    await assert.rejects(aiClient.testConnection(root, { candidate: { ...draft, model: "not-a-model" } }), /modeli katalogdan/);
    assert.equal(config.readConfig(root).model, "opencode/deepseek-v4.1-flash-free");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  const seen = [];
  const sessionId = "ses_cf_testonly_1";
  let messagesRead = 0;
  const server = http.createServer((req, res) => {
    const expected = "Basic " + Buffer.from("opencode:test-local-secret").toString("base64");
    if (req.headers.authorization !== expected) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Authentication required" }));
      return;
    }
    let body = "";
    req.on("data", (data) => { body += data; });
    req.on("end", () => {
      seen.push({ url: req.url, method: req.method, body: body ? JSON.parse(body) : {} });
      res.writeHead(200, { "content-type": "application/json" });
      if (req.url === "/api/model") {
        res.end(JSON.stringify({ data: [{ providerID: "opencode", id: "deepseek-v4.1-flash-free", name: "DeepSeek V4.1 Flash" }] }));
      } else if (req.url === "/api/session" && req.method === "POST") {
        res.end(JSON.stringify({ data: { id: sessionId } }));
      } else if (req.url === "/api/session/" + sessionId + "/prompt") {
        res.end(JSON.stringify({ data: { type: "user" } }));
      } else if (req.url === "/api/session/" + sessionId + "/message?limit=50") {
        messagesRead++;
        res.end(JSON.stringify({ data: messagesRead === 1 ? [] : [
          { type: "user", id: "msg_u" },
          { type: "assistant", id: "msg_a", finish: "stop", time: { completed: 42 }, content: [{ type: "text", text: "OK" }] },
          { type: "idle", outcome: "succeeded" },
        ] }));
      } else if (req.url === "/api/session/" + sessionId && req.method === "DELETE") {
        res.statusCode = 204;
        res.end();
      } else {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Not found" }));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const endpoint = "http://127.0.0.1:" + server.address().port;
    await assert.rejects(openCode.listModels({ endpoint, apiKey: "wrong" }), /401/);
    const models = await openCode.listModels({ endpoint, apiKey: "test-local-secret" });
    assert.equal(models.models[0].id, "opencode/deepseek-v4.1-flash-free");
    const response = await openCode.complete({
      endpoint, apiKey: "test-local-secret", model: models.models[0].id,
    }, [{ role: "user", content: "Reply OK" }]);
    assert.equal(response.content, "OK");
    const created = seen.find((item) => item.url === "/api/session" && item.method === "POST");
    assert.equal(created.body.model.providerID, "opencode");
    assert.equal(created.body.model.id, "deepseek-v4.1-flash-free");
    assert.deepEqual(created.body.permissions, openCode.TEXT_ONLY_PERMISSIONS);
    assert.deepEqual(created.body.permissions.map(({ action, effect }) => [action, effect]), [
      ["*", "deny"], ["read", "allow"], ["external_directory", "deny"],
    ]);
    assert.match(created.body.location.directory, /channel-foundry-ai-/);
    const sent = seen.find((item) => item.url === "/api/session/" + sessionId + "/prompt");
    assert.match(sent.body.text, /Reply OK/);
    assert.ok(seen.some((item) => item.url === "/api/session/" + sessionId && item.method === "DELETE"));
    assert.ok(!seen.some((item) => item.url.includes("/api/experimental/generate")));
  } finally { await new Promise((resolve) => server.close(resolve)); }
  console.log("OpenCode authenticated server, model discovery, isolated session request, permissions and cleanup PASS");

})().catch((error) => { console.error(error); process.exitCode = 1; });
