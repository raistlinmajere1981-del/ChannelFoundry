'use strict';
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const numbers = require('./narrative-invitation-numbers.cjs');

const db = new DatabaseSync(':memory:');
try {
  db.exec("PRAGMA foreign_keys=ON");
  db.exec("CREATE TABLE narrative_sections(key TEXT PRIMARY KEY,current_revision_id INTEGER,state TEXT NOT NULL) STRICT");
  db.exec("CREATE TABLE narrative_section_revisions(id INTEGER PRIMARY KEY,title TEXT NOT NULL,state TEXT NOT NULL,source_video_ids_json TEXT NOT NULL) STRICT");
  db.exec("CREATE TABLE narrative_series(key TEXT PRIMARY KEY) STRICT");
  db.exec("CREATE TABLE narrative_chapters(key TEXT PRIMARY KEY,series_key TEXT NOT NULL REFERENCES narrative_series(key)) STRICT");
  db.exec("CREATE TABLE narrative_section_chapters(section_key TEXT PRIMARY KEY REFERENCES narrative_sections(key),chapter_key TEXT NOT NULL REFERENCES narrative_chapters(key)) STRICT");
  db.exec("INSERT INTO narrative_series VALUES ('dugum'),('bledum')");
  db.exec("INSERT INTO narrative_chapters VALUES ('ch1','dugum'),('ch2','bledum')");
  db.exec("INSERT INTO narrative_section_revisions VALUES(1,'54. Davet — Eski Kayıt','approved','[\"vid54\"]'),(2,'Yeni davet ve soru','approved','[\"vid55\"]'),(3,'Bledum daveti','published','[\"bledum1\"]')");
  db.exec("INSERT INTO narrative_sections VALUES('sec1',1,'active'),('sec2',2,'active'),('sec3',3,'active')");
  db.exec("INSERT INTO narrative_section_chapters VALUES('sec1','ch1'),('sec2','ch1'),('sec3','ch2')");
  assert.deepEqual(numbers.get(db),[]);
  assert.deepEqual(numbers.save(db,{sectionKey:'sec1',seriesKey:'dugum',number:54,sourceVideoId:'vid54'}),
    {sectionKey:'sec1',seriesKey:'dugum',number:54,sourceVideoId:'vid54'});
  assert.equal(numbers.get(db).length,1);
  assert.throws(() => numbers.save(db,{sectionKey:'sec2',seriesKey:'dugum',number:54,sourceVideoId:'vid55'}),/başka anlatıda/);
  assert.throws(() => numbers.save(db,{sectionKey:'sec2',seriesKey:'dugum',number:55,sourceVideoId:'vid54'}),/kaynak videolarından/);
  assert.throws(() => numbers.save(db,{sectionKey:'sec2',seriesKey:'bledum',number:55,sourceVideoId:'vid55'}),/konusuna yerleştirilmiş/);
  assert.throws(() => numbers.save(db,{sectionKey:'sec1',seriesKey:'dugum',number:55,sourceVideoId:'vid54'}),/çelişiyor/);
  numbers.save(db,{sectionKey:'sec2',seriesKey:'dugum',number:55,sourceVideoId:'vid55'});
  numbers.save(db,{sectionKey:'sec3',seriesKey:'bledum',number:54,sourceVideoId:'bledum1'});
  assert.equal(numbers.get(db).length,3,'Davet numaraları her konuda bağımsızdır.');
  db.exec("UPDATE narrative_section_chapters SET chapter_key='ch2' WHERE section_key='sec2'");
  assert.equal(numbers.get(db).length,2,'Konu değiştirildiğinde eski sayının yanlış konuda gösterilmesi engellenir.');
  numbers.save(db,{sectionKey:'sec2',number:null});
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM narrative_invitation_numbers").get().n,2);
  assert.equal(numbers.get(db).length,2);
  console.log('PASS source-bound invitation number constraints and distinct per-series ordinals');
} finally { db.close(); }
