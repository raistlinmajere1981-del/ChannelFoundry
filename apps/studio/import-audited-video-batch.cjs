"use strict";
/**
 * Import any explicitly planned batch of up to ten source-audited VIDEO chapters. Safeguards:
 * - no overwrite/retirement of existing approved chapters;
 * - no changes to Universe nodes/relations or general narrative baseline;
 * - all draft/audit/source fingerprints must be current;
 * - one SQLite transaction + full integrity and provenance checks;
 * - by default does not change any DB.
 * - routine local commit uses ONLY the canonical Studio DB with automatic,
 *   integrity-verified pre-import backup + transactional import/rollback.
 * - optional /tmp copy support remains for exceptional migration investigations.
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
  const autoBackup = process.argv.includes("--backup-auto");
  assert(!(autoBackup && backup), "Choose --backup-auto or --backup, not both");
  const planFile = path.resolve(get("--plan") || "__missing_plan__");
  const packetFile = path.resolve(get("--packet") || "__missing_packet__");
  const draftDir = path.resolve(get("--draft-dir") || path.join(coverage, "drafts"));
  assert(draftDir.startsWith(coverage + path.sep) && fs.statSync(draftDir).isDirectory(),
    "--draft-dir must name a local private drafts directory");
  assert(planFile.startsWith(coverage + path.sep) && fs.existsSync(planFile),
    "--plan must name an existing local coverage plan");
  assert(packetFile.startsWith(coverage + path.sep) && fs.existsSync(packetFile),
    "--packet must name the exact source packet from the local coverage directory");
  assert(!live || dbFile === liveDb, "--live is only valid for the real Studio SQLite");
  if (apply && dbFile === liveDb) {
    assert(live, "Canonical database is protected; --live required");
    assert(autoBackup || (backup && fs.existsSync(backup) && fs.statSync(backup).size > 1000000),
      "Use --backup-auto for live import or supply a fresh verified --backup");
    if (backup) assert(path.resolve(backup) !== dbFile, "Backup cannot be live database");
  }
  if (apply && dbFile !== liveDb) assert(dbFile.startsWith("/tmp/"), "--apply is only allowed on /tmp copies");
  return { apply, live, dbFile, planFile, packetFile, draftDir, backup, autoBackup };
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

function validateSourceFiles(args) {
  execFileSync("python3", ["-B", "apps/studio/birdesengor_book_coverage.py", "--check-snapshot"],
    { cwd: root, stdio: "pipe", timeout: 40000 });
  const plan = parse(args.planFile);
  const packet = parse(args.packetFile);
  assert.equal(plan.schemaVersion, 1);
  assert(Number.isInteger(plan.sourceCount) && plan.sourceCount >= 1 && plan.sourceCount <= 10);
  assert.equal(plan.approval, "source_audited_pending_import");
  assert.equal(plan.decisions.length, plan.sourceCount);
  assert.equal(packet.sources.length, plan.sourceCount);
  assert.equal(packet.batch.index, plan.batch);
  assert(Number.isInteger(plan.expectedBefore) && plan.expectedBefore >= 105);
  assert(Number.isInteger(plan.expectedUniverseChanges) && plan.expectedUniverseChanges >= 0);
  const prepend = plan.prependChapterKeys || [];
  assert(Array.isArray(prepend), "prependChapterKeys must be an array");
  assert.equal(new Set(prepend).size, prepend.length, "Duplicate prepend chapter");
  for (const key of prepend) {
    assert(typeof key === "string" && key.length > 0, "Invalid prepend chapter key");
    assert(plan.decisions.some(d => d.targetChapterKey === key),
      "Prepend chapter must be represented in the source batch");
  }
  const insertBefore = plan.insertBeforeSections || {};
  assert(insertBefore && typeof insertBefore === "object" && !Array.isArray(insertBefore));
  assert(Object.keys(insertBefore).length <= 3, "Too many insertion anchors");
  for (const [chapter, section] of Object.entries(insertBefore)) {
    assert(/^topic-chapter-[a-z0-9-]+$/.test(chapter), "Invalid anchored chapter");
    assert(typeof section === "string" && section.length > 8, "Invalid anchor section key");
    assert(!prepend.includes(chapter), "Cannot prepend and insert-before in the same chapter");
    assert(plan.decisions.some(d => d.targetChapterKey === chapter),
      "Insertion anchor must have at least one new source for chapter");
  }
  const newSeries = Array.isArray(plan.newSeries) ? plan.newSeries : [];
  assert(newSeries.length <= 3, "An editorial batch may introduce at most 3 new series");
  const seriesKeys = new Set();
  const chapterKeys = new Set();
  for (const series of newSeries) {
    assert(series && typeof series === "object");
    assert(/^topic-series-[a-z0-9-]{3,80}$/.test(series.key), "Invalid new series key");
    assert(typeof series.title === "string" && series.title.trim().length >= 3 &&
      series.title.length <= 120, "Invalid new series title");
    assert(typeof series.description === "string" && series.description.length <= 1200,
      "Invalid series description");
    assert(Number.isInteger(series.position) && series.position >= 0 && series.position < 10000,
      "Invalid new series position");
    assert(!seriesKeys.has(series.key), "Duplicate new series key");
    seriesKeys.add(series.key);
    assert(Array.isArray(series.chapters) && series.chapters.length >= 1 &&
      series.chapters.length <= 4, "Invalid chapters in new series");
    for (const chapter of series.chapters) {
      assert(/^topic-chapter-[a-z0-9-]{3,80}$/.test(chapter.key), "Invalid chapter key");
      assert(typeof chapter.title === "string" && chapter.title.trim().length >= 3 &&
        chapter.title.length <= 120, "Invalid chapter title");
      assert(Number.isInteger(chapter.position) && chapter.position >= 0 &&
        chapter.position < 10000, "Invalid chapter position");
      assert(!chapterKeys.has(chapter.key), "Duplicate new chapter key");
      assert(plan.decisions.some(x => x.targetChapterKey === chapter.key),
        "Created chapter must receive at least one video");
      chapterKeys.add(chapter.key);
    }
  }
  const seen = new Set();
  const items = [];
  for (let n = 0; n < plan.sourceCount; n++) {
    const decision = plan.decisions[n];
    const record = packet.sources[n];
    const vid = record.video.videoId;
    assert.equal(decision.videoId, vid);
    assert(!seen.has(vid), "Duplicate video identity");
    seen.add(vid);
    assert.equal(decision.decision, "new_scoped_section");
    assert(decision.targetChapterKey === null ||
      (typeof decision.targetChapterKey === "string" && decision.targetChapterKey.length > 0),
      "Each approved source must have an explicit chapter or a null independent position");
    assert.equal(decision.sectionKey, "narrative-section-video-" + vid);
    assert.equal(decision.sourceFingerprint, record.video.sourceFingerprint);
    const folder = args.draftDir;
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
    if (audit.reviewMethod === "assistant-source-review") {
      const evidence = path.join(folder, vid + ".review.evidence.json");
      assert(fs.existsSync(evidence), "Missing assistant source-review evidence for " + vid);
      const evidenceHash = sha(fs.readFileSync(evidence));
      assert.equal(audit.reviewEvidenceSha256, evidenceHash, "Assistant source review evidence stale");
      assert.equal(seal.reviewEvidenceSha256, evidenceHash, "Assistant evidence seal stale");
      assert.equal(seal.reviewMethod, "assistant-source-review");
    }
    assert(draft.body.length >= 600 && draft.body.length <= 22000);
    assert(draft.title.length >= 6 && draft.title.length <= 190);
    assert(draft.sourceAnchors.length >= 3 && draft.sourceAnchors.length <= 12);
    assert(draft.sourceAnchors.every(a => a && record.originalTranscript.includes(a)), "Invalid subtitle anchor");
    items.push({ vid, decision, draft });
  }
  return { items, plan, newSeries };
}

function originalSnapshot(db) {
  return {
    book: db.prepare("SELECT r.id,r.section_key,r.title,r.body,r.blocks_json,r.entity_references_json,r.source_keys_json,r.source_video_ids_json,r.state FROM narrative_section_revisions r JOIN narrative_sections s ON s.current_revision_id=r.id WHERE s.state='active' ORDER BY r.id").all(),
    variants: db.prepare("SELECT * FROM publication_language_variants WHERE kind='section' ORDER BY id,language").all(),
    bookCount: db.prepare("SELECT COUNT(*) AS count FROM narrative_sections WHERE state='active'").get().count,
    originalSeries: db.prepare("SELECT * FROM narrative_series ORDER BY key").all(),
    originalChapters: db.prepare("SELECT * FROM narrative_chapters ORDER BY key").all(),
  };
}

function prepare(db, items, plan) {
  narrative.ensureSchema(db);
  const newSeries = Array.isArray(plan.newSeries) ? plan.newSeries : [];
  const proposedChapters = new Set(newSeries.flatMap(series => series.chapters.map(c => c.key)));
  for (const series of newSeries) {
    assert(!db.prepare("SELECT 1 FROM narrative_series WHERE key=?").get(series.key),
      "New series already exists; refuse to overwrite: " + series.key);
    for (const chapter of series.chapters) {
      assert(!db.prepare("SELECT 1 FROM narrative_chapters WHERE key=?").get(chapter.key),
        "New chapter already exists; refuse to overwrite: " + chapter.key);
    }
  }
  for (const target of new Set(items.map(x => x.decision.targetChapterKey).filter(Boolean))) {
    assert(proposedChapters.has(target) || db.prepare("SELECT 1 FROM narrative_chapters WHERE key=?").get(target),
      "Target chapter absent: " + target);
  }
  const before = originalSnapshot(db);
  assert.equal(before.bookCount, plan.expectedBefore, "Book changed since editorial plan");
  const general = db.prepare("SELECT id FROM narrative_runs WHERE state='applied' AND model NOT LIKE 'invitation-editorial:%' AND model NOT LIKE 'video-editorial:%' ORDER BY id DESC LIMIT 1").get();
  assert(general, "General narrative baseline missing");
  const pending = narrative.buildInput(db);
  assert.equal(pending.baselineRunId, general.id, "Baseline selection mismatch");
  assert.equal(pending.changes.length, plan.expectedUniverseChanges, "General source baseline changed since planning");
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
  const positions = new Map();
  const insertBeforeGroups = new Map();
  for (const [chapter, section] of Object.entries(plan.insertBeforeSections || {})) {
    const row = db.prepare(
      "SELECT position FROM narrative_section_chapters WHERE chapter_key=? AND section_key=?"
    ).get(chapter, section);
    assert(row && Number.isInteger(row.position),
      "Target insertion anchor not found in its chapter: " + section);
    const shift = items.filter(item => item.decision.targetChapterKey === chapter).length;
    assert(shift > 0);
    insertBeforeGroups.set(chapter, { shift, position: row.position, section });
  }
  const prependGroups = new Map();
  for (const key of plan.prependChapterKeys || []) {
    prependGroups.set(key, items.filter(item => item.decision.targetChapterKey === key).length);
  }
  for (const target of new Set(items.map(x => x.decision.targetChapterKey))) {
    const sql = target
      ? "SELECT COALESCE(MAX(position),-1) AS m FROM narrative_section_chapters WHERE chapter_key=?"
      : "SELECT COALESCE(MAX(position),-1) AS m FROM narrative_independent_order";
    positions.set(target, prependGroups.has(target)
      ? -1
      : insertBeforeGroups.has(target)
        ? insertBeforeGroups.get(target).position - 1
        : db.prepare(sql).get(...(target ? [target] : [])).m);
  }
  return { before, general, pending, positions, prependGroups, insertBeforeGroups, newSeries };
}

function apply(db, items, pre) {
  const fingerprint = sha(JSON.stringify(items.map(item => ({
    videoId: item.vid, sourceFingerprint: item.decision.sourceFingerprint,
    draftSha256: item.decision.draftSha256, auditSha256: item.decision.auditSha256,
    chapterKey: item.decision.targetChapterKey,
  }))));
  const insertSection = db.prepare("INSERT INTO narrative_sections(key,state) VALUES(?,'active')");
  const insertRevision = db.prepare(
    "INSERT INTO narrative_section_revisions(section_key,run_id,revision_no,position,title,body,blocks_json,entity_references_json,source_keys_json,source_video_ids_json,media_json,retire,state,approved_at) " +
    "VALUES(?,?,1,?,?,?,?,?,?,?,'[]',0,'approved',CURRENT_TIMESTAMP)"
  );
  const insertPlacement = db.prepare("INSERT INTO narrative_section_chapters(section_key,chapter_key,position) VALUES(?,?,?)");
  const insertIndependent = db.prepare("INSERT INTO narrative_independent_order(section_key,position) VALUES(?,?)");
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const series of pre.newSeries) {
      db.prepare("INSERT INTO narrative_series(key,title,description,position) VALUES(?,?,?,?)")
        .run(series.key, series.title.trim(), series.description.trim(), series.position);
      for (const chapter of series.chapters) {
        db.prepare("INSERT INTO narrative_chapters(key,series_key,title,number_label,position) VALUES(?,?,?,'',?)")
          .run(chapter.key, series.key, chapter.title.trim(), chapter.position);
      }
    }
    // Shift only a reviewed book series' placement positions. Existing
    // narrative text and source records remain untouched.
    for (const [chapter, shift] of pre.prependGroups) {
      assert(shift > 0);
      db.prepare("UPDATE narrative_section_chapters SET position=position+? WHERE chapter_key=?")
        .run(shift, chapter);
    }
    for (const [chapter, anchor] of pre.insertBeforeGroups) {
      db.prepare("UPDATE narrative_section_chapters SET position=position+? WHERE chapter_key=? AND position>=?")
        .run(anchor.shift, chapter, anchor.position);
    }
    const runId = Number(db.prepare(
      "INSERT INTO narrative_runs(state,baseline_run_id,universe_fingerprint,input_fingerprint,input_json,model,applied_at) VALUES('applied',?,?,?,?,?,CURRENT_TIMESTAMP)"
    ).run(pre.general.id, pre.pending.universeFingerprint, fingerprint, JSON.stringify({
      scope: "video-editorial-v1", generalSourceBaselineRunId: pre.general.id,
      sourceVideoIds: items.map(x => x.vid), sourceFingerprint: fingerprint,
      outstandingUniverseChanges: pre.pending.changes.length,
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
      const target = item.decision.targetChapterKey;
      const position = pre.positions.get(target) + 1;
      pre.positions.set(target, position);
      if (target) insertPlacement.run(item.decision.sectionKey, target, position);
      else insertIndependent.run(item.decision.sectionKey, position);
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
    assert.equal(after.bookCount, pre.before.bookCount+items.length);
    assert.deepEqual(after.book.slice(0, pre.before.book.length), pre.before.book,
      "Approved previous book section changed");
    assert.deepEqual(after.variants.filter(row => pre.before.variants.some(old => old.id === row.id)), pre.before.variants,
      "Existing publication language variants unexpectedly changed");
    assert.deepEqual(after.originalSeries.filter(row => pre.before.originalSeries.some(old => old.key === row.key)),
      pre.before.originalSeries, "Old series changed unexpectedly");
    assert.deepEqual(after.originalChapters.filter(row => pre.before.originalChapters.some(old => old.key === row.key)),
      pre.before.originalChapters, "Old chapter metadata changed unexpectedly");
    const pending = narrative.buildInput(db);
    assert.equal(pending.baselineRunId, pre.general.id, "Scoped run consumed the general source baseline");
    assert.equal(pending.changes.length, pre.pending.changes.length, "Scoped run consumed pending source changes");
    assert.equal(pending.removed.length, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_section_revisions r JOIN narrative_sections s ON s.current_revision_id=r.id WHERE s.state='active'").get().n, after.bookCount);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
    db.exec("COMMIT");
    return { ok: true, runId, sectionsBefore: pre.before.bookCount, sectionsAfter: after.bookCount,
      sourceVideoIds: items.map(x => x.vid), inlineReferences: refs,
      placements: items.map(x => [x.vid, x.decision.targetChapterKey]),
      sourceDifferencesBefore: pre.pending.changes.length,
      sourceDifferencesAfter: pending.changes.length };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function liveBackup(args, expectedSections, db) {
  const version = db.prepare("PRAGMA data_version").get().data_version;
  let backupPath = path.resolve(args.backup || "");
  if (args.autoBackup) {
    const stamp = new Date().toISOString().replace(/[.:]/g, "-");
    backupPath = path.join(data, "backups", "before-book-import-" + stamp + ".sqlite");
    const output = execFileSync("python3", [
      "-B", "apps/studio/birdesengor_book_sqlite_backup.py",
      "--out", backupPath, "--expected-sections", String(expectedSections),
    ], { cwd: root, encoding: "utf8", timeout: 90000 });
    console.log(output.trim());
  } else {
    assert(fs.statSync(backupPath).mtimeMs > Date.now() - 15 * 60 * 1000,
      "Existing backup must be freshly created (within 15 minutes); prefer --backup-auto");
    const verification = execFileSync("python3", [
      "-B", "apps/studio/birdesengor_book_sqlite_backup.py",
      "--verify-existing", backupPath,
      "--expected-sections", String(expectedSections),
    ], { cwd: root, encoding: "utf8", timeout: 90000 });
    console.log(verification.trim());
  }
  assert(db.prepare("PRAGMA data_version").get().data_version === version,
    "Studio changed while backup was being created; refuse to apply stale snapshot");
  console.log("LIVE_IMPORT_PROTECTED", JSON.stringify({ singleWorkingDatabase: args.dbFile, backupPath }));
}

function main() {
  const args = argumentsFromCli();
  const { items, plan } = validateSourceFiles(args);
  // A dry run is a real read-only connection: even a future migration in
  // ensureSchema() cannot accidentally mutate the canonical working copy.
  const db = new DatabaseSync(args.dbFile, { readOnly: !args.apply });
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("PRAGMA busy_timeout=10000");
  try {
    // Protect the original DB BEFORE any ensureSchema() or other preparation
    // code can potentially perform an implicit schema migration.
    if (args.apply && args.live) liveBackup(args, plan.expectedBefore, db);
    const pre = prepare(db, items, plan);
    console.log("IMPORT_READY", JSON.stringify({
      db: args.dbFile, apply: args.apply, live: args.live,
      selectedVideoCount: items.length,
      originalChapters: pre.before.bookCount,
      plannedPlacements: items.map(x => [x.vid, x.decision.targetChapterKey]),
      prependChapterKeys: [...pre.prependGroups.keys()],
      newSeriesKeys: pre.newSeries.map(series => series.key),
      pendingUniverseChanges: pre.pending.changes.length,
      matchedSourceNodeCounts: items.map(x => [x.vid,x.sources.length]),
    }));
    if (args.apply) {
      console.log("IMPORT_RESULT", JSON.stringify(apply(db, items, pre)));
    }
  } finally {
    db.close();
  }
}
main();
