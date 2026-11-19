"use strict";
const {DatabaseSync}=require("node:sqlite"),path=require("node:path"),language=require("./publication-languages.cjs");
const db=new DatabaseSync(path.join(__dirname,"../../channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite"));
const en={
 "topic-chapter-bilginler-kitabi":{title:"Summonings",numberLabel:""},
 "topic-chapter-buyuk-meclisler":{title:"Records",numberLabel:""},
 "topic-chapter-istihbarat-davetleri":{title:"Records",numberLabel:""},
 "topic-series-bilginler-kitabi":{title:"Bilginler Kitabı",description:"Records of summonings involving the community of scholars presented separately from other books in the source narrative."},
 "topic-series-buyuk-meclisler":{title:"Great Councils",description:"Source records of the first and second council meetings, summonings, messengers, and warnings."},
 "topic-series-istihbarat-davetleri":{title:"Intelligence Summonings",description:"Intelligence invitees, UVB76/Edoloba 12 walkie-talkie experiments, and first-person accounts connected to these sources."}
};
let updated=0;
try{
 db.exec("BEGIN IMMEDIATE");
 for(const [id,data] of Object.entries(en)){
  const p=language.variants(db,"outline",id);if(!p)throw Error("Outline not found "+id);
  if(!p.variants.tr||p.variants.tr.state!=="approved"){
   language.save(db,{kind:"outline",id,language:"tr",sourceHash:p.sourceHash,revision:p.variants.tr?.revision||0,approved:true,data:p.source});
  }
  const v=language.variants(db,"outline",id);
  language.save(db,{kind:"outline",id,language:"en",sourceHash:v.sourceHash,revision:v.variants.en?.revision||0,approved:true,data});
  updated++;
  console.log("OUTLINE_APPROVED",id,data.title);
 }
 const proper="topic-series-dugumlu-kitap";
 const pack=language.variants(db,"outline",proper);
 const old=pack?.variants.en;
 if(old?.state==="approved"&&old.data.title!=="Düğümlü Kitap"){
  language.save(db,{kind:"outline",id:proper,language:"en",sourceHash:pack.sourceHash,revision:old.revision,approved:true,
    data:{...old.data,title:"Düğümlü Kitap"}});
  console.log("PROPER_BOOK_NAME_FIXED",proper);
 }
 db.exec("COMMIT");
}catch(e){db.exec("ROLLBACK");throw e}finally{db.close()}
console.log("TOC_OUTLINES_DONE",updated);
