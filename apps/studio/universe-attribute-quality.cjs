"use strict";
// Only source-anchored, meaningful attributes may enter the editor's review queue.
const {parse:parseSideStatus}=require("./universe-side-status.cjs");
const HISTORY=/(?:eskiden|önceden|önceleri|geçmişte|bir zamanlar|bir dönem|evvelce|daha önce|sonradan|artık|şimdi|şu anda|ayrıldı|geçti|değiştirdi|terk etti)/i;
const MEMBERSHIP=/(?:taraf|saf|cephe|mensup|bağlı|ayrıldı|geçti|katıldı|aidiyet)/i;
const SIDE_TERMS={aydinlik:/(?:aydınlık|ışık taraf)/i,karanlik:/karanlık/i,notr:/(?:nötr|bağımsız|tarafsız)/i};
// In this narrative's own classification, light/dark often corresponds to
// a character's explicitly described religious position. This is not a
// general claim about the morality of any real-world religion.
const FAITH_POSITIVE=/(?:müslüman (?:oldu|olur|olmuş|olduğunu|olduklarını|olduğu|oldukları|olduktan|olduğundan|olarak|olduğum)|müslüman(?:ım|ız|dır|dırlar)|islam['’]?[ıi]? (?:kabul|seç)|islam[a'e]? (?:geç|girdi)|şehadet getir|şehadet etti|kelime[- ]?i? ?şehadet getir|kelimeişehadet getir|iman etti)/i;
const FAITH_NEGATIVE=/(?:müslüman değil|müslüman olmadığ|müslüman olmadığı|müslüman olmadığını|gayrimüslim|kendisini (?:hristiyan|yahudi|musevi|putperest) olarak tanıt|(?:hristiyan|yahudi|musevi) olduğunu söyler)/i;
const FAITH_UNCONFIRMED=/(?:şehadet.{0,85}(?:kesinleşmez|kesin değildir|belli değil|bilinmiyor|gösterilmez|getirmedi|getirmemiş)|müslüman (?:olduğu kesinleşmez|olup olmadığı)|islam(?:a|['’]?[ıi])? (?:kabul edip etmediği)|(?:henüz|daha) müslüman değil)/i;
const FAITH_INTENTION=/(?:müslüman (?:olmak ist|olmaya karar|olmayı düşün)|islam(?:a|['’]?[ıi])? (?:geçmek ist|geçmeye karar))/i;
const FAITH_CONVERTED=/(?:şehadet (?:getirdi|getirir|getirmiş|getirdiğini|getirdiği|getirdikleri|getirip|getirmesiyle)|kelime[- ]?i? ?şehadet (?:getirdi|getirir|getirdiğini|getirip)|kelimeişehadet (?:getirdi|getirir|getirip)|müslüman (?:oldu(?=$|[\s,.;!?])|oldular(?=$|[\s,.;!?])|olmuş(?=$|[\s,.;!?])|olduktan sonra)|islam['’]?[ıi]? kabul (?:etti|eder|etmiş|ettiğini)|sonradan müslüman)/i;
const FAITH_OTHER_PERSON=/(?:konuğ(?:un|a)|davetli(?:nin|ler)|tutsağ(?:ın|ı)|kabile(?:nin|si)|başka (?:bir )?(?:kişi|varlık)|onun (?:müslüman|şehadet))/i;
function faithSignals(evidence){
  const text=evidence.map(item=>item.quote).join(" ");
  const completed=FAITH_CONVERTED.test(text);
  const unfinished=FAITH_UNCONFIRMED.test(text)||(FAITH_INTENTION.test(text)&&!completed);
  // Mixed-subject snippets must not be attributed to the current entity.
  const thirdPerson=FAITH_OTHER_PERSON.test(text);
  return {
    muslim:!unfinished&&!thirdPerson&&FAITH_POSITIVE.test(text)&&!FAITH_NEGATIVE.test(text),
    nonMuslim:!thirdPerson&&FAITH_NEGATIVE.test(text),
    converted:!unfinished&&!thirdPerson&&completed,
  };
}
const WEAK_PROPERTY=/^(?:eski|yeni|küçük|büyük|mavi|kırmızı|yeşil|sarı|siyah|beyaz|uzun|kısa|güzel|korkunç|karanlık|aydınlık|gizemli|gizli|antik|taş|metal|tahta|demir|altın|gümüş|özel|tehlikeli|ağır|hafif|yuvarlak|parlak|sert|yumuşak|sihirli|büyülü|mühürlü)$/i;
const GENERIC=/^(?:bilinmiyor|bilinmez|belirsiz|bilgi yok|belli değil|yok|yoktur|—|-|n\/a|unknown|none|kişi|varlık|şey|nesne|yer|mekan|mekân|bir tür|davetli|konuk|katılımcı)$/i;
const FUNCTIONAL=/^(?:koruma|koruyucu|mühürleme|mühür|iyileştirme|şifa|geçiş|geçit|ışınlanma|haberleşme|iletişim|yönlendirme|dönüşüm|çağırma|davet|gizleme|hapsetme|bağlama|çözme|izleme|gösterme)$/i;
const ROLE_LESS=/^(?:davetli|konuk|katılımcı|kişi|karakter|figür|görevli|yardımcı olabilecek kişi)$/i;
const fold=value=>String(value??"").replace(/\s+/gu," ").trim().toLocaleLowerCase("tr");
function detailScore(kind,text){
  let score=0;
  const groups={
    character:[[/(?:müslüman|islam|şehadet|kelimeişehadet|iman ett|hristiyan|yahudi|gayrimüslim)/i,12],
      [/(?:karanlık|aydınlık|bağımsız|tarafsız)/i,9], [/(?:taraf|saf|cephe|bağlı|mensup)/i,5],
      [/(?:eskiden|önceden|geçmişte|sonradan|artık|ayrıldı|değiştirdi)/i,4],
      [/(?:yaşında|yaşı|yıl yaş|yüzyıl)/i,5],
      [/(?:boyut|âlem|diyar|kral|sultan|elçi|komutan|koruyucu|muhafız|başkan|önder|vezir|rehber|cin|insan|ruh)/i,3]],
    object:[[/(?:açar|açmak|korur|koruma|mühür|geçit|işlev|etki|yetenek|yapabilir|dönüş|şifa|güç|çağır|haberleş|yönet|bağla)/i,9],
      [/(?:sahib|sahip|koruyuc|emanet|üreti|yapımc|taşıyan|saklay|ait)/i,6],
      [/(?:kitap|taş|sandık|kılıç|asa|anahtar|yüzük|kapı|defter)/i,2]],
    location:[[/(?:konum|yer al|bulun|içinde|içerisinde|bağlı|yanında|yakınında|altında|üstünde)/i,6],
      [/(?:boyut|âlem|diyar|geçit|kapı)/i,7],
      [/(?:şehir|saray|tapınak|kule|mahzen|orman|köy|dağ|mağara|vadi|zindan)/i,3]],
  };
  for(const [rx,weight] of groups[kind]||[])if(rx.test(text))score+=weight;
  return score;
}
function sourceContext(node,payload){
  const allowed=new Set(JSON.parse(node.source_video_ids_json||"[]"));
  const details=(Array.isArray(payload.details)?payload.details:[])
    .map((v,index)=>({index,text:String(v?.text??"").trim().replace(/\s+/gu," ").slice(0,720),
      sourceVideoIds:Array.isArray(v?.sourceVideoIds)?v.sourceVideoIds.filter(id=>allowed.has(id)).slice(0,6):[]}))
    .filter(v=>v.text&&v.sourceVideoIds.length);
  const limit=node.kind==="character"?24:20;
  const scored=details.map(row=>({...row,score:detailScore(node.kind,row.text)}))
    .sort((a,b)=>b.score-a.score||a.index-b.index);
  const chosen=new Map();
  for(const row of details.slice(0,2))chosen.set(row.index,row);
  if(details.length>2)chosen.set(details[details.length-1].index,details[details.length-1]);
  for(const row of scored){if(chosen.size>=limit)break;chosen.set(row.index,row);}
  return [...chosen.values()].sort((a,b)=>detailScore(node.kind,b.text)-detailScore(node.kind,a.text)||a.index-b.index);
}
function evidenceFor(node,payload,evidence){
  if(!Array.isArray(evidence)||!evidence.length||evidence.length>5)return [];
  const allowed=new Set(JSON.parse(node.source_video_ids_json||"[]"));
  const details=Array.isArray(payload.details)?payload.details:[];
  const valid=[];
  for(const source of evidence){
    if(!Number.isInteger(source?.detailIndex)||source.detailIndex<0||source.detailIndex>=details.length)continue;
    const detail=details[source.detailIndex];
    const full=String(detail?.text||"").replace(/\s+/gu," ").trim();
    const quote=String(source.quote||"").replace(/\s+/gu," ").trim();
    const videoId=String(source.sourceVideoId||"");
    if(quote.length<14||quote.length>450||!fold(full).includes(fold(quote)))continue;
    if(!allowed.has(videoId)||!Array.isArray(detail?.sourceVideoIds)||!detail.sourceVideoIds.includes(videoId))continue;
    valid.push({detailIndex:source.detailIndex,sourceVideoId:videoId,quote});
  }
  return valid.length===evidence.length?valid:[];
}
function validateSuggestion(kind,field,value,evidence){
  const v=String(value??"").trim();
  if(!v||GENERIC.test(v)||v.length>140)return false;
  const joined=evidence.map(x=>x.quote).join(" ");
  if(kind==="character"&&field==="sideStatus"){
    let parts;try{parts=parseSideStatus(v);}catch{return false;}
    if(!parts.side||parts.side==="belirsiz"&&!parts.formerSide)return false;
    const faith=faithSignals(evidence);
    const faction=MEMBERSHIP.test(joined);
    const explicitCurrent=parts.side==="notr"
      ? /(?:tarafsız (?:kaldığ|olduğ|olmayı|olduğunu)|nötr (?:kaldığ|olduğ|olduğunu)|(?:bağımsız|tarafsız|nötr) (?:bir )?taraf|taraf(?:sız| tutmadığ)|hiçbir tarafa bağlı değil)/i.test(joined)
      : faction && SIDE_TERMS[parts.side]?.test(joined);
    const faithCurrent=(parts.side==="aydinlik"&&faith.muslim) ||
      (parts.side==="karanlik"&&faith.nonMuslim);
    if(!explicitCurrent&&!faithCurrent)return false;
    if(parts.formerSide){
      const explicitHistory=HISTORY.test(joined)&&faction&&SIDE_TERMS[parts.formerSide]?.test(joined);
      const faithHistory=parts.formerSide==="karanlik"&&parts.side==="aydinlik"&&faith.converted&&faith.muslim;
      if(!explicitHistory&&!faithHistory)return false;
    }
  }
  if(kind==="character"&&field==="rank"){
    if(ROLE_LESS.test(v))return false;
    // "He presided over a court" is an action, not the formal post of chair.
    // A source must explicitly name appointment or incumbency of that office.
    if(/(?:mahkeme|meclis)(?:si|sinin|inin|i)?\s*(?:başkanı|reisi)/i.test(v) &&
      !/(?:mahkeme|meclis)(?:si)?(?:nin|nın|nun|nün)?\s+(?:resmî\s+)?(?:başkanı|reisi)(?:dır|ydi|ydı|ymış|ymiş|\s+olarak|\s+görevine|\s+seçildi|\s+atandı|\s+olduğunu|\s+olduğu)/i.test(joined))
      return false;
  }
  if(kind==="character"&&field==="age"){
    if(!/(?:yaş|yıllık|yüzyıllık|asır)/i.test(joined)||!/(?:\d|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yüz|bin)/i.test(joined))return false;
  }
  if(kind==="object"&&field==="property"){
    if(WEAK_PROPERTY.test(v)||(!v.includes(" ")&&!FUNCTIONAL.test(v)))return false;
    if(!/(?:aç|koru|mühür|geç|etki|yeten|dönüş|iyileş|şifa|çağır|haberleş|iletişim|bağla|çöz|gizle|hapset|sakla|yaz|oku|göster|yönlen|tanımla|kullanıl|işe yarar|güç|işlev|davet|taşı|tedavi|engelle|kontrol|hatırlat|yönlendirme)/i.test(joined))return false;
  }
  if(kind==="object"&&field==="type"&&/^(?:nesne|eşya|parça)$/i.test(v))return false;
  if(kind==="location"&&field==="type"&&/^(?:mekân|yer|alan|bölge)$/i.test(v))return false;
  if(kind==="location"&&field==="position"&&/^(?:bilinmiyor|dünya|evren)$/i.test(v))return false;
  return true;
}
module.exports={sourceContext,evidenceFor,validateSuggestion,faithSignals};
