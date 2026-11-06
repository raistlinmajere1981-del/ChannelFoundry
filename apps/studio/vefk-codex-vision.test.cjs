"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const codex = require("./vefk-codex-vision.cjs");
const vision = require("./vefk-vision.cjs");
const sources = require("./vefk-sources.cjs");
const aiCli = require("./ai-cli.cjs");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=", "base64");
const DATA = "data:image/png;base64," + PNG.toString("base64");
const CONTENT = {
  schema: "vefk.source-analysis.v1", orientation: "unknown", note: "Test",
  regions: [{ kind: "symbol", box: [970, 60, 50, 80], label: "?", confidence: .5, needsReview: true }],
  grid: null,
};

test("Codex CLI image runner attaches a private source image, schema and collects final JSON only", async () => {
  let context;
  const output = await codex.requestVisionCompletion({
    provider: "codex-cli", model: "", timeoutSeconds: 30, reasoningEffort: "low",
  }, DATA, "Analyze the vefk geometry.", {
    command: "fake-codex",
    commandRunner: async (call) => {
      context = call;
      assert.equal(call.command, "fake-codex");
      assert.equal(call.args.at(-1), "-");
      assert.ok(call.args.includes("--ephemeral"));
      assert.ok(call.args.includes("--ignore-user-config"));
      assert.ok(call.args.includes("--ignore-rules"));
      assert.ok(call.args.includes("read-only"));
      assert.ok(call.args.includes("shell_tool"));
      assert.ok(call.args.includes("browser_use"));
      assert.equal(call.args.includes("--dangerously-bypass-approvals-and-sandbox"), false);
      assert.match(call.input, /Hiçbir araç, komut/);
      assert.match(call.input, /Analyze the vefk geometry/);
      assert.equal(call.input.includes("data:image/png"), false);
      const imagePath = call.args[call.args.indexOf("--image") + 1];
      const schemaPath = call.args[call.args.indexOf("--output-schema") + 1];
      const outputPath = call.args[call.args.indexOf("--output-last-message") + 1];
      assert.equal(path.dirname(imagePath), call.cwd);
      assert.equal(fs.statSync(imagePath).mode & 0o777, 0o600);
      assert.deepEqual(fs.readFileSync(imagePath), PNG);
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
      assert.deepEqual(schema.properties.schema.enum, [CONTENT.schema]);
      assert.ok(schema.properties.grid.anyOf.length > 0);
      fs.writeFileSync(outputPath, JSON.stringify(CONTENT));
      return { code: 0, stdout: "verbose conversation events must not contaminate JSON", stderr: "" };
    },
  });
  assert.equal(output.model, "Codex CLI · varsayılan");
  assert.equal(output.finishReason, "stop");
  assert.deepEqual(JSON.parse(output.content), CONTENT);
  assert.equal(fs.existsSync(context.cwd), false, "Temporary image and response must be removed.");
});

test("Codex image runner cleans temporary image when cancelled or errored", async () => {
  let temporary;
  await assert.rejects(codex.requestVisionCompletion({
    provider: "codex-cli", model: "", timeoutSeconds: 30,
  }, DATA, "Analyze.", {
    command: "fake-codex",
    commandRunner: async call => {
      temporary = call.cwd;
      throw new Error("Codex CLI was cancelled");
    },
  }), /cancelled/);
  assert.equal(fs.existsSync(temporary), false);
});

test("Codex image input rejects non-images, mismatched signatures and unbounded content", async () => {
  assert.throws(() => codex.decodeImageDataUrl("data:text/plain;base64,QQ=="), /PNG\/JPEG\/WebP/);
  assert.throws(() => codex.decodeImageDataUrl("data:image/jpeg;base64," + PNG.toString("base64")), /biçimi/);
  assert.throws(() => codex.decodeImageDataUrl("data:image/png;base64," + "A".repeat(18 * 1024 * 1024)), /12 MB/);
  await assert.rejects(() => codex.requestVisionCompletion({ provider: "ollama" }, DATA, ""), /Codex CLI/);
});

test("Vision service accepts codex-cli from existing Studio text settings and keeps S3.5 review rules", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vefk-codex-vision-"));
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  try {
    const sourceFile = path.join(root, "source.png");
    fs.writeFileSync(sourceFile, PNG);
    const saved = sources.importSource(db, root, sourceFile);
    fs.writeFileSync(path.join(root, "ai-config.json"), JSON.stringify({
      provider: "codex-cli", model: "", reasoningEffort: "low", timeoutSeconds: 420,
    }));
    const status = vision.support(root);
    assert.equal(status.provider, "codex-cli");
    assert.equal(status.supported, Boolean(aiCli.resolveCodexBinary()));
    if (!status.supported) return;
    const result = await vision.analyze(db, root, saved.id, {
      transport: async (config, imageDataUrl, prompt, options) => {
        assert.equal(config.provider, "codex-cli");
        assert.equal(imageDataUrl, DATA);
        assert.match(prompt, /vefk diagrams/);
        assert.equal(options.timeoutMs, 420000);
        return { content: JSON.stringify(CONTENT), model: "Codex CLI · varsayılan" };
      },
    });
    assert.equal(result.provider, "codex-cli");
    assert.equal(result.result.regions[0].needsReview, true);
    assert.deepEqual(result.result.regions[0].box, [970, 60, 30, 80]);
    assert.equal(result.result.coordinateWarnings.length, 1);
    assert.equal(sources.latestAnalysis(db, saved.id).id, result.id);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
