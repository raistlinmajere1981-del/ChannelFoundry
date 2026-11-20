import {useEffect,useMemo,useState} from "react";
import {attributeCategories,attributeControlled,attributeSides,type Kind} from "./universe-attribute-fields";
import "./record-attributes.css";

type Data=Awaited<ReturnType<NonNullable<typeof window.channelFoundryStudio>["universeAttributesList"]>>;
type SourceNote={reason:string;evidence:Data["proposals"][number]["evidence"]};
type Props={
  node:StudioUniverseWorkspaceNode;
  allNodes:StudioUniverseWorkspaceNode[];
  refreshVersion?:number;
  onDirtyChange(value:boolean):void;
  onBusyChange(value:boolean):void;
  onStatus?(message:string|null,tone?:"success"|"error"):void;
};
const format=(field:string,value:string)=>field==="dimension"&&value?value+". boyut":value;
const messageOf=(error:unknown)=>error instanceof Error?error.message:String(error);
const isKind=(kind:string):kind is Kind=>kind==="character"||kind==="object"||kind==="location";

/** A focused editor for the very same approved attribute rows as the bulk grid.
 * It never edits the node's source narrative, proposals or web publication. */
export default function RecordAttributes({node,allNodes,refreshVersion=0,onDirtyChange,onBusyChange,onStatus}:Props){
  const bridge=window.channelFoundryStudio;
  const [data,setData]=useState<Data|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [message,setMessage]=useState<{text:string;error:boolean}|null>(null);
  const [adding,setAdding]=useState<string|null>(null);
  const [newOption,setNewOption]=useState("");
  const [newEnglish,setNewEnglish]=useState("");
  const [sourceOpen,setSourceOpen]=useState<string|null>(null);
  const [version,setVersion]=useState(0);
  const config=attributeCategories.find(category=>category.kind===node.kind);
  const kind=isKind(node.kind)?node.kind:null;
  const editable=node.state==="approved";
  const baseline=useMemo(()=>data?.profiles.find(profile=>profile.entityKey===node.key)?.fields??{},[data,node.key]);
  const proposals=useMemo(()=>data?.proposals.filter(proposal=>proposal.entityKey===node.key)??[],[data,node.key]);
  const approvedSources=useMemo(()=>data?.provenance.filter(item=>item.entityKey===node.key)??[],[data,node.key]);
  const count=Object.keys(drafts).length;
  const pendingProposals=proposals.length;

  useEffect(()=>{
    let active=true;
    setLoading(true);setData(null);setMessage(null);setDrafts({});setSourceOpen(null);setAdding(null);
    if(!bridge?.universeAttributesList){setLoading(false);setMessage({text:"Studio özellik bağlantısı bulunamadı.",error:true});return;}
    void bridge.universeAttributesList().then(result=>{
      if(active){setData(result);setLoading(false);}
    }).catch(error=>{
      if(active){setMessage({text:messageOf(error),error:true});setLoading(false);}
    });
    return()=>{active=false;};
  },[bridge,node.key,refreshVersion,version]);
  useEffect(()=>onDirtyChange(count>0),[count,onDirtyChange]);
  useEffect(()=>onBusyChange(busy),[busy,onBusyChange]);
  useEffect(()=>()=>{onDirtyChange(false);onBusyChange(false);},[onDirtyChange,onBusyChange]);

  const notify=(text:string,error=false)=>{
    setMessage({text,error});
    onStatus?.(text,error?"error":"success");
  };
  const change=(field:string,value:string)=>{
    const original=baseline[field]??"";
    setDrafts(previous=>{
      const next={...previous};
      if(value===original)delete next[field];else next[field]=value;
      return next;
    });
    setMessage(null);
  };
  const refresh=()=>setVersion(value=>value+1);
  const save=async()=>{
    if(!bridge||!editable||busy||!count)return;
    setBusy(true);setMessage(null);
    try{
      // Another editor can alter this same profile while it remains open.
      // Check the current baseline before applying any local manual overrides.
      const latest=await bridge.universeAttributesList();
      const live=latest.profiles.find(profile=>profile.entityKey===node.key)?.fields??{};
      for(const field of Object.keys(drafts)){
        if((live[field]??"")!==(baseline[field]??"")){
          throw new Error("Bu özellik başka bir işlemde değişmiş. Yenileyip tekrar düzenle.");
        }
      }
      const edits=Object.entries(drafts).map(([field,value])=>({entityKey:node.key,field,value}));
      const result=await bridge.universeAttributesSave({edits});
      setDrafts({});
      setData(await bridge.universeAttributesList());
      notify(result.changed+" özellik kaydedildi. Canlı siteye yayın ayrıca yapılır.");
    }catch(error){notify("Özellikler kaydedilemedi: "+messageOf(error),true);}
    finally{setBusy(false);}
  };
  const review=async(field:string,action:"approve"|"reject")=>{
    if(!bridge||!editable||busy||count)return;
    setBusy(true);setMessage(null);
    try{
      const result=await bridge.universeAttributesReview({action,items:[{entityKey:node.key,field}]});
      setData(await bridge.universeAttributesList());
      notify(result.reviewed+(action==="approve"?" öneri onaylandı.":" öneri reddedildi."));
      setSourceOpen(null);
    }catch(error){notify("AI önerisi işlenemedi: "+messageOf(error),true);}
    finally{setBusy(false);}
  };
  const addOption=async()=>{
    if(!bridge||!editable||busy||!kind||!adding||!newOption.trim())return;
    setBusy(true);setMessage(null);
    try{
      const result=await bridge.universeAttributesOptionAdd({kind,field:adding,value:newOption.trim(),labelEn:newEnglish.trim()});
      setData(await bridge.universeAttributesList());
      change(adding,result.value);
      setAdding(null);setNewOption("");setNewEnglish("");
      notify("Seçenek ortak sözlüğe eklendi. Bu kayda uygulamak için özellikleri kaydet.");
    }catch(error){notify("Sözlük seçeneği eklenemedi: "+messageOf(error),true);}
    finally{setBusy(false);}
  };

  if(!config||!kind)return null;
  return <details className="record-v3-section record-v3-attribute-section" open>
    <summary>Özellikler <span>{config.fields.length} alan{pendingProposals?" · "+pendingProposals+" AI önerisi":""}</span></summary>
    <div className="record-v3-fields record-v3-attribute-body">
      {loading?<p className="record-v3-attribute-note" role="status">Özellikler yükleniyor…</p>
        :!data?<div role="alert" className="record-v3-attribute-alert error">{message?.text??"Özellikler alınamadı."}<button type="button" onClick={refresh}>Yenile</button></div>
        :<>
          {!editable&&<p className="record-v3-attribute-note">Özellikler yalnızca onaylı karakter, nesne ve mekân kayıtlarında değiştirilebilir.</p>}
          <div className="record-v3-attribute-grid">
            {config.fields.map(field=>{
              const original=baseline[field.key]??"";
              const value=drafts[field.key]??original;
              const proposal=proposals.find(item=>item.field===field.key);
              const evidence=approvedSources.find(item=>item.field===field.key);
              const options=(data.dictionary??[]).filter(option=>option.kind===kind&&option.field===field.key);
              const customAllowed=attributeControlled[kind].includes(field.key);
              const source:SourceNote|undefined=proposal??evidence;
              const stale=Boolean(proposal&&proposal.baseline!==original);
              return <div className={"record-v3-attribute-field"+(field.key in drafts?" is-edited":"")+(proposal?" has-proposal":"")} key={field.key}>
                <label><span>{field.label}</span>
                  {field.key==="sideStatus"?<select disabled={!editable||busy} aria-label={"Özellik: "+field.label} value={value} onChange={e=>change(field.key,e.target.value)}>
                    {attributeSides.map(([code,label])=><option key={code} value={code}>{label}</option>)}
                  </select>:customAllowed?<select disabled={!editable||busy} aria-label={"Özellik: "+field.label} value={value} onChange={e=>{
                    change(field.key,e.target.value);
                    if(kind==="location"&&field.key==="position"&&e.target.value==="Dünya"&&!(drafts.dimension??baseline.dimension)){
                      change("dimension","3");
                    }
                  }}>
                    <option value="">Belirtilmedi</option>
                    {value&&!options.some(option=>option.value===value)&&<option value={value}>{format(field.key,value)} (eski değer)</option>}
                    {options.map(option=><option key={option.value} value={option.value}>{format(field.key,option.value)}</option>)}
                  </select>:<input disabled={!editable||busy} aria-label={"Özellik: "+field.label} type="text" maxLength={field.key==="property"?90:140}
                    list={field.key==="custodian"?"record-attribute-custodians":undefined}
                    placeholder="Belirtilmedi" value={value} onChange={e=>change(field.key,e.target.value)}/>}
                </label>
                {customAllowed&&editable&&<button className="record-v3-attribute-add" type="button" disabled={busy}
                  onClick={()=>{setAdding(adding===field.key?null:field.key);setNewOption("");setNewEnglish("");}}>
                  {adding===field.key?"Yeni seçeneği kapat":"+ Sözlüğe seçenek ekle"}
                </button>}
                {proposal&&<div className="record-v3-attribute-proposal">
                  <div><strong>AI önerisi:</strong> {format(field.key,proposal.value)}{stale&&<small> · Eski kayda göre önerildi</small>}</div>
                  <div className="record-v3-attribute-actions">
                    <button type="button" disabled={!editable||busy||count>0||stale} onClick={()=>void review(field.key,"approve")}>Onayla</button>
                    <button type="button" disabled={!editable||busy||count>0} onClick={()=>void review(field.key,"reject")}>Reddet</button>
                  </div>
                </div>}
                {source&&(source.reason||source.evidence?.length>0)&&<div className="record-v3-attribute-source">
                  <button type="button" aria-expanded={sourceOpen===field.key} onClick={()=>setSourceOpen(sourceOpen===field.key?null:field.key)}>
                    {sourceOpen===field.key?"▴ Kaynak dayanağını kapat":proposal?"▾ AI önerisinin kaynağı":"▾ Onaylı kaynak"}
                  </button>
                  {sourceOpen===field.key&&<div>
                    {source.reason&&<p>{source.reason}</p>}
                    {(source.evidence??[]).map((item,index)=><div key={index} className="record-v3-attribute-quote">
                      <blockquote>{item.quote}</blockquote>
                      <small>{item.sourceType==="transcript"?"Video altyazısı":item.detailIndex>=0?"Not #"+(item.detailIndex+1):"Kaynak notu"}</small>
                      {item.sourceVideoId&&<a href={"https://www.youtube.com/watch?v="+encodeURIComponent(item.sourceVideoId)} target="_blank" rel="noreferrer">Kaynak video</a>}
                    </div>)}
                  </div>}
                </div>}
              </div>;
            })}
          </div>
          {adding&&<div className="record-v3-attribute-dictionary">
            <strong>{config.fields.find(field=>field.key===adding)?.label} · Yeni sözlük seçeneği</strong>
            <div>
              <label><span>Türkçe değer</span><input maxLength={65} value={newOption} disabled={busy} onChange={e=>setNewOption(e.target.value)}/></label>
              <label><span>İngilizce karşılığı (isteğe bağlı)</span><input maxLength={100} value={newEnglish} disabled={busy} onChange={e=>setNewEnglish(e.target.value)}/></label>
              <button type="button" disabled={busy||!newOption.trim()} onClick={()=>void addOption()}>Sözlüğe ekle</button>
            </div>
          </div>}
          {kind==="object"&&<datalist id="record-attribute-custodians">
            {allNodes.filter(item=>item.kind==="character"&&item.state==="approved").map(item=><option key={item.key} value={item.name}/>)}
          </datalist>}
          <div className="record-v3-attribute-bottom">
            <span>{count?count+" kaydedilmemiş değişiklik":pendingProposals?pendingProposals+" bekleyen öneri":"Değişiklik yok"} · Yayın ayrıca yapılır</span>
            <div>
              <button type="button" disabled={busy||!editable||count===0} onClick={()=>setDrafts({})}>Vazgeç</button>
              <button type="button" onClick={refresh} disabled={busy||count>0}>Yenile</button>
              <button type="button" className="primary-button" disabled={!editable||busy||count===0} onClick={()=>void save()}>
                {busy?"İşleniyor…":"Özellikleri kaydet"+(count?" ("+count+")":"")}
              </button>
            </div>
          </div>
          {message&&<p className={"record-v3-attribute-alert"+(message.error?" error":"")} role="status">{message.text}</p>}
        </>}
    </div>
  </details>;
}
