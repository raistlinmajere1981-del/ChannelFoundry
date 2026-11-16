'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const sharp=require('sharp');
const {DatabaseSync}=require('node:sqlite');
const basket=require('./visual-basket.cjs');
const profiles=require('./visual-profiles.cjs');
async function main(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'cf-visual-basket-test-'));
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE studio_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT");
  profiles.ensureSchema(db,root);
  basket.recover(db);
  assert.equal(basket.settings(db).imagesPerRequest,1);
  basket.setSettings(db,{imagesPerRequest:2});
  assert.throws(()=>basket.setSettings(db,{imagesPerRequest:3}),/1, 2 veya 4/);
  assert.equal(basket.layout(4).cols,2);
  assert.throws(()=>basket.layout(3),/1, 2 veya 4/);
  const input=n=>({entityKey:'character:test-'+n,entityType:'character',title:'Deneme '+n,
    prompt:'Kaynağa bağlı çizim '+n,negativePrompt:'yazı',presetId:'journal-pencil',size:'1024x1024'});
  basket.add(db,input(1));basket.add(db,input(2));
  assert.equal(basket.status(db).items.length,2);
  assert.equal(basket.nextGroup(db).length,2);
  let calls=0;
  const generate=async(_root,req)=>{
    calls++;
    assert.match(req.prompt,/2 sütun x 1 satır/);
    assert.equal(req.size,'1536x1024');
    const target=path.join(root,'generated-'+calls+'.png');
    const white=await sharp({create:{width:768,height:1024,channels:3,background:'#fff'}}).png().toBuffer();
    const black=await sharp({create:{width:768,height:1024,channels:3,background:'#111'}}).png().toBuffer();
    await sharp({create:{width:1536,height:1024,channels:3,background:'#fff'}})
      .composite([{input:white,left:0,top:0},{input:black,left:768,top:0}]).png().toFile(target);
    return {file:target,provider:'test',model:'fake'};
  };
  const rows=basket.nextGroup(db);
  await basket.processGroup(db,root,rows,generate);
  assert.equal(calls,1);
  assert.equal(basket.status(db).items.filter(x=>x.state==='ready').length,2);
  assert.equal(profiles.getMetadata(db,'character:test-1'),null,'candidate must not overwrite the visual profile');
  const pic=basket.candidate(db,root,'character:test-1');
  const pic2=basket.candidate(db,root,'character:test-2');
  assert.match(pic.imageDataUrl,/^data:image\/webp;base64,/);
  const getMean=async data=>{
    const raw=Buffer.from(data.imageDataUrl.split(',')[1],'base64');
    const stats=await sharp(raw).stats();return stats.channels[0].mean;
  };
  assert.ok(await getMean(pic)>200);
  assert.ok(await getMean(pic2)<50);
  await basket.accept(db,root,'character:test-1');
  assert.equal(basket.status(db).items.length,1);
  assert.match(profiles.get(db,'character:test-1').imageDataUrl,/^data:image\/webp;base64,/);
  assert.equal(profiles.get(db,'character:test-1').imageProvider,'test');
  assert.equal(profiles.get(db,'character:test-1').imageModel,'fake');
  assert.equal(profiles.getMetadata(db,'character:test-2'),null);
  basket.remove(db,root,'character:test-2');
  basket.setSettings(db,{imagesPerRequest:4});
  basket.add(db,input(3));basket.add(db,input(4));basket.add(db,input(5));
  assert.equal(basket.nextGroup(db).length,2,'three targets must not be sent to 2x2 four tile layout');
  assert.equal(basket.status(db).settings.imagesPerRequest,4);
  console.log('Visual basket: persistent settings, grouping, candidate separation, 2-sheet split, acceptance and cleanup verified.');
 }finally{db.close();fs.rmSync(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
