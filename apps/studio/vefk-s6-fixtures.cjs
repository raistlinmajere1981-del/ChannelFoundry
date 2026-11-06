"use strict";
const crypto = require("node:crypto");
const core = require("./vefk-core/index.cjs");
const {BINDING, BINDING_V2} = require("./vefk-publication.cjs");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
function rehashTop(raw) {
  const meaning = {schemaVersion: 2, journal: raw.journal, archive: raw.archive,
    assets: raw.assets, youtubeAnalysis: raw.youtubeAnalysis, support: raw.support,
    ...(raw.vefkCatalog != null ? {vefkCatalog: raw.vefkCatalog} : {})};
  raw.publication.contentFingerprint = sha(core.canonicalString(meaning));
  return raw;
}
function rehash(raw) {
  const catalog = raw.vefkCatalog;
  for (const entry of catalog.entries) {
    const doc = entry.document;
    doc.contentHash = core.documentHash(doc);
    Object.assign(entry, {id: doc.id, revision: doc.revision, title: doc.title, contentHash: doc.contentHash,
      sha256: sha(JSON.stringify(core.canonical(doc), null, 2) + "\n")});
    entry.url = `vefk/documents/${doc.id}-r${doc.revision}-${entry.sha256.slice(0,16)}.json`;
  }
  const {fingerprint, ...logical} = catalog;
  catalog.fingerprint = sha(core.canonicalString(logical));
  return rehashTop(raw);
}
function fixture() {
  return rehash({schemaVersion: 2,
    publication: {id: "pub-" + "a".repeat(24), generatedAt: "2026-11-04T09:00:00.000Z", contentFingerprint: ""},
    journal: {sections: []}, archive: {entities: [
      {entityId: "s6-test-entity", kind: "person", name: "S6 sentetik", visual: {}},
    ], relations: []}, assets: [], youtubeAnalysis: {}, support: {sponsors: [], contributors: []},
    vefkCatalog: {format: "birdesengor.vefk-catalog", schemaVersion: 1,
      binding: structuredClone(BINDING), entries: [{order: 0, document: structuredClone(core.createVefk({
        id: "s6-endpoint-new-3x3", title: "S6 · Yeni sentetik kare", parameters: {order: 3},
      }))}]},
  });
}

// Fresh opt-in documents, never a rewrite of the selected production/demo data.
function v2Fixture({mixed = true, manual = false, easing} = {}) {
  const raw = fixture();
  const input = {id: "s4b-opt-in-3x3", title: "S4b synthetic v2", schemaVersion: 2,
    parameters: {order: 3}};
  if (manual) Object.assign(input, {id: "s4b-opt-in-manual", kind: "manualPaths",
    geometry: {coordinateSpace: "svg-viewBox", viewBox: [0,0,1000,1000],
      inkStyles: {glyph: {width: 5, cap: "round"}}, paths: [
        {id: "mark.multi", ink: "glyph", d: "M 100 100 L 200 100 M 400 100 L 500 100"},
        {id: "mark.closed", ink: "glyph", d: "M 700 200 L 800 200 L 800 300 Z M 900 400 L 950 400"},
      ]}});
  const plan = structuredClone(core.createVefk(input).drawPlan);
  const curves = ["linear", "ease-in", "ease-out", "ease-in-out"];
  plan.strokes.forEach((stroke, i) => {
    if (easing === "omitted") delete stroke.easing;
    else stroke.easing = easing ?? curves[i % curves.length];
  });
  const doc = structuredClone(core.createVefk({...input, drawPlan: plan}));
  raw.vefkCatalog.schemaVersion = 2;
  raw.vefkCatalog.binding = structuredClone(BINDING_V2);
  if (!mixed) raw.vefkCatalog.entries = [];
  raw.vefkCatalog.entries.push({order: mixed ? 1 : 0, document: doc});
  return rehash(raw);
}
const v2Document = raw => raw.vefkCatalog.entries.at(-1).document;
const v2Attacks = [
  ...["bogus", "Linear", " linear", "", null, 0, false, ["linear"], {}].map(value =>
    [`invalid easing ${JSON.stringify(value)}`, r => {v2Document(r).drawPlan.strokes[0].easing = value;}]),
  ["doc1 easing injection", r => {r.vefkCatalog.entries[0].document.drawPlan.strokes[0].easing = "linear";}],
  ["unknown stroke field", r => {v2Document(r).drawPlan.strokes[0].curve = "ease-in";}],
  ["plan easing injection", r => {v2Document(r).drawPlan.easing = "ease-in";}],
  ["unknown document version", r => {v2Document(r).schemaVersion = 3;}],
  ["string document version", r => {v2Document(r).schemaVersion = "2";}],
  ["cat1 carrying doc2", r => {r.vefkCatalog.schemaVersion = 1; r.vefkCatalog.binding = structuredClone(BINDING);} ],
  ["unknown catalog version", r => {r.vefkCatalog.schemaVersion = 3;}],
  ["string catalog version", r => {r.vefkCatalog.schemaVersion = "2";}],
  ["cat2 binding2", r => {r.vefkCatalog.binding = structuredClone(BINDING);} ],
  ["unknown binding version", r => {r.vefkCatalog.binding.bindingVersion = 4;}],
  ["string binding version", r => {r.vefkCatalog.binding.bindingVersion = "3";}],
  ["missing motion capability", r => {delete r.vefkCatalog.binding.motion;}],
  ["wrong motion capability", r => {r.vefkCatalog.binding.motion.strokeEasing = "v1";}],
  ["extra motion capability", r => {r.vefkCatalog.binding.motion.extra = true;}],
  ["motion list", r => {r.vefkCatalog.binding.motion = ["v2"];}],
  ["motion null", r => {r.vefkCatalog.binding.motion = null;}],
  ["wrong physical anchor", r => {r.vefkCatalog.binding.surface.anchorId = "parchment.ink-plane";}],
  ["typed empty object as list", r => {v2Document(r).geometry.inkStyles = [];}],
  ["typed stroke list as object", r => {v2Document(r).drawPlan.strokes = {};}],
];
// Each schema attack is rehashed at EVERY layer by the callers. These failures
// must come from schema validation rather than a stale fingerprint.
const schemaAttacks = [
  ["unknown document field", d => {d.easing = "ease-in";}],
  ["unknown geometry field", d => {d.geometry.easing = "ease-in";}],
  ["unknown path field", d => {d.geometry.paths[0].easing = "ease-in";}],
  ["SVG command in x coordinate", d => {d.geometry.paths[0].d = "M L 0 L 1 1";}],
  ["SVG command in y coordinate", d => {d.geometry.paths[0].d = "M 0 Z L 1 1";}],
  ["unknown ink style field", d => {d.geometry.inkStyles.grid.opacity = 0.3;}],
  ["unknown plan field", d => {d.drawPlan.easing = "ease-in";}],
  ["unknown stroke easing", d => {d.drawPlan.strokes[0].easing = "ease-in";}],
  ["unknown marker field", d => {d.drawPlan.markers[0].easing = "ease-in";}],
  ["duplicate stroke ID", d => {d.drawPlan.strokes[1].id = d.drawPlan.strokes[0].id;}],
  ["duplicate marker ID", d => {d.drawPlan.markers[1].id = d.drawPlan.markers[0].id;}],
  ["non-string document ID", d => {d.id = ["coerced-id"];}],
  ["non-string path ID", d => {d.geometry.paths[0].id = ["grid.outer"];}],
  ["non-string stroke ID", d => {d.drawPlan.strokes[0].id = ["stroke.001"];}],
  ["invalid marker ID", d => {d.drawPlan.markers[0].id = "bad/id";}],
  ["negative marker time", d => {d.drawPlan.markers[0].atMs = -1;}],
  ["fractional marker time", d => {d.drawPlan.markers[0].atMs = 0.5;}],
  ["marker past duration", d => {d.drawPlan.markers[0].atMs = d.drawPlan.durationMs + 1;}],
  ["unordered markers", d => {d.drawPlan.markers.reverse();}],
  ["too many markers", d => {d.drawPlan.markers = Array.from({length: 65}, (_, i) => ({id: `m.${i}`, atMs: i}));}],
  ["overlapping strokes", d => {d.drawPlan.strokes[1].startMs = 0;}],
  ["fractional stroke time", d => {d.drawPlan.strokes[0].durationMs = 0.5;}],
  ["zero stroke duration", d => {d.drawPlan.strokes[0].durationMs = 0;}],
  ["negative stroke start", d => {d.drawPlan.strokes[0].startMs = -1;}],
  ["stroke past duration", d => {d.drawPlan.strokes[0].durationMs = d.drawPlan.durationMs + 1;}],
  ["duplicate path use", d => {d.drawPlan.strokes[1].pathId = d.drawPlan.strokes[0].pathId;}],
  ["unknown path", d => {d.drawPlan.strokes[0].pathId = "missing.path";}],
  ["wrong pen state", d => {d.drawPlan.strokes[0].pen = "up";}],
  ["wrong ink", d => {d.drawPlan.strokes[0].ink = "glyph";}],
  ["numeric-string ink width", d => {d.geometry.inkStyles.grid.width = "7";}],
  ["unsupported schema version", d => {d.schemaVersion = 3;}],
];
module.exports = {fixture, v2Fixture, v2Attacks, rehash, rehashTop, sha, schemaAttacks};
