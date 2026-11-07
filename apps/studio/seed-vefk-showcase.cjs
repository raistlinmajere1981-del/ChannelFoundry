"use strict";

/**
 * Studio's canonical, repeatable showcase — not a historical manuscript.
 * Run: node apps/studio/seed-vefk-showcase.cjs
 * Only seeds the active BirDeSenGör workspace, selects an approved immutable
 * revision for the NEXT Studio publication, and refreshes the LOCAL export.
 * It never contacts the website, deploys assets, or edits another document.
 */
const fs = require("node:fs");
const path = require("node:path");
const {DatabaseSync} = require("node:sqlite");
const project = require("./channel-projects.cjs");
const core = require("./vefk-core/index.cjs");
const store = require("./vefk-store.cjs");
const catalog = require("./vefk-publication.cjs");
const publication = require("./storage-publication.cjs");

const ID = "demo-gozlem-muhru-v2";
const TITLE = "DEMO · Arapça Harf Vefki · Çizim ve Katman Gösterimi";
const ROOT = path.resolve(__dirname, "../..");

const f = value => Number(value.toFixed(3)).toString();
function pathPoints(points, close = false) {
  if (points.length < 2) throw new Error("A drawn path needs two points.");
  return points.map(([x,y],i) => (i ? "L " : "M ") + f(x) + " " + f(y)).join(" ") + (close ? " Z" : "");
}
function circle(cx,cy,r,points=56,phase=-Math.PI/2) {
  return pathPoints(Array.from({length:points},(_,i)=>{
    const a=phase+Math.PI*2*i/points;
    return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];
  }),true);
}
function oval(cx,cy,rx,ry,points=28) {
  return pathPoints(Array.from({length:points},(_,i)=>{
    const a=-Math.PI/2+Math.PI*2*i/points;
    return [cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];
  }),true);
}
function line(ax,ay,bx,by) {return pathPoints([[ax,ay],[bx,by]]);}
function polygon(cx,cy,r,n=8,phase=-Math.PI/2) {
  return pathPoints(Array.from({length:n},(_,i)=>{
    const a=phase+Math.PI*2*i/n;
    return [cx+Math.cos(a)*r,cy+Math.sin(a)*r];
  }),true);
}
function transformed(d, factor=.70) {
  // The algorithmic square uses a 1000 x 1000 viewBox. Uniformly scale around
  // its true centre to make room for ornament while retaining cell semantics.
  const tokens=d.match(/[MLZ]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)/g) || [];
  const lines=[];
  for(let i=0;i<tokens.length;){
    const op=tokens[i++];
    if(op==="Z"){lines.push("Z");continue;}
    if(op!=="M"&&op!=="L")throw Error("Unexpected geometry command");
    const x=Number(tokens[i++]),y=Number(tokens[i++]);
    lines.push(op+" "+f(500+(x-500)*factor)+" "+f(500+(y-500)*factor));
  }
  return lines.join(" ");
}

// Original isolated-letter pen skeletons, authored in a 64 × 76 cell.
// Curves are sampled into the safe M/L grammar; dots remain separate pen lifts.
function cubic(a,b,c,d,n=18) {
  return Array.from({length:n+1},(_,i)=>{const t=i/n,u=1-t;
    return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],
      u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];});
}
const curve=(...p)=>cubic(...p);
const join=(...p)=>p.flatMap((v,i)=>i?v.slice(1):v);
const dot=(x,y)=>[[x-1.7,y-1.2],[x+1.5,y+1.3]];
const bowl=()=>curve([54,30],[62,58],[5,62],[10,32]);
const jim=()=>join(curve([12,24],[28,13],[49,20],[54,29]),curve([54,29],[15,29],[0,62],[30,65]),curve([30,65],[40,68],[49,62],[53,58]));
const dal=()=>join(curve([29,17],[38,22],[47,35],[48,42]),curve([48,42],[36,47],[23,49],[14,45]));
const ra=()=>curve([46,30],[51,48],[36,66],[14,62]);
const sin=()=>join(curve([57,29],[60,44],[45,48],[44,33]),curve([44,33],[44,48],[29,48],[29,34]),curve([29,34],[34,70],[2,69],[8,45]));
const sad=()=>join(curve([27,41],[39,13],[62,21],[56,37]),curve([56,37],[51,46],[38,45],[27,41]),curve([27,41],[34,70],[0,67],[8,44]));
const ayn=()=>join(curve([47,23],[30,7],[13,27],[36,33]),curve([36,33],[6,42],[7,69],[47,65]));
const fa=()=>join(curve([45,36],[25,29],[46,12],[51,26]),curve([51,26],[68,58],[9,63],[10,37]));
const tah=()=>join(curve([14,46],[32,14],[60,27],[52,40]),curve([52,40],[44,48],[25,46],[14,46]));
function arabicGlyph(letter){
  switch(letter){
    case 'ا':return [[[34,10],[31,59]]];
    case 'ب':return [bowl(),dot(32,65)];
    case 'ج':return [jim(),dot(33,48)];
    case 'د':return [dal()];
    case 'ه':return [join(curve([32,25],[58,28],[52,57],[30,54]),curve([30,54],[7,51],[12,24],[32,25]))];
    case 'و':return [join(curve([47,37],[24,45],[29,17],[43,25]),curve([43,25],[61,47],[35,68],[16,61]))];
    case 'ز':return [ra(),dot(42,18)];
    case 'ح':return [jim()];
    case 'ط':return [tah(),[[29,40],[31,9]]];
    case 'ي':return [join(curve([49,24],[28,14],[25,36],[46,40]),curve([46,40],[55,60],[5,65],[10,39])),dot(27,69),dot(38,69)];
    case 'ك':return [join([[52,10],[51,48]],curve([51,48],[40,59],[8,59],[12,35])),[[35,25],[26,32],[37,36],[28,42]]];
    case 'ل':return [join([[48,10],[47,47]],curve([47,47],[43,70],[5,65],[12,40]))];
    case 'م':return [join(curve([26,39],[46,14],[57,47],[35,44]),curve([35,44],[20,35],[17,49],[20,67]))];
    case 'ن':return [bowl(),dot(33,23)];
    case 'س':return [sin()];
    case 'ع':return [ayn()];
    case 'ف':return [fa(),dot(43,12)];
    case 'ص':return [sad()];
    case 'ق':return [join(curve([44,37],[25,31],[42,14],[50,28]),curve([50,28],[70,68],[1,70],[12,38])),dot(37,12),dot(48,12)];
    case 'ر':return [ra()];
    case 'ش':return [sin(),dot(32,19),dot(44,19),dot(38,11)];
    case 'ت':return [bowl(),dot(27,20),dot(39,20)];
    case 'ث':return [bowl(),dot(27,20),dot(39,20),dot(33,12)];
    case 'خ':return [jim(),dot(34,10)];
    case 'ذ':return [dal(),dot(32,8)];
    default:throw Error('Unsupported Arabic letter');
  }
}
const LETTERS=['ا ب ج د ه','و ز ح ط ي','ك ل م ن س','ع ف ص ق ر','ش ت ث خ ذ'].map(r=>r.split(' '));

function showcaseDocument(revision=2){
  const numeric=core.createVefk({id:"temporary-showcase-grid",title:"Geometry seed",schemaVersion:2,
    kind:"magicSquare",parameters:{order:5,first:1,step:1}});
  const grid=numeric.construction.grid;
  const base=core.squareGeometry(grid);
  const paths=[];
  const push=(id,d,ink,semanticValue)=>paths.push({id,d,ink,...(semanticValue!==undefined?{semanticValue}:{})});

  // Chapter I: a pair of hand-drawn circular observatory boundaries. Cardinal
  // ticks use individual paths so each pen lift is visible in the timeline.
  push("frame.ring.outer",circle(500,500,455,96),"border");
  push("frame.ring.inner",circle(500,500,430,88),"ornament");
  for(let i=0;i<24;i++){
    const theta=-Math.PI/2+Math.PI*2*i/24;
    const major=i%3===0;
    const a=major?436:444,b=452;
    push("frame.tick."+String(i+1).padStart(2,"0"),
      line(500+a*Math.cos(theta),500+a*Math.sin(theta),
           500+b*Math.cos(theta),500+b*Math.sin(theta)),major?"border":"fine");
  }
  for(let i=0;i<4;i++){
    const theta=Math.PI/4+i*Math.PI/2;
    const x=500+410*Math.cos(theta),y=500+410*Math.sin(theta);
    push("knot."+i+".diamond",polygon(x,y,14,4),"ornament");
    push("knot."+i+".dot",circle(x,y,4.5,14),"fine");
  }

  // Chapter II: square scaffold followed by isolated Arabic letters, right to left.
  for(const item of base.paths.filter(x=>x.id.startsWith("grid.")))
    push(item.id,transformed(item.d),item.id==="grid.outer"?"border":"grid");
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){
    const cellSize=780*.70/5;
    const cx=500-390*.70+(4-col+.5)*cellSize;
    const cy=500-390*.70+(row+.5)*cellSize;
    arabicGlyph(LETTERS[row][col]).forEach((points,i)=>{
      push(`cell.r${row}c${col}.s${i}`,pathPoints(points.map(([x,y])=>
        [cx+(x-32)*1.08,cy+(y-38)*1.08])),"letters",LETTERS[row][col]);
    });
  }

  // Chapter III: four dedicated, non-historical observatory seals.
  // Each form is authored as strokes; there are no fonts or SVG markup.
  const lensUpper=Array.from({length:21},(_,i)=>{
    const u=i/20,x=-43+86*u;
    return [500+x,149-23*Math.sin(Math.PI*u)];
  });
  const lensLower=Array.from({length:21},(_,i)=>{
    const u=i/20,x=43-86*u;
    return [500+x,149+23*Math.sin(Math.PI*u)];
  });
  push("seal.north.eye",pathPoints([...lensUpper,...lensLower],true),"seal");
  push("seal.north.iris",circle(500,149,15,36),"seal");
  push("seal.north.pupil",circle(500,149,5,20),"fine");
  push("seal.north.axis",line(500,182,500,217),"fine");

  push("seal.south.crescent.outer",pathPoints(Array.from({length:25},(_,i)=>{
    const a=-Math.PI*.78+i/24*Math.PI*1.56;return [500+Math.cos(a)*42,856+Math.sin(a)*42];
  })),"seal");
  push("seal.south.crescent.inner",pathPoints(Array.from({length:25},(_,i)=>{
    const a=-Math.PI*.72+i/24*Math.PI*1.44;return [500+13+Math.cos(a)*29,856+Math.sin(a)*29];
  })),"ornament");
  push("seal.south.star",polygon(503,862,16,8,Math.PI/8),"seal");
  push("seal.south.axis",line(500,783,500,810),"fine");

  const west=[153,500],east=[847,500];
  for(const [side,[x,y]] of [["west",west],["east",east]]){
    push("seal."+side+".octagon",polygon(x,y,34,8,Math.PI/8),"seal");
    push("seal."+side+".cross",line(x-20,y,x+20,y)+" "+line(x,y-20,x,y+20),"ornament");
    push("seal."+side+".core",polygon(x,y,12,4),"fine");
    const ax=side==="west"?185:815, bx=side==="west"?217:783;
    push("seal."+side+".axis",line(ax,y,bx,y),"fine");
  }

  // A small, balanced capstone at the four diagonals inside the outer ring.
  for(let i=0;i<4;i++){
    const theta=Math.PI/4+i*Math.PI/2;
    const x=500+362*Math.cos(theta),y=500+362*Math.sin(theta);
    push("finial."+i,polygon(x,y,7,4,Math.PI/4),"fine");
  }

  const geometry={
    coordinateSpace:"svg-viewBox",viewBox:[0,0,1000,1000],paths,
    inkStyles:{
      border:{width:4.2,cap:"round"},
      ornament:{width:2.6,cap:"round"},
      fine:{width:2.1,cap:"round"},
      grid:{width:3.5,cap:"round"},
      letters:{width:4.8,cap:"round"},
      seal:{width:5.2,cap:"round"},
    }
  };

  const markers=[{id:"outline",atMs:0}];
  let cursor=0;
  const strokes=paths.map((part,index)=>{
    if(part.id==="grid.outer")markers.push({id:"grid",atMs:cursor});
    if(part.id==="cell.r0c0.s0")markers.push({id:"arabic-letters",atMs:cursor});
    if(part.id==="seal.north.eye")markers.push({id:"seals",atMs:cursor});
    if(part.id==="finial.0")markers.push({id:"finish",atMs:cursor});
    const category=part.id.split(".")[0];
    const isCircle=part.id==="frame.ring.outer"||part.id==="frame.ring.inner";
    const durationMs=isCircle?(part.id.endsWith("outer")?4800:4200)
      :category==="frame"?220
      :category==="knot"?410
      :category==="grid"?(part.id==="grid.outer"?1400:570)
      :category==="cell"?660
      :category==="seal"?580
      :390;
    const gap=category==="cell"?110:category==="grid"?125:150;
    const easing=isCircle?"ease-in-out":category==="cell"?"ease-out":category==="seal"?"ease-in-out":"linear";
    const stroke={id:"stroke."+String(index+1).padStart(3,"0"),pathId:part.id,
      startMs:cursor,durationMs,ink:part.ink,pen:"down",easing};
    cursor+=durationMs+gap;
    return stroke;
  });
  markers.push({id:"hold",atMs:cursor});
  const drawPlan={timeUnit:"ms",durationMs:cursor+2200,markers,strokes};
  return core.createVefk({
    id:ID,revision,title:TITLE,description:
      "Merkezinde 5×5 Arapça tek harf yerleşimi bulunan, vektör tabanlı mürekkep çizimi ve divit animasyonunu sergileyen demo kayıt. Vefk Atölyesi için özgün gösterim tasarımıdır; tarihî belge veya ritüel etki iddiası taşımaz.",
    schemaVersion:2,language:"tr",kind:"manualPaths",geometry,drawPlan,
    provenance:{kind:"manual",references:[],notes:
      "Gösterim amaçlı özgün tasarım. Arapça harf gövdeleri ve ayrı nokta yolları elle tanımlanmıştır. Vefk Atölyesi çizim ve animasyon yeteneklerini sergiler; tarihî belge, aktarım veya ritüel etki iddiası yoktur."},
    accessibility:{
      summary:"Katmanlı Vefk Atölyesi demosu: önce iki eş merkezli halka ve 24 yön çizgisi, sonra 5×5 ızgara ve sağdan sola 25 Arapça tek harf, en son gözlem gözü ve ay mühürleri divitle çizilir.",
      matrixText:LETTERS.map(row=>row.join(" ")).join(" / "),
    }
  });
}

function install({activeCheck=true,exportLocal=true}={}){
  if(activeCheck&&project.activeProjectId(ROOT)!=="birdesengor")
    throw Error("Bu vitrin kaydı yalnız aktif BirDeSenGör Studio çalışma alanına eklenebilir.");
  const folder=path.join(project.activeDataRoot(ROOT),"studio");
  const dbFile=path.join(folder,"channel-foundry-studio.sqlite");
  if(!fs.existsSync(dbFile))throw Error("Studio veritabanı bulunamadı: "+dbFile);
  let document;
  const db=new DatabaseSync(dbFile,{timeout:5000});
  db.exec("PRAGMA foreign_keys=ON");
  try{
    catalog.ensureSchema(db);
    const existing=store.getDocument(db,ID);
    document=showcaseDocument(existing?.revision ?? 1);
    if(existing && existing.contentHash!==document.contentHash){
      if(!["approved","published"].includes(existing.status))throw Error("Mevcut taslak korunuyor; önce taslak incelenmeli.");
      document=showcaseDocument(existing.revision+1);
    }
    if(!existing || existing.contentHash!==document.contentHash){
      store.saveDraft(db,{document});
      store.setReviewState(db,{id:ID,revision:document.revision,status:"checked",expectedContentHash:document.contentHash});
      store.setReviewState(db,{id:ID,revision:document.revision,status:"approved",expectedContentHash:document.contentHash});
    }
    catalog.select(db,{id:ID,revision:document.revision,contentHash:document.contentHash,enabled:true,sortOrder:10});
    const exported=exportLocal?publication.exportPublicSnapshot(db,folder):null;
    const prepared=catalog.buildCatalog(db);
    if(catalog.validateCatalog(prepared).ok!==true||!prepared.entries.some(x=>x.id===document.id))
      throw Error("Yerel vitrin kataloğu doğrulaması başarısız.");
    return {id:document.id,title:document.title,revision:document.revision,status:"approved",
      selectedForNextPublication:true,exportedLocally:Boolean(exported),
      pathCount:document.geometry.paths.length,strokeCount:document.drawPlan.strokes.length,
      durationSeconds:document.drawPlan.durationMs/1000,
      strokeEasings:[...new Set(document.drawPlan.strokes.map(x=>x.easing))],
      phases:document.drawPlan.markers.map(x=>x.id),contentHash:document.contentHash,
      catalogCount:prepared.entries.length,
      publicationFile:exported?.file??null,localOnly:true};
  }finally{db.close();}
}
module.exports={ID,TITLE,showcaseDocument,install};
if(require.main===module)console.log(JSON.stringify(install(),null,2));
