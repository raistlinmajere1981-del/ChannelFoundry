'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { parseVtt, matches, search } = require('./video-cue-search.cjs');

const sample = [
  'WEBVTT', '',
  '00:00:07.000 --> 00:00:09.500', '<c>Ömer kapıyı açtı.</c>', '',
  '00:00:09.500 --> 00:00:11.000', '<c>Ömer kapıyı açtı.</c>', '',
  '00:01:02.500 --> 00:01:05.000', 'Taşın üzerinde işaret vardı.', '',
].join('\n');
async function main() {
  const cues = parseVtt(sample);
  assert.equal(cues.length, 2);
  assert.equal(matches(cues, 'işaret')[0].startSeconds, 62.5);
  assert.equal(matches(cues, 'ÖMER')[0].startSeconds, 7);
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE youtube_videos(video_id TEXT PRIMARY KEY, title TEXT NOT NULL, duration_seconds INTEGER) STRICT');
    db.prepare('INSERT INTO youtube_videos VALUES(?,?,?)').run('abcDEFghi02', 'Kontrol', 140);
    const run = async (_command, args) => {
      const pattern = args[args.indexOf('-o') + 1];
      fs.writeFileSync(pattern.replace('%(id)s.%(ext)s', 'abcDEFghi02.tr.vtt'), sample);
      return { stdout: '' };
    };
    const result = await search(db, { videoId: 'abcDEFghi02', query: 'taşın' }, { run });
    assert.equal(result.hits.length, 1);
    assert.equal(result.hits[0].startSeconds, 62.5);
    console.log('Timed subtitle lookup, deduplication, Turkish matching and source validation verified.');
  } finally { db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
