"use strict";

// Pure editor derivation from frozen run sources (or AI source descriptors).
// No DB, live settings, prose transformation or claim verification.
function parsed(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function object(value) {
  const result = parsed(value);
  return result && typeof result === "object" && !Array.isArray(result) ? result : {};
}
function array(value) {
  const result = parsed(value);
  return Array.isArray(result) ? result : [];
}
const text = value => typeof value === "string" ? value.trim() : "";
const strings = value => [...new Set(array(value).map(text).filter(Boolean))];

function deriveEvidenceLedger(sources, sourceKeys) {
  const selected = strings(sourceKeys);
  const wanted = new Set(selected), seen = new Set(), nodes = [];
  const entries = sources instanceof Map ? [...sources.values()] : array(sources);
  for (const raw of entries) {
    const source = object(raw), sourceKey = text(source.sourceKey);
    if (source.sourceType !== "node" || !wanted.has(sourceKey) || seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    const snapshot = Object.hasOwn(source, "snapshot") ? object(source.snapshot) : source;
    const payload = object(snapshot.payload), evidence = [], duplicates = new Set();
    for (const field of ["sequence", "details"]) {
      for (const rawEntry of array(payload[field])) {
        const entry = object(rawEntry), content = text(entry.text);
        if (!content) continue;
        // These IDs belong to this entry. Never inherit the node's video list.
        const sourceVideoIds = strings(entry.sourceVideoIds);
        const identity = JSON.stringify([field, content, [...sourceVideoIds].sort()]);
        if (duplicates.has(identity)) continue;
        duplicates.add(identity);
        evidence.push({ kind: field === "sequence" ? "sequence" : "detail", text: content, sourceVideoIds });
      }
    }
    nodes.push({
      sourceKey, kind: text(snapshot.kind), name: text(snapshot.name),
      summary: text(snapshot.summary),
      // Coarse node provenance, including for summaries; never detail evidence.
      sourceVideoIds: strings(source.sourceVideoIds),
      evidence,
    });
  }
  nodes.sort((a, b) => a.sourceKey < b.sourceKey ? -1 : a.sourceKey > b.sourceKey ? 1 : 0);
  const videos = new Set(nodes.flatMap(node => [...node.sourceVideoIds, ...node.evidence.flatMap(entry => entry.sourceVideoIds)]));
  return { nodes, recordCount: nodes.length, videoCount: videos.size, missingSourceKeys: selected.filter(key => !seen.has(key)) };
}

module.exports = { deriveEvidenceLedger };
