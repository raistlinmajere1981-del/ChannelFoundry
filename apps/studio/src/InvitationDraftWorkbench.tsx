import { useEffect, useState } from "react";
import "./invitation-draft-workbench.css";

type Bridge = NonNullable<typeof window.channelFoundryStudio> & StudioNarrativeBridge;
type Feedback = (message: string, tone: "success" | "error") => void;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

const states: Record<StudioInvitationDraftItem["state"], string> = {
  unstarted:"Kaynak hazır",
  generated:"AI taslağı",
  edited:"Düzenlenmiş taslak",
  stale:"Kaynak güncellendi",
  reviewed:"İncelendi",
  imported:"Kitapta",
  missing:"Doğrudan kayıt yok",
};

export default function InvitationDraftWorkbench({ bridge, notify }: { bridge: Bridge; notify: Feedback }) {
  const [items,setItems] = useState<StudioInvitationDraftItem[]>([]);
  const [selected,setSelected] = useState(1);
  const [detail,setDetail] = useState<StudioInvitationDraftDetail|null>(null);
  const [busy,setBusy] = useState("");
  const [title,setTitle] = useState("");
  const [body,setBody] = useState("");
  const [reviewNotes,setReviewNotes] = useState<string[]>([]);
  const [loadError,setLoadError] = useState("");
  const updateItems = async () => setItems(await bridge.invitationDraftsList());
  const updateDetail = async (num: number) => {
    const result = await bridge.invitationDraftsDetail(num);
    setDetail(result);
    setTitle(result.draft?.title ?? "");
    setBody(result.draft?.body ?? "");
    setReviewNotes([]);
  };
  useEffect(() => {
    let active=true;
    setBusy("loading");
    Promise.all([bridge.invitationDraftsList(),bridge.invitationDraftsDetail(selected)])
      .then(([list,record]) => {
        if(!active)return;
        setItems(list);setDetail(record);
        setTitle(record.draft?.title??"");setBody(record.draft?.body??"");
        setLoadError("");
      })
      .catch(err=>{if(active)setLoadError(message(err));})
      .finally(()=>{if(active)setBusy("");});
    return () => {active=false;};
  },[bridge,selected]);

  const generate = async () => {
    if(!detail || busy || detail.imported || detail.draft && !detail.stale)return;
    setBusy("generate");
    try {
      const result=await bridge.invitationDraftsGenerate(selected);
      await Promise.all([updateItems(),updateDetail(selected)]);
      setReviewNotes(result.reviewNotes);
      notify(String(selected)+". davet için ayrı kaynaklı taslak oluşturuldu. Henüz kitap belleğine aktarılmadı.", "success");
    } catch(err){notify(message(err),"error");}
    finally{setBusy("");}
  };
  const save = async () => {
    if(!detail?.draft || detail.stale || detail.imported || busy)return;
    setBusy("save");
    try {
      await bridge.invitationDraftsUpdate({number:selected,title,body});
      await Promise.all([updateItems(),updateDetail(selected)]);
      notify(String(selected)+". davet düzenlemesi kaydedildi. Kitap belleği değişmedi.","success");
    }catch(err){notify(message(err),"error");}
    finally{setBusy("");}
  };
  const markReviewed = async (reviewed: boolean) => {
    if (!detail?.draft || detail.stale || detail.imported || busy || dirty) return;
    if (reviewed && !window.confirm("Bu davetin kaynak videosu, belirsizlik notları ve anlatı metnini inceledin mi? İncelendi işareti kitabı yayınlamaz.")) return;
    setBusy("review");
    try {
      await bridge.invitationDraftsReview({number:selected,reviewed});
      await Promise.all([updateItems(),updateDetail(selected)]);
      notify(reviewed ? String(selected)+". davet incelendi olarak işaretlendi. Henüz kitaba aktarılmadı." :
        String(selected)+". davetin inceleme işareti kaldırıldı.","success");
    }catch(err){notify(message(err),"error");}
    finally{setBusy("");}
  };
  const dirty=Boolean(detail?.draft) && (title!==detail?.draft?.title || body!==detail?.draft?.body);
  return <div className="invitation-draft-workbench">
    <section className="panel invitation-draft-header">
      <div>
        <small>KAYNAK SINIRLI HİKÂYELEŞTİRME · 1–68 DAVET</small>
        <h3>Düğümlü Kitap — davet kaynakları ve bölümler</h3>
        <p>Her davet kendi özgün Türkçe altyazısından hazırlanır. Onaylanmadan önce bağımsız taslaktır; onaylanan davetler Evren kitabında sürümlü anlatı olarak korunur.</p>
      </div>
      <span>{items.filter(item=>item.state==="imported").length} kitapta · {items.filter(item=>item.state==="missing").length} kayıt eksik</span>
    </section>
    {loadError && <p className="invitation-draft-warning" role="alert">{loadError}</p>}
    <div className="invitation-draft-layout">
      <nav className="panel invitation-draft-nav" aria-label="Davet kaynak paketleri">
        {items.map(item=><button key={item.number} type="button" disabled={Boolean(busy)||item.state==="missing"}
          className={item.number===selected?"selected":""} aria-current={item.number===selected?"step":undefined}
          onClick={()=>{if(dirty && !window.confirm("Kaydedilmemiş değişiklikler var. Bu davetten çıkılsın mı?"))return;setSelected(item.number);}}>
          <b>{item.number}. Davet</b>
          <small>{states[item.state]}</small>
        </button>)}
      </nav>
      <section className="panel invitation-draft-detail">
        {!detail ? <p>Kaynak paketi yükleniyor…</p> : <>
          <header>
            <div><small>{detail.publishedAt} · video yayın tarihi, olay tarihi değil</small>
              <h3>{detail.number}. Davet — {detail.title.replace(/^\d{1,2}\.\s*(?:Düğümlü Kitap\s*)?Davet(?:i|inde|li)?[:\s]*/iu,"")}</h3></div>
            <div className="invitation-source-links">
              {detail.sourceVideoIds.map((videoId,index)=><a key={videoId} href={"https://www.youtube.com/watch?v="+videoId} target="_blank" rel="noopener noreferrer">
                {detail.sourceVideoIds.length===1?"Kaynak video":(index+1)+". kaynak video"}</a>)}
            </div>
          </header>
          <p className="invitation-draft-lead">{detail.summary}</p>
          <details><summary>Çözümlemenin olay sırası · {detail.storyBeats.length} kayıt</summary>
            <ol>{detail.storyBeats.map((entry,index)=><li key={index}>{entry}</li>)}</ol>
          </details>
          <details><summary>Kaynak belirsizlikleri · {detail.storyHints.length} not</summary>
            <ul>{detail.storyHints.map((entry,index)=><li key={index}>{entry}</li>)}</ul>
          </details>
          <details><summary>Özgün kaynak altyazı ({detail.sourceLanguages.join(" + ").toUpperCase()}) · {detail.originalSubtitle.length.toLocaleString("tr-TR")} karakter</summary>
            <pre className="invitation-draft-subtitle">{detail.originalSubtitle}</pre>
          </details>
          <div className="invitation-draft-edit-head">
            <div><small>{detail.imported?"ONAYLI · EVREN KİTABINDA":"AYRI TASLAK · YAYINLANMAZ"}</small>
              <h4>{detail.imported?"Kitaba aktarılan anlatı":detail.draft ? (detail.stale?"Kaynak yenilenmiş, taslak eski":"Anlatı taslağı"): "Henüz anlatı taslağı yok"}</h4></div>
            {!detail.imported && (!detail.draft || detail.stale)
              ? <button className="primary-button" type="button" disabled={Boolean(busy)}
                  onClick={()=>void generate()}>{busy==="generate"?"Üretiliyor…":"Bu davetin taslağını üret"}</button>
              : <span>{detail.draft?.model||"Kaynak düzenlemesi"}</span>}
          </div>
          {detail.stale && <p className="invitation-draft-warning">Altyazı veya çözümleme değişmiş. Eski taslak gözden geçirilemez; güncel kaynakla yeniden üretilebilir.</p>}
          {(reviewNotes.length>0 || (detail.draft?.reviewNotes?.length??0)>0) && <div className="invitation-draft-review"><strong>AI'nin editoryal kontrol notları</strong>
            <ul>{(reviewNotes.length ? reviewNotes : detail.draft?.reviewNotes ?? []).map((note,index)=><li key={index}>{note}</li>)}</ul></div>}
          {detail.draft && <>
            <label>Kitap bölümü başlığı · davet numarası ayrı gösterilir
              <input value={title} disabled={Boolean(busy)||detail.stale||detail.imported} maxLength={190}
                onChange={event=>setTitle(event.target.value)}/></label>
            <label>Anlatı metni
              <textarea value={body} disabled={Boolean(busy)||detail.stale||detail.imported} rows={16}
                onChange={event=>setBody(event.target.value)}/></label>
            {detail.imported && <p className="invitation-draft-review">Bu anlatı Evren kitabında onaylıdır. Yeni düzeltmeler, mevcut bölümü sessizce değiştirmek yerine ayrı bir revizyonla yapılmalıdır.</p>}
            {!detail.imported && <div className="invitation-draft-footer">
              <small>{detail.draft.reviewed?"Kaynak kontrolü incelendi olarak işaretli" :
                detail.draft.state==="edited"?"Elle düzenlenmiş":"AI taslağı"} · kaydedildi: {detail.draft.updatedAt}</small>
              <div className="invitation-draft-footer-buttons">
                <button type="button" className="secondary-button" disabled={Boolean(busy)||!dirty||detail.stale}
                  onClick={()=>void save()}>{busy==="save"?"Kaydediliyor…":"Taslak değişikliklerini kaydet"}</button>
                <button type="button" className="secondary-button"
                  disabled={Boolean(busy)||dirty||detail.stale}
                  onClick={()=>void markReviewed(!detail.draft!.reviewed)}>
                  {detail.draft.reviewed?"İncelendi işaretini kaldır":"İnceledim · işaretle"}
                </button>
              </div>
            </div>}
          </>}
          {!detail.imported && <p className="invitation-draft-warning">Bu çalışma alanında onay / yayınlama düğmesi bulunmaz. Kaynaklar onaylanmadan taslaklar mevcut Evren anlatılarına aktarılmaz.</p>}
        </>}
      </section>
    </div>
  </div>;
}
