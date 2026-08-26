const { app } = require("electron");
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
  ipcMain.handle("studio:youtube-channel-add", async (_event, input) => {
    if (channelAddRunning) throw new Error("Başka bir kanal ekleme işlemi zaten çalışıyor.");
    channelAddRunning = true;
    try {
      const config = webConnection.getConfig();
      const result = await youtubeCatalog.syncChannel(runtime.database(), app.getPath("userData"), {
        mode: "recent",
        url: input?.youtubeChannelUrl,
        excludeShorts: true,
        excludeLive: true,
        excludeMembersOnly: true,
      });
      if (!result?.ok) return result;
      const webUrl = String(input?.webUrl || config.url).trim();
      webConnection.saveConfig({ url: webUrl, youtubeChannelUrl: result.channel.url });
      runtime.refreshMainWindow();
      return result;
    } finally {
      channelAddRunning = false;
    }
  });
}

module.exports = { registerYoutubeChannelIpc };
