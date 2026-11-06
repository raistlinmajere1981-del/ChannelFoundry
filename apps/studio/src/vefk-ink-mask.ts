/**
 * Relative local ink classifier for aged paper and uneven illumination.
 * Pure pixel transform; the caller's pixels and S1 paths are never modified.
 */
export type InkMode = "global" | "adaptive";
export type InkClassifyOptions = {
  threshold: number;
  invert?: boolean;
  inkMode?: InkMode;
  localContrast?: number;
};
export type ClassifiedInk = {
  mask: Uint8Array;
  count: number;
  mode: InkMode;
  localContrast: number;
};

function assertInt(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new RangeError(label + " geçersiz.");
  return value;
}
export function classifyInk(
  image: {width: number; height: number; data: Uint8ClampedArray},
  options: InkClassifyOptions,
): ClassifiedInk {
  const {width:w,height:h,data} = image;
  assertInt(w,"Genişlik",12,512);assertInt(h,"Yükseklik",12,512);
  if (!data || data.length !== 4*w*h) throw new Error("RGBA raster uzunluğu uyuşmuyor.");
  const threshold = assertInt(options.threshold,"Sabit eşik",15,245);
  const mode = options.inkMode ?? "global";
  if (mode !== "global" && mode !== "adaptive") throw new Error("Tanımsız mürekkep algılama yöntemi.");
  const localContrast = assertInt(options.localContrast ?? 22, "Yerel kontrast", 6, 65);
  const gray = new Float32Array(w*h);
  for (let i=0;i<gray.length;i++) {
    const p=i*4,alpha=data[p+3]/255;
    gray[i]=(data[p]*.2126+data[p+1]*.7152+data[p+2]*.0722)*alpha+255*(1-alpha);
  }
  // A reversed polarity is meaningful only if the selected source really has
  // a dark background and light strokes. On ordinary parchment, switching it
  // on otherwise extracts paper texture (false positives) instead of ink.
  if (options.invert) {
    const border:number[]=[];
    const margin=Math.max(2,Math.floor(Math.min(w,h)*.07));
    for (let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(x<margin||y<margin||x>=w-margin||y>=h-margin)border.push(gray[y*w+x]);
    }
    border.sort((a,b)=>a-b);
    const background=border[Math.floor(border.length/2)];
    if(background>125) throw new Error(
      "Ters renk bu açık kâğıt için uygun değil. Koyu mürekkep/açık zemin için Ters renk seçimini kapat; mevcut çizgiler korunur.");
  }
  const mask=new Uint8Array(w*h);
  let count=0;
  if (mode==="global") {
    for (let i=0;i<gray.length;i++) {
      if (options.invert ? gray[i]>=threshold : gray[i]<=threshold) {mask[i]=1;count++;}
    }
    return {mask,count,mode,localContrast};
  }

  // A bounded summed-area table makes local means O(1) per pixel,
  // avoiding a large nested convolution for 512x512 photos.
  const stride=w+1,integral=new Float64Array(stride*(h+1));
  for (let y=0;y<h;y++) {
    let row=0;
    for (let x=0;x<w;x++) {
      row+=gray[y*w+x];
      integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+row;
    }
  }
  // Scale the window to source resolution, capped so handwritten accents
  // remain visible while gradients across the paper are ignored.
  const radius=Math.max(8,Math.min(25,Math.round(Math.min(w,h)/7)));
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const x0=Math.max(0,x-radius), x1=Math.min(w,x+radius+1);
    const y0=Math.max(0,y-radius), y1=Math.min(h,y+radius+1);
    const area=(x1-x0)*(y1-y0);
    const mean=(integral[y1*stride+x1]-integral[y0*stride+x1]-
      integral[y1*stride+x0]+integral[y0*stride+x0])/area;
    const dark = options.invert ? gray[y*w+x]>=mean+localContrast :
      gray[y*w+x]<=mean-localContrast;
    if (dark) {mask[y*w+x]=1;count++;}
  }
  return {mask,count,mode,localContrast};
}
