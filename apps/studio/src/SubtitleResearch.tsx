import { FormEvent, useEffect, useState } from "react";
import "./subtitle-research.css";

type SubtitleSearchSentence = { sentence: string; occurrenceCount: number };
type SubtitleSearchVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string;
  title: string;
  publishedAt: string;
  url: string;
  language: string;
  occurrenceCount: number;
  sentences: SubtitleSearchSentence[];
};
type SubtitleSearchReport = {
  query: string;
  matchMode: "literal";
  channelId: string;
  transcriptCount: number;
  videoCount: number;
  totalOccurrences: number;
  results: SubtitleSearchVideo[];
};
type SubtitleAnalysisBridge = {
  search(input: { query: string; channelId?: string }): Promise<SubtitleSearchReport>;
};

declare global {
  interface Window {
    channelFoundrySubtitleAnalysis?: SubtitleAnalysisBridge;
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(value: string) {
  if (!value) return "Tarih bilinmiyor";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR").format(date);
}

function reportText(report: SubtitleSearchReport) {
  const lines = [
    "Channel Foundry — Altyazı Arama Raporu",
    `Arama: ${report.query}`,
    `Taranan altyazı: ${report.transcriptCount}`,
    `Eşleşen video: ${report.videoCount}`,
    `Toplam kullanım: ${report.totalOccurrences}`,
    "",
  ];
  for (const video of report.results) {
    lines.push(`Video: ${video.title}`);
    lines.push(`Tarih: ${video.publishedAt || "—"}`);
    lines.push(`YouTube: ${video.url}`);
    lines.push(`Kullanım: ${video.occurrenceCount}`);
    for (const match of video.sentences) {
      lines.push(`- ${match.sentence}${match.occurrenceCount > 1 ? ` [${match.occurrenceCount} kullanım]` : ""}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function highlightedSentence(sentence: string, query: string) {
  const source = sentence.toLocaleLowerCase("tr-TR");
  const needle = query.toLocaleLowerCase("tr-TR");
  if (!needle) return sentence;
  const output = [];
  let offset = 0;
  let key = 0;
  while (offset < sentence.length) {
    const index = source.indexOf(needle, offset);
    if (index < 0) {
      output.push(sentence.slice(offset));
      break;
    }
    if (index > offset) output.push(sentence.slice(offset, index));
    output.push(<mark key={`match-${key++}`}>{sentence.slice(index, index + needle.length)}</mark>);
    offset = index + Math.max(1, needle.length);
  }
  return output;
}

export default function SubtitleResearch() {
  const studio = window.channelFoundryStudio;
  const analysis = window.channelFoundrySubtitleAnalysis;
  const [channels, setChannels] = useState<StudioYoutubeChannel[]>([]);
  const [query, setQuery] = useState("");
  const [channelId, setChannelId] = useState("");
  const [report, setReport] = useState<SubtitleSearchReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!studio) return;
    void studio.youtubeCatalogChannels().then(setChannels).catch((reason) => setError(errorText(reason)));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term || !analysis || busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      setReport(await analysis.search({ query: term, channelId }));
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
        <p>Yerelde arşivlenmiş YouTube altyazılarını tara. Eşleşmeler video bazında gruplanır ve aranan ifadenin geçtiği cümlenin tamamı rapora alınır.</p>
      </div>
      <div className="subtitle-research-note">Büyük/küçük harf duyarsız · literal arama · Türkçe ekli kullanımları da yakalar</div>
    </section>

    <section className="subtitle-search-panel panel">
      <form className="subtitle-search-form" onSubmit={submit}>
        <label className="subtitle-query-field"><span>Kelime veya ifade</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. rütbe, portal, frekans…" maxLength={200}/></label>
        <label><span>Kanal</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">Tüm kanallar</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title || channel.handle || channel.id}</option>)}</select></label>
        <button className="primary-button" type="submit" disabled={!query.trim() || busy || !analysis}>{busy ? "Taranıyor…" : "Altyazılarda ara"}</button>
      </form>
      {error && <div className="subtitle-search-error" role="alert">{error}</div>}
      {!analysis && <div className="subtitle-search-error">Altyazı analiz köprüsü yüklenemedi. Studio'yu yeniden başlat.</div>}
    </section>

    {report && <>
      <div className="subtitle-report-metrics">
        <Metric label="Taranan altyazı" value={report.transcriptCount} note="yerel arşiv"/>
        <Metric label="Eşleşen video" value={report.videoCount} note="sonuç bulunan"/>
        <Metric label="Toplam kullanım" value={report.totalOccurrences} note={`“${report.query}”`}/>
      </div>

      <section className="subtitle-report panel">
        <header className="subtitle-report-head">
          <div><small>RAPOR</small><h3>“{report.query}”</h3><span>{report.videoCount ? `${report.videoCount} videoda ${report.totalOccurrences} kullanım` : "Eşleşme bulunamadı"}</span></div>
          <button className="secondary-button" disabled={!report.videoCount} onClick={() => void copyReport()}>{copied ? "Kopyalandı" : "Raporu kopyala"}</button>
        </header>
        {report.results.length
          ? <div className="subtitle-report-results">{report.results.map((video) => <article className="subtitle-result-video" key={video.videoId}>
              <div className="subtitle-result-video-head">
                <div><button className="subtitle-video-link" onClick={() => void openVideo(video)}>{video.title}</button><small>{formatDate(video.publishedAt)}{video.channelTitle ? ` · ${video.channelTitle}` : ""}{video.language ? ` · ${video.language}` : ""}</small></div>
                <strong>{video.occurrenceCount} kullanım</strong>
              </div>
              <div className="subtitle-sentence-list">{video.sentences.map((match, index) => <div className="subtitle-sentence" key={`${video.videoId}-${index}`}><span>{index + 1}</span><p>{highlightedSentence(match.sentence, report.query)}{match.occurrenceCount > 1 && <small>{match.occurrenceCount}× aynı cümlede</small>}</p></div>)}</div>
            </article>)}</div>
          : <div className="subtitle-report-empty"><strong>Bu ifadeye rastlanmadı.</strong><span>{report.transcriptCount ? `${report.transcriptCount} arşivlenmiş altyazı tarandı.` : "Önce Video Arşivi bölümünden altyazıları yerel arşive al."}</span></div>}
      </section>
    </>}
  </div>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="subtitle-report-metric panel"><span>{label}</span><strong>{new Intl.NumberFormat("tr-TR").format(value)}</strong><small>{note}</small></div>;
}
