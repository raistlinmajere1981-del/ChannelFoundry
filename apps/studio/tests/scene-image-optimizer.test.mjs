import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sceneImageProfile,sceneImageDimensions,shouldKeepOriginalWebp,
  summarizeSceneImage,SCENE_IMAGE_MODES,
} from '../src/scene-workspace/scene-image-optimizer.mjs';

test('scene image import selects appropriate automatic media presets',()=>{
  const book=sceneImageProfile('/scene-assets/books/scene-closed/evren-master-closed.webp');
  assert.deepEqual(book.fixedSize,{width:1536,height:1024});
  assert.equal(book.quality,96);
  const backdrop=sceneImageProfile('/scene-assets/approved/room-effects-v4-2to1.webp');
  assert.equal(backdrop.kind,'background');
  assert.equal(backdrop.quality,94);
  const art=sceneImageProfile('/scene-assets/custom/new-artwork.webp');
  assert.equal(art.quality,92);
  assert.equal(art.maxEdge,1536);
  assert.equal(sceneImageProfile('/scene-assets/custom/example.webp',{mode:'compact'}).quality,88);
  assert.equal(sceneImageProfile('/scene-assets/stone/jade-rock.webp',{mode:'detail'}).quality,98);
  assert.equal(sceneImageProfile('/scene-assets/custom/example.webp',{quality:90,maxEdge:2048}).quality,90);
  assert.equal(sceneImageProfile('/scene-assets/custom/example.webp',{quality:0}).quality,92);
  assert.equal(Object.keys(SCENE_IMAGE_MODES).length,3);
});

test('resampling preserves aspect ratio, fixed book dimensions, and room 2:1 contract',()=>{
  const p=sceneImageProfile('/scene-assets/custom/x.webp');
  assert.deepEqual(sceneImageDimensions(800,600,p),{width:800,height:600});
  assert.deepEqual(sceneImageDimensions(3200,2400,p),{width:1536,height:1152});
  assert.deepEqual(sceneImageDimensions(3000,2000,sceneImageProfile('/scene-assets/books/scene-closed/topluluk-master-closed.webp')),
    {width:1536,height:1024});
  assert.throws(()=>sceneImageDimensions(2000,1500,sceneImageProfile('/scene-assets/books/scene-closed/evren-master-closed.webp')),
    /3:2/);
  assert.deepEqual(sceneImageDimensions(4096,2048,sceneImageProfile('/scene-assets/approved/room-effects-v4-2to1.webp')),
    {width:2048,height:1024});
  assert.throws(()=>sceneImageDimensions(1920,1080,sceneImageProfile('/scene-assets/approved/room-effects-v4-2to1.webp')),
    /2:1/);
});

test('already suitable WebP remains original unless the gain is meaningful',()=>{
  const p=sceneImageProfile('/scene-assets/custom/new-artwork.webp');
  assert.equal(shouldKeepOriginalWebp(100000,95000,false,p),true);
  assert.equal(shouldKeepOriginalWebp(100000,60000,false,p),false);
  assert.equal(shouldKeepOriginalWebp(100000,95000,true,p),false);
  assert.match(summarizeSceneImage({originalBytes:100000,outputBytes:60000,
    sourceWidth:1024,outputWidth:1024,outputHeight:512,quality:92,reusedOriginal:false}),/40.*tasarruf/);
});
