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

test("Babil may localize as Babylon but a named identity must remain exact",()=>{
 const original={title:"Babil'de Yaşlı Duman konuştu.",summary:"Konuşma."};
 const target={title:"Old Smoke spoke in Babylon.",summary:"A conversation."};
 const report=durable.qa(original,target,durable.fieldsFrom(original,"section"));
 assert(!report.flags.includes("GLOSSARY:Babil"));
 assert(report.flags.includes("GLOSSARY:Yaşlı Duman"));
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
