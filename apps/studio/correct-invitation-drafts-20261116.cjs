"use strict";
/* Reproducible editorial corrections supported by the original Turkish subtitles. */
const {DatabaseSync}=require("node:sqlite");
const path=require("node:path");
const assert=require("node:assert/strict");
const {update,detail}=require("./invitation-draft-service.cjs");
const dbPath=path.resolve(__dirname,"../../channels/birdesengor/.local-data/studio/channel-foundry-studio.sqlite");
const edits=[
 [1,
  ["Sağlıklı bir bilgi alamadığımızı ve saldırdığını düşündüğümüz için daveti kapattım.",
   "Sağlıklı bir bilgi alamadığımızı, konuğun saldırgan olduğunu düşündüğümü ve daveti kapatacağımı söyledim."],
  ["Kitabı da danışmak üzere sakladık.","Kitabı danışmak üzere yanımıza almayı konuştuk."],
  ["Yaşadığı yerin adını Selanur, ardından Selor olarak söyledi.",
   "Yaşadığı yerin adını Selanur, gezegeninin adını ise Selor olarak duydum."]],
 [2,
  ["Tutsağın kim olduğunu sordum. Hales adını vermedi; çok önemli biri olduğunu ve düşmanlarının şeytani olduğunu söyledi. Ben de tutsağın Müslüman olabileceğini düşündüm. Hales, tutsağın daveti yapılırsa bulunduğu yerde bulunabileceğini söyledi. Bir yandan da boyutta benim için önemli bir şey olduğunu, gidip almam gereken yeri tarif edeceğini anlattı.",
   "Hales, tutsağın daveti yapılırsa bulunduğu yerde bulunabileceğini söyledi. Bir yandan da boyutta benim için önemli bir şey olduğunu, gidip almam gereken yeri tarif edeceğini anlattı."],
  ["Kitabı buraya getirebilmek için özel bir tarif gerektiğini, bu kitabın çok önemli olduğunu söyledi.",
   "Kitabı buraya getirebilmek için özel bir tarif gerektiğini, bu kitabın çok önemli olduğunu söyledi. Tutsağın kim olduğunu sorduğumda adını vermedi; çok önemli biri olduğunu ve düşmanlarının şeytani olduğunu söyledi. Ben de tutsağın Müslüman olabileceğini düşündüm."]],
 [3,
  ["Kitapta 137 davetli bulunduğunu, bunların birbirinden haberdar olduğunu ve hiçbirinin esaret altında bulunmadığını anlattı.",
   "Davetimi bilen 137 kişi olduğunu, bunların bu kitaptan dostları olduğunu ve hiçbirinin esaret altında bulunmadığını söyledi."],
  ["Yerinin adını tam anlayamadım.","Tutsağın bulunduğu yerin adını da söyledi."],
  ["büyük bir kalede yaşadıklarını, babasının krallara ve padişahlara hizmet ettiğini, kendisinin de babasının işlerinden sorumlu olduğunu söyledi.",
   "büyük bir kaleleri olduğunu ve işleri oradan yönettiklerini, babasının krallara ve padişahlara hizmet ettiğini, kendisinin de babasının işlerinden sorumlu olduğunu söyledi."],
  ["Kırmızı kitabı almak ve tutsakla ilgilenmek daha sonra yapacağımız işler olarak kaldı.",
   "Kırmızı kitabı almayı istiyordum; tutsakla ilgili ne yapabileceğimizi de kitabı boyuttan alıp alamayacağımıza bağlı olarak düşünüyordum."]],
 [4,
  ["Tamruş kitabın ilk sayfasını açıp ezberlememi istedi.","Tamruş kitabın ön sayfasını ezberlememi istedi."],
  ["Kitabı Tamruş’a geri verdim. O da yeniden beze sarıp kare taşın arkasındaki yerine koydu.",
   "Kitap yeniden beze sarılıp kare taşın arkasındaki yerine kondu."],
  ["Bulunduğumuz yerin yerin yüz metre altında olduğunu söyledi.","Bulunduğumuz yerin yerin yüz metre altında olduğunu söyledi."]],
 [5,
  ["Kapağını açtığımda gördüğüm yazıları ezberlemem istenmişti, ama buna zaman yetmemişti.",
   "Kapağını açtığımda gördüğüm yazıları ezberlemem istenmişti; bunları ezberlemek için daha uzun zamana ihtiyacım olduğunu düşünüyordum."],
  ["Agnos’la birlikte dört kişi bir masanın etrafında oturuyordu.",
   "Agnos’un da aralarında olduğu üç kişi masanın etrafında oturuyordu; ben de oraya geldiğimde dördüncüydüm."],
  ["Diğer üçünün adlarını Şanş, Zri ve Muda olarak duydum.",
   "Konuşma sırasında Şanş, Zri ve Muda diye duyduğum isimler söylendi; bunların masadaki kişilerle tam eşleşmesi açık değildi."],
  ["Ona bizi neden çağırdığını, kitabın bulunduğu yere neden gitmek istediklerini ve evin hangi çölde olduğunu sordum.",
   "Ona beni neden çağırdığını, kitabın bulunduğu yere neden gitmek istediklerini ve evin hangi çölde olduğunu sordum."],
  ["Daveti kapatıp istişare etmeye karar verdim.","Daveti kapatıp istişare edeceğimi söyledim."]],
 [6,
  ["Adını Menşun olarak anladım.","Adını Menşun gibi duydum."],
  ["aslanı, tilkiyi, leyleği, Davut yıldızını, ardından 4 ve 7 rakamlarını",
   "aslanı, tilkiyi, Davut yıldızını, ardından 4 ve 7 rakamlarını"],
  ["Poyraz, boyutta gördüğüm yazının anlamının dönüşümden sonra geçici olarak hafızama gelmiş olabileceğini düşündü.",
   "Poyraz, boyutta gördüğüm yazının anlamının boyuttan çıktıktan sonra geçici olarak hafızama gelmiş olabileceğini düşündü."]],
 [7,
  ["Önceki davette gördüğüm tabletleri ve oradaki satırlardan bir ikisini okuduğumu sonradan görünce yaşadığım şaşkınlığı da hatırladım.",
   "Önceki davette gördüğüm tableti ve o sırada kitaptaki ilk satırlardan birkaçını okuduğumu kaydı izleyince fark edişimi de hatırladım."],
  ["Mnu Estera bir masanın başındaydı; masada şişeler ve içinde su bulunan bir tas vardı.",
   "Mnu Estera bir masanın başındaydı; masada şişeler vardı. Bana içinde su bulunan bir tas verdi."]],
 [8,
  ["Ben oradayken Eşref Abi ve Poyraz bulundukları yerden benimle konuşup yönlendirdiler.",
   "Ben oradayken Eşref Abi bulunduğu yerden benimle konuşup beni yönlendirdi."]],
 [9,
  ["Zincirlerine dokundum; önce bir şey olmadı, sonra zincir dağıldı ve o da kayboldu.",
   "Zincirlerine dokundum; önce bir şey olmadı, sonra zincir dağıldı."]],
 [10,
  ["Eşref Abi ve Poyraz’la onuncu davete geçmeden önce Huşimi’yi konuştuk.",
   "Eşref Abi’yle onuncu davete geçmeden önce Huşimi’yi konuştuk."],
  ["Düğümli Kitap’ın onuncu davetini açtık.","Düğümlü Kitap’ın onuncu davetini açtık."],
  ["Kitabın tılsımını kendisinden başka kimsenin bozamayacağını, anahtarın bende olmasının da iyi olduğunu anlattı.",
   "Kitabın tılsımını kendisinden başka kimsenin bozamayacağını ve anahtarı bu kadar kolay alacağımı düşünmediğini söyledi."],
  ["Diğer davetlilerden biri yanlış bir şey yaparsa ben davet etmeden onu engelleyeceğini söyledi.",
   "Diğer davetlilerden biri de imanını satarsa ben çağırmadan onu yok edeceğini söyledi."],
  ["Kitap bu davet sırasında gelmedi.",""]],
];
function main(){
 const apply=process.argv.includes("--apply");
 const db=new DatabaseSync(dbPath);
 try{
  const plan=[];
  for(const [number,...changes] of edits){
   const original=detail(db,number);
   assert(original.draft && !original.stale,"Draft not current: "+number);
   let body=original.draft.body;
   for(const [oldText,newText] of changes) {
    if(oldText===newText)continue;
    assert(body.split(oldText).length===2,"Mismatch in #"+number+": "+oldText);
    body=body.replace(oldText,newText);
   }
   plan.push({number,oldLength:original.draft.body.length,newLength:body.length,body,title:original.draft.title,changes:changes.filter(x=>x[0]!==x[1]).length});
  }
  console.log("CORRECTION_PLAN",JSON.stringify(plan.map(({body,...row})=>row)));
  if(!apply)return;
  db.exec("BEGIN IMMEDIATE");
  try{
   for(const item of plan)update(db,{number:item.number,title:item.title,body:item.body});
   db.exec("COMMIT");
  }catch(e){db.exec("ROLLBACK");throw e;}
  console.log("CORRECTIONS_APPLIED",plan.length);
 }finally{db.close();}
}
main();
