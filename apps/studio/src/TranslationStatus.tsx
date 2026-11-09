import {useEffect,useState} from 'react';
import './publication-languages.css';
export default function TranslationStatus({onNavigate}:{onNavigate:(section:'Yayınlama')=>void}) {
  const [counts,setCounts]=useState<PublicationLanguageOverview['counts']|null>(null);
  useEffect(()=>{const bridge=window.channelFoundryStudio;let live=true;const load=()=>void bridge?.languagesOverview().then(d=>{if(live)setCounts(d.counts);}).catch(()=>{});load();const off=bridge?.onDataChanged(load);return()=>{live=false;off?.();};},[]);
  const labels={ready:'İki dilde hazır içerik',missing:'İngilizce eksik içerik',pending:'Onay bekleyen çeviri',stale:'Güncelliğini yitirmiş',errors:'Üretim hatası'};
  return <section className="panel translation-status"><h3>Çeviri Durumu</h3><div>{Object.entries(labels).map(([key,label])=><button key={key} onClick={()=>{sessionStorage.setItem('studio-language-filter',key);onNavigate('Yayınlama');}}><strong>{counts?.[key as keyof typeof labels]??'—'}</strong><span>{label}</span></button>)}</div></section>;
}
