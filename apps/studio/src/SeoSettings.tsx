import { useEffect, useState } from "react";

const labels: Record<StudioSeoRow["kind"],string> = {section:"Evren",video:"Kamera",vefk:"Vefk"};
const blank = { title:"",description:"",image:"" };
export default function SeoSettings() {
  const [language,setLanguage]=useState<PublicationLanguage>("tr");
  const [data,setData] = useState<StudioSeoOverview|null>(null);
  const [selected,setSelected] = useState("site");
  const [edit,setEdit] = useState(blank);
  const [search,setSearch] = useState("");
  const [suggestion,setSuggestion]=useState<{title:string;description:string}|null>(null);
  const [busy,setBusy] = useState("");
  const [notice,setNotice] = useState("");
  const [error,setError] = useState("");
  useEffect(()=>{
    let live=true;
    void window.channelFoundryStudio?.seoOverview().then(result=>{
      if (!live) return;
      setData(result); setEdit({...result.site});
    }).catch(reason=>{ if(live) setError(String(reason)); });
    return ()=>{live=false;};
  },[]);
  const pick = (key:string) => {
    if (!data) return;
    const row=data.rows.find(row=>row.kind+":"+row.id===key&&row.language===language);
    setSelected(key);setSuggestion(null);setError("");setNotice("");
    setEdit(row?{title:row.title,description:row.description,image:""}:{...data.sites[language]});
  };
  const save=async(approved=false)=>{
    const bridge=window.channelFoundryStudio;
    if(!bridge||!data||busy) return;
    setBusy("save");setNotice("");setError("");
    try{
      const [kind,...idParts]=selected.split(":");const id=idParts.join(":");
      const result=await bridge.seoSave({kind,id,language,approved,sourceHash:data.rows.find(r=>r.kind===kind&&r.id===id&&r.language===language)?.sourceHash,title:edit.title,description:edit.description,image:edit.image});
      setData(result);setNotice("SEO taslağı kaydedildi. Canlıya geçmesi için Yayınlama bölümünden yayınlanmalı.");
    }catch(e){setError(String(e));}finally{setBusy("");}
  };
  const ai=async()=>{
    const bridge=window.channelFoundryStudio;
    if(!bridge||!data||selected==="site"||busy) return;
    setBusy("ai");setNotice("");setError("");
    try{
      const [kind,...idParts]=selected.split(":");const id=idParts.join(":");
      const result=await bridge.seoSuggest({kind,id,language});
      setSuggestion(result);
      setNotice("AI önerisi hazır; mevcut metninize dokunulmadı.");
    }catch(e){setError(String(e));}finally{setBusy("");}
  };
  const results = data?.rows.filter(row=>row.language===language).filter(row=>(row.title+" "+row.id).toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")))??[];
  return <section className="insight-settings seo-settings">
    <header className="insight-header"><div><h2>SEO Atölyesi</h2><p>Onaylı içeriklerden arama başlığı ve açıklaması hazırlama.</p></div>
      <span className="insight-private-status">Önizleme · arama motorlarına kapalı</span>
    </header>
    <div className="language-tabs" role="tablist" aria-label="SEO içerik dili">{(["tr","en"] as const).map(lang=><button role="tab" aria-selected={language===lang} key={lang} disabled={Boolean(busy)} onClick={()=>{setLanguage(lang);setSelected("site");if(data)setEdit({...data.sites[lang]});}}>{lang==='tr'?'Türkçe':'İngilizce'}</button>)}</div>
    <div className="insight-metrics">
      <div><small>İçerik sayfaları</small><strong>{data?.rows.length??"—"}</strong><span>Onaylı yayın kayıtları</span></div>
      <div><small>Gözden geçirilecek</small><strong>{data?.draftCount??"—"}</strong><span>Başlık / açıklama önerisi</span></div>
      <div><small>İndeksleme</small><strong>Kapalı</strong><span>Demo koruması açık</span></div>
    </div>
    <div className="seo-workspace">
      <section className="panel seo-list">
        <input aria-label="SEO içerik ara" placeholder="Başlık veya kayıt ara…" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="seo-scroll">
          <button className={selected==="site"?"active":""} onClick={()=>pick("site")}><b>Site kimliği</b><small>Genel başlık ve açıklama</small></button>
          {results.map(row=><button key={row.kind+":"+row.id} className={selected===row.kind+":"+row.id?"active":""} onClick={()=>pick(row.kind+":"+row.id)}>
            <b>{row.title||row.id}</b><small>{labels[row.kind]} · {row.needsReview?"İncelenecek":"Onaylı"}</small>
          </button>)}
          {data&&!results.length&&<p className="insight-empty">Eşleşen içerik yok.</p>}
        </div>
      </section>
      <section className="panel seo-editor">
        {data ? <>
          <div className="seo-editor-title"><h3>{selected==="site"?"Site kimliği":"Arama sonucu önizlemesi"}</h3>
            <div className="insight-actions">
              {selected!=="site"&&<button disabled={Boolean(busy)} onClick={()=>void ai()}>{busy==="ai"?"Üretiliyor…":"✦ AI ile öner"}</button>}
              <button disabled={Boolean(busy)} onClick={()=>void save()}>{busy==="save"?"Kaydediliyor…":"Kaydet"}</button>
              {selected!=="site"&&<button disabled={Boolean(busy)} onClick={()=>void save(true)}>Bu dilin SEO metnini onayla</button>}
            </div>
          </div>
          <label>Başlık <span>{edit.title.length}/120</span><input maxLength={120} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label>
          <label>Arama açıklaması <span>{edit.description.length}/180</span><textarea maxLength={180} rows={3} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/></label>
          {selected==="site"&&<label>Sosyal paylaşım görseli yolu <input value={edit.image} maxLength={250} placeholder="İsteğe bağlı" onChange={e=>setEdit({...edit,image:e.target.value})}/></label>}
          {suggestion&&<div className="seo-serp-preview"><small>AI önerisi</small><strong>{suggestion.title}</strong><p>{suggestion.description}</p><button onClick={()=>{setEdit({...edit,...suggestion});setSuggestion(null);}}>Öneriyi taslağa al</button></div>}
          <div className="seo-serp-preview"><small>Önizleme</small><strong>{edit.title||"BirDeSenGör"}</strong><p>{edit.description||"Açıklama girilmedi."}</p></div>
          <p className="insight-footnote">SEO kayıtları ayrı bir manifestte tutulur. İçerik yayınlanınca güncellenir; mevcut önizleme şifresi, robots.txt ve noindex ayarları değiştirilmez.</p>
        </> : <p className="insight-empty">SEO bilgileri yükleniyor…</p>}
        {notice&&<p className="insight-success" role="status">{notice}</p>}
        {error&&<p className="insight-warning" role="alert">{error}</p>}
      </section>
    </div>
  </section>;
}
