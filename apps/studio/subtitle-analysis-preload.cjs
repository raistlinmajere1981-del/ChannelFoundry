const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("channelFoundrySubtitleAnalysis", {
  search: (input) => ipcRenderer.invoke("studio:subtitle-search", input),
});
