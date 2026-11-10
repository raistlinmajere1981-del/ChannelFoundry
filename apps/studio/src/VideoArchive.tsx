import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_PAGE_SIZE = 50;
const INITIAL_MEDIA_OPTIONS: StudioYoutubeChannelMediaOptions = {
  channelId: "",
  metadataLanguage: "tr",
  subtitleLanguages: ["tr", "en"],
  thumbnailSize: "standard",
};
const channelLanguages = [
  ["tr", "Türkçe"], ["en", "İngilizce"], ["de", "Almanca"], ["fr", "Fransızca"],
  ["es", "İspanyolca"], ["ar", "Arapça"], ["ru", "Rusça"],
] as const;

type DurationFilter = "all" | "0-10" | "10-30" | "30-60" | "60+";
type ArchiveFilter = "all" | "missing" | "ready";
type SortKey = "date" | "subtitle" | "archive";
type SortDirection = "asc" | "desc";
type CatalogView = "list" | "grid";
type SyncNotice = { text: string; tone: "active" | "success" | "canceled" | "error" };
type ArchiveProgress = {
  total: number;
  processed: number;
  completed: number;
  failed: number;
  currentTitle: string;
};

function archiveProgressLabel(progress: ArchiveProgress) {
  return `İşlenen ${progress.processed}/${progress.total} · Kalan ${Math.max(0, progress.total - progress.processed)} · Başarılı ${progress.completed} · Hatalı ${progress.failed}`;
}

function archiveOperationId() {
  return `archive_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatDate(value: string) {
  if (!value) return "Tarih bilinmiyor";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR").format(date);
}

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth(), day: today.getDate() };
}

function CalendarField({ placeholder, value, onChange, open, onOpenChange }: { placeholder: string; value: string; onChange: (value: string) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [month, setMonth] = useState(() => dateParts(value));
  const selected = dateParts(value);
  const firstWeekday = (new Date(month.year, month.month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(month.year, month.month, 1));
  const shiftMonth = (amount: number) => setMonth((current) => {
    const date = new Date(current.year, current.month + amount, 1);
    return { ...current, year: date.getFullYear(), month: date.getMonth() };
  });
  const selectDay = (day: number) => {
    onChange(`${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    onOpenChange(false);
  };
  const chooseToday = () => {
    const today = new Date();
    setMonth({ year: today.getFullYear(), month: today.getMonth(), day: today.getDate() });
    onChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
    onOpenChange(false);
  };

  return <div className="archive-date-field">
    <button type="button" className={`archive-date-trigger${value ? " has-value" : ""}`} aria-label={placeholder} aria-expanded={open} onClick={() => { setMonth(dateParts(value)); onOpenChange(!open); }}>
      <span>{value ? formatDate(value) : placeholder}</span><b aria-hidden="true">□</b>
    </button>
    {value && <button type="button" className="archive-date-clear" aria-label={`${placeholder} temizle`} title="Tarihi temizle" onClick={() => onChange("")}>×</button>}
    {open && <div className="archive-calendar" role="dialog" aria-label={`${placeholder} seçimi`}>
      <header><button type="button" aria-label="Önceki ay" onClick={() => shiftMonth(-1)}>‹</button><strong>{monthLabel}</strong><button type="button" aria-label="Sonraki ay" onClick={() => shiftMonth(1)}>›</button></header>
      <div className="archive-calendar-weekdays">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="archive-calendar-days">{Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1).map((day, index) => day == null ? <span key={`blank-${index}`}/> : <button type="button" key={day} className={value && selected.year === month.year && selected.month === month.month && selected.day === day ? "selected" : ""} onClick={() => selectDay(day)}>{day}</button>)}</div>
      <footer><button type="button" onClick={() => onChange("")}>Temizle</button><button type="button" onClick={chooseToday}>Bugün</button></footer>
    </div>}
  </div>;
}

function weekday(value: string) {
  if (!value) return -1;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? -1 : date.getDay();
}

function matchesDuration(value: number | null, filter: DurationFilter) {
  if (filter === "all") return true;
  if (value == null) return false;
  const minutes = value / 60;
  if (filter === "0-10") return minutes < 10;
  if (filter === "10-30") return minutes >= 10 && minutes < 30;
  if (filter === "30-60") return minutes >= 30 && minutes < 60;
  return minutes >= 60;
}

function subtitleRank(video: StudioYoutubeCatalogVideo) {
  if (video.hasTranscript) return 4;
  if (video.subtitleStatus === "manual") return 3;
  if (video.subtitleStatus === "automatic") return 2;
  if (video.subtitleStatus === "none") return 1;
  return 0;
}

function archiveRank(video: StudioYoutubeCatalogVideo) {
  return video.hasTranscript ? 1 : 0;
}

function subtitleLabel(video: StudioYoutubeCatalogVideo) {
  if (video.subtitleIgnored) return "Eksik";
  if (video.subtitleStatus === "manual") return "Manuel";
  if (video.subtitleStatus === "automatic") return "Otomatik";
  if (video.subtitleStatus === "none") return "Yok";
  if (video.detailCheckStatus === "unavailable") return "Erişilemedi";
  if (video.detailCheckStatus === "retry") return "Tekrar";
  return "—";
}

function youtubeVideoUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function progressLabel(progress: StudioYoutubeSyncProgress | null) {
  if (!progress) return "";
  if (progress.phase === "preparing") return progress.currentTitle || "Kanal taraması hazırlanıyor…";
  if (progress.phase === "catalog") return "Kanal video listesi denetleniyor…";
  if (progress.phase === "scanning") return progress.total
    ? `Tarih ve altyazılar taranıyor · ${progress.processed} / ${progress.total} video · %${progress.percent}`
    : `Tarih ve altyazılar taranıyor · ${progress.processed} video`;
  if (progress.phase === "thumbnails") return progress.total
    ? `Thumbnail cache hazırlanıyor · ${progress.processed} / ${progress.total} · %${progress.percent}`
    : "Thumbnail cache denetleniyor…";
  if (progress.phase === "saving") return "Katalog SQLite'a kaydediliyor…";
  if (progress.phase === "canceling") return "İşlem durduruluyor…";
  if (progress.phase === "canceled") return "Senkronizasyon iptal edildi.";
  return "Senkronizasyon tamamlandı.";
}

export default function VideoArchive() {
  const bridge = window.channelFoundryStudio;
  const [tool, setTool] = useState<StudioTranscriptToolStatus | null>(null);
  const [channels, setChannels] = useState<StudioYoutubeChannel[]>([]);
  const [videos, setVideos] = useState<StudioYoutubeCatalogVideo[]>([]);
  const [stats, setStats] = useState<StudioYoutubeCatalogStats>({ total: 0, imported: 0, transcripts: 0, pendingImport: 0 });
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [openDateField, setOpenDateField] = useState<"from" | "to" | null>(null);
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [includeShorts, setIncludeShorts] = useState(false);
  const [includeLive, setIncludeLive] = useState(false);
  const [includeMembersOnly, setIncludeMembersOnly] = useState(false);
  const [showMissingSubtitles, setShowMissingSubtitles] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [catalogView, setCatalogView] = useState<CatalogView>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [busy, setBusy] = useState<"recent" | "full" | "archive-bulk" | string | null>(null);
  const [syncProgress, setSyncProgress] = useState<StudioYoutubeSyncProgress | null>(null);
  const [syncNotice, setSyncNotice] = useState<SyncNotice | null>(null);
  const [archiveNotice, setArchiveNotice] = useState<SyncNotice | null>(null);
  const [archiveProgress, setArchiveProgress] = useState<ArchiveProgress | null>(null);
  const [archiveCanceling, setArchiveCanceling] = useState(false);
  const archiveAbortRef = useRef(false);
  const archiveIdRef = useRef<string | null>(null);
  const archivePauseWakeRef = useRef<(() => void) | null>(null);
  const [mediaOptions, setMediaOptions] = useState<StudioYoutubeChannelMediaOptions | null>(null);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!bridge) return;
    const [nextTool, nextChannels, nextVideos, nextStats, nextMediaOptions] = await Promise.all([
      bridge.youtubeCatalogStatus(),
      bridge.youtubeCatalogChannels(),
      bridge.youtubeCatalogVideos({}),
      bridge.youtubeCatalogStats(),
      bridge.youtubeChannelMediaOptions(),
    ]);
    setTool(nextTool);
    setChannels(nextChannels);
    setVideos(nextVideos);
    setStats(nextStats);
    setMediaOptions(nextMediaOptions);
    setSelected((current) => new Set([...current].filter((videoId) => nextVideos.some((video) => video.videoId === videoId && !video.hasTranscript && !video.subtitleIgnored))));
  };

  useEffect(() => {
    void load().catch((reason) => setSyncNotice({ text: `Katalog yüklenemedi · ${errorText(reason)}`, tone: "error" }));
    const stopData = bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
    const stopProgress = bridge?.onYoutubeCatalogProgress?.((progress) => setSyncProgress(progress));
    return () => {
      archiveAbortRef.current = true;
      archivePauseWakeRef.current?.();
      if (archiveIdRef.current) void bridge?.transcriptArchiveCancel({ archiveOperationId: archiveIdRef.current }).catch(() => undefined);
      stopData?.();
      stopProgress?.();
    };
  }, []);

  const saveMediaOptions = async (next: Partial<Omit<StudioYoutubeChannelMediaOptions, "channelId">>) => {
    if (!bridge || !mediaOptions || busy || optionsBusy) return;
    setOptionsBusy(true);
    setSyncNotice(null);
    try {
      const updated = await bridge.youtubeChannelMediaOptionsSave({ ...mediaOptions, ...next });
      setMediaOptions(updated);
      // Ignore entries are scoped to the selected subtitle languages.
      // Refresh their visibility after the language preferences change.
      await load();
      setSyncNotice({ text: "Kanalın dil ve görsel tercihleri kaydedildi; sonraki senkronizasyon ve altyazı arşivlemesinde kullanılacak.", tone: "success" });
    } catch (reason) {
      setSyncNotice({ text: `Kanal tercihleri kaydedilemedi · ${errorText(reason)}`, tone: "error" });
    } finally {
      setOptionsBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    const matches = videos.filter((video) => {
      if (!showMissingSubtitles && video.subtitleIgnored) return false;
      if (term && !`${video.title} ${video.videoId}`.toLocaleLowerCase("tr-TR").includes(term)) return false;
      if (!matchesDuration(video.durationSeconds, duration)) return false;
      if (dateFrom && (!video.publishedAt || video.publishedAt < dateFrom)) return false;
      if (dateTo && (!video.publishedAt || video.publishedAt > dateTo)) return false;
      if (weekdays.size && !weekdays.has(weekday(video.publishedAt))) return false;
      if (archiveFilter === "missing" && video.hasTranscript) return false;
      if (archiveFilter === "ready" && !video.hasTranscript) return false;
      return true;
    });
    return matches.map((video, index) => ({ video, index })).sort((left, right) => {
      let comparison = 0;
      if (sortKey === "date") comparison = left.video.publishedAt.localeCompare(right.video.publishedAt);
      if (sortKey === "subtitle") comparison = subtitleRank(left.video) - subtitleRank(right.video);
      if (sortKey === "archive") comparison = archiveRank(left.video) - archiveRank(right.video);
      if (comparison === 0) comparison = right.video.publishedAt.localeCompare(left.video.publishedAt) || left.index - right.index;
      return sortDirection === "asc" ? comparison : -comparison;
    }).map(({ video }) => video);
  }, [videos, showMissingSubtitles, query, duration, archiveFilter, dateFrom, dateTo, weekdays, sortKey, sortDirection]);

  useEffect(() => { setPage(1); }, [showMissingSubtitles, query, duration, archiveFilter, dateFrom, dateTo, weekdays]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const filteredSelectable = filtered.filter((video) => !video.hasTranscript && !video.subtitleIgnored);
  const selectedResultCount = filteredSelectable.filter((video) => selected.has(video.videoId)).length;
  const allResultsSelected = Boolean(filteredSelectable.length) && selectedResultCount === filteredSelectable.length;
  const availableSubtitleCount = videos.filter((video) => video.subtitleStatus === "manual" || video.subtitleStatus === "automatic").length;
  const archivedTranscriptCount = videos.filter((video) => video.hasTranscript).length;
  const excludedSubtitleCount = videos.filter((video) => video.subtitleIgnored).length;
  const unarchivedTranscriptCount = videos.filter((video) => !video.hasTranscript && !video.subtitleIgnored).length;
  const displayedMediaOptions = mediaOptions ?? INITIAL_MEDIA_OPTIONS;
  const primarySubtitle = displayedMediaOptions.subtitleLanguages[0] || "tr";
  const fallbackSubtitle = displayedMediaOptions.subtitleLanguages[1] || "";

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedResultCount > 0 && !allResultsSelected;
  }, [selectedResultCount, allResultsSelected, catalogView]);

  const sync = async (mode: "recent" | "full") => {
    if (!bridge || optionsBusy) return;
    if (mode === "full" && channels.length && !confirm("Tam senkronizasyon seçili kapsamdaki tüm videoların tarih ve altyazı bilgisini yeniden tarayacak, eksik thumbnail'leri yerel cache'e alacak. Ayrıntılı tarama biraz zaman alabilir. Devam edilsin mi?")) return;
    setBusy(mode);
    setCanceling(false);
    setSyncNotice(null);
    setSyncProgress({ phase: "preparing", processed: 0, total: 0, percent: 0, currentTitle: "" });
    try {
      const result = await bridge.youtubeCatalogSync({ mode, excludeShorts: !includeShorts, excludeLive: !includeLive, excludeMembersOnly: !includeMembersOnly });
      if (!result.ok) {
        setSyncNotice({ text: "Senkronizasyon iptal edildi; mevcut katalog verileri korundu.", tone: "canceled" });
        return;
      }
      await load();
      const detailedReady = result.detailStats.skipped + result.detailStats.completed;
      setSyncNotice({
        text: `Senkronizasyon tamamlandı · ${result.newCount} yeni · ${result.updatedCount} katalog${result.removedCount ? ` · ${result.removedCount} kapsam dışı kaldırıldı` : ""} · ${detailedReady} ayrıntı hazır · ${result.detailStats.unavailable} sonuç alınamadı${result.detailStats.deferred ? ` · ${result.detailStats.deferred} kontrollü tekrar bekliyor` : ""} · ${result.archivedThumbnailCount} thumbnail arşivde${result.cachedCount ? ` · ${result.cachedCount} yeni indirildi` : ""}.`,
        tone: "success",
      });
    } catch (reason) {
      setSyncNotice({ text: `Senkronizasyon tamamlanamadı · ${errorText(reason)}`, tone: "error" });
    } finally {
      setBusy(null);
      setCanceling(false);
      setSyncProgress(null);
    }
  };

  const cancelSync = async () => {
    if (!bridge || canceling || !["recent", "full"].includes(String(busy))) return;
    setCanceling(true);
    setSyncProgress((current) => ({ phase: "canceling", processed: current?.processed || 0, total: current?.total || 0, percent: current?.percent || 0, currentTitle: current?.currentTitle || "" }));
    try {
      await bridge.youtubeCatalogCancel();
    } catch (reason) {
      setSyncNotice({ text: `İşlem durdurulamadı · ${errorText(reason)}`, tone: "error" });
      setCanceling(false);
    }
  };

  const cancelArchive = async () => {
    if (!bridge || !archiveIdRef.current || archiveCanceling) return;
    archiveAbortRef.current = true;
    setArchiveCanceling(true);
    archivePauseWakeRef.current?.();
    try {
      // A cancellation between videos still stops the queue even when there
      // is no child process to terminate at that exact instant.
      await bridge.transcriptArchiveCancel({ archiveOperationId: archiveIdRef.current });
    } catch (reason) {
      setArchiveNotice({ text: `Çalışan indirme durdurulamadı · ${errorText(reason)}`, tone: "error" });
      setArchiveCanceling(false); // IPC error: permit another stop attempt.
    }
  };

  const pauseBetweenVideos = () => new Promise<void>((resolve) => {
    if (archiveAbortRef.current) return resolve();
    const timer = setTimeout(() => {
      archivePauseWakeRef.current = null;
      resolve();
    }, 1400);
    archivePauseWakeRef.current = () => {
      clearTimeout(timer);
      archivePauseWakeRef.current = null;
      resolve();
    };
  });

  const archiveVideo = async (video: StudioYoutubeCatalogVideo) => {
    if (!bridge || video.hasTranscript || video.subtitleIgnored || busy) return;
    const operationId = archiveOperationId();
    archiveAbortRef.current = false;
    archiveIdRef.current = operationId;
    setArchiveCanceling(false);
    setArchiveProgress({ total: 1, processed: 0, completed: 0, failed: 0, currentTitle: video.title });
    setArchiveNotice(null);
    setBusy(video.videoId);
    try {
      const result = await bridge.transcriptFetchYoutube({ videoId: video.videoId, archiveOperationId: operationId });
      if (archiveAbortRef.current) {
        setArchiveNotice({ text: "Arşivleme iptal edildi; mevcut kayıtlar korundu.", tone: "canceled" });
      } else {
        setArchiveNotice({ text: `“${video.title}” altyazısı arşivlendi · ${result.wordCount.toLocaleString("tr-TR")} kelime.`, tone: "success" });
      }
      await load();
      await bridge.refreshMain().catch(() => undefined);
    } catch (reason) {
      // Missing subtitles now enter a persistent ignore list; refresh the row
      // immediately so it disappears unless "Eksik altyazılar" is checked.
      await load().catch(() => undefined);
      setArchiveNotice(archiveAbortRef.current
        ? { text: "Arşivleme iptal edildi; mevcut kayıtlar korundu.", tone: "canceled" }
        : { text: `Altyazı arşivlenemedi · ${errorText(reason)}`, tone: "error" });
    } finally {
      archiveIdRef.current = null;
      setArchiveProgress(null);
      setArchiveCanceling(false);
      setBusy(null);
    }
  };

  const retryIgnoredVideo = async (video: StudioYoutubeCatalogVideo) => {
    if (!bridge || busy) return;
    try {
      await bridge.transcriptIgnoreClear({ videoId: video.videoId });
      await load();
      await archiveVideo({ ...video, subtitleIgnored: false });
    } catch (reason) {
      setArchiveNotice({ text: "Video yeniden denemeye açılamadı · " + errorText(reason), tone: "error" });
    }
  };

  const openYoutubeVideo = async (video: StudioYoutubeCatalogVideo) => {
    if (!bridge) return;
    try {
      await bridge.openExternalUrl(youtubeVideoUrl(video.videoId));
    } catch (reason) {
      setSyncNotice({ text: `YouTube videosu açılamadı · ${errorText(reason)}`, tone: "error" });
    }
  };

  const toggleSelected = (videoId: string) => {
    if (busy) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(videoId)) next.delete(videoId); else next.add(videoId);
      return next;
    });
  };

  const selectAllResults = () => {
    if (busy) return;
    const ids = filteredSelectable.map((video) => video.videoId);
    setSelected((current) => new Set([...current, ...ids]));
    setArchiveNotice({ text: `${ids.length} sonuç seçildi.`, tone: "success" });
  };

  const toggleAllResults = () => {
    if (busy) return;
    if (!allResultsSelected) {
      selectAllResults();
      return;
    }
    const resultIds = new Set(filteredSelectable.map((video) => video.videoId));
    setSelected((current) => new Set([...current].filter((videoId) => !resultIds.has(videoId))));
  };

  const archiveSelected = async () => {
    if (!bridge || !selected.size || busy) return;
    const targets = videos.filter((video) => selected.has(video.videoId) && !video.hasTranscript && !video.subtitleIgnored);
    if (!targets.length) return;
    if (!confirm(`${targets.length} video için YouTube altyazısı sırayla arşivlensin mi? İşlem sırasında Studio açık kalmalı.`)) return;
    const operationId = archiveOperationId();
    archiveAbortRef.current = false;
    archiveIdRef.current = operationId;
    setArchiveCanceling(false);
    setArchiveNotice(null);
    setArchiveProgress({ total: targets.length, processed: 0, completed: 0, failed: 0, currentTitle: "" });
    setBusy("archive-bulk");
    let completed = 0;
    let failed = 0;
    let processed = 0;
    let canceled = false;
    try {
      for (const video of targets) {
        if (archiveAbortRef.current) { canceled = true; break; }
        setArchiveProgress({ total: targets.length, processed, completed, failed, currentTitle: video.title });
        try {
          await bridge.transcriptFetchYoutube({ videoId: video.videoId, archiveOperationId: operationId });
          if (archiveAbortRef.current) { canceled = true; break; }
          completed += 1;
        } catch (reason) {
          if (archiveAbortRef.current) { canceled = true; break; }
          failed += 1;
        }
        processed += 1;
        setArchiveProgress({ total: targets.length, processed, completed, failed, currentTitle: video.title });
        if (processed < targets.length) await pauseBetweenVideos();
      }
      await load();
      if (!canceled && !failed) setSelected(new Set());
      setArchiveNotice(canceled
        ? { text: `Arşivleme iptal edildi · ${completed} başarılı · ${failed} hatalı · ${targets.length - processed} kalan. Mevcut kayıtlar korundu.`, tone: "canceled" }
        : { text: `${completed} altyazı arşivlendi${failed ? ` · ${failed} video arşivlenemedi` : ""}.`, tone: failed ? "error" : "success" });
      await bridge.refreshMain().catch(() => undefined);
    } catch (reason) {
      setArchiveNotice({ text: `Altyazı arşivleme kuyruğu tamamlanamadı · ${errorText(reason)}`, tone: "error" });
    } finally {
      archiveIdRef.current = null;
      archivePauseWakeRef.current = null;
      setArchiveProgress(null);
      setArchiveCanceling(false);
      setBusy(null);
    }
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const changeSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((current) => current === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setSortDirection("desc");
    }
    setPage(1);
  };

  const dayLabels = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const syncBusy = busy === "recent" || busy === "full";
  const archiveBusy = Boolean(busy && !syncBusy);
  return <div className="video-archive-page">
    <section className="channel-sync panel">
      <div className="channel-sync-controls">
        <div className="channel-sync-options">
          <div className="channel-scan-options" aria-label="Kanal tarama kapsamı">
            <label><input type="checkbox" checked={includeShorts} disabled={Boolean(busy) || optionsBusy} onChange={(event) => setIncludeShorts(event.target.checked)}/><span>Kısa videolar</span></label>
            <label><input type="checkbox" checked={includeLive} disabled={Boolean(busy) || optionsBusy} onChange={(event) => setIncludeLive(event.target.checked)}/><span>Canlı yayınlar</span></label>
            <label><input type="checkbox" checked={includeMembersOnly} disabled={Boolean(busy) || optionsBusy} onChange={(event) => setIncludeMembersOnly(event.target.checked)}/><span>Üyelere özel</span></label>
            <label title="Altyazısı bulunamadığı için tekrar denenmeyen videoları listede gösterir."><input type="checkbox" checked={showMissingSubtitles} onChange={(event) => setShowMissingSubtitles(event.target.checked)}/><span>Eksik altyazılar{excludedSubtitleCount ? " (" + excludedSubtitleCount + ")" : ""}</span></label>
          </div>
          <div className="channel-media-options" aria-label="Kanal dil ve görsel tercihleri">
            <label><span>Başlık dili</span><select aria-label="Kanal başlık ve metadata dili" value={displayedMediaOptions.metadataLanguage} disabled={!mediaOptions || Boolean(busy) || optionsBusy} onChange={(event) => void saveMediaOptions({ metadataLanguage: event.target.value })}>
              <option value="original">Özgün dil</option>
              {channelLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select></label>
            <label><span>Altyazı</span><select aria-label="Kanal öncelikli altyazı dili" value={primarySubtitle} disabled={!mediaOptions || Boolean(busy) || optionsBusy} onChange={(event) => void saveMediaOptions({ subtitleLanguages: [event.target.value, fallbackSubtitle].filter(Boolean) })}>
              {channelLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select></label>
            <label><span>Yedek altyazı</span><select aria-label="Kanal yedek altyazı dili" value={fallbackSubtitle} disabled={!mediaOptions || Boolean(busy) || optionsBusy} onChange={(event) => void saveMediaOptions({ subtitleLanguages: [primarySubtitle, event.target.value].filter(Boolean) })}>
              <option value="">Kullanma</option>
              {channelLanguages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select></label>
            <label><span>Thumbnail</span><select aria-label="Kanal thumbnail boyutu" value={displayedMediaOptions.thumbnailSize} disabled={!mediaOptions || Boolean(busy) || optionsBusy} onChange={(event) => void saveMediaOptions({ thumbnailSize: event.target.value as StudioYoutubeChannelMediaOptions["thumbnailSize"] })}>
              <option value="small">Kompakt</option>
              <option value="standard">Standart</option>
              <option value="large">Büyük</option>
            </select></label>
          </div>
        </div>
        {(syncBusy || optionsBusy || syncNotice) && <div className={`channel-sync-progress${syncBusy || optionsBusy ? " active" : ""}${!syncBusy && !optionsBusy && syncNotice ? ` ${syncNotice.tone}` : ""}`} role="status" aria-live="polite" title={optionsBusy ? "" : progressLabel(syncProgress) || syncNotice?.text || ""}>{optionsBusy ? "Kanal tercihleri kaydediliyor…" : progressLabel(syncProgress) || syncNotice?.text || ""}</div>}
        <button className={`primary-button${syncBusy ? " channel-cancel-button" : ""}`} disabled={!tool?.available || optionsBusy || (Boolean(busy) && !syncBusy) || canceling} onClick={() => syncBusy ? void cancelSync() : void sync("full")}>{syncBusy ? canceling ? "Durduruluyor…" : "İşlemi iptal et" : "Tam senkronizasyon"}</button>
      </div>
    </section>

    <div className="catalog-metrics">
      <Metric label="Katalog" value={stats.total} note="kaynak video"/>
      <Metric label="Altyazı mevcut" value={availableSubtitleCount} note="YouTube"/>
      <Metric label="Arşivde" value={archivedTranscriptCount} note="yerel"/>
      <Metric label="Arşivlenmemiş" value={unarchivedTranscriptCount} note="bekliyor"/>
    </div>

    <section className={`catalog-workspace panel${filtersVisible ? "" : " filters-hidden"}`}>
      {filtersVisible && <aside className="catalog-filters">
        <div className="filter-title"><small>FİLTRELER</small><strong>{filtered.length} sonuç</strong></div>
        <div className="date-filter"><span>Tarih aralığı</span><CalendarField placeholder="Başlangıç tarihi" value={dateFrom} onChange={setDateFrom} open={openDateField === "from"} onOpenChange={(open) => setOpenDateField(open ? "from" : null)}/><CalendarField placeholder="Bitiş tarihi" value={dateTo} onChange={setDateTo} open={openDateField === "to"} onOpenChange={(open) => setOpenDateField(open ? "to" : null)}/></div>
        <label><span>Başlıkta ara</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Video ara…"/></label>
        <label><span>Süre</span><select value={duration} onChange={(event) => setDuration(event.target.value as DurationFilter)}><option value="all">Tüm süreler</option><option value="0-10">0–10 dk</option><option value="10-30">10–30 dk</option><option value="30-60">30–60 dk</option><option value="60+">60+ dk</option></select></label>
        <label><span>Arşiv durumu</span><select value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as ArchiveFilter)}><option value="all">Tümü</option><option value="missing">Arşivlenmemiş</option><option value="ready">Arşivde</option></select></label>
        <div className="weekday-filter"><span>Haftanın günü</span><div>{dayLabels.map((label, day) => <button key={day} className={weekdays.has(day) ? "active" : ""} onClick={() => toggleWeekday(day)}>{label}</button>)}</div></div>
        <button className="text-button clear-filters" onClick={() => { setQuery(""); setDuration("all"); setArchiveFilter("all"); setDateFrom(""); setDateTo(""); setWeekdays(new Set()); }}>Filtreleri temizle</button>
      </aside>}

      <div className="catalog-table-wrap">
        <div className="catalog-selection-toolbar">
          <button type="button" className={`catalog-filter-toggle${filtersVisible ? " active" : ""}`} aria-label={filtersVisible ? "Filtreyi gizle" : "Filtreyi göster"} title={filtersVisible ? "Filtreyi gizle" : "Filtreyi göster"} aria-pressed={filtersVisible} onClick={() => setFiltersVisible((current) => !current)}><svg className="filter-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12M5 2.5v3M11 6.5v3M7 10.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></button>
          <div className="catalog-selection-actions">
            <button className="secondary-button" disabled={Boolean(busy) || !filteredSelectable.length} onClick={selectAllResults}>Arşivlenmemişleri seç <small>{filteredSelectable.length}</small></button>
            <button className="text-button" disabled={Boolean(busy) || !selected.size} onClick={() => setSelected(new Set())}>Seçimi temizle</button>
          </div>
          <div className="catalog-page-controls">
            <label><select aria-label="Sayfada gösterilecek kayıt adedi" value={pageSize} disabled={Boolean(busy)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={25}>25 kayıt</option><option value={50}>50 kayıt</option><option value={100}>100 kayıt</option><option value={200}>200 kayıt</option></select></label>
            {pageCount > 1 && <div className="catalog-pagination catalog-pagination-toolbar"><button aria-label="Önceki sayfa" disabled={page <= 1 || Boolean(busy)} onClick={() => setPage((value) => Math.max(1, value - 1))}>←</button><span>{page} / {pageCount}</span><button aria-label="Sonraki sayfa" disabled={page >= pageCount || Boolean(busy)} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>→</button></div>}
          </div>
          <div className="catalog-display-controls" aria-label="Katalog görünümü">
            <button type="button" aria-label="Liste görünümü" title="Liste" className={catalogView === "list" ? "active" : ""} aria-pressed={catalogView === "list"} onClick={() => setCatalogView("list")}>☷</button>
            <button type="button" aria-label="Kart görünümü" title="Kartlar" className={catalogView === "grid" ? "active" : ""} aria-pressed={catalogView === "grid"} onClick={() => setCatalogView("grid")}>▦</button>
          </div>
          <div className="catalog-toolbar-right">
            {(archiveProgress || archiveNotice) && <div className={`catalog-archive-progress${archiveBusy ? " active" : ""}${!archiveBusy && archiveNotice ? ` ${archiveNotice.tone}` : ""}`} role="status" aria-live="polite" title={archiveProgress?.currentTitle || archiveNotice?.text || ""}>
              {archiveProgress ? archiveProgressLabel(archiveProgress) : archiveNotice?.text}
            </div>}
            {archiveBusy
              ? <button className="primary-button channel-cancel-button" disabled={archiveCanceling} onClick={() => void cancelArchive()}>{archiveCanceling ? "Durduruluyor…" : "İptal et"}</button>
              : <button className="primary-button" disabled={Boolean(busy) || !selected.size || !tool?.available} onClick={() => void archiveSelected()}>Seçilenleri Arşivle</button>}
          </div>
        </div>
        {catalogView === "list"
          ? <div className="catalog-table-head"><span className="catalog-check"><input ref={selectAllRef} type="checkbox" aria-label="Bütün arşivlenmemiş sonuçları seç" title="Bütün arşivlenmemiş sonuçları seç" disabled={Boolean(busy) || !filteredSelectable.length} checked={allResultsSelected} onChange={toggleAllResults}/></span><span>Video</span><SortButton label="Tarih" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={changeSort}/><span>Süre</span><SortButton label="Altyazı" sortKey="subtitle" activeKey={sortKey} direction={sortDirection} onSort={changeSort}/><SortButton label="Arşiv" sortKey="archive" activeKey={sortKey} direction={sortDirection} onSort={changeSort}/></div>
          : <div className="catalog-card-head"><label><input ref={selectAllRef} type="checkbox" aria-label="Bütün arşivlenmemiş sonuçları seç" title="Bütün arşivlenmemiş sonuçları seç" disabled={Boolean(busy) || !filteredSelectable.length} checked={allResultsSelected} onChange={toggleAllResults}/><span>Bütün arşivlenmemiş sonuçlar</span></label><div><span>Sırala</span><SortButton label="Tarih" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={changeSort}/><SortButton label="Altyazı" sortKey="subtitle" activeKey={sortKey} direction={sortDirection} onSort={changeSort}/><SortButton label="Arşiv" sortKey="archive" activeKey={sortKey} direction={sortDirection} onSort={changeSort}/></div></div>}
        <div className={`catalog-rows${catalogView === "grid" ? " grid-view" : ""}`}>
          {visible.map((video) => <article className={`catalog-row ${selected.has(video.videoId) ? "selected" : ""}`} key={video.videoId}>
            <span className="catalog-check"><input type="checkbox" disabled={video.hasTranscript || video.subtitleIgnored || Boolean(busy)} checked={selected.has(video.videoId)} onChange={() => toggleSelected(video.videoId)}/></span>
            <div className="catalog-video-main"><img src={video.thumbnailUrl} alt=""/><div><a href={youtubeVideoUrl(video.videoId)} title="YouTube'da aç" onClick={(event) => { event.preventDefault(); void openYoutubeVideo(video); }}>{video.title}</a></div></div>
            <span className="catalog-date">{formatDate(video.publishedAt)}</span>
            <span className="catalog-duration">{formatDuration(video.durationSeconds)}</span>
            <span className={`catalog-subtitle-state ${video.subtitleIgnored ? "catalog-state" : video.subtitleStatus === "manual" ? "catalog-state good" : video.subtitleStatus === "automatic" ? "catalog-state pending" : "catalog-state"}`} title={[...video.subtitleLanguages, ...video.automaticCaptionLanguages].join(", ") || (video.detailRetryAt ? `Yeniden kontrol: ${new Date(video.detailRetryAt).toLocaleString("tr-TR")}` : "")}>{subtitleLabel(video)}</span>
            {video.hasTranscript
              ? <span className="catalog-archive-state">Arşivde</span>
              : video.subtitleIgnored
                ? <button className="row-action catalog-archive-action" disabled={Boolean(busy) || !tool?.available} title="Hariç tutma kaydını kaldırıp altyazıyı yeniden dene" onClick={() => void retryIgnoredVideo(video)}>Tekrar dene</button>
                : <button className="row-action catalog-archive-action" disabled={Boolean(busy) || !tool?.available} onClick={() => void archiveVideo(video)}>{busy === video.videoId ? "Arşivleniyor…" : "Altyazıyı arşivle"}</button>}
          </article>)}
          {!visible.length && <div className="catalog-empty"><strong>Bu filtrelerde video yok.</strong><span>Kanalı senkronize et veya filtreleri değiştir.</span></div>}
        </div>
      </div>
    </section>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="catalog-metric panel"><span>{label}</span><strong>{new Intl.NumberFormat("tr-TR").format(value)}</strong><small>{note}</small></div>;
}

function SortButton({ label, sortKey, activeKey, direction, onSort }: {
  label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  return <button className={`catalog-sort-button${active ? " active" : ""}`} type="button" onClick={() => onSort(sortKey)} aria-label={`${label} sütununu sırala`}>
    <span>{label}</span><b aria-hidden="true">{active ? direction === "desc" ? "↓" : "↑" : "↕"}</b>
  </button>;
}
