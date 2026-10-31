"use strict";

const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:@+/-]*$/;

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

async function serverRequest(pathname, options = {}, body) {
  const endpoint = serverEndpoint(options);
  const headers = serverHeaders(options);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, Math.min(120000, Number(options?.timeoutMs || 30000))));
  const abort = () => controller.abort();
  options?.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(endpoint + pathname, {
      method: body == null ? "GET" : "POST",
      headers, signal: controller.signal,
      ...(body == null ? {} : { body: JSON.stringify(body) }),
    });
    let result;
    try { result = await response.json(); } catch { throw new Error("OpenCode sunucusu JSON yanıtı vermedi."); }
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
async function complete(config, messages, options = {}) {
  const id = modelId(config.model);
  const prompt = (Array.isArray(messages) ? messages : []).map((entry) => {
    const content = typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content || "");
    return (entry.role === "system" ? "Sistem: " : entry.role === "assistant" ? "Asistan: " : "Kullanıcı: ") + content;
  }).join("\n\n");
  if (!prompt.trim()) throw new Error("OpenCode için mesaj gerekli.");
  const slash = id.indexOf("/");
  const response = await serverRequest("/api/experimental/generate/text", {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    timeoutMs: options.timeoutMs || Math.max(60000, Number(config.timeoutSeconds || 420) * 1000),
    signal: options.signal,
  }, { prompt, model: { providerID: id.slice(0, slash), modelID: id.slice(slash + 1) } });
  const content = String(response?.data?.text ?? response?.data?.content ?? response?.text ?? response?.content ?? "").trim();
  if (!content) throw new Error("OpenCode sunucusu metin üretmedi.");
  return { content, model: id, finishReason: "stop" };
}

module.exports = { listModels, complete, modelId, serverEndpoint, serverRequest, normalizeServerModels };
