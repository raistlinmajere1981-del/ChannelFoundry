/**
 * Standalone ESM adapter for the BirDeSenGör V2 site.
 * Studio remains the sole owner of validation, construction and timeline data.
 * This file can be copied/imported into the V2 build after the scene session
 * connects its permanent workshop. No network or DOM required.
 */
/** Workshop-local publication identity. These are NOT room objects/effect anchors.
 * Keep the published pen IDs stable: geometry/timing contain no scene positions.
 * VefkStand owns the one VefkQuill and projects frame.pen.position in its ink SVG.
 */
export const VEFK_WORKSHOP = Object.freeze({
  ownerId: "vefk-stand",
  pen: Object.freeze({ objectId: "quill", anchorId: "quill.tip" }),
});
export const VEFK_BINDING = Object.freeze({
  bindingVersion: 2,
  sceneId: "birdesengor-study-v2",
  surface: { objectId: VEFK_WORKSHOP.ownerId, anchorId: "vefk-stand.ink-plane" },
  pen: VEFK_WORKSHOP.pen,
  coordinateSpace: "svg-viewBox",
  fit: "contain",
});
export const VEFK_BINDING_V2 = Object.freeze({
  ...VEFK_BINDING,
  bindingVersion: 3,
  motion: Object.freeze({ strokeEasing: "v2" }),
});
const encoder = new TextEncoder();
const identifier = /^[a-zA-Z][A-Za-z0-9._-]{0,119}$/;
const strokeEasings = ["linear", "ease-in", "ease-out", "ease-in-out"];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}
function stableJson(value) { return JSON.stringify(canonical(value)); }
function canonicalDocumentText(document) { return JSON.stringify(canonical(document), null, 2) + "\n"; }
function sha(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Vefk SHA-256 doğrulaması için güvenli HTTPS bağlamı gerekli.");
  return subtle.digest("SHA-256", bytes).then(buffer =>
    [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, "0")).join(""));
}
function shaJson(value) { return sha(encoder.encode(stableJson(value))); }
function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label + " nesnesi gerekli.");
  return value;
}
function checkKeys(value, allowed, label) {
  requireObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(label + " tanımsız alan: " + key);
  }
}
function validId(value) {
  return typeof value === "string" && value.trim() === value && identifier.test(value);
}
function checkText(value, label, max, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    throw new Error(label + " metni geçersiz.");
  }
}
function requireHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error(label + " geçersiz.");
}
function parsePolyline(d, viewBox) {
  if (typeof d !== "string" || d.length < 4 || d.length > 8192 ||
      /[^MLZ0-9.+\-\s]/.test(d) || d !== d.trim().replace(/\s+/g, " ")) throw new Error("Vefk SVG çizgisi güvensiz.");
  const tokens = d.trim().match(/[MLZ]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g) ?? [];
  if (tokens.join("").replace(/\s/g, "") !== d.replace(/\s/g, "") || tokens.length > 4096) {
    throw new Error("Vefk SVG çizgisi okunamadı.");
  }
  const segments = [];
  let cursor = 0, position = null, start = null;
  for (; cursor < tokens.length;) {
    const op = tokens[cursor++];
    if (op === "Z") {
      if (!start || !position) throw new Error("Kapanan vefk yolu başlatılmamış.");
      const distance = Math.hypot(position.x - start.x, position.y - start.y);
      if (distance) segments.push({from:position,to:start,length:distance,ink:true});
      // Closing does not erase the last physical nib location. The next M is a lift.
      position = start;
      start = null;
      continue;
    }
    if (op !== "M" && op !== "L") throw new Error("Vefk çizim komutu desteklenmiyor.");
    if (cursor + 1 >= tokens.length) throw new Error("Vefk çizgi koordinatı eksik.");
    const x = Number(tokens[cursor++]), y = Number(tokens[cursor++]);
    if (![x, y].every(n => Number.isFinite(n) && Math.abs(n) <= 100000) || x < viewBox[0] - 0.0001 ||
        x > viewBox[0] + viewBox[2] + 0.0001 ||
        y < viewBox[1] - 0.0001 || y > viewBox[1] + viewBox[3] + 0.0001) {
      throw new Error("Vefk çizgisi görünüm alanı dışında.");
    }
    const next = {x,y};
    if (op === "M") {
      if (position) {
        const travel = Math.hypot(next.x - position.x, next.y - position.y);
        if (travel) segments.push({ from:position, to:next, length:travel, ink:false });
      }
      position = start = next;
      continue;
    }
    if (!position || !start) throw new Error("Vefk çizgisi M olmadan başlıyor.");
    const length = Math.hypot(next.x - position.x, next.y - position.y);
    if (length) segments.push({from:position,to:next,length,ink:true});
    position = next;
  }
  if (!segments.some(item=>item.ink)) throw new Error("Vefk çiziminde görünen mürekkep yolu yok.");
  return segments;
}
export function validateSceneBinding(binding, scene, catalogVersion = 1) {
  requireObject(binding,"Vefk sahne bağlantısı");
  if (![1, 2].includes(catalogVersion) ||
      stableJson(binding) !== stableJson(catalogVersion === 2 ? VEFK_BINDING_V2 : VEFK_BINDING)) {
    throw new Error("Vefk katalog sahne bağlantısı beklenen nesne/ankorlarla eşleşmedi.");
  }
  if (scene) {
    if (scene.sceneId !== binding.sceneId) throw new Error("Vefk sceneId etkin sahneye ait değil.");
    const objects = Array.isArray(scene.objects) ? scene.objects : [];
    // The strict binding comparison above validates the workshop-local pen.
    // Only the workshop surface belongs to the room's object/anchor registry.
    const surface = objects.find(item => item.id === binding.surface.objectId);
    if (!surface || !Array.isArray(surface.anchors) ||
        !surface.anchors.some(anchor => anchor.id === binding.surface.anchorId)) {
      throw new Error("Vefk sahnesinde gerekli fiziksel nesne/ankor bulunamadı: " + binding.surface.anchorId);
    }
  }
  return true;
}
function checkDocument(doc) {
  checkKeys(doc,["format","schemaVersion","id","revision","title","description","language",
    "provenance","construction","geometry","drawPlan","accessibility","contentHash","generatedAt"],"Vefk belgesi");
  if (doc.format !== "birdesengor.vefk" || ![1, 2].includes(doc.schemaVersion) ||
      !validId(doc.id) || !Number.isSafeInteger(doc.revision) || doc.revision < 1) {
    throw new Error("Bilinmeyen vefk belge biçimi veya kimliği.");
  }
  requireHash(doc.contentHash,"Vefk içerik hash'i");
  checkText(doc.title,"title",300,true);
  checkText(doc.description,"description",4000);
  checkText(doc.language,"language",20,true);
  if (doc.generatedAt !== undefined &&
      (typeof doc.generatedAt !== "string" || !Number.isFinite(Date.parse(doc.generatedAt)))) {
    throw new Error("Vefk generatedAt geçersiz.");
  }
  const geometry = requireObject(doc.geometry,"Vefk geometrisi");
  checkKeys(geometry,["coordinateSpace","viewBox","paths","inkStyles"],"Vefk geometrisi");
  const box = geometry.viewBox;
  if (geometry.coordinateSpace !== "svg-viewBox" ||
      !Array.isArray(box) || box.length !== 4 || !box.every(n => Number.isFinite(n) && Math.abs(n) <= 100000) ||
      box[2] <= 0 || box[3] <= 0 || !Array.isArray(geometry.paths) ||
      geometry.paths.length < 1 || geometry.paths.length > 1024) {
    throw new Error("Vefk görünüm veya yol yapısı geçersiz.");
  }
  const styles = requireObject(geometry.inkStyles,"Vefk mürekkep stilleri");
  if (Object.keys(styles).length > 32) throw new Error("Vefk mürekkep stili sınırı aşıldı.");
  for (const [id,style] of Object.entries(styles)) {
    checkKeys(style,["width","cap"],"Vefk mürekkep stili");
    if (!validId(id) || !Number.isFinite(style.width) || style.width < 0.01 || style.width > 100 ||
        !["round","square","butt"].includes(style.cap)) throw new Error("Vefk mürekkep stili geçersiz.");
  }
  const ids = new Set(), paths = new Map();
  for (const item of geometry.paths) {
    checkKeys(item,["id","d","ink","semanticValue"],"Vefk yolu");
    if (!validId(item.id) || ids.has(item.id) ||
        !validId(item.ink) || !Object.hasOwn(styles,item.ink)) {
      throw new Error("Vefk çizgi kimliği, katman veya mürekkep stili geçersiz.");
    }
    if (item.semanticValue !== undefined) checkText(item.semanticValue,"semanticValue",120);
    ids.add(item.id);
    paths.set(item.id, parsePolyline(item.d, box));
  }
  const plan = requireObject(doc.drawPlan,"Vefk çizim zamanlaması");
  checkKeys(plan,["timeUnit","durationMs","strokes","markers"],"Vefk çizim zamanlaması");
  if (plan.timeUnit !== "ms" || !Number.isSafeInteger(plan.durationMs) ||
      plan.durationMs < 1 || plan.durationMs > 3600000 ||
      !Array.isArray(plan.strokes) || plan.strokes.length !== paths.size ||
      !Array.isArray(plan.markers) || plan.markers.length > 64) throw new Error("Vefk zamanlama verisi eksik.");
  const used = new Set(), strokeIds = new Set(); let end = 0;
  for (const stroke of plan.strokes) {
    checkKeys(stroke,["id","pathId","startMs","durationMs","ink","pen",
      ...(doc.schemaVersion === 2 ? ["easing"] : [])],"Vefk stroke");
    if (Object.hasOwn(stroke, "easing") && !strokeEasings.includes(stroke.easing)) {
      throw new Error("Vefk stroke easing geçersiz.");
    }
    const ink = geometry.paths.find(path => path.id === stroke?.pathId)?.ink;
    if (!validId(stroke.id) || strokeIds.has(stroke.id) || !validId(stroke.pathId) || used.has(stroke.pathId) ||
        !paths.has(stroke.pathId) || stroke.pen !== "down" || stroke.ink !== ink ||
        !Number.isSafeInteger(stroke.startMs) || !Number.isSafeInteger(stroke.durationMs) ||
        stroke.startMs < end || stroke.durationMs <= 0 ||
        stroke.startMs + stroke.durationMs > plan.durationMs) {
      throw new Error("Vefk çizim sırası veya kalem hareketi geçersiz.");
    }
    used.add(stroke.pathId);
    strokeIds.add(stroke.id);
    end = stroke.startMs + stroke.durationMs;
  }
  const markerIds = new Set(); let lastMarker = -1;
  for (const marker of plan.markers) {
    checkKeys(marker,["id","atMs"],"Vefk marker");
    if (!validId(marker.id) || markerIds.has(marker.id) || !Number.isSafeInteger(marker.atMs) ||
        marker.atMs < 0 || marker.atMs < lastMarker || marker.atMs > plan.durationMs) {
      throw new Error("Vefk zaman işareti kimliği veya zamanı geçersiz.");
    }
    markerIds.add(marker.id);
    lastMarker = marker.atMs;
  }
  return paths;
}
function documentMeaning(doc) {
  return {
    format:doc.format,schemaVersion:doc.schemaVersion,id:doc.id,revision:doc.revision,
    title:doc.title,description:doc.description,language:doc.language,
    provenance:doc.provenance,construction:doc.construction,
    geometry:doc.geometry,drawPlan:doc.drawPlan,accessibility:doc.accessibility,
  };
}
/** Checks canonical hashes before the scene may render a JSON path. */
export async function readVefkPublication(raw, scene) {
  requireObject(raw,"Studio publication");
  if (raw.schemaVersion !== 2) throw new Error("Vefk için publication schemaVersion 2 gerekiyor.");
  requireHash(raw.publication?.contentFingerprint, "Publication içerik hash'i");
  const snapshotMeaning = {
    schemaVersion: 2,
    ...(raw.languageVersion ? {languageVersion:raw.languageVersion,languages:raw.languages,vefkLanguages:raw.vefkLanguages} : {}),
    journal: raw.journal,
    archive: raw.archive,
    assets: raw.assets,
    youtubeAnalysis: raw.youtubeAnalysis,
    support: raw.support,
    ...(raw.vefkCatalog != null ? { vefkCatalog: raw.vefkCatalog } : {}),
  };
  if (await shaJson(snapshotMeaning) !== raw.publication.contentFingerprint) {
    throw new Error("Publication içerik fingerprint'i ve Vefk kataloğu eşleşmiyor.");
  }
  if (raw.vefkCatalog == null) return { status:"empty", entries:[], binding:null, fingerprint:null };
  const catalog = requireObject(raw.vefkCatalog,"Vefk kataloğu");
  checkKeys(catalog,["format","schemaVersion","binding","entries","fingerprint"],"Vefk kataloğu");
  if (catalog.format !== "birdesengor.vefk-catalog" ||
      ![1, 2].includes(catalog.schemaVersion) ||
      !Array.isArray(catalog.entries) || catalog.entries.length > 32 ||
      encoder.encode(JSON.stringify(catalog)).byteLength > 5 * 1024 * 1024) {
    throw new Error("Vefk katalog sürümü veya büyüklüğü geçersiz.");
  }
  validateSceneBinding(catalog.binding, scene, catalog.schemaVersion);
  const {fingerprint:catalogHash,...logical} = catalog;
  requireHash(catalogHash,"Vefk katalog fingerprint'i");
  if (await shaJson(logical) !== catalogHash) throw new Error("Vefk katalog fingerprint'i uyuşmuyor.");
  const ids = new Set();
  const entries = [];
  for (const item of catalog.entries) {
    checkKeys(item,["id","revision","order","title","contentHash","url","sha256","document"],"Vefk katalog girdisi");
    const doc = requireObject(item?.document,"Vefk kaydı");
    if (catalog.schemaVersion === 1 && doc.schemaVersion !== 1) throw new Error("Vefk katalog v1 yalnız belge v1 kabul eder.");
    checkDocument(doc);
    requireHash(item.contentHash,"Vefk içerik hash'i");
    requireHash(item.sha256,"Vefk belge dosya hash'i");
    if (ids.has(item.id) || item.id !== doc.id || item.revision !== doc.revision ||
        item.title !== doc.title || item.contentHash !== doc.contentHash ||
        !Number.isSafeInteger(item.order) || item.order < 0 || item.order > 10000) {
      throw new Error("Vefk katalog kimliği veya revizyonu uyuşmuyor.");
    }
    const body = canonicalDocumentText(doc);
    const expectedFile = `vefk/documents/${doc.id}-r${doc.revision}-${item.sha256.slice(0,16)}.json`;
    if (item.url !== expectedFile ||
        await shaJson(documentMeaning(doc)) !== doc.contentHash ||
        await sha(encoder.encode(body)) !== item.sha256) {
      throw new Error("Vefk belge hash'i veya dosya yolu uyuşmuyor.");
    }
    ids.add(item.id);
    entries.push({
      id:doc.id,revision:doc.revision,title:doc.title,order:item.order,
      contentHash:doc.contentHash,document:doc,
    });
  }
  if (stableJson(entries.map(item => [item.order,item.id])) !== stableJson(
    [...entries].sort((a,b)=>a.order-b.order||(a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(item=>[item.order,item.id]))) {
    throw new Error("Vefk katalog sırası deterministik değil.");
  }
  return { status:entries.length?"ready":"empty",entries,binding:catalog.binding,fingerprint:catalogHash };
}

/**
 * Compile once per loaded Vefk. The scene owns its play/pause/seek clock and
 * calls frameAt(timeMs) on each render; no geometry parsing in animation frames.
 */
export function createVefkPlayer(document) {
  const pathSegments = checkDocument(document);
  const plan = document.drawPlan;
  const ordered = plan.strokes.map(stroke => {
    const segments = pathSegments.get(stroke.pathId);
    const inkLength = segments.reduce((total, part) => total + (part.ink ? part.length : 0), 0);
    const liftDistance = segments.reduce((total, part) => total + (part.ink ? 0 : part.length), 0);
    // Time for pen-up motions is allocated WITHIN the canonical stroke duration.
    // The entire stroke still finishes at its exact published endMs.
    const liftUnits = Math.min(liftDistance * .35, inkLength * .30);
    const liftFactor = liftDistance ? liftUnits / liftDistance : 0;
    return { ...stroke, segments, inkLength, liftFactor, totalUnits: inkLength + liftUnits,
      endMs: stroke.startMs + stroke.durationMs };
  });
  const interpolate = (from, to, amount) => ({
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  });

  function strokeAt(stroke, fraction) {
    if (fraction >= 1) return {
      position: stroke.segments.at(-1).to, inkFraction: 1, phase: "hold", penDown: false,
    };
    let remain = Math.max(0, fraction) * stroke.totalUnits;
    let visibleInk = 0;
    for (const part of stroke.segments) {
      const units = part.ink ? part.length : part.length * stroke.liftFactor;
      if (remain <= units || part === stroke.segments.at(-1)) {
        const ratio = units ? Math.max(0, Math.min(1, remain / units)) : 1;
        return {
          position: interpolate(part.from, part.to, ratio),
          inkFraction: Math.max(0, Math.min(1,
            (visibleInk + (part.ink ? part.length * ratio : 0)) / stroke.inkLength)),
          phase: part.ink ? "drawing" : "travel",
          penDown: Boolean(part.ink),
        };
      }
      remain -= units;
      if (part.ink) visibleInk += part.length;
    }
    throw new Error("Vefk alt-yol oynatımı çözümlenemedi.");
  }

  function frameAt(timeMs) {
    if (!Number.isFinite(timeMs)) throw new Error("Vefk oynatma zamanı geçersiz.");
    const clamped = Math.min(plan.durationMs, Math.max(0, timeMs));
    let active = null;
    const visibility = ordered.map(stroke => {
      if (clamped < stroke.startMs) return { pathId: stroke.pathId, fraction: 0 };
      if (clamped >= stroke.endMs) return { pathId: stroke.pathId, fraction: 1 };
      const t = (clamped - stroke.startMs) / stroke.durationMs;
      // V1 keeps its exact floating-point path, including mid-travel positions.
      // V2 warps once; ink, nib and pen-up phase all use this same progress.
      let progress = t;
      if (document.schemaVersion === 2) {
        const u = Math.max(0, Math.min(1, t));
        if (stroke.easing === "ease-in") progress = u * u;
        else if (stroke.easing === "ease-out") progress = u * (2 - u);
        else if (stroke.easing === "ease-in-out") progress = u * u * (3 - 2 * u);
        else progress = u;
      }
      const position = strokeAt(stroke, progress);
      active = { ...position, pathId: stroke.pathId, fraction: position.inkFraction };
      return { pathId: stroke.pathId, fraction: position.inkFraction };
    });
    let pen = null;
    if (active) {
      const { inkFraction, ...state } = active;
      pen = state;
    } else {
      const first = ordered[0];
      if (clamped < first.startMs) {
        pen = { pathId: first.pathId, position: first.segments[0].from,
          fraction: 0, penDown: false, phase: "ready" };
      } else {
        for (let i = 1; i < ordered.length; i += 1) {
          const prev = ordered[i - 1], next = ordered[i];
          if (clamped >= prev.endMs && clamped < next.startMs) {
            const alpha = (clamped - prev.endMs) / (next.startMs - prev.endMs);
            pen = { pathId: next.pathId,
              position: interpolate(prev.segments.at(-1).to, next.segments[0].from, alpha),
              fraction: 0, penDown: false, phase: "travel" };
            break;
          }
        }
        if (!pen) {
          const last = ordered.at(-1);
          pen = { pathId: last.pathId, position: last.segments.at(-1).to,
            fraction: 1, penDown: false, phase: "hold" };
        }
      }
    }
    return {
      timeMs: clamped, durationMs: plan.durationMs,
      visibility, pen, complete: clamped >= plan.durationMs,
    };
  }
  return { durationMs: plan.durationMs, frameAt };
}

/** Convenience helper for one-off evaluations. For playback use createVefkPlayer. */
export function vefkFrameAt(document, timeMs) {
  return createVefkPlayer(document).frameAt(timeMs);
}
