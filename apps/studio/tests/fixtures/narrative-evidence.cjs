"use strict";
const { DatabaseSync } = require("node:sqlite");
const projects = require("../../channel-projects.cjs");
const store = require("../../narrative-store.cjs");
const service = require("../../narrative-service.cjs");

// Synthetic approved payload reproducing the user's permission example.
// This fixture does not open, extract or assess the real run #6.
const permission = "İbn Necem Ömer’in mor sıvıyı içmesine izin verdi.";
const videos = ["I8ec5jhbTH4", "video-second", "video-third", "video-fourth"];
function createFixture(root, channelId = "evidence-fixture", name = "Mor sıvı kaydı") {
  projects.createProject({ id: channelId, displayName: channelId, narrator: { displayName: "Ömer", mode: "source_bound_first_person", sourceEntityKeys: [] } }, root);
  const db = new DatabaseSync(":memory:");
  projects.bindDatabaseProject(db, channelId, root);
  db.exec("PRAGMA foreign_keys=ON"); store.ensureSchema(db);
  require("../../youtube-catalog.cjs").ensureSchema(db);
  db.prepare("INSERT INTO youtube_channels(id,url,title) VALUES('fixture','https://www.youtube.com/@fixture','Fixture')").run();
  const insertVideo = db.prepare("INSERT INTO youtube_videos(video_id,channel_id,title,published_at,canonical_url,thumbnail_url) VALUES(?,'fixture',?,'2026-01-01',?,'')");
  for (const [index, id] of videos.entries()) insertVideo.run(id, index === 0 ? "Mor Sıvı — Kaynak Video" : `Kaynak Video ${index + 1}`, `https://www.youtube.com/watch?v=${id}`);
  const insert = db.prepare(`INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,aliases_json,source_video_ids_json,payload_json,state)
    VALUES(?,1,?,?,?,'[]',?,?,'approved')`);
  insert.run("owner", "character", "Ömer", "Açıkça eşlenen anlatıcı.", JSON.stringify(videos), "{}");
  insert.run("story", "story", name, "Dört videolu düğümün genel özeti.", JSON.stringify(videos), JSON.stringify({
    sequence: [{ text: "Ömer görüşmeye geldi.", sourceVideoIds: [videos[1]] }, { text: "Mor sıvıdan söz edildi.", sourceVideoIds: [videos[0]] }],
    details: [{ text: permission, sourceVideoIds: [videos[0]] }, { text: "Ayrı bir bilgi parçası.", sourceVideoIds: [videos[2], videos[3]] }, { text: "Video eşlemesi olmayan ayrıntı." }],
    visual: { text: "GÖRSEL OLAY DEĞİLDİR", sourceVideoIds: videos },
    attributes: [{ text: "ÖZNİTELİK OLAY DEĞİLDİR" }], prompt: "PROMPT OLAY DEĞİLDİR", negativePrompt: "NEGATIVE OLAY DEĞİLDİR",
  }));
  insert.run("summary", "object", "Yalnız özet", "Özgül video kanıtı olmayan genel bağlam.", JSON.stringify([videos[1]]), "{}");
  insert.run("unrelated", "story", "İlgisiz kayıt", "TASLAĞA AİT OLMAYAN METİN", JSON.stringify(["unrelated-video"]), "{}");
  projects.updateProject({ id: channelId, narrator: { sourceEntityKeys: ["owner"] } }, root, db);
  // Predictable historical-style ID; confined to this in-memory database.
  db.prepare("INSERT INTO sqlite_sequence(name,seq) VALUES('narrative_runs',5)").run();
  const prepared = service.prepare(db);
  const bodies = [permission, "Kayda göre nesne anılmıştı.", "Ömer görüşmeye geldi.\n\nMor sıvıdan söz edildi."];
  service.saveDraftResponse(db, { runId: prepared.run.id, response: { contractVersion: 1, sections: bodies.map((body, index) => ({
    title: `Fixture günlük ${index + 1}`, order: index, sourceKeys: [["story"], ["summary"], ["owner", "story"]][index],
    blocks: body.split("\n\n").map(text => ({ type: "paragraph", spans: [{ type: "text", text }] })), media: [],
  })) } });
  return { db, runId: prepared.run.id, prepared, bodies };
}
module.exports = { createFixture, permission, videos };
