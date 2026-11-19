import {useCallback,useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import "./visual-basket.css";

type Props = {
  mode?: "add" | "manager";
  current?: StudioVisualBasketInput;
  disabled?: boolean;
  hasImage?: boolean;
  onAdded?: () => Promise<void> | void;
  onBusyChange?: (busy:boolean) => void;
  onAccepted?: (key:string) => void;
  onStatus?: (text:string,tone?:"success"|"error")=>void;
};
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
export default function VisualBasketHub({mode="add",current,disabled=false,hasImage=false,onAdded,onBusyChange,onAccepted,onStatus}:Props) {
  const bridge=window.channelFoundryStudio;
  const [state,setState]=useState<StudioVisualBasketStatus|null>(null);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{if(mode==="add")onBusyChange?.(busy);},[busy,mode,onBusyChange]);
  const [error,setError]=useState("");
  const [preview,setPreview]=useState<{key:string;name:string;url:string}|null>(null);
  const [accepting,setAccepting]=useState("");
  const [pickerOpen,setPickerOpen]=useState(false);
  const [library,setLibrary]=useState<StudioUniverseWorkspaceNode[]>([]);
  const [pickerBusy,setPickerBusy]=useState(false);
  const [libraryKind,setLibraryKind]=useState("character");
  const [libraryQuery,setLibraryQuery]=useState("");
  const [checked,setChecked]=useState<Set<string>>(new Set());
  const [pickCount,setPickCount]=useState(0);
  const refresh=useCallback(async()=>{
    if(!bridge)return;
    const next=await bridge.visualBasketStatus();
    setState(next);
  },[bridge]);
  useEffect(()=>{void refresh().catch(()=>{});},[refresh]);
  // The top toolbar owns basket management; record-level add controls signal
  // it to refresh its count without depending on the selected entity.
  useEffect(()=>{
    const notify=()=>{void refresh().catch(()=>{});};
    window.addEventListener("channel-foundry:visual-basket-changed",notify);
    return()=>window.removeEventListener("channel-foundry:visual-basket-changed",notify);
  },[refresh]);
  useEffect(()=>{
    if(!open)return;
    const refreshTick=window.setInterval(()=>{void refresh().catch(()=>{});},1400);
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!busy)setOpen(false);};
    window.addEventListener("keydown",key);
    return()=>{window.clearInterval(refreshTick);window.removeEventListener("keydown",key);document.body.style.overflow=oldOverflow;};
  },[open,busy,refresh]);
  const operation=async(fn:()=>Promise<unknown>,message=""):Promise<boolean>=>{
    if(busy||!bridge)return false;
    setBusy(true);setError("");
    try {await fn();await refresh();window.dispatchEvent(new Event("channel-foundry:visual-basket-changed"));if(message)onStatus?.(message,"success");return true;}
    catch(e){const text=errorText(e);setError(text);onStatus?.(text,"error");return false;}
    finally{setBusy(false);}
  };
  const add=async()=>{
    if(!current?.prompt.trim()||disabled)return;
    if(hasImage&&!window.confirm("Kayıtta mevcut görsel var. Sepete eklenecek üretim önce aday olarak saklanacak; ancak onayladığında mevcut görselin yerine geçecek. Devam?"))return;
    await operation(async()=>{
      await bridge!.visualBasketAdd(current);
      // Keep the record busy until automatic profile persistence finishes.
      // Once the queue owns its prompt snapshot, record navigation is safe.
      try {await onAdded?.();}
      catch(e){onStatus?.("Sepete eklendi; görsel profilini kaydederken hata: "+errorText(e),"error");}
    },onAdded?"":"Görsel üretim sepetine eklendi.");
  };
  const items=state?.items??[];
  const existingKeys=useMemo(()=>new Set(items.map(item=>item.entityKey)),[items]);
  const pickRows=useMemo(()=>{
    const term=libraryQuery.trim().toLocaleLowerCase("tr");
    return library.filter(row=>(libraryKind==="all"||row.kind===libraryKind)&&!existingKeys.has(row.key)&&
      (!term||row.name.toLocaleLowerCase("tr").includes(term)||row.summary.toLocaleLowerCase("tr").includes(term)))
      .slice(0,120);
  },[library,libraryKind,libraryQuery,existingKeys]);
  const openPicker=async()=>{
    if(!bridge)return;
    setPickerOpen(true);setPreview(null);setError("");
    if(library.length)return;
    setPickerBusy(true);
    try{setLibrary(await bridge.universeWorkspaceList({state:"approved"}));}
    catch(e){setError("Evren kayıtları yüklenemedi: "+errorText(e));}
    finally{setPickerBusy(false);}
  };
  const addSelected=async()=>{
    if(!bridge||!checked.size||busy)return;
    setBusy(true);setError("");let done=0;
    try{
      for(const node of library.filter(row=>checked.has(row.key))){
        const source=(node.payload as {visual?:Partial<StudioVisualDefinition>}|null)?.visual;
        const description=String(source?.description||node.summary||"").trim();
        const prompt=String(source?.prompt||"").trim()||[
          "Ömer’in defterinden kaynak sadakati korunmuş karakalem çizim.",
          "Varlık: "+node.name+". Tür: "+node.kind+".",
          description ? "Onaylı kaynak açıklaması: "+description : "Görünüm kaynakta belirtilmemiş.",
          "Açıklamada belirtilmeyen görünüş, aksesuar, sembol, kıyafet veya ortam ayrıntısı üretme."].join("\n");
        await bridge.visualBasketAdd({entityKey:node.key,entityType:node.kind,title:node.name,
          description,prompt,negativePrompt:source?.negativePrompt||"kaynakta bulunmayan öğeler, yazı, logo",
          size:(node.kind==="event"||node.kind==="location"||node.kind==="story")?"1536x1024":"1024x1024",useReference:true});
        done++;setPickCount(done);
      }
      setChecked(new Set());await refresh();window.dispatchEvent(new Event("channel-foundry:visual-basket-changed"));setError("");
      onStatus?.(done+" kayıt toplu üretim sepetine eklendi.","success");
    }catch(e){setError(done+" kayıt eklendi; kalanlar için hata: "+errorText(e));await refresh();}
    finally{setBusy(false);setPickCount(0);}
  };
  const counts=useMemo(()=>({
    pending:items.filter(x=>x.state==="pending").length,
    working:items.filter(x=>x.state==="working").length,
    ready:items.filter(x=>x.state==="ready").length,
    error:items.filter(x=>x.state==="error").length,
  }),[items]);
  const inspect=async(item:StudioVisualBasketItem)=>{
    setBusy(true);setError("");
    try {
      const data=await bridge!.visualBasketPreview(item.entityKey);
      setPreview({key:item.entityKey,name:item.title,url:data.imageDataUrl});
    }catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  };
  const accept=async(item:StudioVisualBasketItem)=>{
    if(!window.confirm("“"+item.title+"” adayını bu kaydın kitap görseline uygula? Mevcut görsel varsa değiştirilecek."))return;
    setAccepting(item.entityKey);
    const success=await operation(()=>bridge!.visualBasketAccept(item.entityKey),"Aday kitap görseline uygulandı.");
    if(success){if(preview?.key===item.entityKey)setPreview(null);
      onAccepted?.(item.entityKey);
      window.dispatchEvent(new CustomEvent("channel-foundry:visual-basket-accepted",{detail:item.entityKey}));}
    setAccepting("");
  };
  const batchAccept=async()=>{
    if(!bridge||busy||!counts.ready)return;
    if(!window.confirm(counts.ready+" hazır görselin tamamı kitap kayıtlarına uygulanacak. Aynı kayıtlardaki önceki çizimler değiştirilebilir. Onaylıyor musun?"))return;
    setBusy(true);setError("");
    try {
      for(const item of items.filter(x=>x.state==="ready"))await bridge.visualBasketAccept(item.entityKey);
      await refresh();setPreview(null);window.dispatchEvent(new Event("channel-foundry:visual-basket-changed"));
      for(const item of items.filter(x=>x.state==="ready")){
        onAccepted?.(item.entityKey);
        window.dispatchEvent(new CustomEvent("channel-foundry:visual-basket-accepted",{detail:item.entityKey}));
      }
      onStatus?.("Hazır adaylar kitap görsellerine uygulandı.","success");
    }catch(e){setError(errorText(e));await refresh();}
    finally{setBusy(false);}
  };
  return <div className={"visual-basket-hub visual-basket-hub--"+mode}>
    {mode==="add"&&<button type="button" className="secondary-button" disabled={disabled||busy||!current?.prompt.trim()||Boolean(state?.running)}
      title={current?.prompt.trim()?"Bu kayıt için görsel üretim işi oluşturur":"Önce görsel üretim tarifini hazırla"}
      onClick={()=>void add()}>＋ Sepete ekle</button>}
    {mode==="manager"&&<button type="button" className="secondary-button visual-basket-toolbar-button" onClick={()=>{void refresh();setOpen(true);}}>▤ Sepet ({items.length})</button>}
    {open&&createPortal(<div className="vbm-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false);}}>
      <section className="vbm-panel" role="dialog" aria-modal="true" aria-label="Görsel üretim sepeti">
        <header className="vbm-header"><div><small>GÖRSEL ATÖLYESİ · ÜRETİM LİSTESİ</small><h2>Görsel sepeti</h2>
          <p>Tekil üretim editörde kalır. Sepettekiler sırayla üretilir; sonuçlar onaylanıncaya kadar kitap görselleri değişmez.</p></div>
          <button type="button" aria-label="Kapat" onClick={()=>setOpen(false)} disabled={busy}>✕</button>
        </header>
        <div className="vbm-summary">
          <span><strong>{counts.pending}</strong> Bekliyor</span>
          <span><strong>{counts.working}</strong> Üretiliyor</span>
          <span><strong>{counts.ready}</strong> Aday hazır</span>
          <span><strong>{counts.error}</strong> Hatalı</span>
          <div className="vbm-actions">
            <small>Bir istekte {state?.settings.imagesPerRequest||1} görsel · Ayarlar → Görsel standartları</small>
            <button type="button" disabled={busy||Boolean(state?.running)} onClick={()=>void openPicker()}>＋ Arşivden toplu seç</button>
            {state?.running?
              <button type="button" disabled={state.pauseRequested||busy} onClick={()=>void operation(()=>bridge!.visualBasketPause())}>{state.pauseRequested?"Duraklatılıyor…":"Üretimi duraklat"}</button>:
              <button type="button" className="vbm-primary" disabled={!counts.pending||busy} onClick={()=>void operation(()=>bridge!.visualBasketStart())}>▶ Sepeti üret</button>}
          </div>
        </div>
        <div className="vbm-main">
          <div className="vbm-list">
            {items.map(item=><article key={item.entityKey} className={"vbm-item "+item.state}>
              <div className="vbm-item-head"><div><strong>{item.title}</strong><small>{item.entityType} · {item.presetId}{item.generationModel ? " · "+item.generationModel : ""}</small></div>
                <b>{item.state==="pending"?"Bekliyor":item.state==="working"?"Üretiliyor":item.state==="ready"?"Aday hazır":"Hata"}</b></div>
              {item.error&&<p className="vbm-failure">{item.error}</p>}
              <p>{item.prompt.slice(0,180)}{item.prompt.length>180?"…":""}</p>
              <div className="vbm-item-actions">
                {item.state==="ready"&&<><button type="button" disabled={busy||state?.running} onClick={()=>void inspect(item)}>Önizle</button>
                  <button type="button" disabled={busy||state?.running} onClick={()=>void accept(item)}>{accepting===item.entityKey?"Uygulanıyor…":"Kitaba uygula"}</button></>}
                {item.state==="error"&&<button type="button" disabled={busy||state?.running} onClick={()=>void operation(()=>bridge!.visualBasketRetry(item.entityKey))}>Yeniden dene</button>}
                {item.state!=="working"&&<button type="button" disabled={busy||state?.running} onClick={()=>void operation(()=>bridge!.visualBasketRemove(item.entityKey))}>Sepetten çıkar</button>}
              </div>
            </article>)}
            {!items.length&&<div className="vbm-empty">Henüz üretim işi yok. Bir kayıtta görsel tarifini hazırlayıp “Sepete ekle” düğmesini kullanabilirsin.</div>}
          </div>
          {pickerOpen&&<aside className="vbm-inspection vbm-library">
            <header><strong>Evren kayıtlarından ekle</strong><button type="button" disabled={busy} onClick={()=>setPickerOpen(false)}>✕</button></header>
            <label>Tür
              <select value={libraryKind} onChange={e=>{setLibraryKind(e.target.value);setChecked(new Set());}}>
                <option value="character">Karakterler</option><option value="object">Nesneler</option>
                <option value="event">Olaylar</option><option value="location">Mekânlar</option><option value="all">Tüm türler</option>
              </select>
            </label>
            <input aria-label="Evren kaydında ara" value={libraryQuery} placeholder="Kayıt başlığı veya özeti…" onChange={e=>setLibraryQuery(e.target.value)}/>
            <div className="vbm-library-list">{pickerBusy?<p>Arşiv yükleniyor…</p>:pickRows.map(row=><label key={row.key}>
              <input type="checkbox" checked={checked.has(row.key)} disabled={busy} onChange={e=>setChecked(old=>{
                const next=new Set(old);if(e.target.checked)next.add(row.key);else next.delete(row.key);return next;})}/>
              <span><strong>{row.name}</strong><small>{row.sourceVideoIds.length} kaynak video · {row.summary.slice(0,90)}</small></span>
            </label>)}{!pickerBusy&&!pickRows.length&&<p>Filtreye uygun başka kayıt yok.</p>}</div>
            <button type="button" disabled={busy||!pickRows.length} onClick={()=>setChecked(new Set(pickRows.slice(0,30).map(row=>row.key)))}>Görünen ilk 30 kaydı seç</button>
            <button type="button" disabled={busy||!checked.size||Boolean(state?.running)} className="vbm-primary" onClick={()=>void addSelected()}>{busy?pickCount+" kayıt eklendi…":checked.size+" kaydı sepete ekle"}</button>
            <small>Yalnız onaylı Evren kayıtları listelenir. Mevcut sepet içeriği tekrar eklenmez. Eksik görsel tarifleri onaylı özetlerden oluşturulur.</small>
          </aside>}
          {preview&&!pickerOpen&&<aside className="vbm-inspection"><header><strong>{preview.name}</strong><button type="button" onClick={()=>setPreview(null)}>✕</button></header>
            <img alt={preview.name+" · aday karakalem görseli"} src={preview.url}/>
            <p>Bu görsel henüz kitapta kullanılmıyor. Kayıttaki diğer öğelerle ve kaynak kareyle tutarlılığını kontrol et.</p>
            <button type="button" className="vbm-primary" disabled={busy||state?.running} onClick={()=>{const item=items.find(i=>i.entityKey===preview.key);if(item)void accept(item);}}>Bu adayı kitaba uygula</button>
          </aside>}
        </div>
        <footer className="vbm-footer">
          <span role="status">{error|| (state?.running?"Üretim aktif. İşlem sırasındaki istek tamamlandığında duraklatılabilir.":"Hazır adaylar dilediğinde tek tek veya topluca uygulanabilir.")}</span>
          <button type="button" disabled={!counts.ready||busy||state?.running} onClick={()=>void batchAccept()}>Hazırları topluca uygula</button>
          <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Kapat</button>
        </footer>
      </section>
    </div>,document.body)}
  </div>;
}
