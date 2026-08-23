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
insertVideo.run("video000001", "channel-a", "Birinci Video", "2026-08-01", 900, "https://www.youtube.com/watch?v=video000001", "https://example.com/1.jpg");
insertVideo.run("video000002", "channel-a", "İkinci Video", "2026-08-02", 1200, "https://www.youtube.com/watch?v=video000002", "https://example.com/2.jpg");
insertVideo.run("video000003", "channel-b", "Üçüncü Video", "2026-08-03", 600, "https://www.youtube.com/watch?v=video000003", "https://example.com/3.jpg");
insertVideo.run("video000004", "channel-a", "Dördüncü Video", "2025-01-03", 700, "https://www.youtube.com/watch?v=video000004", "https://example.com/4.jpg");

transcripts.saveSourceTranscript(db, { videoId: "video000001", source: "youtube", language: "tr", text: "Portal açıldı ve portal sonra kapandı. Rütbeni korumak için sana özel yetki verildi. Kral bu videoda ayrıca geçiyor." });
transcripts.saveSourceTranscript(db, { videoId: "video000002", source: "youtube", language: "tr", text: "ÜZERLİK hakkında ayrı bir cümle var. Portal burada yalnız bir kez geçiyor. Rütbe konuşuldu ama bu sahte örnekte izin de var." });
transcripts.saveSourceTranscript(db, { videoId: "video000003", source: "youtube", language: "tr", text: "Bu başka kanaldaki portal cümlesidir. Yetki önce geldi. Sonra rütbe geldi ve kral anıldı." });
transcripts.saveSourceTranscript(db, { videoId: "video000004", source: "youtube", language: "tr", text: "Eski kayıtta rütbe var. Aradan çok fazla kelime bir iki üç dört beş altı yedi sekiz dokuz on onbir oniki geçtikten sonra izin var." });

assert.equal(engine.countLiteralOccurrences("Rütbeni ve RÜTBE kavramını düşün.", "rütbe", "contains"), 2);
assert.equal(engine.countLiteralOccurrences("Rütbeni ve RÜTBE kavramını düşün.", "rütbe", "whole-word"), 1);
assert.equal(engine.analyzeTranscript("İlk cümle. Portal burada. Son cümle.", "portal").contexts[0].context, "Portal burada.");
assert.equal(engine.analyzeTranscript("ÜZERLİK burada geçiyor.", "üzerlik").occurrenceCount, 1);

const longTranscript = Array.from({ length: 140 }, (_, index) => index === 70 ? "rütbe" : `kelime${index}`).join(" ");
const longMatch = engine.analyzeTranscript(longTranscript, "rütbe");
assert.equal(longMatch.occurrenceCount, 1);
assert.equal(longMatch.contexts[0].truncated, true);
assert.ok(longMatch.contexts[0].context.length < longTranscript.length / 2);

const groups = [
  { id: "rank", label: "RÜTBE", terms: ["rütbe"] },
  { id: "authority", label: "OTORİTE", terms: ["izin", "yetki"] },
];
const near = engine.findRelationshipEvidence("Rütbeni korumak için sana özel yetki verildi.", groups, { proximity: { unit: "words", distance: 8 } });
assert.equal(near.evidence.length, 1);
assert.equal(near.evidence[0].distance, 5);
assert.equal(near.evidence[0].matches.some((match) => match.term === "yetki"), true);
const far = engine.findRelationshipEvidence("Rütbe bir iki üç dört beş altı yedi sekiz dokuz on izin.", groups, { proximity: { unit: "words", distance: 4 } });
assert.equal(far.evidence.length, 0);
const sentenceNear = engine.findRelationshipEvidence("Rütbe burada. Sonraki cümlede yetki var.", groups, { proximity: { unit: "sentences", distance: 1 } });
assert.equal(sentenceNear.evidence.length, 1);
const reverseOrdered = engine.findRelationshipEvidence("Yetki önce geldi. Sonra rütbe geldi.", groups, { proximity: { unit: "video" }, direction: "ordered" });
assert.equal(reverseOrdered.evidence.length, 0);
const excluded = engine.findRelationshipEvidence("Rütbe burada ama bu sahte bağlamda yetki var.", groups, { proximity: { unit: "words", distance: 10 }, excludeTerms: ["sahte"] });
assert.equal(excluded.evidence.length, 0);

const independent = search.searchTranscripts(db, { terms: ["portal", "rütbe"], searchMode: "independent", matchMode: "contains", sort: "occurrences" });
assert.equal(independent.transcriptCount, 4);
assert.equal(independent.videoCount, 4);
assert.equal(independent.results[0].videoId, "video000001");
const allInVideo = search.searchTranscripts(db, { terms: ["portal", "rütbe"], searchMode: "all-in-video", matchMode: "contains" });
assert.equal(allInVideo.videoCount, 3);
assert.equal(allInVideo.results.some((row) => row.videoId === "video000001"), true);
const wholeWord = search.searchTranscripts(db, { terms: ["rütbe"], channelId: "channel-a", matchMode: "whole-word" });
assert.equal(wholeWord.videoCount, 2);
const datedTerms = search.searchTranscripts(db, { terms: ["rütbe"], channelId: "channel-a", dateFrom: "2026-01-01" });
assert.equal(datedTerms.transcriptCount, 2);
assert.equal(datedTerms.results.some((row) => row.videoId === "video000004"), false);

const relation = search.searchRelationships(db, {
  groups,
  proximity: { unit: "words", distance: 8 },
  direction: "any",
  matchMode: "contains",
  sort: "distance",
});
assert.equal(relation.videoCount, 3);
assert.equal(relation.results.some((row) => row.videoId === "video000001"), true);
assert.equal(relation.results.some((row) => row.videoId === "video000003"), true);
assert.ok(relation.matrix.values[0][1] >= 2);
assert.equal(relation.groupStats.length, 2);
assert.ok(relation.minDistance <= relation.medianDistance);

const relationExcluded = search.searchRelationships(db, { groups, proximity: { unit: "words", distance: 12 }, excludeTerms: ["sahte"] });
assert.equal(relationExcluded.results.some((row) => row.videoId === "video000002"), false);
const relationOrdered = search.searchRelationships(db, { groups, proximity: { unit: "video" }, direction: "ordered" });
assert.equal(relationOrdered.results.some((row) => row.videoId === "video000003"), false);
const relationDated = search.searchRelationships(db, { groups, proximity: { unit: "video" }, dateFrom: "2026-08-02" });
assert.equal(relationDated.transcriptCount, 2);
assert.equal(relationDated.results.some((row) => row.videoId === "video000001"), false);

const markdown = search.renderMarkdownReport(relation);
assert.match(markdown, /# Channel Foundry — Altyazı İlişki Raporu/u);
assert.match(markdown, /RÜTBE.*rütbe/u);
assert.match(markdown, /Yakınlık Matrisi/u);
assert.match(markdown, /RELATION 001/u);
assert.match(search.reportFilename(relation), /^subtitle-relation-rutbe-otorite-\d{4}-\d{2}-\d{2}\.md$/u);
const payload = search.runSearch(db, { searchType: "relationship", groups, proximity: { unit: "words", distance: 8 } });
assert.match(payload.markdown, /Altyazı İlişki Raporu/u);
assert.match(payload.jsonFilename, /\.json$/u);

assert.throws(() => search.searchRelationships(db, { groups: [groups[0]] }), /en az iki/u);
assert.throws(() => search.searchRelationships(db, { groups, proximity: { unit: "words", distance: 999 } }), /0-500/u);
assert.throws(() => search.searchTranscripts(db, { terms: [] }), /En az bir/u);

console.log("Subtitle analysis v3: ready");
