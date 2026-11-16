"use strict";
/* One-off, guarded, local editorial migration. Default mode is read-only. */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const lang = require("./publication-languages.cjs");

const root = path.resolve(__dirname, "../..");
const dbPath = path.join(root, "channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const backupDirectory = path.join(path.dirname(dbPath), "backups");
const groups = [
  { id: "dugumlu-kitap", title: "Düğümlü Kitap", positions: [4, 5, 7, 18, 23, 24, 26, 28] },
  { id: "bledum", title: "Bledum", positions: [9, 13, 15, 19, 25, 30, 31, 32, 36, 39] },
  { id: "mezna", title: "Mezna", positions: [14, 29] },
  { id: "kapsiz-kitap", title: "Kapsız Kitap", positions: [22] },
];
function main() {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys=ON");
  try {
    const sql = "SELECT s.key, s.state, s.current_revision_id, r.position, r.title, r.state AS revision_state, " +
      "r.body, r.blocks_json, r.media_json, r.source_video_ids_json " +
      "FROM narrative_sections s JOIN narrative_section_revisions r ON r.id=s.current_revision_id ORDER BY r.position";
    const current = db.prepare(sql).all();
    assert.equal(current.length, 40);
    assert(current.every((row,index) => row.position === index && row.state === "active" && row.revision_state === "approved"));
    const beforeFingerprint = crypto.createHash("sha256").update(JSON.stringify(current)).digest("hex");
    const oldSeries = db.prepare("SELECT key,title FROM narrative_series").all();
    assert.equal(oldSeries.length,1);
    assert.equal(oldSeries[0].title,"Evren Günlüğü");
    const oldChapters = db.prepare("SELECT key FROM narrative_chapters WHERE series_key=?").all(oldSeries[0].key).map(row=>row.key);
    assert.equal(oldChapters.length,4);
    assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_section_chapters").get().n,31);
    const assignedPositions=groups.flatMap(group=>group.positions);
    assert.equal(new Set(assignedPositions).size,assignedPositions.length);
    assert(assignedPositions.every(index=>index>=0&&index<40));
    const independent=current.filter(row=>!assignedPositions.includes(row.position));
    assert.equal(independent.length,19);
    console.log("OUTLINE_PLAN",JSON.stringify({
      groupAssignments: groups.map(group=>({ title: group.title,
        entries: group.positions.map(pos=>current[pos].title) })),
      independent: independent.map(row=>row.title),
    },null,2));
    if(!apply){console.log("DRY RUN — no data written");return;}
    const backups=fs.readdirSync(backupDirectory).filter(name=>
      /^before-topic-outline-20261116-[0-9]{6}\.sqlite$/u.test(name));
    assert(backups.some(name=>fs.statSync(path.join(backupDirectory,name)).size>50000000),"Verified backup missing");
    db.exec("BEGIN IMMEDIATE");
    try {
      groups.forEach((group,index)=>{
        const seriesKey="topic-series-"+group.id;
        const chapterKey="topic-chapter-"+group.id;
        db.prepare("INSERT INTO narrative_series(key,title,description,position) VALUES(?,?,?,?)")
          .run(seriesKey,group.title,"",index);
        db.prepare("INSERT INTO narrative_chapters(key,series_key,title,number_label,position) VALUES(?,?,?,?,?)")
          .run(chapterKey,seriesKey,"Kayıtlar","",0);
      });
      db.prepare("DELETE FROM narrative_section_chapters").run();
      db.prepare("DELETE FROM narrative_independent_order").run();
      groups.forEach(group=>group.positions.forEach((pos,index)=>{
        db.prepare("INSERT INTO narrative_section_chapters(section_key,chapter_key,position) VALUES(?,?,?)")
          .run(current[pos].key,"topic-chapter-"+group.id,index);
      }));
      independent.forEach((row,index)=>db.prepare("INSERT INTO narrative_independent_order(section_key,position) VALUES(?,?)").run(row.key,index));
      oldChapters.forEach(key=>db.prepare("DELETE FROM narrative_chapters WHERE key=?").run(key));
      db.prepare("DELETE FROM narrative_series WHERE key=?").run(oldSeries[0].key);
      for(const oldKey of [oldSeries[0].key,...oldChapters]){
        db.prepare("DELETE FROM publication_language_variants WHERE kind='outline' AND id=?").run(oldKey);
        db.prepare("DELETE FROM publication_language_sources WHERE kind='outline' AND id=?").run(oldKey);
      }
      for(const group of groups){
        const newRows=[
          ["topic-series-"+group.id,{title:group.title,description:""}],
          ["topic-chapter-"+group.id,{title:"Kayıtlar",numberLabel:""}],
        ];
        for(const [id,data] of newRows){
          const sourceHash=lang.putSource(db,"outline",id,data);
          lang.save(db,{kind:"outline",id,language:"tr",sourceHash,revision:0,approved:true,data});
        }
      }
      assert.equal(crypto.createHash("sha256").update(JSON.stringify(db.prepare(sql).all())).digest("hex"),beforeFingerprint);
      assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_section_chapters").get().n,21);
      assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_independent_order").get().n,19);
      assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_series").get().n,4);
      assert.equal(db.prepare("SELECT count(*) AS n FROM narrative_chapters").get().n,4);
      assert.equal(db.prepare("SELECT count(*) AS n FROM publication_language_variants WHERE kind='outline' AND state='approved' AND language='tr'").get().n,8);
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
      assert.equal(db.prepare("PRAGMA quick_check").get().quick_check,"ok");
      db.exec("COMMIT");
      console.log("MIGRATION_OK: 21 assigned, 19 independent, 4 subjects; sections unchanged.");
    } catch(error){db.exec("ROLLBACK");throw error;}
  } finally{db.close();}
}
main();
