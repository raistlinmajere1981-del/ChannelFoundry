#!/usr/bin/env node
"use strict";
// BirDeSenGör topic regrouping — preview by default, --apply performs one atomic edit.
// Never sends a web deployment. Run against a copy first via --db=<path>.
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const publication = require("./publication-v2.cjs");
const languages = require("./publication-languages.cjs");
const ROOT = path.resolve(__dirname, "../../channels/birdesengor/.local-data/studio");
const dbPath = path.resolve(process.argv.find(a => a.startsWith("--db="))?.slice(5) ||
  path.join(ROOT, "channel-foundry-studio.sqlite"));
const apply = process.argv.includes("--apply");
const NEW_TITLE = "İbni Necemin’le Buluşma Günlüğü";
const OLD_TITLE = "İbn Necemi'yle Buluşma Günlüğü";
const TITLES = new Map([
  [18, "Hudcan’ın Çöl Haberleri"], [25,"Zifir Kuyusunun Bekçisi"],
  [26,"Saraydaki Meclisin Tanığı"],[27,"Sözcünün Getirdiği Hediye Haberi"],
  [28,"Üç Vadi Arasındaki Meclis"],[29,"İsimsiz Habercinin Masası"],
  [38,"UVB76’ya Boyut Daveti ve Radyodan Gelen Sesler"],
  [39,"Edebola 12: Telsizdeki Ses ve 17. Katman"],
  [41,"İki Büyücünün Konuşmaları ve Altıncı Boyuttaki Toplantıya Davet"],
  [42,"Babil’deki Büyük Saray Toplantısı ve Siyah Taşlı Yüzük"],
  [44,"Edebola 12’nin Daveti Öncesinde Gelen Davetsiz Misafirler"],
  [45,"Natra Tapınağı’nda Edebola’yla Görüşmem"],
  [46,"Henhene’nin İstediği Emanet"],[47,"Mahkeme Sözüyle Gelen Davetsiz Misafir"],
  [54,"Padişah Suman’ın Daveti ve Toplantı Öncesindeki Uyarılar"],
  [55,"Eski Çarşıdaki Kulübede Üç Padişah ve Üç Kralla Toplantı"],
  [56,"Toplantının Ardından İbn Karuf’un Gönderdiği Bilgeyi Dinlerken"],
  [60,"İbn Karuf’un Gönderdiği Davetlinin Haberleri"],
  [67,"Karima’daki Meclis: Hatat ve Çocukları İçin Verilen Karar"],
  [73,"Derin Kuyu’daki Gizli Toplantı"],
  [75,"Karuf Meclisi’nin Elçisine Savaş Hakkında Sorduklarım"],
  [87,"Haniş Adası’ndaki Toplantı ve Zakkum Kapısı İsteği"],
  [94,"İbn Karuf’un Kulübesindeki Toplantı"],
  [95,"Mezna’da Heyetle Tanışmam"],
  [105,"İbn Karuf’un Gönderdiği Haber ve Kör Boyut Toplantısı"],
  [121,"Düğümlü Kitabın Tehlikesi, Yedi Kafile ve Mesukrana ile Karşılaşma"],
  [129,"Ebaruşta'nın Babası Eba Hadni ile Orman Evinde Karşılaşma ve Düğümlü Kitap Uyarıları"],
  [130,"İbni Karuf Daveti ve Su Tasındaki Yolculuk"],
  [132,"İbni Karuf Hadim Daveti: Tas ve Su Aynasında Yaşanan Görüler, Verilen Asa ve Hakikat Merdiveni"],
  [134,"Kendi Evimde Tek Başıma Tas Daveti: Vefksiz Yakalanış ve Kuyudaki Eyşan"],
  [135,"Taslı Davet, Mecamin Kuyusundaki Eyşan ve Tuji"],
  [137,"Tuji Daveti, Tas Ritüeli ve Eyşan Dosyası"],
  [138,"Eyşan'ın Esaretten Kurtuluşu, Amber Tütsüsü ve Tuji'nin Şehadeti"],
  [144,"Tuji'nin Daveti — Günlük Taslağı"],
  [145,"İbn Karuf'un Daveti — Günlük Taslak"],
  [146,OLD_TITLE],
]);
const MOVES = [
  ["topic-chapter-dugumlu-ara-kayitlar", [121,129,146]],
  ["topic-chapter-bledum",[18]],
  ["topic-chapter-mezna",[95]],
  ["topic-chapter-kapsiz-kitap",[25]],
  ["topic-chapter-ibni-karuf-meclisleri",[26,27,28,29,41,42,54,55,56,60,67,73,75,87,94,105,130,132,145]],
  ["topic-chapter-edobola-alti-boyut",[38,39,44,45,46,47]],
  ["topic-chapter-tuji-eysan",[134,135,137,138,144]],
];
const SERIES = [
  {key:"topic-series-ibni-karuf-meclisleri",chapter:"topic-chapter-ibni-karuf-meclisleri",tr:"İbni Kâruf ve Meclisleri",en:"Ibn Karuf and His Councils"},
  {key:"topic-series-edobola-alti-boyut",chapter:"topic-chapter-edobola-alti-boyut",tr:"Edobola 12 ve Altıncı Boyut",en:"Edobola 12 and the Sixth Dimension"},
  {key:"topic-series-tuji-eysan",chapter:"topic-chapter-tuji-eysan",tr:"Tuji ve Eyşan",en:"Tuji and Eyşan"},
];
const query = `SELECT s.key AS id, r.title AS title, r.position AS pos
 FROM narrative_sections s JOIN narrative_section_revisions r ON r.id=s.current_revision_id
 LEFT JOIN narrative_section_chapters sc ON sc.section_key=s.key
 WHERE s.state='active' AND r.state='approved' AND sc.section_key IS NULL
 ORDER BY r.position,r.title`;
function count(db){
 return {
  activeApproved:db.prepare("SELECT count(*) AS n FROM narrative_sections s JOIN narrative_section_revisions r ON s.current_revision_id=r.id WHERE s.state='active' AND r.state='approved'").get().n,
  series:db.prepare("SELECT count(*) AS n FROM narrative_series").get().n,
  assigned:db.prepare("SELECT count(*) AS n FROM narrative_section_chapters").get().n,
  independent:db.prepare(query).all().length,
 };
}
function check(db){
 const before=count(db);
 if(before.activeApproved!==276||before.series!==4||before.assigned!==130||before.independent!==146)
   throw Error("Beklenmeyen mevcut kayıt durumu: "+JSON.stringify(before));
 const rows=db.prepare(query).all();
 const ids = new Map();
 for(const [i,expected] of TITLES){
   const row=rows[i-1];
   if(!row||row.title!==expected)
     throw Error("Başlık sıra doğrulaması başarısız: "+i+", beklenen="+expected+", bulunan="+row?.title);
   ids.set(i,row.id);
 }
 const allMoves = MOVES.flatMap(([, indices])=>indices);
 if(allMoves.length!==36||new Set(allMoves).size!==36)throw Error("Taşımalar 36 tekil kayıt değil.");
 if(allMoves.some(i=>!ids.has(i)))throw Error("Beklenen anlatı kimliği bulunamadı.");
 for(const s of SERIES){
  if(db.prepare("SELECT 1 AS n FROM narrative_series WHERE key=?").get(s.key))throw Error("Seri zaten mevcut: "+s.key);
  if(db.prepare("SELECT 1 AS n FROM narrative_chapters WHERE key=?").get(s.chapter))throw Error("Bölüm zaten mevcut: "+s.chapter);
 }
 for(const [chapter] of MOVES)
   if(!SERIES.some(s=>s.chapter===chapter)&&!db.prepare("SELECT 1 AS ok FROM narrative_chapters WHERE key=?").get(chapter))throw Error("Mevcut kategori bulunamadı: "+chapter);
 return {before,ids};
}
function approve(db,kind,id,language,data){
 const pack=languages.variants(db,kind,id);
 if(!pack)throw Error("Çeviri kaynağı oluşturulamadı: "+id);
 const current=pack.variants[language];
 languages.save(db,{kind,id,language,sourceHash:pack.sourceHash,revision:current?.revision??0,data,approved:true});
}
function run(){
 const db=new DatabaseSync(dbPath,{timeout:10000});
 db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;");
 const {before,ids}=check(db);
 const summary={mode:apply?"apply":"preview",before,planned: MOVES.map(([chapter,indices])=>({chapter,count:indices.length,titles:indices.map(i=>TITLES.get(i))})),renamed:{from:OLD_TITLE,to:NEW_TITLE}};
 if(!apply){console.log(JSON.stringify(summary,null,2));db.close();return;}
 const stamp=new Date().toISOString().replace(/[:.]/g,"-");
 const backupDir=path.join(path.dirname(dbPath),"backups");fs.mkdirSync(backupDir,{recursive:true});
 const backup=path.join(backupDir,"before-topic-regrouping-"+stamp+".sqlite");
 db.exec("VACUUM INTO '"+backup.replace(/'/g,"''")+"'");
 summary.backup=backup;
 db.exec("BEGIN IMMEDIATE;");
 try{
  let position=db.prepare("SELECT coalesce(max(position),-1)+1 AS next FROM narrative_series").get().next;
  for(const s of SERIES){
    db.prepare("INSERT INTO narrative_series(key,title,description,position) VALUES(?,?,'',?)").run(s.key,s.tr,position++);
    db.prepare("INSERT INTO narrative_chapters(key,series_key,title,number_label,position) VALUES(?,?,?,'',0)").run(s.chapter,s.key,"Kayıtlar");
  }
  for(const [chapter,indices] of MOVES){
    let at=db.prepare("SELECT coalesce(max(position),-1)+1 AS next FROM narrative_section_chapters WHERE chapter_key=?").get(chapter).next;
    for(const index of indices){
      const id=ids.get(index);
      db.prepare("INSERT INTO narrative_section_chapters(section_key,chapter_key,position) VALUES(?,?,?)").run(id,chapter,at++);
      db.prepare("DELETE FROM narrative_independent_order WHERE section_key=?").run(id);
    }
  }
  const sectionKey=ids.get(146);
  const updated=db.prepare(`UPDATE narrative_section_revisions SET title=?
    WHERE id=(SELECT current_revision_id FROM narrative_sections WHERE key=?)
    AND title=? AND state='approved'`).run(NEW_TITLE,sectionKey,OLD_TITLE);
  if(updated.changes!==1)throw Error("Başlık güncellemesi tek kayıtla eşleşmedi.");
  const built=publication.buildPublicationV2(db,{sourceOnly:true});
  languages.sync(db,built.snapshot);
  const source=languages.source(db,"section",sectionKey);
  const variant=languages.variants(db,"section",sectionKey);
  if(variant.variants.tr?.state!=="approved")throw Error("TR bölüm onayı mevcut değil.");
  const corrected={...variant.variants.tr.data,title:NEW_TITLE};
  if(corrected.sourceVersion!==JSON.parse(source.data_json).sourceVersion)throw Error("Bölüm kaynak bağımlılığı değişmiş.");
  approve(db,"section",sectionKey,"tr",corrected);
  for(const s of SERIES){
    approve(db,"outline",s.key,"tr",{title:s.tr,description:""});
    approve(db,"outline",s.key,"en",{title:s.en,description:""});
    approve(db,"outline",s.chapter,"tr",{title:"Kayıtlar",numberLabel:""});
    approve(db,"outline",s.chapter,"en",{title:"Records",numberLabel:""});
  }
  const result=publication.buildPublicationV2(db,{sourceOnly:true});
  languages.apply(db,result.snapshot);
  const after=count(db);
  if(after.activeApproved!==276||after.series!==7||after.assigned!==166||after.independent!==110)
    throw Error("Kategori son durum yanlış: "+JSON.stringify(after));
  if(result.snapshot.journal.sections.length!==276)throw Error("Anlatı sayısı değişti.");
  for(const [chapter,indices] of MOVES){
    const actual=db.prepare("SELECT count(*) AS n FROM narrative_section_chapters WHERE chapter_key=?").get(chapter).n;
    if(actual<indices.length)throw Error("Kategori eksik: "+chapter);
  }
  for(const s of SERIES)if(!languages.published(db,"outline",s.key).en||
        !languages.published(db,"outline",s.key).tr)throw Error("İki dilde başlık onaylanmadı: "+s.tr);
  const fixed=languages.published(db,"section",sectionKey).tr;
  if(fixed?.title!==NEW_TITLE)throw Error("Başlık yayın varyantı güncellenmedi.");
  const fk=db.prepare("PRAGMA foreign_key_check").all();
  if(fk.length)throw Error("Foreign key hatası: "+JSON.stringify(fk.slice(0,3)));
  summary.after=after;
  summary.seriesTitles=SERIES.map(s=>s.tr);
  summary.localPublicationId=result.snapshot.publication.id;
  summary.localTRApproved=db.prepare(`SELECT count(*) AS n FROM publication_language_variants v
    JOIN publication_language_sources s ON v.kind=s.kind AND v.id=s.id
    WHERE v.kind='section' AND v.language='tr' AND v.state='approved' AND v.source_hash=s.source_hash`).get().n;
  if(summary.localTRApproved!==276)throw Error("TR onaylı anlatı sayısı 276 değil.");
  db.exec("COMMIT;");
  summary.valid=true;
 }catch(error){
  db.exec("ROLLBACK;");
  summary.rolledBack=true;summary.error=String(error.stack||error);
  console.error(JSON.stringify(summary,null,2));db.close();process.exitCode=1;return;
 }
 const report=path.join(backupDir,"topic-regrouping-"+stamp+".json");
 fs.writeFileSync(report,JSON.stringify(summary,null,2)+"\n");summary.report=report;
 console.log(JSON.stringify(summary,null,2));db.close();
}
run();
