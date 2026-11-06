"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),zlib=require("node:zlib");
const {DatabaseSync}=require("node:sqlite");
const sources=require("./vefk-sources.cjs"),prep=require("./vefk-preparations.cjs"),vision=require("./vefk-vision.cjs");

const SOURCE_PNG=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=","base64");
function crc32(buf) {
  let crc=-1;
  for(const octet of buf){
    crc^=octet;
    for(let bit=0;bit<8;bit++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1;
  }
  return (crc^(-1))>>>0;
}
function pngChunk(type,payload){
  const name=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);
  len.writeUInt32BE(payload.length,0);
  crc.writeUInt32BE(crc32(Buffer.concat([name,payload])),0);
  return Buffer.concat([len,name,payload,crc]);
}
function generatedPng(width=40,height=28){
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);
  header[8]=8;header[9]=6;
  const rows=[];
  for(let y=0;y<height;y++){
    const row=Buffer.alloc(1+width*4);row[0]=0;
    for(let x=0;x<width;x++){
      const start=1+x*4;row[start]=x;row[start+1]=y;row[start+2]=42;row[start+3]=255;
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk("IHDR",header),
    pngChunk("IDAT",zlib.deflateSync(Buffer.concat(rows))),
    pngChunk("IEND",Buffer.alloc(0)),
  ]);
}
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"vefk-prep-"));
  const file=path.join(root,"original.png");fs.writeFileSync(file,SOURCE_PNG);
  const db=new DatabaseSync(":memory:");db.exec("PRAGMA foreign_keys=ON;");
  const original=sources.importSource(db,root,file);
  const close=()=>{db.close();fs.rmSync(root,{recursive:true,force:true});};
  const config={corners:[{x:80,y:100},{x:930,y:180},{x:860,y:945},{x:110,y:900}],contrast:1.35,brightness:-12};
  const ready={sourceId:original.id,expectedRevision:0,config,imageDataUrl:"data:image/png;base64,"+generatedPng().toString("base64")};
  return{root,db,file,original,close,config,ready};
}
function aiData(){
  return {schema:"vefk.source-analysis.v1",regions:[{kind:"grid",box:[20,30,700,700],label:"",confidence:.95}],grid:null};
}

test("prepared PNG revisions retain original bytes, geometry, hash and active image",()=>{
  const fx=fixture();
  try{
    const original=sources.loadSource(fx.db,fx.root,fx.original.id);
    assert.equal(original.preparation,null);
    const saved=prep.prepare(fx.db,fx.root,fx.ready);
    assert.equal(saved.revision,1);assert.equal(saved.width,40);assert.equal(saved.height,28);
    assert.deepEqual(saved.config,fx.config);
    const active=sources.loadSource(fx.db,fx.root,fx.original.id);
    assert.equal(active.preparation.revision,1);
    assert.equal(active.preparation.sha256,saved.sha256);
    assert.equal(active.originalImageDataUrl,original.originalImageDataUrl);
    assert.equal(active.imageDataUrl,fx.ready.imageDataUrl);
    assert.equal(fs.readFileSync(fx.file).equals(SOURCE_PNG),true);
    assert.equal(fx.db.prepare("SELECT COUNT(*) c FROM vefk_source_preparations").get().c,1);
    assert.throws(()=>prep.prepare(fx.db,fx.root,fx.ready),/revizyonu değişti/);
    const second=prep.prepare(fx.db,fx.root,{...fx.ready,expectedRevision:1});
    assert.equal(second.revision,2);
    assert.equal(fx.db.prepare("SELECT COUNT(*) c FROM vefk_source_preparations").get().c,2);
  }finally{fx.close();}
});
test("prepared image is used by AI and analyses are bound to their active preparation",async()=>{
  const fx=fixture();
  try{
    fs.writeFileSync(path.join(fx.root,"ai-config.json"),JSON.stringify({provider:"openai-compatible",model:"gemini-vision-test",endpoint:"https://vision.invalid/v1"}));
    const old=sources.appendAnalysis(fx.db,{sourceId:fx.original.id,origin:"ai",provider:"mock",model:"m",result:aiData()});
    assert.equal(old.result.preparationRevision,0);
    prep.prepare(fx.db,fx.root,fx.ready);
    assert.equal(sources.latestAnalysis(fx.db,fx.original.id),null);
    assert.equal(sources.listSources(fx.db)[0].lastAnalysisId,null);
    const run=await vision.analyze(fx.db,fx.root,fx.original.id,{transport:async(config,messages)=>{
      assert.equal(messages[1].content[1].image_url.url,fx.ready.imageDataUrl);
      return{content:JSON.stringify(aiData()),model:config.model};
    }});
    assert.equal(run.result.preparationRevision,1);
    const edited=structuredClone(run.result);
    edited.regions[0].reviewed=true;
    const reviewed=sources.appendAnalysis(fx.db,{sourceId:fx.original.id,origin:"review",
      provider:"mock",model:"m",expectedAnalysisId:run.id,result:edited});
    assert.equal(reviewed.result.preparationRevision,1);
    prep.prepare(fx.db,fx.root,{...fx.ready,expectedRevision:1});
    assert.equal(sources.latestAnalysis(fx.db,fx.original.id),null);
    assert.throws(()=>sources.appendAnalysis(fx.db,{sourceId:fx.original.id,origin:"review",
      provider:"mock",model:"m",expectedAnalysisId:run.id,result:edited}),/farklı/);
    assert.equal(fx.db.prepare("SELECT COUNT(*) c FROM vefk_source_analyses").get().c,3);
  }finally{fx.close();}
});
test("AI finishing after a new preparation cannot bind old image coordinates to the new revision",async()=>{
  const fx=fixture();
  try{
    fs.writeFileSync(path.join(fx.root,"ai-config.json"),JSON.stringify({provider:"openai-compatible",model:"vision",endpoint:"https://vision.invalid/v1"}));
    await assert.rejects(vision.analyze(fx.db,fx.root,fx.original.id,{
      transport:async()=>{prep.prepare(fx.db,fx.root,fx.ready);return{content:JSON.stringify(aiData())};},
    }),/AI çalışırken/);
    assert.equal(sources.latestAnalysis(fx.db,fx.original.id),null);
  }finally{fx.close();}
});
test("broken prep payload or invalid quadrilateral is rejected before any revision is stored",()=>{
  const fx=fixture();
  try{
    assert.throws(()=>prep.prepare(fx.db,fx.root,{...fx.ready,imageDataUrl:"data:image/png;base64,AAAA"}),/PNG/);
    assert.throws(()=>prep.prepare(fx.db,fx.root,{...fx.ready,config:{...fx.config,corners:[
      {x:0,y:0},{x:1000,y:1000},{x:0,y:1000},{x:1000,y:0},
    ]}}),/küçük|dışbükey/);
    assert.throws(()=>prep.prepare(fx.db,fx.root,{...fx.ready,config:{...fx.config,contrast:100}}),/Kontrast/);
    assert.equal(prep.latest(fx.db,fx.original.id),null);
  }finally{fx.close();}
});
