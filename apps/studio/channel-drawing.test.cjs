'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const core=require('./vefk-core/index.cjs'),store=require('./vefk-store.cjs'),catalog=require('./vefk-publication.cjs');
const drawing=require('./channel-drawing.cjs'),editorial=require('./ai-analysis-editorial.cjs');
function fixture() {
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  for(const name of ['universe-workspace','narrative-store','visual-completion-store','ai-analysis','youtube-catalog','vefk-publication'])require('./'+name+'.cjs').ensureSchema(db);
  db.exec("INSERT INTO youtube_channels(id,url) VALUES('channel-test','https://www.youtube.com/@test')");
  db.exec('CREATE TABLE source_transcripts(provider TEXT,external_id TEXT,text TEXT,language TEXT)');
  return db;
}
function video(db,id,date,names=['Açık Sponsor']) {
  const hash=require('./publication-languages.cjs').hash;
  db.prepare("INSERT INTO source_ai_analyses(provider,external_id,title,summary,sponsors_json,source_hash) VALUES('youtube',?,?,?,?,?)").run(id,'Başlık','Onaylı özet',JSON.stringify(['Ham aday']),hash({videoId:id,language:'tr',transcript:'Kaynak'}));
  db.prepare("INSERT INTO source_transcripts VALUES('youtube',?,'Kaynak','tr')").run(id);
  db.prepare("INSERT INTO ai_analysis_jobs(provider,external_id,state) VALUES('youtube',?,'done')").run(id);
  db.prepare('INSERT INTO youtube_videos(video_id,channel_id,title,published_at,availability,canonical_url,thumbnail_url) VALUES(?,?,?,?,?,?,?)').run(id,'channel-test','Başlık',date,'public','https://www.youtube.com/watch?v='+id,'https://i.ytimg.com/vi/'+id+'/mqdefault.jpg');
  editorial.saveReview(db,{videoId:id,state:'curated',decisions:{},manualSponsors:names});
  return {videoId:id,publishedAt:date,publicationStatus:'published',analysisStatus:'complete'};
}
test('all artwork and Turkish sponsor glyphs are canonical timed ink, with no raster/text overlays',async()=>{
  const doc=drawing.makeDocument({sponsor:{videoId:'ABCDEFGHIJK',names:['Çağrı & Şule']}});
  assert.equal(core.validateVefk(doc).ok,true);assert.equal(doc.construction.kind,'manualPaths');
  assert.equal(doc.geometry.paths.length,doc.drawPlan.strokes.length);
  assert.ok(doc.geometry.paths.some(p=>p.id.startsWith('portrait.hatch.')));
  assert.equal(doc.geometry.paths.some(p=>p.id.startsWith('ornament.')),false);
  assert.equal(doc.geometry.paths.filter(p=>p.id.startsWith('geometry.ring.')).length,6);
  assert.equal(doc.geometry.paths.filter(p=>p.id.startsWith('geometry.index.')).length,12);
  assert.equal(doc.geometry.paths.filter(p=>p.id.startsWith('geometry.cipher.')).length,8);
  const text=doc.geometry.paths.filter(p=>p.id.startsWith('sponsor.')).map(p=>p.semanticValue).join('');
  assert.match(text,/Çağrı&Şule/);
  for(const p of doc.geometry.paths)assert.match(p.d,/^[MLZ0-9. +\-]+$/);
  const {createVefkPlayer}=await import('../../docs/contracts/vefk-site-consumer.mjs');
  const player=createVefkPlayer(doc);
  assert.ok(player.frameAt(0).visibility.every(p=>p.fraction===0));
  assert.ok(player.frameAt(doc.drawPlan.durationMs).visibility.every(p=>p.fraction===1));
  for(const prefix of ['geometry.','portrait.','sponsor.']) {
    const stroke=doc.drawPlan.strokes.find(s=>s.pathId.startsWith(prefix));
    const frame=player.frameAt(stroke.startMs+stroke.durationMs*.5);
    assert.ok(frame.visibility.find(p=>p.pathId===stroke.pathId).fraction>0);
    assert.ok(frame.visibility.find(p=>p.pathId===stroke.pathId).fraction<1);
    assert.equal(frame.pen.pathId,stroke.pathId);
  }
});
test('large sponsor label and name wrap losslessly within the expanded drawing surface',()=>{
  const names=['Çağrı Şule Çok Uzun Destekçi Adı ve Ortakları','A'.repeat(70)];
  const doc=drawing.makeDocument({sponsor:{videoId:'ABCDEFGHIJK',names}});
  assert.equal(core.validateVefk(doc).ok,true);
  const paths=doc.geometry.paths.filter(p=>p.id.startsWith('sponsor.'));
  assert.equal(paths.map(p=>p.semanticValue).join(''),('Son bölümün destekçisi:'+names.join(' · ')).replace(/\s+/g,''));
  const bounds=ps=>ps.flatMap(p=>Array.from(p.d.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g),m=>[+m[1],+m[2]]));
  for(const [x,y] of bounds(paths)) {
    assert.ok(x>=90 && x<=910,`sponsor x ${x}`);
    assert.ok(y>600 && y<doc.geometry.viewBox[3]-35,`sponsor y ${y}`);
  }
  assert.ok(doc.geometry.viewBox[3]>800,'long names expand the surface');
  const short=drawing.makeDocument({sponsor:{videoId:'ABCDEFGHIJK',names:['Tufan Akkaya']}});
  const namePoints=bounds(short.geometry.paths.filter(p=>p.ink==='sponsorName'));
  assert.ok(Math.max(...namePoints.map(p=>p[1]))-Math.min(...namePoints.map(p=>p[1]))>40,'name uses larger 46-unit outlines');
  assert.equal(core.validateVefk(drawing.makeDocument()).ok,true,'fallback uses the existing document contract');
});
test('portrait and economical seal retain loading proportions and exclude surrounding page content',()=>{
  const fs=require('node:fs');
  const html=fs.readFileSync(require('node:path').join(__dirname,'../../channels/birdesengor/web/index.html'),'utf8');
  const seal=html.match(/<svg class="entrance-seal"[\s\S]*?<\/svg>/)[0];
  const clipRadius=Number(seal.match(/id="entrance-portrait-clip"><circle[^>]*r="([\d.]+)"/)[1]);
  const art=require('./channel-drawing/artwork.json');
  assert.equal(art.sealSource.portraitRadius,clipRadius);
  const doc=drawing.makeDocument();
  const points=p=>Array.from(p.d.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g),m=>[+m[1],+m[2]]);
  for(const path of doc.geometry.paths.filter(p=>p.id.startsWith('geometry.ring.'))) {
    const coordinates=points(path),radius=coordinates[0][0]-500;
    assert.ok(seal.includes(`r="${radius/2}"`),'ring comes from the loading SVG');
    for(const [x,y]of coordinates)assert.ok(Math.abs(Math.hypot(x-500,y-320)-radius)<.02);
  }
  for(const path of doc.geometry.paths.filter(p=>p.id.startsWith('portrait.'))) {
    for(const [x,y]of points(path))assert.ok(Math.hypot(x-500,y-320)<=clipRadius*2+.02,'portrait keeps the source clipping radius');
  }
  assert.equal(doc.drawPlan.markers.find(m=>m.id==='portrait').atMs,19675,'seal timing stays fixed while portrait detail is unrestricted');
  for(const path of art.paths)assert.match(path.id,/^(geometry\.(ring|index|cipher|cardinal|pin)\.|portrait\.(contour|eye|hatch)\.)/);
});
test('detailed photo engraving preserves the approved seal and retains real facial contour coverage',()=>{
  const doc=drawing.makeDocument();
  const seal={paths:doc.geometry.paths.filter(p=>p.id.startsWith('geometry.')),
    inks:{construction:doc.geometry.inkStyles.construction,seal:doc.geometry.inkStyles.seal}};
  // Accepted revision 5: protect its complete geometry and line weights.
  assert.equal(require('./publication-languages.cjs').hash(seal),
    '0c014e7473150cc771342d940ea2d60f5fa6eca82b4ce897a558b481c2c056bd');
  const contours=doc.geometry.paths.filter(p=>p.id.startsWith('portrait.contour.'));
  for(const level of [65,140,205])assert.ok(contours.some(p=>p.id.startsWith(`portrait.contour.${level}.`)));
  const coordinates=contours.flatMap(p=>Array.from(p.d.matchAll(/[ML] ([-\d.]+) ([-\d.]+)/g),m=>[(+m[1]-500)/2.3+80,(+m[2]-320)/2.3+80]));
  for(const [label,x0,y0,x1,y1]of [['eye',55,48,82,67],['nose',36,55,61,81],
    ['mouth',42,89,64,102],['ear',106,62,130,92],['beard',40,80,105,135]]) {
    assert.ok(coordinates.some(([x,y])=>x>=x0&&x<=x1&&y>=y0&&y<=y1),`source contours retain ${label} detail`);
  }
  assert.equal(require('./channel-drawing/artwork.json').portraitSource.method,'photo-engraving');
  assert.equal(core.validateVefk(doc).ok,true,'quality uses the real engine limits, without the retired low-stroke caps');
});
test('only explicit confirmations/manual sponsors from the latest approved published episode count',()=>{
  const db=fixture();try {
    const old=video(db,'ABCDEFGHIJK','2026-01-01',['Eski Sponsor']);
    const last=video(db,'BCDEFGHIJKL','2026-01-02',[]);
    assert.deepEqual(drawing.sponsorFor(db,[old,last]).names,[],'default confirm is not explicit approval');
    const item=editorial.editorialPackage(db,last.videoId).items.find(i=>i.category==='sponsor');
    editorial.saveReview(db,{videoId:last.videoId,state:'curated',decisions:{[item.key]:'confirm'},manualSponsors:['Çağrı']});
    assert.deepEqual(drawing.sponsorFor(db,[old,last]).names,['Ham aday','Çağrı']);
    const future={...last,publishedAt:'2999-01-01'};
    assert.deepEqual(drawing.sponsorFor(db,[old,future]).names,['Eski Sponsor']);
    for(const invalid of [{...last,analysisStale:true},{...last,publicationStatus:'draft'},{...last,membersOnly:true},{...last,analysisStatus:'running'}])assert.equal(drawing.sponsorFor(db,[old,invalid]).videoId,old.videoId);
    editorial.saveReview(db,{videoId:last.videoId,state:'pending',manualSponsors:['Onaysız'],decisions:{}});
    assert.equal(drawing.sponsorFor(db,[old,last]).videoId,old.videoId,'owning review recheck excludes stale allowlist entries');
  }finally{db.close();}
});
test('same identity gets new immutable geometry/timeline revision, idempotent exports, and remains first',()=>{
  const db=fixture();try {
    const source=video(db,'ABCDEFGHIJK','2026-01-01',['İlk Sponsor']);
    const one=drawing.synchronize(db,[source],{install:true});
    const repeated=drawing.synchronize(db,[source]);assert.equal(repeated.revision,one.revision);assert.equal(repeated.changed,false);
    editorial.saveReview(db,{videoId:source.videoId,state:'curated',manualSponsors:['Yeni Sponsor'],decisions:{}});
    const two=drawing.synchronize(db,[source]);assert.equal(two.id,one.id);assert.equal(two.revision,one.revision+1);
    assert.notEqual(two.document.geometry.paths.at(-1).d,one.document.geometry.paths.at(-1).d);
    assert.notEqual(two.document.drawPlan.durationMs,one.document.drawPlan.durationMs);
    assert.equal(store.getDocument(db,one.id,one.revision).contentHash,one.document.contentHash);
    const absent=drawing.synchronize(db,[]);assert.equal(absent.revision,two.revision,'unverified/future episode never clears current sponsor');
    const extra=core.createVefk({id:'aaa-future-work',title:'Serbest çalışma',kind:'manualPaths',geometry:{coordinateSpace:'svg-viewBox',viewBox:[0,0,100,100],paths:[{id:'one',d:'M 10 10 L 90 90',ink:'glyph'}],inkStyles:{glyph:{width:1,cap:'round'}}}});
    store.saveDraft(db,{document:extra});for(const status of ['checked','approved'])store.setReviewState(db,{id:extra.id,revision:1,status,expectedContentHash:extra.contentHash});
    catalog.select(db,{id:extra.id,revision:1,contentHash:extra.contentHash,enabled:true,sortOrder:0});
    const published=catalog.buildCatalog(db);assert.equal(published.entries[0].id,drawing.ID);assert.equal(published.entries[1].id,extra.id);assert.equal(catalog.validateCatalog(published).ok,true);
  }finally{db.close();}
});
test('normal publication build synchronizes sponsor and signed catalog; unpublished translations cannot change it',()=>{
  const db=fixture();try {
    const source=video(db,'ABCDEFGHIJK','2026-01-01',['Yayın Sponsoru']);
    drawing.synchronize(db,[],{install:true});
    const approve=require('./tests/fixtures/approve-publication-text.cjs').approveFixtureText;
    approve(db);
    const publication=require('./publication-v2.cjs');
    const first=publication.buildPublicationV2(db).snapshot;
    assert.equal(first.vefkCatalog.entries[0].revision,2);
    assert.match(first.vefkCatalog.entries[0].document.accessibility.matrixText,/Yayın Sponsoru/);
    assert.equal(first.vefkLanguages[drawing.ID].tr.title,'Sponsorluk');
    const last=video(db,'BCDEFGHIJKL','2026-01-02',['Henüz Yayınlanmayan']);
    const unchanged=publication.buildPublicationV2(db).snapshot;
    assert.equal(unchanged.vefkCatalog.entries[0].revision,2);
    assert.ok(!unchanged.youtubeAnalysis.videos.some(v=>v.videoId===last.videoId));
    approve(db);
    const next=publication.buildPublicationV2(db).snapshot;
    assert.equal(next.vefkCatalog.entries.length,1);assert.equal(next.vefkCatalog.entries[0].id,drawing.ID);
    assert.equal(next.vefkCatalog.entries[0].revision,3);assert.match(next.vefkCatalog.entries[0].document.accessibility.matrixText,/Henüz Yayınlanmayan/);
  }finally{db.close();}
});
test('unsupported sponsor glyphs fail explicitly rather than silently changing the final drawing',()=>{
  assert.throws(()=>drawing.makeDocument({sponsor:{videoId:'ABCDEFGHIJK',names:['漢字']}}),/konturu bulunamadı/);
});
