export type Kind="character"|"object"|"location";
export const attributeCategories:{kind:Kind;label:string;fields:{key:string;label:string}[]}[]=[
 {kind:"character",label:"Karakterler",fields:[{key:"sideStatus",label:"Taraf durumu"},{key:"age",label:"Yaş"},{key:"species",label:"Tür"},{key:"dimension",label:"Boyut"},{key:"rank",label:"Mevki"}]},
 {kind:"object",label:"Nesneler",fields:[{key:"type",label:"Tür"},{key:"property",label:"Özellik"},{key:"custodian",label:"Sahibi / Koruyucusu"}]},
 {kind:"location",label:"Mekânlar",fields:[{key:"type",label:"Tür"},{key:"position",label:"Konum"},{key:"dimension",label:"Boyut"}]},
];
export const attributeSides=[
 ["","Belirsiz"],["notr","Nötr"],["aydinlik","Aydınlık"],["karanlik","Karanlık"],
 ["karanlik_once_aydinlik","Karanlık → Aydınlık"],
 ["aydinlik_once_karanlik","Aydınlık → Karanlık"],
];
export const attributeControlled:Record<Kind,string[]>={character:["species","dimension","rank"],object:["type"],location:["type","position","dimension"]};
