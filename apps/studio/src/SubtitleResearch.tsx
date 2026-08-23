import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import "./subtitle-research.css";

type SubtitleMatchMode = "contains" | "whole-word";
type SubtitleSearchMode = "independent" | "all-in-video";
type SubtitleSortMode = "date" | "occurrences";
type SubtitleSearchContext = { context: string; occurrenceCount: number; truncated: boolean };
type SubtitleSearchTermResult = { term: string; occurrenceCount: number; contexts: SubtitleSearchContext[] };
type SubtitleSearchTermStat = { term: string; videoCount: number; occurrenceCount: number };
type SubtitleSearchVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
  url: string;
  language: string;
  occurrenceCount: number;
  matchedTermCount: number;
  terms: SubtitleSearchTermResult[];
};
type SubtitleSearchReport = {
  generatedAt: string;
  terms: string[];
  matchMode: SubtitleMatchMode;
  searchMode: SubtitleSearchMode;
  sort: SubtitleSortMode;
  channelId: string;
  transcriptCount: number;
  videoCount: number;
  totalOccurrences: number;
  termStats: SubtitleSearchTermStat[];
  results: SubtitleSearchVideo[];
};
type SubtitleAnalysisBridge = {
  search(input: {
    terms: string[];
    channelId?: string;
    matchMode?: SubtitleMatchMode;
    searchMode?: SubtitleSearchMode;
    sort?: SubtitleSortMode;
  }): Promise<SubtitleSearchReport>;
};

declare global {
  interface Window {
    channelFoundrySubtitleAnalysis?: SubtitleAnalysisBridge;
  }
}

const MAX_TERMS = 12;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string) {
  if (!value) return "Tarih bilinmiyor";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR").format(date);
}

function normalizeTerm(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function termKey(value: string) {
  return normalizeTerm(value).toLocaleLowerCase("tr-TR");
}

function searchModeLabel(value: SubtitleSearchMode) {
  return value === "all-in-video" ? "Aynı videoda tüm terimler" : "Bağımsız terimler";
}

function matchModeLabel(value: SubtitleMatchMode) {
  return value === "whole-word" ? "Tam kelime/ifade" : "İçeren";
}

function reportText(report: SubtitleSearchReport) {
  const lines = [
    "# Channel Foundry — Altyazı Arama Raporu",
    "",
    `- Oluşturma: ${report.generatedAt}`,
    `- Terimler: ${report.terms.join(", ")}`,
    `- Arama modu: ${searchModeLabel(report.searchMode)}`,
    `- Eşleşme modu: ${matchModeLabel(report.matchMode)}`,
    `- Taranan altyazı: ${report.transcriptCount}`,
    `- Eşleşen video: ${report.videoCount}`,
    `- Toplam kullanım: ${report.totalOccurrences}`,
    "",
    "## Terim Özeti",
    "",
    "| Terim | Video | Kullanım |",
    "| --- | ---: | ---: |",
  ];

  report.termStats.forEach((stat) => lines.push(`| ${stat.term.replace(/\|/gu, "\\|")} | ${stat.videoCount} | ${stat.occurrenceCount} |`));

  report.results.forEach((video, videoIndex) => {
    lines.push(
      "",
      `## VIDEO ${String(videoIndex + 1).padStart(3, "0")}`,
      "",
      `- Başlık: ${video.title}`,
      `- Tarih: ${video.publishedAt || "—"}`,
      `- Kanal: ${video.channelTitle || video.channelId || "—"}`,
      `- Video ID: ${video.videoId}`,
      `- URL: ${video.url}`,
      `- Toplam kullanım: ${video.occurrenceCount}`,
    );
    video.terms.forEach((termResult) => {
      lines.push("", `### ${termResult.term} — ${termResult.occurrenceCount} kullanım`, "");
      termResult.contexts.forEach((match, index) => {
        const repeated = match.occurrenceCount > 1 ? ` [${match.occurrenceCount} kullanım]` : "";
        const windowNote = match.truncated ? " _(bağlam penceresi)_" : "";
        lines.push(`${index + 1}. ${match.context}${repeated}${windowNote}`);
      });
    });
  });

  return `${lines.join("\n").trim()}\n`;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/gu, "c")
    .replace(/[ğĞ]/gu, "g")
    .replace(/[ıİiI]/gu, "i")
    .replace(/[öÖ]/gu, "o")
    .replace(/[şŞ]/gu, "s")
    .replace(/[üÜ]/gu, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72) || "arama";
}

function reportFilename(report: SubtitleSearchReport) {
  return `subtitle-search-${slugify(report.terms.slice(0, 4).join("-"))}-${report.generatedAt.slice(0, 10)}.md`;
}

function highlightedContext(context: string, term: string) {
  const source = context.toLocaleLowerCase("tr-TR");
  const needle = term.toLocaleLowerCase("tr-TR");
  if (!needle) return context;
  const output = [];
  let offset = 0;
  let key = 0;
  while (offset < context.length) {
    const index = source.indexOf(needle, offset);
    if (index < 0) {
      output.push(context.slice(offset));
      break;
    }
    if (index > offset) output.push(context.slice(offset, index));
    output.push(<mark key={`match-${key++}`}>{context.slice(index, index + needle.length)}</mark>);
    offset = index + Math.max(1, needle.length);
  }
  return output;
}

export default function SubtitleResearch() {
  const studio = window.channelFoundryStudio;
  const analysis = window.channelFoundrySubtitleAnalysis;
  const [channels, setChannels] = useState<StudioYoutubeChannel[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [draftTerm, setDraftTerm] = useState("");
  const [channelId, setChannelId] = useState("");
  const [searchMode, setSearchMode] = useState<SubtitleSearchMode>("independent");
  const [matchMode, setMatchMode] = useState<SubtitleMatchMode>("contains");
  const [sort, setSort] = useState<SubtitleSortMode>("date");
  const [report, setReport] = useState<SubtitleSearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState(false);

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

  const addTerm = (value = draftTerm) => {
    const nextTerm = normalizeTerm(value);
    if (!nextTerm) return;
    if (nextTerm.length > 200) {
      setError("Bir terim en fazla 200 karakter olabilir.");
      return;
    }
    if (terms.some((term) => termKey(term) === termKey(nextTerm))) {
      setDraftTerm("");
      return;
    }
    if (terms.length >= MAX_TERMS) {
      setError(`Tek raporda en fazla ${MAX_TERMS} terim aranabilir.`);
      return;
    }
    setTerms((current) => [...current, nextTerm]);
    setDraftTerm("");
    setError("");
  };

  const handleTermKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addTerm();
  };

  const removeTerm = (term: string) => {
    setTerms((current) => current.filter((entry) => termKey(entry) !== termKey(term)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveTerms.length || !analysis || busy) return;
    if (effectiveTerms.length > MAX_TERMS) {
      setError(`Tek raporda en fazla ${MAX_TERMS} terim aranabilir.`);
      return;
    }
    if (normalizeTerm(draftTerm)) {
      setTerms(effectiveTerms);
      setDraftTerm("");
    }
    setBusy(true);
    setError("");
    setCopied(false);
    setExported(false);
    try {
      setReport(await analysis.search({ terms: effectiveTerms, channelId, searchMode, matchMode, sort }));
    } catch (reason) {
      setReport(null);
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const copyReport = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(reportText(report));
      setCopied(true);
    } catch (reason) {
      setError(`Rapor panoya kopyalanamadı · ${errorText(reason)}`);
    }
  };

  const exportReport = () => {
    if (!report) return;
    try {
      const blob = new Blob([reportText(report)], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = reportFilename(report);
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExported(true);
    } catch (reason) {
      setError(`Rapor dışa aktarılamadı · ${errorText(reason)}`);
    }
  };

  const openVideo = async (video: SubtitleSearchVideo) => {
    if (!studio) return;
    try {
      await studio.openExternalUrl(video.url);
    } catch (reason) {
      setError(`YouTube videosu açılamadı · ${errorText(reason)}`);
    }
  };

  return <div className="subtitle-research-page">
    <section className="subtitle-research-hero panel">
      <div>
        <small>ALTYAZI ARAŞTIRMA</small>
        <h2>Kelime ve ifade taraması</h2>
        <p>Yerelde arşivlenmiş YouTube altyazılarını bir veya daha fazla terimle tara. Sonuçlarda yalnız eşleşmenin cümlesi; noktalamasız uzun altyazılarda ise kontrollü bağlam penceresi gösterilir.</p>
      </div>
      <div className="subtitle-research-note">Çoklu terim · Türkçe duyarlı harf katlama · kompakt bağlam · Markdown rapor</div>
    </section>

    <section className="subtitle-search-panel panel">
      <form className="subtitle-search-form" onSubmit={submit}>
        <div className="subtitle-term-builder">
          <label className="subtitle-query-field"><span>Kelime veya ifade</span><div className="subtitle-term-input-row"><input autoFocus value={draftTerm} onChange={(event) => setDraftTerm(event.target.value)} onKeyDown={handleTermKeyDown} placeholder="Terim yaz ve Enter'a bas…"/><button className="secondary-button" type="button" disabled={!normalizeTerm(draftTerm) || terms.length >= MAX_TERMS} onClick={() => addTerm()}>Ekle</button></div></label>
          <div className="subtitle-term-chips">
            {terms.map((term) => <button type="button" key={termKey(term)} onClick={() => removeTerm(term)} title="Terimi kaldır"><span>{term}</span><b>×</b></button>)}
            {!terms.length && <small>Tek kelime veya “kral cin” gibi çok kelimeli bir ifade ekleyebilirsin. En fazla {MAX_TERMS} terim.</small>}
          </div>
        </div>
        <label><span>Kanal</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">Tüm kanallar</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title || channel.handle || channel.id}</option>)}</select></label>
        <label><span>Çoklu arama</span><select value={searchMode} onChange={(event) => setSearchMode(event.target.value as SubtitleSearchMode)}><option value="independent">Bağımsız · herhangi biri</option><option value="all-in-video">Aynı videoda · hepsi</option></select></label>
        <label><span>Eşleşme</span><select value={matchMode} onChange={(event) => setMatchMode(event.target.value as SubtitleMatchMode)}><option value="contains">İçeren · ekleri yakala</option><option value="whole-word">Tam kelime/ifade</option></select></label>
        <label><span>Sırala</span><select value={sort} onChange={(event) => setSort(event.target.value as SubtitleSortMode)}><option value="date">Tarih · yeni önce</option><option value="occurrences">Kullanım · çok önce</option></select></label>
        <button className="primary-button subtitle-search-submit" type="submit" disabled={!effectiveTerms.length || busy || !analysis}>{busy ? "Taranıyor…" : effectiveTerms.length > 1 ? `${effectiveTerms.length} terimi tara` : "Altyazılarda ara"}</button>
      </form>
      {error && <div className="subtitle-search-error" role="alert">{error}</div>}
      {!analysis && <div className="subtitle-search-error">Altyazı analiz köprüsü yüklenemedi. Studio'yu yeniden başlat.</div>}
    </section>

    {report && <>
      <div className="subtitle-report-metrics">
        <Metric label="Taranan altyazı" value={report.transcriptCount} note="yerel arşiv"/>
        <Metric label="Aranan terim" value={report.terms.length} note={searchModeLabel(report.searchMode)}/>
        <Metric label="Eşleşen video" value={report.videoCount} note="sonuç bulunan"/>
        <Metric label="Toplam kullanım" value={report.totalOccurrences} note={matchModeLabel(report.matchMode)}/>
      </div>

      <section className="subtitle-term-summary panel">
        <div className="subtitle-term-summary-title"><small>TERİM ÖZETİ</small><span>{report.terms.length} terim aynı raporda</span></div>
        <div className="subtitle-term-summary-grid">{report.termStats.map((stat) => <div key={termKey(stat.term)}><strong>{stat.term}</strong><span>{stat.videoCount} video</span><b>{stat.occurrenceCount} kullanım</b></div>)}</div>
      </section>

      <section className="subtitle-report panel">
        <header className="subtitle-report-head">
          <div><small>RAPOR</small><h3>{report.terms.map((term) => `“${term}”`).join(" · ")}</h3><span>{report.videoCount ? `${report.videoCount} videoda ${report.totalOccurrences} toplam kullanım` : "Eşleşme bulunamadı"}</span></div>
          <div className="subtitle-report-actions"><button className="secondary-button" disabled={!report.videoCount} onClick={() => void copyReport()}>{copied ? "Kopyalandı" : "Raporu kopyala"}</button><button className="secondary-button" disabled={!report.videoCount} onClick={exportReport}>{exported ? "Dışa aktarıldı" : "Markdown dışa aktar"}</button></div>
        </header>
        {report.results.length
          ? <div className="subtitle-report-results">{report.results.map((video) => <article className="subtitle-result-video" key={video.videoId}>
              <div className="subtitle-result-video-head">
                <div><button className="subtitle-video-link" onClick={() => void openVideo(video)}>{video.title}</button><small>{formatDate(video.publishedAt)}{video.channelTitle ? ` · ${video.channelTitle}` : ""}{video.language ? ` · ${video.language}` : ""}</small><div className="subtitle-video-term-badges">{video.terms.map((termResult) => <span key={termKey(termResult.term)}>{termResult.term} · {termResult.occurrenceCount}</span>)}</div></div>
                <strong>{video.occurrenceCount} kullanım</strong>
              </div>
              <div className="subtitle-video-matches">{video.terms.map((termResult) => <section className="subtitle-term-result" key={termKey(termResult.term)}>
                <div className="subtitle-term-result-head"><strong>{termResult.term}</strong><span>{termResult.occurrenceCount} kullanım</span></div>
                <div className="subtitle-sentence-list">{termResult.contexts.map((match, index) => <div className="subtitle-sentence" key={`${video.videoId}-${termKey(termResult.term)}-${index}`}><span>{index + 1}</span><p>{highlightedContext(match.context, termResult.term)}{match.occurrenceCount > 1 && <small>{match.occurrenceCount}× bu bağlamda</small>}{match.truncated && <small>kontrollü bağlam</small>}</p></div>)}</div>
              </section>)}</div>
            </article>)}</div>
          : <div className="subtitle-report-empty"><strong>Bu terimlerle eşleşme bulunamadı.</strong><span>{report.transcriptCount ? `${report.transcriptCount} arşivlenmiş altyazı tarandı.` : "Önce Video Arşivi bölümünden altyazıları yerel arşive al."}</span></div>}
      </section>
    </>}
  </div>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="subtitle-report-metric panel"><span>{label}</span><strong>{new Intl.NumberFormat("tr-TR").format(value)}</strong><small>{note}</small></div>;
}
