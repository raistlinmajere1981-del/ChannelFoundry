"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const config = require("./ai-config.cjs");
const registry = require("./ai-provider-registry.cjs");
const openCode = require("./ai-opencode.cjs");
const aiClient = require("./ai-client.cjs");

(async () => {
  assert.ok(registry.list("text").some((item) => item.id === "opencode-cli"));
  assert.ok(!registry.list("image").some((item) => item.id === "opencode-cli"));
  assert.ok(registry.list("image").some((item) => item.id === "codex-cli"));
  const settingsUi = fs.readFileSync(path.join(__dirname, "src/AiProviderSettings.tsx"), "utf8");
  assert.match(settingsUi, /bridge\.aiProviders\(\)/, "Provider options must come from the backend");
  assert.match(settingsUi, /Modelleri getir/, "Model discovery must be explicit");
  assert.match(settingsUi, /Bağlantıyı dene/, "Connection check must be separate");
  assert.match(settingsUi, /Modeli dene/, "Selected model test must be separate");
  assert.doesNotMatch(settingsUi, /Model kimliğini elle gir|function ModelPicker/, "Manual model IDs removed");
  assert.match(openCode.SAFE_CONFIG, /"effect":"deny"/);
  assert.equal(openCode.modelId("opencode/deepseek-v4.1-flash-free"), "opencode/deepseek-v4.1-flash-free");
  assert.throws(() => openCode.modelId("bad; rm -rf /"), /modeli katalogdan/);
  assert.deepEqual(openCode.parseModels("opencode/model-a\nopencode/model-a\nollama/qwen2.5:7b\n"), [
    { id: "opencode/model-a", label: "opencode/model-a", text: true, image: false },
    { id: "ollama/qwen2.5:7b", label: "ollama/qwen2.5:7b", text: true, image: false },
  ]);
  assert.equal(openCode.extractText('{"type":"text","part":{"text":"OK"}}\n'), "OK");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cf-open-code-contract-"));
  try {
    const saved = config.saveConfig(root, {
      provider: "opencode-cli", model: "opencode/deepseek-v4.1-flash-free",
      imageProvider: "codex-cli", imageMode: "enabled", imageModel: "gpt-controller",
    });
    assert.equal(saved.configured, true);
    assert.equal(saved.endpoint, "");
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
  console.log("OpenCode text-only catalog, isolated model test, config and injection guards PASS");
})().catch((error) => { console.error(error); process.exitCode = 1; });
