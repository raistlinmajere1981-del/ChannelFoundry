import { useEffect, useState } from "react";
const show=(n:number)=>new Intl.NumberFormat("tr-TR").format(n);
export default function SitePulse({onNavigate,onAnalytics}:{onNavigate:(target:"Ayarlar")=>void;onAnalytics:()=>void}) {
  const [analytics,setAnalytics]=useState<StudioWebsiteInsights|null>(null);
  const [seo,setSeo]=useState<StudioSeoOverview|null>(null);
  const [offline,setOffline]=useState(false);
  const [seoState,setSeoState]=useState<"loading"|"ready"|"error">("loading");
  useEffect(()=>{
    let live=true;
    void window.channelFoundryStudio?.analyticsSummary(7).then(value=>{if(live)setAnalytics(value);})
      .catch(()=>{if(live)setOffline(true);});
    const seoRequest=window.channelFoundryStudio?.seoOverview();
    if(!seoRequest){setSeoState("error");}
    else void seoRequest.then(value=>{if(live){setSeo(value);setSeoState("ready");}})
      .catch(()=>{if(live)setSeoState("error");});
    return ()=>{live=false;};
  },[]);
  const go=(tab:"seo")=>{
    sessionStorage.setItem("studio:settings-tab",tab);
    onNavigate("Ayarlar");
  };
  const areas=analytics?.areas??[];
  const most=[...areas].sort((a,b)=>b.seconds-a.seconds)[0];
  const labels:Record<string,string>={evren:"Evren Kitabı",topluluk:"Topluluk",kamera:"Kamera",vefk:"Vefk Atölyesi"};
  return <section className="panel ops-recent-panel site-pulse-panel">
    <div className="ops-section-head"><div><h3>Site performansı</h3></div><button type="button" onClick={onAnalytics}>Ayrıntılar →</button></div>
    <div className="site-pulse-metrics">
      <button onClick={onAnalytics}><small>Son 7 gün · ziyaret oturumu</small><strong>{analytics?show(analytics.visits):"—"}</strong></button>
      <button onClick={onAnalytics}><small>Toplam aktif süre</small><strong>{analytics?`${Math.round(analytics.activeSeconds/60)} dk`:"—"}</strong></button>
    </div>
    <div className="site-pulse-line"><span>En çok vakit geçirilen alan</span><strong>{most?labels[most.area]??most.area:offline?"Sunucu güncellemesi bekliyor":"Henüz veri yok"}</strong></div>
    <div className="site-pulse-seo">
      <div><strong>SEO kontrolü</strong><small role="status">{seoState==="loading"?"SEO denetleniyor…":seoState==="error"?"SEO kontrolü başarısız · SEO Atölyesi'nden yeniden dene":seo?.draftCount?`${seo.rows.length} sayfa · ${seo.draftCount} kayıt incelenecek`:`${seo?.rows.length??0} sayfa · tamamı onaylı`}</small></div>
      <button onClick={()=>go("seo")}>SEO Atölyesi →</button>
    </div>
    <p className="site-pulse-note">Arama motoru görünürlüğü SEO Atölyesi'nden yönetilir. Ziyaretçi analitiği anonimdir.</p>
  </section>;
}
