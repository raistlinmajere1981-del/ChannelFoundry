const path = require("node:path");
const fs = require("node:fs");
const { getMeta, setMeta } = require("./storage-database.cjs");
const publicationV2 = require("./publication-v2.cjs");

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordPublicationInfo(db, info) {
  const publication = {
    generatedAt: String(info?.generatedAt ?? ""),
    file: String(info?.file ?? ""),
    publicationId: String(info?.publicationId ?? ""),
    contentFingerprint: String(info?.contentFingerprint ?? ""),
    sectionCount: number(info?.sectionCount),
    entityCount: number(info?.entityCount),
    relationCount: number(info?.relationCount),
    assetCount: number(info?.assetCount),
    vefkCount: number(info?.vefkCount),
  };
  setMeta(db, "last_export_at", publication.generatedAt);
  setMeta(db, "last_export_file", publication.file);
  setMeta(db, "last_export_publication_id", publication.publicationId);
  setMeta(db, "last_export_fingerprint", publication.contentFingerprint);
  setMeta(db, "last_export_sections", publication.sectionCount);
  setMeta(db, "last_export_entities", publication.entityCount);
  setMeta(db, "last_export_relations", publication.relationCount);
  setMeta(db, "last_export_assets", publication.assetCount);
  setMeta(db, "last_export_vefks", publication.vefkCount);
  return {
    ...publication,
    itemCount: publication.sectionCount + publication.entityCount,
  };
}

function exportPublicSnapshot(db, userDataPath) {
  const result = publicationV2.exportPublicationV2(db, userDataPath);
  const publication = recordPublicationInfo(db, result);
  return {
    root: path.join(String(userDataPath), "public-export"),
    ...publication,
    assetsDirectory: result.assetsDirectory,
    readiness: result.readiness,
    publicationV2: result,
  };
}

function getPublicationInfo(db, userDataPath = "") {
  const generatedAt = getMeta(db, "last_export_at");
  if (!generatedAt && userDataPath) {
    const file = path.join(userDataPath,"public-export","content","publication.json");
    try {
      const snapshot = JSON.parse(fs.readFileSync(file,"utf8"));
      if (snapshot.schemaVersion !== 2 || !snapshot.publication?.contentFingerprint) return null;
      return {
        file,generatedAt:snapshot.publication.generatedAt,
        publicationId:snapshot.publication.id,
        contentFingerprint:snapshot.publication.contentFingerprint,
        sectionCount:snapshot.journal?.sections?.length ?? 0,
        entityCount:snapshot.archive?.entities?.length ?? 0,
        relationCount:snapshot.archive?.relations?.length ?? 0,
        assetCount:snapshot.assets?.length ?? 0,
        vefkCount:snapshot.vefkCatalog?.entries?.length ?? 0,
      };
    } catch {return null;}
  }
  if (!generatedAt) return null;
  const sectionCount = number(getMeta(db, "last_export_sections"));
  const entityCount = number(getMeta(db, "last_export_entities"));
  return {
    generatedAt,
    file: String(getMeta(db, "last_export_file") ?? ""),
    publicationId: String(getMeta(db, "last_export_publication_id") ?? ""),
    contentFingerprint: String(getMeta(db, "last_export_fingerprint") ?? ""),
    sectionCount,
    entityCount,
    relationCount: number(getMeta(db, "last_export_relations")),
    assetCount: number(getMeta(db, "last_export_assets")),
    vefkCount: number(getMeta(db, "last_export_vefks")),
    itemCount: sectionCount + entityCount,
  };
}

module.exports = {
  exportPublicSnapshot,
  getPublicationInfo,
  recordPublicationInfo,
};
