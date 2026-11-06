import { useEffect, useRef, useState } from "react";
import {
  applyStrokeTempoCurve, balanceStrokeDurations, changeDrawPlan, setStrokeEasing, timelineRows,
  type StrokeTempoCurve, type TimelineEdit,
} from "./vefk-timeline-model";
import type { IntraStrokeCurve } from "./vefk-intrastroke-preview";
import "./vefk-timeline-editor.css";

type Props = {
  document: StudioVefkDocument;
  disabled: boolean;
  forceOpen?: boolean;
  selectedPath: string | null;
  onSelectPath: (id: string) => void;
  previewMs: number;
  onPreviewMs: (ms: number) => void;
  previewCurve: IntraStrokeCurve;
  onPreviewCurve: (curve: IntraStrokeCurve) => void;
  onEnablePersistentMotion: () => void;
  onShowComplete: () => void;
  onPlanChange: (plan: StudioVefkDrawPlan) => void;
  onError: (message: string) => void;
};

/** Studio-only timing dock; independent of parchment/UI and public transport. */
export default function VefkTimelineEditor({
  document, disabled, forceOpen, selectedPath, onSelectPath, previewMs,
  onPreviewMs, previewCurve, onPreviewCurve, onEnablePersistentMotion, onShowComplete, onPlanChange, onError,
}: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (forceOpen !== undefined) setOpen(forceOpen); }, [forceOpen]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tempoCurve, setTempoCurve] = useState<StrokeTempoCurve>("ceremony");
  const clockRef = useRef(previewMs);
  const total = document.drawPlan.durationMs;
  const rows = timelineRows(document.geometry, document.drawPlan, document.schemaVersion);
  const hold = total - (
    document.drawPlan.strokes.at(-1)?.startMs ?? 0
  ) - (document.drawPlan.strokes.at(-1)?.durationMs ?? 0);
  const formatTime = (ms: number) => (ms / 1000).toFixed(2) + " sn";

  useEffect(() => { clockRef.current = previewMs; }, [previewMs]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous: number | null = null;
    const tick = (timestamp: number) => {
      if (previous === null) previous = timestamp;
      const elapsed = Math.max(0, Math.min(200, timestamp - previous));
      previous = timestamp;
      const next = Math.min(total, clockRef.current + elapsed * speed);
      clockRef.current = next;
      onPreviewMs(next);
      if (next >= total) { setPlaying(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, total, onPreviewMs]);

  useEffect(() => {
    setPlaying(false);
  }, [document.id, document.revision]);

  function update(edit: TimelineEdit) {
    if (disabled) return;
    try {
      const plan = changeDrawPlan(document.geometry, document.drawPlan, edit, document.schemaVersion);
      onPlanChange(plan);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }
  function suggestInkPace() {
    if (disabled) return;
    try {
      onPlanChange(balanceStrokeDurations(document.geometry, document.drawPlan, 180, document.schemaVersion));
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }
  function suggestTempoCurve() {
    if (disabled) return;
    try {
      const plan = applyStrokeTempoCurve(document.geometry, document.drawPlan, tempoCurve, document.schemaVersion);
      setPlaying(false);
      onPlanChange(plan);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  function updateEasing(pathId: string, curve: StudioVefkStrokeEasing) {
    if (disabled || document.schemaVersion !== 2) return;
    try {
      onPlanChange(setStrokeEasing(document.geometry, document.drawPlan, pathId, curve, document.schemaVersion));
      setPlaying(false);
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  return <section className={`vefk-timeline ${document.schemaVersion === 2 ? "vefk-timeline-v2" : ""} ${open ? "is-open" : "is-closed"}`}
    aria-label="Vefk çizim zaman çizelgesi">
    <header className="vefk-timeline-head">
      <button type="button" className="vefk-timeline-expand"
        aria-label="Çizim zaman çizelgesi" title="Çizim zaman çizelgesi" aria-expanded={open} onClick={() => { setOpen(value => !value); if (open) setPlaying(false); }}>
        <span>{open ? "▾" : "▸"}</span> {open ? "Çizim zaman çizelgesi" : "Çizim"}
      </button>
      <span className="vefk-timeline-summary">{rows.length} yol · {formatTime(total)}</span>
      <div className="vefk-timeline-scrub">
        <span>{formatTime(Math.min(total, Math.max(0, previewMs)))}</span>
        <input type="range" min={0} max={total} step={10} value={Math.min(total, previewMs)}
          aria-label="Çizim zamanında ileri geri sar"
          onChange={event => {
            setPlaying(false);
            const value = Number(event.target.value); clockRef.current = value; onPreviewMs(value);
          }}/>
        <span>{formatTime(total)}</span>
      </div>
      <div className="vefk-timeline-playback">
        <button type="button" aria-label="Başa sar" title="Başa sar"
          onClick={() => { setPlaying(false); clockRef.current = 0; onPreviewMs(0); }}>⏮</button>
        <button type="button" className={playing ? "active" : ""}
          aria-label={playing ? "Duraklat" : "Oynat"}
          title={playing ? "Duraklat" : "Oynat"}
          onClick={() => {
            if (!playing && previewMs >= total) { clockRef.current = 0; onPreviewMs(0); }
            setPlaying(value => !value);
          }}>{playing ? "Ⅱ" : "▶"}</button>
        <select aria-label="Oynatma hızı" value={speed} onChange={event => setSpeed(Number(event.target.value))}>
          <option value={0.5}>½×</option><option value={1}>1×</option><option value={2}>2×</option>
        </select>
        <button type="button" title="Yol uzunluğuna göre divit sürelerini öner; mevcut düzeni yalnız sen kaydedersen kalıcı olur"
          aria-label="Yol uzunluğuna göre çizim sürelerini öner" disabled={disabled}
          onClick={suggestInkPace}>⏱</button>
        <select className="vefk-timeline-tempo-select" aria-label="Yollar arası tempo eğrisi"
          title="Yollar arasındaki süre dağılımını değiştirir; çizgi içi eğriyi korur"
          value={tempoCurve} disabled={disabled}
          onChange={event => setTempoCurve(event.target.value as StrokeTempoCurve)}>
          <option value="slow-opening">Yavaş açılış</option>
          <option value="slow-ending">Yavaş kapanış</option>
          <option value="ceremony">Ritüel tempo</option>
        </select>
        <button type="button" title="Seçilen ritmi mevcut süre toplamını koruyarak yollara uygula; yalnız taslakta ve kaydedilirse kalıcıdır"
          aria-label="Yollar arası tempo eğrisini uygula" disabled={disabled || rows.length < 2}
          onClick={suggestTempoCurve}>Eğri uygula</button>
        <button type="button" title="Önizlemeyi kapat, tam vefki göster"
          onClick={() => { setPlaying(false); onShowComplete(); }}>Tam görünüm</button>
      </div>
    </header>
    {open && <>
      {document.schemaVersion === 1 ? <div className="vefk-intrastroke-lab" role="group" aria-label="Çizgi içi hareket deneyi">
        <strong>Çizgi içi · Deney</strong>
        <select aria-label="Deneysel çizgi içi hız eğrisi (kaydedilmez)" value={previewCurve} disabled={disabled}
          onChange={event => {
            onPreviewCurve(event.target.value as IntraStrokeCurve);
            setPlaying(false);
            onPreviewMs(previewMs);
          }}>
          <option value="linear">Doğrusal</option>
          <option value="ease-in">Hızlanan</option>
          <option value="ease-out">Yavaşlayan</option>
          <option value="ease-in-out">Yumuşak giriş/çıkış</option>
        </select>
        <small>Yalnız Studio önizlemesi · kaydedilmez. v1 belgeler doğrusal oynatılır.</small>
        <button type="button" disabled={disabled} onClick={onEnablePersistentMotion}>
          Kalıcı v2 eğrilerini aç
        </button>
      </div> : <div className="vefk-intrastroke-lab" role="group" aria-label="Kalıcı çizgi içi hareket">
        <strong>Kalıcı çizgi içi eğri · v2</strong>
        <small>Her yolun eğrisi kaydedilir; önizleme belgeyi kanonik oynatır.</small>
      </div>}
      <div className="vefk-timeline-lines" role="list" aria-label="Sıralı vektör çizimleri">
        {rows.map((row, index) => {
          const stroke = document.drawPlan.strokes.find(item => item.pathId === row.pathId);
          const path = document.geometry.paths.find(item => item.id === row.pathId);
          const current = Boolean(stroke && previewMs >= stroke.startMs &&
            previewMs < stroke.startMs + stroke.durationMs);
          return <div role="listitem" className={`vefk-timeline-line ${selectedPath === row.pathId ? "selected" : ""} ${current ? "playing" : ""}`}
            key={row.id}>
            <div className="vefk-timeline-path">
              <button type="button" className="vefk-timeline-path-name"
                onClick={() => onSelectPath(row.pathId)} title={row.pathId}>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{path?.semanticValue || row.pathId}</strong>
              </button>
              <span>{row.ink}</span>
            </div>
            <div className="vefk-timeline-bar" aria-label={row.pathId + " çizim şeridi"}>
              <div className="vefk-timeline-bar-delay" style={{ flexGrow: row.gapBeforeMs }}/>
              <div className="vefk-timeline-bar-ink" style={{ flexGrow: row.durationMs }}/>
            </div>
            <label>Çizim (ms)
              <input aria-label={row.pathId + " çizim süresi"} type="number" min={1} max={3600000} step={50}
                value={row.durationMs} disabled={disabled}
                onChange={event => {
                  if (event.target.value.trim()) update({kind:"duration", pathId:row.pathId, valueMs:Number(event.target.value)});
                }}/>
            </label>
            <label>Geçiş (ms)
              <input aria-label={row.pathId + " kalem geçişi"} type="number" min={0} max={3600000} step={50}
                value={row.gapBeforeMs} disabled={disabled}
                onChange={event => {
                  if (event.target.value.trim()) update({kind:"gap", pathId:row.pathId, valueMs:Number(event.target.value)});
                }}/>
            </label>
            {document.schemaVersion === 2 && <label>Kalıcı çizgi içi eğri
              <select aria-label={row.pathId + " Kalıcı çizgi içi eğri"}
                value={row.easing ?? "linear"} disabled={disabled}
                onChange={event => updateEasing(row.pathId, event.target.value as StudioVefkStrokeEasing)}>
                <option value="linear">Doğrusal</option>
                <option value="ease-in">Hızlanan</option>
                <option value="ease-out">Yavaşlayan</option>
                <option value="ease-in-out">Yumuşak giriş/çıkış</option>
              </select>
            </label>}
            <div className="vefk-timeline-order">
              <button type="button" title="Önce çiz" aria-label={row.pathId + " önce çiz"}
                disabled={disabled || index === 0} onClick={() => update({kind:"move",pathId:row.pathId,delta:-1})}>↑</button>
              <button type="button" title="Sonra çiz" aria-label={row.pathId + " sonra çiz"}
                disabled={disabled || index === rows.length - 1} onClick={() => update({kind:"move",pathId:row.pathId,delta:1})}>↓</button>
            </div>
          </div>;
        })}
        <div className="vefk-timeline-tail">
          <span>Son mürekkep çizgisinden sonra bekleme</span>
          <label>ms <input aria-label="Çizim sonu bekleme süresi"
            type="number" min={0} max={3600000} step={100}
            value={hold} disabled={disabled}
            onChange={event => {
              if (event.target.value.trim()) update({kind:"hold",valueMs:Number(event.target.value)});
            }}/></label>
        </div>
      </div>
    </>}
  </section>;
}
