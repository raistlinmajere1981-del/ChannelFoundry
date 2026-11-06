/** Studio-only non-destructive mask exclusions in source normalized-1000 space.
 * No persistence/schema change: reviewed SVG paths are the only committed output. */
export type InkBox = readonly [number, number, number, number];
export function excludeInkFromMask(
  input: Uint8Array, width: number, height: number,
  region: InkBox, excluded: ReadonlyArray<InkBox> = [],
): {mask:Uint8Array;excludedPixels:number} {
  if(!Number.isInteger(width)||!Number.isInteger(height)||
     width<12||height<12||width>512||height>512||input.length!==width*height)
    throw new RangeError("Mürekkep maskesi boyutları geçersiz.");
  const validBox=(box:InkBox,label:string)=>{
    if(!Array.isArray(box)||box.length!==4||box.some(v=>!Number.isFinite(v))||
       box[0]<0||box[1]<0||box[2]<=0||box[3]<=0||
       box[0]+box[2]>1000||box[1]+box[3]>1000)
      throw new RangeError(label+" koordinatları geçersiz.");
  };
  validBox(region,"Kaynak alanı");
  if(excluded.length>24)throw new RangeError("En fazla 24 doku dışlama alanı eklenebilir.");
  const mask=Uint8Array.from(input);
  let excludedPixels=0;
  for(const box of excluded){
    validBox(box,"Doku dışlama alanı");
    const left=Math.max(0,Math.ceil((box[0]-region[0])*width/region[2]-.5));
    const top=Math.max(0,Math.ceil((box[1]-region[1])*height/region[3]-.5));
    const right=Math.min(width,Math.ceil((box[0]+box[2]-region[0])*width/region[2]-.5));
    const bottom=Math.min(height,Math.ceil((box[1]+box[3]-region[1])*height/region[3]-.5));
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
      const i=y*width+x;
      if(mask[i]){mask[i]=0;excludedPixels++;}
    }
  }
  return {mask,excludedPixels};
}
