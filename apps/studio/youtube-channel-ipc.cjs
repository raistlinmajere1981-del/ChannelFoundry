const youtubeCatalog = require("./youtube-catalog.cjs");
const webConnection = require("./web-connection.cjs");

let channelAddRunning = false;

function registerYoutubeChannelIpc(ipcMain, runtime) {
  ipcMain.handle("studio:youtube-catalog-active", () => youtubeCatalog.activeChannel(runtime.database()));
  ipcMain.handle("studio:youtube-catalog-set-active", (_event, input) => {
    const channel = youtubeCatalog.setActiveChannel(runtime.database(), input?.channelId);
    const config = webConnection.getConfig();
    webConnection.saveConfig({ url: config.url, youtubeChannelUrl: channel.url });
    runtime.refreshMainWindow();
    return channel;
  });
  ipcMain.handle("studio:youtube-channel-media-options", (_event, input) => (
    youtubeCatalog.channelMediaOptions(runtime.database(), input)
  ));
  ipcMain.handle("studio:youtube-channel-media-options-save", (_event, input) => {
    const options = youtubeCatalog.saveChannelMediaOptions(runtime.database(), input);
    runtime.refreshMainWindow();
    return options;
  });
  ipcMain.handle("studio:youtube-channel-add", async (_event, input) => {
    if (channelAddRunning) throw new Error("Başka bir kanal ekleme işlemi zaten çalışıyor.");
    channelAddRunning = true;
    try {
      const config = webConnection.getConfig();
      const webUrl = webConnection.normalizeWebUrl(input?.webUrl || config.url);
      const youtubeChannelUrl = youtubeCatalog.normalizeChannelUrl(input?.youtubeChannelUrl);
      const youtubePlaylistUrl = input?.youtubePlaylistUrl
        ? youtubeCatalog.normalizePlaylistUrl(input.youtubePlaylistUrl)
        : "";
      const result = await youtubeCatalog.addChannel(runtime.database(), {
        url: youtubeChannelUrl,
        playlistUrl: youtubePlaylistUrl,
      });
      webConnection.saveConfig({ url: webUrl, youtubeChannelUrl: result.channel.url });
      runtime.refreshMainWindow();
      return result;
    } finally {
      channelAddRunning = false;
    }
  });
}

module.exports = { registerYoutubeChannelIpc };
