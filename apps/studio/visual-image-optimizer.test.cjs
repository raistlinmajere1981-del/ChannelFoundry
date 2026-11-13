'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sharp=require('sharp');
const {randomBytes}=require('node:crypto');
const {optimizeImage,OUTPUT_LIMIT}=require('./visual-image-optimizer.cjs');
const {dimensions}=require('./image-dimensions.cjs');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'studio-visual-opt-'));

test('large PNG manually imported becomes bounded portrait WebP with original unchanged',async()=>{
 const dir=temp(),source=path.join(dir,'huge.png'),dest=path.join(dir,'visual-assets','portrait.webp');
 try{
  await sharp({create:{width:2350,height:1730,channels:4,background:{r:244,g:231,b:217,alpha:0.72}}}).png().toFile(source);
  const before=fs.readFileSync(source),info=await optimizeImage(source,dest);
  assert.equal(info.format,'webp');assert.equal(info.inputBytes,before.length);
  assert(info.width<=1280&&info.height<=1280);assert(info.bytes<=OUTPUT_LIMIT);
  assert.deepEqual(fs.readFileSync(source),before,'manual source is never modified');
  assert.equal((await sharp(dest).metadata()).format,'webp');
  assert.equal((await sharp(dest).metadata()).hasAlpha,true,'transparent details preserved');
  assert.deepEqual(dimensions(fs.readFileSync(dest)),{width:info.width,height:info.height});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('AI JPEG and grayscale input become small WebP while retaining orientation',async()=>{
 const dir=temp(),source=path.join(dir,'ai.jpg'),dest=path.join(dir,'converted.webp');
 try{
  await sharp({create:{width:1050,height:1550,channels:3,background:{r:152,g:143,b:130}}}).jpeg({quality:98}).toFile(source);
  const info=await optimizeImage(source,dest);
  assert(info.height>info.width,'portrait orientation retained');assert(info.bytes<=OUTPUT_LIMIT);
  assert.deepEqual(dimensions(fs.readFileSync(source)),{width:1050,height:1550});
  assert.deepEqual(dimensions(fs.readFileSync(dest)),{width:info.width,height:info.height});
  assert.equal(fs.existsSync(source),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('highly detailed image stays below publication byte budget using fallback quality and size',async()=>{
 const dir=temp(),source=path.join(dir,'noise.png'),dest=path.join(dir,'normalized.webp');
 try{
  const w=1380,h=840;
  await sharp(randomBytes(w*h*3),{raw:{width:w,height:h,channels:3}}).png().toFile(source);
  const info=await optimizeImage(source,dest);
  assert(info.bytes<=OUTPUT_LIMIT,'bounded WebP payload');
  assert(info.bytes<info.inputBytes,'optimization saves bytes on complex source');
  assert(info.width<1280,'complex image progressively downsizes');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('invalid input cannot publish and does not create broken asset',async()=>{
 const dir=temp(),source=path.join(dir,'fake.png'),dest=path.join(dir,'broken.webp');
 try{
  fs.writeFileSync(source,'not an image');
  await assert.rejects(()=>optimizeImage(source,dest));
  assert.equal(fs.existsSync(dest),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('both runtime user entrypoints pass through WebP normalization before database attachment',()=>{
 const text=fs.readFileSync(path.join(__dirname,'studio-runtime.cjs'),'utf8');
 const manual=text.slice(text.indexOf('async function pickVisualImage'),text.indexOf('async function generateVisualImage'));
 const generated=text.slice(text.indexOf('async function generateVisualImage'),text.indexOf('function workersBusy'));
 assert.match(manual,/optimizeImage\(result\.filePaths\[0\], target\)/);
 assert.match(generated,/optimizeImage\(generated\.file, optimizedFile\)/);
 assert(manual.indexOf('optimizeImage(')<manual.indexOf('attachStoredFile('));
 assert(generated.indexOf('optimizeImage(')<generated.indexOf('attachStoredFile('));
});
