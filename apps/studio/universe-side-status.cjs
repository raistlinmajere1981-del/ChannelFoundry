"use strict";
// UI vocabulary is deliberately narrow. Blank storage is displayed as
// "Belirsiz": absence of evidence is not a positive AI claim.
const OPTIONS = [
  {value:"",label:"Belirsiz"},
  {value:"notr",label:"Nötr"},
  {value:"aydinlik",label:"Aydınlık"},
  {value:"karanlik",label:"Karanlık"},
  {value:"karanlik_once_aydinlik",label:"Karanlık → Aydınlık"},
  {value:"aydinlik_once_karanlik",label:"Aydınlık → Karanlık"},
];
const VALID=new Set(OPTIONS.map(x=>x.value));
function parse(value) {
  const status=String(value??"").trim();
  if(!VALID.has(status))throw new Error("Geçersiz taraf durumu: "+status);
  if(status==="karanlik_once_aydinlik")return {side:"aydinlik",formerSide:"karanlik"};
  if(status==="aydinlik_once_karanlik")return {side:"karanlik",formerSide:"aydinlik"};
  return {side:status,formerSide:""};
}
module.exports={OPTIONS,VALID,parse};
