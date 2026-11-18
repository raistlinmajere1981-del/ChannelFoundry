"use strict";
const assert=require("node:assert/strict");
const {DatabaseSync}=require("node:sqlite");
const workspace=require("./universe-workspace.cjs");
const attrs=require("./universe-attributes.cjs");
const quality=require("./universe-attribute-quality.cjs");
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
workspace.ensureSchema(db);
attrs.ensureSchema(db);
const put=db.prepare("INSERT INTO universe_workspace_nodes(key,run_id,kind,name,summary,payload_json,source_video_ids_json,state) VALUES(?,1,?,?,?,?,?,?)");
put.run("char-one","character","Örnek Karakter","Test karakteri","{}","[]","approved");
put.run("loc-one","location","Örnek Mekân","Test mekânı","{}","[]","approved");
put.run("obj-one","object","Örnek Nesne","Test nesnesi","{}","[]","approved");
assert.equal(attrs.list(db).dictionary.length,55);
assert.throws(()=>attrs.saveMany(db,{edits:[{entityKey:"char-one",field:"species",value:"Yeni Tür"}]}),/sözlüğe/);
assert.throws(()=>attrs.saveMany(db,{edits:[{entityKey:"loc-one",field:"dimension",value:"6. boyut"}]}),/Boyut/);
assert.throws(()=>attrs.registerOption(db,{kind:"character",field:"age",value:"Yüzyıllık"}),/sözlük/);
const created=attrs.registerOption(db,{kind:"character",field:"species",value:"Yeni Tür",labelEn:"New kind"});
assert.equal(created.created,true);
assert.equal(attrs.registerOption(db,{kind:"character",field:"species",value:"yeni tür"}).created,false,"Case-insensitive duplicate");
assert.deepEqual(attrs.englishFields("character",{species:"Yeni Tür",dimension:"6",age:"500 küsür"},attrs.list(db).dictionary),{species:"New kind",dimension:"6"},"Only approved dictionary translations and numeric dimensions are English-safe");
attrs.saveMany(db,{edits:[
 {entityKey:"char-one",field:"species",value:"Yeni Tür"},
 {entityKey:"char-one",field:"age",value:"500 küsür"},
 {entityKey:"loc-one",field:"dimension",value:"6"},
 {entityKey:"obj-one",field:"property",value:"Sırları korur"},
]});
assert.equal(attrs.list(db).profiles.length,3);
const merged=attrs.mergeOption(db,{kind:"character",field:"species",source:"Yeni Tür",target:"Metafizik varlık"});
assert.equal(merged.changed,1);
attrs.ensureSchema(db);
assert.equal(attrs.list(db).dictionary.some(o=>o.value==="Yeni Tür"),false,"Merged option must not re-seed");
assert.equal(attrs.list(db).profiles.find(o=>o.entityKey==="char-one").fields.species,"Metafizik varlık");
assert.equal(quality.validateSuggestion("location","dimension","6",[{quote:"Mezna altıncı boyutla ilişkilendirilir."}]),true);
assert.equal(quality.validateSuggestion("location","dimension","6",[{quote:"Saray altı yıl önce kurulmuş."}]),false);
assert.equal(quality.validateSuggestion("location","position","Dünya",[{quote:"Babil'de bir saray vardı."}]),false);
assert.equal(quality.validateSuggestion("location","position","Dünya",[{quote:"Dünya'daki sarayda bulunur."}]),true);
const remaining=attrs.clearAll(db);
assert.equal(remaining.universe_entity_attributes,3);
assert.equal(attrs.list(db).profiles.length,0);
assert.equal(attrs.list(db).dictionary.some(o=>o.value==="Mezna"),true);
assert.equal(db.prepare("SELECT COUNT(*) n FROM universe_workspace_nodes").get().n,3);
db.close();
console.log("PASS: editable dictionaries, numeric dimensions, explicit evidence, merge, reset isolation");
