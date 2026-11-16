"use strict";
/** Final read-only verification of Düğümlü 1–68 book structure and primary provenance. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {DatabaseSync}=require("node:sqlite");
const narrative=require("./narrative-store.cjs");
const sourcePath=path.resolve(__dirname,"../../channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const inventory=require(path.resolve(__dirname,"../../channels/birdesengor/.local-data/studio/invitation-inventory.json"));
const db=new DatabaseSync(sourcePath,{readOnly:true});
try{
 const records=db.prepare("SELECT invitation_number num,section_key sectionKey FROM narrative_invitation_numbers WHERE series_key='topic-series-dugumlu-kitap' ORDER BY invitation_number").all();
 const expected=Array.from({length:68},(_,i)=>i+1).filter(x=>![25,56,66].includes(x));
 assert.deepEqual(records.map(r=>r.num),expected);
 const section=db.prepare("SELECT r.title,r.body,r.state,r.source_video_ids_json videos,s.state sectionState FROM narrative_sections s JOIN narrative_section_revisions r ON r.id=s.current_revision_id WHERE s.key=?");
 let dual=0,sourceChars=0;
 for(const {num,sectionKey} of records){
  const d=section.get(sectionKey);assert(d&&d.state==="approved"&&d.sectionState==="active",num);
  const v=JSON.parse(d.videos),matches=inventory.invitations[num-1].primary.map(x=>x.videoId);
  assert.deepEqual(v,matches,"Source video identities must match direct original recordings #"+num);
  if(v.length>1)dual++;
  sourceChars+=d.body.length;
  assert(!/(?:bu (?:paragrafı|cümleyi).*(?:taşı|çıkar)|metinden çıkar|source excerpt|editoryal inceleme gerekir)/iu.test(d.body),
    "Editorial instructions leaked into approved narrative #"+num);
 }
 assert.equal(dual,2);
 const lang52=db.prepare("SELECT language FROM source_transcripts WHERE external_id=?").get(inventory.invitations[51].primary[0].videoId);
 assert.equal(lang52.language,"en");
 const groups=db.prepare("SELECT ch.key,ch.title,count(*) count FROM narrative_section_chapters sc JOIN narrative_chapters ch ON ch.key=sc.chapter_key WHERE ch.series_key='topic-series-dugumlu-kitap' GROUP BY ch.key ORDER BY ch.position").all();
 assert.deepEqual(groups.map(x=>[x.title,x.count]),[["Davetler",65],["Ara Kayıtlar",8]]);
 assert.equal(db.prepare("SELECT count(*) n FROM narrative_sections").get().n,105);
 const alias=db.prepare("SELECT count(*) n FROM publication_language_variants WHERE kind='section' AND language='tr' AND state='approved' AND json_extract(data_json,'$.title') LIKE 'Önceki Kayıt — %'").get().n;
 assert.equal(alias,4);
 const tr=db.prepare("SELECT count(*) n FROM publication_language_variants WHERE kind='section' AND language='tr' AND state='approved'").get().n;
 assert.equal(tr,105);
 const approved=db.prepare("SELECT count(*) n FROM narrative_section_revisions WHERE state='approved'").get().n;
 assert.equal(approved,105);
 assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(),[]);
 assert.equal(db.prepare("PRAGMA quick_check").get().quick_check,"ok");
 const input=narrative.buildInput(db);
 assert.equal(input.changes.length,3930,"Existing global Universe backlog must remain unconsumed");
 console.log("PASS Düğümlü final readiness",JSON.stringify({
  numberedDirect:records.length,missingDirect:[25,56,66],dualVideoChapters:dual,
  enSubtitleNumber:52,approvedNarratives:approved,approvedTurkish:tr,
  sourceBasedNarrativeChars:sourceChars,chapters:groups.map(x=>({title:x.title,count:x.count})),
  archiveTitleAliases:alias,pendingUniverseDelta:input.changes.length,integrity:"ok"
 }));
}finally{db.close()}
