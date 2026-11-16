"use strict";
const TABLE = "narrative_invitation_numbers";

function ensureSchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS narrative_invitation_numbers (" +
    "section_key TEXT PRIMARY KEY REFERENCES narrative_sections(key) ON DELETE CASCADE," +
    "series_key TEXT NOT NULL REFERENCES narrative_series(key) ON DELETE CASCADE," +
    "invitation_number INTEGER NOT NULL CHECK(invitation_number BETWEEN 1 AND 999)," +
    "source_video_id TEXT NOT NULL," +
    "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
    "UNIQUE(series_key,invitation_number)) STRICT");
}
function validAssociation(db, sectionKey, seriesKey) {
  return db.prepare("SELECT r.source_video_ids_json AS sourceIds FROM narrative_sections s " +
    "JOIN narrative_section_revisions r ON r.id=s.current_revision_id " +
    "JOIN narrative_section_chapters sc ON sc.section_key=s.key " +
    "JOIN narrative_chapters ch ON ch.key=sc.chapter_key " +
    "WHERE s.key=? AND s.state='active' AND r.state IN ('approved','published') AND ch.series_key=?")
    .get(sectionKey, seriesKey);
}
function get(db) {
  ensureSchema(db);
  const rows = db.prepare("SELECT n.section_key AS sectionKey, n.series_key AS seriesKey, " +
    "n.invitation_number AS number, n.source_video_id AS sourceVideoId " +
    "FROM " + TABLE + " n ORDER BY n.series_key,n.invitation_number").all();
  return rows.filter(row => {
    const match = validAssociation(db, row.sectionKey, row.seriesKey);
    if (!match) return false;
    let ids;
    try { ids = JSON.parse(match.sourceIds); } catch { return false; }
    return Array.isArray(ids) && ids.includes(row.sourceVideoId);
  });
}
function save(db, input) {
  ensureSchema(db);
  const sectionKey = String(input?.sectionKey ?? "").trim();
  const number = input?.number === null || input?.number === "" || input?.number === undefined
    ? null : Number(input.number);
  if (!sectionKey || sectionKey.length > 220) throw new Error("Geçerli anlatı kaydı gerekli.");
  if (number === null) {
    db.prepare("DELETE FROM " + TABLE + " WHERE section_key=?").run(sectionKey);
    return { sectionKey, number: null };
  }
  if (!Number.isSafeInteger(number) || number < 1 || number > 999) {
    throw new Error("Davet numarası 1 ile 999 arasında tam sayı olmalı.");
  }
  const seriesKey = String(input?.seriesKey ?? "").trim();
  const sourceVideoId = String(input?.sourceVideoId ?? "").trim();
  const linked = validAssociation(db, sectionKey, seriesKey);
  if (!linked) throw new Error("Davet numarası yalnız onaylı ve konusuna yerleştirilmiş bir anlatıya atanabilir.");
  let videoIds;
  try { videoIds = JSON.parse(linked.sourceIds); } catch { videoIds = []; }
  if (!videoIds.includes(sourceVideoId)) throw new Error("Davet numarası yalnız bu anlatının kaynak videolarından biriyle doğrulanabilir.");
  const other = db.prepare("SELECT section_key AS sectionKey FROM " + TABLE +
    " WHERE series_key=? AND invitation_number=? AND section_key<>?")
    .get(seriesKey, number, sectionKey);
  if (other) throw new Error("Bu konuda " + number + ". davet başka anlatıda kayıtlı. Önce ilgili kayıt kontrol edilmeli.");
  const section = db.prepare("SELECT r.title FROM narrative_sections s JOIN narrative_section_revisions r " +
    "ON r.id=s.current_revision_id WHERE s.key=?").get(sectionKey);
  const prefixed = String(section?.title ?? "").match(/^\s*(\d{1,3})\s*\.\s*davet/iu);
  if (prefixed && Number(prefixed[1]) !== number) {
    throw new Error("Başlıktaki mevcut davet numarası (" + prefixed[1] + ") ile seçilen numara çelişiyor.");
  }
  db.prepare("INSERT INTO " + TABLE + "(section_key,series_key,invitation_number,source_video_id) VALUES(?,?,?,?) " +
    "ON CONFLICT(section_key) DO UPDATE SET series_key=excluded.series_key," +
    "invitation_number=excluded.invitation_number,source_video_id=excluded.source_video_id,updated_at=CURRENT_TIMESTAMP")
    .run(sectionKey, seriesKey, number, sourceVideoId);
  return { sectionKey, seriesKey, number, sourceVideoId };
}
module.exports = { ensureSchema, get, save };
