import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyVefkPublication } from "../../channels/birdesengor/web/src/vefk/verify-publication.js";

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const exportFile=path.join(project,"channels/birdesengor/.local-data/studio/public-export/content/publication.json");
const sceneFile=path.join(project,"channels/birdesengor/web/src/scene/data/study.scene.json");
const scene=JSON.parse(fs.readFileSync(sceneFile,"utf8"));
const disk=JSON.parse(fs.readFileSync(exportFile,"utf8"));
const response=await fetch("http://127.0.0.1:5208/api/publication");
assert.equal(response.status,200,"V2 dev publication API must provide Studio data");
const live=await response.json();
assert.deepEqual(live,disk,"V2 dev API must read exact on-disk Studio export");
const verified=await verifyVefkPublication(live,scene);
assert.equal(verified.status,"ready",JSON.stringify(verified));
assert.equal(verified.entries.length,1);
const {document,player}=verified.entries[0];
assert.equal(document.id,"demo-vefk-5x5-v2");
assert.equal(document.construction.kind,"magicSquare");
assert.equal(document.construction.grid.length,5);
assert.equal(document.drawPlan.strokes.length,document.geometry.paths.length);
assert.equal(document.drawPlan.strokes.length,34);
const before=player.frameAt(0);
const half=player.frameAt(document.drawPlan.strokes[0].startMs+
  document.drawPlan.strokes[0].durationMs/2);
const after=player.frameAt(player.durationMs);
assert.equal(before.complete,false);
assert.ok(before.visibility.every(x=>x.fraction===0));
assert.ok(half.visibility.some(x=>x.fraction>0&&x.fraction<1));
assert.equal(after.complete,true);
assert.ok(after.visibility.every(x=>x.fraction===1));
assert.equal(after.pen.penDown,false);
assert.deepEqual(player.frameAt(half.timeMs),half);
const siteCopy=fs.readFileSync(path.join(project,"channels/birdesengor/web/src/vefk/vefk-site-consumer.mjs"),"utf8");
const studioConsumer=fs.readFileSync(path.join(project,"docs/contracts/vefk-site-consumer.mjs"),"utf8");
assert.equal(siteCopy,studioConsumer,"V2 consumer copy drifted from Studio canonical contract");
console.log(JSON.stringify({
  status:"ready",apiStatus:response.status,code:"Studio verified -> V2 consumer ready",
  documentId:document.id,revision:document.revision,
  paths:document.geometry.paths.length,strokes:document.drawPlan.strokes.length,
  durationSeconds:player.durationMs/1000,
  penTravelPhases:[before.pen.phase,half.pen.phase,after.pen.phase],
  dataHash:document.contentHash,
  publicationFingerprint:live.publication.contentFingerprint,
  siteConsumerSameAsStudio:true,
},null,2));
