const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { publicVideoSummaries } = require('./ai-analysis-public.cjs');
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE source_ai_analyses (provider TEXT, external_id TEXT, title TEXT, summary TEXT,core_json TEXT DEFAULT '{}',source_hash TEXT DEFAULT '');
    CREATE TABLE source_transcripts(provider TEXT, external_id TEXT, text TEXT, language TEXT);
    CREATE TABLE ai_analysis_jobs (provider TEXT, external_id TEXT, state TEXT);
    CREATE TABLE ai_analysis_editorial_reviews (provider TEXT, external_id TEXT, state TEXT);
    CREATE TABLE youtube_videos (video_id TEXT, title TEXT, thumbnail_url TEXT, published_at TEXT, duration_seconds INTEGER, availability TEXT);`);
  return db;
}
function insert(db, id, {job='done', review='curated', summary='Completed analysis', title='Recorded title', duration=2490}={}) {
  db.prepare('INSERT INTO source_ai_analyses(provider,external_id,title,summary) VALUES (?,?,?,?)').run('youtube',id,title,summary);
  db.prepare('INSERT INTO source_transcripts VALUES(?,?,?,?)').run('youtube',id,'Source transcript','tr');
  if(job) db.prepare('INSERT INTO ai_analysis_jobs VALUES (?,?,?)').run('youtube',id,job);
  if(review) db.prepare('INSERT INTO ai_analysis_editorial_reviews VALUES (?,?,?)').run('youtube',id,review);
  db.prepare('INSERT INTO youtube_videos VALUES (?,?,?,?,?,?)').run(id,title,`https://i.ytimg.com/vi/${id}/mqdefault.jpg`,'2026-10-29',duration,'public');
}
test('camera snapshot includes only completed nonexcluded summaries, independent of channel catalogue size', () => {
  const db=database();
  insert(db,'7dGze_PSSEs');
  insert(db,'wAS9BQ1i-wA',{job:'running'});
  insert(db,'ABCDEFGHIJK',{job:'error'});
  insert(db,'BCDEFGHIJKL',{job:null});
  insert(db,'CDEFGHIJKLM',{summary:'  \n '});
  insert(db,'DEFGHIJKLMN',{review:'excluded'});
  insert(db,'EFGHIJKLMNO',{title:''});
  db.prepare('INSERT INTO youtube_videos VALUES (?,?,?,?,?,?)').run('FGHIJKLMNOP','Unanalyzed channel video','','2026-10-31',123,'public');
  const rows=publicVideoSummaries(db);
  assert.equal(rows.length,1);assert.equal(rows[0].videoId,'7dGze_PSSEs');
  assert.equal(rows[0].analysisStatus,'complete');assert.equal(rows[0].publicationStatus,'published');
  assert.equal(rows[0].title,'Recorded title');assert.equal(rows[0].durationSeconds,2490);
  assert.equal(rows[0].publishedAt,'2026-10-29');assert.equal(rows[0].thumbnailUrl,'https://i.ytimg.com/vi/7dGze_PSSEs/mqdefault.jpg');db.close();
});
test('publishing preserves the full summary and paragraph breaks', () => {
  const db=database();const summary=('Long paragraph about the recording. '.repeat(100))+'\n\nSecond paragraph.';
  insert(db,'7dGze_PSSEs',{summary,duration:null});const [row]=publicVideoSummaries(db);
  assert.equal(row.summary,summary);assert.equal(row.durationSeconds,null);db.close();
});
