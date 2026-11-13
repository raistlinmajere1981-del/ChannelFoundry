import { useEffect, useRef, useState } from 'react';
import './publication-languages.css';
const labels:Record<string,string>={title:'Başlık',displayName:'İngilizce görünen ad',summary:'Özet',description:'Açıklama',text:'Metin',label:'Bağlantı metni',alt:'Görsel açıklaması',caption:'Görsel alt yazısı',notes:'Okuma notları',numberLabel:'Bölüm etiketi',role:'Rol'};
function fields(value:unknown,path:string[]=[]):{path:string[];text:string;label:string}[] {
  if(typeof value==='string') return labels[path.at(-1)||'']?[{path,text:value,label:labels[path.at(-1)||'']}]:[];
  if(!value||typeof value!=='object') return [];
  return Object.entries(value).flatMap(([k,v])=>k==='core'?[]:fields(v,[...path,k]));
}
function update(data:LanguageData,path:string[],value:string) { const next=structuredClone(data);let cursor:any=next;for(const k of path.slice(0,-1)) cursor=cursor[k];cursor[path.at(-1)!]=value;return next; }
const kindLabels:Record<string,string>={video:'Kamera',section:'Evren',vefk:'Vefk',entity:'Arşiv',outline:'İçindekiler'};
export default function PublicationLanguageEditor({kind,id,embedded=false,compare=false,onDirtyChange,onBusyChange,onUpdated}:{
  kind?:PublicationLanguageKind;id?:string;embedded?:boolean;compare?:boolean;
  onDirtyChange?:(dirty:boolean)=>void;onBusyChange?:(busy:boolean)=>void;onUpdated?:()=>void;
}) {
  const [pack,setPack]=useState<PublicationLanguagePack|null>(null),[rows,setRows]=useState<PublicationLanguagePack[]>([]);
  const [selected,setSelected]=useState(''),[lang,setLang]=useState<PublicationLanguage>('tr'),[edit,setEdit]=useState<LanguageData>({});
  const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState('');
  const languageRef=useRef(lang);languageRef.current=lang;
  useEffect(()=>{onDirtyChange?.(dirty)},[dirty,onDirtyChange]);
  useEffect(()=>{onBusyChange?.(busy)},[busy,onBusyChange]);
  useEffect(()=>()=>{onDirtyChange?.(false);onBusyChange?.(false)},[onDirtyChange,onBusyChange]);
  const bridge=window.channelFoundryStudio;
  const adopt=(next:PublicationLanguagePack|null,l=languageRef.current)=>{setPack(next);const data=next?.variants[l]?.data;setEdit(structuredClone(data&&Object.keys(data).length?data:next?.source||{}));setDirty(false);};
  useEffect(()=>{let live=true;if(!bridge?.languagesGet||!bridge?.languagesOverview)return;
    const task=kind&&id?bridge.languagesGet({kind,id}):bridge.languagesOverview().then(data=>{
      const filter=sessionStorage.getItem('studio-language-filter');
      const list=data.rows.filter(r=>!kind||r.kind===kind).filter(r=>!filter||Boolean(r.flags?.[filter as keyof NonNullable<typeof r.flags>]));
      sessionStorage.removeItem('studio-language-filter');if(live){setRows(list);setSelected(list[0]?`${list[0].kind}:${list[0].id}`:'');}return list[0]||null;});
    void task.then(p=>{if(live)adopt(p);}).catch(e=>{if(live)setMessage(String(e));});return()=>{live=false;};
  },[kind,id]);
  const discard=()=>!dirty||window.confirm('Kaydedilmemiş dil metni bırakılsın mı?');
  const choose=(l:PublicationLanguage)=>{if(discard()){setLang(l);adopt(pack,l);setMessage('');}};
  async function run(action:'save'|'approve'|'generate') {
    if(!bridge||!pack)return;setBusy(true);setMessage('');
    try {const next=action==='generate'?await bridge.languagesGenerate({kind:pack.kind,id:pack.id,language:lang}):await bridge.languagesSave({kind:pack.kind,id:pack.id,language:lang,data:edit,sourceHash:pack.sourceHash,revision:pack.variants[lang]?.revision||0,approved:action==='approve'});
      if(action==='generate'&&dirty){setPack(next);setMessage('AI önerisi hazır; kaydedilmemiş metniniz korundu.');}
      else {adopt(next);setMessage(action==='approve'?'Bu dil onaylandı. Yayın Merkezi üzerinden canlıya aktarılır.':action==='generate'?'AI önerisi hazır; inceleyip onaylayın.':'Dil taslağı kaydedildi.');}
      onUpdated?.();
    }catch(e){setMessage(String(e));}finally{setBusy(false);}
  }
  const comparison=pack?.variants.tr?.state==='approved'&&!pack.variants.tr.stale?pack.variants.tr.data:pack?.source;
  const sourceAt=(path:string[])=>{let value:unknown=comparison;for(const p of path)value=(value as Record<string,unknown>|undefined)?.[p];return typeof value==='string'?value:'';};
  const variant=pack?.variants[lang];
  const statusLabel=variant?.stale?'Güncelliğini yitirmiş':variant?.state==='approved'?'Onaylı':'İncelenecek';
  const body=<>
    {!id&&rows.length>0&&<select aria-label="Dil içeriği" value={selected} disabled={busy} onChange={e=>{if(discard()){setSelected(e.target.value);adopt(rows.find(r=>`${r.kind}:${r.id}`===e.target.value)||null);}}}>{rows.map(r=><option key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>{kindLabels[r.kind]} · {String(r.source.title||r.source.name||r.id)}</option>)}</select>}
    <div className="language-tabs" role="tablist" aria-label="İçerik dili">{(['tr','en'] as const).map(l=><button type="button" role="tab" aria-selected={lang===l} disabled={busy} key={l} onClick={()=>choose(l)}>{l==='tr'?'Türkçe':'İngilizce'}</button>)}</div>
    {pack?<><p>{!variant?'Bu dilde kayıt yok.':variant.stale?'Kaynak değişti. Metni güncelleyin ve yeniden onaylayın.':variant.state==='approved'?'Bu dil yayına hazır.':'Yayın için insan onayı gerekiyor.'}</p>
      {compare&&<div className="publication-compare-head"><span>{lang==='en'?'Onaylı Türkçe kaynak':'Orijinal kaynak'}</span><span>{lang==='en'?'İngilizce yayın metni':'Türkçe yayın metni'}</span></div>}
      <div className={compare?'publication-compare-fields':'publication-simple-fields'}>
      {fields(edit).map(f=><div className={compare?'publication-compare-row':'publication-language-row'} key={f.path.join('.')}>
        {compare&&<div className="publication-compare-source"><strong>{f.label}</strong><p>{sourceAt(f.path)}</p></div>}
        <label><span>{f.label}</span><textarea aria-label={f.label} rows={f.text.length>180?5:2} value={f.text} disabled={busy} onChange={e=>{setEdit(update(edit,f.path,e.target.value));setDirty(true);}}/></label>
      </div>)}
      </div>
      {variant?.stale&&<button disabled={busy} onClick={()=>{if(discard()){setEdit(structuredClone(pack.source));setDirty(true);}}}>Güncel kaynakla yeni taslak aç</button>}
      {variant?.candidate&&<button disabled={busy} onClick={()=>{if(discard()){setEdit(structuredClone(variant.candidate!));setDirty(true);}}}>AI önerisini düzenlemeye al</button>}
      {variant?.error&&<p role="alert">Üretim başarısız: {variant.error}</p>}
      <div className="language-actions"><button disabled={busy} onClick={()=>void run('generate')}>AI ile {variant?'yeniden üret':'oluştur'}</button><button disabled={busy} onClick={()=>void run('save')}>Taslağı kaydet</button><button disabled={busy} onClick={()=>void run('approve')}>Bu dili onayla</button></div>
      <small>Özel adlar ve çizim verileri korunur. Diğer dilin metni değişmez.</small></>:<p>Kaydedilmiş kaynak içerik bulunamadı.</p>}
    <p role="status">{busy?'İşleniyor…':message}</p>
  </>;
  return embedded ? <section className="publication-language-editor embedded"><header><strong>Yayın metinleri</strong><span>{statusLabel}</span></header>{body}</section>
    : <details className="publication-language-editor"><summary>Türkçe / İngilizce yayın metinleri · {statusLabel}</summary>{body}</details>;
}
