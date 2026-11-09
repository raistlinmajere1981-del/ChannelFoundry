"use strict";
const crypto = require("node:crypto");
const narrativeStore = require("./narrative-store.cjs");
const channelProjects = require("./channel-projects.cjs");

const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const order = (value) => {
  const n = Number(value ?? 0);
  if (!Number.isSafeInteger(n) || n < 0 || n > 1000000) throw new Error("Sıra sıfır veya pozitif bir tam sayı olmalı.");
  return n;
};
const generateId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function ensureSchema(db) {
  narrativeStore.ensureSchema(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS narrative_series (
      key TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
    CREATE TABLE IF NOT EXISTS narrative_chapters (
      key TEXT PRIMARY KEY,
      series_key TEXT NOT NULL REFERENCES narrative_series(key) ON DELETE RESTRICT,
      title TEXT NOT NULL, number_label TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_narrative_chapters_series
      ON narrative_chapters(series_key, position, key);
    CREATE TABLE IF NOT EXISTS narrative_section_chapters (
      section_key TEXT PRIMARY KEY REFERENCES narrative_sections(key) ON DELETE CASCADE,
      chapter_key TEXT NOT NULL REFERENCES narrative_chapters(key) ON DELETE RESTRICT,
      position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_narrative_section_chapters_chapter
      ON narrative_section_chapters(chapter_key, position, section_key);
    CREATE TABLE IF NOT EXISTS narrative_independent_order (
      section_key TEXT PRIMARY KEY REFERENCES narrative_sections(key) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0 CHECK(position>=0)
    ) STRICT;
  `);
}

function profile(db) {
  return channelProjects.narratorForDatabase(db);
}

function seriesList(db) {
  ensureSchema(db);
  return db.prepare("SELECT key, title, description, position FROM narrative_series ORDER BY position, key").all();
}

function chapterList(db) {
  ensureSchema(db);
  return db.prepare(`SELECT key, series_key AS seriesKey, title, number_label AS numberLabel, position
    FROM narrative_chapters ORDER BY series_key, position, key`).all();
}

function saveSeries(db, input) {
  ensureSchema(db);
  if (!input || typeof input !== "object") throw new Error("Geçerli dizi verisi gerekli.");
  const title = clean(input.title, 220);
  if (!title) throw new Error("Dizi başlığı boş olamaz.");
  const key = clean(input.key, 130) || generateId("series");
  const existing = db.prepare("SELECT position FROM narrative_series WHERE key=?").get(key);
  if (input.key && !existing) throw new Error("Bilinmeyen dizi kimliği.");
  const values = [title, clean(input.description, 1200), order(input.position ?? existing?.position)];
  if (existing) db.prepare("UPDATE narrative_series SET title=?, description=?, position=? WHERE key=?").run(...values, key);
  else db.prepare("INSERT INTO narrative_series(key,title,description,position) VALUES(?,?,?,?)").run(key, ...values);
  return seriesList(db).find((entry) => entry.key === key);
}

function saveChapter(db, input) {
  ensureSchema(db);
  if (!input || typeof input !== "object") throw new Error("Geçerli bölüm verisi gerekli.");
  const title = clean(input.title, 220);
  const seriesKey = clean(input.seriesKey, 130);
  if (!title) throw new Error("Bölüm başlığı boş olamaz.");
  if (!db.prepare("SELECT position FROM narrative_series WHERE key=?").get(seriesKey)) throw new Error("Bölüm dizisi bulunamadı.");
  const key = clean(input.key, 130) || generateId("chapter");
  const existing = db.prepare("SELECT position FROM narrative_chapters WHERE key=?").get(key);
  if (input.key && !existing) throw new Error("Bilinmeyen bölüm kimliği.");
  const values = [seriesKey, title, clean(input.numberLabel, 90), order(input.position ?? existing?.position)];
  if (existing) db.prepare("UPDATE narrative_chapters SET series_key=?,title=?,number_label=?,position=? WHERE key=?").run(...values, key);
  else db.prepare("INSERT INTO narrative_chapters(key,series_key,title,number_label,position) VALUES(?,?,?,?,?)").run(key, ...values);
  return chapterList(db).find((entry) => entry.key === key);
}

function placeSection(db, input) {
  ensureSchema(db);
  const sectionKey = clean(input?.sectionKey, 220);
  const chapterKey = clean(input?.chapterKey, 130);
  if (!db.prepare("SELECT 1 FROM narrative_sections WHERE key=? AND state='active' AND current_revision_id IS NOT NULL").get(sectionKey)) {
    throw new Error("Yalnız onaylanmış aktif anlatı yerleştirilebilir.");
  }
  if (!chapterKey) {
    db.prepare("DELETE FROM narrative_section_chapters WHERE section_key=?").run(sectionKey);
    return { sectionKey, chapterKey: null };
  }
  if (!db.prepare("SELECT position FROM narrative_chapters WHERE key=?").get(chapterKey)) throw new Error("Hedef bölüm bulunamadı.");
  const existing = db.prepare("SELECT position FROM narrative_section_chapters WHERE section_key=?").get(sectionKey);
  const position = order(input.position ?? existing?.position);
  db.prepare(`INSERT INTO narrative_section_chapters(section_key, chapter_key, position)
    VALUES(?,?,?) ON CONFLICT(section_key) DO UPDATE SET
    chapter_key=excluded.chapter_key, position=excluded.position`).run(sectionKey, chapterKey, position);
  return { sectionKey, chapterKey, position };
}

function assignments(db) {
  ensureSchema(db);
  return db.prepare(`SELECT section_key AS sectionKey, chapter_key AS chapterKey, position
    FROM narrative_section_chapters ORDER BY chapter_key, position, section_key`).all();
}

// Only confirmed, active memories may appear in the editor's movable tree.
// A separate rank is necessary for standalone memories: chapter assignments
// cannot express their ordering, and the publication must retain it.
function independentKeys(db) {
  ensureSchema(db);
  const assigned = new Set(assignments(db).map(item => item.sectionKey));
  const ranks = new Map(db.prepare("SELECT section_key AS sectionKey, position FROM narrative_independent_order").all()
    .map(item => [item.sectionKey, item.position]));
  return narrativeStore.narrativeMemory(db)
    .filter(section => !assigned.has(section.sectionKey))
    .sort((a, b) => {
      const aa = ranks.get(a.sectionKey), bb = ranks.get(b.sectionKey);
      if (aa !== undefined && bb !== undefined) return aa - bb || a.sectionKey.localeCompare(b.sectionKey);
      if (aa !== undefined) return -1;
      if (bb !== undefined) return 1;
      return a.position - b.position || a.sectionKey.localeCompare(b.sectionKey);
    }).map(section => section.sectionKey);
}

function insertBefore(keys, key, beforeKey) {
  const ordered = keys.filter(item => item !== key);
  const index = beforeKey ? ordered.indexOf(beforeKey) : ordered.length;
  if (index < 0) throw new Error("Hedef öğe, taşınacak grubun içinde değil.");
  ordered.splice(index, 0, key);
  return ordered;
}

// One complete drag/drop = one SQLite transaction. Never partially update
// parent identities, chapter membership or independent reading order.
function moveNode(db, input) {
  ensureSchema(db);
  const kind = clean(input?.kind, 20);
  const key = clean(input?.key, 220);
  const beforeKey = clean(input?.beforeKey, 220);
  const parentKey = clean(input?.parentKey, 130);
  if (!['series', 'chapter', 'section'].includes(kind) || !key) throw new Error("Taşınacak kayıt belirtilmedi.");
  if (beforeKey === key) return status(db);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (kind === "series") {
      const rows = seriesList(db);
      if (!rows.some(item => item.key === key)) throw new Error("Dizi bulunamadı.");
      insertBefore(rows.map(item => item.key), key, beforeKey).forEach((id, index) => {
        db.prepare("UPDATE narrative_series SET position=? WHERE key=?").run(index, id);
      });
    } else if (kind === "chapter") {
      const chapters = chapterList(db);
      const selected = chapters.find(item => item.key === key);
      if (!selected) throw new Error("Alt bölüm bulunamadı.");
      if (!seriesList(db).some(item => item.key === parentKey)) throw new Error("Hedef dizi bulunamadı.");
      const oldParent = selected.seriesKey;
      const target = insertBefore(chapters.filter(item => item.seriesKey === parentKey).map(item => item.key), key, beforeKey);
      const prior = oldParent === parentKey ? [] : chapters.filter(item => item.seriesKey === oldParent && item.key !== key).map(item => item.key);
      target.forEach((id, index) => {
        db.prepare("UPDATE narrative_chapters SET series_key=?, position=? WHERE key=?").run(parentKey, index, id);
      });
      prior.forEach((id, index) => {
        db.prepare("UPDATE narrative_chapters SET position=? WHERE key=?").run(index, id);
      });
    } else {
      const memories = narrativeStore.narrativeMemory(db);
      if (!memories.some(item => item.sectionKey === key)) throw new Error("Yalnız aktif ve onaylı anı taşınabilir.");
      const chapters = chapterList(db);
      if (parentKey && !chapters.some(item => item.key === parentKey)) throw new Error("Hedef alt bölüm bulunamadı.");
      const links = assignments(db);
      const oldParent = links.find(item => item.sectionKey === key)?.chapterKey || "";
      const groupKeys = chapterKey => chapterKey
        ? links.filter(item => item.chapterKey === chapterKey).map(item => item.sectionKey)
        : independentKeys(db);
      const target = insertBefore(groupKeys(parentKey), key, beforeKey);
      const prior = oldParent === parentKey ? [] : groupKeys(oldParent).filter(id => id !== key);
      if (parentKey) {
        db.prepare(`INSERT INTO narrative_section_chapters(section_key,chapter_key,position)
          VALUES(?,?,0) ON CONFLICT(section_key) DO UPDATE SET chapter_key=excluded.chapter_key`).run(key, parentKey);
        db.prepare("DELETE FROM narrative_independent_order WHERE section_key=?").run(key);
      } else {
        db.prepare("DELETE FROM narrative_section_chapters WHERE section_key=?").run(key);
      }
      const writeGroup = (group, keys) => {
        if (group) keys.forEach((id, index) => db.prepare(
          "UPDATE narrative_section_chapters SET position=? WHERE section_key=? AND chapter_key=?").run(index, id, group));
        else keys.forEach((id, index) => db.prepare(`INSERT INTO narrative_independent_order(section_key,position)
          VALUES(?,?) ON CONFLICT(section_key) DO UPDATE SET position=excluded.position`).run(id, index));
      };
      writeGroup(parentKey, target);
      if (oldParent !== parentKey) writeGroup(oldParent, prior);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return status(db);
}

function status(db) {
  return { profile: profile(db), series: seriesList(db), chapters: chapterList(db),
    assignments: assignments(db), independentOrder: independentKeys(db) };
}

function publishedOutline(db, sections) {
  const all = status(db);
  const allowed = new Set((Array.isArray(sections) ? sections : []).map((s) => s.sectionId).filter(Boolean));
  const grouped = new Set();
  const byChapter = new Map();
  for (const chapter of all.chapters) byChapter.set(chapter.key, []);
  for (const link of all.assignments) {
    if (!allowed.has(link.sectionKey) || !byChapter.has(link.chapterKey)) continue;
    byChapter.get(link.chapterKey).push(link.sectionKey);
    grouped.add(link.sectionKey);
  }
  const series = all.series.map((entry) => ({
    ...entry,
    chapters: all.chapters.filter((ch) => ch.seriesKey === entry.key && byChapter.get(ch.key)?.length)
      .map(({ seriesKey, ...chapter }) => ({ ...chapter, sectionIds: byChapter.get(chapter.key) })),
  })).filter((entry) => entry.chapters.length > 0);
  return {
    narrator: { displayName: all.profile.displayName, mode: all.profile.mode },
    series,
    ungroupedSectionIds: [
      ...all.independentOrder.filter(id => allowed.has(id) && !grouped.has(id)),
      ...(Array.isArray(sections) ? sections : []).map(entry => entry.sectionId)
        .filter(id => id && !grouped.has(id) && !all.independentOrder.includes(id)),
    ],
  };
}

// Title-only suggestions are read-only. Stable video IDs are retained even when
// multiple uploads share a series/episode number. They are never publication input.
const titleKey = value => clean(value, 1000).toLocaleLowerCase('tr-TR').normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function titleSuggestions(videos, series = [], chapters = []) {
  const groups = new Map();
  for (const video of videos) {
    const title = clean(video.title, 1000);
    const episode = title.match(/(?:\b(\d{1,4})\s*[.)-]?\s*(davet|bölüm)|(?:davet|bölüm)\s*[#:.-]?\s*(\d{1,4}))/iu);
    if (!episode) continue;
    const number = Number(episode[1] || episode[3]);
    const known = series.filter(item => titleKey(title).includes(titleKey(item.title)))
      .sort((a,b) => b.title.length - a.title.length)[0];
    const prefix = title.slice(0, episode.index).replace(/[\s|:—–-]+$/u, '').trim();
    const seriesTitle = known?.title || prefix;
    if (titleKey(seriesTitle).length < 3) continue; // A bare number never identifies a series.
    const label = `${number}. ${episode[2]?.toLocaleLowerCase('tr-TR') === 'bölüm' || /^bölüm/iu.test(episode[0]) ? 'Bölüm' : 'Davet'}`;
    const key = `${titleKey(seriesTitle)}:${titleKey(label)}`;
    if (!groups.has(key)) {
      const existing = chapters.find(ch => ch.seriesKey === known?.key &&
        (titleKey(ch.numberLabel) === titleKey(label) || titleKey(ch.title) === titleKey(label)));
      groups.set(key, { key, seriesKey: known?.key ?? null, seriesTitle,
        chapterKey: existing?.key ?? null, chapterTitle: existing?.title ?? label,
        numberLabel: label, videos: [] });
    }
    const group = groups.get(key);
    if (!group.videos.some(item => item.videoId === video.videoId)) group.videos.push({ videoId: video.videoId, title });
  }
  return [...groups.values()];
}

function suggestions(db) {
  ensureSchema(db);
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='youtube_videos'").get()) return [];
  // Query the current selection without changing channel state or importing any data.
  const videos = db.prepare(`SELECT v.video_id AS videoId, v.title FROM youtube_videos v
    JOIN youtube_channels c ON c.id=v.channel_id WHERE c.is_active=1
    ORDER BY v.published_at, v.video_id`).all();
  return titleSuggestions(videos, seriesList(db), chapterList(db));
}

module.exports = {
  ensureSchema, profile, seriesList, chapterList, saveSeries, saveChapter,
  placeSection, assignments, independentKeys, moveNode, status, publishedOutline, titleSuggestions, suggestions,
};
