import {test} from 'node:test';
import assert from 'node:assert/strict';
import {siteSceneSource} from './scene-workshop-site.mjs';
import {CLOSED_BOOKS} from '../../channels/birdesengor/web/src/book/closedBookLayout.js';

test('the Studio room uses the identical two book portraits and measured web placements',async()=>{
 const site=siteSceneSource(),state=await site.snapshot(),objects=site.roomObjects(state);
 assert.equal(objects.length,4);
 assert.deepEqual(objects.map(item=>item.id),[
   'research-journal','community-journal','camera','vefk-stand',
 ]);
 const bookArt=site.previewArt(state);
 for(const book of CLOSED_BOOKS){
   const item=objects.find(row=>row.id===book.id);
   assert.deepEqual(item,{
     id:book.id,kind:'book',src:book.src,x:book.x,y:book.y,width:book.width,
     angle:book.angle,surfaceScaleY:book.surfaceScaleY??1,
   });
   assert.ok(bookArt.some(art=>art.objectId===book.id&&art.path===book.src));
   assert.ok(state.entries.has('src/book/closedBookLayout.js'),
     'the canonical book layout is included in source revision checks');
   assert.ok(item.x>0&&item.x<1&&item.y>0&&item.y<1);
 }
 for(const id of ['camera','vefk-stand']){
   const item=objects.find(row=>row.id===id);
   const manifest=state.manifest.objects.find(row=>row.id===id);
   assert.equal(item.kind,'device');
   assert.deepEqual(item.foundation,manifest.foundation);
   assert.ok(item.foundation.width>0&&item.foundation.height>0);
 }
 assert.equal(site.readiness(state.scene,state,state.presentation).ready,true);
});
