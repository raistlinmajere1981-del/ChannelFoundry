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
  text: "Portal açıldı ve portal sonra kapandı. Rütbeni korumak için rütbe kavramını açıklıyor. Son cümlede başka bir konu var.",
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
  text: "Bu başka kanaldaki portal cümlesidir.",
});

assert.equal(engine.countLiteralOccurrences("Rütbeni ve RÜTBE kavramını düşün.", "rütbe"), 2);
assert.equal(engine.analyzeTranscript("İlk cümle. Portal burada. Son cümle.", "portal").sentences[0].sentence, "Portal burada.");
assert.equal(engine.analyzeTranscript("ÜZERLİK burada geçiyor.", "üzerlik").occurrenceCount, 1);

const all = search.searchTranscripts(db, { query: "portal" });
assert.equal(all.transcriptCount, 3);
assert.equal(all.videoCount, 3);
assert.equal(all.totalOccurrences, 4);
assert.equal(all.results.find((row) => row.videoId === "video000001").sentences[0].sentence, "Portal açıldı ve portal sonra kapandı.");
assert.equal(all.results.find((row) => row.videoId === "video000001").sentences[0].occurrenceCount, 2);

const filtered = search.searchTranscripts(db, { query: "portal", channelId: "channel-a" });
assert.equal(filtered.transcriptCount, 2);
assert.equal(filtered.videoCount, 2);
assert.equal(filtered.totalOccurrences, 3);
assert.equal(filtered.results.some((row) => row.channelId === "channel-b"), false);

const suffix = search.searchTranscripts(db, { query: "rütbe", channelId: "channel-a" });
assert.equal(suffix.videoCount, 1);
assert.equal(suffix.totalOccurrences, 2);
assert.match(suffix.results[0].sentences[0].sentence, /Rütbeni.*rütbe/u);

assert.throws(() => search.searchTranscripts(db, { query: "   " }), /Aranacak kelime/u);
console.log("Subtitle analysis: ready");
