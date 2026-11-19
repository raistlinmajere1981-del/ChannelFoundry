"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const lang=require('./publication-languages.cjs'),toc=require('./publication-toc.cjs');
test('TOC heading is independent of English article body and invalidates on title source change',()=>{
 const db=new DatabaseSync(':memory:');
 const tr={title:'Şira Daveti',blocks:[{type:'paragraph',spans:[{type:'text',text:'Davet metni.'}]}],sourceVideoIds:[],media:[]};
 const h=lang.putSource(db,'section','s1',tr);
 lang.save(db,{kind:'section',id:'s1',language:'tr',sourceHash:h,revision:0,approved:true,data:tr});
 toc.put(db,'section','s1',tr.title,'The Şira Summoning');
 assert.deepEqual(toc.published(db,'section','s1'),{en:{title:'The Şira Summoning'}});
 assert.deepEqual(lang.published(db,'section','s1').en,undefined);
 assert.throws(()=>toc.put(db,'section','s1','Different title','Broken'),/changed/);
 const snapshot={journal:{sections:[{sectionId:'s1'}],outline:{series:[]}}};
 toc.attach(db,snapshot);
 assert.equal(snapshot.journal.sections[0].tocLocales.en.title,'The Şira Summoning');
 lang.putSource(db,'section','s1',{...tr,title:'Başka Davet'});
 assert.deepEqual(toc.published(db,'section','s1'),{});
 db.close();
});
