"use strict";
const {DatabaseSync}=require("node:sqlite");
const assert=require("node:assert/strict");
const store=require("./narrative-store.cjs");
const filename=process.argv[2];
assert(filename&&filename.startsWith("/tmp/"),"A disposable SQLite copy is mandatory");
const db=new DatabaseSync(filename);
try{
  const before=store.buildInput(db), general=store.latestAppliedRun(db);
  assert(before.changes.length>0);
  const applied=db.prepare("INSERT INTO narrative_runs(state,baseline_run_id,universe_fingerprint,input_fingerprint,input_json,model,applied_at)" +
    "VALUES('applied',?,?,?,?,?,CURRENT_TIMESTAMP)").run(
    before.baselineRunId,general.universeFingerprint,store.fingerprint({probe:true}),
    JSON.stringify({scope:"invitation-editorial-v1",probe:true}),
    "invitation-editorial:baseline-verification");
  const after=store.buildInput(db);
  assert.equal(store.latestAppliedRun(db).id,Number(applied.lastInsertRowid));
  assert.equal(after.baselineRunId,before.baselineRunId);
  assert.equal(after.changes.length,before.changes.length);
  assert.equal(after.removed.length,before.removed.length);
  assert.equal(after.inputFingerprint,before.inputFingerprint);
  console.log("PASS scoped editorial approval run does not consume",before.changes.length,"pending source changes.");
}finally{db.close();}
