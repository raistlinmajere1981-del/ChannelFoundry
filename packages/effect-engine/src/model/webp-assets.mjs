// Reusable, strict WebP source validation for all scene projects.
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
