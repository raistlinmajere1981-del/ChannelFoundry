const subtitleSearch = require("./subtitle-search.cjs");

function registerSubtitleAnalysisIpc(ipcMain, runtime) {
  ipcMain.handle("studio:subtitle-search", (_event, input) => subtitleSearch.runSearch(runtime.database(), input));
}

module.exports = { registerSubtitleAnalysisIpc };
