/** Pure, bounded binary-ink skeletonizer and SVG centerline path extractor. */
import { classifyInk, type InkMode } from "./vefk-ink-mask.ts";
import { excludeInkFromMask, type InkBox } from "./vefk-ink-exclusions.ts";
export type SourceBox = [number,number,number,number];
export type InkPixels = {width:number;height:number;data:Uint8ClampedArray};
export type TraceSettings = {
  threshold?:number;invert?:boolean;minLength?:number;maxPaths?:number;simplify?:number;
  inkMode?:InkMode;localContrast?:number;preserveDots?:boolean;
  excludedAreas?:ReadonlyArray<InkBox>;
};
export type TracedLine = {id:string;d:string;regionId:string};
export type TraceResult = {
  paths:TracedLine[];inkPixels:number;thinnedPixels:number;
  sample:{width:number;height:number};
  quality:{mode:InkMode;preservedDots:number;removedSpeckles:number;inkFraction:number;joinedSegments:number;excludedPixels:number};
};
const AROUND: Array<[number,number]> = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
function int(value:number,name:string,min:number,max:number) {
  if (!Number.isInteger(value)||value<min||value>max) throw new RangeError(name+" geçersiz.");
  return value;
}
function checkBox(box:SourceBox) {
  if (!Array.isArray(box)||box.length!==4||box.some(v=>typeof v!=="number"||!Number.isFinite(v)))
    throw new TypeError("İzleme bölgesi [x,y,w,h] olmalı.");
  const [x,y,w,h]=box;
  if(x<0||y<0||w<8||h<8||x+w>1000||y+h>1000)
    throw new RangeError("İzleme alanı kaynak görsel sınırlarını aşamaz.");
}
function near(mask:Uint8Array,w:number,h:number,index:number):number[]{
  const x=index%w,y=Math.floor(index/w),result:number[]=[];
  for(const [dx,dy] of AROUND) {
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&ny>=0&&nx<w&&ny<h&&mask[ny*w+nx]) {
      // Do not create a second diagonal edge when an orthogonal 2-step
      // connection already exists; it produces false branches at corners.
      if(dx&&dy&&(mask[y*w+nx]||mask[ny*w+x]))continue;
      result.push(ny*w+nx);
    }
  }
  return result;
}
type Dot={x:number;y:number};
function cleanComponents(mask:Uint8Array,w:number,h:number,min:number,preserveDots:boolean){
  const componentId=new Int32Array(mask.length), components:Array<{
    pixels:number[]; minX:number;maxX:number;minY:number;maxY:number;x:number;y:number;
  }>=[];
  for(let i=0;i<mask.length;i++){
    if(!mask[i]||componentId[i])continue;
    const pixels:number[]=[];const queue=[i];componentId[i]=components.length+1;
    let minX=w,maxX=0,minY=h,maxY=0,sumX=0,sumY=0;
    for(let cursor=0;cursor<queue.length;cursor++){
      const current=queue[cursor],x=current%w,y=Math.floor(current/w);
      pixels.push(current);minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minY=Math.min(minY,y);maxY=Math.max(maxY,y);sumX+=x;sumY+=y;
      for(const n of near(mask,w,h,current))if(!componentId[n]){
        componentId[n]=components.length+1;queue.push(n);
      }
    }
    components.push({pixels,minX,maxX,minY,maxY,
      x:sumX/pixels.length,y:sumY/pixels.length});
  }
  const dots:Dot[]=[];let removedSpeckles=0;
  for(let i=0;i<components.length;i++){
    const item=components[i], size=item.pixels.length;
    const tinyMark=preserveDots && size>=2 && size<=12 &&
      item.maxX-item.minX<=3 && item.maxY-item.minY<=3;
    let closeToInk=false;
    if(tinyMark){
      const cx=Math.round(item.x),cy=Math.round(item.y);
      const radius=Math.max(7,Math.min(16,Math.round(Math.min(w,h)*.035)));
      for(let y=Math.max(0,cy-radius);y<=Math.min(h-1,cy+radius)&&!closeToInk;y++){
        for(let x=Math.max(0,cx-radius);x<=Math.min(w-1,cx+radius);x++){
          const other=componentId[y*w+x]-1;
          if(other>=0&&other!==i && components[other].pixels.length>=14 &&
            Math.hypot(x-cx,y-cy)<=radius){closeToInk=true;break;}
        }
      }
    }
    if(tinyMark && closeToInk){
      dots.push({x:item.x,y:item.y});
      for(const n of item.pixels)mask[n]=0;
    }else if(size<min) {
      removedSpeckles++;
      for(const n of item.pixels)mask[n]=0;
    }
  }
  return {dots,removedSpeckles};
}
/** Iterative Zhang-Suen thinning. One-pixel page border never becomes a pen stroke. */
export function thinInkMask(input:Uint8Array,w:number,h:number):Uint8Array{
  int(w,"Genişlik",3,512);int(h,"Yükseklik",3,512);
  if(input.length!==w*h)throw new Error("Raster boyutları uyuşmuyor.");
  const mask=Uint8Array.from(input,v=>v?1:0);
  for(let x=0;x<w;x++){mask[x]=0;mask[(h-1)*w+x]=0;}
  for(let y=0;y<h;y++){mask[y*w]=0;mask[y*w+w-1]=0;}
  for(let round=0;round<130;round++){
    let changed=false;
    for(let phase=0;phase<2;phase++){
      const remove:number[]=[];
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
        const i=y*w+x;if(!mask[i])continue;
        const p2=mask[i-w],p3=mask[i-w+1],p4=mask[i+1],p5=mask[i+w+1];
        const p6=mask[i+w],p7=mask[i+w-1],p8=mask[i-1],p9=mask[i-w-1];
        const cycle=[p2,p3,p4,p5,p6,p7,p8,p9];
        const occupied=cycle.reduce((a,b)=>a+b,0);
        if(occupied<2||occupied>6)continue;
        let transitions=0;
        for(let n=0;n<8;n++)if(!cycle[n]&&cycle[(n+1)%8])transitions++;
        if(transitions!==1)continue;
        if(phase===0?(p2&&p4&&p6)||(p4&&p6&&p8):(p2&&p4&&p8)||(p2&&p6&&p8))continue;
        remove.push(i);
      }
      if(remove.length){changed=true;for(const i of remove)mask[i]=0;}
    }
    if(!changed)break;
  }
  return mask;
}
type P={x:number;y:number};
function distance(point:P,a:P,b:P){
  const dx=b.x-a.x,dy=b.y-a.y,div=dx*dx+dy*dy;
  if(!div)return Math.hypot(point.x-a.x,point.y-a.y);
  const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/div));
  return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
}
function simplify(points:P[],tolerance:number):P[]{
  if(points.length<=2)return points;
  const keep=new Uint8Array(points.length);keep[0]=1;keep[points.length-1]=1;
  const work:Array<[number,number]>=[[0,points.length-1]];
  while(work.length){
    const [start,end]=work.pop()!;
    let far=tolerance,index=-1;
    for(let i=start+1;i<end;i++){
      const d=distance(points[i],points[start],points[end]);
      if(d>far){far=d;index=i;}
    }
    if(index>=0){keep[index]=1;work.push([start,index],[index,end]);}
  }
  return points.filter((_,i)=>Boolean(keep[i]));
}
function simplifyStroke(points:P[],tolerance:number):P[]{
  const first=points[0],last=points[points.length-1];
  if(points.length<4 || first.x!==last.x || first.y!==last.y)return simplify(points,tolerance);
  // Split closed loops at a distant anchor: ordinary RDP collapses coincident endpoints.
  const core=points.slice(0,-1);
  let far=1,span=-1;
  for(let i=1;i<core.length;i++){
    const value=Math.hypot(core[i].x-first.x,core[i].y-first.y);
    if(value>span){span=value;far=i;}
  }
  const ring=[...simplify(core.slice(0,far+1),tolerance),
    ...simplify([...core.slice(far),first],tolerance).slice(1)];
  return new Set(ring.map(p=>p.x+","+p.y)).size>=3 ? ring : points;
}
function edge(a:number,b:number){return a<b?a+","+b:b+","+a;}
function extractSkeleton(mask:Uint8Array,w:number,h:number):number[][]{
  const adjacency=new Map<number,number[]>(),starts:number[]=[];
  for(let i=0;i<mask.length;i++)if(mask[i]){
    const neighbors=near(mask,w,h,i);adjacency.set(i,neighbors);
    if(neighbors.length!==2)starts.push(i);
  }
  const visited=new Set<string>(),paths:number[][]=[];
  const walk=(a:number,b:number)=>{
    const sequence=[a];let previous=a,current=b;visited.add(edge(a,b));
    for(let safety=0;safety<mask.length;safety++){
      sequence.push(current);
      const neighbors=adjacency.get(current)||[];
      if(neighbors.length!==2)break;
      const next=neighbors.find(n=>n!==previous);
      if(next===undefined||visited.has(edge(current,next)))break;
      visited.add(edge(current,next));previous=current;current=next;
    }
    return sequence;
  };
  for(const node of starts)for(const n of adjacency.get(node)||[])
    if(!visited.has(edge(node,n)))paths.push(walk(node,n));
  // Each all-degree-two component is a closed stroke, not connected to an endpoint.
  for(const [node,neighbors] of adjacency)for(const n of neighbors)
    if(!visited.has(edge(node,n)))paths.push(walk(node,n));
  return paths;
}
/** Pair only tangentially continuous branches sharing the very same ink pixel.
 * Never bridge gaps or infer that a detached diacritic belongs to a letter. */
function stitchSkeleton(lines:number[][],w:number):number[][]{
  if(lines.length>3000)throw new Error("Çok fazla iskelet parçası var. Bölgeyi daralt.");
  const parts=lines.filter(line=>line.length>=2).map(line=>line.slice());
  type Port={index:number;start:boolean};
  function tangent(line:number[],start:boolean):[number,number]|null{
    const k=start?0:line.length-1;
    const other=start?Math.min(4,line.length-1):Math.max(0,line.length-5);
    const dx=line[other]%w-line[k]%w;
    const dy=Math.floor(line[other]/w)-Math.floor(line[k]/w);
    const length=Math.hypot(dx,dy);
    return length>.01?[dx/length,dy/length]:null;
  }
  for(let remaining=parts.length;remaining>1;remaining--){
    const endpoints=new Map<number,Port[]>();
    parts.forEach((line,index)=>{
      // Preserve rings independently, including seals with a stroke meeting their rim.
      if(line[0]===line[line.length-1])return;
      for(const start of [true,false]){
        const pixel=line[start?0:line.length-1];
        const ports=endpoints.get(pixel)||[];
        ports.push({index,start});endpoints.set(pixel,ports);
      }
    });
    let best:{a:Port;b:Port;score:number}|null=null;
    for(const ports of endpoints.values())for(let i=0;i<ports.length;i++){
      for(let j=i+1;j<ports.length;j++){
        const a=ports[i],b=ports[j];
        if(a.index===b.index)continue;
        const ta=tangent(parts[a.index],a.start),tb=tangent(parts[b.index],b.start);
        if(!ta||!tb)continue;
        const score=ta[0]*tb[0]+ta[1]*tb[1];
        // At least ~150 degrees apart. T bars and crosses continue, Y arms do not.
        if(score<-.86 && (!best||score<best.score-1e-8))best={a,b,score};
      }
    }
    if(!best)break;
    const {a,b}=best;
    const first=a.start?[...parts[a.index]].reverse():parts[a.index];
    const second=b.start?parts[b.index]:[...parts[b.index]].reverse();
    const combined=first.concat(second.slice(1));
    parts[Math.min(a.index,b.index)]=combined;
    parts.splice(Math.max(a.index,b.index),1);
  }
  return parts;
}
function format(n:number){return Number(Math.max(0,Math.min(1000,n)).toFixed(3)).toString();}
export function traceInk(image:InkPixels,box:SourceBox,regionId:string,settings:TraceSettings={}):TraceResult{
  checkBox(box);
  const w=int(image.width,"Raster genişliği",12,512),h=int(image.height,"Raster yüksekliği",12,512);
  if(!image.data||image.data.length!==w*h*4)throw new Error("RGBA raster uzunluğu geçersiz.");
  if(!/^region-\d{3}$/.test(regionId))throw new Error("Bölge kimliği geçersiz.");
  const threshold=int(settings.threshold??135,"Mürekkep eşiği",15,245);
  const minLength=int(settings.minLength??5,"Minimum yol",2,120);
  const maxPaths=int(settings.maxPaths??160,"Çizgi sınırı",1,250);
  const tolerance=settings.simplify??.9;
  if(!Number.isFinite(tolerance)||tolerance<.2||tolerance>3)throw new RangeError("Sadeleştirme geçersiz.");
  const classified=classifyInk(image,{threshold,invert:settings.invert,
    inkMode:settings.inkMode,localContrast:settings.localContrast});
  const {mask,excludedPixels}=excludeInkFromMask(
    classified.mask,w,h,box,settings.excludedAreas);
  const inkPixels=classified.count-excludedPixels;
  if(inkPixels>mask.length*.82)throw new Error("Bölgenin çoğu mürekkep. Eşik/yerel kontrastı artır veya daha dar bölge seç.");
  const cleaned=cleanComponents(mask,w,h,4,settings.preserveDots===true);
  const thin=thinInkMask(mask,w,h),skeleton=extractSkeleton(thin,w,h);
  const lines=stitchSkeleton(skeleton,w);
  const found:Array<{d:string;length:number}>=[];
  for(const line of lines){
    if(line.length<minLength)continue;
    const pixels=line.map(i=>({x:i%w,y:Math.floor(i/w)}));
    const points=simplifyStroke(pixels,tolerance);
    if(points.length<2)continue;
    const output=points.map(p=>({x:box[0]+(p.x+.5)*box[2]/w,y:box[1]+(p.y+.5)*box[3]/h}));
    const d=output.map((p,i)=>(i?"L ":"M ")+format(p.x)+" "+format(p.y)).join(" ");
    if(d.length>7800)throw new Error("Yol çok karmaşık. Daha küçük bölge kullan.");
    const length=pixels.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-pixels[i].x,p.y-pixels[i].y),0);
    if(length>=minLength)found.push({d,length});
  }
  // Tiny ink dots near an existing major stroke may be Arabic diacritics,
  // decimal points or seal details, not random speckles. Preserve them as
  // very short S1-approved pen movements only when explicitly requested.
  for(const dot of cleaned.dots){
    const x=box[0]+(dot.x+.5)*box[2]/w,y=box[1]+(dot.y+.5)*box[3]/h;
    const step=Math.min(.7*box[2]/w,box[0]+box[2]-x);
    if(step>.0005)found.push({d:"M "+format(x)+" "+format(y)+" L "+format(x+step)+" "+format(y),length:.7});
  }
  found.sort((a,b)=>b.length-a.length||a.d.localeCompare(b.d));
  if(found.length>maxPaths)throw new Error("Çok fazla mürekkep yolu var ("+found.length+"). Bölgeyi daralt.");
  if(!found.length)throw new Error("Bu eşikte yeterli çizgi bulunamadı.");
  return {
    paths:found.map((line,i)=>({regionId,id:"trace."+regionId+"."+String(i+1).padStart(3,"0"),d:line.d})),
    inkPixels,
    thinnedPixels:thin.reduce((s,v)=>s+v,0),
    sample:{width:w,height:h},
    quality:{
      mode:classified.mode,preservedDots:cleaned.dots.length,
      removedSpeckles:cleaned.removedSpeckles,
      inkFraction:Number((inkPixels/mask.length).toFixed(4)),
      joinedSegments:skeleton.length-lines.length,
      excludedPixels,
    },
  };
}

/** Source review stays in normalized-1000 coordinates. Only the new SVG draft
 * is reprojected to the natural photograph aspect ratio. */
export function projectTracedGeometry(
  paths:ReadonlyArray<{id:string;d:string}>,naturalWidth:number,naturalHeight:number,
):{viewBox:[number,number,number,number];paths:Array<{id:string;d:string;ink:"trace"}>}{
  int(naturalWidth,"Kaynak genişliği",1,100000);
  int(naturalHeight,"Kaynak yüksekliği",1,100000);
  const width=Number((1000*naturalWidth/naturalHeight).toFixed(3));
  if(width<=0||width>100000)throw new RangeError("Kaynağın boy/en oranı geçersiz.");
  function remap(d:string):string{
    const input=d.trim().split(/\s+/),output:string[]=[];
    for(let i=0;i<input.length;){
      const op=input[i++];
      if(op==="Z"){output.push("Z");continue;}
      if((op!=="M"&&op!=="L")||i+1>=input.length)
        throw new Error("Kaynak kalem yolu yalnız M/L/Z komutlarını içermeli.");
      const x=Number(input[i++]),y=Number(input[i++]);
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1000||y<0||y>1000)
        throw new Error("Kaynak kalem yolu koordinatları geçersiz.");
      output.push(op,Number((x*width/1000).toFixed(3)).toString(),Number(y.toFixed(3)).toString());
    }
    return output.join(" ");
  }
  return {viewBox:[0,0,width,1000],paths:paths.map(path=>({id:path.id,d:remap(path.d),ink:"trace"}))};
}
