const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const engine = require("../../packages/subtitle-analysis/index.cjs");
const search = require("./subtitle-search.cjs");
const catalog = require("./youtube-catalog-store.cjs");
const transcripts = require("./transcript-store.cjs");

const db = new DatabaseSync(":memory:");
catalog.ensureSchema(db);
transcripts.ensureSchema(db);

db.prepare("INSERT INTO youtube_channels (id, url, title, handle) VALUES (?, ?, ?, ?)")
  .run("channel-a", "https://www.youtube.com/@example-a", "Örnek Kanal A", "@example-a");
db.prepare("INSERT INTO youtube_channels (id, url, title, handle) VALUES (?, ?, ?, ?)")
  .run("channel-b", "https://www.youtube.com/@example-b", "Örnek Kanal B", "@example-b");

const insertVideo = db.prepare(`
  INSERT INTO youtube_videos (video_id, channel_id, title, published_at, duration_seconds, canonical_url, thumbnail_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertVideo.run("video000001", "channel-a", "Birinci Video", "2026-08-01", 900, "https://www.youtube.com/watch?v=video000001", "https://example.com/1.jpg");
insertVideo.run("video000002", "channel-a", "İkinci Video", "2026-08-02", 1200, "https://www.youtube.com/watch?v=video000002", "https://example.com/2.jpg");
insertVideo.run("video000003", "channel-b", "Üçüncü Video", "2026-08-03", 600, "https://www.youtube.com/watch?v=video000003", "https://example.com/3.jpg");

transcripts.saveSourceTranscript(db, {
  videoId: "video000001",
  source: "youtube",
  language: "tr",
  text: "Portal açıldı ve portal sonra kapandı. Rütbeni korumak için rütbe kavramını açıklıyor. Kral bu videoda ayrıca geçiyor.",
});
transcripts.saveSourceTranscript(db, {
  videoId: "video000002",
  source: "youtube",
  language: "tr",
  text: "ÜZERLİK hakkında ayrı bir cümle var. Portal burada yalnız bir kez geçiyor.",
});
transcripts.saveSourceTranscript(db, {
  videoId: "video000003",
  source: "youtube",
  language: "tr",
  text: "Bu başka kanaldaki portal cümlesidir. Kral burada da anılıyor.",
});

assert.equal(engine.countLiteralOccurrences("Rütbeni ve RÜTBE kavramını düşün.", "rütbe", "contains"), 2);
assert.equal(engine.countLiteralOccurrences("Rütbeni ve RÜTBE kavramını düşün.", "rütbe", "whole-word"), 1);
assert.equal(engine.analyzeTranscript("İlk cümle. Portal burada. Son cümle.", "portal").contexts[0].context, "Portal burada.");
assert.equal(engine.analyzeTranscript("ÜZERLİK burada geçiyor.", "üzerlik").occurrenceCount, 1);

const longTranscript = Array.from({ length: 140 }, (_, index) => index === 70 ? "rütbe" : `kelime${index}`).join(" ");
const longMatch = engine.analyzeTranscript(longTranscript, "rütbe");
assert.equal(longMatch.occurrenceCount, 1);
assert.equal(longMatch.contexts.length, 1);
assert.equal(longMatch.contexts[0].truncated, true);
assert.ok(longMatch.contexts[0].context.length < longTranscript.length / 2);
assert.match(longMatch.contexts[0].context, /rütbe/u);

const independent = search.searchTranscripts(db, {
  terms: ["portal", "rütbe"],
  searchMode: "independent",
  matchMode: "contains",
  sort: "occurrences",
});
assert.equal(independent.transcriptCount, 3);
assert.equal(independent.videoCount, 3);
assert.equal(independent.totalOccurrences, 6);
assert.deepEqual(independent.termStats.map((entry) => [entry.term, entry.videoCount, entry.occurrenceCount]), [
  ["portal", 3, 4],
  ["rütbe", 1, 2],
]);
assert.equal(independent.results[0].videoId, "video000001");
assert.equal(independent.results[0].occurrenceCount, 4);
assert.equal(independent.results[0].terms.find((entry) => entry.term === "portal").contexts[0].occurrenceCount, 2);

const allInVideo = search.searchTranscripts(db, {
  terms: ["portal", "rütbe"],
  searchMode: "all-in-video",
  matchMode: "contains",
});
assert.equal(allInVideo.videoCount, 1);
assert.equal(allInVideo.results[0].videoId, "video000001");
assert.equal(allInVideo.totalOccurrences, 4);

const wholeWord = search.searchTranscripts(db, {
  terms: ["rütbe"],
  channelId: "channel-a",
  matchMode: "whole-word",
});
assert.equal(wholeWord.transcriptCount, 2);
assert.equal(wholeWord.videoCount, 1);
assert.equal(wholeWord.totalOccurrences, 1);

const phrase = search.searchTranscripts(db, { terms: ["portal açıldı"], channelId: "channel-a" });
assert.equal(phrase.videoCount, 1);
assert.equal(phrase.totalOccurrences, 1);

const filtered = search.searchTranscripts(db, { terms: ["portal"], channelId: "channel-a" });
assert.equal(filtered.transcriptCount, 2);
assert.equal(filtered.videoCount, 2);
assert.equal(filtered.totalOccurrences, 3);
assert.equal(filtered.results.some((row) => row.channelId === "channel-b"), false);

const markdown = search.renderMarkdownReport(independent);
assert.match(markdown, /# Channel Foundry — Altyazı Arama Raporu/u);
assert.match(markdown, /\| portal \| 3 \| 4 \|/u);
assert.match(markdown, /### rütbe — 2 kullanım/u);
assert.match(search.reportFilename(independent), /^subtitle-search-portal-rutbe-\d{4}-\d{2}-\d{2}\.md$/u);

assert.throws(() => search.searchTranscripts(db, { terms: [] }), /En az bir/u);
assert.throws(() => search.searchTranscripts(db, { terms: Array.from({ length: 13 }, (_, index) => `terim-${index}`) }), /en fazla 12/u);

console.log("Subtitle analysis v2: ready");
