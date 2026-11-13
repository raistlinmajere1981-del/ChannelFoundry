'use strict';
/** Safe, synchronous header reader for Publication V2 layout hints (no decoding). */
function dimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  let width=0,height=0;
  if (buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && buffer.subarray(12,16).toString()==='IHDR') {
    width=buffer.readUInt32BE(16);height=buffer.readUInt32BE(20);
  } else if (buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') {
    const chunk=buffer.toString('ascii',12,16);
    if (chunk==='VP8X' && buffer.length>=30) {
      width=1+buffer.readUIntLE(24,3);height=1+buffer.readUIntLE(27,3);
    } else if (chunk==='VP8 ' && buffer.length>=30) {
      width=buffer.readUInt16LE(26)&0x3fff;height=buffer.readUInt16LE(28)&0x3fff;
    } else if (chunk==='VP8L' && buffer.length>=25 && buffer[20]===0x2f) {
      width=1+(buffer[21]|((buffer[22]&0x3f)<<8));
      height=1+((buffer[22]>>6)|(buffer[23]<<2)|((buffer[24]&0xf)<<10));
    }
  } else if (buffer[0]===0xff && buffer[1]===0xd8) {
    let cursor=2;
    while (cursor+8<buffer.length) {
      if (buffer[cursor]!==0xff) {cursor++;continue;}
      while (buffer[cursor]===0xff)cursor++;
      const marker=buffer[cursor++];
      if (marker===0xd9||marker===0xda)break;
      if (marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      if (cursor+2>buffer.length)break;
      const length=buffer.readUInt16BE(cursor);
      if (length<2||cursor+length>buffer.length)break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        height=buffer.readUInt16BE(cursor+3);width=buffer.readUInt16BE(cursor+5);break;
      }
      cursor+=length;
    }
  }
  return width>0&&height>0&&width<=20000&&height<=20000?{width,height}:null;
}
module.exports={dimensions};
