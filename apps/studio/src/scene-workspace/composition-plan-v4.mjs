// Authoring-only composition guide. This does not change scene geometry,
// effect target/hit areas, the published photo, or the site's visual assets.
export const COMPOSITION_FRAME=Object.freeze({width:1774,height:887,aspect:2});
const zone=(id,label,x,y,width,height,help)=>Object.freeze({id,label,x,y,width,height,help});
export const COMPOSITION_GUIDE=Object.freeze({
  fixed:Object.freeze([
    zone('shelves','Kitaplık · fener',.015,.02,.29,.59,'Sabit kitaplık, zayıf soldan sıcak ışık; nesne katmanı yok'),
    zone('hook','Askılık · duvar',.405,.04,.19,.56,'Ortada sabit metal askılık; kaftan ayrı kumaş katmanı'),
    zone('window','Pencere · ay ışığı',.795,.005,.2,.605,'Soğuk, yönlü pencere ışığı; hareketli nesneyle birlikte taşınmaz'),
    zone('table','Tek masa yüzeyi',.01,.625,.98,.35,'Bütün masa üstü nesneleri aynı perspektif ve temas gölgesine oturmalı'),
    zone('language','Dil anahtarı yuvası',.035,.842,.12,.11,'Yalnız dekoratif metal yuva; gerçek TR/EN kontrolü bağımsız'),
  ]),
  focus:Object.freeze([
    zone('community','Topluluk kitabı',.253,.73,.182,.25,'Masa üzerinde, kapalıyken kendi deri/kağıt gölgesi'),
    zone('universe','Evren kitabı',.445,.718,.26,.266,'Daha koyu kapak; tılsım için ayrılacak merkezi desen'),
    zone('camera','Kamera',.795,.73,.18,.24,'LCD afişi okunan, kamera masaya oturan düzlem'),
    zone('drawing','Çizim cihazı',.62,.39,.16,.40,'Ayağı olmayan, masaüstüne oturan alçak mekanizma'),
  ]),
  details:Object.freeze([
    zone('robe','Kaftan',.415,.16,.18,.47,'Korunan renk ve kuşak, gölge/ışık sahneye göre uyarlanır'),
    zone('stone','Taş ve damlalık',.254,.555,.12,.20,'Kaynak ağzı taşın üzerindeki darbe hedefi ile doğrultulu'),
    zone('pendulum','Metal sarkaç',.34,.435,.12,.265,'Korunan pirinç tasarım, bağlantı ve hareketi ayrı'),
    zone('chest','Sandık',.807,.39,.18,.23,'Gövde sabit; arka menteşe ayrı; kapak açılırken üst boşluk'),
    zone('dagger','Tören hançeri',.70,.805,.11,.16,'Korunan şekil ve desen; masa temas gölgesi'),
    zone('incense','Tütsü',.835,.62,.13,.1,'Korunan form; pasif soğuk, tıklamayla kısa süreli hareket'),
    zone('candle','Mum ve su kabı',.08,.585,.15,.265,'Görseli yeniden tasarlanabilir; görünür efekt yeri gerek'),
  ]),
});
export const COMPOSITION_MODES=Object.freeze(['off','fixed','focus','details']);
export function validateCompositionGuide(guide=COMPOSITION_GUIDE){
  const all=new Set();
  for(const mode of COMPOSITION_MODES.slice(1))
    for(const z of guide[mode]??[]){
      if(all.has(z.id))throw Error('Tekrarlanan kompozisyon bölgesi: '+z.id);
      all.add(z.id);
      if(![z.x,z.y,z.width,z.height].every(Number.isFinite)||
         z.x<0||z.y<0||z.width<=0||z.height<=0||
         z.x+z.width>1||z.y+z.height>1)
        throw Error('2:1 çalışma kadrajını aşan yerleşim bölgesi: '+z.id);
    }
  return guide;
}
validateCompositionGuide();
