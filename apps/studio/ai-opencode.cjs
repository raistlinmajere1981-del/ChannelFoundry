"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:@+/-]*$/;

function sharedService() {
  return new Promise((resolve, reject) => {
    execFile("opencode", ["service", "status"], {
      shell: false, timeout: 5000, encoding: "utf8", maxBuffer: 4096,
    }, (error, stdout) => {
      if (error) return reject(new Error("OpenCode ortak servisi bulunamadı."));
      const match = String(stdout).match(/http[^\s]+/);
      if (!match) return reject(new Error("OpenCode ortak servis adresi bulunamadı."));
      try { resolve(serverEndpoint({ endpoint: match[0] })); }
      catch { reject(new Error("OpenCode ortak servis adresi geçersiz.")); }
    });
  });
}
function modelId(value) {
  const id = String(value || "").trim();
  if (!MODEL_PATTERN.test(id) || id.length > 200 || id.includes("..")) {
    throw new Error("OpenCode modeli katalogdan seçilmeli.");
  }
  return id;
}
function serverEndpoint(options) {
  const raw = String(options?.endpoint || "http://127.0.0.1:4096").trim();
  const url = new URL(raw);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("OpenCode sunucusu localhost HTTP adresi olmalı.");
  }
  return url.origin;
}

function serverHeaders(options) {
  const password = String(options?.apiKey || "").trim();
  if (!password) throw new Error("OpenCode sunucu parolası gerekli.");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: "Basic " + Buffer.from("opencode:" + password).toString("base64"),
  };
}

async function serverRequest(pathname, options = {}, body, method) {
  const endpoint = serverEndpoint(options);
  const headers = serverHeaders(options);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, Math.min(120000, Number(options?.timeoutMs || 30000))));
  const abort = () => controller.abort();
  options?.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(endpoint + pathname, {
      method: method || (body == null ? "GET" : "POST"),
      headers, signal: controller.signal,
      ...(body == null ? {} : { body: JSON.stringify(body) }),
    });
    const rawBody = await response.text();
    let result = {};
    if (rawBody) {
      try { result = JSON.parse(rawBody); }
      catch { throw new Error("OpenCode sunucusu JSON yanıtı vermedi."); }
    }
    if (!response.ok) {
      const raw = String(result?.message || result?.error?.message || result?.data?.message || "").trim();
      if (response.status === 401) throw new Error("OpenCode sunucu parolası hatalı veya bağlantı yetkisiz (401).");
      const reason = result?.reason === "rate_limit" ? "Model kotası" : "Sunucu";
      throw new Error("OpenCode " + reason + " (" + response.status + "): " + (raw || "İstek başarısız").slice(0, 450));
    }
    return result;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(options?.signal?.aborted ? "OpenCode isteği durduruldu." : "OpenCode sunucusu zaman aşımı.");
    throw error;
  } finally {
    clearTimeout(timeout);
    options?.signal?.removeEventListener("abort", abort);
  }
}
function normalizeServerModels(data) {
  if (!Array.isArray(data)) throw new Error("OpenCode model kataloğu geçersiz.");
  const seen = new Set();
  const models = [];
  for (const entry of data) {
    const rawId = String(entry?.id || entry?.modelID || "");
    const id = rawId.includes("/") ? rawId : String(entry?.providerID || entry?.provider?.id || "") + "/" + rawId;
    if (!MODEL_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    models.push({ id, label: String(entry?.name || entry?.label || id), text: true, image: false });
  }
  return models;
}
async function listModels(options = {}) {
  const response = await serverRequest("/api/model", options);
  const models = normalizeServerModels(response?.data);
  if (!models.length) throw new Error("OpenCode sunucusu erişilebilir metin modeli döndürmedi.");
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
function readSessionOutput(items) {
  if (!Array.isArray(items)) throw new Error("OpenCode oturum yanıtı geçersiz.");
  const assistants = items.filter((item) => item?.type === "assistant");
  const latest = assistants.at(-1);
  const texts = (latest?.content || []).filter((item) => item?.type === "text"
    && typeof item.text === "string").map((item) => item.text);
  const idle = items.filter((item) => item?.type === "idle").at(-1);
  const failure = idle?.outcome === "failed" ? idle.error
    : latest?.finish === "error" ? latest.error : null;
  if (failure) {
    const detail = typeof failure === "string" ? failure
      : String(failure?.message || failure?.data?.message || "Model yanıt üretemedi.");
    throw new Error("OpenCode model hatası: " + detail.slice(0, 500));
  }
  const finished = idle?.outcome === "succeeded" || Boolean(latest?.time?.completed)
    || Boolean(latest?.finish && latest.finish !== "unknown");
  return { done: finished, content: texts.join("\n").trim(), failed: idle?.outcome === "interrupted" };
}

async function complete(config, messages, options = {}) {
  const id = modelId(config.model);
  const prompt = (Array.isArray(messages) ? messages : []).map((entry) => {
    const content = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content || "");
    return (entry.role === "system" ? "Sistem: " : entry.role === "assistant" ? "Asistan: " : "Kullanıcı: ") + content;
  }).join("\n\n");
  if (!prompt.trim()) throw new Error("OpenCode için mesaj gerekli.");
  const slash = id.indexOf("/");
  const model = { providerID: id.slice(0, slash), id: id.slice(slash + 1) };
  const timeoutMs = Math.max(3000, Math.min(1800000, Number(options.timeoutMs
    || Number(config.timeoutSeconds || 420) * 1000)));
  const deadline = Date.now() + timeoutMs;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "channel-foundry-ai-"));
  const requestOptions = {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    signal: options.signal,
  };
  let sessionID = "";
  try {
    const created = await serverRequest("/api/session", {
      ...requestOptions, timeoutMs: Math.min(30000, deadline - Date.now()),
    }, {
      title: "ChannelFoundry Studio AI",
      model,
      agent: "build",
      location: { directory },
      permissions: [{ action: "*", resource: "*", effect: "deny" }],
    });
    sessionID = String(created?.data?.id || "");
    if (!/^ses_[A-Za-z0-9_-]+$/.test(sessionID)) throw new Error("OpenCode oturum kimliği geçersiz.");
    await serverRequest("/api/session/" + sessionID + "/prompt", {
      ...requestOptions, timeoutMs: Math.min(30000, deadline - Date.now()),
    }, { text: prompt });
    while (Date.now() < deadline) {
      if (options.signal?.aborted) throw new Error("OpenCode isteği durduruldu.");
      const response = await serverRequest("/api/session/" + sessionID + "/message?limit=50", {
        ...requestOptions, timeoutMs: Math.max(3000, Math.min(12000, deadline - Date.now())),
      });
      const state = readSessionOutput(response?.data);
      if (state.failed) throw new Error("OpenCode oturumu kesintiye uğradı.");
      if (state.done && state.content) return { content: state.content, model: id, finishReason: "stop" };
      if (state.done && !state.content) throw new Error("OpenCode modeli metin yanıtı üretmedi.");
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    throw new Error("OpenCode yanıt süresi doldu.");
  } finally {
    if (sessionID) {
      try {
        await serverRequest("/api/session/" + sessionID, {
          ...requestOptions, signal: undefined, timeoutMs: 6000,
        }, undefined, "DELETE");
      } catch (error) {
        console.warn("[ChannelFoundry] Geçici OpenCode oturumu temizlenemedi:", error?.message);
      }
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = { listModels, complete, modelId, serverEndpoint, serverRequest, normalizeServerModels, readSessionOutput, sharedService };
