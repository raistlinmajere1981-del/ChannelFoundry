import { useEffect, useState } from "react";
import { useAiWorkbenchNotice } from "./AiWorkbenchStatus";
import "./narrative-outline.css";

type Bridge = NonNullable<typeof window.channelFoundryStudio> & StudioNarrativeBridge;
const errorText = (value: unknown) => value instanceof Error ? value.message : String(value);

export default function NarrativeOutlineWorkbench({ memory }: { memory: StudioNarrativeSectionRevision[] }) {
  const bridge = window.channelFoundryStudio as Bridge | undefined;
  const notify = useAiWorkbenchNotice();
  const [catalog, setCatalog] = useState<StudioNarrativeOutlineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [seriesKey, setSeriesKey] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesDescription, setSeriesDescription] = useState("");
  const [chapterKey, setChapterKey] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [numberLabel, setNumberLabel] = useState("");
  const [seriesPosition, setSeriesPosition] = useState(0);
  const [chapterPosition, setChapterPosition] = useState(0);
  const [suggestions, setSuggestions] = useState<StudioNarrativeOutlineSuggestion[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [proposal, setProposal] = useState<StudioNarrativeOutlineSuggestion | null>(null);

  const load = async () => {
    if (!bridge) return;
    const next = await bridge.narrativeOutlineStatus();
    setCatalog(next);
  };
  useEffect(() => {
    void load().catch((error) => notify(errorText(error), "error"));
    return bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
  }, []);

  const execute = async (action: () => Promise<unknown>, message: string) => {
    if (busy) return;
    setBusy(true);
    try { await action(); await load(); notify(message, "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };

  const chooseSeries = (key: string) => {
    const entry = catalog?.series.find((item) => item.key === key);
    setSeriesKey(key);
    setSeriesTitle(entry?.title ?? "");
    setSeriesDescription(entry?.description ?? "");
    setSeriesPosition(entry?.position ?? (catalog?.series.length ?? 0));
    setChapterPosition(0);
    setChapterKey("");
    setChapterTitle("");
    setNumberLabel("");
  };

  const chooseChapter = (key: string) => {
    const entry = catalog?.chapters.find((item) => item.key === key);
    setChapterKey(key);
    setChapterTitle(entry?.title ?? "");
    setNumberLabel(entry?.numberLabel ?? "");
    setChapterPosition(entry?.position ?? (catalog?.chapters.filter(item => item.seriesKey === seriesKey).length ?? 0));
  };

  const chapters = (catalog?.chapters ?? []).filter((entry) => entry.seriesKey === seriesKey);
  const placement = new Map((catalog?.assignments ?? []).map((entry) => [entry.sectionKey, entry.chapterKey]));
  // One shared video is not enough: an anı spanning two different invitations
  // must never be silently placed in the first matching chapter.
  const proposalVideoIds = new Set((proposal?.videos ?? []).map((video) => video.videoId));
  const proposalMemories = memory.filter((section) => section.sourceVideoIds?.length && section.sourceVideoIds.every((id) => proposalVideoIds.has(id)));
  const ambiguousMemories = memory.filter((section) => section.sourceVideoIds?.some((id) => proposalVideoIds.has(id)) && !section.sourceVideoIds.every((id) => proposalVideoIds.has(id)));

  if (!bridge) return null;
  return <section className="panel narrative-outline">
    <header className="narrative-section-head">
      <div><small>GÜNLÜK DÜZENİ</small><h3>İçindekiler</h3></div>
      <span>{catalog?.series.length ?? 0} dizi · {catalog?.chapters.length ?? 0} alt bölüm</span>
    </header>
    <p className="narrative-outline-intro">Anlatı dizilerini, alt bölümleri ve onaylı anıların yerleşimini düzenle. Kalıcı anlatıcı tercihleri Ayarlar → Kanal Ayarları bölümündedir.</p>

    <details open={editorOpen} onToggle={event => setEditorOpen(event.currentTarget.open)}>
      <summary>Dizileri ve alt bölümleri düzenle</summary>
      <div className="narrative-outline-fields">
        <label>Dizi
          <select value={seriesKey} onChange={(event) => chooseSeries(event.target.value)}>
            <option value="">Yeni dizi oluştur</option>
            {(catalog?.series ?? []).map((entry) => <option key={entry.key} value={entry.key}>{entry.title}</option>)}
          </select>
        </label>
        <label>Dizi adı<input value={seriesTitle} onChange={(event) => setSeriesTitle(event.target.value)} maxLength={220} placeholder="Örn. Düğümlü Kitap" /></label>
        <label className="wide">Dizi açıklaması<input value={seriesDescription} onChange={(event) => setSeriesDescription(event.target.value)} maxLength={1200} placeholder="İsteğe bağlı" /></label>
        <label>Dizi sırası<input type="number" min={0} max={1000000} value={seriesPosition} onChange={event => setSeriesPosition(Number(event.target.value))} /></label>
        <button className="secondary-button" disabled={busy || !seriesTitle.trim()} onClick={() => void execute(async () => {
          const saved = await bridge.narrativeOutlineSaveSeries({ ...(seriesKey ? { key: seriesKey } : {}), title: seriesTitle, description: seriesDescription, position: seriesPosition });
          setSeriesKey(saved.key);
          setSeriesTitle(saved.title);
          setSeriesDescription(saved.description);
        }, "Anlatı dizisi kaydedildi.")}>Diziyi kaydet</button>
      </div>
      {seriesKey && <div className="narrative-outline-fields chapter-editor">
        <label>Alt bölüm
          <select value={chapterKey} onChange={(event) => chooseChapter(event.target.value)}>
            <option value="">Yeni alt bölüm</option>
            {chapters.map((entry) => <option key={entry.key} value={entry.key}>{entry.numberLabel ? `${entry.numberLabel} · ` : ""}{entry.title}</option>)}
          </select>
        </label>
        <label>Bölüm adı<input value={chapterTitle} maxLength={220} onChange={(event) => setChapterTitle(event.target.value)} placeholder="Örn. Mezna'dan gelen kutu" /></label>
        <label>Numara / etiket<input value={numberLabel} maxLength={90} onChange={(event) => setNumberLabel(event.target.value)} placeholder="Örn. 68. Davet" /></label>
        <label>Bölüm sırası<input type="number" min={0} max={1000000} value={chapterPosition} onChange={event => setChapterPosition(Number(event.target.value))} /></label>
        <button className="secondary-button" disabled={busy || !chapterTitle.trim()} onClick={() => void execute(async () => {
          const saved = await bridge.narrativeOutlineSaveChapter({ ...(chapterKey ? { key: chapterKey } : {}), seriesKey, title: chapterTitle, numberLabel, position: chapterPosition });
          setChapterKey(saved.key);
          setChapterTitle(saved.title);
          setNumberLabel(saved.numberLabel);
        }, "Alt bölüm kaydedildi.")}>Alt bölümü kaydet</button>
      </div>}
    </details>

    <details>
      <summary>Video başlıklarından bölüm önerileri</summary>
      <p className="narrative-outline-intro">Başlıklar yalnız dizi ve bölüm adayıdır; olay veya deneyim kanıtı değildir. Aynı bölümün farklı videoları kimlikleriyle birlikte tutulur. Düzenlemeye aldığın öneriyi aşağıdaki kaydet adımlarıyla onaylarsın; yayın onayı ayrıca korunur.</p>
      <button className="secondary-button" disabled={busy} onClick={() => void execute(async () => {
        setSuggestions(await bridge.narrativeOutlineSuggestions());
      }, "Başlık önerileri hazır. Hiçbir içerik değiştirilmedi.")}>Önerileri getir</button>
      {suggestions.map(item => <div className="narrative-outline-proposal" key={item.key}>
        <strong>{item.seriesTitle} / {item.numberLabel}</strong>
        <ul>{item.videos.map(video => <li key={video.videoId}>{video.title} <small>({video.videoId})</small></li>)}</ul>
        <button className="secondary-button" disabled={busy} onClick={() => {
          chooseSeries(item.seriesKey ?? "");
          setSeriesTitle(item.seriesTitle);
          setChapterKey(item.chapterKey ?? ""); setChapterTitle(item.chapterTitle); setNumberLabel(item.numberLabel);
          setChapterPosition(item.chapterKey ? (catalog?.chapters.find(ch => ch.key === item.chapterKey)?.position ?? 0) : (catalog?.chapters.filter(ch => ch.seriesKey === item.seriesKey).length ?? 0));
          setProposal(item); setEditorOpen(true);
        }}>Düzenlemeye al</button>
      </div>)}
    </details>

    {proposal && seriesKey && chapterKey && <div className="narrative-outline-proposal">
      <strong>Kaynak videolarıyla eşleşen onaylı anılar</strong>
      <p>{proposalMemories.map((section) => section.title).join(' · ') || 'Güvenli biçimde eşleşen onaylı anı yok.'}</p>
      {ambiguousMemories.length > 0 && <p>Birden fazla bölüme ait kaynaklar: {ambiguousMemories.map((section) => section.title).join(' · ')}. Bunları elle yerleştir; otomatik eşleştirmeye dahil edilmeyecek.</p>}
      <button className="secondary-button" disabled={busy || proposalMemories.length === 0} onClick={() => void execute(async () => {
        for (const [position, section] of proposalMemories.entries()) await bridge.narrativeOutlinePlaceSection({ sectionKey: section.sectionKey, chapterKey, position });
        setProposal(null);
      }, "Kaynakları eşleşen onaylı anılar seçili bölüme bağlandı.")}>Eşleşen anıları seçili bölüme bağla</button>
    </div>}

    <div className="narrative-outline-placements">
      <strong>Onaylı anıların içindekiler konumu</strong>
      {memory.length === 0 ? <p>Henüz onaylı günlük anısı yok. Dizi ve bölüm başlıkları hazırlanabilir; yayın yalnız gerçek onaylı bölümleri gösterir.</p> :
        memory.map((section) => <label key={section.sectionKey} className="narrative-outline-placement">
          <span>{section.title}</span>
          <select disabled={busy} aria-label={`${section.title} için bölüm seç`} value={placement.get(section.sectionKey) ?? ""} onChange={(event) => void execute(
            () => bridge.narrativeOutlinePlaceSection({ sectionKey: section.sectionKey, chapterKey: event.target.value || null }),
            "Anının içindekiler konumu güncellendi.",
          )}>
            <option value="">Bağımsız anı</option>
            {(catalog?.series ?? []).flatMap((series) => (catalog?.chapters ?? []).filter((entry) => entry.seriesKey === series.key).map((entry) => <option key={entry.key} value={entry.key}>{series.title} / {entry.numberLabel ? `${entry.numberLabel} · ` : ""}{entry.title}</option>))}
          </select>
          {placement.has(section.sectionKey) && <input type="number" min={0} max={1000000} disabled={busy}
            aria-label={`${section.title} için bölüm içi sıra`}
            defaultValue={catalog?.assignments.find(item => item.sectionKey === section.sectionKey)?.position ?? 0}
            key={`${section.sectionKey}-${catalog?.assignments.find(item => item.sectionKey === section.sectionKey)?.position}`}
            onBlur={event => { const position = Number(event.target.value);
              if (position !== catalog?.assignments.find(item => item.sectionKey === section.sectionKey)?.position) void execute(
                () => bridge.narrativeOutlinePlaceSection({ sectionKey: section.sectionKey, chapterKey: placement.get(section.sectionKey)!, position }), "Anı sırası kaydedildi."); }} />}
        </label>)}
    </div>
  </section>;
}
