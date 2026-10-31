"use strict";
const entries = [
  { id: "opencode-cli", label: "OpenCode · mevcut sunucu", role: "text", transport: "api", endpoint: "", secret: true },
  { id: "codex-cli", label: "Codex CLI", role: "both", transport: "cli", endpoint: "", secret: false },
  { id: "google-ai-studio", label: "Google AI Studio", role: "text", transport: "api", endpoint: "https://generativelanguage.googleapis.com/v1beta", secret: true },
  { id: "ollama", label: "Ollama", role: "text", transport: "local", endpoint: "http://127.0.0.1:11434/v1", secret: false },
  { id: "openai-compatible", label: "OpenAI uyumlu", role: "both", transport: "api", endpoint: "", secret: true },
  { id: "cloudflare-workers-ai", label: "Cloudflare Workers AI", role: "image", transport: "api", endpoint: "", secret: true },
  { id: "disabled", label: "Kapalı", role: "image", transport: "none", endpoint: "", secret: false },
];
function list(role) { return entries.filter((entry) => entry.role === role || entry.role === "both"); }
module.exports = { list, entries };
