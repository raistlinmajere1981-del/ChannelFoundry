"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const durable=require("./translation-durable.cjs");
const languages=require("./publication-languages.cjs");
test("entity displayName is generated without touching canonical identity",()=>{
 const original={name:"Ruşun'un Davetine Sızan İsimsiz Elçi",kind:"character",summary:"Ruşun'un davetine girer.",details:[{text:"Dört cellat getirdi."}],sourceVideoIds:["video-1"]};
 const fields=durable.fieldsFrom(original,"entity");
 assert(fields.some(x=>x.path.join(".")==="displayName"));
 assert(!fields.some(x=>x.path.join(".")==="name"));
 const target=durable.applyFields(original,fields,{fields:fields.map(x=>({...x,text:x.path.at(-1)==="displayName"?"The Unnamed Envoy Who Infiltrated Ruşun's Invitation":"The envoy arrives."}))});
 assert.equal(target.name,original.name);
 assert.equal(target.sourceVideoIds[0],"video-1");
 assert.equal(target.displayName,"The Unnamed Envoy Who Infiltrated Ruşun's Invitation");
 assert.doesNotThrow(()=>languages.validateVariant("entity",original,target));
});
test("missing, invented and duplicated fields are rejected without changing input",()=>{
 const before={title:"Kitap",blocks:[{text:"Ömer gördü."}]},fields=durable.fieldsFrom(before,"section");
 assert.throws(()=>durable.applyFields(before,fields,{fields:[]}),/count mismatch/);
 assert.throws(()=>durable.applyFields(before,fields,{fields:fields.map((x,i)=>i?{...x,path:["unknown"]}:x)}),/unknown/);
 assert.equal(before.title,"Kitap");
});
test("chunking remains deterministic and quota detection covers provider errors",()=>{
 const fields=Array.from({length:6},(_,i)=>({path:["items",i,"text"],text:"A".repeat(800)}));
 const groups=durable.fieldChunks(fields,1800);
 assert.deepEqual(groups.map(x=>x.length),[2,2,2]);
 assert.equal(durable.isQuota("OpenCode Model kotası (429): rate_limit"),true);
 assert.equal(durable.isQuota("Connection refused"),false);
});
test("quality audit flags lost numbers and protected names",()=>{
 const original={title:"Nezrin 52 davetliye anlattı."};
 const output={title:"A guest recounted this."};
 const report=durable.qa(original,output,durable.fieldsFrom(original,"section"));
 assert(report.flags.includes("GLOSSARY:Nezrin"));
 assert(report.flags.includes("NUMBERS_CHANGED"));
});

test("number QA accepts Turkish decimal commas in equivalent English numbers",()=>{
 const tr={title:"Tuji 1-1,5 metre yaklaştı ve 12,75 oranı kaydetti."};
 const en={title:"Tuji came within 1–1.5 meters and noted a ratio of 12.75."};
 assert(!durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
 const wrong={title:"Tuji came within 2–1.5 meters and noted a ratio of 12.75."};
 assert(durable.qa(tr,wrong,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
});

test("Babil may localize as Babylon but a named identity must remain exact",()=>{
 const original={title:"Babil'de Yaşlı Duman konuştu.",summary:"Konuşma."};
 const target={title:"Old Smoke spoke in Babylon.",summary:"A conversation."};
 const report=durable.qa(original,target,durable.fieldsFrom(original,"section"));
 assert(!report.flags.includes("GLOSSARY:Babil"));
 assert(report.flags.includes("GLOSSARY:Yaşlı Duman"));
});

test("Turkish stated clock times map to English 24-hour clock notation",()=>{
 const tr={title:"Saat 9.35'te çıktım."},en={title:"I left at 9:35."};
 assert(!durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
 const measure={title:"Uzunluğu 9.35 metre."};
 const wrong={title:"It measured 9:35 meters."};
 assert(durable.qa(measure,wrong,durable.fieldsFrom(measure,"section")).flags.includes("NUMBERS_CHANGED"));
});

test("zero-padded dotted Turkish clock ranges match English clock ranges, but decimals do not",()=>{
 const tr={title:"Gece 03.12 ile 03.59 arasında ve 03.12–03.59 aralığında konuşuldu."};
 const en={title:"We spoke between 03:12 and 03:59 at night, and in the 03:12–03:59 interval."};
 assert(!durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
 const bad={title:"We spoke between 03:12 and 03:58 at night, and in the 03:12–03:59 interval."};
 assert(durable.qa(tr,bad,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
 const metric={title:"Boyutları 03.12 ile 03.59 metre olarak ölçüldü."};
 const misleading={title:"The lengths were measured as 03:12 to 03:59 meters."};
 assert(durable.qa(metric,misleading,durable.fieldsFrom(metric,"section")).flags.includes("NUMBERS_CHANGED"));
});

test("Turkish apostrophe-suffixed 21.30'da maps to 21:30, but metric decimal stays distinct",()=>{
 const tr={title:"Pazartesi günü 21.30'da buluşmak üzere."};
 const en={title:"See you Monday at 21:30."};
 assert(!durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
 const bad={title:"See you Monday at 21:31."};
 assert(durable.qa(tr,bad,durable.fieldsFrom(tr,"section")).flags.includes("NUMBERS_CHANGED"));
 const metric={title:"Uzunluğu 9.35 metre."},wrong={title:"It measured 9:35 meters."};
 assert(durable.qa(metric,wrong,durable.fieldsFrom(metric,"section")).flags.includes("NUMBERS_CHANGED"));
});

test("5. Murat may become Murat V but an incorrect Roman ordinal is rejected",()=>{
 const tr={title:"5. Murat'ın babasının ismini sordu."};
 const en={title:"He asked for the name of Murat V's father."};
 const flags=durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags;
 assert(!flags.includes("NUMBERS_CHANGED"));
 assert(!flags.includes("NUMBER_NAME_MISMATCH:5_Murat"));
 const bad={title:"He asked for the name of Murat IV's father."};
 assert(durable.qa(tr,bad,durable.fieldsFrom(tr,"section")).flags.includes("NUMBER_NAME_MISMATCH:5_Murat"));
});

test("canonical İbni Kâruf and İbni Necemin satisfy older source-name forms",()=>{
 const tr={title:"İbn Karuf ve İbn Necem",blocks:[{spans:[{type:"text",text:"İbn Karuf, İbn Necem ile konuştu."}]}]};
 const en={title:"İbni Kâruf and İbni Necemin",blocks:[{spans:[{type:"text",text:"İbni Kâruf spoke with İbni Necemin."}]}]};
 const report=durable.qa(tr,en,durable.fieldsFrom(tr,"section"));
 assert(!report.flags.some(x=>x.includes("Karuf")||x.includes("Necem")));
});

test("frequently repeated proper names do not trigger untranslated-Turkish false alarms",()=>{
 const source={title:"Şami, Çaylık ve Çığlık Ormanı",summary:"Şami Şami Şami Şami Şami ile Eşref oradaydı."};
 const translated={title:"Şami, Çaylık and Çığlık Forest",summary:"Şami spoke to Eşref about Şami, and Şami returned to Şami."};
 const flags=durable.qa(source,translated,durable.fieldsFrom(source,"section")).flags;
 assert(!flags.includes("POSSIBLE_TURKISH"));
 const other={title:"Example",summary:"Ömer bir olay anlattı; başka ayrıntılar vardı, fakat kesin değildi. Ardından tekrar konuşmaya başladı."};
 const badlyTranslated={title:"Example",summary:"A strange thing happened. Gerçekten çok karışık bir şey olduğu için insanlar yanlışlıkla başka şeylere karar vermişlerdi."};
 const badFlags=durable.qa(other,badlyTranslated,durable.fieldsFrom(other,"section")).flags;
 assert(badFlags.includes("POSSIBLE_TURKISH"));
});

test("canonical named book Karanlık Devrin Kitabı is preserved",()=>{
 const tr={title:"Karanlık Devrin Kitabı çağrısı"};
 const en={title:"A summoning from Book of the Dark Age"};
 const flags=durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags;
 assert(flags.includes("GLOSSARY:Karanlık Devrin Kitabı"));
 assert(flags.some(x=>x.startsWith("NAME_MISSING:Karanlık Devrin Kitabı")));
 en.title="A summoning from Karanlık Devrin Kitabı";
 assert(!durable.qa(tr,en,durable.fieldsFrom(tr,"section")).flags.some(x=>x.includes("Karanlık Devrin Kitabı")));
});

test("inline reference can shift a name across one adjacent link without losing it",()=>{
 const source={blocks:[{spans:[
  {type:"text",text:"Kral Arohan'ın sarayının bulunduğu "},
  {type:"reference",entityId:"city-babylon",label:"Babil"},
  {type:"text",text:"'e gitmesini teklif ettim."}
 ]}]};
 const translated={blocks:[{spans:[
  {type:"text",text:"I offered to send her to "},
  {type:"reference",entityId:"city-babylon",label:"Babylon"},
  {type:"text",text:", where Kral Arohan's palace stood."}
 ]}]};
 const fields=durable.fieldsFrom(source,"section");
 assert(!durable.qa(source,translated,fields).flags.some(f=>f.startsWith("NAME_MISSING:Kral Arohan")));
 translated.blocks[0].spans[2].text=", where the palace stood.";
 assert(durable.qa(source,translated,fields).flags.some(f=>f.startsWith("NAME_MISSING:Kral Arohan")));
 translated.blocks[0].spans[2].text=", where Kral Arohan's palace stood.";
 translated.blocks[0].spans[1].entityId="city-other";
 assert(durable.qa(source,translated,fields).flags.some(f=>f.startsWith("NAME_MISSING:Kral Arohan")));
});

test("detects a broken English sentence after a fixed-position entity reference",()=>{
 const original={blocks:[{spans:[{type:"reference",entityId:"poyraz",label:"Poyraz"},{type:"text",text:"'a önemli bir toplantı olduğunu anlattım."}]}]};
 const translated={blocks:[{spans:[{type:"reference",entityId:"poyraz",label:"Poyraz"},{type:"text",text:"I told him there was an important meeting."}]}]};
 const report=durable.qa(original,translated,durable.fieldsFrom(original,"section"));
 assert(report.flags.some(x=>x.startsWith("REFERENCE_GRAMMAR")));
 translated.blocks[0].spans[1].text=" was the person I told about an important meeting.";
 const improved=durable.qa(original,translated,durable.fieldsFrom(original,"section"));
 assert(!improved.flags.some(x=>x.startsWith("REFERENCE_GRAMMAR")));
});

test("flags untranslated Turkish prose and mistaken radio translation of a walkie-talkie",()=>{
 const original={summary:"Telsizden duyduğum sesin nereden geldiğini anlamaya çalışıyordum, ancak emin değildim."};
 const bad={summary:"I heard a voice from the radio but did not know where it came from."};
 const a=durable.qa(original,bad,durable.fieldsFrom(original,"section"));
 assert(a.flags.some(x=>x.startsWith("TRANSCEIVER_MAY_BE_RADIO")));
 const good={summary:"I heard a voice on the walkie-talkie but did not know where it came from."};
 assert(!durable.qa(original,good,durable.fieldsFrom(original,"section")).flags.some(x=>x.startsWith("TRANSCEIVER_MAY_BE_RADIO")));
 const untranslated=durable.qa(original,original,durable.fieldsFrom(original,"section"));
 assert(untranslated.flags.some(x=>x.startsWith("UNTRANSLATED")));
});

test("name fidelity is checked per field, not just anywhere in the translated record",()=>{
 const original={summary:"Ömer came here.",details:[{text:"Ömer asked the question."}]};
 const wrong={summary:"Ömer came here.",details:[{text:"I asked the question."}]};
 const result=durable.qa(original,wrong,durable.fieldsFrom(original,"entity"));
 assert(result.flags.some(x=>x.startsWith('NAME_MISSING:Ömer:')));
});
