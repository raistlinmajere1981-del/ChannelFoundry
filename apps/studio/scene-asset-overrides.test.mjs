import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editableAssets,validateAssetOverrides,webpDimensions} from './scene-asset-overrides.mjs';
import {ALL_PHYSICAL_ART_PATHS} from './scene-physical-art.mjs';
import manifest from '../../channels/birdesengor/web/src/scene/data/study.scene.json' with {type:'json'};
const site=new URL('../../channels/birdesengor/web/public/',import.meta.url);
const physical=path=>readFileSync(new URL('.'+path,site));
const minimalWebp=()=>{
 const bytes=physical('/scene-assets/books/community-live/leather.webp');
 return 'data:image/webp;base64,'+bytes.toString('base64');
};
test('asset replacements are limited to explicit detached image files',()=>{
 const allowed=editableAssets(manifest);
 assert.ok(allowed.has('/scene-assets/robe/ceremonial-kaftan.webp'));
 assert.ok(allowed.has('/scene-assets/stone/jade-rock.webp'));
 assert.ok(!allowed.has('/scene-assets/approved/room-effects-v4-2to1.webp'));
 const path='/scene-assets/robe/ceremonial-kaftan.webp';
 const one=validateAssetOverrides([{path,dataUrl:minimalWebp()}],manifest);
 assert.equal(one.length,1);assert.equal(one[0].bytes.length,physical('/scene-assets/books/community-live/leather.webp').length);
 for(const bad of [
  [{path:'/scene-assets/approved/room-effects-v4-2to1.webp',dataUrl:minimalWebp()}],
  [{path:'../../secret.webp',dataUrl:minimalWebp()}],
  [{path,dataUrl:'https://bad.example/file.webp'}],
  [{path,dataUrl:minimalWebp()},{path,dataUrl:minimalWebp()}],
 ]) assert.throws(()=>validateAssetOverrides(bad,manifest),/kaynağı|Görsel/);
});
test('approved book, camera and drawing assets have real dimensions and never include the room photo',()=>{
 const allowed=editableAssets(manifest);
 for(const path of ALL_PHYSICAL_ART_PATHS){
  assert.ok(allowed.has(path),path);
  assert.ok(webpDimensions(physical(path)).width>0,path);
 }
 assert.ok(!allowed.has('/scene-assets/approved/room-effects-v4-2to1.webp'));
 assert.ok(!allowed.has('/scene-assets/books/scene-closed/evren-master-closed.png'));
 assert.ok(!allowed.has('/scene-assets/vefk/secret.webp'));
 assert.equal(webpDimensions(physical('/scene-assets/books/scene-closed/evren-master-closed.webp')).width,1536);
 assert.equal(webpDimensions(physical('/scene-assets/books/scene-closed/evren-master-closed-en.webp')).height,1024);
});
test('stage rejects fake WebP, wrong aspect ratios and incompatible closed covers',()=>{
 const closed='/scene-assets/books/scene-closed/evren-master-closed.webp';
 const body='/scene-assets/camera/research/camera-body.webp';
 const bookImage=physical(closed),cameraImage=physical(body);
 const toData=buffer=>'data:image/webp;base64,'+buffer.toString('base64');
 const good=validateAssetOverrides([{path:closed,dataUrl:toData(bookImage)}],manifest);
 assert.deepEqual(good[0].bytes,bookImage);
 assert.throws(()=>validateAssetOverrides([{path:closed,dataUrl:toData(physical('/scene-assets/vefk/vellum.webp'))}],manifest),/1536|Kapalı kitap/);
 const fake=Buffer.alloc(24);
 fake.write('RIFF',0);fake.writeUInt32LE(fake.length-8,4);fake.write('WEBP',8);fake.write('VP8L',12);fake.writeUInt32LE(4,16);
 assert.throws(()=>validateAssetOverrides([{path:body,dataUrl:toData(fake)}],manifest),/WebP/);
 const entries=new Map([['public'+body,cameraImage]]);
 const alternate=physical('/scene-assets/vefk/vellum.webp');
 assert.throws(()=>validateAssetOverrides([{path:body,dataUrl:toData(alternate)}],manifest,entries),/en\/boy oranı/);
});
