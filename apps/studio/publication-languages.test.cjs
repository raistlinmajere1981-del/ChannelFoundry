const test=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const language=require('./publication-languages.cjs');
function setup(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');language.putSource(db,'video','ABCDEFGHIJK',{title:'Kaynak başlık',summary:'Kaynağın özeti.',description:'Kaynak açıklaması.',core:{objects:[{name:'Vefk',symbols:'ابج'}]},sourceVersion:'s1'});return db;}
function manual(db,lang,title='Title'){const pack=language.variants(db,'video','ABCDEFGHIJK');return language.save(db,{kind:'video',id:pack.id,language:lang,sourceHash:pack.sourceHash,revision:pack.variants[lang]?.revision||0,approved:true,data:{...pack.source,title,summary:lang==='en'?'Summary.':'Özet.'}});}
const client={parseAssistantJson:JSON.parse,chat:async(_root,messages)=>{const payload=JSON.parse(messages[1].content);return {model:'test-provider/model',content:JSON.stringify({fields:payload.fields.map(field=>({...field,text:field.path.at(-1)==='title'?'Generated title':field.path.at(-1)==='summary'?'Generated summary.':field.text}))})};}};
test('AI EN generation requires approved TR and translates the approved copy rather than raw analysis source',async()=>{
 const db=setup(),calls=[];
 await assert.rejects(language.generate(db,'',{kind:'video',id:'ABCDEFGHIJK',language:'en'},client),/Türkçe yayın metni onaylanmalı/);
 manual(db,'tr','Onaylanan Türkçe başlık');
 const spy={...client,chat:async(...args)=>{calls.push(args[1]);return client.chat(...args);}};
 await language.generate(db,'',{kind:'video',id:'ABCDEFGHIJK',language:'en'},spy);
 const pack=language.variants(db,'video','ABCDEFGHIJK');
 assert.equal(pack.variants.tr.state,'approved');assert.equal(pack.variants.en.state,'draft');
 assert.equal(JSON.parse(calls[0][1].content).fields.find(f=>f.path.at(-1)==='title').text,'Onaylanan Türkçe başlık');
 assert.deepEqual(language.published(db,'video',pack.id).tr.title,'Onaylanan Türkçe başlık');
 db.close();
});
test('regenerating one language stages a candidate and preserves manual approved texts in both languages',async()=>{const db=setup();manual(db,'tr','El ile düzenlenen başlık');manual(db,'en','Manually approved');const approvedBefore=language.published(db,'video','ABCDEFGHIJK');await language.generate(db,'',{kind:'video',id:'ABCDEFGHIJK',language:'en'},client);const pack=language.variants(db,'video','ABCDEFGHIJK');assert.equal(pack.variants.tr.data.title,'El ile düzenlenen başlık');assert.equal(pack.variants.en.data.title,'Manually approved');assert.equal(pack.variants.en.state,'approved');assert.equal(pack.variants.en.candidate.title,'Generated title');assert.deepEqual(language.published(db,'video',pack.id),approvedBefore,'Unaccepted candidates must not change approved publication/SEO revisions');assert.equal(language.published(db,'video',pack.id).en.core,undefined);db.close();});
test('changed source versions invalidate both languages, retain prose, and reject stale or concurrent approval',()=>{const db=setup();const previous=manual(db,'tr');manual(db,'en');language.putSource(db,'video',previous.id,{...previous.source,sourceVersion:'s2'});const pack=language.variants(db,'video',previous.id);assert(pack.variants.tr.stale&&pack.variants.en.stale);assert.deepEqual(language.published(db,'video',pack.id),{});assert.throws(()=>language.save(db,{kind:'video',id:pack.id,language:'en',sourceHash:previous.sourceHash,revision:1,data:pack.source,approved:true}),/değişti/);db.close();});
test('missing fields, structural drift, reference IDs and Arabic symbols cannot be silently changed',async()=>{const db=setup();const pack=language.variants(db,'video','ABCDEFGHIJK');assert.throws(()=>language.validateData(pack.source,{...pack.source,summary:''}),/eksik/);assert.throws(()=>language.validateData(pack.source,{...pack.source,sourceVersion:'different'}),/kimliği/);assert.throws(()=>language.validateData(pack.source,{...pack.source,core:{}}),/çözümleme/);const broken={...client,chat:async()=>({content:'{}'})};await assert.rejects(language.generate(db,'',{kind:'video',id:pack.id,language:'en'},broken));assert.equal(language.variants(db,'video',pack.id).variants.en.jobState,'error');assert.deepEqual(language.published(db,'video',pack.id),{});db.close();});

test('interrupted generation becomes a visible failure while prior approved text is retained',()=>{const db=setup();manual(db,'tr','Onaylı Türkçe');manual(db,'en','Approved text');db.exec("UPDATE publication_language_variants SET job_state='running' WHERE language='en'");assert.equal(language.resetInterrupted(db),1);const pack=language.variants(db,'video','ABCDEFGHIJK');assert.equal(pack.variants.en.data.title,'Approved text');assert.equal(pack.variants.en.state,'approved');assert.equal(pack.variants.en.jobState,'error');assert.match(pack.variants.en.error,/yarıda/);db.close();});
test('large immutable core never enters translation requests and multiple batches are safely merged',async()=>{
  const db=setup(), pack=language.variants(db,'video','ABCDEFGHIJK');
  language.putSource(db,'video',pack.id,{...pack.source,core:{large:'SOURCE-CORE-SENTINEL'.repeat(6000)},blocks:[{text:'Bir '.repeat(1200)},{text:'İki '.repeat(1200)}]});
  const payloads=[],spy={...client,chat:async(...args)=>{payloads.push(args[1][1].content);return client.chat(...args);}};
  manual(db,'tr','Onaylı Türkçe');
  await language.generate(db,'',{kind:'video',id:pack.id,language:'en'},spy);
  assert(payloads.length>=2);
  assert(payloads.every(payload=>payload.length<8100&&!payload.includes('SOURCE-CORE-SENTINEL')));
  const final=language.variants(db,'video',pack.id).variants.en.data;
  assert.equal(final.core.large.length, 'SOURCE-CORE-SENTINEL'.length*6000);
  assert.equal(final.blocks.length,2);
  assert.equal(final.summary,'Generated summary.');
  db.close();
});

test('descriptive object and location records may carry a localized display label without changing identity',()=>{
  const db=setup();
  const entity=id=>language.variants(db,'entity',id);
  language.putSource(db,'entity','entity-object',{name:'Kapsız Kitap',kind:'object',summary:'Deri kaplaması olmayan kitap.',details:[],sourceVideoIds:[]});
  language.putSource(db,'entity','entity-character',{name:'Kral Arohan',kind:'character',summary:'Babil kralı.',details:[],sourceVideoIds:[]});
  const object=entity('entity-object'),character=entity('entity-character');
  language.save(db,{kind:'entity',id:'entity-object',language:'tr',sourceHash:object.sourceHash,revision:0,approved:true,data:object.source});
  language.save(db,{kind:'entity',id:'entity-object',language:'en',sourceHash:object.sourceHash,revision:0,approved:true,data:{...object.source,summary:'A book without a leather cover.',displayName:'The Coverless Book'}});
  assert.equal(entity('entity-object').source.name,'Kapsız Kitap','Canonical identity must never be renamed');
  assert.equal(language.published(db,'entity','entity-object').en.displayName,'The Coverless Book');
  assert.equal(language.published(db,'entity','entity-object').en.name,'Kapsız Kitap');
  language.save(db,{kind:'entity',id:'entity-character',language:'tr',sourceHash:character.sourceHash,revision:0,approved:true,data:character.source});
  language.save(db,{kind:'entity',id:'entity-character',language:'en',sourceHash:character.sourceHash,revision:0,approved:true,data:character.source});
  assert.throws(()=>language.save(db,{kind:'entity',id:'entity-character',language:'en',sourceHash:character.sourceHash,revision:1,approved:true,data:{...character.source,displayName:'King Arohan'}}),/Görünen ad/);
  const objectEn=entity('entity-object').variants.en;
  assert.throws(()=>language.save(db,{kind:'entity',id:'entity-object',language:'en',sourceHash:object.sourceHash,revision:objectEn.revision,approved:true,data:{...object.source,displayName:'   '}}),/Görünen ad/);
  db.close();
});

test('inline reference identity is immutable while its visible label follows the translated prose',()=>{
  const db=setup();
  const original={blocks:[{type:'paragraph',spans:[{type:'text',text:'Dün '},{type:'reference',entityId:'entity-1',label:'eski dostumla'},{type:'text',text:' görüştüm.'}]}]};
  const translated={blocks:[{type:'paragraph',spans:[{type:'text',text:'Yesterday '},{type:'reference',entityId:'entity-1',label:'with my old friend'},{type:'text',text:' I spoke.'}]}]};
  assert.doesNotThrow(()=>language.validateData(original,translated));
  assert.throws(()=>language.validateData(original,{blocks:[{type:'paragraph',spans:[{type:'text',text:'Yesterday '},{type:'reference',entityId:'entity-2',label:'with my old friend'},{type:'text',text:' I spoke.'}]}]}),/Kaynak referansı/);
  db.close();
});

test('editing approved Turkish text invalidates English without deleting its approved data',()=>{
 const db=setup();manual(db,'tr','İlk Türkçe');manual(db,'en','First English');
 let pack=language.variants(db,'video','ABCDEFGHIJK');
 assert(!pack.variants.en.stale);
 language.save(db,{kind:'video',id:pack.id,language:'tr',sourceHash:pack.sourceHash,revision:pack.variants.tr.revision,approved:true,data:{...pack.variants.tr.data,title:'Güncel Türkçe'}});
 pack=language.variants(db,'video','ABCDEFGHIJK');
 assert(pack.variants.en.stale);assert.equal(pack.variants.en.data.title,'First English');
 assert(!language.published(db,'video',pack.id).en);
 db.close();
});
test('existing SQLite bilingual approvals migrate without being erased or marked stale',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 db.exec(`CREATE TABLE publication_language_sources(kind TEXT NOT NULL,id TEXT NOT NULL,source_hash TEXT NOT NULL,data_json TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(kind,id)) STRICT;
 CREATE TABLE publication_language_variants(
 kind TEXT NOT NULL,id TEXT NOT NULL,language TEXT NOT NULL CHECK(language IN ('tr','en')),
 source_hash TEXT NOT NULL,data_json TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('draft','approved')),
 revision INTEGER NOT NULL DEFAULT 1,approved_revision INTEGER NOT NULL DEFAULT 0,
 manual INTEGER NOT NULL DEFAULT 0,model TEXT NOT NULL DEFAULT '',prompt_version TEXT NOT NULL DEFAULT '',
 candidate_json TEXT,error TEXT NOT NULL DEFAULT '',job_state TEXT NOT NULL DEFAULT '' CHECK(job_state IN ('','running','done','error')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(kind,id,language)) STRICT;`);
 const original={title:'Eski başlık',summary:'Özet',description:'Açıklama',core:{}};
 const hash=language.hash(original);
 db.prepare('INSERT INTO publication_language_sources(kind,id,source_hash,data_json) VALUES(?,?,?,?)').run('video','oldvideo',hash,JSON.stringify(original));
 const insert=db.prepare(`INSERT INTO publication_language_variants(kind,id,language,source_hash,data_json,state,revision,approved_revision,manual) VALUES(?,?,?,?,?,'approved',1,1,1)`);
 insert.run('video','oldvideo','tr',hash,JSON.stringify(original));
 insert.run('video','oldvideo','en',hash,JSON.stringify({...original,title:'Old title'}));
 language.ensureSchema(db);
 let pack=language.variants(db,'video','oldvideo');
 assert.equal(pack.variants.en.state,'approved');assert.equal(pack.variants.en.stale,false);
 assert.equal(language.published(db,'video','oldvideo').en.title,'Old title');
 language.save(db,{kind:'video',id:'oldvideo',language:'tr',sourceHash:hash,revision:1,approved:true,data:{...original,title:'Değişen Türkçe'}});
 pack=language.variants(db,'video','oldvideo');assert.equal(pack.variants.en.stale,true);
 assert.equal(pack.variants.en.data.title,'Old title');db.close();
});
