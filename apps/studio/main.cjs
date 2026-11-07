const { app, BrowserWindow, Menu, safeStorage, ipcMain, dialog } = require("electron");

// Lock before selecting a channel's userData: Studio has one application
// instance across channels, and rejected launches must not start workers or DBs.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  startStudio();
}

function startStudio() {
  const path = require("node:path");
  const { configureElectronDataPaths } = require("./studio-data-paths.cjs");
  const channelProjects = require("./channel-projects.cjs");
  const { verifyStudioDevServer } = require("./dev-server-identity.cjs");

  const startupProject = process.env.CHANNEL_FOUNDRY_START_PROJECT;
  delete process.env.CHANNEL_FOUNDRY_START_PROJECT;
  if (startupProject) channelProjects.setActiveProject(startupProject);
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

  let mainWindow = null;

  function createWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
    const studioIcon = path.join(__dirname, "src", "assets", "brand", "yayin-atolyesi-mark.png");
    const window = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1080,
      minHeight: 720,
      backgroundColor: "#0b0d11",
      title: "Yayın Atölyesi",
      icon: studioIcon,
      autoHideMenuBar: true,
      webPreferences: windowPreferences(),
    });
    mainWindow = window;
    runtime.setMainWindow(window);
    window.setMenuBarVisibility(false);
    window.maximize();
    window.on("closed", () => {
      if (mainWindow === window) {
        mainWindow = null;
        runtime.setMainWindow(null);
      }
    });
    void loadRenderer(window).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[ChannelFoundry] Studio arayuzu yuklenemedi:", message);
      dialog.showErrorBox("Yayın Atölyesi", message);
      if (!window.isDestroyed()) window.close();
    });
    return window;
  }

  app.on("second-instance", () => {
    void app.whenReady().then(() => {
      const window = createWindow();
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    });
  });

  app.whenReady().then(() => {
    webConnection.configure(app.getPath("userData"));
    communityAdmin.configureCredentialStorage(app.getPath("userData"), safeStorage);
    ytDlpManager.configure(app.getPath("userData"), runtime.notifyYtDlpChanged);
    void communityAdmin.connectStored();
    channelProjects.registerChannelProjectIpc(ipcMain, runtime, {
      youtubeSyncIsRunning,
      onSelect: () => setTimeout(() => {
        app.relaunch();
        app.quit();
      }, 150),
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
}
