import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import "./subtitle-research.css";

type MatchMode = "contains" | "whole-word";
type SearchMode = "independent" | "all-in-video";
type SortMode = "date" | "occurrences" | "distance";
type SearchType = "terms" | "relationship";
type ProximityUnit = "words" | "sentences" | "video";
type Direction = "any" | "ordered";
type SearchContext = { context: string; occurrenceCount: number; truncated: boolean };
type TermResult = { term: string; occurrenceCount: number; contexts: SearchContext[] };
type TermStat = { term: string; videoCount: number; occurrenceCount: number };
type TermVideo = {
  videoId: string; channelId: string; channelTitle: string; title: string; publishedAt: string; url: string; language: string;
  occurrenceCount: number; matchedTermCount: number; terms: TermResult[];
};
type TermReport = {
  searchType: "terms"; generatedAt: string; terms: string[]; matchMode: MatchMode; searchMode: SearchMode; sort: SortMode;
  channelId: string; dateFrom: string; dateTo: string; transcriptCount: number; videoCount: number; totalOccurrences: number;
  termStats: TermStat[]; results: TermVideo[]; markdown: string; filename: string; jsonFilename: string;
};
type RelationGroup = { id: string; label: string; terms: string[] };
type RelationMatch = { groupIndex: number; groupId: string; groupLabel: string; term: string; matchedText: string; wordIndex: number; sentenceIndex: number };
type RelationEvidence = { context: string; truncated: boolean; distance: number | null; wordDistance: number | null; sentenceDistance: number | null; matches: RelationMatch[] };
type RelationVideo = {
  videoId: string; channelId: string; channelTitle: string; title: string; publishedAt: string; url: string; language: string;
  relationCount: number; bestDistance: number | null; groupOccurrences: number[]; evidence: RelationEvidence[];
};
type GroupStat = { id: string; label: string; terms: string[]; videoCount: number; occurrenceCount: number; evidenceMatchCount: number };
type RelationReport = {
  searchType: "relationship"; generatedAt: string; groups: RelationGroup[]; excludeTerms: string[]; matchMode: MatchMode;
  proximity: { unit: ProximityUnit; distance: number | null }; direction: Direction; sort: SortMode; channelId: string; dateFrom: string; dateTo: string;
  transcriptCount: number; videoCount: number; relationCount: number; minDistance: number | null; medianDistance: number | null;
  groupStats: GroupStat[]; matrix: { labels: string[]; values: number[][] }; results: RelationVideo[];
  markdown: string; filename: string; jsonFilename: string;
};
type ResearchReport = TermReport | RelationReport;
type SubtitleAnalysisBridge = { search(input: Record<string, unknown>): Promise<ResearchReport> };

declare global { interface Window { channelFoundrySubtitleAnalysis?: SubtitleAnalysisBridge } }

const MAX_TERMS = 12;
const MAX_GROUPS = 6;
const MAX_GROUP_TERMS = 8;
const PRESET_KEY = "channel-foundry:subtitle-research-presets-v3";
const initialGroups: RelationGroup[] = [
  { id: "group-a", label: "Grup A", terms: [] },
  { id: "group-b", label: "Grup B", terms: [] },
];

type Preset = {
  id: string; name: string; createdAt: string;
  config: {
    searchType: SearchType; terms: string[]; searchMode: SearchMode; groups: RelationGroup[]; excludeTerms: string[];
    matchMode: MatchMode; proximityUnit: ProximityUnit; proximityDistance: number; direction: Direction; sort: SortMode;
    channelId: string; dateFrom: string; dateTo: string;
  };
};

function errorText(error: unknown) { return error instanceof Error ? error.message : String(error); }
function normalizeTerm(value: string) { return value.replace(/\s+/gu, " ").trim(); }
function termKey(value: string) { return normalizeTerm(value).toLocaleLowerCase("tr-TR"); }
function formatDate(value: string) {
  if (!value) return "Tarih bilinmiyor";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR").format(date);
}
function distanceLabel(value: number | null, unit: ProximityUnit) {
  if (unit === "video" || value == null) return "aynı video";
  return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value)} ${unit === "sentences" ? "cümle" : "kelime"}`;
}
function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.style.display = "none";
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function cleanJsonReport(report: ResearchReport) { const { markdown: _markdown, ...rest } = report; return rest; }
function highlightedContext(context: string, terms: string[]) {
  const source = context.toLocaleLowerCase("tr-TR");
  const needles = terms.map((term) => ({ raw: term, folded: term.toLocaleLowerCase("tr-TR") })).filter((item) => item.folded);
  if (!needles.length) return context;
  const output = [];
  let offset = 0;
  let key = 0;
  while (offset < context.length) {
    let bestIndex = -1;
    let bestLength = 0;
    for (const needle of needles) {
      const index = source.indexOf(needle.folded, offset);
      if (index >= 0 && (bestIndex < 0 || index < bestIndex || (index === bestIndex && needle.folded.length > bestLength))) {
        bestIndex = index; bestLength = needle.folded.length;
      }
    }
    if (bestIndex < 0) { output.push(context.slice(offset)); break; }
    if (bestIndex > offset) output.push(context.slice(offset, bestIndex));
    output.push(<mark key={`match-${key++}`}>{context.slice(bestIndex, bestIndex + bestLength)}</mark>);
    offset = bestIndex + Math.max(1, bestLength);
  }
  return output;
}
function readPresets(): Preset[] {
  try { const parsed = JSON.parse(localStorage.getItem(PRESET_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

export default function SubtitleResearch() {
  const studio = window.channelFoundryStudio;
  const analysis = window.channelFoundrySubtitleAnalysis;
  const [channels, setChannels] = useState<StudioYoutubeChannel[]>([]);
  const [searchType, setSearchType] = useState<SearchType>("terms");
  const [terms, setTerms] = useState<string[]>([]);
  const [draftTerm, setDraftTerm] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("independent");
  const [groups, setGroups] = useState<RelationGroup[]>(initialGroups);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [excludeTerms, setExcludeTerms] = useState<string[]>([]);
  const [excludeDraft, setExcludeDraft] = useState("");
  const [matchMode, setMatchMode] = useState<MatchMode>("contains");
  const [proximityUnit, setProximityUnit] = useState<ProximityUnit>("words");
  const [proximityDistance, setProximityDistance] = useState(25);
  const [direction, setDirection] = useState<Direction>("any");
  const [sort, setSort] = useState<SortMode>("date");
  const [channelId, setChannelId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState("");
  const [presets, setPresets] = useState<Preset[]>(() => readPresets());
  const [selectedPreset, setSelectedPreset] = useState("");

  useEffect(() => {
    if (!studio) return;
    void studio.youtubeCatalogChannels().then(setChannels).catch((reason) => setError(errorText(reason)));
  }, []);

  const effectiveTerms = useMemo(() => {
    const next = [...terms];
    const draft = normalizeTerm(draftTerm);
    if (draft && !next.some((term) => termKey(term) === termKey(draft))) next.push(draft);
    return next;
  }, [terms, draftTerm]);

  const effectiveGroups = useMemo(() => groups.map((group) => {
    const draft = normalizeTerm(groupDrafts[group.id] || "");
    if (!draft || group.terms.some((term) => termKey(term) === termKey(draft))) return group;
    return { ...group, terms: [...group.terms, draft] };
  }), [groups, groupDrafts]);

  const effectiveExclude = useMemo(() => {
    const next = [...excludeTerms];
    const draft = normalizeTerm(excludeDraft);
    if (draft && !next.some((term) => termKey(term) === termKey(draft))) next.push(draft);
    return next;
  }, [excludeTerms, excludeDraft]);

  const addTerm = (value = draftTerm) => {
    const term = normalizeTerm(value);
    if (!term) return;
    if (term.length > 200) return setError("Bir terim en fazla 200 karakter olabilir.");
    if (terms.some((entry) => termKey(entry) === termKey(term))) return setDraftTerm("");
    if (terms.length >= MAX_TERMS) return setError(`Tek raporda en fazla ${MAX_TERMS} terim aranabilir.`);
    setTerms((current) => [...current, term]); setDraftTerm(""); setError("");
  };
  const addGroupTerm = (groupId: string, value = groupDrafts[groupId] || "") => {
    const term = normalizeTerm(value);
    if (!term) return;
    setGroups((current) => current.map((group) => {
      if (group.id !== groupId || group.terms.some((entry) => termKey(entry) === termKey(term))) return group;
      if (group.terms.length >= MAX_GROUP_TERMS) { setError(`Bir grupta en fazla ${MAX_GROUP_TERMS} terim olabilir.`); return group; }
      return { ...group, terms: [...group.terms, term] };
    }));
    setGroupDrafts((current) => ({ ...current, [groupId]: "" })); setError("");
  };
  const addExclude = (value = excludeDraft) => {
    const term = normalizeTerm(value);
    if (!term) return;
    if (!excludeTerms.some((entry) => termKey(entry) === termKey(term))) setExcludeTerms((current) => [...current, term].slice(0, MAX_TERMS));
    setExcludeDraft("");
  };
  const onEnter = (event: KeyboardEvent<HTMLInputElement>, action: () => void) => {
    if (event.key !== "Enter") return;
    event.preventDefault(); action();
  };
  const addGroup = () => {
    if (groups.length >= MAX_GROUPS) return setError(`En fazla ${MAX_GROUPS} kavram grubu kullanılabilir.`);
    const index = groups.length;
    setGroups((current) => [...current, { id: `group-${Date.now()}`, label: `Grup ${String.fromCharCode(65 + index)}`, terms: [] }]);
  };
  const removeGroup = (groupId: string) => { if (groups.length > 2) setGroups((current) => current.filter((group) => group.id !== groupId)); };

  const configSnapshot = (): Preset["config"] => ({
    searchType, terms: effectiveTerms, searchMode, groups: effectiveGroups, excludeTerms: effectiveExclude,
    matchMode, proximityUnit, proximityDistance, direction, sort, channelId, dateFrom, dateTo,
  });
  const savePreset = () => {
    const name = window.prompt("Sorgu adı", searchType === "relationship" ? effectiveGroups.map((group) => group.label).join(" + ") : effectiveTerms.join(" + "))?.trim();
    if (!name) return;
    const preset: Preset = { id: `preset-${Date.now()}`, name, createdAt: new Date().toISOString(), config: configSnapshot() };
    const next = [...presets, preset].slice(-30);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next)); setPresets(next); setSelectedPreset(preset.id);
  };
  const loadPreset = (id: string) => {
    setSelectedPreset(id);
    const preset = presets.find((entry) => entry.id === id);
    if (!preset) return;
    const c = preset.config;
    setSearchType(c.searchType); setTerms(c.terms || []); setDraftTerm(""); setSearchMode(c.searchMode || "independent");
    setGroups(c.groups?.length >= 2 ? c.groups : initialGroups); setGroupDrafts({}); setExcludeTerms(c.excludeTerms || []); setExcludeDraft("");
    setMatchMode(c.matchMode || "contains"); setProximityUnit(c.proximityUnit || "words"); setProximityDistance(c.proximityDistance ?? 25);
    setDirection(c.direction || "any"); setSort(c.sort || "date"); setChannelId(c.channelId || ""); setDateFrom(c.dateFrom || ""); setDateTo(c.dateTo || ""); setError("");
  };
  const deletePreset = () => {
    if (!selectedPreset) return;
    const next = presets.filter((entry) => entry.id !== selectedPreset);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next)); setPresets(next); setSelectedPreset("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!analysis || busy) return;
    if (searchType === "terms" && !effectiveTerms.length) return setError("En az bir kelime veya ifade ekle.");
    if (searchType === "relationship" && effectiveGroups.some((group) => !group.terms.length)) return setError("Her kavram grubunda en az bir terim olmalı.");
    if (dateFrom && dateTo && dateFrom > dateTo) return setError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    setBusy(true); setError(""); setCopied(false); setExported("");
    try {
      const input = searchType === "terms"
        ? { searchType, terms: effectiveTerms, channelId, searchMode, matchMode, sort: sort === "distance" ? "date" : sort, dateFrom, dateTo }
        : { searchType, groups: effectiveGroups, excludeTerms: effectiveExclude, channelId, matchMode, proximity: { unit: proximityUnit, distance: proximityUnit === "video" ? null : proximityDistance }, direction, sort, dateFrom, dateTo };
      const nextReport = await analysis.search(input);
      setReport(nextReport);
      if (searchType === "terms") { setTerms(effectiveTerms); setDraftTerm(""); }
      else { setGroups(effectiveGroups); setGroupDrafts({}); setExcludeTerms(effectiveExclude); setExcludeDraft(""); }
    } catch (reason) { setReport(null); setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  const copyReport = async () => {
    if (!report) return;
    try { await navigator.clipboard.writeText(report.markdown); setCopied(true); }
    catch (reason) { setError(`Rapor panoya kopyalanamadı · ${errorText(reason)}`); }
  };
  const exportMarkdown = () => {
    if (!report) return;
    try { downloadText(report.filename, report.markdown, "text/markdown;charset=utf-8"); setExported("md"); }
    catch (reason) { setError(`Markdown dışa aktarılamadı · ${errorText(reason)}`); }
  };
  const exportJson = () => {
    if (!report) return;
    try { downloadText(report.jsonFilename, `${JSON.stringify(cleanJsonReport(report), null, 2)}\n`, "application/json;charset=utf-8"); setExported("json"); }
    catch (reason) { setError(`JSON dışa aktarılamadı · ${errorText(reason)}`); }
  };
  const openVideo = async (video: TermVideo | RelationVideo) => {
    if (!studio) return;
    try { await studio.openExternalUrl(video.url); }
    catch (reason) { setError(`YouTube videosu açılamadı · ${errorText(reason)}`); }
  };

  return <div className="subtitle-research-page">
    <section className="subtitle-search-panel panel">
      <div className="subtitle-mode-tabs">
        <button type="button" className={searchType === "terms" ? "active" : ""} onClick={() => { setSearchType("terms"); setReport(null); }}>Terim Arama</button>
        <button type="button" className={searchType === "relationship" ? "active" : ""} onClick={() => { setSearchType("relationship"); setReport(null); }}>İlişki Arama</button>
      </div>
      <form className="subtitle-search-form-v3" onSubmit={submit}>
        {searchType === "terms" ? <TermBuilder terms={terms} draft={draftTerm} setDraft={setDraftTerm} addTerm={addTerm} removeTerm={(term) => setTerms((current) => current.filter((entry) => termKey(entry) !== termKey(term)))} onEnter={onEnter}/> :
          <div className="relation-builder">
            {groups.map((group, index) => <div key={group.id} className="relation-group-card">
              <div className="relation-group-head"><span>{index ? "AND" : "GRUP"}</span><input value={group.label} onChange={(event) => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, label: event.target.value } : entry))}/>{groups.length > 2 && <button type="button" onClick={() => removeGroup(group.id)}>Kaldır</button>}</div>
              <div className="subtitle-term-input-row"><input value={groupDrafts[group.id] || ""} onChange={(event) => setGroupDrafts((current) => ({ ...current, [group.id]: event.target.value }))} onKeyDown={(event) => onEnter(event, () => addGroupTerm(group.id))} placeholder="Terim/ifade ekle…"/><button className="secondary-button" type="button" onClick={() => addGroupTerm(group.id)}>Ekle</button></div>
              <div className="subtitle-term-chips relation-chips">{group.terms.map((term, termIndex) => <span key={termKey(term)} className="relation-chip-wrap">{termIndex > 0 && <em>OR</em>}<button type="button" onClick={() => setGroups((current) => current.map((entry) => entry.id === group.id ? { ...entry, terms: entry.terms.filter((item) => termKey(item) !== termKey(term)) } : entry))}>{term}<b>×</b></button></span>)}{!group.terms.length && <small>Bu grupta en az bir terim olmalı.</small>}</div>
            </div>)}
            <button type="button" className="secondary-button relation-add-group" onClick={addGroup} disabled={groups.length >= MAX_GROUPS}>+ Kavram grubu ekle</button>
            <div className="relation-exclude"><label><span>Hariç tut (NOT)</span><div className="subtitle-term-input-row"><input value={excludeDraft} onChange={(event) => setExcludeDraft(event.target.value)} onKeyDown={(event) => onEnter(event, addExclude)} placeholder="Bu bağlamlarda varsa sonucu çıkar…"/><button className="secondary-button" type="button" onClick={() => addExclude()}>Ekle</button></div></label><div className="subtitle-term-chips">{excludeTerms.map((term) => <button type="button" key={termKey(term)} onClick={() => setExcludeTerms((current) => current.filter((entry) => termKey(entry) !== termKey(term)))}>{term}<b>×</b></button>)}</div></div>
          </div>}

        <details className="subtitle-advanced-filters"><summary>Filtreler{dateFrom || dateTo ? " · Tarih seçili" : ""}</summary>
        <div className="subtitle-control-grid">
          <label><span>Kanal</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">Tüm kanallar</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title || channel.handle || channel.id}</option>)}</select></label>
          {searchType === "terms" && <label><span>Çoklu arama</span><select value={searchMode} onChange={(event) => setSearchMode(event.target.value as SearchMode)}><option value="independent">Bağımsız · herhangi biri</option><option value="all-in-video">Aynı videoda · hepsi</option></select></label>}
          <label><span>Eşleşme</span><select value={matchMode} onChange={(event) => setMatchMode(event.target.value as MatchMode)}><option value="contains">İçeren · ekleri yakala</option><option value="whole-word">Tam kelime/ifade</option></select></label>
          {searchType === "relationship" && <><label><span>Yakınlık</span><select value={proximityUnit} onChange={(event) => setProximityUnit(event.target.value as ProximityUnit)}><option value="words">Kelime mesafesi</option><option value="sentences">Cümle mesafesi</option><option value="video">Aynı video</option></select></label>{proximityUnit !== "video" && <label><span>Mesafe</span><input type="number" min="0" max={proximityUnit === "sentences" ? 10 : 500} value={proximityDistance} onChange={(event) => setProximityDistance(Number(event.target.value))}/></label>}<label><span>Yön</span><select value={direction} onChange={(event) => setDirection(event.target.value as Direction)}><option value="any">Fark etmez</option><option value="ordered">A → B → C sırası</option></select></label></>}
          <label><span>Sırala</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="date">Tarih · yeni önce</option><option value="occurrences">{searchType === "relationship" ? "İlişki · çok önce" : "Kullanım · çok önce"}</option>{searchType === "relationship" && <option value="distance">Mesafe · yakın önce</option>}</select></label>
          <label><span>Başlangıç</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)}/></label>
          <label><span>Bitiş</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)}/></label>
        </div>

        </details>
        <div className="subtitle-search-actions">
          <div className="subtitle-presets"><select value={selectedPreset} onChange={(event) => loadPreset(event.target.value)}><option value="">Kayıtlı sorgular…</option>{presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select><button type="button" className="secondary-button" onClick={savePreset}>Sorguyu kaydet</button><button type="button" className="secondary-button" onClick={deletePreset} disabled={!selectedPreset}>Sil</button></div>
          <button className="primary-button" type="submit" disabled={busy || !analysis}>{busy ? "Taranıyor…" : searchType === "relationship" ? "İlişkileri tara" : "Altyazılarda ara"}</button>
        </div>
      </form>
      {error && <div className="subtitle-search-error" role="alert">{error}</div>}
      {!analysis && <div className="subtitle-search-error">Altyazı analiz köprüsü yüklenemedi. Studio'yu yeniden başlat.</div>}
    </section>

    <div className="subtitle-results-region" aria-label="Araştırma sonuçları">
    {report ? <>
      <ReportMetrics report={report}/>
      {report.searchType === "relationship" && <RelationSummary report={report}/>} 
      {report.searchType === "terms" && <TermSummary report={report}/>} 
      <section className="subtitle-report panel">
        <header className="subtitle-report-head"><div><small>RAPOR</small><h3>{report.searchType === "relationship" ? report.groups.map((group) => group.label).join(" + ") : report.terms.map((term) => `“${term}”`).join(" · ")}</h3><span>{report.searchType === "relationship" ? `${report.videoCount} videoda ${report.relationCount} ilişki örneği` : `${report.videoCount} videoda ${report.totalOccurrences} toplam kullanım`}</span></div><div className="subtitle-report-actions"><button className="secondary-button" onClick={() => void copyReport()}>{copied ? "Kopyalandı" : "Raporu kopyala"}</button><button className="secondary-button" onClick={exportMarkdown}>{exported === "md" ? "Markdown indirildi" : "Markdown dışa aktar"}</button><button className="secondary-button" onClick={exportJson}>{exported === "json" ? "JSON indirildi" : "JSON dışa aktar"}</button></div></header>
        {report.searchType === "terms" ? <TermResults report={report} openVideo={openVideo}/> : <RelationResults report={report} openVideo={openVideo}/>} 
      </section>
    </> : <div className="subtitle-results-empty" aria-live="polite">Arama sonuçları burada görüntülenir.</div>}
    </div>
  </div>;
}

function TermBuilder({ terms, draft, setDraft, addTerm, removeTerm, onEnter }: { terms: string[]; draft: string; setDraft(value: string): void; addTerm(): void; removeTerm(term: string): void; onEnter(event: KeyboardEvent<HTMLInputElement>, action: () => void): void }) {
  return <div className="subtitle-term-builder"><label className="subtitle-query-field"><span>Kelime veya ifade</span><div className="subtitle-term-input-row"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => onEnter(event, addTerm)} placeholder="Terim yaz ve Enter'a bas…"/><button className="secondary-button" type="button" onClick={addTerm}>Ekle</button></div></label><div className="subtitle-term-chips">{terms.map((term) => <button type="button" key={termKey(term)} onClick={() => removeTerm(term)}>{term}<b>×</b></button>)}{!terms.length && <small>Terim eklenmedi.</small>}</div></div>;
}
function ReportMetrics({ report }: { report: ResearchReport }) {
  return <div className="subtitle-report-metrics"><Metric label="Taranan altyazı" value={report.transcriptCount} note="yerel arşiv"/><Metric label={report.searchType === "relationship" ? "Kavram grubu" : "Aranan terim"} value={report.searchType === "relationship" ? report.groups.length : report.terms.length} note={report.searchType === "relationship" ? distanceLabel(report.proximity.distance, report.proximity.unit) : report.searchMode}/><Metric label="Eşleşen video" value={report.videoCount} note="sonuç bulunan"/><Metric label={report.searchType === "relationship" ? "İlişki örneği" : "Toplam kullanım"} value={report.searchType === "relationship" ? report.relationCount : report.totalOccurrences} note={report.matchMode}/></div>;
}
function TermSummary({ report }: { report: TermReport }) {
  return <section className="subtitle-term-summary panel"><div className="subtitle-term-summary-title"><small>TERİM ÖZETİ</small><span>{report.terms.length} terim aynı raporda</span></div><div className="subtitle-term-summary-grid">{report.termStats.map((stat) => <div key={termKey(stat.term)}><strong>{stat.term}</strong><span>{stat.videoCount} video</span><b>{stat.occurrenceCount} kullanım</b></div>)}</div></section>;
}
function RelationSummary({ report }: { report: RelationReport }) {
  return <><section className="subtitle-term-summary panel"><div className="subtitle-term-summary-title"><small>İLİŞKİ ÖZETİ</small><span>En yakın: {distanceLabel(report.minDistance, report.proximity.unit)} · Medyan: {distanceLabel(report.medianDistance, report.proximity.unit)}</span></div><div className="subtitle-term-summary-grid">{report.groupStats.map((stat) => <div key={stat.id}><strong>{stat.label}</strong><span>{stat.terms.join(" OR ")}</span><b>{stat.evidenceMatchCount} ilişki içi eşleşme</b></div>)}</div></section><section className="subtitle-matrix panel"><div className="subtitle-term-summary-title"><small>YAKINLIK MATRİSİ</small><span>Köşegen kullanım; diğer hücreler ikili ilişki örnekleri</span></div><div className="subtitle-matrix-scroll"><table><thead><tr><th></th>{report.matrix.labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{report.matrix.labels.map((label, row) => <tr key={label}><th>{label}</th>{report.matrix.values[row]?.map((value, column) => <td key={`${row}-${column}`}>{value}</td>)}</tr>)}</tbody></table></div></section></>;
}
function TermResults({ report, openVideo }: { report: TermReport; openVideo(video: TermVideo): Promise<void> }) {
  if (!report.results.length) return <Empty count={report.transcriptCount}/>;
  return <div className="subtitle-report-results">{report.results.map((video) => <article className="subtitle-result-video" key={video.videoId}><VideoHead video={video} badge={`${video.occurrenceCount} kullanım`} openVideo={openVideo}/>{video.terms.map((termResult) => <div className="subtitle-term-result" key={termKey(termResult.term)}><div className="subtitle-term-result-head"><strong>{termResult.term}</strong><span>{termResult.occurrenceCount} kullanım</span></div><div className="subtitle-sentence-list">{termResult.contexts.map((match, index) => <div className="subtitle-sentence" key={`${video.videoId}-${termResult.term}-${index}`}><span>{index + 1}</span><p>{highlightedContext(match.context, [termResult.term])}{match.occurrenceCount > 1 && <small>{match.occurrenceCount}× bu bağlamda</small>}{match.truncated && <small>bağlam penceresi</small>}</p></div>)}</div></div>)}</article>)}</div>;
}
function RelationResults({ report, openVideo }: { report: RelationReport; openVideo(video: RelationVideo): Promise<void> }) {
  if (!report.results.length) return <Empty count={report.transcriptCount}/>;
  const allTerms = report.groups.flatMap((group) => group.terms);
  return <div className="subtitle-report-results">{report.results.map((video) => <article className="subtitle-result-video" key={video.videoId}><VideoHead video={video} badge={`${video.relationCount} ilişki`} openVideo={openVideo}/><div className="relation-video-meta"><span>En yakın: {distanceLabel(video.bestDistance, report.proximity.unit)}</span>{video.groupOccurrences.map((count, index) => <span key={report.groups[index].id}>{report.groups[index].label}: {count}</span>)}</div><div className="subtitle-sentence-list">{video.evidence.map((evidence, index) => <div className="subtitle-sentence relation-evidence" key={`${video.videoId}-rel-${index}`}><span>{index + 1}</span><div><div className="relation-evidence-meta"><b>{distanceLabel(evidence.distance, report.proximity.unit)}</b>{evidence.matches.map((match, matchIndex) => <em key={`${match.groupId}-${matchIndex}`}>{match.groupLabel}: {match.matchedText}</em>)}</div><p>{highlightedContext(evidence.context, allTerms)}{evidence.truncated && <small>kontrollü bağlam</small>}</p></div></div>)}</div></article>)}</div>;
}
function VideoHead({ video, badge, openVideo }: { video: TermVideo | RelationVideo; badge: string; openVideo(video: TermVideo | RelationVideo): Promise<void> }) {
  return <div className="subtitle-result-video-head"><div><button className="subtitle-video-link" onClick={() => void openVideo(video)}>{video.title}</button><small>{formatDate(video.publishedAt)}{video.channelTitle ? ` · ${video.channelTitle}` : ""}{video.language ? ` · ${video.language}` : ""}</small></div><strong>{badge}</strong></div>;
}
function Empty({ count }: { count: number }) { return <div className="subtitle-report-empty"><strong>Eşleşme bulunamadı.</strong><span>{count ? `${count} arşivlenmiş altyazı tarandı.` : "Önce Video Arşivi bölümünden altyazıları yerel arşive al."}</span></div>; }
function Metric({ label, value, note }: { label: string; value: number; note: string }) { return <div className="subtitle-report-metric panel"><span>{label}</span><strong>{new Intl.NumberFormat("tr-TR").format(value)}</strong><small>{note}</small></div>; }
