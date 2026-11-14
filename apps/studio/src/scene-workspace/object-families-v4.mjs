// Source-aware, read-only migration inventory. These plans are not scene
// objects or render instructions. Real movement/hit/effect data stays canonical.
const part=(id,label,state,asset=null,detail='')=>Object.freeze({id,label,state,asset,detail});
const family=(id,group,stage,parts,plannedAnchors=[])=>Object.freeze({
  id,group,stage,parts:Object.freeze(parts),plannedAnchors:Object.freeze(plannedAnchors),
});
export const OBJECT_FAMILIES_V4=Object.freeze([
 family('research-journal','Kitap','independent',[
  part('cover','Kapalı deri kapak','ready',null,'Tek fotoğraf korunur; kapak tonu Studio coverBrightness kontrolüyle düzenlenir'),
  part('talisman','Tılsım desen yolu','ready',null,'Kaynak kapaktaki pusula çevresinde iz süren seal-trace; hover/focus, ayarlanabilir')
 ],['research-journal.talisman-path']),
 family('community-journal','Kitap','independent',[
  part('cover','Topluluk kitabı','ready',null,'Kapalı kitap ve sayfa bileşeni ayrı')
 ]),
 family('camera','Cihaz','independent',[
  part('body','Kamera gövdesi','ready','/scene-assets/camera/research/camera-body.webp'),
  part('lcd','Kapak LCD / son afiş','ready',null,'Yalnız onaylı ve çözümlemeli kaydın son afişi; kırpılmayan ön katman ve Studio önizlemesi')
 ]),
 family('candle','Masa objesi','independent',[
  part('wax','Mum gövdesi','ready','/scene-assets/physical/melted-candle.webp','Orijinal mum ve tabak formu korunarak eski fotoğraftan ayrıldı'),
  part('tray','Mum altlığı','ready',null,'Aynı kesilmiş görsel içinde fiziksel temas yüzeyi'),
  part('fire','Alev / duman / ışık','ready',null,'Mevcut 3 efekt korunur')
 ],['candle.body-contact']),
 family('vefk-stand','Cihaz','independent',[
  part('chassis','Çizim cihazı kasası','ready','/scene-assets/vefk/chassis-tabletop.webp','Ayaksız, geniş tabanlı masaüstü kasa; özgün kontrol ve parşömen koordinatları korunur'),
  part('paper','Parşömen / çizim alanı','ready',null,'Çizim koordinatları değişmeyecek'),
  part('quill','Divit ve mekanizma','ready',null,'Özgün kalibrasyon korunur; yeni kasa yalnız fiziksel altlığı değiştirir')
 ],['vefk.table-contact']),
 family('water-basin','Masa objesi','independent',[
  part('copper','Bakır kap gövdesi','ready','/scene-assets/p8/copper-basin.webp','Yeni oda masterında bağımsız gövde'),
  part('water','Su yüzeyi','redesign',null,'Halka efekti su yüzeyine bağlı kalacak')
 ],['water-basin.table-contact']),
 family('stone-specimen','Taş sistemi','independent',[
  part('rock','Yeşil taş','ready','/scene-assets/stone/jade-rock.webp','Biçim/renk kilitli'),
  part('stand','Taş altlığı','ready','/scene-assets/stone/ornate-copper-plinth.webp','İşlemeli ayrı bakır altlık; yeşil taş bağımsız hareket eder'),
  part('dropper','Bakır damlalık mekanizması','ready','/scene-assets/stone/copper-drip-arm.webp','Fiziksel kaynak ve su çıkış ağzı; damla animasyonu ayrı')
 ],['stone-specimen.impact','stone-specimen.dropper-outlet']),
 family('ceremonial-robe','Duvar objesi','independent',[
  part('fabric','Kaftan ve kuşak','ready','/scene-assets/robe/ceremonial-kaftan.webp','Renk ve kuşak kimliği korunacak'),
  part('hook','Sabit askılık','ready',null,'Yeni master arka planına işli, kaftan yokken değişmez')
 ],['ceremonial-robe.shoulder-hook']),
 family('guardian-sword-left','Duvar objesi','independent',[
  part('blade','Sol kılıç','ready','/scene-assets/p8/guardian-sword.webp','Yeni oda masterında bağımsız katman'),
  part('wall','Kılıç duvar bağlantısı','redesign',null,'Yeni master üzerinden ayrı altlık')
 ],['guardian-sword-left.wall-mount']),
 family('guardian-sword-right','Duvar objesi','independent',[
  part('blade','Sağ kılıç','ready','/scene-assets/p8/guardian-sword.webp','Yeni oda masterında bağımsız katman'),
  part('wall','Kılıç duvar bağlantısı','redesign',null,'Yeni master üzerinden ayrı altlık')
 ],['guardian-sword-right.wall-mount']),
 family('archive-chest','Duvar objesi','independent',[
  part('body','Sandık gövdesi','ready','/scene-assets/chest/archive-body.webp'),
  part('lid','Menteşeli kapak','ready','/scene-assets/chest/archive-lid.webp'),
  part('interior','Sandık iç boşluğu ve ışık maskesi','ready','/scene-assets/chest/interior-light-mask.webp','Gövdeyle aynı %150 malzeme genişliği; kapak açılınca sınırlı süre kehribar ışığı')
 ],['archive-chest.inner-light']),
 family('incense-holder','Masa objesi','independent',[
  part('body','Tütsülük gövdesi','ready','/scene-assets/physical/carved-incense-holder.webp','Özgün oyma tekne ve çubuk eski görüntüden ayrıldı'),
  part('ember','Köz / duman','ready',null,'Mevcut 2 efekt korunur')
 ],['incense-holder.table-contact']),
 family('ceremonial-dagger','Masa objesi','independent',[
  part('blade','Hançer gövdesi','ready','/scene-assets/p8/ceremonial-dagger.webp','Biçim ve desen kimliği korunacak')
 ],['ceremonial-dagger.table-contact']),
 family('metal-pendulum','Masa objesi','independent',[
  part('fixed','Sabit sarkaç gövdesi','ready','/scene-assets/metal-pendulum/fixed.webp'),
  part('pendant','Hareketli metal parça','ready','/scene-assets/metal-pendulum/pendant.webp')
 ],['metal-pendulum.table-contact']),
]);
export const OBJECT_FAMILY_STAGES=Object.freeze({
  independent:'Bağımsız web katmanı',
  partial:'Kısmen bağımsız',
  'needs-art':'Kaynak görsel bekliyor',
});
export const OBJECT_PART_STATES=Object.freeze({
  ready:'Bağlı', 'needs-mount':'Bağlanacak', 'needs-art':'Görsel üretilecek',
  planned:'Planlandı', redesign:'Yenilenecek',
});
const familyIndex=new Map(OBJECT_FAMILIES_V4.map(f=>[f.id,f]));
export const familyForObject=id=>familyIndex.get(id)??null;
export function objectFamilyReport(scene,visualSources=[]){
  const sourceIds=new Set(scene?.objects?.map(o=>o.id)??[]);
  const visualById=new Map(visualSources.map(v=>[v.id,v]));
  if(visualById.size!==visualSources.length)throw Error('Yinelenen V4 görsel kaynak kimliği.');
  const entries=OBJECT_FAMILIES_V4.map(family=>{
    const source=scene?.objects?.find(o=>o.id===family.id);
    if(!source)throw Error('V4 envanterinde kaynak nesne eksik: '+family.id);
    const anchors=new Set(source.anchors.map(a=>a.id));
    const effects=(scene.effects??[]).filter(fx=>fx.target.objectId===family.id);
    const visual=visualById.get(family.id);
    const assets=new Set([visual?.asset,...(visual?.layers??[]).map(l=>l.asset),...(visual?.auxiliaryAssets??[])].filter(Boolean));
    if(visual)for(const p of family.parts){
      if(p.asset&&(p.state==='ready'||p.state==='needs-mount')&&!assets.has(p.asset))
        throw Error('V4 envanterinde yanlış kaynak: '+family.id+'/'+p.id+'/'+p.asset);
    }
    return {...family,activeAnchors:[...anchors],effects:effects.map(fx=>fx.id),
      sourceVerified:Boolean(visual),enabledEffectCount:effects.filter(fx=>fx.enabled).length,
      missingAnchors:family.plannedAnchors.filter(anchor=>!anchors.has(anchor))};
  });
  const counts=Object.fromEntries(Object.keys(OBJECT_FAMILY_STAGES).map(k=>[k,entries.filter(e=>e.stage===k).length]));
  return {entries,counts,extras:[...sourceIds].filter(id=>!familyIndex.has(id)),
    verifiedSources:entries.filter(e=>e.sourceVerified).length};
}
