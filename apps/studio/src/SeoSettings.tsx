import {useEffect,useState} from 'react';
import {useSettingsSection} from './SettingsController';

type SeoDraft={title:string;description:string;image:string};
const blank=():SeoDraft=>({title:'',description:'',image:''});
const labels:Record<StudioSeoRow['kind'],string>={section:'Evren',video:'Kamera',vefk:'Çizim Atölyesi'};
const identity=(row:StudioSeoRow)=>row.language+':'+row.kind+':'+row.id;
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
export default function SeoSettings({active=true}:{active?:boolean}={}){
 const bridge=window.channelFoundryStudio;
 const [language,setLanguage]=useState<PublicationLanguage>('tr');
 const [data,setData]=useState<StudioSeoOverview|null>(null);
 const [batch,setBatch]=useState<StudioSeoBatchStatus|null>(null);
 const [selected,setSelected]=useState('site');
 const [edit,setEdit]=useState<SeoDraft>(blank);
 const [baseline,setBaseline]=useState<SeoDraft>(blank);
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState<'all'|'review'|'ready'>('all');
 const [suggestion,setSuggestion]=useState<{title:string;description:string}|null>(null);
 const [checked,setChecked]=useState<string[]>([]);
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const current=data?.rows.find(row=>row.language===language&&row.kind+':'+row.id===selected);
 const isDirty=Boolean(data&&JSON.stringify(edit)!==JSON.stringify(baseline));
 const change=(value:SeoDraft)=>{setEdit(value);setNotice('');};
 const refresh=async(force=false)=>{
   if(!bridge)return;
   const [next,queue]=await Promise.all([bridge.seoOverview(),bridge.seoBatchStatus().catch(()=>null)]);
   setData(next);if(queue)setBatch(queue);
   if(force&&!isDirty){const row=next.rows.find(item=>item.language===language&&item.kind+':'+item.id===selected);
     const value=row?{title:row.title,description:row.description,image:''}:{...next.sites[language]};setEdit(value);setBaseline(value);setSuggestion(row?.candidate??null);}
 };
 useEffect(()=>{let live=true;
   void (async()=>{try{if(!bridge)return;const [next,queue]=await Promise.all([bridge.seoOverview(),bridge.seoBatchStatus().catch(()=>null)]);if(!live)return;
     setData(next);setBatch(queue);setEdit({...next.sites.tr});setBaseline({...next.sites.tr});
   }catch(reason){if(live)setError(errorText(reason));}finally{if(live)setLoading(false);}})();
   return()=>{live=false;};
 },[bridge]);
 useEffect(()=>{if(!batch?.running)return;
   const timer=setInterval(()=>{if(!isDirty)void refresh(true).catch(()=>undefined);else void bridge?.seoBatchStatus().then(setBatch).catch(()=>undefined);},2000);
   return()=>clearInterval(timer);
 },[active,batch?.running,bridge,isDirty,selected,language]);
 useEffect(()=>{if(!active||!data)return;
   if(isDirty){void bridge?.seoBatchStatus().then(setBatch).catch(()=>undefined);}
   else void refresh(true).catch(()=>undefined);
 },[active]);
 const save=async(approved=false)=>{
   if(!bridge||!data||busy)throw new Error('SEO ayarları henüz hazır değil.');
   setBusy(approved?'approve':'save');setNotice('');setError('');
   try{
     const [kind,...ids]=selected.split(':');const id=ids.join(':');
     const result=await bridge.seoSave({kind,id,language,approved,sourceHash:current?.sourceHash,...edit});
     setData(result);setBaseline({...edit});setSuggestion(null);
     setNotice(approved?'SEO metni onaylandı. Canlıya yayınlama işlemiyle aktarılır.':'SEO taslağı kaydedildi.');
   }catch(reason){setError(errorText(reason));throw reason;}finally{setBusy('');}
 };
 const revert=()=>{setEdit({...baseline});setSuggestion(null);setError('');setNotice('');};
 const coordinated=useSettingsSection('SEO',isDirty,Boolean(busy),()=>save(false),revert);
 const pick=(key:string,lang:PublicationLanguage=language)=>{
   if(!data)return;
   if(busy)return;
   if(isDirty&&!window.confirm('Kaydedilmemiş SEO taslağı var. Değişiklikler bırakılsın mı?'))return;
   const row=data.rows.find(r=>r.kind+':'+r.id===key&&r.language===lang);
   const value=row?{title:row.title,description:row.description,image:''}:{...data.sites[lang]};
   setSelected(key);setLanguage(lang);setEdit(value);setBaseline(value);setSuggestion(row?.candidate??null);setError('');setNotice('');
 };
 const ai=async()=>{
   if(!bridge||!data||busy)return;
   setBusy('ai');setNotice('');setError('');
   try{const [kind,...ids]=selected.split(':');const result=await bridge.seoSuggest({kind,id:ids.join(':'),language});
     setSuggestion(result);setNotice('AI önerisi hazır. Kaydedilmiş SEO metnine dokunulmadı.');
   }catch(reason){setError(errorText(reason));}finally{setBusy('');}
 };
 const selectedRows=data?.rows.filter(row=>row.language===language)??[];
 const results=selectedRows.filter(row=>(filter==='all'||(filter==='review'?row.needsReview:!row.needsReview))&&
   `${row.title} ${row.id} ${row.source}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
 const pending=selectedRows.filter(row=>row.needsReview);
 const queue=async()=>{
   if(!bridge||busy)return;
   const targets=(checked.length?selectedRows.filter(row=>checked.includes(identity(row))):pending).filter(row=>row.needsReview);
   if(!targets.length){setError('AI önerisi gerektiren kaynak bulunmuyor.');return;}
   if(!window.confirm(`${targets.length} onaylı kaynak için AI SEO önerisi hazırlansın mı? Onaylı kayıtlar değiştirilmeyecek.`))return;
   setBusy('batch');setError('');setNotice('');
   try{const value=await bridge.seoBatchEnqueue({items:targets.map(({kind,id,language})=>({kind,id,language}))});
     setBatch(value);setChecked([]);setNotice(`${value.queued} öneri kuyruğa alındı.`);
   }catch(reason){setError(errorText(reason));}finally{setBusy('');}
 };
 const control=async(mode:'pause'|'resume'|'retry')=>{
   if(!bridge||busy)return;setBusy(mode);
   try{const next=mode==='pause'?await bridge.seoBatchPause():mode==='resume'?await bridge.seoBatchResume():await bridge.seoBatchRetry();setBatch(next);}
   catch(reason){setError(errorText(reason));}finally{setBusy('');}
 };
 return <section className="seo-v3" data-testid="seo-v3">
   <header className="seo-v3-head"><div><small>SEO · YAYIN HAZIRLIĞI</small><h2>SEO Atölyesi</h2><p>Onaylı yayın içeriklerinden arama metni hazırla, karşılaştır ve onayla.</p></div>
     <div className="seo-v3-head-actions"><div className="seo-v3-languages" role="tablist" aria-label="SEO dili"><button role="tab" aria-selected={language==='tr'} onClick={()=>pick('site','tr')}>Türkçe</button><button role="tab" aria-selected={language==='en'} onClick={()=>pick('site','en')}>İngilizce</button></div>
       <button onClick={()=>void refresh(true).catch(reason=>setError(errorText(reason)))} disabled={Boolean(busy)}>Yenile</button></div>
   </header>
   <div className="seo-v3-stats"><span><strong>{selectedRows.length}</strong> kaynak</span><span><strong>{pending.length}</strong> gözden geçirilecek</span><span><strong>{selectedRows.length-pending.length}</strong> onaylı</span><span>İndeksleme <strong>kapalı</strong></span></div>
   <div className="seo-v3-grid">
     <aside className="seo-v3-index"><div className="seo-v3-filter"><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Başlık veya kaynak ara" aria-label="SEO içerik ara"/>
       <select aria-label="SEO durum filtresi" value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">Tüm kayıtlar</option><option value="review">Gözden geçirilecek</option><option value="ready">Onaylı</option></select></div>
       <div className="seo-v3-list"><button className={selected==='site'?'active':''} onClick={()=>pick('site')}><strong>Site kimliği</strong><small>Genel başlık ve açıklama</small></button>
         {results.map(row=><div key={identity(row)} className={'seo-v3-item'+(selected===row.kind+':'+row.id?' active':'')}>
           <input type="checkbox" aria-label={`${row.title} toplu SEO seç`} checked={checked.includes(identity(row))} onChange={event=>setChecked(prev=>event.target.checked?[...prev,identity(row)]:prev.filter(v=>v!==identity(row)))}/>
           <button onClick={()=>pick(row.kind+':'+row.id)}><strong>{row.title||row.id}</strong><small>{labels[row.kind]} · {row.needsReview?'İncelenecek':'Onaylı'}{row.candidate?' · AI önerisi hazır':''}</small></button>
         </div>)}
         {!results.length&&<p>Bu filtrede kayıt yok.</p>}
       </div>
       <div className="seo-v3-batch"><header><strong>✦ AI toplu SEO</strong><span>{checked.length?`${checked.length} seçili`: `${pending.length} uygun`}</span></header>
         <p>Yalnız onaylı yayın kaynağından öneri oluşturur; mevcut SEO onayını değiştirmez.</p>
         <button className="seo-v3-batch-primary" disabled={!pending.length||Boolean(busy)} onClick={()=>void queue()}>{checked.length?'Seçilenlere öneri üret':'Eksik SEO önerilerini üret'}</button>
         <div className="seo-v3-counts">Sıra {batch?.counts.queued??0} · Hazır {batch?.counts.done??0} · Hata {batch?.counts.failed??0}</div>
         <div className="seo-v3-queue-actions"><button disabled={Boolean(busy)||!(batch?.running||batch?.counts.queued)} onClick={()=>void control(batch?.running?'pause':'resume')}>{batch?.running?'Duraklat':'Devam et'}</button><button disabled={Boolean(busy)||!batch?.counts.failed} onClick={()=>void control('retry')}>Hataları dene</button></div>
       </div>
     </aside>
     <main className="seo-v3-editor"><div className="seo-v3-edit-head"><div><small>{selected==='site'?'SİTE KİMLİĞİ':labels[current?.kind??'section']+' · '+language.toUpperCase()}</small><h3>{selected==='site'?'Site genel SEO':current?.title||'SEO kaydı'}</h3></div><div className="seo-v3-edit-actions"><button disabled={Boolean(busy)||!data} onClick={()=>void ai()}>{busy==='ai'?'Üretiliyor…':'✦ AI önerisi'}</button>{selected!=='site'&&<button disabled={Boolean(busy)||!data||!edit.title.trim()||!edit.description.trim()} onClick={()=>void save(true).catch(()=>undefined)}>SEO metnini onayla</button>}{!coordinated&&<button disabled={!isDirty||Boolean(busy)} onClick={()=>void save().catch(()=>undefined)}>Kaydet</button>}</div></div>
       <div className="seo-v3-compare">
         <div className="seo-v3-source"><strong>ONAYLI YAYIN KAYNAĞI</strong><p>{current?.source??(selected==='site'?'Site kimliği; onaylı yayın kayıtlarının başlık ve açıklamalarından hazırlanır.':'Bir SEO kaydı seç.')}</p></div>
         <div className="seo-v3-fields"><label>Arama başlığı <small>{edit.title.length}/120 {edit.title.length>65?'· önerilen aralıktan uzun':''}</small><input aria-label="SEO arama başlığı" maxLength={120} value={edit.title} onChange={e=>change({...edit,title:e.target.value})}/></label>
           <label>Arama açıklaması <small>{edit.description.length}/180</small><textarea aria-label="SEO arama açıklaması" maxLength={180} rows={4} value={edit.description} onChange={e=>change({...edit,description:e.target.value})}/></label>
           {selected==='site'&&<label>Sosyal paylaşım görsel yolu <input aria-label="SEO sosyal görsel yolu" maxLength={250} value={edit.image} onChange={e=>change({...edit,image:e.target.value})}/></label>}
         </div>
       </div>
       {suggestion&&<div className="seo-v3-suggestion"><strong>✦ AI önerisi · henüz onaylanmadı</strong><b>{suggestion.title}</b><p>{suggestion.description}</p><button onClick={()=>{change({...edit,title:suggestion.title,description:suggestion.description});setSuggestion(null);}}>Taslağa al</button></div>}
       <div className="seo-v3-preview"><small>ARAMA SONUCU ÖNİZLEMESİ</small><strong>{edit.title||'Başlık belirlenmedi'}</strong><p>{edit.description||'Açıklama henüz girilmedi.'}</p></div>
       <p className="seo-v3-note">SEO onayı yerelde saklanır; canlıya yalnız Yayın Merkezi üzerinden aktarılır. Önizleme şifresi, robots.txt ve noindex ayarları bu işlemle değiştirilmez.</p>
       {loading&&<p role="status">SEO kayıtları hazırlanıyor…</p>}
       {notice&&<p role="status" className="seo-v3-notice">{notice}</p>}
       {error&&<p role="alert" className="seo-v3-error">{error}</p>}
     </main>
   </div>
 </section>;
}
