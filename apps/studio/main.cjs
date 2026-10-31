const { app, BrowserWindow, Menu, safeStorage, ipcMain, dialog } = require("electron");
const path = require("node:path");
const { configureElectronDataPaths } = require("./studio-data-paths.cjs");
const channelProjects = require("./channel-projects.cjs");
const { verifyStudioDevServer } = require("./dev-server-identity.cjs");

configureElectronDataPaths(app);

const aiAnalysis = require("./ai-analysis.cjs");
const universeMerge = require("./universe-merge.cjs");
const communityAdmin = require("./community-admin.cjs");
const webConnection = require("./web-connection.cjs");
const ytDlpManager = require("./ytdlp-manager.cjs");
const runtime = require("./studio-runtime.cjs");
const { registerStudioIpc, youtubeSyncIsRunning } = require("./studio-ipc.cjs");
const { registerAnalysisEditorialIpc } = require("./analysis-editorial-ipc.cjs");
const { registerUniverseMaintenanceIpc } = require("./universe-maintenance-ipc.cjs");
const { registerSubtitleAnalysisIpc } = require("./subtitle-analysis-ipc.cjs");
const { registerYoutubeChannelIpc } = require("./youtube-channel-ipc.cjs");

function windowPreferences() {
  return {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

async function loadRenderer(window) {
  const devServerUrl = process.env.CHANNEL_FOUNDRY_DEV_SERVER_URL;
  if (devServerUrl) {
    // Vite portu doluysa Electron baska projenin UI'ini asla yuklemez.
    const verifiedUrl = await verifyStudioDevServer(devServerUrl);
    if (window.isDestroyed()) return;
    await window.loadURL(verifiedUrl);
    return;
  }
  await window.loadFile(path.join(__dirname, "dist", "index.html"));
}

function createWindow() {
  const studioIcon = path.join(__dirname, "..", "..", "logo.png");
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#0b0d11",
    title: "Channel Foundry Studio",
    icon: studioIcon,
    autoHideMenuBar: true,
    webPreferences: windowPreferences(),
  });
  runtime.setMainWindow(window);
  window.setMenuBarVisibility(false);
  window.maximize();
  window.on("closed", () => runtime.setMainWindow(null));
  void loadRenderer(window).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ChannelFoundry] Studio arayuzu yuklenemedi:", message);
    dialog.showErrorBox("ChannelFoundry Studio", message);
    if (!window.isDestroyed()) window.close();
  });
  return window;
}

app.whenReady().then(() => {
  webConnection.configure(app.getPath("userData"));
  communityAdmin.configureCredentialStorage(app.getPath("userData"), safeStorage);
  ytDlpManager.configure(app.getPath("userData"), runtime.notifyYtDlpChanged);
  void communityAdmin.connectStored();
  ipcMain.handle("studio:channel-projects", () => ({
    activeId: channelProjects.activeProjectId(),
    projects: channelProjects.listProjects(),
  }));
  ipcMain.handle("studio:channel-project-create", (_event, input) => {
    const project = channelProjects.createProject(input);
    runtime.refreshMainWindow();
    return project;
  });
  ipcMain.handle("studio:channel-project-update", (_event, input) => {
    const project = channelProjects.updateProject(input);
    runtime.refreshMainWindow();
    return project;
  });
  ipcMain.handle("studio:channel-project-select", (_event, input) => {
    const project = channelProjects.readProject(input?.id);
    if (project.id === channelProjects.activeProjectId()) return { changed: false, project };
    if (runtime.workersBusy() || youtubeSyncIsRunning()) {
      throw new Error("Devam eden AI veya YouTube işlemi bitmeden proje değiştirilemez.");
    }
    channelProjects.setActiveProject(project.id);
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 150);
    return { changed: true, project };
  });
  registerStudioIpc();
  registerAnalysisEditorialIpc();
  registerUniverseMaintenanceIpc();
  registerSubtitleAnalysisIpc(ipcMain, runtime);
  registerYoutubeChannelIpc(ipcMain, runtime);
  runtime.database();
  aiAnalysis.resetInterrupted(runtime.database());
  universeMerge.resetInterrupted(runtime.database());
  Menu.setApplicationMenu(null);
  createWindow();
  ytDlpManager.startAutomaticTasks();
  setTimeout(() => { void runtime.processAnalysisQueue(); }, 1800);
  setTimeout(() => { void runtime.processUniverseQueue(); }, 2400);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
