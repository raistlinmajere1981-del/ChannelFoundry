import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import "./universe-attributes-grid.css";

type Kind="character"|"object"|"location";
type Node=StudioUniverseWorkspaceNode;
type Profile={entityKey:string;fields:Record<string,string>};
type Proposal={entityKey:string;field:string;value:string;baseline:string;reason:string;sourceVideoIds:string[];evidence?:Array<{detailIndex:number;quote:string;sourceVideoId:string}>};
type Analysis={entityKey:string;evaluatedAt:string;proposalCount:number};
type Provenance={entityKey:string;field:string;reason:string;evidence:Array<{detailIndex:number;quote:string;sourceVideoId:string}>};
type Option={kind:string;field:string;value:string;labelEn:string};
type Result={profiles:Profile[];proposals:Proposal[];analyses:Analysis[];provenance:Provenance[];dictionary:Option[]};
type Props={nodes:Node[];onClose():void;onDirtyChange(value:boolean):void;onBusyChange(value:boolean):void};
const categories:{kind:Kind;label:string;fields:{key:string;label:string}[]}[]=[
 {kind:"character",label:"Muhataplar",fields:[{key:"sideStatus",label:"Taraf durumu"},{key:"age",label:"Yaş"},{key:"species",label:"Tür"},{key:"dimension",label:"Boyut"},{key:"rank",label:"Mevki"}]},
 {kind:"object",label:"Nesneler",fields:[{key:"type",label:"Tür"},{key:"property",label:"Özellik"},{key:"custodian",label:"Sahibi / Koruyucusu"}]},
 {kind:"location",label:"Mekânlar",fields:[{key:"type",label:"Tür"},{key:"position",label:"Konum"},{key:"dimension",label:"Boyut"}]},
];
const sides=[
 ["","Belirsiz"],["notr","Nötr"],["aydinlik","Aydınlık"],["karanlik","Karanlık"],
 ["karanlik_once_aydinlik","Karanlık → Aydınlık"],
 ["aydinlik_once_karanlik","Aydınlık → Karanlık"],
];
const controlled:Record<Kind,string[]>={character:["species","dimension","rank"],object:["type"],location:["type","position","dimension"]};
const proposalId=(key:string,field:string)=>key+"::"+field;
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);

export default function UniverseAttributesGrid({nodes,onClose,onDirtyChange,onBusyChange}:Props){
 const bridge=window.channelFoundryStudio;
 const [kind,setKind]=useState<Kind>("character");
 const [data,setData]=useState<Result>({profiles:[],proposals:[],analyses:[],provenance:[],dictionary:[]});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [query,setQuery]=useState("");
 const [filter,setFilter]=useState<"all"|"incomplete"|"proposals"|"edited">("all");
 const [limit,setLimit]=useState(80);
 const [checked,setChecked]=useState<Set<string>>(new Set());
 const [proposalChecked,setProposalChecked]=useState<Set<string>>(new Set());
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [message,setMessage]=useState("");
 const [inspecting,setInspecting]=useState<string|null>(null);
 const [progress,setProgress]=useState("");
 const [parallel,setParallel]=useState(3);
 const [skipProcessed,setSkipProcessed]=useState(true);
 const [managerOpen,setManagerOpen]=useState(false);
 const [managerField,setManagerField]=useState("species");
 const [optionName,setOptionName]=useState("");
 const [optionEnglish,setOptionEnglish]=useState("");
 const [mergeFrom,setMergeFrom]=useState("");
 const [mergeInto,setMergeInto]=useState("");
 const [suggesting,setSuggesting]=useState(false);
 const stopRef=useRef(false);
 const reloadVersion=useRef(0);
 const knownProposalsRef=useRef(new Set<string>());
 const receiveData=useCallback((result:Result)=>{
   setData(result);
   const ids=new Set(result.proposals.map(p=>proposalId(p.entityKey,p.field)));
   setProposalChecked(previous=>{
     const next=new Set([...previous].filter(id=>ids.has(id)));
     for(const id of ids)if(!knownProposalsRef.current.has(id))next.add(id);
     knownProposalsRef.current=ids;
     return next;
   });
 },[]);
 const pending=Object.keys(drafts).length>0;
 useEffect(()=>onDirtyChange(pending),[pending,onDirtyChange]);
 useEffect(()=>onBusyChange(busy),[busy,onBusyChange]);
 useEffect(()=>()=>{onDirtyChange(false);onBusyChange(false);},[onDirtyChange,onBusyChange]);
 const reload=useCallback(async()=>{
   if(!bridge)throw new Error("Studio bağlantısı bulunamadı.");
   const version=++reloadVersion.current;
   const result=await bridge.universeAttributesList();
   if(version===reloadVersion.current)receiveData(result);
 },[bridge,receiveData]);
 useEffect(()=>{let alive=true;if(!bridge){setMessage("Studio bağlantısı bulunamadı.");setLoading(false);return;}
   void bridge.universeAttributesList().then(result=>{if(alive){receiveData(result);setLoading(false);}}).catch(e=>{if(alive){setMessage(errorText(e));setLoading(false);}});
   return()=>{alive=false;};
 },[bridge,receiveData]);
 const config=categories.find(c=>c.kind===kind)!;
 const optionFields=config.fields.filter(f=>controlled[kind].includes(f.key));
 const vocabulary=(data.dictionary||[]).filter(o=>o.kind===kind&&o.field===managerField);
 const getOptions=(field:string)=>data.dictionary?.filter(o=>o.kind===kind&&o.field===field)||[];
 const optionText=(field:string,value:string)=>field==="dimension"?value+". boyut":value;
 const changeKind=(value:Kind)=>{setKind(value);setManagerField(controlled[value][0]);setMergeFrom("");setMergeInto("");};
 const current=useMemo(()=>new Map(data.profiles.map(p=>[p.entityKey,p.fields])),[data.profiles]);
 const suggestions=useMemo(()=>new Map(data.proposals.map(p=>[proposalId(p.entityKey,p.field),p])),[data.proposals]);
 const approvedEvidence=useMemo(()=>new Map((data.provenance||[]).map(p=>[proposalId(p.entityKey,p.field),p])),[data.provenance]);
 const inspected=inspecting ? suggestions.get(inspecting)||approvedEvidence.get(inspecting) : null;
 const rows=useMemo(()=>nodes.filter(n=>n.kind===kind&&n.state==="approved").sort((a,b)=>a.name.localeCompare(b.name,"tr")),[nodes,kind]);
 const rowKeys=useMemo(()=>new Set(rows.map(n=>n.key)),[rows]);
 const visible=useMemo(()=>rows.filter(n=>{
   const hay=(n.name+" "+n.aliases.join(" ")).toLocaleLowerCase("tr-TR");
   if(query&&!hay.includes(query.toLocaleLowerCase("tr-TR")))return false;
   const fields=current.get(n.key)||{};
   const incomplete=config.fields.some(f=>!fields[f.key]);
   if(filter==="incomplete"&&!incomplete)return false;
   if(filter==="proposals"&&!config.fields.some(f=>suggestions.has(proposalId(n.key,f.key))))return false;
   if(filter==="edited"&&!config.fields.some(f=>proposalId(n.key,f.key) in drafts))return false;
   return true;
 }),[rows,query,filter,current,config,suggestions,drafts]);
 const selectedCount=visible.filter(n=>checked.has(n.key)).length;
 const processedKeys=useMemo(()=>new Set([
   ...data.analyses.map(a=>a.entityKey),
   // Existing proposals predate the progress ledger: preserve them on the first resume.
   ...data.proposals.map(p=>p.entityKey),
 ]),[data.analyses,data.proposals]);
 const processedCount=rows.filter(n=>processedKeys.has(n.key)).length;
 const pendingForKind=data.proposals.filter(p=>rowKeys.has(p.entityKey));
 const pickedProposals=data.proposals.filter(p=>proposalChecked.has(proposalId(p.entityKey,p.field)) && rowKeys.has(p.entityKey));
 const setDraft=(key:string,field:string,value:string)=>{
   const id=proposalId(key,field);
   const original=current.get(key)?.[field]||"";
   setDrafts(old=>{const next={...old};if(value===original)delete next[id];else next[id]=value;return next;});
 };
 const exit=()=>{
   if(busy){setMessage("Devam eden işlem tamamlanmadan kapatılamaz.");return;}
   if(pending&&!window.confirm("Kaydedilmemiş özellik değişiklikleri bırakılacak. Kapatılsın mı?"))return;
   onClose();
 };
 const operate=async(action:"save"|"approve"|"reject")=>{
   if(!bridge||busy)return;
   const edits=Object.entries(drafts).map(([id,value])=>{const pivot=id.lastIndexOf("::");return {entityKey:id.slice(0,pivot),field:id.slice(pivot+2),value};});
   if(action==="save"&&!edits.length)return;
   if(action!=="save"&&!pickedProposals.length)return;
   setBusy(true);setMessage("");
   try{
     if(action==="save"){
       const result=await bridge.universeAttributesSave({edits});
       setDrafts({});
       setMessage(result.changed+" alan kaydedildi. Canlı siteye yansıması için yayın gerekir.");
     }else{
       if(pending)throw new Error("Önce manuel değişikliklerini kaydet.");
       const result=await bridge.universeAttributesReview({action,items:pickedProposals.map(p=>({entityKey:p.entityKey,field:p.field}))});
       setInspecting(null);
       setMessage(result.reviewed+(action==="approve"?" öneri onaylandı.":" öneri reddedildi."));
     }
     await reload();
   }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
 };
 const suggest=async()=>{
   if(!bridge||busy)return;
   if(pending){setMessage("Önce manuel değişikliklerini kaydet.");return;}
   const selected=rows.filter(n=>checked.has(n.key)).map(n=>n.key);
   if(!selected.length){setMessage("Önce AI için kayıtları seç.");return;}
   const keys=skipProcessed?selected.filter(key=>!processedKeys.has(key)):selected;
   const skipped=selected.length-keys.length;
   if(!keys.length){setMessage("Seçili kayıtlar daha önce incelenmiş. Tekrar incelemek için 'İncelenenleri atla' seçimini kaldır.");return;}
   const batches=Array.from({length:Math.ceil(keys.length/8)},(_,i)=>keys.slice(i*8,(i+1)*8));
   const workers=Math.min(parallel,batches.length);
   if(keys.length>40&&!window.confirm(`${keys.length} kayıt · ${batches.length} paket · ${workers} paralel oturum${skipped?` · ${skipped} incelenen atlandı`:""}. Devam edilsin mi?`))return;
   setBusy(true);setSuggesting(true);setMessage("");stopRef.current=false;
   let next=0,done=0,proposed=0,active=0,failed=0,partial=0;
   let error="";
   const update=()=>setProgress(`${done}/${keys.length} kayıt incelendi · ${proposed} öneri · ${active}/${workers} aktif oturum`);
   const worker=async()=>{
     while(!stopRef.current){
       const index=next++;
       if(index>=batches.length)return;
       const batch=batches[index];
       active++;update();
       try{
         const result=await bridge.universeAttributesSuggest({keys:batch});
         done+=result.evaluated;proposed+=result.proposed;
         partial+=batch.length-result.evaluated;
         try{await reload();}catch(e){setMessage("Öneriler kaydedildi; liste yenileme başarısız: "+errorText(e));}
       }catch(e){
         failed+=batch.length;error=`${index+1}. paket: ${errorText(e)}`;
         stopRef.current=true; // No new work on failure; let other active sessions finish safely.
       }finally{active--;update();}
     }
   };
   try{
     await Promise.all(Array.from({length:workers},()=>worker()));
     try{await reload();}catch(e){setMessage("Öneriler kaydedildi; liste yenileme başarısız: "+errorText(e));}
     const prefix=`${done}/${keys.length} kayıt incelendi, ${proposed} öneri`;
     if(error)setMessage(prefix+` · İşlem durduruldu (${error}). Kalan kayıtlar tekrar seçilebilir.`);
     else if(stopRef.current)setMessage(prefix+" · İstek üzerine durduruldu. Tamamlanan paketler korundu.");
     else if(partial)setMessage(prefix+` · ${partial} kayıt AI yanıtında eksik kaldı; sonraki çalışmada yeniden incelenebilir.`);
     else setMessage(prefix+" · Toplu inceleme tamamlandı. Öneriler henüz onaylanmadı.");
   }finally{
     setProgress("");setSuggesting(false);setBusy(false);
   }
 };
 const addOption=async()=>{
   if(!bridge||busy||!optionName.trim())return;
   setBusy(true);setMessage("");
   try{const result=await bridge.universeAttributesOptionAdd({kind,field:managerField,value:optionName,labelEn:optionEnglish});
     setMessage(result.created?"Sözlük seçeneği eklendi: "+result.value:"Sözlük seçeneği zaten mevcut: "+result.value);
     setOptionName("");setOptionEnglish("");await reload();
   }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
 };
 const mergeOptions=async()=>{
   if(!bridge||busy||!mergeFrom||!mergeInto||mergeFrom===mergeInto)return;
   if(!window.confirm(`"${mergeFrom}" seçeneği "${mergeInto}" içine birleştirilsin mi? İlişkili onaylı değerler ve öneriler güncellenecek.`))return;
   setBusy(true);setMessage("");
   try{const result=await bridge.universeAttributesOptionMerge({kind,field:managerField,source:mergeFrom,target:mergeInto});
     setMergeFrom("");setMergeInto("");await reload();
     setMessage(result.changed+" onaylı kayıt güncellendi. Yayına yansıması için yayın gerekir.");
   }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
 };
 const resetAttributes=async()=>{
   if(!bridge||busy||pending)return;
   const confirmation=window.prompt("Yalnız özellik değerleri, AI önerileri, kaynak kanıtları ve incelendi kayıtları silinecek. Varlıklar ve kaynak anlatılar kalacak. Devam için ÖZELLİKLERİ SIFIRLA yaz:");
   if(confirmation!=="ÖZELLİKLERİ SIFIRLA")return;
   setBusy(true);setMessage("");
   try{const counts=await bridge.universeAttributesReset({confirmation});setChecked(new Set());setProposalChecked(new Set());
     knownProposalsRef.current=new Set();await reload();
     setMessage(`Özellikler sıfırlandı: ${counts.universe_entity_attributes||0} profil, ${counts.universe_entity_attribute_proposals||0} öneri, ${counts.universe_entity_attribute_analysis||0} analiz kaydı. Varlıklar korundu.`);
   }catch(e){setMessage(errorText(e));}finally{setBusy(false);}
 };
 const selectKind=(value:Kind)=>{changeKind(value);setQuery("");setFilter("all");setLimit(80);setChecked(new Set());setInspecting(null);};
 return createPortal(<div className="attribute-overlay" role="dialog" aria-modal="true" aria-label="Evren özellikleri">
  <div className="attribute-workspace">
   <header className="attribute-heading"><div><small>EVREN · KAYIT YÖNETİMİ</small><h2>Özellikler</h2><p>Kaynak anlatılar ve görseller değişmez. Yalnızca onaylı özellikler webde görünür.</p></div><button type="button" onClick={exit} disabled={busy} aria-label="Özellikler penceresini kapat">✕</button></header>
   <nav className="attribute-tabs" aria-label="Kategoriler">{categories.map(c=><button key={c.kind} disabled={busy} className={kind===c.kind?"active":""} onClick={()=>selectKind(c.kind)}>{c.label} <span>{nodes.filter(n=>n.kind===c.kind&&n.state==="approved").length}</span></button>)}</nav>
   <div className="attribute-tools">
     <input type="search" aria-label="Özelliklerde ara" disabled={busy} value={query} onChange={e=>{setQuery(e.target.value);setLimit(80);}} placeholder="Kayıt adına göre ara…"/>
     <select aria-label="Özellik filtresi" disabled={busy} value={filter} onChange={e=>{setFilter(e.target.value as typeof filter);setLimit(80);}}><option value="all">Tüm kayıtlar</option><option value="incomplete">Eksik alanlar</option><option value="proposals">AI değişiklikleri</option><option value="edited">Manuel değişiklikler</option></select>
     <label className="attribute-select"><input type="checkbox" disabled={busy} checked={visible.length>0&&selectedCount===visible.length} onChange={e=>setChecked(old=>{const next=new Set(old);visible.forEach(n=>e.target.checked?next.add(n.key):next.delete(n.key));return next;})}/> Görünenleri seç ({selectedCount}/{visible.length})</label>
     <label className="attribute-parallel-select">Paralel oturum
       <select aria-label="Paralel AI oturumu sayısı" value={parallel} disabled={busy}
         onChange={e=>setParallel(Number(e.target.value))}>
         {[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
       </select>
     </label>
     <label className="attribute-select" title="Önceden önerisi hazırlanmış veya tamamlanmış kayıtlar yeniden işlenmez.">
       <input type="checkbox" disabled={busy} checked={skipProcessed} onChange={e=>setSkipProcessed(e.target.checked)}/>
       İncelenenleri atla ({processedCount})
     </label>
     <button disabled={busy||!visible.length} title="Bu kategorideki ilk 10 henüz incelenmemiş kaydı seçer" onClick={()=>{
       setChecked(new Set(visible.filter(n=>!processedKeys.has(n.key)).slice(0,10).map(n=>n.key)));
     }}>İlk 10'u seç</button>
     <button disabled={busy||!selectedCount||pending} onClick={()=>void suggest()}>✧ Seçililere AI önerisi</button>
     <button disabled={busy} aria-expanded={managerOpen} onClick={()=>setManagerOpen(value=>!value)}>{managerOpen?"▴ Sözlüğü kapat":"▾ Sözlüğü yönet"}</button>
     {suggesting&&<button onClick={()=>{
       stopRef.current=true;
       setMessage("Yeni paket başlatılmayacak; çalışan oturumların bitmesi beklenecek.");
     }}>Durdur</button>}
   </div>
   {managerOpen&&<section className="attribute-dictionary" aria-label="Özellik sözlüğü yönetimi">
     <div className="attribute-dictionary-heading"><strong>Ortak özellik sözlüğü</strong><small>Değerler bu kategorideki bütün kayıtlara uygulanır. Mezna için boyut otomatik atanmaz; kaynağa göre seçilir.</small></div>
     <label>Alan <select aria-label="Sözlük alanı" disabled={busy} value={managerField} onChange={e=>{setManagerField(e.target.value);setMergeFrom("");setMergeInto("");}}>
       {optionFields.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
     </select></label>
     <label>Yeni seçenek <input disabled={busy} aria-label="Yeni sözlük seçeneği" value={optionName} maxLength={65} placeholder={managerField==="dimension"?"1–99": "Yeni değer…"} onChange={e=>setOptionName(e.target.value)}/></label>
     <label>İngilizce (opsiyonel) <input disabled={busy} aria-label="Seçenek İngilizce adı" value={optionEnglish} maxLength={100} placeholder="English label" onChange={e=>setOptionEnglish(e.target.value)}/></label>
     <button disabled={busy||!optionName.trim()} onClick={()=>void addOption()}>+ Ekle</button>
     <div className="attribute-dictionary-merge"><span>Birleştir</span>
       <select aria-label="Birleştirilecek seçenek" value={mergeFrom} disabled={busy} onChange={e=>setMergeFrom(e.target.value)}><option value="">Kaynak seç…</option>{vocabulary.map(o=><option key={o.value} value={o.value}>{optionText(managerField,o.value)}</option>)}</select>
       <span>→</span>
       <select aria-label="Birleşecek hedef" value={mergeInto} disabled={busy} onChange={e=>setMergeInto(e.target.value)}><option value="">Hedef seç…</option>{vocabulary.filter(o=>o.value!==mergeFrom).map(o=><option key={o.value} value={o.value}>{optionText(managerField,o.value)}</option>)}</select>
       <button disabled={busy||!mergeFrom||!mergeInto||mergeFrom===mergeInto} onClick={()=>void mergeOptions()}>Birleştir</button>
     </div>
     <button className="attribute-reset" disabled={busy||pending} onClick={()=>void resetAttributes()}>Özellik kayıtlarını sıfırla…</button>
   </section>}
   <datalist id="attribute-custodian-names">{nodes.filter(n=>n.state==="approved"&&n.kind==="character").map(n=><option key={n.key} value={n.name}/>)}</datalist>
   <div className="attribute-table-scroll">
    <table className="attribute-table"><thead><tr><th>Seç</th><th>Kayıt</th>{config.fields.map(f=><th key={f.key}>{f.label}</th>)}</tr></thead>
     <tbody>{visible.slice(0,limit).map(node=><tr key={node.key}>
       <td><input type="checkbox" disabled={busy} aria-label={node.name+" seç"} checked={checked.has(node.key)} onChange={e=>setChecked(old=>{const next=new Set(old);e.target.checked?next.add(node.key):next.delete(node.key);return next;})}/></td>
       <th scope="row"><span>{node.name}</span><small>{node.sourceVideoIds.length} kaynak</small></th>
       {config.fields.map(field=>{
         const id=proposalId(node.key,field.key);
         const proposal=suggestions.get(id);
         const value=drafts[id]??current.get(node.key)?.[field.key]??"";
         return <td key={field.key} className={id in drafts?"attribute-edited":proposal?"attribute-proposed":""}>
           <div className="attribute-cell">
             {field.key==="sideStatus"?<select disabled={busy} aria-label={node.name+" "+field.label} value={value} onChange={e=>setDraft(node.key,field.key,e.target.value)}>{sides.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
              :controlled[kind].includes(field.key)?<select disabled={busy} aria-label={node.name+" "+field.label} value={value} onChange={e=>{
                 setDraft(node.key,field.key,e.target.value);
                 if(kind==="location"&&field.key==="position"&&e.target.value==="Dünya"&&!current.get(node.key)?.dimension&&!drafts[proposalId(node.key,"dimension")])setDraft(node.key,"dimension","3");
               }}>
                 <option value="">Belirtilmedi</option>
                 {value&&!getOptions(field.key).some(o=>o.value===value)&&<option value={value}>{optionText(field.key,value)} (eski değer)</option>}
                 {getOptions(field.key).map(o=><option key={o.value} value={o.value}>{optionText(field.key,o.value)}</option>)}
               </select>
              :<input disabled={busy} aria-label={node.name+" "+field.label} list={field.key==="custodian"?"attribute-custodian-names":undefined} value={value} onChange={e=>setDraft(node.key,field.key,e.target.value)} maxLength={field.key==="property"?90:140} placeholder="—"/>}
             {proposal&&<div className="attribute-proposal">
               <label title="Bu AI önerisini toplu incelemeye dahil et"><input type="checkbox" checked={proposalChecked.has(id)} onChange={e=>setProposalChecked(old=>{const next=new Set(old);e.target.checked?next.add(id):next.delete(id);return next;})}/><span>AI: {field.key==="sideStatus"?sides.find(([v])=>v===proposal.value)?.[1]||proposal.value:field.key==="dimension"?optionText(field.key,proposal.value):proposal.value}{controlled[kind].includes(field.key)&&!getOptions(field.key).some(o=>o.value===proposal.value)?" · yeni seçenek":""}</span></label>
               <button type="button" aria-label={node.name+" "+field.label+" öneri kaynağı"} onClick={()=>setInspecting(inspecting===id?null:id)}>ⓘ</button>
             </div>}
             {!proposal&&approvedEvidence.has(id)&&<button className="attribute-approved-source" type="button"
               aria-label={node.name+" "+field.label+" onaylı kaynak"} onClick={()=>setInspecting(inspecting===id?null:id)}>ⓘ Onaylı kaynak</button>}
           </div>
         </td>;
       })}
     </tr>)}</tbody>
    </table>
    {loading&&<p className="attribute-empty">Özellikler yükleniyor…</p>}
    {!loading&&!visible.length&&<p className="attribute-empty">Bu filtrede kayıt bulunmuyor.</p>}
    {visible.length>limit&&<button className="attribute-more" onClick={()=>setLimit(n=>n+80)}>Daha fazla göster ({visible.length-limit} kayıt)</button>}
   </div>
   {inspected&&<section className="attribute-source" aria-label="Özelliğin kaynak dayanağı">
     <button aria-label="Kaynak detayını kapat" onClick={()=>setInspecting(null)}>✕</button>
     <strong>{inspecting&&suggestions.has(inspecting)?"AI önerisi":"Onaylı özellik"} · Kaynak dayanağı</strong>
     <p>{inspected.reason||"Kaynakla ilişkili özellik"}</p>
     {inspected.evidence?.map((ev,index)=><blockquote key={index} className="attribute-evidence-quote">
       “{ev.quote}” <small>Not #{ev.detailIndex+1}</small>
     </blockquote>)}
     <div>{[...new Set(inspected.evidence?.map(ev=>ev.sourceVideoId)||[])].map(id=><a key={id} href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Video {id} ↗</a>)}</div>
   </section>}
   <footer className="attribute-footer">
     <div className="attribute-footer-status"><span>{progress||message||`${rows.length} kayıt · ${pendingForKind.length} bekleyen AI önerisi · ${Object.keys(drafts).length} manuel değişiklik`}</span><small>Kaydetme yereldir; yayın ayrı yapılır.</small></div>
     <div className="attribute-actions">
       <label><input type="checkbox" checked={pendingForKind.length>0&&pendingForKind.every(p=>proposalChecked.has(proposalId(p.entityKey,p.field)))} onChange={e=>setProposalChecked(old=>{const next=new Set(old);pendingForKind.forEach(p=>e.target.checked?next.add(proposalId(p.entityKey,p.field)):next.delete(proposalId(p.entityKey,p.field)));return next;})}/> Tüm öneriler</label>
       <button disabled={busy||!pickedProposals.length||pending} onClick={()=>void operate("reject")}>Reddet ({pickedProposals.length})</button>
       <button disabled={busy||!pickedProposals.length||pending} onClick={()=>void operate("approve")}>Önerileri onayla ({pickedProposals.length})</button>
       <button className="primary" disabled={busy||!pending} onClick={()=>void operate("save")}>Manuel değişiklikleri kaydet ({Object.keys(drafts).length})</button>
     </div>
   </footer>
  </div>
 </div>, document.body);
}
