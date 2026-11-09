import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useAiWorkbenchNotice } from "./AiWorkbenchStatus";
import "./narrative-outline.css";

type Bridge = NonNullable<typeof window.channelFoundryStudio> & StudioNarrativeBridge;
type TreeKind = "series" | "chapter" | "section";
type TreeDrag = { kind: TreeKind; key: string };
type TreeTarget = { kind: TreeKind; parentKey?: string | null; beforeKey?: string | null };
const errorText = (value: unknown) => value instanceof Error ? value.message : String(value);

function TreeRow({ kind, id, title, detail, depth, selected, disabled, siblings, onSelect, onMove, dragged, setDragged, children }: {
  kind: TreeKind; id: string; title: string; detail?: string; depth: number; selected: boolean;
  disabled: boolean; siblings: string[]; onSelect(): void;
  onMove(target: TreeTarget, source?: TreeDrag): void; dragged: TreeDrag | null; setDragged(value: TreeDrag | null): void;
  children?: ReactNode;
}) {
  const parentKey = kind === "series" ? null : undefined;
  const index = siblings.indexOf(id);
  const drop = (event: DragEvent<HTMLDivElement>) => {
    if (!dragged || dragged.kind !== kind || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onMove({ kind, parentKey, beforeKey: id }, dragged);
    setDragged(null);
  };
  const up = () => index > 0 && onMove({ kind, beforeKey: siblings[index - 1] });
  const down = () => index >= 0 && index < siblings.length - 1 && onMove({ kind, beforeKey: siblings[index + 2] ?? null });
  return <div className={`outline-node-depth-${depth}`}>
    <div className={`outline-node ${selected ? "is-selected" : ""} ${dragged?.key === id ? "is-dragging" : ""}`}
      data-outline-node={kind} data-outline-key={id}
      onDragOver={event => { if (dragged?.kind === kind && !disabled) { event.preventDefault(); event.stopPropagation(); } }}
      onDrop={drop}>
      <span className="outline-drag-handle" draggable={!disabled}
        title="Sürükleyerek sırala" role="button" tabIndex={disabled ? -1 : 0}
        aria-label={`${title} öğesini sürükle`}
        onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", `${kind}:${id}`); setDragged({ kind, key: id }); }}
        onDragEnd={() => setDragged(null)}>⠿</span>
      <button type="button" className="outline-node-title" onClick={onSelect} aria-current={selected ? "true" : undefined}>
        <strong>{title}</strong>{detail && <small>{detail}</small>}
      </button>
      <span className="outline-node-arrows">
        <button type="button" title="Yukarı taşı" aria-label={`${title} yukarı taşı`} disabled={disabled || index <= 0} onClick={up}>↑</button>
        <button type="button" title="Aşağı taşı" aria-label={`${title} aşağı taşı`} disabled={disabled || index < 0 || index >= siblings.length - 1} onClick={down}>↓</button>
      </span>
    </div>
    {children}
  </div>;
}

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
  const [selectedMemoryKey, setSelectedMemoryKey] = useState("");
  const [dragged, setDragged] = useState<TreeDrag | null>(null);
  const [suggestions, setSuggestions] = useState<StudioNarrativeOutlineSuggestion[]>([]);
  const [proposal, setProposal] = useState<StudioNarrativeOutlineSuggestion | null>(null);

  const load = async () => { if (bridge) setCatalog(await bridge.narrativeOutlineStatus()); };
  useEffect(() => {
    void load().catch(error => notify(errorText(error), "error"));
    return bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
  }, []);

  const execute = async (action: () => Promise<unknown>, message: string) => {
    if (busy || !bridge) return;
    setBusy(true);
    try { await action(); await load(); notify(message, "success"); }
    catch (error) { notify(errorText(error), "error"); }
    finally { setBusy(false); }
  };

  const chooseSeries = (key: string) => {
    const entry = catalog?.series.find(item => item.key === key);
    setSeriesKey(key); setSeriesTitle(entry?.title ?? ""); setSeriesDescription(entry?.description ?? "");
    setSeriesPosition(entry?.position ?? (catalog?.series.length ?? 0));
    setChapterKey(""); setChapterTitle(""); setNumberLabel(""); setChapterPosition(0);
    setSelectedMemoryKey("");
  };
  const chooseChapter = (key: string) => {
    const entry = catalog?.chapters.find(item => item.key === key);
    if (entry && entry.seriesKey !== seriesKey) {
      const parent = catalog?.series.find(item => item.key === entry.seriesKey);
      setSeriesKey(entry.seriesKey); setSeriesTitle(parent?.title ?? "");
      setSeriesDescription(parent?.description ?? ""); setSeriesPosition(parent?.position ?? 0);
    }
    setChapterKey(key); setChapterTitle(entry?.title ?? "");
    setNumberLabel(entry?.numberLabel ?? "");
    setChapterPosition(entry?.position ?? 0);
    setSelectedMemoryKey("");
  };
  const newChapter = (parent: string) => {
    chooseSeries(parent);
    setChapterKey(""); setChapterTitle(""); setNumberLabel("");
    setChapterPosition((catalog?.chapters ?? []).filter(ch => ch.seriesKey === parent).length);
  };
  const series = catalog?.series ?? [];
  const chapters = catalog?.chapters ?? [];
  const assignments = catalog?.assignments ?? [];
  const placement = new Map(assignments.map(item => [item.sectionKey, item]));
  const memoryByKey = new Map(memory.map(item => [item.sectionKey, item]));
  const independent = (catalog?.independentOrder ?? memory.map(item => item.sectionKey))
    .map(key => memoryByKey.get(key)).filter((item): item is StudioNarrativeSectionRevision => item !== undefined && !placement.has(item.sectionKey));
  const independentRemainder = memory.filter(item => !placement.has(item.sectionKey) && !independent.some(other => other.sectionKey === item.sectionKey));
  const standalone = [...independent, ...independentRemainder];

  const matching = useMemo(() => {
    const videoIds = new Set((proposal?.videos ?? []).map(video => video.videoId));
    return {
      safe: memory.filter(section => section.sourceVideoIds?.length && section.sourceVideoIds.every(id => videoIds.has(id))),
      ambiguous: memory.filter(section => section.sourceVideoIds?.some(id => videoIds.has(id)) && !section.sourceVideoIds.every(id => videoIds.has(id))),
    };
  }, [proposal, memory]);

  const move = (source: TreeDrag, target: TreeTarget) => {
    if (!bridge || busy || source.kind !== target.kind) return;
    const sourceParent = source.kind === "chapter" ? chapters.find(ch => ch.key === source.key)?.seriesKey
      : source.kind === "section" ? placement.get(source.key)?.chapterKey : null;
    const parentKey = target.parentKey !== undefined ? target.parentKey : sourceParent;
    void execute(() => bridge.narrativeOutlineMove({ kind: source.kind, key: source.key,
      parentKey, beforeKey: target.beforeKey ?? null }), "İçindekiler sırası kaydedildi.");
  };
  const dropInto = (event: DragEvent<HTMLDivElement>, kind: TreeKind, parentKey: string | null) => {
    if (!dragged || dragged.kind !== kind) return;
    event.preventDefault(); event.stopPropagation();
    move(dragged, { kind, parentKey, beforeKey: null }); setDragged(null);
  };
  const dragOver = (event: DragEvent<HTMLDivElement>, kind: TreeKind) => {
    if (dragged?.kind === kind && !busy) { event.preventDefault(); event.stopPropagation(); }
  };

  const selectedMemory = memoryByKey.get(selectedMemoryKey);
  if (!bridge) return null;

  return <section className="panel narrative-outline">
    <header className="narrative-section-head">
      <div><h3>İçindekiler</h3></div>
      <span>{series.length} dizi · {chapters.length} alt bölüm · {memory.length} onaylı anı</span>
    </header>
    <div className="narrative-outline-workspace">
      <section className="narrative-outline-tree" aria-label="İçindekiler ağacı">
        <div className="outline-pane-head outline-panel-toolbar">
          <button type="button" disabled={busy} onClick={() => chooseSeries("")}>Dizi ekle</button>
        </div>
        <div className="outline-static-categories" aria-label="Otomatik kitap dizinleri">
          <span>Muhataplar</span><span>Nesneler</span><span>Mekânlar</span>
        </div>
        <div className="outline-tree-scroll">
          {series.map(item => {
            const children = chapters.filter(ch => ch.seriesKey === item.key);
            return <div key={item.key}>
              <TreeRow kind="series" id={item.key} title={item.title} depth={0}
                detail={children.length ? `${children.length} alt bölüm` : "Henüz alt bölüm yok"}
                selected={seriesKey === item.key && !chapterKey && !selectedMemoryKey}
                siblings={series.map(row => row.key)} disabled={busy} onSelect={() => chooseSeries(item.key)}
                dragged={dragged} setDragged={setDragged} onMove={(target,source) => move(source ?? {kind:"series",key:item.key},target)}>
                <div className="outline-tree-children" onDragOver={event => dragOver(event, "chapter")}
                  onDrop={event => dropInto(event, "chapter", item.key)}>
                  {children.map(ch => {
                    const linked = assignments.filter(link => link.chapterKey === ch.key)
                      .map(link => memoryByKey.get(link.sectionKey)).filter((entry): entry is StudioNarrativeSectionRevision => Boolean(entry));
                    return <div key={ch.key}>
                      <TreeRow kind="chapter" id={ch.key} title={ch.title} depth={1}
                        detail={ch.numberLabel || `${linked.length} anı`}
                        siblings={children.map(child => child.key)}
                        selected={chapterKey === ch.key && !selectedMemoryKey} disabled={busy}
                        onSelect={() => chooseChapter(ch.key)} dragged={dragged} setDragged={setDragged}
                        onMove={(target,source) => move(source ?? {kind:"chapter",key:ch.key},{...target,parentKey:item.key})}>
                        <div className="outline-tree-children" onDragOver={event => dragOver(event,"section")}
                          onDrop={event => dropInto(event,"section",ch.key)}>
                          {linked.map(section => <TreeRow key={section.sectionKey} kind="section" id={section.sectionKey}
                            depth={2} title={section.title} selected={selectedMemoryKey === section.sectionKey}
                            disabled={busy} siblings={linked.map(entry => entry.sectionKey)}
                            onSelect={() => {setSelectedMemoryKey(section.sectionKey);}}
                            dragged={dragged} setDragged={setDragged}
                            onMove={(target,source) => move(source ?? {kind:"section",key:section.sectionKey},{...target,parentKey:ch.key})} />)}
                          {!linked.length && <span className="outline-empty-drop">Anıyı buraya bırak</span>}
                        </div>
                      </TreeRow>
                    </div>;
                  })}
                  <button type="button" className="outline-add-node" disabled={busy}
                    onClick={() => newChapter(item.key)}>+ Alt bölüm</button>
                </div>
              </TreeRow>
            </div>;
          })}
          {!series.length && <p className="outline-empty">Henüz dizi yok. İlk diziyi oluşturabilir veya video başlıklarından öneri alabilirsin.</p>}
          <div className="outline-independent-group" onDragOver={event => dragOver(event,"section")}
            onDrop={event => dropInto(event,"section",null)}>
            <strong>Bağımsız anılar <small>{standalone.length}</small></strong>
            {standalone.map(section => <TreeRow key={section.sectionKey} kind="section" id={section.sectionKey}
              title={section.title} depth={1} selected={selectedMemoryKey === section.sectionKey}
              siblings={standalone.map(entry => entry.sectionKey)} disabled={busy}
              onSelect={() => {setSelectedMemoryKey(section.sectionKey);}}
              dragged={dragged} setDragged={setDragged}
              onMove={(target,source) => move(source ?? {kind:"section",key:section.sectionKey},{...target,parentKey:null})} />)}
            {!standalone.length && <span className="outline-empty-drop">Bağımsız anı yok · Anıyı buraya bırak</span>}
          </div>
        </div>
      </section>

      <section className="narrative-outline-edit-pane">
        <div className="outline-pane-head outline-panel-toolbar">
          <button type="button" className="secondary-button" disabled={busy}
            onClick={() => void execute(async () => {setSuggestions(await bridge.narrativeOutlineSuggestions());},
              "Başlık önerileri hazır. Hiçbir içerik değiştirilmedi.")}>Önerileri getir</button>
        </div>
        {selectedMemory ? <div className="outline-memory-editor">
          <div className="outline-pane-head"><strong>Onaylı anı</strong><button type="button" onClick={() => setSelectedMemoryKey("")}>Kapat</button></div>
          <h4>{selectedMemory.title}</h4>
          <p>{selectedMemory.body?.slice(0, 310)}</p>
          <label>İçindekiler konumu
            <select disabled={busy} value={placement.get(selectedMemory.sectionKey)?.chapterKey ?? ""}
              onChange={event => move({kind:"section",key:selectedMemory.sectionKey},{kind:"section",parentKey:event.target.value || null})}>
              <option value="">Bağımsız anı</option>
              {series.flatMap(s => chapters.filter(ch => ch.seriesKey === s.key).map(ch =>
                <option key={ch.key} value={ch.key}>{s.title} / {ch.numberLabel ? ch.numberLabel + " · " : ""}{ch.title}</option>))}
            </select>
          </label>
          <small>Metin burada değiştirilmez; anlatı onayı ayrı korunur.</small>
        </div> : <section className="outline-edit-details"><h4>Dizileri ve alt bölümleri düzenle</h4>
          <div className="narrative-outline-fields outline-series-fields">
            <div className="outline-edit-first-row">
            <label>Dizi
              <select value={seriesKey} onChange={event => chooseSeries(event.target.value)}>
                <option value="">Yeni dizi oluştur</option>
                {series.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}
              </select>
            </label>
            <label>Dizi adı<input value={seriesTitle} maxLength={220} onChange={event => setSeriesTitle(event.target.value)} placeholder="Örn. Düğümlü Kitap" /></label>
            </div>
            <div className="outline-edit-detail-row">
            <label className="outline-field-description">Dizi açıklaması<input value={seriesDescription} maxLength={1200} onChange={event => setSeriesDescription(event.target.value)} placeholder="İsteğe bağlı" /></label>
            <label className="outline-field-position">Dizi sırası<input type="number" min={0} max={1000000} value={seriesPosition} onChange={event => setSeriesPosition(Number(event.target.value))} /></label>
            <button type="button" className="secondary-button outline-field-save" disabled={busy || !seriesTitle.trim()}
              onClick={() => void execute(async () => {
                const saved = await bridge.narrativeOutlineSaveSeries({ ...(seriesKey ? { key: seriesKey } : {}),
                  title: seriesTitle, description: seriesDescription, position: seriesPosition });
                setSeriesKey(saved.key); setSeriesTitle(saved.title); setSeriesDescription(saved.description);
              }, "Anlatı dizisi kaydedildi.")}>Diziyi kaydet</button>
            </div>
          </div>
          {seriesKey && <div className="narrative-outline-fields chapter-editor outline-chapter-fields">
            <div className="outline-edit-first-row">
            <label>Alt bölüm
              <select value={chapterKey} onChange={event => chooseChapter(event.target.value)}>
                <option value="">Yeni alt bölüm</option>
                {chapters.filter(item => item.seriesKey === seriesKey).map(item =>
                  <option key={item.key} value={item.key}>{item.numberLabel ? item.numberLabel + " · " : ""}{item.title}</option>)}
              </select>
            </label>
            <label>Bölüm adı<input value={chapterTitle} maxLength={220} onChange={event => setChapterTitle(event.target.value)} placeholder="Örn. 54. Davet" /></label>
            </div>
            <div className="outline-edit-detail-row">
            <label className="outline-field-description">Numara / etiket<input value={numberLabel} maxLength={90} onChange={event => setNumberLabel(event.target.value)} placeholder="Örn. 54. Davet" /></label>
            <label className="outline-field-position">Bölüm sırası<input type="number" min={0} max={1000000} value={chapterPosition} onChange={event => setChapterPosition(Number(event.target.value))} /></label>
            <button type="button" className="secondary-button outline-field-save" disabled={busy || !chapterTitle.trim()}
              onClick={() => void execute(async () => {
                const saved = await bridge.narrativeOutlineSaveChapter({ ...(chapterKey ? { key: chapterKey } : {}),
                  seriesKey, title: chapterTitle, numberLabel, position: chapterPosition });
                setChapterKey(saved.key); setChapterTitle(saved.title); setNumberLabel(saved.numberLabel);
              }, "Alt bölüm kaydedildi.")}>Alt bölümü kaydet</button>
            </div>
          </div>}
        </section>}

        {suggestions.length > 0 && <section className="outline-suggestion-details">
          <div className="outline-suggestions-scroll">
            {suggestions.map(item => <div className="narrative-outline-proposal" key={item.key}>
              <strong>{item.seriesTitle} / {item.numberLabel}</strong>
              <ul>{item.videos.map(video => <li key={video.videoId}>{video.title} <small>({video.videoId})</small></li>)}</ul>
              <button type="button" className="secondary-button" disabled={busy} onClick={() => {
                chooseSeries(item.seriesKey ?? "");
                setSeriesTitle(item.seriesTitle); setChapterKey(item.chapterKey ?? "");
                setChapterTitle(item.chapterTitle); setNumberLabel(item.numberLabel);
                setChapterPosition(item.chapterKey ? (chapters.find(ch => ch.key === item.chapterKey)?.position ?? 0)
                  : chapters.filter(ch => ch.seriesKey === item.seriesKey).length);
                setProposal(item);
              }}>Düzenlemeye al</button>
            </div>)}
          </div>
        </section>}
        {proposal && seriesKey && chapterKey && <div className="narrative-outline-proposal">
          <strong>Kaynakları eşleşen onaylı anılar</strong>
          <p>{matching.safe.map(section => section.title).join(" · ") || "Güvenli eşleşen anı yok."}</p>
          {matching.ambiguous.length > 0 && <p>Birden fazla bölüme ait kaynaklar: {matching.ambiguous.map(section => section.title).join(" · ")}. Bunları elle yerleştir; otomatik eşleşmeye alınmaz.</p>}
          <button className="secondary-button" disabled={busy || !matching.safe.length} onClick={() => void execute(async () => {
            for (const [position, section] of matching.safe.entries())
              await bridge.narrativeOutlinePlaceSection({ sectionKey: section.sectionKey, chapterKey, position });
            setProposal(null);
          }, "Eşleşen anılar bölüme bağlandı.")}>Eşleşen anıları seçili bölüme bağla</button>
        </div>}
      </section>
    </div>
  </section>;
}
