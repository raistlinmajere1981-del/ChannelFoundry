"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const aiClient = require("./ai-client.cjs");
const { activeProject } = require("./channel-projects.cjs");

const limit = (value, n) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const safeId = value => String(value ?? "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120);
const supportedKinds = new Set(["section", "video", "vefk"]);
function storePath(userDataPath) {
  const project = safeId(activeProject()?.id || "default");
  return path.join(userDataPath, "seo-workspaces", project + ".json");
}
function load(userDataPath) {
  try {
    const value = JSON.parse(fs.readFileSync(storePath(userDataPath), "utf8"));
    return value && value.schemaVersion === 1 ? value : { schemaVersion: 1, site: {}, items: {} };
  } catch { return { schemaVersion: 1, site: {}, items: {} }; }
}
function write(userDataPath, config) {
  const file = storePath(userDataPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function plainBlock(block) {
  return limit([
    block.text,
    ...(block.spans ?? []).map(x => x.text ?? x.label ?? ""),
    ...(block.items ?? []).flatMap(x => (x.spans ?? []).map(y => y.text ?? y.label ?? ""))
  ].filter(Boolean).join(" "), 450);
}
function sourceText(section) {
  return limit((section.blocks ?? []).map(plainBlock).filter(Boolean).join(" "), 8000);
}
function defaults(snapshot) {
  const records = [];
  for (const section of snapshot.journal?.sections ?? []) {
    records.push({ kind: "section", id: safeId(section.sectionId), title: limit(section.title, 120),
      description: limit(sourceText(section), 180), source: sourceText(section),
      path: "/evren/bolum/" + encodeURIComponent(safeId(section.sectionId)) });
  }
  for (const video of snapshot.youtubeAnalysis?.videos ?? []) {
    if (video.membersOnly || video.publicationStatus !== "published" || video.analysisStatus !== "complete") continue;
    records.push({ kind: "video", id: safeId(video.videoId), title: limit(video.title, 120),
      description: limit(video.summary, 180), source: limit(video.summary, 5000),
      path: "/kamera/video/" + encodeURIComponent(video.videoId) });
  }
  for (const entry of snapshot.vefkCatalog?.entries ?? []) {
    const id = safeId(entry.id ?? entry.documentId);
    if (!id) continue;
    const name = limit(entry.title ?? entry.name ?? "Vefk", 120);
    records.push({ kind: "vefk", id, title: name,
      description: limit(entry.description ?? name, 180), source: limit(entry.description ?? name, 3000),
      path: "/vefk/" + encodeURIComponent(id) });
  }
  return records.filter(x => x.id);
}
function overview(userDataPath, snapshot) {
  const stored = load(userDataPath);
  const rows = defaults(snapshot).map(record => {
    const saved = stored.items[record.kind + ":" + record.id] ?? {};
    return {
      ...record, title: limit(saved.title || record.title, 120),
      description: limit(saved.description || record.description, 180),
      override: Boolean(saved.title || saved.description),
      needsReview: !saved.title || !saved.description || !record.description,
    };
  });
  return { site: { title: limit(stored.site.title || "BirDeSenGör", 120),
    description: limit(stored.site.description || "BirDeSenGör evreni, videolar, topluluk ve vefk arşivi.", 180),
    image: limit(stored.site.image, 250) }, rows, draftCount: rows.filter(row => row.needsReview).length };
}
function update(userDataPath, input, snapshot) {
  const stored = load(userDataPath);
  if (input?.kind === "site") {
    stored.site = { title: limit(input.title, 120), description: limit(input.description, 180),
      image: limit(input.image, 250) };
  } else {
    const kind = String(input?.kind ?? "");
    const id = safeId(input?.id);
    if (!supportedKinds.has(kind) || !id || !defaults(snapshot).some(row => row.kind === kind && row.id === id)) {
      throw new Error("SEO kaydı mevcut yayına ait değil.");
    }
    stored.items[kind + ":" + id] = { title: limit(input.title, 120), description: limit(input.description, 180) };
  }
  write(userDataPath, stored);
  return overview(userDataPath, snapshot);
}
async function suggest(userDataPath, input, snapshot) {
  const kind = String(input?.kind ?? "");
  const id = safeId(input?.id);
  const record = defaults(snapshot).find(row => row.kind === kind && row.id === id);
  if (!record) throw new Error("SEO önerisi yalnız onaylı içerik için üretilebilir.");
  const response = await aiClient.chat(userDataPath, [
    { role: "system", content: "Sen Türkçe SEO başlığı ve açıklaması öneren bir editörsün. YALNIZCA verilen onaylı metni kullan; dış bilgi, sansasyon, yanlış iddia, anahtar kelime doldurma ekleme. Tek JSON döndür: {\"title\":\"...\",\"description\":\"...\"}. Başlık en fazla 65, açıklama en fazla 160 karakter olsun. Yalnız öneri üret; yayın kararı insandadır." },
    { role: "user", content: JSON.stringify({ kind, title: record.title, source: record.source.slice(0, 6500) }) },
  ], { json: true, maxTokens: 350, temperature: 0.25 });
  const parsed = aiClient.parseAssistantJson(typeof response === "string" ? response : response.content);
  return { title: limit(parsed.title, 120), description: limit(parsed.description, 180) };
}
function manifest(userDataPath, snapshot, webUrl) {
  const data = overview(userDataPath, snapshot);
  let baseUrl = "";
  try { const url = new URL(webUrl); if (url.protocol === "https:") baseUrl = url.origin; } catch {}
  const pages = data.rows.map(({ kind, id, path: route, title, description, source }) => ({
    kind, id, path: route, title, description,
    body: limit(source, 10000), contentHash: crypto.createHash("sha256").update(title + "\n" + description + "\n" + source).digest("hex"),
  }));
  return { schemaVersion: 1, publicationId: snapshot.publication.id,
    contentFingerprint: snapshot.publication.contentFingerprint,
    generatedAt: snapshot.publication.generatedAt,
    baseUrl, site: data.site, pages };
}
module.exports = { overview, update, suggest, manifest, defaults, load };
