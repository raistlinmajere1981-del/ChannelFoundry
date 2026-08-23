const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const engine = require("../../packages/subtitle-analysis/index.cjs");
const search = require("./subtitle-search.cjs");
const catalog = require("./youtube-catalog-store.cjs");
const transcripts = require("./transcript-store.cjs");

const db = new DatabaseSync(":memory:");
catalog.ensureSchema(db);
transcripts.ensureSchema(db);

db.prepare("INSERT INTO youtube_channels (id, url, title, handle) VALUES (?, ?, ?, ?)").run("channel-a", "https://www.youtube.com/@example-a", "Örnek Kanal A", "@example-a");
db.prepare("INSERT INTO youtube_channels (id, url, title, handle) VALUES (?, ?, ?, ?)").run("channel-b", "https://www.youtube.com/@example-b", "Örnek Kanal B", "@example-b");

const insertVideo = db.prepare(`
  INSERT INTO youtube_videos (video_id, channel_id, title, published_at, duration_seconds, canonical_url, thumbnail_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertVideo.run("video000001", "channel-a", "İzin ve Rütbe", "2026-08-01", 900, "https://www.youtube.com/watch?v=video000001", "https://example.com/1.jpg");
insertVideo.run("video000002", "channel-a", "Sizin False Positive", "2026-08-02", 1200, "https://www.youtube.com/watch?v=video000002", "https://example.com/2.jpg");
insertVideo.run("video000003", "channel-a", "Yetki ve Rütbe", "2026-08-03", 600, "https://www.youtube.com/watch?v=video000003", "https://example.com/3.jpg");
insertVideo.run("video000004", "channel-b", "Portal", "2025-07-01", 600, "https://www.youtube.com/watch?v=video000004", "https://example.com/4.jpg");

transcripts.saveSourceTranscript(db, { videoId: "video000001", source: "youtube", language: "tr", text: "Bize izin verilirse geliriz. İzin verilmezse gelmeyiz. Oraya gidebilmen çok büyük bir rütbedir." });
transcripts.saveSourceTranscript(db, { videoId: "video000002", source: "youtube", language: "tr", text: "Bu sizin sorma sebebiniz olabilir ve uzakta rütbeli biri görünüyor." });
transcripts.saveSourceTranscript(db, { videoId: "video000003", source: "youtube", language: "tr", text: "Kendi bölgesinde daha yetkilidir ve daha bir rütbesi vardır." });
transcripts.saveSourceTranscript(db, { videoId: "video000004", source: "youtube", language: "tr", text: "Portal açıldı ve portal kapandı. Kral başka bir cümlede." });

assert.equal(engine.countLiteralOccurrences("sizin izin izinli izinsiz", "izin", "contains"), 3);
assert.equal(engine.countLiteralOccurrences("Rütbe rütbesi rütbeli rütbeni", "rütbe", "contains"), 4);
assert.equal(engine.countLiteralOccurrences("Rütbeni ve RÜTBE kavramını düşün.", "rütbe", "whole-word"), 1);
assert.equal(engine.countLiteralOccurrences("yetkilidir yetki", "yetki", "contains"), 2);

const clustered = engine.analyzeRelationshipDocument(
  "Bize izin verilirse geliriz. İzin verilmezse gelmeyiz. Oraya gidebilmen çok büyük bir rütbedir.",
  [{ id: "a", label: "RÜTBE", terms: ["rütbe"] }, { id: "b", label: "OTORİTE", terms: ["izin", "yetki"] }],
  { matchMode: "contains", proximity: { unit: "words", distance: 25 }, direction: "any" },
);
assert.equal(clustered.evidence.length, 1);
assert.equal(clustered.relationClusters, 1);
assert.equal(clustered.tokenPairCount, 2);
assert.equal(clustered.evidence[0].tokenPairCount, 2);
assert.equal(clustered.evidence[0].wordDistance, 8);
assert.equal(clustered.evidence[0].spanWordDistance, 11);
assert.equal(clustered.evidence[0].matches.filter((match) => match.groupId === "b").length, 2);

const falsePositive = engine.analyzeRelationshipDocument(
  "Bu sizin sorma sebebiniz olabilir ve uzakta rütbeli biri görünüyor.",
  [{ id: "a", label: "RÜTBE", terms: ["rütbe"] }, { id: "b", label: "OTORİTE", terms: ["izin"] }],
  { matchMode: "contains", proximity: { unit: "words", distance: 25 }, direction: "any" },
);
assert.equal(falsePositive.evidence.length, 0);
assert.equal(falsePositive.groupOccurrences[1], 0);

const groups = [
  { id: "a", label: "RÜTBE", terms: ["rütbe"] },
  { id: "b", label: "OTORİTE", terms: ["izin", "yetki"] },
];
const relation = search.searchRelationships(db, {
  groups,
  matchMode: "contains",
  proximity: { unit: "words", distance: 25 },
  direction: "any",
  sort: "distance",
  channelId: "channel-a",
});
assert.equal(relation.transcriptCount, 3);
assert.equal(relation.videoCount, 2);
assert.equal(relation.relationCount, 2);
assert.equal(relation.relation_clusters, 2);
assert.equal(relation.token_pair_count, 3);
assert.equal(relation.results.some((video) => video.videoId === "video000002"), false);
assert.deepEqual(relation.matrix.values, [[2, 2], [2, 3]]);
assert.deepEqual(relation.groupStats.map((stat) => stat.occurrenceCount), [2, 3]);
assert.equal(relation.results.find((video) => video.videoId === "video000001").relation_clusters, 1);
assert.equal(relation.results.find((video) => video.videoId === "video000001").token_pair_count, 2);

const markdown = search.renderMarkdownReport(relation);
assert.match(markdown, /Bağımsız ilişki kümesi: 2/u);
assert.match(markdown, /Ham yakınlık eşleşmesi: 3/u);
assert.match(markdown, /RELATION CLUSTER 001/u);
assert.match(markdown, /OTORİTE=izin ×2/u);
assert.match(markdown, /Küme kapsamı \(kelime\): 11/u);
assert.match(markdown, /Tüm hücreler yalnız ilişki sonucu bulunan videolardan hesaplanır/u);

const termSearch = search.searchTranscripts(db, { terms: ["izin"], channelId: "channel-a", matchMode: "contains" });
assert.equal(termSearch.videoCount, 1);
assert.equal(termSearch.totalOccurrences, 2);

const wholeWord = search.searchTranscripts(db, { terms: ["rütbe"], channelId: "channel-a", matchMode: "whole-word" });
assert.equal(wholeWord.videoCount, 0);

const dateFiltered = search.searchRelationships(db, {
  groups,
  matchMode: "contains",
  proximity: { unit: "words", distance: 25 },
  dateFrom: "2026-08-03",
  dateTo: "2026-08-03",
});
assert.equal(dateFiltered.transcriptCount, 1);
assert.equal(dateFiltered.videoCount, 1);
assert.equal(dateFiltered.results[0].videoId, "video000003");

assert.throws(() => search.searchRelationships(db, { groups: [{ id: "a", terms: ["rütbe"] }] }), /en az iki/u);
console.log("Subtitle analysis v3.1: ready");
