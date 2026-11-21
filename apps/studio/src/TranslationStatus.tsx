import './publication-languages.css';
export default function TranslationStatus({onNavigate,counts,onlyVideoMissing}:{onNavigate:(section:'Kayıt Dosyaları')=>void;counts:PublicationLanguageOverview['counts']|null;onlyVideoMissing:boolean}) {
  // Dashboard receives just five numbers; the full editor owns the 30MB row list.
  const labels={ready:'İki dilde hazır içerik',missing:onlyVideoMissing?'Kamera · İngilizce özet bekliyor':'İngilizce eksik içerik',pending:'Onay bekleyen çeviri',stale:'Güncelliğini yitirmiş',errors:'Üretim hatası'};
  return <section className="panel translation-status"><h3>Çeviri Durumu</h3><div>{Object.entries(labels).map(([key,label])=><button key={key} onClick={()=>{sessionStorage.setItem('studio-language-filter',key);onNavigate('Kayıt Dosyaları');}}><strong>{counts?.[key as keyof typeof labels]??'—'}</strong><span>{label}</span></button>)}</div></section>;
}
