"use strict";
// ChatGPT terminal bridge: no model/API invocation or automatic editorial approval.
const crypto = require("node:crypto");
const analysisService = require("./ai-analysis.cjs");
const publicationLanguages = require("./publication-languages.cjs");
const { ANALYSIS_OUTPUT_SCHEMA } = require("./ai-output-schemas.cjs");

const BRIDGE_VERSION = "nexa-analysis-v1";
const MODEL = "ChatGPT GPT-6 / Nexa (terminal)";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const sourceHash = source => publicationLanguages.hash({
  videoId: source.videoId, language: source.language, transcript: source.transcript,
});

function selectedVideo(db, videoId) {
  return db.prepare([
    "SELECT v.video_id AS videoId, v.title, v.published_at AS publishedAt,",
    "v.duration_seconds AS durationSeconds, v.canonical_url AS url,",
    "st.language, st.text AS transcript,",
    "a.external_id AS analyzedId, a.source_hash AS previousHash,",
    "COALESCE(j.state, '') AS jobState",
    "FROM youtube_videos v",
    "JOIN youtube_channels c ON c.id=v.channel_id AND c.is_active=1",
    "JOIN source_transcripts st ON st.provider='youtube' AND st.external_id=v.video_id",
    "LEFT JOIN source_ai_analyses a ON a.provider='youtube' AND a.external_id=v.video_id",
    "LEFT JOIN ai_analysis_jobs j ON j.provider='youtube' AND j.external_id=v.video_id",
    "WHERE v.video_id=? AND length(trim(st.text))>0"
  ].join(" ")).get(videoId);
}

function candidate(row) {
  const hash = sourceHash(row);
  const hasAnalysis = Boolean(row.analyzedId);
  const stale = hasAnalysis && Boolean(row.previousHash) && row.previousHash !== hash;
  if (hasAnalysis && !stale) return null;
  if (["waiting", "running"].includes(row.jobState)) return null;
  return {
    videoId: row.videoId, title: row.title, publishedAt: row.publishedAt,
    durationSeconds: row.durationSeconds, url: row.url,
    language: row.language, sourceHash: hash,
    transcriptLength: row.transcript.length, reason: stale ? "source-changed" : "unprocessed",
  };
}

function next(db, count = 3) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
    throw new Error("Video adedi 1-20 arasında tam sayı olmalı.");
  }
  const rows = db.prepare([
    "SELECT v.video_id AS videoId, v.title, v.published_at AS publishedAt,",
    "v.duration_seconds AS durationSeconds, v.canonical_url AS url,",
    "st.language, st.text AS transcript,",
    "a.external_id AS analyzedId, a.source_hash AS previousHash,",
    "COALESCE(j.state, '') AS jobState",
    "FROM youtube_videos v",
    "JOIN youtube_channels c ON c.id=v.channel_id AND c.is_active=1",
    "JOIN source_transcripts st ON st.provider='youtube' AND st.external_id=v.video_id",
    "LEFT JOIN source_ai_analyses a ON a.provider='youtube' AND a.external_id=v.video_id",
    "LEFT JOIN ai_analysis_jobs j ON j.provider='youtube' AND j.external_id=v.video_id",
    "WHERE length(trim(st.text))>0",
    "ORDER BY CASE WHEN trim(v.published_at)='' THEN 1 ELSE 0 END,",
    "v.published_at ASC, v.video_id ASC",
  ].join(" "));
  const output = [];
  for (const row of rows.iterate()) {
    const item = candidate(row);
    if (item) output.push(item);
    if (output.length === count) break;
  }
  return output;
}

function requestFor(db, videoId) {
  if (!VIDEO_ID.test(videoId)) throw new Error("Geçersiz video kimliği.");
  const row = selectedVideo(db, videoId);
  if (!row) throw new Error("Aktif kanalda altyazısı bulunan video bulunamadı.");
  const item = candidate(row);
  if (!item) throw new Error("Video zaten çözümlenmiş veya başka bir çözümleme kuyruğunda.");
  return {
    request: { schemaVersion: 1, bridgeVersion: BRIDGE_VERSION,
      source: item,
      rules: ["Söylenmeyeni ekleme; anlatıcıya ait iddiaları olgu gibi yazma.",
        "Özel adları ve Arapça ifadeleri koru; belirsiz bilgileri uydurma.",
        "Kanıt alıntıları transkriptte birebir geçmeli; bilinmeyen zamanları 0 kullan.",
        "Destekçiler ve katkıda bulunanlar anlatı muhatapları değildir."],
    },
    transcript: row.transcript,
  };
}

function assertSchema(value, schema, at = "analysis") {
  if (schema.type === "object") {
    if (!isObject(value)) throw new Error(at + " nesne olmalı.");
    for (const key of schema.required ?? []) {
      if (!(key in value)) throw new Error(at + "." + key + " eksik.");
    }
    for (const [key, field] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties ?? {}, key)) throw new Error(at + "." + key + " bilinmeyen alan.");
      assertSchema(field, schema.properties[key], at + "." + key);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw new Error(at + " dizi olmalı.");
    for (const [index, child] of value.entries()) assertSchema(child, schema.items, at + "[" + index + "]");
  } else if (schema.type === "string") {
    if (typeof value !== "string") throw new Error(at + " metin olmalı.");
  } else if (schema.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(at + " sayı olmalı.");
  } else {
    throw new Error(at + " için desteklenmeyen şema.");
  }
}

function validateResult(result, transcript) {
  if (!isObject(result) || result.schemaVersion !== 1 || !VIDEO_ID.test(result.videoId ?? "")
    || !/^[0-9a-f]{64}$/.test(result.sourceHash ?? "")) {
    throw new Error("Sonuç kimliği, sürümü veya kaynak özeti geçersiz.");
  }
  assertSchema(result.analysis, ANALYSIS_OUTPUT_SCHEMA);
  const a = result.analysis;
  if (!a.title.trim() || a.title.length > 300) throw new Error("Çözümleme başlığı gerekli (en fazla 300 karakter).");
  if (!a.summary.trim() || a.summary.length > 12000) throw new Error("Kaynak özeti gerekli (en fazla 12000 karakter).");
  const limits = {
    concepts: [50, 500], subtopics: [50, 500], narrativeStructure: [50, 1000],
    topics: [8, 140], storyBeats: [20, 900], storyHints: [10, 180],
    sponsors: [5000, 260], contributors: [5000, 260],
  };
  for (const [key, [count, max]] of Object.entries(limits)) {
    if (a[key].length > count || a[key].some(value => value.length > max)) {
      throw new Error(key + " alanı boyut sınırını aşıyor.");
    }
  }
  for (const [key, limit] of Object.entries({ characters: 16, locations: 20, objects: 20, scenes: 8 })) {
    if (a[key].length > limit) throw new Error(key + " fazla kayıt içeriyor.");
  }
  if (a.evidence.length > 400) throw new Error("Kanıt referansları çok fazla.");
  for (const [i, entry] of a.evidence.entries()) {
    if (!entry.excerpt.trim() || !transcript.includes(entry.excerpt)) {
      throw new Error("Kanıt " + (i + 1) + " altyazıda birebir bulunamadı.");
    }
    if (entry.startSeconds < 0 || entry.endSeconds < entry.startSeconds) {
      throw new Error("Kanıt " + (i + 1) + " zaman aralığı geçersiz.");
    }
  }
  for (const key of ["characters", "locations", "objects"]) {
    const seen = new Set();
    for (const entry of a[key]) {
      const name = entry.name.trim().toLocaleLowerCase("tr-TR");
      if (!name || entry.name.length > 180 || seen.has(name)) throw new Error(key + " kimliklerinde eksik veya tekrar var.");
      seen.add(name);
    }
  }
  return a;
}

function importResult(db, result, { replace = false } = {}) {
  if (!isObject(result) || !VIDEO_ID.test(result.videoId ?? "")) throw new Error("Geçersiz sonuç dosyası.");
  const row = selectedVideo(db, result.videoId);
  if (!row) throw new Error("Aktif kanalın altyazılı videosu bulunamadı.");
  const currentHash = sourceHash(row);
  if (result.sourceHash !== currentHash) {
    throw new Error("Altyazı değişmiş. Eski çözümleme kaydedilmedi; yeni kaynak dışa aktarılmalı.");
  }
  if (["waiting", "running"].includes(row.jobState)) {
    throw new Error("Video başka bir çözümleme sırasında; mevcut iş korunuyor.");
  }
  if (row.analyzedId && !replace) {
    throw new Error("Mevcut çözümleme korunuyor. Yeniden yazmak için --replace açıkça kullanılmalı.");
  }
  const payload = validateResult(result, row.transcript);
  // 'error' is used as a non-claimable staging state: Studio's AI queue only claims 'waiting'.
  db.prepare([
    "INSERT INTO ai_analysis_jobs",
    "(provider,external_id,state,error,attempts,queued_at,started_at,finished_at)",
    "VALUES ('youtube',?,'error','Nexa içe aktarımı başladı',0,CURRENT_TIMESTAMP,NULL,NULL)",
    "ON CONFLICT(provider,external_id) DO UPDATE SET",
    "state='error',error='Nexa içe aktarımı başladı',updated_at=CURRENT_TIMESTAMP"
  ].join(" ")).run(result.videoId);
  let saved;
  try {
    saved = analysisService.complete(db, result.videoId, MODEL, {
      ...payload,
      config: { provider: "chatgpt-terminal", model: MODEL },
    });
  } catch (error) {
    db.prepare("UPDATE ai_analysis_jobs SET state='error',error=?,updated_at=CURRENT_TIMESTAMP WHERE provider='youtube' AND external_id=?")
      .run(String(error.message ?? error).slice(0, 2000), result.videoId);
    throw error;
  }
  // The analysis has committed. Follow-up metadata/translation sync problems must
  // never turn a successful analysis into a claimable AI job or falsely mark it failed.
  const warnings = [];
  try {
    const coreRow = db.prepare("SELECT core_json FROM source_ai_analyses WHERE provider='youtube' AND external_id=?")
      .get(result.videoId);
    const core = JSON.parse(coreRow.core_json);
    core.promptVersion = BRIDGE_VERSION;
    db.prepare("UPDATE source_ai_analyses SET core_json=? WHERE provider='youtube' AND external_id=?")
      .run(JSON.stringify(core), result.videoId);
  } catch (error) { warnings.push("provenance: " + String(error?.message ?? error).slice(0, 300)); }
  // Only sync source language data; no call to the configured model/translator.
  try {
    const video = publicationLanguages.videoSources(db).find(v => v.videoId === result.videoId);
    if (video) publicationLanguages.sync(db, { youtubeAnalysis: { videos: [video] } });
  } catch (error) { warnings.push("language: " + String(error?.message ?? error).slice(0, 300)); }
  return { videoId: result.videoId, title: saved.title, sourceHash: currentHash,
    editorialState: "pending", model: MODEL, translation: "not-generated",
    ...(warnings.length ? { warnings } : {}) };
}

function blankResponse(request) {
  const visual = () => ({ description: "", attributes: [], atmosphere: "", prompt: "", negativePrompt: "" });
  return {
    schemaVersion: 1, videoId: request.source.videoId, sourceHash: request.source.sourceHash,
    analysis: {
      concepts: [], subtopics: [], narrativeStructure: [], evidence: [],
      title: request.source.title, summary: "", topics: [], storyBeats: [], storyHints: [],
      coverVisual: visual(), characters: [], locations: [], objects: [], scenes: [],
      sponsors: [], contributors: [],
    },
  };
}

module.exports = {
  BRIDGE_VERSION, MODEL, sourceHash, next, requestFor, validateResult, importResult, blankResponse,
};
