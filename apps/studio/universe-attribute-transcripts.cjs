"use strict";

// Source excerpts are read-only context for suggestions; they are not written to
// universe records. Every quoted subtitle must be traced to an approved
// character's linked, Turkish source video before it may enter the review queue.
const SIGNALS = Object.freeze({
  sideStatus: /müslüman|gayrimüslim|şehadet|islam(?:ı|a|iyet)|iman ett|aydınlık (?:taraf|saf)|karanlık (?:taraf|saf)|tarafsız|nötr/giu,
  rank: /başkomutan|komutan|padişah|kraliçe|kral|hükümdar|vezir|reis|rehber|muhafız|elçi|lider|başkan|sultan/giu,
  age: /yaş(?:ında|ınday|ını|ı|ındak)|\b\d{2,5}\s*yıllık\b|\byüzyıllık\b/giu,
  species: /\binsan\b|\bcin\b|\bruh\b|melek|metafizik varlık|\bhayvan\b/giu,
  dimension: /\b\d{1,2}\s*\.?(?:inci|ıncı|uncu|üncü|nci|ncı)?\s*boyut|boyut(?:ta|unda|un|u|lar)?\s*\d{1,2}\b/giu,
});
const MAX_EXCERPTS=12;
const STOP_NAMES=new Set(["isimsiz","anlatıcı","karakter","bilinmeyen","konuk","kişi","varlık"]);
const clean=value=>String(value||"").replace(/\s+/gu," ").trim();
const fold=value=>clean(value).toLocaleLowerCase("tr-TR");
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
function aliases(node) {
  let aliases=[];
  try { aliases=JSON.parse(node.aliases_json||"[]"); } catch {}
  const entries=[node.name,...(Array.isArray(aliases)?aliases:[])]
    .map(clean).filter(name=>name.length>=5 && name.length<=100 && !STOP_NAMES.has(fold(name)))
    .sort((a,b)=>b.length-a.length);
  return [...new Set(entries.map(fold))].slice(0,18);
}
function matcher(name) {
  return new RegExp("(?<![\\p{L}\\p{N}])"+escapeRegex(name)+"(?![\\p{L}\\p{N}])","giu");
}
function sourceExcerpts(db,node,current={},cache=new Map()) {
  if(node.kind!=="character")return [];
  const names=aliases(node);
  if(!names.length)return [];
  let ids=[];
  try{ids=JSON.parse(node.source_video_ids_json||"[]");}catch{}
  const missing=Object.keys(SIGNALS).filter(field=>!current[field]);
  if(!missing.length)return [];
  const lookup=db.prepare("SELECT text,language FROM source_transcripts WHERE provider='youtube' AND external_id=?");
  const namePatterns=names.map(matcher),seen=new Set(),candidates=[];
  // Process linked source videos only. Video cache is shared across a single AI batch.
  for(const videoId of ids) {
    if(typeof videoId!=="string"||!videoId||seen.has(videoId))continue;
    seen.add(videoId);
    let row=cache.get(videoId);
    if(row===undefined){row=lookup.get(videoId)||null;cache.set(videoId,row);}
    if(!row||row.language!=="tr"||!row.text)continue;
    const text=clean(row.text);
    const hits=[];
    for(const rx of namePatterns) {
      rx.lastIndex=0;
      for(const match of text.matchAll(rx)) {
        hits.push({start:match.index,end:match.index+match[0].length});
        if(hits.length>=120)break;
      }
      if(hits.length>=120)break;
    }
    hits.sort((a,b)=>a.start-b.start);
    let perVideo=0;
    for(const hit of hits) {
      const sliceStart=Math.max(0,hit.start-160),sliceEnd=Math.min(text.length,hit.end+170);
      const around=text.slice(sliceStart,sliceEnd);
      const local=[];
      for(const field of missing) {
        const regex=SIGNALS[field];
        regex.lastIndex=0;
        let match;
        while((match=regex.exec(around))) {
          const signalStart=sliceStart+match.index,signalEnd=signalStart+match[0].length;
          const distance=Math.max(0,signalStart-hit.end,hit.start-signalEnd);
          if(distance>110)continue;
          const start=Math.max(0,Math.min(hit.start,signalStart)-75);
          const end=Math.min(text.length,Math.max(hit.end,signalEnd)+105);
          const excerpt=text.slice(start,Math.min(end,start+430));
          if(excerpt.length<25)continue;
          local.push({field,distance,sourceVideoId:videoId,text:excerpt,position:hit.start});
          if(local.length>=14)break;
        }
      }
      local.sort((a,b)=>a.distance-b.distance);
      for(const item of local.slice(0,4)) {
        const fingerprint=item.field+":"+item.sourceVideoId+":"+item.text.slice(0,60);
        if(candidates.some(c=>c.field===item.field&&c.sourceVideoId===item.sourceVideoId&&Math.abs(c.position-item.position)<140))continue;
        if(candidates.some(c=>c.fingerprint===fingerprint))continue;
        candidates.push({...item,fingerprint});
        perVideo++;
      }
      if(perVideo>=8)break;
    }
  }
  // Balance sources across fields; otherwise dozens of faith mentions would
  // drown out a rare age, species or dimension statement.
  const selected=[],used=new Set();
  for(const field of missing) {
    const fieldRows=candidates.filter(row=>row.field===field)
      .sort((a,b)=>a.distance-b.distance||a.position-b.position);
    let count=0;
    for(const row of fieldRows) {
      if(count>=3)break;
      const id=row.sourceVideoId+":"+row.position;
      if(used.has(id))continue;
      selected.push(row);used.add(id);count++;
    }
  }
  selected.sort((a,b)=>a.distance-b.distance||a.sourceVideoId.localeCompare(b.sourceVideoId));
  return selected.slice(0,MAX_EXCERPTS).map((row,index)=>({
    index,fieldHint:row.field,sourceVideoId:row.sourceVideoId,text:row.text
  }));
}
function verifyTranscriptExcerpt(node,evidence,excerpts,cache=new Map()) {
  if(!Number.isInteger(evidence?.transcriptIndex)||evidence.transcriptIndex<0)return null;
  const excerpt=excerpts[evidence.transcriptIndex];
  if(!excerpt||excerpt.index!==evidence.transcriptIndex)return null;
  const sourceVideoId=String(evidence.sourceVideoId||"");
  if(!sourceVideoId||sourceVideoId!==excerpt.sourceVideoId)return null;
  const quote=clean(evidence.quote);
  if(quote.length<14||quote.length>450||!fold(excerpt.text).includes(fold(quote)))return null;
  const row=cache.get(sourceVideoId);
  if(!row||row.language!=="tr"||!fold(row.text).includes(fold(quote)))return null;
  let allowed=[];try{allowed=JSON.parse(node.source_video_ids_json||"[]");}catch{}
  if(!allowed.includes(sourceVideoId))return null;
  return {sourceType:"transcript",detailIndex:-1,sourceVideoId,quote};
}
module.exports={sourceExcerpts,verifyTranscriptExcerpt,aliases};
