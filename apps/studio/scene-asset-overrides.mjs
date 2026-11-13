/**
 * Draft-only binary replacements. Never accept arbitrary paths or remote URLs:
 * approved files are selected from the same reviewed manifest that is mounted.
 */
import {canCropVisual} from '../../packages/effect-engine/src/model/visual-crop.mjs';
import {PHYSICAL_ART_SLOTS,isPhysicalArtAsset} from './scene-physical-art.mjs';

import {webpDimensions,MAX_ASSET_BYTES,MAX_TOTAL_ASSET_BYTES} from '../../packages/effect-engine/src/model/webp-assets.mjs';
export {webpDimensions,MAX_ASSET_BYTES,MAX_TOTAL_ASSET_BYTES};
export const ROOM_BACKGROUND_ASSET='/scene-assets/approved/room-effects-v4-2to1.webp';

export function editableAssets(manifest,scene=null) {
  const paths = new Set([ROOM_BACKGROUND_ASSET]);
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
    if(entry.path===ROOM_BACKGROUND_ASSET){
      if(geometry.width!==geometry.height*2||geometry.width<1024)
        throw Error('Ana oda fotoğrafı 2:1 oranında ve en az 1024 piksel genişliğinde WebP olmalı. Sahne nesneleri aynı koordinatları kullanıyor.');
    }
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
