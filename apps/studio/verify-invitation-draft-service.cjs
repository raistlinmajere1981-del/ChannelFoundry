"use strict";
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const drafts = require("./invitation-draft-service.cjs");
async function main() {
  const filename=process.argv[2];
  assert(filename,"Supply a temporary SQLite copy; never test on the live user database.");
  assert(filename.startsWith("/tmp/"),"Only disposable /tmp database copies are accepted.");
  const db=new DatabaseSync(filename);
  try {
    drafts.ensureSchema(db);
    db.prepare("DELETE FROM narrative_invitation_drafts").run();
    // The real book now contains all 65 recorded invitations. This test
    // exercises pre-approval authoring only on a mandatory disposable copy.
    // Release invitation 11 *in that copy alone* before testing generation.
    db.prepare("DELETE FROM narrative_invitation_numbers WHERE series_key=? AND invitation_number=11")
      .run(drafts.TARGET_SERIES);
    db.prepare("UPDATE narrative_sections SET state='retired' WHERE key=?")
      .run("narrative-section-dugumlu-invitation-011");
    const beforeSections = db.prepare("SELECT count(*) n FROM narrative_sections").get().n;
    const beforeRevisions = db.prepare("SELECT count(*) n FROM narrative_section_revisions").get().n;
    const beforeRuns = db.prepare("SELECT count(*) n FROM narrative_runs").get().n;
    const items=drafts.listing(db);
    assert.equal(items.length,68);
    assert.deepEqual(items.filter(item=>item.state==="missing").map(item=>item.number),[25,56,66]);
    assert.equal(items.find(item=>item.number===11).state,"unstarted");
    const first=drafts.detail(db,11);
    const second=drafts.detail(db,12);
    assert.deepEqual(drafts.detail(db,53).sourceVideoIds,
      ["gk_MMLQbtV4","DJr6qb4e7Zw"]);
    assert.deepEqual(drafts.detail(db,52).sourceLanguages,["en"]);
    assert(first.originalSubtitle.length>10000);
    assert(first.sourceHash!==second.sourceHash);
    assert.throws(()=>drafts.canonicalSource(db,25),/doğrudan video kaydı/);
    assert.throws(()=>drafts.normalizeResponse({
      title:"Utra ve eski kitap",body:"x".repeat(750),sourceVideoId:second.videoId,invitationNumber:11},first),/kaynak videosunu/);
    assert.throws(()=>drafts.normalizeResponse({
      title:"1. Davet Utra",body:"x".repeat(750),sourceVideoId:first.videoId,invitationNumber:11},first),/ayrı alanında/);
    let chatCalls=0;
    const service=await drafts.generate(db,"/tmp",11,{
      getConfig:()=>({model:"mock-model"}),
      chat:async (_ud,messages,options)=>{
        chatCalls++;
        assert(options.json);
        const prompt=messages[1].content;
        assert(prompt.includes("KAYNAK_VIDEO_ID: "+first.videoId));
        assert(prompt.includes(first.originalSubtitle.slice(0,180)));
        assert(!prompt.includes(second.originalSubtitle.slice(0,180)));
        return {model:"mock-model",content:JSON.stringify({
          invitationNumber:11,sourceVideoId:first.videoId,title:"Utra ve eski kitabın yakılması",
          body:"Davetin başlangıcında geçmişte düğümlenen kitabı konuştuk. ".repeat(28),
          reviewNotes:["Utra adı altyazıyla ayrıca karşılaştırılmalı."],
        })};
      },
    });
    assert.equal(chatCalls,1);
    assert.equal(service.draft.number,11);
    assert.equal(service.reviewNotes.length,1);
    assert.equal(drafts.listing(db)[10].state,"generated");
    assert.equal(drafts.detail(db,11).draft.body,service.draft.body);
    assert.equal(drafts.detail(db,11).draft.reviewNotes.length,1);
    const reviewed=drafts.review(db,{number:11,reviewed:true});
    assert.equal(reviewed.reviewed,true);
    assert.equal(drafts.listing(db)[10].state,"reviewed");
    await assert.rejects(()=>drafts.generate(db,"/tmp",11,{chat:()=>{throw Error("Called unexpectedly");}}),/zaten hazırlanmış/);
    const edited=drafts.update(db,{number:11,title:"Davetli Utra",body:"Davetin başlangıcında eski kitap hakkında konuştuk. ".repeat(7)});
    assert.equal(edited.state,"edited");
    assert.equal(edited.reviewed,false,"Editing a reviewed draft must invalidate the review.");
    assert.equal(drafts.listing(db)[10].state,"edited");
    db.prepare("UPDATE source_transcripts SET text=text||' revised' WHERE external_id=?").run(first.videoId);
    assert.equal(drafts.listing(db)[10].state,"stale");
    assert.throws(()=>drafts.update(db,{number:11,title:"Davetli Utra",body:"y".repeat(700)}),/güncel olmayan/);
    assert.equal(db.prepare("SELECT count(*) n FROM narrative_sections").get().n,beforeSections);
    assert.equal(db.prepare("SELECT count(*) n FROM narrative_section_revisions").get().n,beforeRevisions);
    assert.equal(db.prepare("SELECT count(*) n FROM narrative_runs").get().n,beforeRuns);
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check,"ok");
    console.log("PASS invitation-draft service: source-bound prompt, rejected mismatch, idempotence, stale/edited, and canonical narrative unchanged.");
  }finally{db.close();}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
