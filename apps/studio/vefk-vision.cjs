"use strict";

const configStore = require("./ai-config.cjs");
const client = require("./ai-client.cjs");
const sources = require("./vefk-sources.cjs");
const { sanitizeAiAnalysis } = require("./vefk-ai-region-sanitizer.cjs");
const codexVision = require("./vefk-codex-vision.cjs");
const aiCli = require("./ai-cli.cjs");

const SYSTEM_PROMPT = [
  "You analyze historical vefk diagrams, occult squares, calligraphy, lines, seals and symbols in a supplied image.",
  "Return a JSON object only; do not describe anything outside JSON. Never invent missing letters or numbers.",
  "Use schema 'vefk.source-analysis.v1' with 'orientation' (rtl/ltr/mixed/unknown), 'note' and 'regions'.",
  "Each region must have 'kind' (grid/number/text/symbol/line/seal/unknown),",
  "'box' [x,y,width,height] in normalized image coordinates 0..1000, 'label',",
  "'confidence' float 0..1, 'needsReview' boolean. Each nonempty box must lie entirely within 0..1000.",
  "box means LEFT, TOP, WIDTH, HEIGHT, not x1,y1,x2,y2 and not yMin,xMin,yMax,xMax.",
  "Strictly enforce x >= 0, y >= 0, width > 0, height > 0, x+width <= 1000, y+height <= 1000. Use numeric JSON values.",
  "Mark all unclear readings as needsReview=true and leave unreadable label blank.",
  "If there is a recognizable square grid, include 'grid': {rows,columns,cells: [{row,column,text,confidence,needsReview}]}",
  "with 0-based rows/columns. Include only actually detected readings. Unknown cells can be omitted.",
  "If no grid, use grid:null. Numeric values must be transcribed as seen, never mathematically corrected.",
  "Limit regions to the most meaningful 120 regions; no more than 81 grid cells.",
  "Do not output SVG, HTML or executable code. Source-image layout is only a tentative proposal.",
].join(" ");

function support(userDataPath) {
  const config = configStore.readConfig(userDataPath);
  if (!config.model && config.provider !== "codex-cli") return {
    supported: false, provider: config.provider, model: "", reason: "Önce Studio AI ayarlarında model seçilmeli.",
  };
  if (config.provider === "opencode-cli") return {
    supported: false, provider: config.provider, model: config.model,
    reason: "OpenCode Studio köprüsü şu anda yalnız metin gönderiyor; görsel giriş için çok modlu bağlantı gerekli.",
  };
  if (config.provider === "codex-cli") {
    const installed = Boolean(aiCli.resolveCodexBinary());
    return {
      supported: installed, provider: config.provider,
      model: config.model || "Codex CLI · varsayılan",
      reason: installed
        ? "Codex CLI görsel girişi etkin. Oturum ve modelin görsel yeteneği ilk istekte doğrulanır."
        : "Codex CLI bulunamadı. Kurulumdan sonra codex login ile giriş yap.",
    };
  }
  if (!["ollama", "openai-compatible"].includes(config.provider)) return {
    supported: false, provider: config.provider, model: config.model,
    reason: "AI bağlantısı görsel girdiyi taşıyamıyor.",
  };
  return {
    supported: true, provider: config.provider,
    model: config.model,
    reason: "Seçilen modelin görsel giriş desteği ilk çözümleme isteğinde doğrulanır; metin bağlantısı tek başına yeterli değildir.",
  };
}

function buildMessages(imageDataUrl) {
  if (typeof imageDataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,/.test(imageDataUrl)) {
    throw new TypeError("Geçerli bir kaynak görsel gerekli.");
  }
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: [
      { type: "text", text: "Analyze this source photograph or scan. Identify all vefk square cells and symbols. Return the specified JSON only. Mark uncertainty explicitly." },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ] },
  ];
}

async function analyze(db, userDataPath, sourceId, options = {}) {
  const status = support(userDataPath);
  if (!status.supported) throw new Error(status.reason);
  const source = sources.loadSource(db, userDataPath, sourceId);
  if (!source) throw new Error("Kaynak görsel bulunamadı.");
  const preparationRevision = source.preparation?.revision ?? 0;
  const config = configStore.readConfig(userDataPath);
  // Both transports use the same Studio provider settings and share the S1 review boundary.
  // Codex CLI receives a temporary image file (not a base64 string in a text prompt/log).
  const timeoutMs = Number(config.timeoutSeconds || 420) * 1000;
  const response = config.provider === "codex-cli"
    ? await (options.transport || codexVision.requestVisionCompletion)(
      config, source.imageDataUrl, SYSTEM_PROMPT, {
        timeoutMs, ...(options.signal ? { signal: options.signal } : {}),
      })
    : await (options.transport || client.requestModelCompletion)(
      config, buildMessages(source.imageDataUrl), {
        temperature: 0, maxTokens: 6500, timeoutMs,
        json: false, retryDelaysMs: [750, 2000],
        ...(options.signal ? { signal: options.signal } : {}),
      });
  if (/(?:length|max[_-]?tokens?)/i.test(String(response?.finishReason || ""))) {
    throw new Error("AI yanıtı token sınırında kesildi; eksik analiz kaydedilmedi.");
  }
  const proposal = client.parseAssistantJson(response?.content);
  // AI must never provide verified pen vectors; tracing always runs locally and awaits human approval.
  delete proposal.traces;
  // The model cannot give itself human-review status, even if it includes a reviewed field.
  if (Array.isArray(proposal.regions)) {
    proposal.regions = proposal.regions.map(region => ({ ...region, reviewed: false }));
  }
  if (Array.isArray(proposal.grid?.cells)) {
    proposal.grid.cells = proposal.grid.cells.map(cell => ({ ...cell, reviewed: false }));
  }
  // Only modest AI box overflow is clipped and always flagged for human review.
  // S1 geometry validation stays strict; grossly invalid/ambiguous boxes are recorded as warnings, not invented.
  const normalized = sources.normalizeAnalysis(sanitizeAiAnalysis(proposal));
  return sources.appendAnalysis(db, {
    sourceId, origin: "ai", provider: config.provider,
    model: String(response.model || config.model), result: normalized,
    expectedPreparationRevision: preparationRevision,
  });
}

module.exports = { support, buildMessages, analyze, SYSTEM_PROMPT };
