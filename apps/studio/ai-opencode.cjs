"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MAX_OUTPUT = 1024 * 1024 * 3;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:@+/-]*$/;
// Denies access to filesystem, shells, network tools and agent delegation.
// Only text responses are allowed from a fresh, private OpenCode session.
const SAFE_CONFIG = JSON.stringify({
  $schema: "https://opencode.ai/config.json",
  snapshot: false,
  permissions: [{ action: "*", resource: "*", effect: "deny" }],
  plugin: [],
  plugins: [],
});

function cliBinary() {
  return String(process.env.CHANNEL_FOUNDRY_OPENCODE_BIN || "opencode").trim();
}
function modelId(value) {
  const id = String(value || "").trim();
  if (!MODEL_PATTERN.test(id) || id.length > 200 || id.includes("..")) {
    throw new Error("OpenCode modeli katalogdan seçilmeli.");
  }
  return id;
}
function run(args, options = {}) {
  const timeoutMs = Math.max(3000, Math.min(1800000, Number(options.timeoutMs || 60000)));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "channel-foundry-opencode-"));
  const env = { ...process.env, OPENCODE_CONFIG_CONTENT: SAFE_CONFIG };
  // Never attach to an existing user session or to the shared service.
  delete env.OPENCODE_SERVER_PASSWORD;
  delete env.OPENCODE_SERVER_USERNAME;
  const command = cliBinary();
  return new Promise((resolve, reject) => {
    let child;
    let stdout = "";
    let stderr = "";
    let completed = false;
    const finish = (error) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      fs.rmSync(dir, { recursive: true, force: true });
      if (error) reject(error);
      else resolve({ stdout, stderr });
    };
    const terminate = () => { try { child?.kill("SIGTERM"); } catch {} };
    const cancel = () => { terminate(); finish(new Error("OpenCode isteği durduruldu.")); };
    const timer = setTimeout(() => { terminate(); finish(new Error("OpenCode isteği zaman aşımına uğradı.")); }, timeoutMs);
    try {
      child = spawn(command, ["--standalone", ...args], {
        cwd: dir, env, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) { finish(error); return; }
    const append = (current, value) => {
      const next = current + String(value);
      if (Buffer.byteLength(next) > MAX_OUTPUT) {
        terminate(); finish(new Error("OpenCode yanıtı boyut sınırını aştı."));
        return current;
      }
      return next;
    };
    child.stdout.on("data", (data) => { stdout = append(stdout, data); });
    child.stderr.on("data", (data) => { stderr = append(stderr, data); });
    child.on("error", (error) => finish(new Error("OpenCode çalıştırılamadı: " + error.message)));
    child.on("close", (code) => {
      if (code !== 0) {
        let detail = "";
        for (const line of stdout.split(/\r?\n/)) {
          try {
            const event = JSON.parse(line);
            if (event.type === "error") detail = String(event.error?.message || event.error?.data?.message || "");
          } catch {}
        }
        return finish(new Error("OpenCode: " + (detail || stderr || "Kod " + code).slice(0, 500)));
      }
      finish(null);
    });
    if (options.signal?.aborted) cancel();
    else options.signal?.addEventListener("abort", cancel, { once: true });
  });
}
function parseModels(output) {
  const seen = new Set();
  return String(output).split(/\r?\n/).map((line) => line.trim())
    .filter((line) => MODEL_PATTERN.test(line) && !line.includes("..") && !seen.has(line) && seen.add(line))
    .map((id) => ({ id, label: id, text: true, image: false }));
}
async function listModels(options = {}) {
  const result = await run(["models"], { timeoutMs: options.timeoutMs || 30000 });
  const models = parseModels(result.stdout);
  if (!models.length) throw new Error("OpenCode erişilebilir model döndürmedi.");
  return { models, textModels: models.map((entry) => entry.id), imageModels: [] };
}
function extractText(output) {
  const items = [];
  for (const line of String(output).split(/\r?\n/)) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === "text" && typeof event.part?.text === "string") items.push(event.part.text);
    if (event.type === "error") throw new Error(String(event.error?.data?.message || event.error?.message || "OpenCode model hatası").slice(0, 400));
  }
  return items.join("\n").trim();
}
async function complete(config, messages, options = {}) {
  const id = modelId(config.model);
  const prompt = (Array.isArray(messages) ? messages : []).map((entry) => {
    const content = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content || "");
    return (entry.role === "system" ? "Sistem: " : entry.role === "assistant" ? "Asistan: " : "Kullanıcı: ") + content;
  }).join("\n\n");
  if (!prompt.trim()) throw new Error("OpenCode için mesaj gerekli.");
  const result = await run(["run", "--format", "json", "--model", id, prompt], {
    timeoutMs: options.timeoutMs || Math.max(60000, Number(config.timeoutSeconds || 420) * 1000),
    signal: options.signal,
  });
  const content = extractText(result.stdout);
  if (!content) throw new Error("OpenCode modeli metin yanıtı üretmedi.");
  return { content, model: id, finishReason: "stop" };
}
module.exports = { listModels, complete, modelId, parseModels, extractText, run, SAFE_CONFIG };
