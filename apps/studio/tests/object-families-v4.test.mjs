import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {siteSceneSource} from '../scene-workshop-site.mjs';
import {OBJECT_FAMILIES_V4,objectFamilyReport,familyForObject} from '../src/scene-workspace/object-families-v4.mjs';
import {webpDimensions} from '../scene-asset-overrides.mjs';
const source=siteSceneSource();
test('14 canonical objects have a physical migration family and exact effect anchors',async()=>{
  const snapshot=await source.snapshot();
  const visuals=source.objectVisuals(snapshot);
  const report=objectFamilyReport(snapshot.scene,visuals);
  assert.equal(report.entries.length,14);
  assert.equal(report.verifiedSources,14);
  assert.equal(OBJECT_FAMILIES_V4.length,14);
  assert.deepEqual(report.counts,{independent:14,partial:0,'needs-art':0});
  assert.deepEqual(report.extras,[]);
  assert.equal(report.entries.reduce((n,e)=>n+e.effects.length,0),22);
  assert.equal(report.entries.reduce((n,e)=>n+e.enabledEffectCount,0),14);
  for(const family of report.entries){
    assert.equal(family.id,familyForObject(family.id).id);
    assert.ok(family.activeAnchors.length);
    assert.ok(family.parts.every(p=>typeof p.label==='string'&&p.label.length>3));
    assert.ok(family.plannedAnchors.every(id=>!family.activeAnchors.includes(id)||id.includes('rear-hinge')===false));
  }
  assert.deepEqual(report.entries.find(e=>e.id==='stone-specimen').missingAnchors,[]);
  const tabletop=report.entries.find(e=>e.id==='vefk-stand');
  assert.equal(tabletop.stage,'independent');
  assert.ok(tabletop.parts.some(p=>p.id==='chassis'&&p.state==='ready'));
  assert.ok(tabletop.parts.some(p=>p.asset==='/scene-assets/vefk/chassis-tabletop.webp'));

  const chest=report.entries.find(e=>e.id==='archive-chest');
  assert.ok(chest.activeAnchors.includes('archive-chest.rear-hinge'));
  assert.ok(chest.parts.some(part=>part.id==='interior'&&part.state==='ready'&&
    part.asset==='/scene-assets/chest/interior-light-mask.webp'));
  const tampered=structuredClone(visuals);
  tampered.find(v=>v.id==='water-basin').asset='/scene-assets/other/changed.webp';
  assert.throws(()=>objectFamilyReport(snapshot.scene,tampered),/yanlış kaynak/);
});
test('sole 2:1 master and five source-verified independent materials',async()=>{
  const state=await source.snapshot(),preview=source.previewObjects(state);
  assert.equal(source.readiness(state.scene,state).ready,true);
  for(const id of ['guardian-sword-left','guardian-sword-right','water-basin','candle','incense-holder']){
    const cutout=preview.find(entry=>entry.objectId===id);
    assert.ok(cutout,id+' must exist in preview');
    assert.ok(cutout.image.startsWith('data:image/webp;base64,'));
    assert.equal(cutout.previewOnly,undefined);
  }
  const master=readFileSync(new URL('../../../channels/birdesengor/web/public/scene-assets/approved/room-effects-v4-2to1.webp',import.meta.url));
  assert.deepEqual(webpDimensions(master),{width:1774,height:887});
  const previewBlob=await source.preview(state);
  assert.deepEqual(Buffer.from(previewBlob.replace(/^data:image\/webp;base64,/,''),'base64'),master);
});
