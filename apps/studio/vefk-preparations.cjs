"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const IMAGE_SIZE_MAX = 12 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS vefk_source_preparations (",
  "source_id TEXT NOT NULL REFERENCES vefk_sources(id),",
  "revision INTEGER NOT NULL CHECK(revision > 0),",
  "sha256 TEXT NOT NULL CHECK(length(sha256) = 64),",
  "relative_path TEXT NOT NULL,",
  "bytes INTEGER NOT NULL CHECK(bytes > 0 AND bytes <= 12582912),",
  "width INTEGER NOT NULL CHECK(width BETWEEN 12 AND 1800),",
  "height INTEGER NOT NULL CHECK(height BETWEEN 12 AND 1800),",
  "config_json TEXT NOT NULL,",
  "created_at TEXT NOT NULL,",
  "PRIMARY KEY(source_id, revision)",
  ") STRICT;",
].join(" ");
function ensureSchema(db) { db.exec(SCHEMA); }

function latest(db, sourceId, requestedRevision) {
  ensureSchema(db);
  if (typeof sourceId !== "string" || !/^source-[a-f0-9]{32}$/.test(sourceId)) {
    throw new TypeError("Geçersiz vefk görsel kimliği.");
  }
  const row = db.prepare(
    "SELECT revision,sha256,relative_path AS relativePath,bytes,width,height, "+
    "config_json AS configJson,created_at AS createdAt "+
    "FROM vefk_source_preparations WHERE source_id=? AND (? IS NULL OR revision=?) ORDER BY revision DESC LIMIT 1"
  ).get(sourceId, requestedRevision ?? null, requestedRevision ?? null);
  if (!row) return null;
  const {relativePath,configJson,...other} = row;
  return {...other,relativePath,config:JSON.parse(configJson)};
}

function validateConfig(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.corners) || raw.corners.length !== 4) {
    throw new TypeError("Dört perspektif köşesi gerekli.");
  }
  const corners = raw.corners.map(p => ({x:Number(p?.x),y:Number(p?.y)}));
  for(const p of corners)if(!Number.isFinite(p.x)||!Number.isFinite(p.y)
    ||p.x<0||p.y<0||p.x>1000||p.y>1000)throw new RangeError("Perspektif köşesi görüntü dışına çıkamaz.");
  const area=Math.abs(corners.reduce((a,p,i)=>a+p.x*corners[(i+1)%4].y-p.y*corners[(i+1)%4].x,0))/2;
  if(area<400)throw new Error("Seçili alan çok küçük.");
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
  const winding=Math.sign(cross(corners[0],corners[1],corners[2]));
  if(!winding||corners.some((p,i)=>Math.sign(cross(p,corners[(i+1)%4],corners[(i+2)%4]))!==winding)) {
    throw new Error("Perspektif köşeleri dışbükey olmalı.");
  }
  const contrast=Number(raw.contrast),brightness=Number(raw.brightness);
  if(!Number.isFinite(contrast)||contrast<.5||contrast>2.5
    ||!Number.isFinite(brightness)||brightness<-100||brightness>100){
    throw new RangeError("Kontrast veya parlaklık geçersiz.");
  }
  return {corners,contrast,brightness};
}

function decodeImage(dataUrl) {
  if(typeof dataUrl!=="string")throw new TypeError("Hazırlanan PNG görseli gerekli.");
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)) {
    throw new TypeError("Hazırlanan görsel PNG base64 olmalı.");
  }
  if(dataUrl.length>Math.ceil(IMAGE_SIZE_MAX*4/3)+100)throw new RangeError("PNG 12 MB sınırını aşamaz.");
  const data=Buffer.from(dataUrl.slice("data:image/png;base64,".length),"base64");
  if(data.length>IMAGE_SIZE_MAX||data.length<40||!data.subarray(0,8).equals(PNG_SIGNATURE)
    ||data.toString("ascii",12,16)!=="IHDR" || data.readUInt32BE(8)!==13) {
    throw new TypeError("Hazırlanan görüntü geçerli PNG başlığı taşımalı.");
  }
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  if(width<12||height<12||width>1800||height>1800)throw new RangeError("Hazırlanan PNG boyutları geçersiz.");
  return {data,width,height};
}

function prepare(db,userData,{sourceId,expectedRevision,config,imageDataUrl}) {
  if (typeof userData!=="string" || !path.isAbsolute(userData)) throw new TypeError("Studio veri yolu geçersiz.");
  ensureSchema(db);
  const source=db.prepare("SELECT id FROM vefk_sources WHERE id=?").get(sourceId);
  if(!source || !/^source-[a-f0-9]{32}$/.test(sourceId))throw new Error("Vefk kaynak görseli bulunamadı.");
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new TypeError("Önceki hazırlık revizyonu gerekli.");
  const clean=validateConfig(config);
  const {data,width,height}=decodeImage(imageDataUrl);
  const sha256=crypto.createHash("sha256").update(data).digest("hex");
  const relativePath=sha256+".png";
  const folder=path.join(path.resolve(userData),"vefk-sources");
  fs.mkdirSync(folder,{recursive:true});
  const target=path.join(folder,relativePath);
  try{fs.writeFileSync(target,data,{flag:"wx",mode:0o600});}
  catch(err){
    if(err?.code!=="EEXIST")throw err;
    const existing=fs.readFileSync(target);
    if(crypto.createHash("sha256").update(existing).digest("hex")!==sha256)throw new Error("Hazırlanan görsel dosya hash'i uyuşmuyor.");
  }
  db.exec("BEGIN IMMEDIATE");
  try{
    const previous=latest(db,sourceId);
    const revision=previous?.revision??0;
    if(revision!==expectedRevision)throw new Error("Hazırlık revizyonu değişti; kaynak görseli yeniden aç.");
    db.prepare(
      "INSERT INTO vefk_source_preparations(source_id,revision,sha256,relative_path,bytes,width,height,config_json,created_at) "+
      "VALUES(?,?,?,?,?,?,?,?,?)"
    ).run(sourceId,revision+1,sha256,relativePath,data.length,width,height,
      JSON.stringify(clean),new Date().toISOString());
    db.exec("COMMIT");
    return publicMetadata(latest(db,sourceId));
  }catch(err){db.exec("ROLLBACK");throw err;}
}
function publicMetadata(record) {
  if(!record)return null;
  const {relativePath,...safe}=record;
  return safe;
}
function readPrepared(userData,record) {
  if(!record)return null;
  if(!/^[a-f0-9]{64}\.png$/.test(record.relativePath))throw new Error("Hazırlanan görsel yolu geçersiz.");
  const target=path.join(path.resolve(userData),"vefk-sources",record.relativePath);
  const data=fs.readFileSync(target);
  if(crypto.createHash("sha256").update(data).digest("hex")!==record.sha256) {
    throw new Error("Hazırlanan görsel hash kontrolü başarısız.");
  }
  return "data:image/png;base64,"+data.toString("base64");
}

module.exports={ensureSchema,latest,prepare,publicMetadata,readPrepared,validateConfig,decodeImage};
