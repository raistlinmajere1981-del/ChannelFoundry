"use strict";
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const workspace = require("./universe-workspace.cjs");
const narrativeStore = require("./narrative-store.cjs");
const outline = require("./narrative-outline.cjs");

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON;");
try {
  workspace.ensureSchema(db);
  narrativeStore.ensureSchema(db);
  const source = db.prepare(`INSERT INTO universe_workspace_nodes
    (key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state)
    VALUES (?,1,'story',?,'Onaylı kaynak','[]','["video1"]','{}','approved')`);
  source.run("story1", "İlk deneyim");
  const run = narrativeStore.prepareRun(db);
  narrativeStore.saveDraftSections(db,run.id,[
    { key:"section1", position:1,title:"İlk anı",body:"İlk anlatılan olay.",sourceKeys:["story1"] },
    { key:"section2", position:2,title:"İkinci anı",body:"İkinci anlatılan olay.",sourceKeys:["story1"] },
  ]);
  narrativeStore.applyRun(db,run.id);

  const sections = narrativeStore.narrativeMemory(db).map(s=>({sectionId:s.sectionKey,title:s.title}));
  assert.deepEqual(outline.publishedOutline(db,sections).ungroupedSectionIds,["section1","section2"]);
  assert.deepEqual(outline.status(db).series,[]);
  const before = outline.profile(db);
  assert.equal(before.mode,"source_bound_first_person");
  assert.equal(outline.saveProfile, undefined, "Günlük düzeninden profil yazımı kaldırılmalı");

  const series = outline.saveSeries(db,{title:"Düğümlü Kitap",position:1,description:"Bağımsız anlatı dizisi"});
  assert.equal(outline.seriesList(db).length,1);
  const chapter = outline.saveChapter(db,{seriesKey:series.key,title:"54. Davet",numberLabel:"54",position:54});
  assert.equal(outline.chapterList(db).length,1);
  assert.throws(()=>outline.saveChapter(db,{title:"Başlık",seriesKey:"none"}),/bulunamadı/);
  assert.throws(()=>outline.placeSection(db,{sectionKey:"unknown",chapterKey:chapter.key}),/aktif anlatı/);
  outline.placeSection(db,{sectionKey:"section1",chapterKey:chapter.key,position:0});
  outline.placeSection(db,{sectionKey:"section2",chapterKey:chapter.key,position:1});

  const published = outline.publishedOutline(db,sections);
  assert.equal(published.series.length,1);
  assert.equal(published.series[0].chapters.length,1);
  assert.equal(published.series[0].chapters[0].numberLabel,"54");
  assert.deepEqual(published.series[0].chapters[0].sectionIds,["section1","section2"]);
  assert.deepEqual(published.ungroupedSectionIds,[]);
  assert.equal("page" in published,false);
  assert.equal("positionForPage" in published,false);

  const updated = outline.saveChapter(db,{...chapter,title:"54. Davet — Mezna"});
  assert.equal(updated.key,chapter.key);
  assert.deepEqual(outline.publishedOutline(db,sections).series[0].chapters[0].sectionIds,["section1","section2"]);
  assert.deepEqual(outline.publishedOutline(db,[sections[0]]).series[0].chapters[0].sectionIds,["section1"],"Yalnız yayınlanan bölüm kimlikleri dışa çıkmalı");
  outline.placeSection(db,{sectionKey:"section2",chapterKey:null});
  assert.deepEqual(outline.publishedOutline(db,sections).ungroupedSectionIds,["section2"]);
  assert.deepEqual(outline.publishedOutline(db,[]).series,[],"İçeriksiz seri public JSON'da görünmemeli");
  outline.saveSeries(db,{key:series.key,title:'Düğümlü Kitap düzenlendi'});
  assert.equal(outline.seriesList(db)[0].position,1,'Başlık düzenleme sırayı sıfırlamamalı');
  outline.saveChapter(db,{key:chapter.key,seriesKey:series.key,title:chapter.title});
  assert.equal(outline.chapterList(db)[0].position,54,'Bölüm başlığı düzenleme sırayı değiştirmemeli');
  outline.placeSection(db,{sectionKey:'section1',chapterKey:chapter.key,position:8});
  outline.placeSection(db,{sectionKey:'section1',chapterKey:chapter.key});
  assert.equal(outline.assignments(db)[0].position,8);
  const proposals = outline.titleSuggestions([
    {videoId:'a',title:'Düğümlü Kitap | 54. Davet — İlk kayıt'},
    {videoId:'b',title:'Düğümlü Kitap | 54. Davet — İkinci kayıt'},
    {videoId:'a',title:'Düğümlü Kitap | 54. Davet — Tekrar'},
    {videoId:'c',title:'Başka Kitap | 54. Davet'},
    {videoId:'d',title:'54. Davet'},
    {videoId:'e',title:'Düğümlü Kitap | Bölüm 55'},
  ],[series],[chapter]);
  assert.equal(proposals.length,3,'Aynı bölüm farklı serilerde birleştirilmemeli');
  assert.deepEqual(proposals[0].videos.map(v=>v.videoId),['a','b']);
  assert.equal(proposals[0].seriesKey,series.key);
  assert.equal(proposals[0].chapterKey,chapter.key);
  assert.equal(proposals[2].numberLabel,'55. Bölüm');
  assert.deepEqual(outline.suggestions(db),[],'Katalog yoksa öneri kayıtsız ve boş olmalı');
  assert.equal(outline.seriesList(db).length,1,'Öneriler kendiliğinden kaydedilmemeli');

  // Tree moves must be atomic across parent changes, sibling ranks and
  // standalone memories; moving never edits approved prose or source keys.
  const secondSeries = outline.saveSeries(db,{title:'Yedi Kapı',position:5});
  const secondChapter = outline.saveChapter(db,{seriesKey:secondSeries.key,title:'Kapılar',position:0});
  outline.moveNode(db,{kind:'series',key:secondSeries.key,beforeKey:series.key});
  assert.equal(outline.seriesList(db)[0].key,secondSeries.key);
  outline.moveNode(db,{kind:'chapter',key:chapter.key,parentKey:secondSeries.key,beforeKey:secondChapter.key});
  assert.deepEqual(outline.chapterList(db).filter(ch=>ch.seriesKey===secondSeries.key).map(ch=>ch.key),[chapter.key,secondChapter.key]);
  outline.moveNode(db,{kind:'chapter',key:chapter.key,parentKey:series.key});
  outline.moveNode(db,{kind:'section',key:'section1',parentKey:secondChapter.key});
  outline.moveNode(db,{kind:'section',key:'section2',parentKey:secondChapter.key,beforeKey:'section1'});
  assert.deepEqual(outline.publishedOutline(db,sections).series.find(s=>s.key===secondSeries.key).chapters[0].sectionIds,
    ['section2','section1'], 'Sürüklenen anılar yeni dizinin içinde sıralı yayınlanmalı');
  outline.moveNode(db,{kind:'section',key:'section1',parentKey:null});
  outline.moveNode(db,{kind:'section',key:'section2',parentKey:null,beforeKey:'section1'});
  assert.deepEqual(outline.independentKeys(db),['section2','section1']);
  assert.deepEqual(outline.publishedOutline(db,sections).ungroupedSectionIds,['section2','section1']);
  assert.deepEqual(outline.assignments(db),[]);
  const beforeInvalid = JSON.stringify(outline.status(db));
  assert.throws(()=>outline.moveNode(db,{kind:'chapter',key:chapter.key,parentKey:'missing'}),/Hedef dizi/);
  assert.throws(()=>outline.moveNode(db,{kind:'section',key:'section1',parentKey:'missing'}),/Hedef alt bölüm/);
  assert.throws(()=>outline.moveNode(db,{kind:'series',key:series.key,beforeKey:'missing'}),/Hedef öğe/);
  assert.equal(JSON.stringify(outline.status(db)),beforeInvalid,'Geçersiz hareket hiçbir sırayı kısmen değiştirmemeli');
  assert.equal(narrativeStore.narrativeMemory(db).length,2,'Okuma ağacı onaylı anlatı içeriğine dokunmamalı');
  console.log("PASS narrative outline: stable IDs, atomic tree moves, independent ordering, approved-only placement");
} finally {
  db.close();
}
