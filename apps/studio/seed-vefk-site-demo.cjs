"use strict";

/** Explicit, repeatable, local-only BirDeSenGör V2 rendering fixture.
 * Run from project root with node apps/studio/seed-vefk-site-demo.cjs.
 * Does not deploy, alter other selected vefks, or approve any AI interpretation.
 */
const fs = require("node:fs");
const path = require("node:path");
const {DatabaseSync} = require("node:sqlite");
const project = require("./channel-projects.cjs");
const core = require("./vefk-core/index.cjs");
const store = require("./vefk-store.cjs");
const catalog = require("./vefk-publication.cjs");
const publication = require("./storage-publication.cjs");

const ID = "demo-vefk-5x5-v2";
const root = path.resolve(__dirname, "../..");
const expectedChannel = "birdesengor";
const active = project.activeProjectId(root);
if (active !== expectedChannel) {
  throw new Error("Sadece BirDeSenGör kanalı etkinse örnek yayınlanabilir. Etkin kanal: "+active);
}
const dataRoot = path.resolve(project.activeDataRoot(root));
const userData = path.join(dataRoot, "studio");
const file = path.join(userData, "channel-foundry-studio.sqlite");
if (!fs.existsSync(file)) throw new Error("Studio veri tabanı bulunamadı: "+file);
const db = new DatabaseSync(file, {timeout:5000});
db.exec("PRAGMA foreign_keys=ON;");
try {
  catalog.ensureSchema(db);
  const fixture = core.createVefk({
    id: ID,
    revision: 1,
    title: "DEMO · 5×5 Vefk · Divit ve Parşömen Çizim Testi",
    description: "Yalnız BirDeSenGör V2 görsel/animasyon sınaması için oluşturulmuş algoritmik 5×5 sayı karesi. Tarihî bir vefk kaynağı veya AI tarafından doğrulanmış el yazması değildir.",
    language: "tr",
    kind: "magicSquare",
    parameters: {order: 5, first:1, step:1},
    provenance: {
      kind:"algorithmic",
      references:[],
      notes:"Studio S1 Siamese-odd deterministik üretim; canlı etkileşim testleri için açıkça seçilmiş demo.",
    },
    accessibility: {
      summary:"5×5 matematiksel demo kare; parşömene divitle çizim akışını sınar.",
      matrixText:"",
    },
  });
  const existing = store.getDocument(db, ID);
  if (!existing) {
    store.saveDraft(db,{document:fixture});
    store.setReviewState(db,{id:ID,revision:1,status:"checked",expectedContentHash:fixture.contentHash});
    store.setReviewState(db,{id:ID,revision:1,status:"approved",expectedContentHash:fixture.contentHash});
  } else if (existing.revision !== 1 || existing.contentHash !== fixture.contentHash
      || !["approved","published"].includes(existing.status)) {
    throw new Error("Demo kimliği zaten farklı veya onaysız bir belgeye ait; mevcut veriler değiştirilmedi.");
  }
  catalog.select(db,{
    id:ID,revision:1,contentHash:fixture.contentHash,enabled:true,sortOrder:100,
  });
  const result = publication.exportPublicSnapshot(db,userData);
  const payload = JSON.parse(fs.readFileSync(result.file,"utf8"));
  const entry = payload.vefkCatalog?.entries.find(v=>v.id===ID);
  if (!entry || entry.contentHash !== fixture.contentHash) {
    throw new Error("Demo vefk site yayınında beklenen hash ile bulunamadı.");
  }
  if (catalog.validateCatalog(payload.vefkCatalog).ok !== true) {
    throw new Error("Vefk katalog doğrulaması başarısız.");
  }
  console.log(JSON.stringify({
    activeChannel:active, id:fixture.id, title:fixture.title, revision:1,
    status:"approved", siteSelected:true,
    squareOrder:fixture.construction.parameters.order,
    pathCount:fixture.geometry.paths.length,
    strokeCount:fixture.drawPlan.strokes.length,
    durationMs:fixture.drawPlan.durationMs,
    contentHash:fixture.contentHash,
    catalogFingerprint:payload.vefkCatalog.fingerprint,
    publicationFingerprint:payload.publication.contentFingerprint,
    publicationFile:result.file,
    standaloneCatalog:path.join(userData,"public-export","content","vefk","vefk_catalog.json"),
    catalogCount:payload.vefkCatalog.entries.length,
    localOnly:true,
  },null,2));
} finally { db.close(); }
