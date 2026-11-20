"use strict";
const assert=require("node:assert/strict");
const {DatabaseSync}=require("node:sqlite");
const workspace=require("./universe-workspace.cjs");
const client=require("./ai-client.cjs");
const quality=require("./universe-attribute-quality.cjs");
const sides=require("./universe-side-status.cjs");
const originalChat=client.chat;
const calls=[];
const first="Kral Arohan geçmişte karanlık taraftaydı; artık aydınlık tarafa katıldığını açıkça söyledi.";
const second="Kral Arohan'ın unvanının Babil kralı olduğunu saray heyeti doğruladı.";
const functionQuote="Düğümlü Kitap farklı davetlileri çağırmak için kullanılır.";
const descriptiveQuote="Küçük mavi kitap sandığın yanında bulundu.";
const staleQuote="Davetli, uzak bir yerde bulunduğunu ileri sürdü.";
client.chat=async(_path,messages)=>{
  calls.push(messages);
  const data=JSON.parse(messages[1].content);
  return JSON.stringify({records:data.map(row=>({
    key:row.key,
    fields:row.kind==="character" ? {
      sideStatus:{value:"karanlik_once_aydinlik",reason:"Kaynak iki ayrı dönemden söz ediyor.",
        evidence:[{detailIndex:0,quote:first,sourceVideoId:"videoA"}]},
      rank:{value:"Kral",reason:"Doğrudan unvan.",
        evidence:[{detailIndex:1,quote:second,sourceVideoId:"videoA"}]},
      age:{value:"340 yaşında",reason:"Tahmini yaş.",
        evidence:[{detailIndex:1,quote:second,sourceVideoId:"videoA"}]},
      species:{value:"Cin",reason:"Uydurulmuş bir gerekçe.",
        evidence:[{detailIndex:0,quote:"Bu cümle kayıtta yok ve doğrulanamaz.",sourceVideoId:"videoA"}]},
    } : row.kind==="object"?{
      type:{value:"Kitap",reason:"Nesne sınıfı.",
        evidence:[{detailIndex:0,quote:functionQuote,sourceVideoId:"videoB"}]},
      property:{value:"Davetli çağırma",reason:"Açık işlev.",
        evidence:[{detailIndex:0,quote:functionQuote,sourceVideoId:"videoB"}]},
      custodian:{value:"Arohan",reason:"Kaynakta böyle bir sahip yok.",
        evidence:[{detailIndex:1,quote:"Doğrulanmayan metin.",sourceVideoId:"videoB"}]},
    }:{},
  }))});
};
delete require.cache[require.resolve("./universe-attributes.cjs")];
const attr=require("./universe-attributes.cjs");
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON;");
workspace.ensureSchema(db);
attr.ensureSchema(db);
const insert=db.prepare("INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,payload_json,source_video_ids_json,state) VALUES (?,1,?,?,?,?,?,?)");
const p=(details)=>JSON.stringify({details});
const d=(text,sourceVideoIds)=>({text,sourceVideoIds});
insert.run("char-1","character","Kral Arohan","Babil'de kral olduğu anlatılır.",
  p([d(first,["videoA"]),d(second,["videoA"])]),'["videoA"]',"approved");
insert.run("obj-1","object","Düğümlü Kitap","Bir davet kitabı.",
  p([d(functionQuote,["videoB"]),d(descriptiveQuote,["videoB"])]),'["videoB"]',"approved");
insert.run("empty-1","location","Belirlenmemiş Yer","Kayıt kısa.",p([d(staleQuote,["videoC"])]),'["videoC"]',"approved");
insert.run("draft-1","location","Taslak Mekân","Taslak",p([]),'[]',"draft");
(async()=>{
 try{
  assert.equal(sides.OPTIONS.length,6);
  assert.deepEqual(sides.OPTIONS.map(x=>x.label),
    ["Belirsiz","Nötr","Aydınlık","Karanlık","Karanlık → Aydınlık","Aydınlık → Karanlık"]);
  assert.deepEqual(sides.parse("notr"),{formerSide:"",side:"notr"});
  assert.deepEqual(sides.parse(""),{formerSide:"",side:""});
  assert.throws(()=>sides.parse("bagimsiz"),/Geçersiz/);
  assert.equal(quality.validateSuggestion("character","rank","Babil Mahkemesi Başkanı",[{quote:"Gece gelen yabancıyı yakalayıp Babil mahkemesine götürür ve mahkemeye başkanlık eder."}]),false);
  assert.equal(quality.validateSuggestion("character","rank","Mahkeme Başkanı",[{quote:"Babil mahkemesinin başkanı olarak göreve atandı."}]),true);
  assert.deepEqual(sides.parse("karanlik_once_aydinlik"),{formerSide:"karanlik",side:"aydinlik"});
  assert.deepEqual(sides.parse("karanlik"),{formerSide:"",side:"karanlik"});
  assert.deepEqual(attr.publicFields("character",{sideStatus:"karanlik_once_aydinlik",age:"300",irrelevant:"junk"}),
    {sideStatus:"karanlik_once_aydinlik",age:"300",side:"aydinlik",formerSide:"karanlik"});
  assert.throws(()=>sides.parse("aydinlik_once_aydinlik"),/Geçersiz/);
  assert.throws(()=>attr.saveMany(db,{edits:[{entityKey:"draft-1",field:"position",value:"Yol"}]}),/Yalnız onaylı/);
  assert.throws(()=>attr.saveMany(db,{edits:[{entityKey:"char-1",field:"sideStatus",value:"darkness"}]}),/Geçersiz taraf durumu/);
  assert.throws(()=>attr.saveMany(db,{edits:[{entityKey:"char-1",field:"formerSide",value:"karanlik"}]}),/geçersiz özellik/);
  const selected=quality.sourceContext({kind:"character",source_video_ids_json:'["v1"]'},{
    details:Array.from({length:35},(_,i)=>d(i===31?
      "Önceden karanlık taraftaydı; artık aydınlık safına katıldı.":"Sıradan bir görüşme yaptığını anlatır.",["v1"]))
  });
  assert.ok(selected.some(x=>x.index===31),"Source selection must inspect details beyond the first twelve");
  assert.equal(quality.validateSuggestion("object","property","Mavi",[{quote:descriptiveQuote}]),false);
  assert.equal(quality.validateSuggestion("object","property","Davetli çağırma",[{quote:functionQuote}]),true);
  assert.equal(quality.validateSuggestion("character","sideStatus","karanlik_once_aydinlik",[{quote:first}]),true);
  assert.equal(quality.validateSuggestion("character","sideStatus","aydinlik",[{quote:"Karanlık geçidi açıldı ve kayboldu."}]),false);
  // Explicit narrative religious status may be an in-story side indicator.
  const faithCases=[
    ["Tuji", "Müslüman olduktan sonra sarayda Eyşan'la karşılaştığını söyler.", "karanlik_once_aydinlik", true],
    ["Hednuriş", "Müslüman olmaya karar verdiğini söyler ve şehadet getirdiği anlatılır.", "karanlik_once_aydinlik", true],
    ["Yaşlı Deha", "Hatat tarafına desteğini geri çeker, şehadet getirir ve Kâruf'a hizmet etmeyi teklif eder.", "karanlik_once_aydinlik", true],
    ["Eshuda reported", "Hednuriş ve yardımcılar Eshuda'nın Müslüman olduğunu bildirir.", "aydinlik", true],
    ["Eshuda reported only - not conversion", "Hednuriş ve yardımcılar Eshuda'nın Müslüman olduğunu bildirir.", "karanlik_once_aydinlik", false],
    ["Arşimo", "Müslüman olduğu için 140 yıldır zindanda tutulduğunu söyler.", "aydinlik", true],
    ["Arohan unvanlı üyelik", "Kral Aruhan Müslüman bir kral, Müslüman bir orduya sahip.", "aydinlik", true],
    ["Arohan doğrudan üyelik", "Kral Aruhan bizim Müslüman dostumuz.", "aydinlik", true],
    ["Varsayımsal üyelik", "Aruhan Müslüman olur mu, bilmiyorum.", "aydinlik", false],
    ["Arşimo history unconfirmed", "Müslüman olduğu için 140 yıldır zindanda tutulduğunu söyler.", "karanlik_once_aydinlik", false],
    ["Artum Christian", "Kendisini Hristiyan olarak tanıtır ve binlerce yıldır yaşadığını söyler.", "karanlik", true],
    ["Reşum unconfirmed", "Arohan'ın öğüdü üzerine kendisine İslam anlatılır; bu kesitte şehadet getirip serbest bırakıldığı kesinleşmez.", "aydinlik", false],
    ["Reşum history unconfirmed", "Arohan'ın öğüdü üzerine kendisine İslam anlatılır; bu kesitte şehadet getirip serbest bırakıldığı kesinleşmez.", "karanlik_once_aydinlik", false],
    ["Poyraz guest", "Ömer'le rahibi ağırlar ve konuğun şehadet getirmesinin ardından onun kararını konuşur.", "aydinlik", false],
    ["Poyraz guest history", "Ömer'le rahibi ağırlar ve konuğun şehadet getirmesinin ardından onun kararını konuşur.", "karanlik_once_aydinlik", false],
    ["Hales son other Muslim", "Tutsağın önemli mevkili bir Müslüman olduğunu ve düşmanlarınca bağlandığını söyledi.", "aydinlik", false],
    ["Hezmina tribe", "Kendisi hapsedilmişken kabilesinin Müslüman olduğunu söyler.", "aydinlik", false],
    ["Islam lesson no conversion", "Kendisine İslam anlatılır ve kabul etmeye hazırlandığı söylenir.", "aydinlik", false],
  ];
  for(const [name,quote,status,expected] of faithCases)
    assert.equal(quality.validateSuggestion("character","sideStatus",status,[{quote}]),expected,
      "Misclassified religious narrative: "+name);
  const proposed=await attr.suggest(db,"unused",{keys:["char-1","obj-1","empty-1"]});
  assert.equal(proposed.evaluated,3);
  assert.equal(proposed.proposed,4,"Only source-anchored useful facts are eligible");
  const state=attr.list(db);
  assert.equal(state.profiles.length,0,"Nothing is automatically approved");
  assert.equal(state.analyses.length,3,"Even no-suggestion records are tracked");
  assert.equal(state.proposals.length,4);
  assert.ok(state.proposals.every(x=>x.evidence.length===1));
  assert.ok(state.proposals.some(x=>x.field==="sideStatus"&&x.value==="karanlik_once_aydinlik"));
  assert.equal(calls.length,1);
  assert.throws(()=>attr.review(db,{action:"approve",items:[{entityKey:"char-1",field:"age"}]}),/artık mevcut değil/);
  attr.review(db,{action:"approve",items:[
    {entityKey:"char-1",field:"sideStatus"},{entityKey:"char-1",field:"rank"},
    {entityKey:"obj-1",field:"type"},{entityKey:"obj-1",field:"property"},
  ]});
  let profiles=attr.list(db).profiles;
  assert.equal(profiles.find(x=>x.entityKey==="char-1").fields.sideStatus,"karanlik_once_aydinlik");
  assert.equal(profiles.find(x=>x.entityKey==="obj-1").fields.property,"Davetli çağırma");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM universe_entity_attribute_evidence").get().n,4,"Provenance preserved after approval");
  assert.equal(attr.list(db).provenance.length,4);
  assert.equal(attr.list(db).proposals.length,0);
  attr.saveMany(db,{edits:[{entityKey:"char-1",field:"sideStatus",value:"aydinlik"}]});
  assert.equal(db.prepare("SELECT COUNT(*) n FROM universe_entity_attribute_evidence WHERE entity_key='char-1' AND field='sideStatus'").get().n,0,"Manual override clears AI provenance");
  // Stale AI results cannot overwrite a new manual choice.
  db.prepare("INSERT INTO universe_entity_attribute_proposals(entity_key,field,value,baseline,evidence_json) VALUES ('char-1','rank','Elçi','Eski değer','[]')").run();
  assert.throws(()=>attr.review(db,{action:"approve",items:[{entityKey:"char-1",field:"rank"}]}),/Öneri oluşturulduktan sonra/);
  attr.review(db,{action:"reject",items:[{entityKey:"char-1",field:"rank"}]});
  assert.equal(attr.list(db).proposals.length,0);
  assert.equal(attr.list(db).analyses.length,3);
  console.log("PASS: single dropdown, full-source prioritization, exact source anchors, weak metadata filtered, provenance retained, bulk review and stale-safety");
 }finally{client.chat=originalChat;db.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
