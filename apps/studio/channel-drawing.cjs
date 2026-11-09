'use strict';
/** Managed artwork using the existing immutable manualPaths document contract.
 * Only explicitly installed BirDeSenGör records are synchronized on export.
 */
const core = require('./vefk-core/index.cjs');
const store = require('./vefk-store.cjs');
const catalog = require('./vefk-publication.cjs');
const artwork = require('./channel-drawing/artwork.json');
const letters = require('./channel-drawing/letter-outlines.json');
const ID = 'birdesengor-channel-drawing';
const f = n => String(Math.round(n * 100) / 100);

function sponsorFor(db, publishedVideos, now = Date.now()) {
  // The caller supplies the existing publication allowlist, never raw discovery.
  const candidates = publishedVideos.filter(v => v.publicationStatus === 'published'
    && v.analysisStatus === 'complete' && !v.analysisStale && !v.membersOnly
    && Number.isFinite(Date.parse(v.publishedAt)) && Date.parse(v.publishedAt) <= now)
    .sort((a,b) => Date.parse(b.publishedAt)-Date.parse(a.publishedAt) || a.videoId.localeCompare(b.videoId));
  const editorial = require('./ai-analysis-editorial.cjs');
  for (const latest of candidates) {
    // Recheck the owning review, including if approval changed since allowlisting.
    const pack = editorial.editorialPackage(db, latest.videoId);
    const review = editorial.getReview(db, latest.videoId);
    if (pack?.state !== 'curated' || review.state !== 'curated') continue;
    const names = [];
    for (const name of [
      ...(pack.items ?? []).filter(i => i.category === 'sponsor' && review.decisions[i.key] === 'confirm').map(i => i.label),
      ...(pack.manualSponsors ?? []),
    ]) {
      const text = String(name).trim().normalize('NFC');
      if (text && !names.some(n => n.toLocaleLowerCase('tr-TR') === text.toLocaleLowerCase('tr-TR'))) names.push(text);
    }
    return { videoId: latest.videoId, names };
  }
  return { videoId: '', names: [] };
}
function textLines(text, maxWidth = 900, size = 23) {
  const width = s => Array.from(s).reduce((total,c) => {
    if (!letters[c]) throw new Error(`Kanal çizimi yazı konturu bulunamadı: ${c} (U+${c.codePointAt(0).toString(16)}). Sponsor gizlenmedi; yayın düzeltilmeli.`);
    return total + letters[c].advance * size/1000;
  },0);
  const lines=[]; let line='';
  // Wrap even a single long sponsor name, with no truncation or guessed glyphs.
  for (const c of text) {
    if (line && width(line+c)>maxWidth) { lines.push(line.trimEnd());line=''; }
    line+=c;
  }
  if (line.trim())lines.push(line.trim());
  return lines.map(value=>({text:value,width:width(value)}));
}
function makeDocument({ revision = 1, sponsor = {videoId:'',names:[]} } = {}) {
  const sponsorText = sponsor.names.length ? 'Son bölümün destekçisi: '+sponsor.names.join(' · ') : 'Destekçilerimize teşekkürler';
  const lines = textLines(sponsorText);
  const paths=artwork.paths.map(p=>({...p}));
  let charIndex=0;
  lines.forEach((line,row)=>{
    let x=(1000-line.width)/2;
    for (const char of line.text) {
      const glyph=letters[char];
      const d=glyph.runs.map(run=>run.map(([gx,gy],i)=>(i?'L ':'M ')+f(x+gx*.023)+' '+f(700+row*32+gy*.023)).join(' ')).join(' ');
      if (d)paths.push({id:'sponsor.letter.'+String(charIndex).padStart(4,'0'),d,ink:'letter',semanticValue:char});
      x+=glyph.advance*.023;charIndex++;
    }
  });
  const height=Math.max(740,722+lines.length*32);
  const geometry={coordinateSpace:'svg-viewBox',viewBox:[0,0,1000,height],paths,
    inkStyles:{construction:{width:.8,cap:'round'},contour:{width:1.25,cap:'round'},portrait:{width:1.05,cap:'round'},hatch:{width:1.15,cap:'round'},letter:{width:1.05,cap:'round'}}};
  let cursor=0; const markers=[{id:'outline',atMs:0}];let portraitStarted=false,sponsorStarted=false;
  const strokes=paths.map((p,i)=>{
    if(p.id.startsWith('portrait.')&&!portraitStarted){markers.push({id:'portrait',atMs:cursor});portraitStarted=true;}
    if(p.id.startsWith('sponsor.')&&!sponsorStarted){markers.push({id:'sponsor',atMs:cursor});sponsorStarted=true;}
    // Length-based timing includes actual pen lifts between independent runs.
    const tokens=p.d.match(/[MLZ]|[-+]?\d+(?:\.\d+)?/g);let length=0,last=null;
    for(let j=0;j<tokens.length;){const op=tokens[j++];if(op==='Z')continue;const point=[+tokens[j++],+tokens[j++]];if(last&&op==='L')length+=Math.hypot(point[0]-last[0],point[1]-last[1]);last=point;}
    const durationMs=Math.max(90,Math.round(length*(p.ink==='letter'?5:1.8)));
    const stroke={id:'stroke.'+String(i).padStart(4,'0'),pathId:p.id,startMs:cursor,durationMs,ink:p.ink,pen:'down',easing:'linear'};
    cursor+=durationMs+50;return stroke;
  });
  markers.push({id:'hold',atMs:cursor});
  return core.createVefk({id:ID,revision,schemaVersion:2,title:'Kanal Çizimi',language:'tr',kind:'manualPaths',geometry,
    drawPlan:{timeUnit:'ms',durationMs:cursor+1500,markers,strokes},
    description:'BirDeSenGör kanalının kaynak kompozisyonundan çizilmiş dış çerçeve, bitkisel süslemeler, portre ve geometrik çizgiler. '+sponsorText+'.',
    provenance:{kind:'manual',references:[artwork.source],notes:
      `Kaynak SHA-256: ${artwork.sha256}. Görselin yalnız [${artwork.crop.join(', ')}] alanı kullanıldı. Portre benzerliği kaynak konturlarından ve gerçek divit taramalarından üretildi; kâğıt dokusu ve sürekli tonlar yeniden üretilmedi. Sponsor kaynağı: ${sponsor.videoId || 'onaylanmış yayın yok'}; yalnız açıkça onaylanan veya elle girilen sponsorlar. Yazı konturları: Noto Serif (SIL OFL 1.1).`},
    accessibility:{summary:'Çerçeve ve süslemeler, merkezde şapkalı ve sakallı portre, çevresel geometri ve altta '+sponsorText+'.',matrixText:sponsorText},
  });
}
function saveApproved(db,document) {
  store.saveDraft(db,{document});
  for(const status of ['checked','approved'])store.setReviewState(db,{id:ID,revision:document.revision,status,expectedContentHash:document.contentHash});
}
function synchronize(db,publishedVideos,{install=false}={}) {
  if(!install&&!db.prepare("SELECT 1 FROM sqlite_master WHERE name='vefk_documents'").get())return null;
  const previous=store.getDocument(db,ID);
  if(!previous&&!install)return null;
  if(previous&&!['approved','published'].includes(previous.status))throw new Error('Kanal Çizimi taslağı korunuyor; otomatik güncellemeden önce mevcut taslağı inceleyin.');
  const sponsor=sponsorFor(db,publishedVideos);
  if (previous && !sponsor.videoId && /Sponsor kaynağı: (?!onaylanmış yayın yok)/.test(previous.document.provenance.notes)) {
    catalog.select(db,{id:ID,revision:previous.revision,contentHash:previous.contentHash,enabled:true,sortOrder:0});
    return {id:ID,revision:previous.revision,sponsor:null,changed:false,document:previous.document};
  }
  let document=makeDocument({revision:previous?.revision ?? 1,sponsor});
  if(previous&&previous.contentHash!==document.contentHash)document=makeDocument({revision:previous.revision+1,sponsor});
  if(!previous||previous.contentHash!==document.contentHash)saveApproved(db,document);
  // The managed, deterministic Turkish source text is published with its signed
  // drawing revision. Other works and manually reviewed English variants keep
  // the existing language workflow (stale translations are never reused).
  const languages=require('./publication-languages.cjs');
  const data={title:document.title,description:document.description,notes:document.provenance.notes,
    references:document.provenance.references,sourceVersion:document.contentHash};
  const sourceHash=languages.putSource(db,'vefk',ID,data);
  const variant=languages.variants(db,'vefk',ID).variants.tr;
  if (!variant || variant.stale) languages.save(db,{kind:'vefk',id:ID,language:'tr',sourceHash,
    revision:variant?.revision ?? 0,data,approved:true});
  catalog.select(db,{id:ID,revision:document.revision,contentHash:document.contentHash,enabled:true,sortOrder:0});
  return {id:ID,revision:document.revision,sponsor,changed:previous?.contentHash!==document.contentHash,document};
}
module.exports={ID,makeDocument,sponsorFor,synchronize};
