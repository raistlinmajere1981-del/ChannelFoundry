import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {siteSceneSource,BIRDESENGOR_SITE} from '../scene-workshop-site.mjs';
import {buildVideoCatalog,trustedThumbnailUrl} from '../../../channels/birdesengor/web/src/camera/videoCatalog.js';
import {resolve} from 'node:path';
test('Studio camera cover reads only valid published complete local export, never a draft',()=>{
  const filename=resolve(BIRDESENGOR_SITE,'../.local-data/studio/public-export/content/publication.json');
  const actual=siteSceneSource().cameraCover();
  if(!existsSync(filename)){
    assert.equal(actual,null,'unpublished or absent local export does not create imaginary cover');
    return;
  }
  const data=JSON.parse(readFileSync(filename,'utf8'));
  const expected=buildVideoCatalog(data).videos.find(v=>v.thumbnailUrl);
  assert.deepEqual(actual,expected?{
    url:expected.thumbnailUrl,videoId:expected.videoId,publishedAt:expected.publishedAt
  }:null);
  if(actual)assert.equal(trustedThumbnailUrl(actual.url,actual.videoId),actual.url);
});
test('preview is optional for an isolated site root, with no API or fetch dependency',()=>{
  assert.equal(siteSceneSource('/tmp/scene-v47-isolated-site-root').cameraCover(),null);
});
