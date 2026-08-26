const youtubeCatalog = require("./youtube-catalog.cjs");
const webConnection = require("./web-connection.cjs");

function registerYoutubeChannelIpc(ipcMain, runtime) {
  ipcMain.handle("studio:youtube-catalog-active", () => youtubeCatalog.activeChannel(runtime.database()));
  ipcMain.handle("studio:youtube-catalog-set-active", (_event, input) => {
    const channel = youtubeCatalog.setActiveChannel(runtime.database(), input?.channelId);
    const config = webConnection.getConfig();
    webConnection.saveConfig({ url: config.url, youtubeChannelUrl: channel.url });
    runtime.refreshMainWindow();
    return channel;
  });
}

module.exports = { registerYoutubeChannelIpc };
