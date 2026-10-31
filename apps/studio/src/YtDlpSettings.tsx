import { useEffect, useState } from "react";

function errorText(error: unknown) { return error instanceof Error ? error.message : String(error); }

export default function YtDlpSettings() {
  const bridge = window.channelFoundryStudio;
  const [status, setStatus] = useState<StudioYtDlpStatus | null>(null);
  const [action, setAction] = useState<"check" | "install" | "options" | "">("");
  const [error, setError] = useState("");
  const refresh = async () => { if (bridge) setStatus(await bridge.ytDlpStatus()); };
  useEffect(() => {
    void refresh().catch((reason) => setError(errorText(reason)));
    return bridge?.onYtDlpChanged?.(() => { void refresh().catch(() => undefined); });
  }, []);
  const change = async (autoCheck: boolean, autoUpdate: boolean) => {
    if (!bridge) return;
    setAction("options"); setError("");
    try { setStatus(await bridge.ytDlpSaveOptions({ autoCheck, autoUpdate })); }
    catch (reason) { setError(errorText(reason)); }
    finally { setAction(""); }
  };
  const run = async (kind: "check" | "install") => {
    if (!bridge) return;
    setAction(kind); setError("");
    try { setStatus(kind === "check" ? await bridge.ytDlpCheck() : await bridge.ytDlpInstall()); }
    catch (reason) { setError(errorText(reason)); await refresh().catch(() => undefined); }
    finally { setAction(""); }
  };
  if (!bridge) return null;
  const busy = Boolean(action) || Boolean(status && ["checking", "downloading", "installing"].includes(status.phase));
  const failed = Boolean(error || status?.lastError || status?.phase === "error");
  return <section className="studio-compact-settings studio-compact-ytdlp" aria-label="yt-dlp">
    <header><h3>yt-dlp</h3><span className={`studio-mini-status ${failed ? "error" : status?.updateAvailable ? "warning" : status?.available ? "ready" : ""}`}>{failed ? "Hata" : status?.updateAvailable ? "Güncelleme" : status?.available ? "Hazır" : "Kurulum gerekli"}</span></header>
    <div className="studio-compact-version">
      <div><small>Kurulu</small><strong>{status?.version || "—"}</strong></div>
      <div><small>Yeni sürüm</small><strong>{status?.latestVersion || "—"}</strong></div>
    </div>
    <label className="studio-switch-line"><input type="checkbox" disabled={busy || !status?.supported} checked={Boolean(status?.autoCheck)} onChange={(event) => void change(event.target.checked, event.target.checked && Boolean(status?.autoUpdate))}/><span>Otomatik denetle</span></label>
    <label className="studio-switch-line"><input type="checkbox" disabled={busy || !status?.supported} checked={Boolean(status?.autoUpdate)} onChange={(event) => void change(event.target.checked || Boolean(status?.autoCheck), event.target.checked)}/><span>Otomatik güncelle</span></label>
    <div className="studio-popover-actions">
      <button type="button" disabled={busy || !status?.supported} onClick={() => void run("check")}>{action === "check" ? "Denetleniyor…" : "Denetle"}</button>
      <button type="button" className="primary-button" disabled={busy || !status?.supported} onClick={() => void run("install")}>{action === "install" ? "Kuruluyor…" : !status?.available ? "Kur" : "Güncelle"}</button>
    </div>
    {(error || status?.lastError || (busy && status?.message)) && <p className={failed ? "studio-popover-error" : ""} role={failed ? "alert" : "status"}>{error || status?.lastError || status?.message}</p>}
  </section>;
}
