"use strict";
// BirDeSenGör-only disposable demo cleanup. The YouTube archive, protected site
// shell, live-admin account and current Kanal Çizimi geometry are retained.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const vefk = require("./vefk-core/index.cjs");
const vefkStore = require("./vefk-store.cjs");
const vefkPublication = require("./vefk-publication.cjs");
const publication = require("./publication-v2.cjs");

const ROOT = path.resolve(__dirname, "../../channels/birdesengor");
const STUDIO = path.join(ROOT, ".local-data/studio");
const WEB = path.join(ROOT, "web");
const STUDIO_DB = path.join(STUDIO, "channel-foundry-studio.sqlite");
const COMMUNITY_DB = path.join(WEB, ".local-data/community.sqlite");
const DRAWING = "birdesengor-channel-drawing";
const TABLES = [
  "publication_language_variants", "publication_language_sources",
  "narrative_independent_order", "narrative_section_chapters", "narrative_chapters", "narrative_series",
  "narrative_visual_slots", "narrative_section_revisions", "narrative_sections",
  "narrative_run_sources", "narrative_runs", "entity_visual_profiles",
  "universe_main_characters", "universe_workspace_history", "universe_workspace_revisions",
  "universe_workspace_relations", "universe_workspace_imports", "universe_workspace_nodes",
  "universe_ingest_run_sources", "universe_ingest_runs", "universe_ingest_sources",
  "universe_merge_chunks", "universe_merge_runs", "ai_analysis_editorial_reviews",
  "ai_analysis_jobs", "source_ai_analyses", "content_sources", "relations", "content_items",
  "narrative_narrator_profile", "vefk_document_sources", "vefk_source_analyses",
  "vefk_source_preparations", "vefk_sources",
];
const TABLE_EXISTS = db => new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
const SHA = value => crypto.createHash("sha256").update(value).digest("hex");
const safe = relative => {
  const abs = path.resolve(ROOT, relative);
  if (!abs.startsWith(ROOT + path.sep)) throw new Error("Channel boundary violation");
  return abs;
};
const protectedFiles = [
  "channel.json", "web/public/robots.txt", "web/public/index.php",
  "web/public/scene-assets/opening/observer-portrait.webp",
];
const protectedBefore = Object.fromEntries(protectedFiles.map(name => [name, SHA(fs.readFileSync(safe(name)))]));
function drawingSummary(db) {
  vefkStore.ensureSchema(db);
  vefkPublication.ensureSchema(db);
  const docs = vefkStore.listDocuments(db);
  const current = vefkStore.getDocument(db, DRAWING);
  if (!current || !["approved", "published"].includes(current.status)) throw new Error("Kanal Çizimi onaylı kaydı bulunamadı.");
  const selected = db.prepare("SELECT * FROM vefk_publication_selection WHERE document_id=?").get(DRAWING);
  if (!selected || selected.revision !== current.revision || selected.content_hash !== current.contentHash) {
    throw new Error("Kanal Çizimi yayın seçimi son onaylı belgeyle uyuşmuyor.");
  }
  return {
    title: current.document.title, sourceRevision: current.revision,
    sourceHash: current.contentHash,
    originalRevisions: db.prepare("SELECT COUNT(*) AS n FROM vefk_revisions").get().n,
    documents: docs.map(x => x.id),
    geometryDigest: SHA(vefk.canonicalString({ geometry:current.document.geometry, drawPlan:current.document.drawPlan })),
    current, selected,
  };
}
function rebaseDrawing(db, original) {
  const doc = { ...original.current.document, revision: 1 };
  doc.contentHash = vefk.documentHash(doc);
  vefk.validateVefk(doc);
  const nextDigest = SHA(vefk.canonicalString({ geometry:doc.geometry, drawPlan:doc.drawPlan }));
  if (nextDigest !== original.geometryDigest) throw new Error("Vefk çizim geometrisi değişti.");
  const serialized = vefk.serializeVefk(doc, doc.schemaVersion);
  // Keep current approved content but erase revisions 1..old current, replacing with a single clean v1.
  db.prepare("DELETE FROM vefk_publication_selection WHERE document_id<>?").run(DRAWING);
  db.prepare("DELETE FROM vefk_documents WHERE id<>?").run(DRAWING);
  db.prepare("DELETE FROM vefk_revisions WHERE document_id=?").run(DRAWING);
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO vefk_revisions
    (document_id, revision, document_json, content_hash, status, created_at, updated_at, approved_at)
    VALUES (?, 1, ?, ?, 'approved', ?, ?, ?)`).run(DRAWING, serialized, doc.contentHash, now, now, now);
  db.prepare("UPDATE vefk_documents SET current_revision=1,status='approved',title=?,title_search=?,created_at=?,updated_at=? WHERE id=?")
    .run(doc.title, doc.title.toLocaleLowerCase("tr-TR"), now, now, DRAWING);
  db.prepare("UPDATE vefk_publication_selection SET revision=1,content_hash=?,selected_at=? WHERE document_id=?")
    .run(doc.contentHash, now, DRAWING);
  return { id: DRAWING, revision:1, contentHash:doc.contentHash, oldRevision:original.sourceRevision, strokes:doc.drawPlan?.strokes?.length ?? 0, geometryDigest:nextDigest };
}
function snapshot(db) {
  const exist=TABLE_EXISTS(db);
  return Object.fromEntries(TABLES.filter(t=>exist.has(t)).map(t=>[t,db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n]));
}
function cleanupDatabase(db, original) {
  const exists = TABLE_EXISTS(db);
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON;");
  let drawing;
  try {
    for (const table of TABLES) if (exists.has(table)) db.exec(`DELETE FROM "${table}"`);
    drawing = rebaseDrawing(db, original);
    if (exists.has("studio_meta")) db.exec("DELETE FROM studio_meta WHERE key LIKE 'last_export_%'");
    const fk = db.prepare("PRAGMA foreign_key_check").all();
    if (fk.length) throw new Error("SQLite foreign keys failed: " + JSON.stringify(fk.slice(0,4)));
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return drawing;
}
function communityClean(db) {
  const tables = TABLE_EXISTS(db);
  db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
  try {
    for (const t of ["forum_attachments","forum_posts","forum_threads","email_verifications"]) if (tables.has(t)) db.exec(`DELETE FROM "${t}"`);
    if (tables.has("users")) db.exec("DELETE FROM users WHERE role<>'admin'");
    const foreign = db.prepare("PRAGMA foreign_key_check").all();
    if (foreign.length) throw new Error("Community FK broken");
    db.exec("COMMIT;");
  } catch(error){db.exec("ROLLBACK;");throw error;}
}
function run(apply=false) {
  if (apply && process.env.CF_BIRDESENGOR_RESET_CONFIRM !== "RESET_DISPOSABLE_BIRDESENGOR") {
    throw new Error("Destructive cleanup requires explicit CF_BIRDESENGOR_RESET_CONFIRM.");
  }
  if (!fs.existsSync(STUDIO_DB)) throw new Error("BirDeSenGör Studio database missing");
  const db = new DatabaseSync(STUDIO_DB, {readOnly:!apply});
  let original, before;
  try {
    original = drawingSummary(db);
    before = snapshot(db);
  } finally {db.close();}
  const result = { scope:"BirDeSenGör local only", applied:apply, before,
    drawing:{title:original.title,revision:original.sourceRevision,revisions:original.originalRevisions,geometryDigest:original.geometryDigest},
    preserved:["YouTube archive and raw transcripts","site entry password","robots.txt","loading scene","community admin account","AI provider credentials"], filesRemoved:[] };
  if (!apply) return result;
  const backup = path.join(STUDIO, "backups", "milestone-clean-" + new Date().toISOString().replace(/[:.]/g,"-"));
  fs.mkdirSync(backup,{recursive:true,mode:0o700});
  const rw = new DatabaseSync(STUDIO_DB);
  try {
    rw.prepare("VACUUM INTO ?").run(path.join(backup,"studio-before.sqlite"));
    result.drawing=cleanupDatabase(rw, original);
    result.after = snapshot(rw);
    result.integrity = rw.prepare("PRAGMA integrity_check").get().integrity_check;
    if (result.integrity !== "ok") throw new Error("Studio db integrity failed");
  } finally {rw.close();}
  if (fs.existsSync(COMMUNITY_DB)) {
    const community = new DatabaseSync(COMMUNITY_DB);
    try {
      community.prepare("VACUUM INTO ?").run(path.join(backup,"community-before.sqlite"));
      communityClean(community);
      result.community={users:community.prepare("SELECT COUNT(*) AS n FROM users").get().n,integrity:community.prepare("PRAGMA integrity_check").get().integrity_check};
    } finally {community.close();}
  }
  const projectFile=safe("channel.json");
  const project=JSON.parse(fs.readFileSync(projectFile,"utf8"));
  project.narrator = { ...project.narrator, sourceEntityKeys:[] };
  const savedConfig=fs.readFileSync(projectFile,"utf8");
  if (JSON.stringify(project)!==JSON.stringify(JSON.parse(savedConfig))) {
    fs.writeFileSync(projectFile,JSON.stringify(project,null,2)+"\n",{mode:0o600});
    result.narratorBindingsCleared=true;
  }
  // Assert all protected files except the intended old narrator binding.
  for (const name of protectedFiles.filter(x=>x!=="channel.json")) {
    if (SHA(fs.readFileSync(safe(name)))!==protectedBefore[name]) throw new Error("Protected site shell changed: "+name);
  }
  for(const relative of [
    ".local-data/studio/public-export",
    ".local-data/studio/seo-workspaces",
    ".local-data/studio/visual-assets",
    ".local-data/studio/nexa-analysis",
    "web/.local-data/camera",
    "web/.local-data/p75-studio-fixture.json",
    "web/.local-data/uploads",
    "web/public/content",
  ]) {
    const file=safe(relative);
    if(fs.existsSync(file)){ fs.rmSync(file,{recursive:true,force:true});result.filesRemoved.push(relative); }
  }
  fs.mkdirSync(path.join(STUDIO,"visual-assets"),{recursive:true});
  fs.mkdirSync(path.join(WEB,".local-data/uploads"),{recursive:true});
  const publicationDb=new DatabaseSync(STUDIO_DB);
  try {
    result.export=publication.exportPublicationV2(publicationDb,STUDIO);
    const exportData=JSON.parse(fs.readFileSync(result.export.file,"utf8"));
    if (exportData.journal.sections.length || exportData.archive.entities.length || exportData.archive.relations.length || exportData.youtubeAnalysis.videos.length || exportData.support.sponsors.length || exportData.support.contributors.length || exportData.assets.length || exportData.vefkCatalog.entries.length!==1 || exportData.vefkCatalog.entries[0].revision!==1) {
      throw new Error("New publication is not a clean drawing-only snapshot");
    }
  } finally {publicationDb.close();}
  const check = new DatabaseSync(STUDIO_DB,{readOnly:true});
  try {
    const current=vefkStore.getDocument(check,DRAWING);
    if(!current||current.revision!==1||check.prepare("SELECT COUNT(*) AS n FROM vefk_revisions").get().n!==1)throw new Error("Drawing rebase failed");
    const expected=SHA(vefk.canonicalString({ geometry:current.document.geometry, drawPlan:current.document.drawPlan }));
    if(expected!==original.geometryDigest)throw new Error("Drawing geometry changed after rebase");
    if(check.prepare("PRAGMA foreign_key_check").all().length)throw new Error("Foreign key error after export");
  }finally{check.close();}
  result.backup=backup;
  fs.writeFileSync(path.join(backup,"cleanup-report.json"),JSON.stringify(result,null,2)+"\n",{mode:0o600});
  return result;
}
if(require.main===module){
  const apply=process.argv.includes("--apply-local");
  try { const result=run(apply); console.log(JSON.stringify(result,null,2)); }
  catch(e){ console.error("CLEANUP FAILED:",e.message); process.exitCode=1; }
}
module.exports={run, TABLES};
