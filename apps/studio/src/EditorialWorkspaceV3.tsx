import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LegacyRecordDetail, WorkspaceRecordDetail } from "./EditorialRecordDetail";
import RecordSupportDetail, { type SupportRecord, type SupportSource } from "./RecordSupportDetail";
import VisualProfileEditor from "./VisualProfileEditor";
import {useVideoSourceCatalog,videoSourceTitle} from "./video-source-labels";

const PublicationTranslationCenter=lazy(()=>import("./PublicationTranslationCenter"));
type LegacyItem = StudioPersistedItem & { relatedCount: number };
type WorkspaceRelation = {key:string;runId:number;fromKey:string;toKey:string;label:string;sourceVideoIds:string[];state:"draft"|"approved";updatedAt:string};
type Bridge = NonNullable<typeof window.channelFoundryStudio> & {
  universeWorkspaceRelations(input?:{state?:"draft"|"approved"}):Promise<WorkspaceRelation[]>;
  aiAnalysisSupportRecords():Promise<SupportRecord[]>;
  aiAnalysisSupportSources():Promise<SupportSource[]>;
};
type Props = { nodes:StudioUniverseWorkspaceNode[];legacyItems:LegacyItem[];legacyRelations:StudioPersistedRelation[];onReload():Promise<void>;onCreate():void};
type Selection = {source:"workspace"|"legacy"|"support";key:string};
type ItemRow = {source:Selection["source"];key:string;kind:string;title:string;subtitle:string;status:string;sourceCount:number;relatedCount:number;searchText:string};
const kindLabels:Record<string,string>={story:"Hikâye",character:"Muhatap",event:"Olay",location:"Mekân",object:"Nesne",video:"Kayıt",file:"Dosya",support:"Destek"};
const filterOptions=[{value:"all",label:"Tüm kayıtlar"},{value:"story",label:"Hikâyeler"},{value:"character",label:"Muhataplar"},{value:"event",label:"Olaylar"},{value:"location",label:"Mekânlar"},{value:"object",label:"Nesneler"},{value:"support",label:"Sponsor & Katkı"},{value:"legacy",label:"Manuel kayıtlar"}];
const focusStorageKey="channel-foundry:editor-focus";
const isYoutube=(item:LegacyItem)=>item.kind==="video"&&(item.id.startsWith("youtube-")||item.key.startsWith("video:youtube-"));
const titleKey=(sel:Selection)=>sel.source+":"+sel.key;
const text=(error:unknown)=>error instanceof Error?error.message:String(error);

export default function EditorialWorkspaceV3({nodes,legacyItems,legacyRelations,onReload,onCreate}:Props){
 const bridge=window.channelFoundryStudio as Bridge|undefined;
 const videoCatalog=useVideoSourceCatalog();
 const [relations,setRelations]=useState<WorkspaceRelation[]>([]);
 const [supports,setSupports]=useState<SupportRecord[]>([]);
 const [sources,setSources]=useState<SupportSource[]>([]);
 const [supportLoading,setSupportLoading]=useState(true);
 const [query,setQuery]=useState("");
 const [initialMode]=useState(()=>{const mode=sessionStorage.getItem("channel-foundry:editor-mode");sessionStorage.removeItem("channel-foundry:editor-mode");return mode;});
 const [kind,setKind]=useState(initialMode==="characters"?"character":"all");
 const [state,setState]=useState("all");
 const [sort,setSort]=useState("name");
 const [selected,setSelected]=useState<Selection|null>(()=>{
   const initial=(initialMode==="characters"?nodes.find(node=>node.kind==="character"):null)??nodes.find(node=>node.state==="approved")??nodes[0];
   const manual=initialMode==="characters"?legacyItems.find(item=>item.kind==="character"):legacyItems[0];
   return initial?{source:"workspace",key:initial.key}:manual?{source:"legacy",key:manual.key}:null;
 });
 const [creatingSupport,setCreatingSupport]=useState(false);
 const [formDirty,setFormDirty]=useState(false),[visualDirty,setVisualDirty]=useState(false);
 const [formBusy,setFormBusy]=useState(false),[visualBusy,setVisualBusy]=useState(false);
 const [status,setStatus]=useState<{message:string;tone:"success"|"error"}|null>(null);
 const [rightOpen,setRightOpen]=useState(true);
 const [connectionsMode,setConnectionsMode]=useState(false);
 const [translationMode,setTranslationMode]=useState(()=>Boolean(sessionStorage.getItem('studio-language-filter')));
 const [translationDirty,setTranslationDirty]=useState(false),[translationBusy,setTranslationBusy]=useState(false);
 const [translationVisualKey,setTranslationVisualKey]=useState<string|null>(null);
 const onTranslationDirty=useCallback((value:boolean)=>setTranslationDirty(value),[]);
 const onTranslationBusy=useCallback((value:boolean)=>setTranslationBusy(value),[]);
 const [multi,setMulti]=useState(false);
 const [checked,setChecked]=useState<Set<string>>(()=>new Set());
 const [bulkBusy,setBulkBusy]=useState(false);
 const [pageSize,setPageSize]=useState(100);
 const [menu,setMenu]=useState<{row:ItemRow;x:number;y:number}|null>(null);
 const [openVisualRequest,setOpenVisualRequest]=useState(false);
 const searchRef=useRef<HTMLInputElement>(null);
 const surfaceRef=useRef<HTMLDivElement>(null);
 const onDirtyChange=useCallback((value:boolean)=>setFormDirty(value),[]);
 const onBusyChange=useCallback((value:boolean)=>setFormBusy(value),[]);
 const onVisualDirty=useCallback((value:boolean)=>setVisualDirty(value),[]);
 const onVisualBusy=useCallback((value:boolean)=>setVisualBusy(value),[]);
 const onStatus=useCallback((message:string|null,tone:"success"|"error"="success")=>setStatus(message?{message,tone}:null),[]);
 const dirty=formDirty||visualDirty||translationDirty;
 const busy=formBusy||visualBusy||bulkBusy||translationBusy;
 const recordsDirtyKey="channel-foundry:records-unsaved";
 const recordsBusyKey="channel-foundry:records-busy";
 useEffect(()=>{
   sessionStorage.setItem(recordsDirtyKey,dirty?"1":"0");
   sessionStorage.setItem(recordsBusyKey,busy?"1":"0");
 },[dirty,busy]);
 useEffect(()=>{
   const onUnload=(event:BeforeUnloadEvent)=>{if(!dirty&&!busy)return;event.preventDefault();event.returnValue="";};
   window.addEventListener('beforeunload',onUnload);
   return()=>window.removeEventListener('beforeunload',onUnload);
 },[dirty,busy]);
 useEffect(()=>()=>{sessionStorage.removeItem(recordsDirtyKey);sessionStorage.removeItem(recordsBusyKey);},[]);
 const checkLeave=useCallback(()=>{
   if(busy){onStatus("Devam eden işlem bitmeden kayıt değiştirilemez.","error");return false;}
   if(dirty&&!window.confirm("Kaydedilmemiş değişiklikler var. Kaydı değiştirmek ve değişiklikleri bırakmak istiyor musun?"))return false;
   return true;
 },[busy,dirty,onStatus]);
 const selectRecord=useCallback((source:Selection["source"],key:string)=>{
   if(selected?.source===source&&selected.key===key&&!creatingSupport){setConnectionsMode(false);return true;}
   if(!checkLeave())return false;
   setSelected({source,key});setCreatingSupport(false);setConnectionsMode(false);setFormDirty(false);setVisualDirty(false);setStatus(null);return true;
 },[selected,creatingSupport,checkLeave]);
 const refreshSupport=useCallback(async()=>{
   if(!bridge)return;
   const [records,sourceRecords]=await Promise.all([bridge.aiAnalysisSupportRecords(),bridge.aiAnalysisSupportSources()]);
   setSupports(records);setSources(sourceRecords);setSupportLoading(false);
 },[bridge]);
 useEffect(()=>{
   let active=true;
   if(!bridge){setSupportLoading(false);return;}
   void Promise.all([bridge.universeWorkspaceRelations({state:"approved"}),bridge.aiAnalysisSupportRecords(),bridge.aiAnalysisSupportSources()]).then(([related,records,sourceRecords])=>{
     if(!active)return;setRelations(related);setSupports(records);setSources(sourceRecords);setSupportLoading(false);
   }).catch(error=>{if(active){setSupportLoading(false);onStatus("Arşiv bağlantıları yüklenemedi: "+text(error),"error");}});
   const dispose=bridge.onDataChanged?.(()=>{
     void refreshSupport().catch(()=>undefined);
     void bridge.universeWorkspaceRelations({state:"approved"}).then(setRelations).catch(()=>undefined);
   });
   return ()=>{active=false;dispose?.();};
 },[bridge,refreshSupport,onStatus,nodes.length]);
 useEffect(()=>{
   const focus=sessionStorage.getItem(focusStorageKey);
   if(!focus)return;
   const node=nodes.find(entry=>entry.key===focus);
   const item=legacyItems.find(entry=>entry.key===focus);
   if(node||item){setSelected({source:node?"workspace":"legacy",key:focus});setQuery("");setKind("all");sessionStorage.removeItem(focusStorageKey);}
 },[nodes,legacyItems]);
 useEffect(()=>{
   function jump(event:Event){
     const mode=(event as CustomEvent).detail;
     if(mode!=="editor"&&mode!=="characters")return;
     if(!checkLeave())return;
     setKind(mode==="characters"?"character":"all");setConnectionsMode(false);
     if(mode==="characters"){
       const first=nodes.find(n=>n.kind==="character")??null;
       const manual=legacyItems.find(n=>n.kind==="character")??null;
       if(first)setSelected({source:"workspace",key:first.key});else if(manual)setSelected({source:"legacy",key:manual.key});
     }
   }
   window.addEventListener("channel-foundry:editor-mode",jump);
   return ()=>window.removeEventListener("channel-foundry:editor-mode",jump);
 },[checkLeave,nodes,legacyItems]);
 useEffect(()=>{if(selected&&((selected.source==="workspace"&&nodes.some(n=>n.key===selected.key))||(selected.source==="legacy"&&legacyItems.some(n=>n.key===selected.key))||(selected.source==="support"&&(supports.some(s=>s.id===selected.key)||creatingSupport))))return;
   if(selected?.source==="support"&&supportLoading)return;
   if(dirty||busy)return;
   const item=nodes[0];setSelected(item?{source:"workspace",key:item.key}:legacyItems[0]?{source:"legacy",key:legacyItems[0].key}:supports[0]?{source:"support",key:supports[0].id}:null);
 },[nodes,legacyItems,supports,selected,creatingSupport,supportLoading,dirty,busy]);

 useEffect(()=>{
   const close=(event:PointerEvent)=>{if(menu&&!surfaceRef.current?.querySelector('.records-v3-context-menu')?.contains(event.target as Node))setMenu(null);};
   const hotkey=(event:KeyboardEvent)=>{
     if(event.key==='Escape'){setMenu(null);return;}
     if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
       event.preventDefault();searchRef.current?.focus();searchRef.current?.select();
     }
   };
   window.addEventListener('pointerdown',close);window.addEventListener('keydown',hotkey);
   return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',hotkey);};
 },[menu]);
 useEffect(()=>{
   if(!openVisualRequest||!rightOpen)return;
   const config=surfaceRef.current?.querySelector<HTMLDetailsElement>('.record-visual-config');
   if(config){config.open=true;config.scrollIntoView({block:'nearest',behavior:'instant'});setOpenVisualRequest(false);}
 },[openVisualRequest,selected,rightOpen]);
 const workspaceByKey=useMemo(()=>new Map(nodes.map(n=>[n.key,n])),[nodes]);
 const legacyByKey=useMemo(()=>new Map(legacyItems.map(n=>[n.key,n])),[legacyItems]);
 const supportById=useMemo(()=>new Map(supports.map(n=>[n.id,n])),[supports]);
 const sourceById=useMemo(()=>new Map(sources.map(n=>[n.videoId,n])),[sources]);
 const workspaceRelated=useMemo(()=>{
   const map=new Map<string,{key:string;label:string;sourceVideoIds:string[]}[]>();
   for(const relation of relations){for(const [from,to] of [[relation.fromKey,relation.toKey],[relation.toKey,relation.fromKey]]){
     const list=map.get(from)??[];list.push({key:to,label:relation.label,sourceVideoIds:relation.sourceVideoIds});map.set(from,list);
   }}return map;
 },[relations]);
 const legacyRelated=useMemo(()=>{
   const map=new Map<string,{key:string;label:string}[]>();
   for(const relation of legacyRelations){for(const [from,to] of [[relation.fromKey,relation.toKey],[relation.toKey,relation.fromKey]]){
     const list=map.get(from)??[];list.push({key:to,label:relation.label});map.set(from,list);
   }}return map;
 },[legacyRelations]);
 const allRows=useMemo<ItemRow[]>(()=>[
   ...nodes.map(n=>({source:"workspace" as const,key:n.key,kind:n.kind,title:n.name,subtitle:kindLabels[n.kind]+" · "+n.sourceVideoIds.length+" video",status:n.state,sourceCount:n.sourceVideoIds.length,relatedCount:workspaceRelated.get(n.key)?.length??0,searchText:`${n.name} ${n.summary} ${n.aliases.join(" ")} ${n.sourceVideoIds.join(" ")}`})),
   ...legacyItems.map(n=>({source:"legacy" as const,key:n.key,kind:n.kind,title:n.title,subtitle:(isYoutube(n)?"YouTube kaynağı":"Manuel "+kindLabels[n.kind])+(n.meta?" · "+n.meta:""),status:n.status,sourceCount:isYoutube(n)?1:0,relatedCount:n.relatedCount,searchText:`${n.title} ${n.meta} ${n.summary}`})),
   ...supports.map(n=>({source:"support" as const,key:n.id,kind:"support",title:n.name,subtitle:(n.kind==="sponsor"?"Sponsor":"Katkıda bulunan")+" · "+(sourceById.get(n.videoId)?.title??n.videoId),status:!sourceById.get(n.videoId)||sourceById.get(n.videoId)?.sourceValid===false?"missing":sourceById.get(n.videoId)?.state==="excluded"?"excluded":"approved",sourceCount:1,relatedCount:0,searchText:`${n.name} ${sourceById.get(n.videoId)?.title??n.videoId}`}))
 ],[nodes,legacyItems,supports,workspaceRelated,sourceById]);
 const term=query.trim().toLocaleLowerCase("tr-TR");
 const filtered=useMemo(()=>allRows.filter(row=>{
   const kindMatch=kind==="all"||(kind==="legacy"?row.source==="legacy":kind==="support"?row.source==="support":row.kind===kind);
   const statusMatch=state==="all"||(state==="approved"?(row.status==="approved"||row.status==="published"):state==="draft"?(row.status==="draft"):row.status===state);
   return kindMatch&&statusMatch&&(!term||row.searchText.toLocaleLowerCase("tr-TR").includes(term));
 }).sort((a,b)=>sort==="relations"?b.relatedCount-a.relatedCount||a.title.localeCompare(b.title,"tr-TR")
   :sort==="sources"?b.sourceCount-a.sourceCount||a.title.localeCompare(b.title,"tr-TR")
   :a.title.localeCompare(b.title,"tr-TR")),[allRows,kind,state,term,sort]);
 useEffect(()=>setPageSize(100),[kind,state,term]);
 const activeWorkspace=selected?.source==="workspace"?workspaceByKey.get(selected.key)??null:null;
 const activeLegacy=selected?.source==="legacy"?legacyByKey.get(selected.key)??null:null;
 const activeSupport=selected?.source==="support"?supportById.get(selected.key)??null:null;
 const activeRelations=activeWorkspace?workspaceRelated.get(activeWorkspace.key)??[]:activeLegacy?legacyRelated.get(activeLegacy.key)??[]:[];
 const sourceIds=activeWorkspace?.sourceVideoIds??(activeSupport?[activeSupport.videoId]:activeLegacy&&isYoutube(activeLegacy)?[activeLegacy.id.startsWith("youtube-")?activeLegacy.id.slice(8):activeLegacy.key.slice("video:youtube-".length)]:[]);
 const activeImage=activeWorkspace?{key:activeWorkspace.key,kind:activeWorkspace.kind,title:activeWorkspace.name,seedVisual:(activeWorkspace.payload as Record<string,unknown>|undefined)?.visual as StudioVisualDefinition|undefined}:activeLegacy?{key:activeLegacy.key,kind:activeLegacy.kind,title:activeLegacy.title,seedVisual:undefined}:null;
 const checkedItems=legacyItems.filter(item=>checked.has(item.key));
 const relatedCount=legacyRelations.filter(r=>checked.has(r.fromKey)||checked.has(r.toKey)).length;
 const toggleChecked=(key:string)=>setChecked(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next;});
 const applyBulk=async(action:"publish"|"draft"|"delete")=>{
   if(!checked.size||busy||!bridge||!checkLeave())return;
   const label=action==="publish"?"Yayına al":action==="draft"?"Taslağa çek":"Sil";
   if(!window.confirm(`${checked.size} manuel kayıt: ${label}. ${action==="delete"?relatedCount+" ilişkili bağlantı etkilenebilir. ":""}İşlem uygulansın mı?`))return;
   setBulkBusy(true);onStatus(null);
   try{const result=await bridge.bulkApply({action,keys:[...checked]});await onReload();setChecked(new Set());setMulti(false);onStatus(`${result.affected} kayıt güncellendi.${result.affectedRelations?` ${result.affectedRelations} ilişki etkilendi.`:""} Web yayını ayrı bir adımdır.`,"success");}catch(e){onStatus("Toplu işlem başarısız: "+text(e),"error");}finally{setBulkBusy(false);}
 };
 const handleSupportUpdate=(records:SupportRecord[],sourceRecords:SupportSource[],preferred?:{videoId:string;kind:"sponsor"|"contributor";name:string})=>{
   setSupports(records);setSources(sourceRecords);setCreatingSupport(false);setFormDirty(false);
   const next=preferred?records.find(r=>r.videoId===preferred.videoId&&r.kind===preferred.kind&&r.name===preferred.name):null;
   const item=next??records.find(r=>r.id===selected?.key)??records[0];
   setSelected(item?{source:"support",key:item.id}:null);
 };
 const newSupport=()=>{if(!checkLeave())return;setTranslationMode(false);setCreatingSupport(true);setSelected({source:"support",key:"new"});setKind("support");setConnectionsMode(false);setFormDirty(false);setVisualDirty(false);};
 const enterTranslation=()=>{
   if(!checkLeave())return;
   setTranslationVisualKey(activeWorkspace?.key??null);
   setTranslationMode(true);
 };
 const closeTranslation=()=>{
   if(!checkLeave())return;
   setTranslationMode(false);setTranslationVisualKey(null);
   setTranslationDirty(false);setTranslationBusy(false);
 };
 const onTranslationPick=useCallback((row:PublicationLanguagePack)=>{
   if(row.kind!=='entity'){setTranslationVisualKey(null);return;}
   const name=String(row.source.name||'');
   const matched=nodes.find(node=>node.name===name);
   setTranslationVisualKey(matched?.key??null);
 },[nodes]);
 const translationVisual=translationMode?(translationVisualKey?nodes.find(n=>n.key===translationVisualKey):null):activeWorkspace;
 const focusRelation=(key:string)=>{
   if(workspaceByKey.has(key))selectRecord("workspace",key);
   else if(legacyByKey.has(key))selectRecord("legacy",key);
 };
 return <div className="editorial-workspace records-v3" ref={surfaceRef} data-testid="records-workspace-v3">
   {translationMode?<header className="records-v3-toolbar records-v3-translation-top"><button onClick={closeTranslation}>‹ Kayıt arşivine dön</button><strong>Türkçe / İngilizce yayın metinleri</strong><span>AI çeviri · inceleme · onay</span><button className={rightOpen?'is-active':''} onClick={()=>setRightOpen(value=>!value)}>◧ Görsel paneli</button></header> : <header className="records-v3-toolbar">
     <div className="records-v3-search"><span aria-hidden="true">⌕</span><input ref={searchRef} aria-label="Kayıt dosyalarında ara" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tüm kayıtlarda ara…"/></div>
     <select aria-label="Kayıt türü" value={kind} onChange={e=>setKind(e.target.value)}>{filterOptions.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</select>
     <select aria-label="Durum filtresi" value={state} onChange={e=>setState(e.target.value)}><option value="all">Tüm durumlar</option><option value="approved">Onaylı / yayında</option><option value="draft">Taslak</option><option value="excluded">Yayın dışı</option><option value="missing">Kaynak eksik</option></select>
     <select aria-label="Kayıt sıralaması" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Ada göre</option><option value="relations">İlişkiye göre</option><option value="sources">Kaynağa göre</option></select>
     <button className={multi?"is-active":""} onClick={()=>{setMulti(!multi);setChecked(new Set());}} aria-pressed={multi}>☑ Çoklu seçim</button>
     <button onClick={()=>{if(checkLeave())onCreate();}}>＋ Yeni kayıt</button>
     <button onClick={newSupport}>＋ Destek</button>
     <button onClick={enterTranslation}>🌐 TR / EN</button>
     <button className={rightOpen?"is-active":""} onClick={()=>{if(rightOpen&&!checkLeave())return;setRightOpen(value=>!value);}} aria-pressed={rightOpen}>◧ Bağlam</button>
   </header>}
   <div className={`records-v3-grid${rightOpen?"":" without-rail"}${translationMode?" records-v3-translation-grid":""}`}>
    {translationMode ? <>
      <Suspense fallback={<div className="record-v3-empty">Yayın metinleri yükleniyor…</div>}>
        <PublicationTranslationCenter focusName={activeWorkspace?.name??activeLegacy?.title??''} onDirtyChange={onTranslationDirty} onBusyChange={onTranslationBusy} onRecordPick={onTranslationPick}/>
      </Suspense>
      {rightOpen&&<aside className="records-v3-context records-v3-translation-visual"><div className="records-v3-context-scroll">
        {translationVisual?<VisualProfileEditor key={translationVisual.key} item={{key:translationVisual.key,kind:translationVisual.kind,title:translationVisual.name}} seedVisual={(translationVisual.payload as Record<string,unknown>|undefined)?.visual as StudioVisualDefinition|undefined} productionActions dock onDirtyChange={onVisualDirty} onBusyChange={onVisualBusy} onStatus={onStatus}/>
          :<section className="records-v3-rail-block"><strong>GÖRSEL</strong><p>Görseller, bağlı evren kayıtları seçildiğinde burada düzenlenebilir. Yayın metninin görüntüsü başka bir kayda ait olabilir.</p></section>}
        <section className="records-v3-rail-block"><strong>DİL DURUMU</strong><p>Çeviri önerileri yalnız onaylı Türkçe yayın metinlerinden hazırlanır. Taslaklar ve onaylı metinler otomatik olarak canlıya gönderilmez.</p></section>
      </div></aside>}
    </> : <>
     <aside className="records-v3-index" aria-label="Birleşik kayıt listesi">
       <header><strong>KAYITLAR</strong><span>{filtered.length} / {allRows.length}</span></header>
       <div className="records-v3-list" role="listbox" aria-label="Kayıtlar">
         {filtered.slice(0,pageSize).map(row=><div onContextMenu={event=>{event.preventDefault();setMenu({row,x:Math.min(event.clientX,window.innerWidth-245),y:Math.min(event.clientY,window.innerHeight-210)});}} className={`records-v3-item${selected?.source===row.source&&selected.key===row.key?" selected":""}`} key={titleKey(row)}>
           {multi&&row.source==="legacy"&&<input type="checkbox" aria-label={`${row.title} seç`} checked={checked.has(row.key)} onChange={()=>toggleChecked(row.key)}/>}
           <button role="option" aria-selected={selected?.source===row.source&&selected.key===row.key} onClick={()=>selectRecord(row.source,row.key)}>
             <span className="records-v3-kind">{row.source==="support"?"DK":row.source==="legacy"?"MN":kindLabels[row.kind]?.slice(0,2).toLocaleUpperCase("tr-TR")??"KY"}</span>
             <span className="records-v3-copy"><strong>{row.title}</strong><small>{row.subtitle}</small></span>
             {(row.status==="draft"||row.status==="missing")&&<i aria-label={row.status==="missing"?"Kaynak eksik":"Taslak"}>{row.status==="missing"?"!":"◌"}</i>}
           </button>
         </div>)}
         {filtered.length>pageSize&&<button className="records-v3-more" onClick={()=>setPageSize(n=>n+100)}>Daha fazla göster ({filtered.length-pageSize})</button>}
         {!filtered.length&&<div className="record-v3-empty">Bu filtrede kayıt yok.</div>}
       </div>
       {multi&&<div className="records-v3-bulk"><strong>{checked.size} manuel kayıt seçili</strong><small>{relatedCount} ilişkili bağlantı</small><div><button disabled={!checked.size||busy} onClick={()=>void applyBulk("publish")}>Yayına al</button><button disabled={!checked.size||busy} onClick={()=>void applyBulk("draft")}>Taslağa al</button><button className="danger-text" disabled={!checked.size||busy} onClick={()=>void applyBulk("delete")}>Sil</button></div><small>AI ve destek kayıtları toplu silme kapsamında değildir.</small></div>}
     </aside>
     <main className="records-v3-main">
       {selected&&<div className="records-v3-record-bar"><span>{connectionsMode?"Bağlantı keşfi":"Kayıt düzenleme"}</span><div><button className={connectionsMode?"is-active":""} disabled={!activeWorkspace&&!activeLegacy} onClick={()=>{if(connectionsMode||checkLeave())setConnectionsMode(!connectionsMode);}}>⌁ Bağlantılar ({activeRelations.length})</button>{connectionsMode&&<button onClick={()=>setConnectionsMode(false)}>Düzenlemeye dön</button>}</div></div>}
       <div className="records-v3-main-scroll">
         {creatingSupport?<RecordSupportDetail key="support:new" record={null} sources={sources} creating onUpdated={handleSupportUpdate} onCancel={()=>{setCreatingSupport(false);setFormDirty(false);setSelected(supports[0]?{source:"support",key:supports[0].id}:null);}} onStatus={onStatus} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}/>
          :connectionsMode&&(activeWorkspace||activeLegacy)?<div className="record-v3-form"><header className="record-v3-heading"><div><small>BAĞLANTI KEŞFİ</small><h2>{activeWorkspace?.name??activeLegacy?.title}</h2><span>{activeRelations.length} ilişkili kayıt</span></div></header><div className="record-v3-connections">{activeRelations.map((r,index)=>{const other=workspaceByKey.get(r.key),legacy=legacyByKey.get(r.key);return <button key={r.key+":"+index} onClick={()=>focusRelation(r.key)}><strong>{other?.name??legacy?.title??r.key}</strong><span>{r.label}{(r as {sourceVideoIds?:string[]}).sourceVideoIds?.length ? ` · ${(r as {sourceVideoIds?:string[]}).sourceVideoIds?.length} kaynak` : ""}</span><span>Kaydı aç ›</span></button>})}{!activeRelations.length&&<p>Bu kayıt için bağlı dosya yok.</p>}</div></div>
          :activeWorkspace?<WorkspaceRecordDetail key={activeWorkspace.key} node={activeWorkspace} relations={relations} allNodes={nodes} onReload={onReload} onStatus={onStatus} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}/>
          :activeLegacy?<LegacyRecordDetail key={activeLegacy.key} item={activeLegacy} relations={legacyRelations} allItems={legacyItems} onReload={onReload} onStatus={onStatus} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}/>
          :activeSupport?<RecordSupportDetail key={activeSupport.id} record={activeSupport} sources={sources} creating={false} onUpdated={handleSupportUpdate} onCancel={()=>undefined} onStatus={onStatus} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange}/>
          :<div className="record-v3-empty">Soldaki listeden bir kayıt seç.</div>}
       </div>
     </main>
     {rightOpen&&<aside className="records-v3-context" aria-label="Görsel ve kayıt bağlamı">
       <div className="records-v3-context-scroll">
         {activeImage&&<VisualProfileEditor key={activeImage.key} item={{key:activeImage.key,kind:activeImage.kind,title:activeImage.title}} seedVisual={activeImage.seedVisual} productionActions dock onStatus={onStatus} onDirtyChange={onVisualDirty} onBusyChange={onVisualBusy}/>}
         {activeSupport&&<section className="records-v3-rail-block"><strong>KAYNAK VİDEO</strong><p>{sourceById.get(activeSupport.videoId)?.title??activeSupport.videoId}</p><small>{!sourceById.get(activeSupport.videoId)||sourceById.get(activeSupport.videoId)?.sourceValid===false?"Kaynak video bulunamadı · Yeni kaynak seçilmeli":sourceById.get(activeSupport.videoId)?.state==="excluded"?"Yayın dışı":"Editoryal destek kaydı"}</small></section>}
         {(activeWorkspace||activeLegacy)&&<>
           <section className="records-v3-rail-block"><div className="records-v3-rail-title"><strong>İLİŞKİLER</strong><span>{activeRelations.length}</span></div>
             {activeRelations.slice(0,16).map((r,index)=>{const related=workspaceByKey.get(r.key)??legacyByKey.get(r.key);return <button key={r.key+":"+index} className="records-v3-link" onClick={()=>focusRelation(r.key)}><span>{"name" in (related??{})?(related as StudioUniverseWorkspaceNode).name:(related as LegacyItem|undefined)?.title??r.key}</span><small>{r.label}</small></button>})}
             {activeRelations.length>16&&<button className="records-v3-all" onClick={()=>setConnectionsMode(true)}>Tüm {activeRelations.length} bağlantıyı göster</button>}
             {!activeRelations.length&&<p className="record-v3-empty">Henüz bağlantı yok.</p>}
           </section>
           <section className="records-v3-rail-block"><div className="records-v3-rail-title"><strong>KAYNAKLAR</strong><span>{sourceIds.length}</span></div>
             {sourceIds.map((id,index)=><a key={id+index} href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`} target="_blank" rel="noopener noreferrer">{videoSourceTitle(id,videoCatalog)} ↗</a>)}
             {!sourceIds.length&&<p className="record-v3-empty">Kaynak video yok.</p>}
           </section>
         </>}
       </div>
     </aside>}
   </>}
   </div>
   {menu&&<div className="records-v3-context-menu" role="menu" style={{left:Math.max(4,menu.x),top:Math.max(4,menu.y)}}>
     <div className="records-v3-menu-title">{menu.row.title}</div>
     <button role="menuitem" onClick={()=>{selectRecord(menu.row.source,menu.row.key);setMenu(null);}}>Kaydı aç</button>
     {menu.row.source!=="support"&&<button role="menuitem" onClick={()=>{if(selectRecord(menu.row.source,menu.row.key)){setConnectionsMode(true);}setMenu(null);}}>Bağlantılarını göster</button>}
     {menu.row.source!=="support"&&<button role="menuitem" onClick={()=>{if(selectRecord(menu.row.source,menu.row.key)){setRightOpen(true);setOpenVisualRequest(true);}setMenu(null);}}>Görsel işlemlerini aç</button>}
     {menu.row.source==="legacy"&&<button role="menuitem" onClick={()=>{setMulti(true);toggleChecked(menu.row.key);setMenu(null);}}>Toplu seçime ekle / çıkar</button>}
   </div>}
   <footer className="records-v3-status" aria-live="polite"><span className={status?.tone==="error"?"error":""}>{status?.message??(dirty?"● Kaydedilmemiş değişiklikler":"Yerel arşiv hazır · Canlı site yayını ayrı")}</span><span>{busy?"İşlem sürüyor":supportLoading?"Destek kayıtları yükleniyor":""}</span></footer>
 </div>;
}
