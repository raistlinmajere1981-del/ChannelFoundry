const subtitleSearch = require("./subtitle-search.cjs");

function registerSubtitleAnalysisIpc(ipcMain, runtime) {
  ipcMain.handle("studio:subtitle-search", (_event, input) => subtitleSearch.searchTranscripts(runtime.database(), input));
}

module.exports = { registerSubtitleAnalysisIpc };
