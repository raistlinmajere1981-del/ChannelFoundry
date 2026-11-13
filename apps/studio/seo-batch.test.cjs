'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const seo=require('./seo-workspace.cjs'),{controller}=require('./seo-batch.cjs');
const snapshot=()=>({publication:{id:'publication-test',contentFingerprint:'h1',generatedAt:'2026-11-13T00:00:00Z'},journal:{sections:[{sectionId:'s1',locales:{tr:{status:'approved',title:'Birinci hikâye',blocks:[{text:'Birinci kayıt kaynak metni.'}]},en:{status:'approved',title:'First story',blocks:[{text:'English source text.'}]}}},{sectionId:'s2',locales:{tr:{status:'approved',title:'İkinci hikâye',blocks:[{text:'İkinci kayıt kaynak metni.'}]}}}]},youtubeAnalysis:{videos:[]},vefkCatalog:{entries:[]},vefkLanguages:{}});
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'studio-seo-batch-'));
const job=(id,language='tr')=>({kind:'section',id,language});
test('only approved publication sources enqueue, proposal is stored without replacing the published SEO approval',async()=>{
 const root=tmp(),snap=snapshot(),source=seo.defaults(snap)[0];
 seo.update(root,{kind:'section',id:'s1',language:'tr',approved:true,sourceHash:source.sourceHash,title:'Onaylı SEO başlığı',description:'Onaylı SEO açıklaması'},snap);
 const producer=controller({root:()=>root,snapshot:()=>snap,suggest:async(_root,row)=>({title:`Öneri ${row.id}`,description:'AI açıklaması'})});
 const result=producer.enqueue({items:[job('s1'),job('s2'),job('absent')]});
 assert.equal(result.queued,1);assert.equal(result.skipped,2);
 await producer.whenIdle();assert.equal(producer.current().counts.done,1);
 const saved=seo.overview(root,snap).rows.find(row=>row.id==='s2');
 assert.equal(saved.candidate.title,'Öneri s2');assert.equal(saved.needsReview,true);
 assert.equal(seo.overview(root,snap).rows.find(row=>row.id==='s1').title,'Onaylı SEO başlığı');
 fs.rmSync(root,{recursive:true,force:true});
});
test('failed queue can retry and an interrupted job recovers as queued',async()=>{
 const root=tmp(),snap=snapshot();let fail=true;
 const worker=controller({root:()=>root,snapshot:()=>snap,suggest:async()=>{if(fail)throw Error('network');return {title:'Recovered',description:'Generated'};}});
 worker.enqueue({items:[job('s2')]});await worker.whenIdle();assert.equal(worker.current().counts.failed,1);
 fail=false;worker.retry();await worker.whenIdle();assert.equal(worker.current().counts.done,1);
 const q=JSON.parse(fs.readFileSync(path.join(root,'seo-workspaces',fs.readdirSync(path.join(root,'seo-workspaces')).find(x=>x.endsWith('.queue.json'))),'utf8'));
 q.jobs[0].state='running';const filename=path.join(root,'seo-workspaces',fs.readdirSync(path.join(root,'seo-workspaces')).find(x=>x.endsWith('.queue.json')));fs.writeFileSync(filename,JSON.stringify(q));
 const resumed=controller({root:()=>root,snapshot:()=>snap,suggest:async()=>({title:'Recovered',description:'Generated'})});
 resumed.recover();assert.equal(resumed.current().counts.queued,1);resumed.start();await resumed.whenIdle();assert.equal(resumed.current().counts.done,1);
 fs.rmSync(root,{recursive:true,force:true});
});
test('changed source discards generated proposal and prevents stale SEO suggestion',async()=>{
 const root=tmp(),snap=snapshot();let change=()=>{};
 const worker=controller({root:()=>root,snapshot:()=>snap,suggest:async()=>{change();return {title:'Outdated',description:'Outdated'};}});
 change=()=>{snap.journal.sections[1].locales.tr.blocks[0].text='Kaynak değişti.';};
 worker.enqueue({items:[job('s2')]});await worker.whenIdle();
 assert.equal(worker.current().counts.skipped,1);
 assert.equal(seo.overview(root,snap).rows.find(row=>row.id==='s2').candidate,null);
 fs.rmSync(root,{recursive:true,force:true});
});
