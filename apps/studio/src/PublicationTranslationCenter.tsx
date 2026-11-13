import {useCallback,useEffect,useMemo,useState} from 'react';
import PublicationLanguageEditor from './PublicationLanguageEditor';

type Filter='all'|'missing'|'pending'|'stale'|'errors'|'ready';
const kinds:{kind:PublicationLanguageKind|'all';label:string}[]=[
  {kind:'all',label:'Tüm türler'},{kind:'section',label:'Günlük'},{kind:'video',label:'Kamera'},
  {kind:'entity',label:'Evren rehberi'},{kind:'outline',label:'İçindekiler'},{kind:'vefk',label:'Çizim Atölyesi'},
];
const kindLabels:Record<PublicationLanguageKind,string>={section:'Günlük',video:'Kamera',entity:'Evren',outline:'İçindekiler',vefk:'Çizim'};
const titleOf=(pack:PublicationLanguagePack)=>String(pack.source.title||pack.source.name||pack.id);
const entryKey=(item:PublicationLanguagePack)=>item.kind+':'+item.id;
const canTranslate=(item:PublicationLanguagePack)=>{
 const tr=item.variants.tr,en=item.variants.en;
 return tr?.state==='approved'&&!tr.stale && !(en?.state==='approved'&&!en.stale) && !(en?.candidate&&!en.stale);
};
const stateOf=(item:PublicationLanguagePack)=>item.flags?.errors?'error':item.flags?.stale?'stale':item.flags?.pending?'pending':item.flags?.ready?'ready':item.flags?.missing?'missing':'missing';
const description:Record<string,string>={ready:'İki dil onaylı',missing:'İngilizce eksik',pending:'İncelenmeyi bekliyor',stale:'Kaynak değişmiş',error:'Üretim hatası'};

export default function PublicationTranslationCenter({focusName='',onDirtyChange,onBusyChange,onRecordPick}:{
 focusName?:string;onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void;
 onRecordPick?:(pack:PublicationLanguagePack)=>void;
}){
 const bridge=window.channelFoundryStudio;
 const [overview,setOverview]=useState<PublicationLanguageOverview|null>(null);
 const [batch,setBatch]=useState<PublicationTranslationBatchStatus|null>(null);
 const [selected,setSelected]=useState('');
 const [checked,setChecked]=useState<Set<string>>(()=>new Set());
 const [kind,setKind]=useState<PublicationLanguageKind|'all'>('all');
 const [filter,setFilter]=useState<Filter>(()=>{
  const remembered=sessionStorage.getItem('studio-language-filter');sessionStorage.removeItem('studio-language-filter');
  return remembered&&['ready','missing','stale','pending','errors'].includes(remembered)?remembered as Filter:'all';
 });
 const [query,setQuery]=useState('');
 const [loading,setLoading]=useState(true);
 const [operating,setOperating]=useState(false);
 const [error,setError]=useState('');
 const [dirty,setDirty]=useState(false),[editorBusy,setEditorBusy]=useState(false);
 const [shown,setShown]=useState(100);
 const onDirty=useCallback((value:boolean)=>setDirty(value),[]);
 const onBusy=useCallback((value:boolean)=>setEditorBusy(value),[]);
 useEffect(()=>onDirtyChange?.(dirty),[dirty,onDirtyChange]);
 useEffect(()=>onBusyChange?.(editorBusy||operating),[editorBusy,operating,onBusyChange]);
 useEffect(()=>()=>{onDirtyChange?.(false);onBusyChange?.(false)},[onDirtyChange,onBusyChange]);
 const refresh=useCallback(async()=>{
  if(!bridge?.languagesOverview)return;
  const [value,status]=await Promise.all([
    bridge.languagesOverview(),bridge.languagesBatchStatus?.().catch(()=>null)??Promise.resolve(null),
  ]);
  setOverview(value);if(status)setBatch(status);
  setSelected(previous=>{
   if(previous&&value.rows.some(row=>entryKey(row)===previous))return previous;
   const wanted=focusName.toLocaleLowerCase('tr-TR').trim();
   const match=wanted?value.rows.find(row=>titleOf(row).toLocaleLowerCase('tr-TR')===wanted):null;
   const waiting=value.rows.find(row=>row.flags?.missing||row.flags?.stale||row.flags?.errors);
   const first=match??waiting??value.rows[0];
   return first?entryKey(first):'';
  });
 },[bridge,focusName]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(reason=>{if(active)setError(String(reason));}).finally(()=>{if(active)setLoading(false);});
  const handle=()=>{if(active)void refresh().catch(()=>undefined);};
  const unsubscribe=bridge?.onDataChanged?.(handle);
  return()=>{active=false;unsubscribe?.();};
 },[bridge,refresh]);
 useEffect(()=>{
  if(!batch?.running)return;
  const interval=setInterval(()=>{void refresh().catch(()=>undefined);},1800);
  return()=>clearInterval(interval);
 },[batch?.running,refresh]);
 const rows=overview?.rows??[];
 const visible=useMemo(()=>rows.filter(row=>
  (kind==='all'||row.kind===kind)&&
  (filter==='all'||(filter==='errors'?row.flags?.errors:row.flags?.[filter]))&&
  (!query||`${titleOf(row)} ${kindLabels[row.kind]} ${row.id}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')))
 ).sort((a,b)=>titleOf(a).localeCompare(titleOf(b),'tr-TR')),[rows,kind,filter,query]);
 const current=rows.find(row=>entryKey(row)===selected)??null;
 useEffect(()=>{if(current)onRecordPick?.(current);},[current?.kind,current?.id,onRecordPick]);
 const queueRows=rows.filter(row=>canTranslate(row));
 const choose=(row:PublicationLanguagePack)=>{
  if(editorBusy){setError('Devam eden dil işlemi bitmeden kayıt değiştirilemez.');return;}
  if(dirty&&!window.confirm('Kaydedilmemiş çeviri değişiklikleri bırakılsın mı?'))return;
  setSelected(entryKey(row));setError('');onRecordPick?.(row);
 };
 const checkedRows=rows.filter(row=>checked.has(entryKey(row)));
 const queue=async()=>{
  if(!bridge?.languagesBatchEnqueue||operating)return;
  const targets=checkedRows.length?checkedRows:queueRows;
  const candidates=targets.filter(canTranslate);
  if(!candidates.length){setError('Seçili kayıtlarda onaylı Türkçeden çevrilebilecek İngilizce metin bulunmuyor.');return;}
  if(!window.confirm(`${candidates.length} kaydın İngilizce çevirisi AI kuyruğuna alınsın mı? Onaylı metinler değiştirilmeyecek.`))return;
  setOperating(true);setError('');
  try{const result=await bridge.languagesBatchEnqueue({items:candidates.map(row=>({kind:row.kind,id:row.id}))});setBatch(result);setChecked(new Set());}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setOperating(false);}
 };
 const manage=async(action:'pause'|'resume'|'retry')=>{
  if(!bridge||operating)return;setOperating(true);setError('');
  try{const next=action==='pause'?await bridge.languagesBatchPause():action==='resume'?await bridge.languagesBatchResume():await bridge.languagesBatchRetry();setBatch(next);}
  catch(e){setError(String(e));}finally{setOperating(false);}
 };
 const countBy=(target:'tr'|'en')=>rows.filter(row=>row.variants[target]?.state==='approved'&&!row.variants[target]?.stale).length;
 return <section className="records-language-workspace" data-testid="records-language-workspace">
  <aside className="records-language-index">
   <header><strong>YAYIN METİNLERİ</strong><span>{rows.length} kayıt</span></header>
   <div className="records-language-summary"><span>TR <strong>{countBy('tr')}/{rows.length}</strong></span><span>EN <strong>{countBy('en')}/{rows.length}</strong></span></div>
   <div className="records-language-filters">
    <input type="search" aria-label="Yayın metinlerinde ara" placeholder="Başlık veya kaynak ara" value={query} onChange={e=>{setQuery(e.target.value);setShown(100);}}/>
    <select aria-label="Yayın metni türü" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setShown(100);}}>{kinds.map(k=><option key={k.kind} value={k.kind}>{k.label}</option>)}</select>
    <select aria-label="Çeviri durumu" value={filter} onChange={e=>{setFilter(e.target.value as Filter);setShown(100);}}><option value="all">Tüm durumlar</option><option value="missing">İngilizce eksik</option><option value="stale">Güncellenmeli</option><option value="pending">Onay bekliyor</option><option value="errors">Hatalı</option><option value="ready">İki dil hazır</option></select>
   </div>
   <div className="records-language-list" aria-label="Yayın kayıtları">
    {visible.slice(0,shown).map(row=><div className={'records-language-item'+(selected===entryKey(row)?' selected':'')} key={entryKey(row)}>
     <input type="checkbox" checked={checked.has(entryKey(row))} aria-label={`${titleOf(row)} toplu çeviriye seç`} onChange={e=>setChecked(prev=>{const next=new Set(prev);if(e.target.checked)next.add(entryKey(row));else next.delete(entryKey(row));return next;})}/>
     <button onClick={()=>choose(row)}><strong>{titleOf(row)}</strong><span>{kindLabels[row.kind]} · {description[stateOf(row)]}</span></button>
    </div>)}
    {!visible.length&&<p className="records-language-empty">Bu filtrede yayın kaydı bulunmuyor.</p>}
    {visible.length>shown&&<button className="records-language-more" onClick={()=>setShown(n=>n+100)}>Daha fazla göster ({visible.length-shown})</button>}
   </div>
   <section className="records-language-batch">
    <div className="records-language-batch-title"><strong>AI toplu çeviri</strong><span>{checked.size?`${checked.size} seçili`:`${queueRows.length} çevrilebilir`}</span></div>
    <p>Yalnız onaylı TR metninden EN taslağı üretir. Onaylı İngilizceyi değiştirmez.</p>
    <button className="records-language-batch-primary" disabled={operating||loading||!(checked.size?checkedRows.some(canTranslate):queueRows.length)} onClick={()=>void queue()}>{checked.size?'Seçilenleri çevir':'Eksik / eski kayıtları çevir'}</button>
    <div className="records-language-batch-status"><span>Kuyruk {batch?.counts.queued??0}</span><span>Hazır {batch?.counts.done??0}</span><span>Hata {batch?.counts.failed??0}</span></div>
    <div className="records-language-batch-actions">
     {batch?.running?<button onClick={()=>void manage('pause')} disabled={operating}>Duraklat</button>:<button onClick={()=>void manage('resume')} disabled={operating||!batch?.counts.queued}>Devam et</button>}
     <button onClick={()=>void manage('retry')} disabled={operating||!batch?.counts.failed}>Hataları yeniden dene</button>
    </div>
   </section>
  </aside>
  <main className="records-language-main">
   <header className="records-language-header"><div><small>TR / EN · YAYIN HAZIRLIĞI</small><h2>{current?titleOf(current):'Yayın metinleri'}</h2><p>Kaynak metin ve AI önerisi yan yana. Çeviriler ancak insan onayından sonra yayına alınabilir.</p></div><button onClick={()=>void refresh().catch(e=>setError(String(e)))} disabled={operating}>Yenile</button></header>
   {error&&<p className="records-language-error" role="alert">{error}</p>}
   {current?<PublicationLanguageEditor key={entryKey(current)} kind={current.kind} id={current.id} embedded compare onDirtyChange={onDirty} onBusyChange={onBusy} onUpdated={()=>void refresh().catch(()=>undefined)}/>:<p className="records-language-empty">{loading?'Dil kayıtları yükleniyor…':'Bir yayın kaydı seç.'}</p>}
  </main>
 </section>;
}
