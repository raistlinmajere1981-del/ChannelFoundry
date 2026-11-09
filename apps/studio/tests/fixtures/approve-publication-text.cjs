// Explicit, disposable reviewer decisions for browser fixtures. Never used by production export.
const language=require('../../publication-languages.cjs');
const publication=require('../../publication-v2.cjs');
function approveFixtureText(db){
 const snapshot=publication.buildPublicationV2(db,{sourceOnly:true}).snapshot;
 language.sync(db,snapshot);
 for(const record of language.records(snapshot)){
  const pack=language.variants(db,record.kind,record.id),data=structuredClone(pack.source);
  if(record.kind==='vefk'&&!data.description)data.description='Yalnız izole tarayıcı testi için vefk açıklaması.';
  language.save(db,{kind:record.kind,id:record.id,language:'tr',data,sourceHash:pack.sourceHash,revision:pack.variants.tr?.revision||0,approved:true});
 }
}
module.exports={approveFixtureText};
