import { useEffect, useState } from "react";
export type SupportRecord = {id:string;videoId:string;kind:"sponsor"|"contributor";name:string;source:string};
export type SupportSource = {videoId:string;state:string;title:string;publishedAt:string;sourceValid?:boolean;url:string};
type Bridge = NonNullable<typeof window.channelFoundryStudio> & {
  aiAnalysisSupportSave(input:{videoId:string;kind:"sponsor"|"contributor";originalName?:string;name?:string;targetVideoId?:string;targetKind?:"sponsor"|"contributor";delete?:boolean}):Promise<{ok:true;records:SupportRecord[];sources:SupportSource[]}>;
};
type Props = {record:SupportRecord|null; sources:SupportSource[]; creating:boolean; onUpdated(records:SupportRecord[],sources:SupportSource[],preferred?:{videoId:string;kind:"sponsor"|"contributor";name:string}):void; onCancel():void; onStatus(message:string|null,tone?:"success"|"error"):void; onDirtyChange?(dirty:boolean):void;onBusyChange?(busy:boolean):void};
const empty = {name:"",kind:"sponsor" as const,videoId:""};
export default function RecordSupportDetail({record,sources,creating,onUpdated,onCancel,onStatus,onDirtyChange,onBusyChange}:Props){
 const bridge=window.channelFoundryStudio as Bridge|undefined;
 const [name,setName]=useState(record?.name??"");
 const [kind,setKind]=useState<"sponsor"|"contributor">(record?.kind??"sponsor");
 const [videoId,setVideoId]=useState(record?.videoId??sources.find(s=>s.sourceValid!==false)?.videoId??"");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{setName(record?.name??empty.name);setKind(record?.kind??empty.kind);setVideoId(record?.videoId??sources.find(s=>s.sourceValid!==false)?.videoId??"");},[record?.id,creating]);
 const dirty=creating?Boolean(name.trim()):name!==record?.name||kind!==record?.kind||videoId!==record?.videoId;
 const validSource=sources.some(source=>source.videoId===videoId&&source.sourceValid!==false);
 useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange]);
 useEffect(()=>onBusyChange?.(busy),[busy,onBusyChange]);
 const save=async()=>{
   if(!bridge||busy||!name.trim()||!validSource){onStatus("Geçerli bir kaynak video ve isim gerekli.","error");return;}
   setBusy(true);onStatus(null);
   try{
     const result=await bridge.aiAnalysisSupportSave(creating?{videoId,kind,name:name.trim()}:{videoId:record!.videoId,kind:record!.kind,originalName:record!.name,name:name.trim(),targetKind:kind,targetVideoId:videoId});
     onUpdated(result.records,result.sources,{videoId,kind,name:name.trim()});onStatus("Destek kaydı kaydedildi. Canlı site yayını ayrı bir işlemdir.","success");
   }catch(e){onStatus(`Destek kaydı kaydedilemedi: ${e instanceof Error?e.message:String(e)}`,"error");}finally{setBusy(false);}
 };
 const remove=async()=>{
   if(!bridge||!record||busy||!window.confirm(`“${record.name}” kaydı kaldırılsın mı?`))return;
   setBusy(true);onStatus(null);
   try{const result=await bridge.aiAnalysisSupportSave({videoId:record.videoId,kind:record.kind,originalName:record.name,delete:true});onUpdated(result.records,result.sources);onStatus("Destek kaydı kaldırıldı. Webe yansıması sonraki yayında gerçekleşir.","success");}catch(e){onStatus(`Kayıt kaldırılamadı: ${e instanceof Error?e.message:String(e)}`,"error");}finally{setBusy(false);}
 };
 return <div className="record-v3-form">
  <header className="record-v3-heading"><div><small>{creating?"YENİ DESTEK KAYDI":"SPONSOR / KATKI"}</small><h2>{creating?"Yeni kayıt":record?.name}</h2><span>{creating?"Editoryal giriş":record?.source==="analysis"?"AI kaynağı · Editoryal düzeltilebilir":"Editoryal kayıt"}</span></div><button className="primary-button" disabled={busy||!name.trim()||!validSource||!dirty} onClick={()=>void save()}>{busy?"Kaydediliyor…":"Kaydet"}</button></header>
  <section className="record-v3-section"><div className="record-v3-section-title">Destek kaydı</div><div className="record-v3-fields">
    <label><span>Görünecek isim</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="İsim"/></label>
    <label><span>Kaynak video</span><select value={videoId} onChange={e=>setVideoId(e.target.value)}>{sources.map(s=><option key={s.videoId} value={s.videoId} disabled={s.sourceValid===false}>{s.title}{s.state==="excluded"?" · Yayın dışı":""}</option>)}</select></label>
    <label><span>Tür</span><select value={kind} onChange={e=>setKind(e.target.value as "sponsor"|"contributor")}><option value="sponsor">Sponsor</option><option value="contributor">Katkıda bulunan</option></select></label>
    <div className="record-v3-secondary-actions">{creating?<button onClick={onCancel} disabled={busy}>Vazgeç</button>:<button className="danger-text" onClick={()=>void remove()} disabled={busy}>Kaydı kaldır</button>}</div>
  </div></section>
 </div>;
}
