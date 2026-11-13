/**
 * Draft-only binary replacements. Never accept arbitrary paths or remote URLs:
 * approved files are selected from the same reviewed manifest that is mounted.
 */
import {canCropVisual} from '../../packages/effect-engine/src/model/visual-crop.mjs';
import {PHYSICAL_ART_SLOTS,isPhysicalArtAsset} from './scene-physical-art.mjs';

/** Only parse dimensions from a complete RIFF/WebP container, not from a
 * client-provided MIME string. Supports the WebP VP8, VP8L and VP8X headers.
 */
export function webpDimensions(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<25||
    bytes.toString('ascii',0,4)!=='RIFF'||
    bytes.toString('ascii',8,12)!=='WEBP'||
    bytes.readUInt32LE(4)+8!==bytes.length)
    throw Error('Kaynak resim geçerli WebP kapsayıcısı olmalı.');
  const size=bytes.readUInt32LE(16),kind=bytes.toString('ascii',12,16);
  if(size<=0||20+size>bytes.length)throw Error('WebP resim verisi eksik.');
  let width,height;
  if(kind==='VP8X'){
    if(size<10)throw Error('WebP genişletilmiş başlığı eksik.');
    width=1+bytes.readUIntLE(24,3);
    height=1+bytes.readUIntLE(27,3);
  }else if(kind==='VP8L'){
    if(size<5||bytes[20]!==0x2f)throw Error('WebP kayıpsız başlığı eksik.');
    width=1+bytes[21]+((bytes[22]&0x3f)<<8);
    height=1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&0xf)<<10);
  }else if(kind==='VP8 '){
    if(size<10||bytes[23]!==0x9d||bytes[24]!==0x01||bytes[25]!==0x2a)
      throw Error('WebP kayıplı başlığı eksik.');
    width=bytes.readUInt16LE(26)&0x3fff;
    height=bytes.readUInt16LE(28)&0x3fff;
  }else throw Error('Desteklenmeyen WebP kapsayıcısı.');
  if(width<1||height<1||width>4096||height>4096||width*height>12e6)
    throw Error('WebP resminin boyutları 4096 px / 12 MP sınırını aşamaz.');
  return {width,height};
}

export const MAX_ASSET_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 24 * 1024 * 1024;

export function editableAssets(manifest,scene=null) {
  const paths = new Set();
  for(const item of manifest.objects ?? []) {
    for(const slot of PHYSICAL_ART_SLOTS[item.id]??[])paths.add(slot.path);
    if(!canCropVisual(item))continue;
    for(const path of [item.visual?.asset,...(item.visual?.layers ?? []).map(layer=>layer.asset)])
      if(typeof path==='string' && /^\/scene-assets\/[a-z0-9/-]+\.webp$/.test(path))paths.add(path);
  }
  for(const item of scene?.objects??[]){
    if(item.kind!=='artwork')continue;
    for(const asset of [item.visual?.asset,...(item.visual?.layers??[]).map(layer=>layer.asset)])
      if(/^\/scene-assets\/custom\/[a-z0-9-]+\.webp$/.test(asset??''))paths.add(asset);
  }
  return paths;
}
export function validateAssetOverrides(assets,manifest,referenceEntries=null,scene=null) {
  if(!Array.isArray(assets)||assets.length>32)throw Error('En fazla 32 resim kaynağı değiştirilebilir.');
  const allowed=editableAssets(manifest,scene),seen=new Set(),parsed=[];
  let total=0;
  for(const entry of assets) {
    if(!entry||typeof entry!=='object'||Object.keys(entry).sort().join(',')!=='dataUrl,path'||
      typeof entry.path!=='string'||!allowed.has(entry.path)||seen.has(entry.path))
      throw Error('Görsel kaynağı izin verilen sahne nesnesine ait değil veya tekrar edilmiş.');
    seen.add(entry.path);
    const match=/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(entry.dataUrl);
    if(!match||match[1].length>Math.ceil(MAX_ASSET_BYTES*4/3)+4)
      throw Error('Görsel verisi geçerli WebP olmalı ve 8 MB sınırını aşmamalı.');
    const bytes=Buffer.from(match[1],'base64');
    if(!bytes.length||bytes.length>MAX_ASSET_BYTES)
      throw Error('Kaynak resim 8 MB sınırını aşamaz.');
    const geometry=webpDimensions(bytes);
    if(isPhysicalArtAsset(entry.path)){
      const isClosed=/^\/scene-assets\/books\/scene-closed\/(?:evren|topluluk)-master-closed(?:-en)?\.webp$/.test(entry.path);
      if(isClosed&&(geometry.width!==1536||geometry.height!==1024))
        throw Error('Kapalı kitap görseli 1536 × 1024 WebP olmalı; sabit siluet koordinatları korunmalı.');
      const source=referenceEntries?.get('public'+entry.path);
      if(source){
        const original=webpDimensions(source);
        const delta=Math.abs((geometry.width/geometry.height)/(original.width/original.height)-1);
        if(delta>.1)throw Error('Yeni resmin en/boy oranı mevcut fiziksel kaynakla uyumlu olmalı.');
      }
    }
    total+=bytes.length;
    if(total>MAX_TOTAL_ASSET_BYTES)throw Error('Kaynak görseller toplam 24 MB sınırını aşıyor.');
    parsed.push({path:entry.path,bytes});
  }
  return parsed;
}
