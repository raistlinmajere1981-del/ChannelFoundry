import { useEffect, useState, type FormEvent } from "react";

type ChannelSettingsBridge = NonNullable<typeof window.channelFoundryStudio> & {
  youtubeChannelAdd(input: { webUrl: string; youtubeChannelUrl: string; youtubePlaylistUrl?: string }): Promise<StudioYoutubeChannelAddResult>;
};

type ArchiveScope = "channel" | "playlist";

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function WebConnectionSettings() {
  const bridge = window.channelFoundryStudio as ChannelSettingsBridge | undefined;
  const [config, setConfig] = useState<StudioWebConnectionConfig | null>(null);
  const [url, setUrl] = useState("");
  const [youtubeChannelUrl, setYoutubeChannelUrl] = useState("");
  const [activeChannel, setActiveChannel] = useState<StudioYoutubeChannel | null>(null);
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>("channel");
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = useState("");
  const [result, setResult] = useState<StudioWebConnectionTest | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "add" | "">("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bridge) return;
    const load = async () => {
      const [next, channel] = await Promise.all([
        bridge.webConnectionConfig(),
        bridge.youtubeCatalogActive(),
      ]);
      setConfig(next);
      setUrl(next.url);
      setYoutubeChannelUrl(next.youtubeChannelUrl);
      setActiveChannel(channel);
      setArchiveScope(channel?.playlistUrl ? "playlist" : "channel");
      setYoutubePlaylistUrl(channel?.playlistUrl || "");
    };
    void load().catch((reason) => setError(errorText(reason)));
  }, []);

  const test = async () => {
    if (!bridge) return;
    setBusy("test");
    setError("");
    setNotice("");
    setResult(null);
    try {
      const next = await bridge.webConnectionTest({ url });
      setResult(next);
      setUrl(next.url);
      setNotice(`Web sayfası ve Studio servisleri çalışıyor · ${next.latencyMs} ms`);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy("");
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!bridge || !config) return;
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const next = await bridge.webConnectionSave({ url, youtubeChannelUrl: config.youtubeChannelUrl });
      setConfig(next);
      setUrl(next.url);
      setYoutubeChannelUrl(next.youtubeChannelUrl);
      setNotice("Web sunucusu adresi kaydedildi.");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy("");
    }
  };

  const addChannel = async () => {
    if (!bridge || !url || !youtubeChannelUrl) return;
    setBusy("add");
    setError("");
    setNotice("");
    try {
      const added = await bridge.youtubeChannelAdd({
        webUrl: url,
        youtubeChannelUrl,
        youtubePlaylistUrl: archiveScope === "playlist" ? youtubePlaylistUrl : "",
      });
      const next = await bridge.webConnectionConfig();
      setConfig(next);
      setUrl(next.url);
      setYoutubeChannelUrl(next.youtubeChannelUrl);
      setActiveChannel(added.channel);
      setArchiveScope(added.channel.playlistUrl ? "playlist" : "channel");
      setYoutubePlaylistUrl(added.channel.playlistUrl || "");
      const channelName = added.channel.title || added.channel.handle || "YouTube kanalı";
      const sourceDescription = added.channel.playlistUrl
        ? `yalnız “${added.channel.playlistTitle || "seçilen playlist"}” kapsamıyla`
        : "tüm kanal kapsamıyla";
      setNotice(added.created
        ? `“${channelName}” için ${sourceDescription} boş arşiv oluşturuldu ve kanal aktif edildi. Video veya altyazı indirilmedi; içeriği Video Arşivi sayfasındaki Tam senkronizasyon ile elle alabilirsin.`
        : `“${channelName}” zaten kayıtlıydı; ${sourceDescription} yeniden aktif edildi. Mevcut arşiv bir sonraki Tam senkronizasyona kadar korundu.`);
      await bridge.refreshMain().catch(() => undefined);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy("");
    }
  };

  if (!bridge) return null;
  const isBusy = Boolean(busy);
  const changed = Boolean(config && (
    url.trim().replace(/\/$/, "") !== config.url.replace(/\/$/, "")
    || youtubeChannelUrl.trim().replace(/\/$/, "") !== config.youtubeChannelUrl.replace(/\/$/, "")
    || (archiveScope === "playlist" ? youtubePlaylistUrl.trim() : "") !== (activeChannel?.playlistUrl || "")
  ));
  const state = error ? "error" : changed ? "warning" : result?.ok ? "ready" : config?.customized ? "saved" : "";
  const stateLabel = error ? "Bağlantı başarısız" : changed ? "Kaydedilmemiş adres" : result?.ok ? "Bağlantı hazır" : config?.customized ? "Özel adres" : "Varsayılan adres";

  return <section className="panel web-connection-settings">
    <header>
      <div><small>WEB BAĞLANTISI</small><h2>Sunucu ve kanal ekleme</h2></div>
      <span className={`web-connection-state ${state}`}><span className="local-dot"/>{stateLabel}</span>
    </header>
    <div className="web-connection-body">
      <p>Web sunucusu adresini burada yönet. Yeni bir YouTube kanalı eklerken arşiv kapsamını tüm kanal veya tek playlist olarak seçebilirsin. Kanal boş bir arşivle oluşturulur; video ve altyazılar yalnız Video Arşivi sayfasından elle senkronize edilir.</p>
      <form onSubmit={(event) => void save(event)}>
        <label>
          <span>Web sayfası</span>
          <div className="web-connection-control">
            <input type="url" value={url} disabled={isBusy || Boolean(config?.environmentOverride)} onChange={(event) => { setUrl(event.target.value); setResult(null); setNotice(""); setError(""); }} placeholder="https://ornek.com" autoComplete="url" required/>
            <button className="secondary-button" type="button" disabled={isBusy || !url} onClick={() => void test()}>{busy === "test" ? "Deneniyor…" : "Bağlantıyı dene"}</button>
          </div>
        </label>
        <label>
          <span>YouTube kanal adresi</span>
          <input className="youtube-channel-address" type="url" value={youtubeChannelUrl} disabled={isBusy} onChange={(event) => {
            const nextUrl = event.target.value;
            setYoutubeChannelUrl(nextUrl);
            if (nextUrl.trim().replace(/\/$/, "") !== (activeChannel?.url || "").replace(/\/$/, "")) {
              setArchiveScope("channel");
              setYoutubePlaylistUrl("");
            }
            setNotice("");
            setError("");
          }} placeholder="https://www.youtube.com/@kanal" autoComplete="url" required/>
        </label>
        <div className="youtube-archive-source">
          <label>
            <span>Video arşivi kapsamı</span>
            <select value={archiveScope} disabled={isBusy} onChange={(event) => { setArchiveScope(event.target.value as ArchiveScope); setNotice(""); setError(""); }}>
              <option value="channel">Tüm kanal</option>
              <option value="playlist">Yalnız bir playlist</option>
            </select>
          </label>
          {archiveScope === "playlist" && <label>
            <span>YouTube playlist adresi</span>
            <input className="youtube-channel-address" type="url" value={youtubePlaylistUrl} disabled={isBusy} onChange={(event) => { setYoutubePlaylistUrl(event.target.value); setNotice(""); setError(""); }} placeholder="https://www.youtube.com/playlist?list=..." autoComplete="url" required/>
          </label>}
        </div>
        {archiveScope === "playlist" && <small className="youtube-archive-source-note">Tam senkronizasyon yalnız bu playlist'teki videoları arşive alır. Kanalın diğer videoları eklenmez.</small>}
        <div className="web-connection-actions">
          <button className="secondary-button" type="submit" disabled={isBusy || !url || !config}>{busy === "save" ? "Kaydediliyor…" : "Web adresini kaydet"}</button>
          <button className="primary-button" type="button" disabled={isBusy || !url || !youtubeChannelUrl || (archiveScope === "playlist" && !youtubePlaylistUrl)} onClick={() => void addChannel()}>{busy === "add" ? "Kanal ve kaynak doğrulanıyor…" : "Kanalı ekle ve etkinleştir"}</button>
        </div>
      </form>
      {config && <div className="web-connection-facts">
        <div><span>Studio yayın servisi</span><strong title={config.endpoints.studio}>{config.endpoints.studio}</strong></div>
        <div><span>Forum yönetimi servisi</span><strong title={config.endpoints.community}>{config.endpoints.community}</strong></div>
      </div>}
      {(error || notice) && <div className={`web-connection-notice ${error ? "error" : ""}`}>{error || notice}</div>}
      {config?.environmentOverride && <div className="web-connection-notice warning">Adres CHANNEL_FOUNDRY_WEB_URL ortam değişkeniyle yönetildiği için bu alanda değiştirilemez.</div>}
    </div>
  </section>;
}
