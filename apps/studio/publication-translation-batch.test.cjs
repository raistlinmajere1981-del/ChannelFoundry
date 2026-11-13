'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const language=require('./publication-languages.cjs'),batch=require('./publication-translation-batch.cjs');
const create=()=>{const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');return db;};
const record=(db,id)=>{language.putSource(db,'video',id,{title:'Başlık '+id,summary:'Özet '+id,description:'Açıklama '+id,core:{}});return language.variants(db,'video',id);};
function approveTr(db,id){const pack=language.variants(db,'video',id);language.save(db,{kind:'video',id,language:'tr',data:pack.source,sourceHash:pack.sourceHash,revision:pack.variants.tr?.revision??0,approved:true});}
function approveEn(db,id){const pack=language.variants(db,'video',id);language.save(db,{kind:'video',id,language:'en',data:{...pack.source,title:'Title '+id},sourceHash:pack.sourceHash,revision:pack.variants.en?.revision??0,approved:true});}
const entry=id=>({kind:'video',id});
test('queue accepts only approved TR with missing/stale EN, deduplicates sources and preserves already-approved EN',async()=>{
 const db=create();record(db,'A');record(db,'B');record(db,'C');approveTr(db,'A');approveTr(db,'B');approveEn(db,'B');
 const result=batch.enqueue(db,{items:[entry('A'),entry('A'),entry('B'),entry('C')]});
 assert.equal(result.queued,1);assert.equal(result.skipped,2);
 const calls=[];
 const worker=batch.createController({database:()=>db,userDataPath:()=>'',generate:async(_db,_path,input)=>{calls.push(input);}});
 worker.recover();worker.start();await worker.whenIdle();
 assert.equal(calls.length,1);assert.equal(calls[0].id,'A');
 assert.equal(worker.current().counts.done,1);assert.equal(language.published(db,'video','B').en.title,'Title B');db.close();
});
test('failed entries persist, retry completes and interrupted in-progress entries recover after restart',async()=>{
 const db=create();record(db,'A');record(db,'B');approveTr(db,'A');approveTr(db,'B');
 let fail=true;
 const generate=async(_db,_path,input)=>{if(fail&&input.id==='A')throw Error('Transient provider failure');};
 const worker=batch.createController({database:()=>db,userDataPath:()=>'',generate});
 worker.queue({items:[entry('A'),entry('B')]});await worker.whenIdle();
 assert.equal(worker.current().counts.failed,1);assert.equal(worker.current().counts.done,1);
 fail=false;worker.retry();await worker.whenIdle();assert.equal(worker.current().counts.done,2);
 db.prepare("UPDATE publication_translation_jobs SET state='running' WHERE id='A'").run();
 const resumed=batch.createController({database:()=>db,userDataPath:()=>'',generate});
 resumed.recover();assert.equal(resumed.current().counts.queued,1);
 resumed.start();await resumed.whenIdle();assert.equal(resumed.current().counts.done,2);db.close();
});
test('pause aborts active generation and keeps job queued for manual resume',async()=>{
 const db=create();record(db,'A');approveTr(db,'A');let attempts=0;
 const worker=batch.createController({database:()=>db,userDataPath:()=>'',generate:async(_db,_path,input)=>{
   attempts++;if(attempts>1)return;
   await new Promise((_resolve,reject)=>input.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 }});
 worker.queue({items:[entry('A')]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(worker.current().counts.running,1);
 worker.pause();await worker.whenIdle();assert.equal(worker.current().counts.queued,1);
 worker.start();await worker.whenIdle();assert.equal(worker.current().counts.done,1);assert.equal(attempts,2);db.close();
});
