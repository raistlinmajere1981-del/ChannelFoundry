"use strict";

/** Provider-advertised reasoning choices only; never synthesize max/ultra/high. */
const TOKEN = /^[a-z][a-z0-9_-]{0,31}$/;
const MODES = new Set(["effort", "variant", "thinkingLevel"]);
function cleanToken(value) {
  const name = String(value ?? "").trim().toLowerCase();
  return TOKEN.test(name) ? name : "";
}
function normalizeOptions(input, mode = "effort") {
  if (!MODES.has(mode)) return [];
  const seen = new Set(), result = [];
  for (const item of Array.isArray(input) ? input : []) {
    const name = cleanToken(typeof item === "string" ? item
      : item?.reasoningEffort ?? item?.reasoning_effort ?? item?.thinkingLevel
        ?? item?.name ?? item?.id ?? item?.value);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push({
      reasoningEffort: name, mode,
      description: String(typeof item === "object" && item ? item.description ?? item.label ?? "" : "").slice(0, 160),
    });
  }
  return result;
}
function fromModelMetadata(entry, provider) {
  if (!entry || typeof entry !== "object") return { supportedReasoningEfforts: [], defaultReasoningEffort: "" };
  const effort = entry.supportedReasoningEfforts ?? entry.supported_reasoning_efforts
    ?? entry.reasoning?.supportedEfforts ?? entry.reasoning?.supported_efforts;
  const thinking = entry.supportedThinkingLevels ?? entry.supported_thinking_levels
    ?? entry.thinking?.levels;
  // OpenCode v2 currently returns variants as [{id, settings}], whereas
  // earlier versions expose a dictionary keyed by variant name.
  const variant = provider === "opencode-cli" && Array.isArray(entry.variants)
    ? entry.variants
      .filter((value) => value && typeof value === "object" && !Array.isArray(value))
      .map((value) => ({name: value.id, description: value.description ?? value.label ?? ""}))
    : provider === "opencode-cli" && entry.variants && typeof entry.variants === "object"
      ? Object.entries(entry.variants)
        .filter(([,value]) => value && typeof value === "object")
        .map(([name,value]) => ({name, description: value.description ?? ""}))
      : [];
  const choices = Array.isArray(effort) ? normalizeOptions(effort,"effort")
    : Array.isArray(thinking) ? normalizeOptions(thinking,"thinkingLevel")
    : normalizeOptions(variant,"variant");
  const defaultValue = cleanToken(entry.defaultReasoningEffort ?? entry.default_reasoning_effort
    ?? entry.defaultThinkingLevel ?? entry.default_thinking_level ?? entry.defaultVariant);
  return {
    supportedReasoningEfforts: choices,
    defaultReasoningEffort: choices.some(item=>item.reasoningEffort===defaultValue) ? defaultValue : "",
  };
}
function validatedMode(value) {
  const mode = String(value || "");
  if (!mode) return "";
  if (!MODES.has(mode)) throw new Error("Sağlayıcı reasoning biçimi geçersiz.");
  return mode;
}
module.exports = { cleanToken, normalizeOptions, fromModelMetadata, validatedMode };
