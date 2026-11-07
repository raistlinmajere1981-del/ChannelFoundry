"use strict";

/**
 * Editorial evidence is different from graph edges. The AI may use published
 * node descriptions as narrative evidence, but a relation name/label is not
 * itself an event, action, experience or section title.
 *
 * All sources remain stored in the frozen run and retain their original
 * identities for change tracking, provenance and review.
 */
const LEGACY_POLICY = "narrative-records-v1";
const POLICY = "narrative-records-v2";
const usesRecordEvidence = policy => policy === POLICY || policy === LEGACY_POLICY;

function partitionChanges(changes = []) {
  const records = [], graphChanges = [];
  for (const change of changes) {
    if (change?.sourceType === "node") records.push(change);
    else if (change?.sourceType === "relation") graphChanges.push({
      sourceType: "relation",
      sourceKey: change.sourceKey,
      changeKind: change.changeKind,
      sourceVideoIds: change.sourceVideoIds,
      fromKey: change.snapshot?.fromKey ?? "",
      toKey: change.snapshot?.toKey ?? "",
    });
  }
  return { records, graphChanges };
}

function partitionSources(sources = []) {
  const approvedRecords = [], relationContext = [];
  for (const source of sources) {
    if (source?.sourceType === "node") approvedRecords.push(source);
    if (source?.sourceType === "relation") {
      // No label, description or generated verbal relationship is included.
      relationContext.push({
        sourceKey: source.sourceKey,
        fromKey: source.fromKey,
        toKey: source.toKey,
        sourceVideoIds: source.sourceVideoIds,
      });
    }
  }
  return { approvedRecords, relationContext };
}

function sortedVideos(videos = []) {
  return [...videos].sort((a, b) => {
    const dayA = /^\d{4}-\d\d-\d\d/.test(a.publishedAt ?? "") ? a.publishedAt.slice(0, 10) : "9999-99-99";
    const dayB = /^\d{4}-\d\d-\d\d/.test(b.publishedAt ?? "") ? b.publishedAt.slice(0, 10) : "9999-99-99";
    return dayA.localeCompare(dayB) || a.videoId.localeCompare(b.videoId);
  });
}

module.exports = { POLICY, LEGACY_POLICY, usesRecordEvidence, partitionChanges, partitionSources, sortedVideos };
