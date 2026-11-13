const { app, dialog, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const communityAdmin = require("./community-admin.cjs");
const youtubeCatalog = require("./youtube-catalog.cjs");
const aiService = require("./ai-service.cjs");
const aiAnalysis = require("./ai-analysis.cjs");
const aiActivity = require("./ai-activity.cjs");
const universeMerge = require("./universe-merge.cjs");
const universeWorkspace = require("./universe-workspace.cjs");
const transcriptService = require("./transcript-service.cjs");
const visualProfiles = require("./visual-profiles.cjs");
const publicationV2 = require("./publication-v2.cjs");
const seoWorkspace = require("./seo-workspace.cjs");
const vefkStore = require("./vefk-store.cjs");
const vefkSources = require("./vefk-sources.cjs");
const vefkPreparations = require("./vefk-preparations.cjs");
const vefkPublication = require("./vefk-publication.cjs");
const {
  openStudioDatabase,
  exportPublicSnapshot,
  getPublicationInfo,
} = require("./storage.cjs");
const {recordPublicationInfo} = require("./storage-publication.cjs");
const publicationUpdates = require("./publication-updates.cjs");

let studioDatabase = null;
let mainWindow = null;
let analysisWorkerRunning = false;
let analysisWorkerStopRequested = false;
let analysisWorkerController = null;
let universeWorkerRunning = false;
let universeWorkerStopRequested = false;
let universeWorkerController = null;

function database() {
  if (!studioDatabase) {
    studioDatabase = openStudioDatabase(app.getPath("userData"));
    const projects = require("./channel-projects.cjs");
    const projectId = projects.activeProjectId();
    if (projectId) projects.bindDatabaseProject(studioDatabase, projectId);
    youtubeCatalog.ensureSchema(studioDatabase);
    transcriptService.ensureSchema(studioDatabase);
    aiAnalysis.ensureSchema(studioDatabase);
    require('./publication-languages.cjs').resetInterrupted(studioDatabase);
    universeMerge.ensureSchema(studioDatabase);
    universeWorkspace.ensureSchema(studioDatabase);
    visualProfiles.ensureSchema(studioDatabase, app.getPath("userData"));
    vefkStore.ensureSchema(studioDatabase);
    vefkPublication.ensureSchema(studioDatabase);
    vefkSources.schema(studioDatabase);
    vefkPreparations.ensureSchema(studioDatabase);
  }
  return studioDatabase;
}

function setMainWindow(window) {
  mainWindow = window;
}

function writeSnapshotFile(file, snapshot) {
  const temporary = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  fs.renameSync(temporary, file);
}

function liveBaselineFile() {
  return path.join(app.getPath("userData"), "public-export", "publication-live-baseline.json");
}

async function fetchLivePublication() {
  const project = require("./channel-projects.cjs").activeProject();
  if (!project?.webUrl) throw new Error("Canlı site adresi tanımlı değil.");
  const url = require("./web-connection.cjs").endpoints(project.webUrl).publication;
  const {net} = require("electron");
  const response = await (net?.fetch ? net.fetch.bind(net) : fetch)(url, {
    method:"GET",cache:"no-store",signal:AbortSignal.timeout(20000),
    headers:{"Accept":"application/json"},
  });
  if (!response.ok) throw new Error(`Canlı publication okunamadı (HTTP ${response.status}).`);
  const raw = await response.text();
  if (raw.length > 30000000) throw new Error("Canlı publication beklenen boyutu aşıyor.");
  return publicationUpdates.valid(JSON.parse(raw));
}

function publicationUpdateVisibility(db) {
  // Drafted archive entries and retired narrative sections are explicit
  // editorial visibility decisions. Unavailable/missing records stay live.
  return {
    hiddenEntityIds:db.prepare("SELECT key FROM universe_workspace_nodes WHERE state='draft'").all().map(row => row.key),
    hiddenSectionIds:db.prepare("SELECT key FROM narrative_sections WHERE state='retired'").all().map(row => row.key),
  };
}

async function publicationPreview() {
  const built = publicationV2.buildPublicationV2(database());
  const snapshot = built.snapshot;
  let baseline = null;
  let liveError = "";
  try {baseline = await fetchLivePublication();}
  catch(error) {liveError = error instanceof Error ? error.message : String(error);}
  const update = baseline ? publicationUpdates.buildUpdatePublication(baseline,built,publicationUpdateVisibility(database())) : null;
  return {
    baselineAvailable:Boolean(baseline),
    generatedAt:snapshot.publication.generatedAt,
    publicationId:snapshot.publication.id,
    contentFingerprint:snapshot.publication.contentFingerprint,
    changed:baseline ? baseline.publication.contentFingerprint !== snapshot.publication.contentFingerprint : true,
    coverage:publicationUpdates.compareCoverage(snapshot,baseline),
    counts:{
      sections:snapshot.journal.sections.length,entities:snapshot.archive.entities.length,
      relations:snapshot.archive.relations.length,assets:snapshot.assets.length,
      vefks:snapshot.vefkCatalog?.entries?.length ?? 0,
    },
    readiness:built.readiness,
    baseline:baseline ? {
      source:"live",file:"",generatedAt:baseline.publication.generatedAt,
      publicationId:baseline.publication.id,
      contentFingerprint:baseline.publication.contentFingerprint,
    }:null,
    update:update ? {
      ready:update.changed,changes:update.changes,
      publicationId:update.snapshot.publication.id,
      contentFingerprint:update.snapshot.publication.contentFingerprint,
    }:null,
    liveError,
  };
}

async function createPublicExport(mode = "full") {
  if (mode !== "update") return exportPublicSnapshot(database(),app.getPath("userData"));
  const baseline = await fetchLivePublication();
  const built = publicationV2.buildPublicationV2(database());
  const update = publicationUpdates.buildUpdatePublication(baseline,built,publicationUpdateVisibility(database()));
  const result = publicationUpdates.exportUpdatePublication(update,app.getPath("userData"));
  recordPublicationInfo(database(),result);
  return {...result,root:path.join(app.getPath("userData"),"public-export"),publicationV2:result};
}

async function publishPublicExport(mode = "full") {
  const project = require("./channel-projects.cjs").activeProject();
  if (!project?.deploymentEnabled) {
    throw new Error("Bu kanal yerel tasarım aşamasında. Web yayını etkin değil.");
  }
  if (mode !== "full" && mode !== "update") throw new Error("Bilinmeyen yayın biçimi.");
  const local = await createPublicExport(mode);
  if (mode === "full" && !local.readiness?.readyForTheme) {
    throw new Error("Tam yayın için önce 05 · Hikâyeleştir ve 06 · Görsel Tamamlama kapılarını tamamla.");
  }
  const snapshot = JSON.parse(fs.readFileSync(local.file,"utf8"));
  let uploadedAssets = 0;
  const uploadIds = mode === "update" ? new Set(local.assetUploads ?? []) : null;
  for (const asset of snapshot.assets ?? []) {
    if (uploadIds && !uploadIds.has(asset.assetId)) continue;
    const relative = String(asset?.url ?? "");
    if (!relative.startsWith("assets/")) throw new Error(`Publication asset URL geçersiz: ${relative}`);
    const filename = path.basename(relative);
    const file = path.join(local.assetsDirectory,filename);
    await communityAdmin.uploadPublicationAsset({file,filename,sha256:asset.sha256});
    uploadedAssets++;
  }
  if (mode === "update") {
    const latest = await fetchLivePublication();
    if (latest.publication.contentFingerprint !== local.baselineFingerprint) {
      throw new Error("Canlı yayın hazırlık sırasında değişti; güvenli güncelleme iptal edildi.");
    }
  }
  const seo = seoWorkspace.manifest(app.getPath("userData"),snapshot,project.webUrl || "");
  const live = await communityAdmin.publishPublication(snapshot,seo);
  writeSnapshotFile(liveBaselineFile(),snapshot);
  return {...local,uploadedAssets,live};
}

function showPublicExport() {
  const info = getPublicationInfo(database(),app.getPath("userData"));
  if (!info?.file) throw new Error("Henüz publication v2 paketi oluşturulmadı.");
  shell.showItemInFolder(info.file);
  return true;
}

function refreshMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("studio:data-changed");
}

function notifyYtDlpChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("studio:ytdlp-changed");
}

function navigateMainWindow(section) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  mainWindow.webContents.send("studio:navigate", String(section));
  mainWindow.focus();
  return true;
}

function connectionLikeFailure(error) {
  if (/^AI_CLI_/.test(String(error?.code ?? ""))) return true;
  const text = error instanceof Error ? error.message : String(error ?? "");
  return /zaman aşım|fetch failed|ECONNREFUSED|AI isteği başarısız|Codex CLI|Önce Ayarlar|endpoint|bağlantı/i.test(text);
}

async function processAnalysisQueue() {
  if (analysisWorkerRunning) return { running: true };
  const initialConfig = aiService.getConfig(app.getPath("userData"));
  if (!initialConfig.configured) return { running: false, reason: "not_configured" };
  analysisWorkerRunning = true;
  analysisWorkerStopRequested = false;
  try {
    while (!analysisWorkerStopRequested) {
      const config = aiService.getConfig(app.getPath("userData"));
      if (!config.configured) break;
      const job = aiAnalysis.claimNext(database());
      if (!job) break;
      refreshMainWindow();
      const controller = new AbortController();
      analysisWorkerController = controller;
      let activitySession = null;
      try {
        const source = aiAnalysis.sourceContext(database(), job.videoId);
        activitySession = aiActivity.startSession({
          kind: "analysis",
          key: `analysis:${job.videoId}:${Date.now()}`,
          title: "Video çözümleme",
          subject: source.title || job.videoId,
          provider: config.provider,
          configuredModel: config.model || (config.provider === "codex-cli" ? "Codex CLI · varsayılan" : ""),
          stage: "Kaynak hazırlanıyor",
          message: `“${source.title || job.videoId}” için yerel transkript ve video bilgileri hazırlandı.`,
          context: { videoId: job.videoId },
        });
        const result = await aiService.analyzeTranscript(app.getPath("userData"), {
          ...source,
          signal: controller.signal,
          activity: { sessionId: activitySession.id },
        });
        if (analysisWorkerStopRequested || controller.signal.aborted) {
          aiActivity.finishSession(activitySession.id, {
            state: "canceled",
            model: result.config?.model,
            detail: "Video çözümleme sonucu kaydedilmeden işlem durduruldu.",
          });
          break;
        }
        aiAnalysis.complete(database(), job.videoId, result.config?.model ?? config.model, result);
        // Source analysis finishes here. Publication translations are synchronized,
        // generated and approved only in Yayınlama (Publishing).
        aiActivity.finishSession(activitySession.id, {
          state: "done",
          model: result.config?.model ?? config.model,
          detail: `“${source.title || job.videoId}” anlatı dosyası yerel çalışma alanına kaydedildi.`,
        });
        refreshMainWindow();
      } catch (error) {
        if (error?.code === "AI_REQUEST_CANCELED" || analysisWorkerStopRequested) {
          if (activitySession) aiActivity.finishSession(activitySession.id, {
            state: "canceled",
            detail: "Video çözümleme kullanıcı tarafından durduruldu.",
          });
          break;
        }
        if (activitySession) aiActivity.finishSession(activitySession.id, {
          state: "error",
          detail: error instanceof Error ? error.message : String(error),
        });
        aiAnalysis.fail(database(), job.videoId, error);
        refreshMainWindow();
        if (connectionLikeFailure(error)) break;
      } finally {
        if (analysisWorkerController === controller) analysisWorkerController = null;
      }
      if (analysisWorkerStopRequested) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    analysisWorkerController = null;
    analysisWorkerRunning = false;
    refreshMainWindow();
  }
  return { running: false, stats: aiAnalysis.stats(database()) };
}

function cancelAnalysisQueue() {
  analysisWorkerStopRequested = true;
  analysisWorkerController?.abort();
  const result = aiAnalysis.cancelPending(database());
  refreshMainWindow();
  return { ...result, running: analysisWorkerRunning };
}

async function processUniverseQueue() {
  if (universeWorkerRunning) return { running: true, ...universeMerge.status(database()) };
  const config = aiService.getConfig(app.getPath("userData"));
  if (!config.configured) return { running: false, reason: "not_configured", ...universeMerge.status(database()) };
  universeWorkerRunning = true;
  universeWorkerStopRequested = false;
  try {
    while (!universeWorkerStopRequested) {
      const current = universeMerge.status(database());
      if (!current.run || !["waiting", "running"].includes(current.run.state)) break;
      const controller = new AbortController();
      universeWorkerController = controller;
      try {
        const next = await universeMerge.processNext(database(), app.getPath("userData"), { signal: controller.signal });
        refreshMainWindow();
        if (!next.run || ["done", "error"].includes(next.run.state)) break;
      } catch (error) {
        refreshMainWindow();
        if (error?.code === "AI_REQUEST_CANCELED" || universeWorkerStopRequested) break;
        break;
      } finally {
        if (universeWorkerController === controller) universeWorkerController = null;
      }
      if (universeWorkerStopRequested) break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  } finally {
    universeWorkerController = null;
    universeWorkerRunning = false;
    refreshMainWindow();
    const pending = universeMerge.status(database());
    if (pending.run && ["waiting", "running"].includes(pending.run.state)) {
      setTimeout(() => { void processUniverseQueue(); }, 0);
    }
  }
  return { running: false, ...universeMerge.status(database()) };
}

function cancelUniverseQueue() {
  universeWorkerStopRequested = true;
  universeWorkerController?.abort();
  const result = universeMerge.cancelActive(database());
  refreshMainWindow();
  return { ...result, running: universeWorkerRunning, ...universeMerge.status(database()) };
}

async function pickVefkSource() {
  const options = {
    title: "Vefk kaynak görselini seç",
    properties: ["openFile"],
    filters: [{ name: "Görseller", extensions: ["png", "jpg", "jpeg", "webp"] }],
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const source = vefkSources.importSource(database(), app.getPath("userData"), result.filePaths[0]);
  return { canceled: false, source };
}

async function pickVisualImage(input) {
  const options = {
    title: "Görsel seç",
    properties: ["openFile"],
    filters: [{ name: "Görseller", extensions: ["png", "jpg", "jpeg", "webp"] }],
  };
  const result = mainWindow && !mainWindow.isDestroyed()
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const profile = visualProfiles.attachFile(database(), app.getPath("userData"), {
    entityKey: input?.entityKey,
    entityType: input?.entityType,
    file: result.filePaths[0],
  });
  refreshMainWindow();
  return { canceled: false, profile };
}

async function generateVisualImage(input) {
  const profile = visualProfiles.save(database(), {
    entityKey: input?.entityKey,
    entityType: input?.entityType,
    source: input?.source ?? "ai",
    description: input?.description,
    attributes: input?.attributes,
    atmosphere: input?.atmosphere,
    prompt: input?.prompt,
    negativePrompt: input?.negativePrompt,
  });
  const config = aiService.getConfig(app.getPath("userData"));
  const subject = String(input?.subject ?? profile.entityKey).trim() || profile.entityKey;
  const provider = config.image?.provider || config.provider;
  const configuredModel = config.image?.model || config.model || (provider === "codex-cli" ? "Codex CLI · varsayılan" : "");
  const size = String(input?.size ?? "1024x1024");
  const activitySession = aiActivity.startSession({
    kind: "visual",
    key: `visual:${profile.entityKey}:${Date.now()}`,
    title: "Görsel üretimi",
    subject,
    provider,
    configuredModel,
    stage: "Görsel hazırlanıyor",
    message: `“${subject}” için görsel üretim isteği hazırlandı.`,
    context: { entityKey: profile.entityKey, entityType: profile.entityType, size },
  });
  const request = aiActivity.beginRequest({
    sessionId: activitySession.id,
    label: "Görsel üretim isteği",
    stage: "Görsel üretiliyor",
  }, {
    provider,
    model: configuredModel,
    messages: [{
      role: "user",
      content: profile.negativePrompt
        ? `${profile.prompt}\n\nKaçınılacak özellikler: ${profile.negativePrompt}`
        : profile.prompt,
    }],
    reasoningEffort: config.reasoningEffort || "",
  });

  try {
    const generated = await aiService.generateImage(app.getPath("userData"), {
      entityKey: profile.entityKey,
      prompt: profile.prompt,
      negativePrompt: profile.negativePrompt,
      size: input?.size,
    });
    const attached = visualProfiles.attachStoredFile(database(), profile.entityKey, {
      entityType: profile.entityType,
      file: generated.file,
      source: "generated",
      provider: generated.provider,
      model: generated.model,
    });
    const actualModel = generated.model || generated.controllerModel || configuredModel;
    aiActivity.completeRequest(request, {
      label: "Görsel üretildi",
      model: actualModel,
      finishReason: "completed",
      content: `“${subject}” için ${generated.size || size} görsel üretildi ve Studio görsel arşivine kaydedildi.`,
    });
    aiActivity.finishSession(activitySession.id, {
      state: "done",
      model: actualModel,
      detail: `“${subject}” görseli hazır.`,
    });
    refreshMainWindow();
    return { ok: true, profile: attached, generation: generated };
  } catch (error) {
    aiActivity.failRequest(request, error, { label: "Görsel üretimi başarısız" });
    aiActivity.finishSession(activitySession.id, {
      state: error?.code === "AI_REQUEST_CANCELED" ? "canceled" : "error",
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function workersBusy() { return analysisWorkerRunning || universeWorkerRunning; }

module.exports = {
  workersBusy,
  cancelAnalysisQueue,
  cancelUniverseQueue,
  createPublicExport,
  database,
  generateVisualImage,
  navigateMainWindow,
  notifyYtDlpChanged,
  pickVisualImage,
  pickVefkSource,
  vefkUserDataPath: () => app.getPath("userData"),
  processAnalysisQueue,
  processUniverseQueue,
  publicationPreview,
  publishPublicExport,
  refreshMainWindow,
  setMainWindow,
  showPublicExport,
};
