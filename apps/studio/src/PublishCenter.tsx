import {useEffect,useState} from 'react';
import {formatExportDate,publishErrorText,type LivePublicationInfo,type PublicationInfo,type PublicationPreview} from './publish-model';

type LocalExport = PublicationInfo & {publicationV2?:PublicationInfo;root?:string;uploadedAssets?:number;live:LivePublicationInfo};
type Publisher = Omit<NonNullable<typeof window.channelFoundryStudio>,"publishPublicSnapshot"|"getPublicationInfo"> & {
  publicationPreview():Promise<PublicationPreview>;
  publishPublicSnapshot(mode?:'full'|'update'):Promise<LocalExport>;
  getPublicationInfo():Promise<PublicationInfo|null>;
};
type Mode='auto'|'full'|'update';
const modeFor=(preview:PublicationPreview|null,selection:Mode):'full'|'update'=>
  selection!=='auto'?selection:!preview?.baselineAvailable||preview?.coverage?.requiresFull||!preview?.update?.ready?'full':'update';
const newCount=(value?:number)=>Number(value||0).toLocaleString('tr-TR');

export default function PublishCenter(){
 const [preview,setPreview]=useState<PublicationPreview|null>(null);
 const [info,setInfo]=useState<PublicationInfo|null>(null);
 const [project,setProject]=useState<StudioChannelProject|null>(null);
 const [communityConnected,setCommunityConnected]=useState(false);
 const [languages,setLanguages]=useState<PublicationLanguageOverview|null>(null);
 const [modeOverride,setModeOverride]=useState<Mode>('auto');
 const [strictBilingual,setStrictBilingual]=useState(false);
 const [live,setLive]=useState<LivePublicationInfo|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const bridge=window.channelFoundryStudio as Publisher|undefined;
 const refresh=async()=>{
  if(!bridge)return;
  const [next,publication,session,projects,languageOverview]=await Promise.all([
    bridge.publicationPreview(),bridge.getPublicationInfo(),bridge.communitySession(),bridge.channelProjects(),bridge.languagesOverview(),
  ]);
  setPreview(next);setInfo(publication);setCommunityConnected(Boolean(session?.connected));
  setProject(projects.projects.find(entry=>entry.id===projects.activeId)??null);
  setLanguages(languageOverview);
 };
 useEffect(()=>{
  let active=true;
  void refresh().catch(reason=>{if(active)setError(publishErrorText(reason));}).finally(()=>{if(active)setLoading(false);});
  const off=bridge?.onDataChanged?.(()=>{if(active&&!busy)void refresh().catch(()=>undefined);});
  return()=>{active=false;off?.();};
 },[bridge,busy]);
 const mode=modeFor(preview,modeOverride);
 const full=mode==='full';
 const ready=Boolean(full?preview?.readiness?.readyForTheme:preview?.update?.ready);
 const languageReady=Boolean(languages&&languages.rows.length===languages.counts.ready);
 const allowPublish=Boolean(project?.deploymentEnabled&&communityConnected&&ready&&preview?.changed&&!busy&&(!strictBilingual||languageReady));
 const counts=preview?.counts??{sections:0,entities:0,relations:0,assets:0,vefks:0};
 const coverage=preview?.coverage;
 const reasons:string[]=[];
 if(!project?.deploymentEnabled)reasons.push('Web yayını Ayarlar bölümünde henüz etkinleştirilmemiş.');
 if(!communityConnected)reasons.push('Topluluk yönetici bağlantısı gerekli.');
 if(full&&preview?.readiness?.narrativeSections===0)reasons.push('Onaylı anlatı bölümü bulunamadı.');
 if(full&&preview?.readiness?.narrativeChangesPending)reasons.push('Onaylı evren değişiklikleri anlatıya henüz işlenmemiş.');
 if(full&&preview?.readiness&&!preview.readiness.visualComplete)reasons.push('Görsel tamamlama kararları bekliyor.');
 if(!full&&!preview?.update?.ready)reasons.push('Mevcut canlı kayıtlarda güncellenebilir değişiklik yok.');
 if(strictBilingual&&!languageReady)reasons.push('TR ve EN onayı eksik kayıtlar var.');
 if(preview&&!preview.changed)reasons.push('Yerel içerik ve canlı yayın eşleşiyor.');
 async function publish(){
  if(!bridge||busy||!allowPublish)return;
  setBusy(true);setError('');
  try{
   const [latest,session,currentLanguages]=await Promise.all([bridge.publicationPreview(),bridge.communitySession(),bridge.languagesOverview()]);
   setPreview(latest);setLanguages(currentLanguages);setCommunityConnected(Boolean(session?.connected));
   const actualMode=modeFor(latest,modeOverride);
   if(!session.connected)throw new Error('Topluluk yönetici bağlantısı kapalı.');
   if(!latest.changed)throw new Error('Yayınlanacak değişiklik bulunmuyor.');
   if(actualMode==='full'&&!latest.readiness.readyForTheme)throw new Error('Tam yayın hazırlığı tamamlanmadan canlı yayın yapılamaz.');
   if(actualMode==='update'&&!latest.update?.ready)throw new Error(latest.liveError||'Güvenli güncelleme için canlı karşılaştırması gerekli.');
   if(strictBilingual&&currentLanguages.counts.ready!==currentLanguages.rows.length)throw new Error('Her iki dilde onaylanmamış kayıtlar var.');
   if(actualMode==='update'&&latest.coverage?.requiresFull&&!window.confirm('Yeni kayıt, destek veya çizim değişiklikleri mevcut. Güncelleme modu bunları CANLIYA EKLEMEZ. Yalnız mevcut kayıtlar güncellensin mi?'))return;
   const newRecords=(latest.coverage?.newEntities??0)+(latest.coverage?.newSections??0)+(latest.coverage?.newVideos??0);
   const message=actualMode==='full'
    ?`Tam yayında ${latest.counts.sections} anlatı, ${latest.counts.entities} evren kaydı, ${latest.counts.assets} görsel ve ${latest.counts.vefks} çizim siteye aktarılacak.${newRecords?` ${newRecords} yeni kayıt bulunuyor.`:''} Devam edilsin mi?`
    :`Mevcut canlı kayıtlardaki ${latest.update?.changes.updated??0} değişiklik ve ${latest.update?.changes.images??0} görsel güncellemesi aktarılsın mı?`;
   if(!window.confirm(message))return;
   // Packaging is deliberately internal: the runtime builds and validates the
   // publication automatically before uploading hashed assets and atomic manifest.
   const result=await bridge.publishPublicSnapshot(actualMode);
   const saved=result.publicationV2??result;
   setInfo(saved);setLive(result.live);
   await refresh();
  }catch(reason){setError(publishErrorText(reason));}
  finally{setBusy(false);}
 }
 const refreshNow=async()=>{if(busy)return;setLoading(true);setError('');try{await refresh();}catch(reason){setError(publishErrorText(reason));}finally{setLoading(false);}};
 const reveal=async()=>{try{await bridge?.showPublicExport();}catch(reason){setError(publishErrorText(reason));}};
 return <section className="publish-center publish-v3" data-testid="publish-v3">
  <header className="publish-v3-heading"><div><small>YAYIN MERKEZİ · PUBLICATION V2</small><h2>Evren yayını</h2><p>Anlatı, görseller ve seçili çizimler tek yayın hattından aktarılır. Sahne efektleri ayrı yayınlanır.</p></div><button disabled={busy||loading} onClick={()=>void refreshNow()}>{loading?'Kontrol ediliyor…':'Durumu yenile'}</button></header>
  <div className="publish-v3-body">
   <main className="publish-v3-main">
    <div className="publish-v3-section-head"><strong>YEREL / CANLI KARŞILAŞTIRMASI</strong><span>{preview?.changed?'Yayın değişikliği var':'Güncel'}</span></div>
    <div className="publish-v3-groups">
     <article><span>01 · EVREN</span><strong>{newCount(counts.sections)} anlatı</strong><small>{newCount(counts.entities)} kayıt · {newCount(counts.relations)} ilişki</small>{Boolean(coverage?.newSections||coverage?.newEntities||coverage?.newRelations)&&<p>{(coverage?.newSections??0)+(coverage?.newEntities??0)+(coverage?.newRelations??0)} yeni içerik</p>}</article>
     <article><span>02 · GÖRSELLER</span><strong>{newCount(counts.assets)} görsel</strong><small>{preview?.update?.changes.images??0} değişen · {preview?.update?.changes.assetUploads??0} yüklenecek</small></article>
     <article><span>03 · ÇİZİMLER</span><strong>{newCount(counts.vefks)} seçili</strong><small>{coverage?.drawingsChanged?'Katalog veya revizyon değişmiş':'Yayın kataloğu'}</small></article>
    </div>
    <section className="publish-v3-checks"><header><strong>Yayın öncesi kontrol</strong><small>Otomatik doğrulama</small></header>
     <div className="publish-v3-check-row"><span className={preview?.changed?'is-pending':'is-ready'}>{preview?.changed?'●':'✓'}</span>Yerel içerik ile canlı paket {preview?.changed?'farklı':'eşleşiyor'}</div>
     <div className="publish-v3-check-row"><span className={ready?'is-ready':'is-pending'}>{ready?'✓':'●'}</span>{full?'Tam yayın hazırlığı':'Güvenli içerik/görsel güncellemesi'} {ready?'hazır':'kontrol bekliyor'}</div>
     <div className="publish-v3-check-row"><span className={communityConnected&&project?.deploymentEnabled?'is-ready':'is-pending'}>{communityConnected&&project?.deploymentEnabled?'✓':'●'}</span>Canlı sunucu ve yönetici bağlantısı</div>
     <div className="publish-v3-check-row"><span className={languageReady?'is-ready':'is-pending'}>{languageReady?'✓':'●'}</span>TR/EN yayın metinleri <small>{languages?.counts.ready??0} / {languages?.rows.length??0} iki dil onaylı</small></div>
     {!!coverage?.reasons.length&&<div className="publish-v3-recommendation"><strong>Tam yayın öneriliyor</strong><p>{coverage.reasons.join(' · ')}</p></div>}
     {reasons.length>0&&<div className="publish-v3-blockers">{reasons.map(reason=><p key={reason}>{reason}</p>)}</div>}
     {error&&<p className="publish-v3-error" role="alert">{error}</p>}
    </section>
    <div className="publish-v3-run"><div><strong>{modeOverride==='auto'?'Sistemin önerdiği yöntem': 'Elle seçilen yöntem'}: {full?'Tam yayın':'Güvenli güncelleme'}</strong><p>{full?'Yeni kayıtlar, görseller ve çizim kataloğu birlikte aktarılır.':'Canlıda bulunan kayıtlar korunarak yalnız güvenli değişiklikler işlenir.'}</p></div><button className="primary-button" disabled={!allowPublish} onClick={()=>void publish()}>{busy?'Paketleniyor ve yayınlanıyor…':full?'Tam yayını başlat':'Değişiklikleri yayınla'}</button></div>
    <details className="publish-v3-options"><summary>Yayın tercihleri</summary><div><label>Yayın yöntemi<select aria-label="Yayın yöntemi" value={modeOverride} onChange={event=>setModeOverride(event.target.value as Mode)}><option value="auto">Otomatik seç (önerilen)</option><option value="full">Tam yayın</option><option value="update">Yalnız mevcut kayıtları güncelle</option></select></label><label className="publish-v3-checkbox"><input type="checkbox" checked={strictBilingual} onChange={event=>setStrictBilingual(event.target.checked)}/>İki dil tam onaylı olmadan yayınlamayı engelle</label></div><p>Güncelleme yeni hikâye, çizim veya destek kaydı eklemez. Gerekiyorsa tam yayın kullanılır.</p></details>
   </main>
   <aside className="publish-v3-side">
    <section><div className="publish-v3-section-head"><strong>CANLI YAYIN</strong><span className={communityConnected&&project?.deploymentEnabled?'is-ready':'is-pending'}>{communityConnected&&project?.deploymentEnabled?'Bağlı':'Bağlantı gerekli'}</span></div><h3>{live?'Yayın doğrulandı':preview?.baseline?'Mevcut yayın':'Henüz canlı yayın yok'}</h3><p>{project?.webUrl??'Web hedefi tanımlanmadı'}</p><div className="publish-v3-stamp"><small>SON CANLI YAYIN</small><strong>{live?.generatedAt||preview?.baseline?.generatedAt?formatExportDate(live?.generatedAt??preview?.baseline?.generatedAt??''):'—'}</strong></div><div className="publish-v3-stamp"><small>CANLI / YEREL</small><strong>{preview?.changed?'Farklı paketler':'Aynı içerik'}</strong></div></section>
    <details className="publish-v3-history"><summary>Yayın geçmişi ve teknik ayrıntılar</summary><div><p>Son yerel paket: {info?.generatedAt?formatExportDate(info.generatedAt):'Yok'}</p><p>Publication ID: {info?.publicationId??'—'}</p><p>Fingerprint: {info?.contentFingerprint??'—'}</p><p>Dosya: {info?.file??'—'}</p>{info?.file&&<button onClick={()=>void reveal()}>Paketi klasörde göster</button>}</div></details>
    <p className="publish-v3-privacy">Paket, yalnızca yayın komutu verildiğinde otomatik hazırlanır. Dosyalar önce yüklenir, ardından yayın manifesti doğrulanarak etkinleştirilir.</p>
   </aside>
  </div>
 </section>;
}
