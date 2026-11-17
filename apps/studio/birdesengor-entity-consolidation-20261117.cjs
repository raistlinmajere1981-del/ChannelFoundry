#!/usr/bin/env node
"use strict";
/**
 * BirDeSenGör: reviewed entity consolidation, 2026-11-17.
 * Preview by default. --apply backs up SQLite with VACUUM INTO and applies one
 * atomic transaction; never uploads/deploys. Historical narrative run evidence
 * remains untouched; current links are rebound to the canonical IDs.
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { mergeNarrative, mergeObject, uniqueStrings } = require("./universe-workspace-accumulate.cjs");
const languages = require("./publication-languages.cjs");
const { buildPublicationV2 } = require("./publication-v2.cjs");

const DB_PATH = path.resolve(process.argv.find(arg => arg.startsWith('--db='))?.slice(5) || path.resolve(__dirname, "../../channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"));
const GROUPS = [
  ["character", "Kral Arohan", ["Arohan"]],
  ["character", "Eşref Abi", ["Eşref"]],
  ["character", "Başkomutan Cebut", ["Cebut"]],
  ["character", "Kral Huşimi", ["Huşimi"]],
  ["character", "Kâhin Yosi", ["Kahin Yosi"]],
  ["character", "Ömer'in Dayısı", ["Ömer’in dayısı"]],
  ["character", "Anton", ["Antom"]],
  ["character", "Edobola", ["Edobola 12", "Ebahuni"]],
  ["location", "Kral Arohan'ın Sarayı", ["Arohan’ın Sarayı", "Arohan'ın Sarayı"]],
  ["location", "Ömer'in Çalışma Odası", ["Ömer’in Davet Odası", "Ömer'in Davet Odası"]],
  ["location", "Keops Piramidi", ["Keops"]],
  ["location", "Rüya Âleminin Boyut Kapıları", ["Rüya Boyut Kapıları"]],
  ["object", "Kapaksız Kitap", ["Kapsız Kitap"]],
  ["object", "İbni Kâruf'un Davet Tası", ["İbni Kâruf'un Tası"]],
  ["object", "Ömer'in Koruyucu Vefki", ["Ömer'in Koruma Vefki", "Koruyucu Vefk"]],
  ["object", "Ömer'in Kaftanı", ["Kaftan", "Ömer’in Lacivert Kaftanı", "Kaftan Cebi"]],
];
// Explicitly NOT consolidated: the two telekinesis papers, Keops books,
// numerically distinguished invitees, key/garment contents or distinct doors.
const SPECIAL_PARTS = new Set(["Kaftan Cebi"]);
const EXTRA_KAFTAN_NOTE =
  "Kaftanın dipsiz cebi, eşyaları ağırlıklarını hissettirmeden saklamaya ve düşünülen eşyanın cepte belirmesine yarayan bir özellik olarak anlatılır.";
const EXTRA_KAFTAN_VIDEOS = ["hzLrp3OHiMY", "TQCSgucP5-g"];
const parse = (x, fallback) => { try { return JSON.parse(String(x)); } catch { return fallback; } };
const sqlQuote = (x) => "'" + String(x).replace(/'/g, "''") + "'";
const norm = (x) => String(x || "").trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
const dedupNames = (values) => {
  const used = new Set(), result = [];
  for (const value of values) {
    const name = String(value || "").trim();
    if (!name || used.has(norm(name))) continue;
    used.add(norm(name)); result.push(name);
  }
  return result;
};
function rebind(value, map) {
  if (typeof value === "string") return map.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => rebind(item, map));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebind(item, map)]));
  }
  return value;
}
function saveJson(value) { return JSON.stringify(value); }
function nodeFor(db, kind, name) {
  const rows = db.prepare("SELECT * FROM universe_workspace_nodes WHERE kind=? AND name=? AND state='approved'").all(kind, name);
  if (rows.length !== 1) throw new Error("Kayıt tekil bulunamadı: " + kind + " / " + name + " (" + rows.length + ")");
  return rows[0];
}
function currentCounts(db) {
  return {
    approvedNodes: db.prepare("SELECT count(*) AS n FROM universe_workspace_nodes WHERE state='approved'").get().n,
    approvedRelations: db.prepare("SELECT count(*) AS n FROM universe_workspace_relations WHERE state='approved'").get().n,
    approvedSections: db.prepare("SELECT count(*) AS n FROM narrative_sections s JOIN narrative_section_revisions r ON s.current_revision_id=r.id WHERE s.state='active' AND r.state='approved'").get().n,
  };
}
function preview(db) {
  const specs = [], map = new Map(), sidecars = [];
  for (const [kind, name, otherNames] of GROUPS) {
    const target = nodeFor(db, kind, name);
    const sources = otherNames.map((otherName) => nodeFor(db, kind, otherName));
    for (const source of sources) {
      if (map.has(source.key)) throw new Error("Tekrar birleştirme: " + source.name);
      map.set(source.key, target.key);
      for (const table of ["entity_visual_profiles", "visual_reference_links", "visual_basket_jobs"]) {
        const old = db.prepare("SELECT * FROM " + table + " WHERE entity_key=?").get(source.key);
        const existing = db.prepare("SELECT * FROM " + table + " WHERE entity_key=?").get(target.key);
        if (old) sidecars.push({table,source:source.name,target:name,hasImage:!!old.image_path,conflict:!!existing});
        if (old && existing && table === "entity_visual_profiles" && old.image_path && existing.image_path && old.image_path !== existing.image_path) {
          throw new Error("İki ayrı gerçek görsel var; manuel seçim gerekiyor: " + name);
        }
        if (old && existing && table !== "entity_visual_profiles") {
          throw new Error("Görsel referansı veya üretim sepeti çakışması: " + name + " " + table);
        }
      }
      const pending = db.prepare("SELECT COUNT(*) AS n FROM universe_workspace_revisions WHERE node_key=? AND state='pending'").get(source.key).n;
      if (pending) throw new Error("Bekleyen revizyonlu kaynak birleştirilemez: " + source.name);
    }
    if (db.prepare("SELECT COUNT(*) AS n FROM universe_workspace_revisions WHERE node_key=? AND state='pending'").get(target.key).n) {
      throw new Error("Bekleyen revizyonlu hedef birleştirilemez: " + target.name);
    }
    specs.push({kind, target, sources});
  }
  return {specs, map, sidecars};
}
function mergeNode(db, group) {
  const {target, sources} = group;
  const data = parse(target.payload_json, {});
  let summary = target.summary;
  let aliases = parse(target.aliases_json, []);
  let videos = parse(target.source_video_ids_json, []);
  let payload = {...data};
  for (const source of sources) {
    const sourcePayload = parse(source.payload_json, {});
    summary = mergeNarrative(summary, source.summary, 12000);
    videos = uniqueStrings(videos, parse(source.source_video_ids_json, []));
    aliases = dedupNames([...aliases, ...parse(source.aliases_json, []),
      ...(SPECIAL_PARTS.has(source.name) ? [] : [source.name])]);
    const omitNames = {...sourcePayload};
    for (const field of ["name", "summary", "aliases", "sourceVideoIds", "visual"]) delete omitNames[field];
    payload = mergeObject(payload, omitNames);
    if (sourcePayload.visual) {
      payload.visual = mergeObject(payload.visual || {}, sourcePayload.visual);
    }
    db.prepare("INSERT INTO universe_workspace_history(node_key, run_id, event, note, snapshot_json) VALUES(?,?,?,?,?)")
      .run(target.key, source.run_id, "entity_merged", "Birleştirilen kayıt: " + source.name,
        saveJson({sourceKey:source.key,name:source.name,summary:source.summary,aliases:parse(source.aliases_json,[]),
          sourceVideoIds:parse(source.source_video_ids_json,[]),payload:sourcePayload}));
    if (db.prepare("SELECT 1 AS ok FROM universe_main_characters WHERE node_key=?").get(source.key)) {
      db.prepare("INSERT OR IGNORE INTO universe_main_characters(node_key) VALUES(?)").run(target.key);
    }
    for (const table of ["entity_visual_profiles", "visual_reference_links", "visual_basket_jobs"]) {
      const old = db.prepare("SELECT * FROM " + table + " WHERE entity_key=?").get(source.key);
      if (!old) continue;
      const existing = db.prepare("SELECT * FROM " + table + " WHERE entity_key=?").get(target.key);
      if (!existing) {
        db.prepare("UPDATE " + table + " SET entity_key=? WHERE entity_key=?").run(target.key, source.key);
      } else if (table === "entity_visual_profiles") {
        const patch = {};
        for (const field of ["description","attributes_json","atmosphere","prompt","negative_prompt","image_path","image_source","image_provider","image_model"]) {
          const empty = field === "attributes_json" ? (v) => !v || v === "[]" : (v) => !String(v ?? "").trim();
          if (empty(existing[field]) && !empty(old[field])) patch[field] = old[field];
        }
        if (Object.keys(patch).length) {
          const cols = Object.keys(patch);
          db.prepare("UPDATE entity_visual_profiles SET " + cols.map(col => col+"=?").join(",") + ",updated_at=CURRENT_TIMESTAMP WHERE entity_key=?")
            .run(...cols.map(col => patch[col]),target.key);
        }
        db.prepare("DELETE FROM entity_visual_profiles WHERE entity_key=?").run(source.key);
      }
    }
  }
  if (target.kind === "object" && target.name === "Ömer'in Kaftanı") {
    summary = mergeNarrative(summary, EXTRA_KAFTAN_NOTE, 12000);
    payload.details = [...(Array.isArray(payload.details) ? payload.details : []),
      {text:EXTRA_KAFTAN_NOTE,sourceVideoIds:EXTRA_KAFTAN_VIDEOS}];
  }
  if (aliases.length > 30) throw new Error("Alternatif ad sayısı sınırı aşıldı: " + target.name);
  payload.name = target.name;
  payload.summary = summary;
  payload.aliases = aliases;
  payload.sourceVideoIds = videos;
  db.prepare("UPDATE universe_workspace_nodes SET summary=?, aliases_json=?, source_video_ids_json=?, payload_json=?, updated_at=CURRENT_TIMESTAMP WHERE key=?")
    .run(summary,saveJson(aliases),saveJson(videos),saveJson(payload),target.key);
}
function rewriteRelations(db, mapping) {
  const relations = db.prepare("SELECT * FROM universe_workspace_relations ORDER BY updated_at, key").all();
  const group = new Map(), removed = new Map();
  let droppedSelf = 0;
  for (const r of relations) {
    const from = mapping.get(r.from_key) || r.from_key;
    const to = mapping.get(r.to_key) || r.to_key;
    if (from === to) {
      db.prepare("DELETE FROM universe_workspace_relations WHERE key=?").run(r.key);
      droppedSelf++;
      continue;
    }
    const signature = [from,to,r.label,r.state].join("\u0000");
    const prior = group.get(signature);
    if (prior) {
      const sourceVideos = uniqueStrings(parse(prior.source_video_ids_json,[]),parse(r.source_video_ids_json,[]));
      const payload = mergeObject(parse(prior.payload_json,{}),parse(r.payload_json,{}));
      db.prepare("UPDATE universe_workspace_relations SET source_video_ids_json=?,payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE key=?")
        .run(saveJson(sourceVideos),saveJson(payload),prior.key);
      prior.source_video_ids_json = saveJson(sourceVideos);
      prior.payload_json = saveJson(payload);
      db.prepare("DELETE FROM universe_workspace_relations WHERE key=?").run(r.key);
      removed.set(r.key,prior.key);
    } else {
      group.set(signature,r);
      if (from !== r.from_key || to !== r.to_key) {
        db.prepare("UPDATE universe_workspace_relations SET from_key=?,to_key=?,updated_at=CURRENT_TIMESTAMP WHERE key=?")
          .run(from,to,r.key);
      }
    }
  }
  return {relationMap: removed,droppedSelf,collapsed:removed.size};
}
function rewriteSections(db, mapping) {
  const cols = ["blocks_json","source_keys_json","entity_references_json","media_json"];
  const rows = db.prepare("SELECT id,section_key,blocks_json,source_keys_json,entity_references_json,media_json FROM narrative_section_revisions").all();
  const changedSections = new Set();
  let changedRevisions = 0;
  for (const row of rows) {
    const updates = {};
    for (const col of cols) {
      if (![...mapping.keys()].some(key => row[col].includes(key))) continue;
      const old = parse(row[col],[]);
      let next = rebind(old,mapping);
      if (col === "source_keys_json") next = [...new Set(next)];
      if (saveJson(old) === saveJson(next)) continue;
      updates[col] = saveJson(next);
    }
    const changed = Object.keys(updates);
    if (!changed.length) continue;
    const args = changed.map(col => updates[col]);
    db.prepare("UPDATE narrative_section_revisions SET "+changed.map(col => col+"=?").join(",")+" WHERE id=?")
      .run(...args,row.id);
    changedRevisions++;
    changedSections.add(row.section_key);
  }
  return {changedRevisions, changedSections};
}
function updateLanguages(db, changedSections, mapping, sourceKeys) {
  const oldVersions = new Map();
  for (const id of changedSections) {
    const existing = db.prepare("SELECT * FROM publication_language_sources WHERE kind='section' AND id=?").get(id);
    oldVersions.set(id,{
      sourceHash:existing?.source_hash ?? "",
      variants:db.prepare("SELECT * FROM publication_language_variants WHERE kind='section' AND id=?").all(id),
    });
  }
  const built = buildPublicationV2(db,{sourceOnly:true});
  languages.sync(db,built.snapshot);
  for (const id of sourceKeys) {
    const source = languages.source(db,"entity",id);
    if (!source) throw new Error("Birleştirilmiş yayına hazır kayıt yok: " + id);
    const original = parse(source.data_json,{});
    const prior = languages.variants(db,"entity",id).variants.tr;
    if (!prior || prior.state !== "approved") throw new Error("Hedefin TR onayı eksik: " + id);
    const trData = {...original};
    if (Object.hasOwn(prior.data ?? {},"displayName")) trData.displayName = prior.data.displayName;
    languages.save(db,{kind:"entity",id,language:"tr",sourceHash:source.source_hash,
      revision:prior.revision,data:trData,approved:true});
  }
  const changedLanguages=[];
  for (const id of changedSections) {
    const old = oldVersions.get(id);
    const source = languages.source(db,"section",id);
    if (!source) throw new Error("Bölüm yayını kayboldu: "+id);
    // Change only identity links; preserve all authored/translated prose.
    for (const lang of ["tr","en"]) {
      const variant = old.variants.find(x => x.language === lang);
      if (!variant || variant.state !== "approved" || variant.source_hash !== old.sourceHash) continue;
      const data = rebind(parse(variant.data_json,{}),mapping);
      languages.save(db,{kind:"section",id,language:lang,
        sourceHash:source.source_hash,revision:variant.revision,data,approved:true});
      changedLanguages.push({section:id,language:lang});
    }
  }
  return {changedLanguages,built};
}
function main() {
  const apply = process.argv.includes("--apply");
  const db = new DatabaseSync(DB_PATH,{timeout:10000});
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec("PRAGMA busy_timeout=10000;");
  const before = currentCounts(db);
  const {specs,map,sidecars} = preview(db);
  const result = {mode:apply?"apply":"preview",before,
    groupCount:specs.length,sourceNodeCount:map.size,
    groups:specs.map(x=>({kind:x.kind,keep:x.target.name,removed:x.sources.map(y=>y.name)})),
    transferredSidecars:sidecars};
  if (!apply) { console.log(JSON.stringify(result,null,2)); db.close(); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g,"-");
  const backupDir = path.join(path.dirname(DB_PATH),"backups");
  fs.mkdirSync(backupDir,{recursive:true});
  const backupPath = path.join(backupDir,"before-entity-consolidation-"+stamp+".sqlite");
  db.exec("VACUUM INTO "+sqlQuote(backupPath));
  result.backup = backupPath;
  db.exec("BEGIN IMMEDIATE;");
  try {
    for (const group of specs) mergeNode(db,group);
    const relationResult = rewriteRelations(db,map);
    const combinedMap = new Map([...map,...relationResult.relationMap]);
    const sectionResult = rewriteSections(db,combinedMap);
    for (const group of specs) for (const source of group.sources) {
      db.prepare("DELETE FROM universe_workspace_nodes WHERE key=?").run(source.key);
    }
    const sourceKeys = specs.map(x=>x.target.key);
    const languageResult = updateLanguages(db,sectionResult.changedSections,combinedMap,sourceKeys);
    for (const key of map.keys()) db.prepare("DELETE FROM publication_language_sources WHERE kind='entity' AND id=?").run(key);
    const fk = db.prepare("PRAGMA foreign_key_check").all();
    if (fk.length) throw new Error("FK tutarsızlığı: "+JSON.stringify(fk.slice(0,3)));
    const after = currentCounts(db);
    if (after.approvedNodes !== before.approvedNodes - map.size || after.approvedSections !== before.approvedSections) {
      throw new Error("Beklenmedik sayım değişikliği: "+JSON.stringify(after));
    }
    const repub = buildPublicationV2(db,{sourceOnly:true});
    languages.apply(db,repub.snapshot);
    if (repub.snapshot.journal.sections.length !== before.approvedSections) {
      throw new Error("Yayın bölüm sayısı korunmadı.");
    }
    if (repub.snapshot.archive.entities.length !== after.approvedNodes) throw new Error("Yayın varlık sayısı uyuşmuyor.");
    result.after = after;
    result.updatedNarrativeRevisions = sectionResult.changedRevisions;
    result.updatedNarrativeSections = sectionResult.changedSections.size;
    result.updatedSectionLanguages = languageResult.changedLanguages.length;
    result.deduplicatedRelations = relationResult.collapsed;
    result.discardedSelfRelations = relationResult.droppedSelf;
    result.localPublicationId = repub.snapshot.publication.id;
    result.valid = true;
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    result.error=String(error.stack || error);
    result.rolledBack=true;
    console.error(JSON.stringify(result,null,2));
    db.close(); process.exitCode=1; return;
  }
  const report = path.join(backupDir,"entity-consolidation-"+stamp+".json");
  fs.writeFileSync(report,JSON.stringify(result,null,2)+"\n");
  result.report=report;
  console.log(JSON.stringify(result,null,2));
  db.close();
}
main();
