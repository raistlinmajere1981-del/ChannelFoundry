/** Non-destructive crop, rotation and perspective correction in normalized source coordinates. */
export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point]; // TL, TR, BR, BL clockwise around paper
export type PreparationSettings = { corners: Corners; contrast: number; brightness: number };
export type Raster = { width: number; height: number; data: Uint8ClampedArray };
export const FULL_CORNERS: Corners = [
  {x:0,y:0}, {x:1000,y:0}, {x:1000,y:1000}, {x:0,y:1000},
];
const AREA_MIN = 400; // out of one million normalized units
function cross(a:Point,b:Point,c:Point): number {
  return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
}
function polygonArea(points: Corners) {
  return .5 * Math.abs(points.reduce((sum,p,i)=>sum+p.x*points[(i+1)%4].y-p.y*points[(i+1)%4].x,0));
}
export function validatePreparation(raw: PreparationSettings): PreparationSettings {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.corners) || raw.corners.length !== 4) {
    throw new TypeError("Dört kaynak köşesi gerekli.");
  }
  const points = raw.corners.map(p => ({ x: Number(p?.x), y: Number(p?.y) })) as Corners;
  for (const p of points) if (![p.x,p.y].every(Number.isFinite)
    || p.x < 0 || p.y < 0 || p.x > 1000 || p.y > 1000) {
    throw new RangeError("Kaynak köşe koordinatları 0..1000 olmalı.");
  }
  if (polygonArea(points) < AREA_MIN) throw new RangeError("Seçili alan çok küçük.");
  const winding = Math.sign(cross(points[0],points[1],points[2]));
  if (!winding || points.some((_,i) => Math.sign(cross(points[i],points[(i+1)%4],points[(i+2)%4])) !== winding)) {
    throw new Error("Köşeler dışbükey bir dörtgen oluşturmalı; kenarlar kesişemez.");
  }
  const contrast=Number(raw.contrast),brightness=Number(raw.brightness);
  if (!Number.isFinite(contrast) || contrast < .5 || contrast > 2.5) throw new RangeError("Kontrast 0.5..2.5 olmalı.");
  if (!Number.isFinite(brightness) || brightness < -100 || brightness > 100) throw new RangeError("Parlaklık -100..100 olmalı.");
  return {corners:points,contrast,brightness};
}
/** Rotate the extracted document clockwise 90 degrees, not the immutable original image. */
export function rotateCorners(c:Corners):Corners {
  return [{...c[3]}, {...c[0]}, {...c[1]}, {...c[2]}];
}
/** Source pixels projected into the prepared rectangle with a projective transform. */
export function preparedDimensions(sourceWidth:number,sourceHeight:number,corners:Corners,maxSide=1400) {
  if (![sourceWidth,sourceHeight,maxSide].every(v=>Number.isFinite(v)&&v>0)) throw new RangeError("Boyutlar geçersiz.");
  validatePreparation({corners,contrast:1,brightness:0});
  const distance=(a:Point,b:Point)=>Math.hypot((b.x-a.x)*sourceWidth/1000,(b.y-a.y)*sourceHeight/1000);
  const w=(distance(corners[0],corners[1])+distance(corners[3],corners[2]))/2;
  const h=(distance(corners[0],corners[3])+distance(corners[1],corners[2]))/2;
  const scale=Math.min(1,maxSide/Math.max(w,h));
  return { width: Math.max(12,Math.round(w*scale)), height: Math.max(12,Math.round(h*scale)) };
}
/** Solve inverse projective square-to-quad mapping. No image processing libraries required. */
export function squareToQuad(corners:Corners) {
  validatePreparation({corners,contrast:1,brightness:0});
  const [tl,tr,br,bl]=corners;
  const sx=tl.x-tr.x+br.x-bl.x, sy=tl.y-tr.y+br.y-bl.y;
  const dx1=tr.x-br.x,dx2=bl.x-br.x,dy1=tr.y-br.y,dy2=bl.y-br.y;
  const det=dx1*dy2-dx2*dy1;
  if (Math.abs(det)<.001) throw new Error("Bu perspektif dönüşümü tekil.");
  // Affine case is the limiting value when the opposite sides are parallel.
  const g=(sx*dy2-dx2*sy)/det,h=(dx1*sy-sx*dy1)/det;
  const a=tr.x-tl.x+g*tr.x,b=bl.x-tl.x+h*bl.x;
  const d=tr.y-tl.y+g*tr.y,e=bl.y-tl.y+h*bl.y;
  return (u:number,v:number):Point => {
    const div=g*u+h*v+1;
    if(!Number.isFinite(div)||Math.abs(div)<.000001)throw new Error("Perspektif bölücüsü geçersiz.");
    return {x:(a*u+b*v+tl.x)/div,y:(d*u+e*v+tl.y)/div};
  };
}
function srgb(value:number,contrast:number,brightness:number){
  return Math.max(0,Math.min(255,Math.round((value-128)*contrast+128+brightness)));
}
/** Pure pixel remapping; bilinear interpolation, white outside the original image. */
export function prepareRgba(image:Raster, settings:PreparationSettings, requested?:{width:number;height:number}):Raster{
  const prep=validatePreparation(settings), map=squareToQuad(prep.corners);
  const width=image.width,height=image.height;
  if (!Number.isInteger(width)||!Number.isInteger(height)||width<12||height<12
    ||width>8192||height>8192||image.data.length!==width*height*4) throw new RangeError("Kaynak RGBA boyutları geçersiz.");
  const size=requested||preparedDimensions(width,height,prep.corners);
  if (!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<12
    ||size.height<12||size.width>1800||size.height>1800) throw new RangeError("Hazırlanan görsel boyutları geçersiz.");
  const output=new Uint8ClampedArray(size.width*size.height*4);
  const src=image.data;
  for(let y=0;y<size.height;y++)for(let x=0;x<size.width;x++){
    const p=(y*size.width+x)*4;
    const projected=map((x+.5)/size.width,(y+.5)/size.height);
    const fx=projected.x*width/1000-.5,fy=projected.y*height/1000-.5;
    if(fx<-.5||fy<-.5||fx>=width-.5||fy>=height-.5){
      output[p]=output[p+1]=output[p+2]=output[p+3]=255;continue;
    }
    const x0=Math.max(0,Math.min(width-1,Math.floor(fx))),x1=Math.min(width-1,x0+1);
    const y0=Math.max(0,Math.min(height-1,Math.floor(fy))),y1=Math.min(height-1,y0+1);
    const tx=Math.max(0,Math.min(1,fx-x0)),ty=Math.max(0,Math.min(1,fy-y0));
    const pix=(xx:number,yy:number)=>4*(yy*width+xx);
    const a=pix(x0,y0),b=pix(x1,y0),c=pix(x0,y1),d=pix(x1,y1);
    for(let k=0;k<3;k++){
      const v0=src[a+k]*(1-tx)+src[b+k]*tx;
      const v1=src[c+k]*(1-tx)+src[d+k]*tx;
      output[p+k]=srgb(v0*(1-ty)+v1*ty,prep.contrast,prep.brightness);
    }
    output[p+3]=255;
  }
  return {width:size.width,height:size.height,data:output};
}
