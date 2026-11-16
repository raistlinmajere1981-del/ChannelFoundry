"use strict";
/**
 * Import the first independently audited ten VIDEO sources as source-scoped
 * Düğümlü Kitap/Ara Kayıtlar chapters. Safeguards:
 * - no overwrite/retirement of existing 105 chapters;
 * - no changes to Universe nodes/relations or general narrative baseline;
 * - all draft/audit/source fingerprints must be current;
 * - one SQLite transaction + full integrity and provenance checks;
 * - by default does not change any DB. --apply needs an explicit /tmp copy.
 *   --live requires an explicit verified backup argument.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const narrative = require("./narrative-store.cjs");
const structured = require("./narrative-structured-content.cjs");
const languages = require("./publication-languages.cjs");
const publication = require("./publication-v2.cjs");

const root = path.resolve(__dirname, "../..");
const data = path.join(root, "channels/birdesengor/.local-data/studio");
const coverage = path.join(data, "book-coverage");
const liveDb = path.join(data, "channel-foundry-studio.sqlite");
const chapterKey = "topic-chapter-dugumlu-ara-kayitlar";
const model = "video-editorial:gpt-6.1-sol";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const parse = file => JSON.parse(fs.readFileSync(file, "utf8"));
const isWord = value => /[\p{L}\p{N}]/u.test(value ?? "");
const trim = value => String(value || "").trim();

function argumentsFromCli() {
  const get = flag => {
    const i = process.argv.indexOf(flag);
    return i < 0 ? "" : String(process.argv[i + 1] || "");
  };
  const apply = process.argv.includes("--apply");
  const live = process.argv.includes("--live");
  const givenDb = get("--db");
  const dbFile = path.resolve(givenDb || liveDb);
  const backup = get("--backup");
  assert(!live || dbFile === liveDb, "--live is only valid for the real Studio SQLite");
  if (apply && dbFile === liveDb) {
    assert(live, "Canonical database is protected; --live required");
    assert(backup && fs.existsSync(backup) && fs.statSync(backup).size > 1000000,
      "Verified backup file is required for --live");
    assert(path.resolve(backup) !== dbFile, "Backup cannot be live database");
  }
  if (apply && dbFile !== liveDb) assert(dbFile.startsWith("/tmp/"), "--apply is only allowed on /tmp copies");
  return { apply, live, dbFile };
}

function candidateBlocks(body, sources) {
  const possibilities = sources.filter(s => s.sourceType === "node" &&
    ["character", "object", "location"].includes(s.snapshot?.kind) &&
    trim(s.snapshot.name).length >= 3 &&
    !["Ömer", "Anlatıcı"].includes(trim(s.snapshot.name)))
    .sort((a, b) => b.snapshot.name.length - a.snapshot.name.length);
  const used = new Set();
  return trim(body).split(/\n\s*\n/).map(paragraph => {
    const matches = [];
    for (const source of possibilities) {
      if (used.has(source.sourceKey)) continue;
      const name = trim(source.snapshot.name);
      const index = paragraph.toLocaleLowerCase("tr-TR").indexOf(name.toLocaleLowerCase("tr-TR"));
      if (index < 0 || isWord(paragraph[index - 1]) || isWord(paragraph[index + name.length])) continue;
      if (matches.some(m => index < m.end && index + name.length > m.start)) continue;
      matches.push({ start: index, end: index + name.length, entityId: source.sourceKey,
        label: paragraph.slice(index, index + name.length) });
      used.add(source.sourceKey);
    }
    matches.sort((a, b) => a.start - b.start);
    const spans = [];
    let offset = 0;
    for (const match of matches) {
      if (match.start > offset) spans.push({ type: "text", text: paragraph.slice(offset, match.start) });
      spans.push({ type: "reference", entityId: match.entityId, label: match.label });
      offset = match.end;
    }
    if (offset < paragraph.length) spans.push({ type: "text", text: paragraph.slice(offset) });
    return { type: "paragraph", spans };
  });
}

function validateSourceFiles() {
  execFileSync("python3", ["-B", "apps/studio/birdesengor_book_coverage.py", "--check-snapshot"],
    { cwd: root, stdio: "pipe", timeout: 40000 });
  const plan = parse(path.join(coverage, "batch-01-editorial-decisions.json"));
  const packet = parse(path.join(coverage, "source-packets/batch-01-ready_for_source_audit.json"));
  assert.equal(plan.batch, 1);
  assert.equal(plan.sourceCount, 10);
  assert.equal(plan.approval, "source_audited_pending_import");
  assert.equal(plan.decisions.length, 10);
  assert.equal(packet.sources.length, 10);
  const seen = new Set();
  const items = [];
  for (let n = 0; n < 10; n++) {
    const decision = plan.decisions[n];
    const record = packet.sources[n];
    const vid = record.video.videoId;
    assert.equal(decision.videoId, vid);
    assert(!seen.has(vid), "Duplicate video identity");
    seen.add(vid);
    assert.equal(decision.decision, "new_scoped_section");
    assert.equal(decision.targetChapterKey, chapterKey);
    assert.equal(decision.sectionKey, "narrative-section-video-" + vid);
    assert.equal(decision.sourceFingerprint, record.video.sourceFingerprint);
    const folder = path.join(coverage, "drafts");
    const draftFile = path.join(folder, vid + ".json");
    const auditFile = path.join(folder, vid + ".audit.json");
    const draft = parse(draftFile);
    const audit = parse(auditFile);
    const seal = parse(path.join(folder, vid + ".audit.seal.json"));
    assert.deepEqual(draft.sourceVideoIds, [vid]);
    assert.equal(decision.draftSha256, sha(fs.readFileSync(draftFile)));
    assert.equal(decision.auditSha256, sha(fs.readFileSync(auditFile)));
    assert.equal(seal.draftSha256, decision.draftSha256);
    assert.equal(seal.auditSha256, decision.auditSha256);
    assert.equal(seal.sourceFingerprint, decision.sourceFingerprint);
    assert.equal(audit.videoId, vid);
    assert.equal(audit.verdict, "pass");
    assert.deepEqual(audit.issues, []);
    assert(draft.body.length >= 600 && draft.body.length <= 22000);
    assert(draft.title.length >= 6 && draft.title.length <= 190);
    assert(draft.sourceAnchors.length >= 3 && draft.sourceAnchors.length <= 12);
    assert(draft.sourceAnchors.every(a => a && record.originalTranscript.includes(a)), "Invalid subtitle anchor");
    items.push({ vid, decision, draft });
  }
  return items;
}

function originalSnapshot(db) {
  return {
    book: db.prepare("SELECT r.id,r.section_key,r.title,r.body,r.blocks_json,r.entity_references_json,r.source_keys_json,r.source_video_ids_json,r.state FROM narrative_section_revisions r JOIN narrative_sections s ON s.current_revision_id=r.id WHERE s.state='active' ORDER BY r.id").all(),
    variants: db.prepare("SELECT * FROM publication_language_variants WHERE kind='section' ORDER BY id,language").all(),
    bookCount: db.prepare("SELECT COUNT(*) AS count FROM narrative_sections WHERE state='active'").get().count,
  };
}

function prepare(db, items) {
  narrative.ensureSchema(db);
  assert(db.prepare("SELECT 1 FROM narrative_chapters WHERE key=?").get(chapterKey), "Target chapter absent");
  const before = originalSnapshot(db);
  assert.equal(before.bookCount, 105, "Unexpected original book chapter count");
  const general = db.prepare("SELECT id FROM narrative_runs WHERE state='applied' AND model NOT LIKE 'invitation-editorial:%' AND model NOT LIKE 'video-editorial:%' ORDER BY id DESC LIMIT 1").get();
  assert(general, "General narrative baseline missing");
  const pending = narrative.buildInput(db);
  assert.equal(pending.baselineRunId, general.id, "Baseline selection mismatch");
  assert.equal(pending.changes.length, 3930, "Expected 3930 outstanding baseline changes");
  assert.equal(pending.removed.length, 0, "Unexpected removed sources");
  const src = narrative.currentUniverseSources(db);
  const byVideo = new Map();
  for (const source of src) {
    if (source.sourceType !== "node") continue;
    if (trim(source.snapshot?.name) === "Ömer") continue;
    for (const id of source.sourceVideoIds) {
      if (!byVideo.has(id)) byVideo.set(id, []);
      byVideo.get(id).push(source);
    }
  }
  for (const item of items) {
    assert(!db.prepare("SELECT 1 FROM narrative_sections WHERE key=?").get(item.decision.sectionKey),
      "One of the target chapters already exists: " + item.vid);
    const sources = byVideo.get(item.vid) || [];
    assert(sources.some(s => ["story", "event"].includes(s.snapshot?.kind)),
      "No approved story/event provenance for video " + item.vid);
    item.sources = sources;
  }
  const lastPosition = db.prepare("SELECT COALESCE(MAX(position),-1) AS m FROM narrative_section_chapters WHERE chapter_key=?").get(chapterKey).m;
  return { before, general, pending, lastPosition };
}

function apply(db, items, pre) {
  const fingerprint = sha(JSON.stringify(items.map(item => ({
    videoId: item.vid, sourceFingerprint: item.decision.sourceFingerprint,
    draftSha256: item.decision.draftSha256, auditSha256: item.decision.auditSha256,
    chapterKey,
  }))));
  const insertSection = db.prepare("INSERT INTO narrative_sections(key,state) VALUES(?,'active')");
  const insertRevision = db.prepare(
    "INSERT INTO narrative_section_revisions(section_key,run_id,revision_no,position,title,body,blocks_json,entity_references_json,source_keys_json,source_video_ids_json,media_json,retire,state,approved_at) " +
    "VALUES(?,?,1,?,?,?,?,?,?,?,'[]',0,'approved',CURRENT_TIMESTAMP)"
  );
  const insertPlacement = db.prepare("INSERT INTO narrative_section_chapters(section_key,chapter_key,position) VALUES(?,?,?)");
  db.exec("BEGIN IMMEDIATE");
  try {
    const runId = Number(db.prepare(
      "INSERT INTO narrative_runs(state,baseline_run_id,universe_fingerprint,input_fingerprint,input_json,model,applied_at) VALUES('applied',?,?,?,?,?,CURRENT_TIMESTAMP)"
    ).run(pre.general.id, pre.pending.universeFingerprint, fingerprint, JSON.stringify({
      scope: "video-editorial-v1", generalSourceBaselineRunId: pre.general.id,
      sourceVideoIds: items.map(x => x.vid), sourceFingerprint: fingerprint,
      outstandingUniverseChanges: 3930,
      auditStatus: "independently-audited-pass",
    }), model).lastInsertRowid);
    db.prepare("INSERT INTO narrative_run_sources(run_id,source_type,source_key,change_kind,is_current,source_fingerprint,source_video_ids_json,snapshot_json) " +
      "SELECT ?,source_type,source_key,change_kind,is_current,source_fingerprint,source_video_ids_json,snapshot_json " +
      "FROM narrative_run_sources WHERE run_id=?").run(runId, pre.general.id);
    const upsert = db.prepare(
      "INSERT INTO narrative_run_sources(run_id,source_type,source_key,change_kind,is_current,source_fingerprint,source_video_ids_json,snapshot_json) VALUES(?,?,?,'unchanged',1,?,?,?) " +
      "ON CONFLICT(run_id,source_type,source_key) DO UPDATE SET source_fingerprint=excluded.source_fingerprint,source_video_ids_json=excluded.source_video_ids_json,snapshot_json=excluded.snapshot_json,is_current=1"
    );
    const unique = new Map(items.flatMap(i => i.sources).map(s => [s.sourceKey, s]));
    for (const source of unique.values()) {
      upsert.run(runId, source.sourceType, source.sourceKey, source.fingerprint,
        JSON.stringify(source.sourceVideoIds), JSON.stringify(source.snapshot));
    }
    let refs = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i], sourceMap = new Map(item.sources.map(s => [s.sourceKey, s]));
      const sourceKeys = [...sourceMap.keys()];
      const normalizedBody = trim(item.draft.body).split(/\n\s*\n/).map(p => p.trim()).join("\n\n");
      const blocks = structured.normalizeBlocks(candidateBlocks(normalizedBody, item.sources), {
        entityLookup: key => sourceMap.get(key), sourceKeys: new Set(sourceKeys),
      });
      const body = structured.plainTextFromBlocks(blocks);
      assert.equal(body, normalizedBody, "Structured block conversion changed prose for " + item.vid);
      const references = structured.entityReferencesFromBlocks(blocks, key => sourceMap.get(key));
      refs += references.length;
      insertSection.run(item.decision.sectionKey);
      const info = insertRevision.run(
        item.decision.sectionKey, runId, pre.before.bookCount+i,
        item.draft.title, body, JSON.stringify(blocks), JSON.stringify(references),
        JSON.stringify(sourceKeys), JSON.stringify([item.vid])
      );
      db.prepare("UPDATE narrative_sections SET current_revision_id=? WHERE key=?")
        .run(Number(info.lastInsertRowid), item.decision.sectionKey);
      insertPlacement.run(item.decision.sectionKey, chapterKey, pre.lastPosition+i+1);
    }
    const pack = publication.buildPublicationV2(db, { sourceOnly: true });
    languages.sync(db, pack.snapshot);
    for (const item of items) {
      const s = languages.source(db, "section", item.decision.sectionKey);
      assert(s, "Missing TR source");
      const previous = languages.variants(db, "section", item.decision.sectionKey)?.variants?.tr;
      assert(!previous, "New story must not already have a TR variant");
      const v = languages.save(db, {
        kind: "section", id: item.decision.sectionKey, language: "tr",
        sourceHash: s.source_hash, revision: 0, approved: true,
        data: JSON.parse(s.data_json)
      });
      assert(v.variants.tr.state === "approved" && !v.variants.tr.stale);
    }
    const after = originalSnapshot(db);
    assert.equal(after.bookCount, pre.before.bookCount+10);
    assert.deepEqual(after.book.slice(0, pre.before.book.length), pre.before.book,
      "Approved previous book section changed");
    assert.deepEqual(after.variants.filter(row => pre.before.variants.some(old => old.id === row.id)), pre.before.variants,
      "Existing publication language variants unexpectedly changed");
    const pending = narrative.buildInput(db);
    assert.equal(pending.baselineRunId, pre.general.id, "Scoped run consumed the general source baseline");
    assert.equal(pending.changes.length, 3930, "Scoped run incorrectly consumed pending source changes");
    assert.equal(pending.removed.length, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_section_revisions r JOIN narrative_sections s ON s.current_revision_id=r.id WHERE s.state='active'").get().n, 115);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
    db.exec("COMMIT");
    return { ok: true, runId, sectionsBefore: 105, sectionsAfter: 115,
      sourceVideoIds: items.map(x => x.vid), inlineReferences: refs,
      sourceDifferencesBefore: 3930, sourceDifferencesAfter: pending.changes.length };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function main() {
  const args = argumentsFromCli();
  const items = validateSourceFiles();
  const db = new DatabaseSync(args.dbFile);
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=10000");
  try {
    const pre = prepare(db, items);
    console.log("IMPORT_READY", JSON.stringify({
      db: args.dbFile, apply: args.apply, live: args.live,
      selectedVideoCount: items.length,
      originalChapters: pre.before.bookCount,
      targetChapter: chapterKey, startPosition: pre.lastPosition+1,
      pendingUniverseChanges: pre.pending.changes.length,
      matchedSourceNodeCounts: items.map(x => [x.vid,x.sources.length]),
    }));
    if (args.apply) console.log("IMPORT_RESULT", JSON.stringify(apply(db, items, pre)));
  } finally {
    db.close();
  }
}
main();
