import { useCallback, useEffect, useRef, useState } from "react";
import AiActivityOverlay from "./AiActivityOverlay";
import { useAiWorkbenchStatus, type AiWorkbenchNoticeTone } from "./AiWorkbenchStatus";
import { selectAiMonitorFocus } from "./ai-monitor-focus.mjs";
import "./ai-activity-monitor.css";

type ActivityMode = "idle" | "video" | "universe" | "visual" | "error";

type ActivitySnapshot = {
  mode: ActivityMode;
  title: string;
  detail: string;
  model: string;
  progress: number;
  active: boolean;
  completed: number;
  total: number;
  errors: number;
};

type Props = {
  pipelineError?: string | null;
  summary: {
    errors: number;
    queue: number;
    review: number;
    approved: number;
  };
};

const idleSnapshot: ActivitySnapshot = {
  mode: "idle",
  title: "AI hazır",
  detail: "",
  model: "",
  progress: 0,
  active: false,
  completed: 0,
  total: 0,
  errors: 0,
};

function number(value: number) {
  return new Intl.NumberFormat("tr-TR").format(Math.max(0, value));
}

function noticeTitle(tone: AiWorkbenchNoticeTone) {
  if (tone === "success") return "İşlem tamamlandı";
  if (tone === "error") return "İşlem tamamlanamadı";
  return "İşlem bilgisi";
}

function activeModel(config: StudioAiConfig) {
  return config.model || (config.provider === "codex-cli" ? "Codex CLI · varsayılan" : "");
}

export default function AiActivityMonitor({ pipelineError, summary }: Props) {
  const bridge = window.channelFoundryStudio;
  const status = useAiWorkbenchStatus();
  const [snapshot, setSnapshot] = useState<ActivitySnapshot>(idleSnapshot);
  const [activitySnapshot, setActivitySnapshot] = useState<StudioAiActivitySnapshot | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const videoBaseline = useRef(0);
  const openOverlay = useCallback(() => setOverlayOpen(true), []);
  const closeOverlay = useCallback(() => setOverlayOpen(false), []);

  useEffect(() => {
    if (!status?.notice) return;
    const timeout = window.setTimeout(status.clear, status.notice.tone === "error" ? 12000 : 7000);
    return () => window.clearTimeout(timeout);
  }, [status?.notice, status?.clear]);

  useEffect(() => {
    if (!bridge) return;
    let canceled = false;

    const poll = async () => {
      try {
        const [videos, stats, universe, config, activity] = await Promise.all([
          bridge.aiAnalysisList(),
          bridge.aiAnalysisStats(),
          bridge.universeMergeStatus(),
          bridge.aiConfig(),
          bridge.aiActivitySnapshot(),
        ]);
        if (canceled) return;
        setActivitySnapshot(activity);

        const activeSession = activity.sessions.find((session) => session.id === activity.activeSessionId);
        const activeSessionModel = activeSession?.model || activeSession?.configuredModel || activity.activeModel;
        const activeSessionKind = String(activeSession?.kind ?? "");

        if (activeSessionKind === "visual") {
          videoBaseline.current = 0;
          setSnapshot({
            mode: "visual",
            title: "Görsel üretimi çalışıyor",
            detail: `${activeSession?.subject || "Görsel"} · ${activeSession?.stage || "Görsel hazırlanıyor"}`,
            model: activeSessionModel || activeModel(config),
            progress: 0,
            active: true,
            completed: 0,
            total: 1,
            errors: activeSession?.errorCount || 0,
          });
          return;
        }

        const run = universe.run;
        const remaining = stats.waiting + stats.running;
        const focus = selectAiMonitorFocus({ mergeState: run?.state, videoRemaining: remaining });
        if (run && focus === "universe") {
          const total = Math.max(1, run.totalChunks);
          const completed = Math.min(total, run.doneChunks);
          setSnapshot({
            mode: "universe",
            title: run.state === "running" ? "Evrene İşleme çalışıyor" : "Evrene İşleme sırada",
            detail: `${completed}/${total} parça · seviye ${run.level + 1} · ${run.analysisCount} kaynak video`,
            model: activeSessionKind === "universe" ? activeSessionModel : run.model || activeModel(config),
            progress: Math.max(2, Math.round((completed / total) * 100)),
            active: true,
            completed,
            total,
            errors: run.errorChunks,
          });
          return;
        }

        if (focus === "video") {
          if (!videoBaseline.current || remaining > videoBaseline.current) videoBaseline.current = remaining;
          const running = videos.find((video) => video.jobState === "running");
          const total = Math.max(1, videoBaseline.current);
          const completed = Math.max(0, total - remaining);
          setSnapshot({
            mode: "video",
            title: running ? "Video çözümleme çalışıyor" : "Video çözümleme sırada",
            detail: running ? `${running.title} · ${stats.waiting} bekliyor` : `${stats.waiting} video bekliyor`,
            model: activeSessionKind === "analysis" ? activeSessionModel : activeModel(config),
            progress: Math.max(0, Math.min(100, Math.round((completed / total) * 100))),
            active: true,
            completed,
            total,
            errors: stats.errors,
          });
          return;
        }

        videoBaseline.current = 0;
        setSnapshot({ ...idleSnapshot, model: activeModel(config), errors: stats.errors });
      } catch (error) {
        if (!canceled) setSnapshot({ ...idleSnapshot, mode: "error", title: "AI durum bilgisi okunamadı", detail: error instanceof Error ? error.message : String(error), errors: 1 });
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1200);
    return () => { canceled = true; window.clearInterval(timer); };
  }, [bridge]);

  if (!bridge) return null;
  const pct = Math.max(0, Math.min(100, snapshot.progress));
  const snapshotError = snapshot.mode === "error" ? snapshot.detail : null;
  const persistentError = pipelineError || snapshotError;
  const notice = status?.notice;
  const tone = notice?.tone ?? (persistentError ? "error" : snapshot.mode);
  const title = snapshot.active
    ? snapshot.title
    : notice
      ? noticeTitle(notice.tone)
      : snapshotError
        ? snapshot.title
        : pipelineError
          ? "Studio işlemi tamamlanamadı"
          : snapshot.title;
  const detail = notice?.message || persistentError || snapshot.detail;

  const indeterminate = snapshot.active && snapshot.mode !== "universe";
  return <><section className={`ai-activity panel ${tone}`} aria-label="AI Atölyesi durum ve mesaj alanı" onClick={openOverlay}>
    <div className="ai-activity-main">
      <div className="ai-activity-head">
        <div className="ai-activity-copy" role="status" aria-live="polite">

          <strong><i className={snapshot.active ? "pulse" : ""}/>{title}{snapshot.active && <b>{snapshot.mode === "universe" ? `${pct}%` : snapshot.mode === "video" ? `${snapshot.completed}/${snapshot.total}` : ""}</b>}</strong>
          {detail && <span title={detail} className={notice?.tone ?? (persistentError ? "error" : "")}>{detail}</span>}
        </div>
        <div className="ai-activity-trailing">
          {snapshot.active && <span className="ai-activity-progress-label">{snapshot.mode === "universe" ? `${snapshot.completed}/${snapshot.total} parça` : snapshot.mode === "video" ? `${snapshot.completed}/${snapshot.total} video` : "Görsel işleniyor"}</span>}
          <button type="button" className="ai-activity-model" onClick={(event) => { event.stopPropagation(); openOverlay(); }} aria-haspopup="dialog" aria-expanded={overlayOpen} title={snapshot.model ? `AI günlüğü · ${snapshot.model}` : "AI çalışma günlüğünü aç"}>
            <span className="ai-activity-model-label">Çalışma günlüğü</span><b aria-hidden="true">↗</b>
          </button>
        </div>
      </div>

      <div className={`ai-activity-progress ${snapshot.active ? "active" : ""} ${indeterminate ? "indeterminate" : ""}`} role="progressbar" aria-label="AI işlem ilerlemesi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : pct} aria-valuetext={indeterminate ? "İşlem sürüyor; kesin ilerleme yüzdesi bilinmiyor" : undefined}>
        <i style={{ width: indeterminate ? "25%" : snapshot.active ? `${pct}%` : notice?.tone === "success" ? "100%" : "0%" }}/>
      </div>
    </div>

    {(summary.errors > 0 || summary.queue > 0 || summary.review > 0 || summary.approved > 0) &&
      <div className="ai-activity-summary" aria-label="AI Atölyesi özeti">
        {summary.errors > 0 && <span className="error"><b>{number(summary.errors)}</b> hata</span>}
        {summary.queue > 0 && <span><b>{number(summary.queue)}</b> kuyruk</span>}
        {summary.review > 0 && <span><b>{number(summary.review)}</b> inceleme</span>}
        {summary.approved > 0 && <span className="ready"><b>{number(summary.approved)}</b> onaylı</span>}
      </div>}
  </section><AiActivityOverlay open={overlayOpen} onClose={closeOverlay} initialSnapshot={activitySnapshot}/></>;
}
