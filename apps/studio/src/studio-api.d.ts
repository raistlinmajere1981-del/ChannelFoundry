type StudioPersistedItem = {
  key: string;
  id: string;
  kind: "video" | "character" | "event" | "file";
  title: string;
  meta: string;
  summary: string;
  status: "published" | "draft";
};

type StudioPersistedRelation = {
  id: string;
  fromKey: string;
  toKey: string;
  label: string;
  note?: string | null;
  source: "base" | "local";
};

type StudioDatabaseState = { items: StudioPersistedItem[]; relations: StudioPersistedRelation[] };
type StudioDatabaseInfo = { engine: string; file: string; itemCount: number; relationCount: number };
type StudioBulkResult = { ok: true; action: "publish" | "draft" | "delete"; requested: number; affected: number; affectedRelations: number; missing: number };

type StudioYoutubePreview = { provider: "youtube"; videoId: string; url: string; title: string; channel: string; thumbnailUrl: string };
type StudioYoutubeImportResult = { imported: boolean; reason?: "already_exists"; item: StudioPersistedItem; source: Omit<StudioYoutubePreview, "title"> };
type StudioYoutubeChannel = {
  id: string;
  url: string;
  title: string;
  handle: string;
  lastSyncedAt: string | null;
  lastFullSyncedAt: string | null;
  videoCount: number;
  active?: boolean;
  sourceType: "channel" | "playlist";
  playlistUrl: string;
  playlistTitle: string;
};
type StudioSceneDocument = {
  version: 2; kind: "objectScene"; sceneId: string;
  viewport: { width: number; height: number };
  objects: Array<Record<string, unknown>>;
  effects: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
type StudioSceneReadiness = { ready: boolean; effectCount: number; enabledCount: number; mountedCount: number; problems: string[] };
type StudioSceneWorkshopLoad = { scene: StudioSceneDocument; origin: "site" | "draft"; sourceHash: string; note: string;
  readiness: StudioSceneReadiness; siteSource: true; previewImage: string; previewObjects: unknown[]; previewArt:{objectId:string;path:string;label:string;warning:string;image:string}[]; roomObjects:unknown[]; assets: {path:string;dataUrl:string}[]; presentation:Record<string,unknown>; focusTargets:{id:string;foundation:{x:number;y:number}}[] };
type StudioSceneWorkshopSave = { ok: true; sourceHash: string; draftHash: string; readiness: StudioSceneReadiness; message: string };
type StudioSceneWorkshopPrepare = { ok: true; changed: boolean; sourceHash: string; draftHash: string;
  readiness: StudioSceneReadiness; message: string };
type StudioSceneWorkshopPreflight = { ok: true; token: string; expiresAt: number; readiness: StudioSceneReadiness; message: string };
type StudioYoutubeCatalogVideo = {
  videoId: string; channelId: string; title: string; publishedAt: string; durationSeconds: number | null; url: string; thumbnailUrl: string; thumbnailFile: string;
  availability: string; liveStatus: string; subtitleStatus: "manual" | "automatic" | "none" | "unknown" | "";
  subtitleLanguages: string[]; automaticCaptionLanguages: string[];
  detailCheckStatus?: "checked" | "none" | "unavailable" | "retry" | "unknown";
  detailCheckedAt?: string; detailRetryAt?: string;
  contentKey: string | null; editorialStatus: "published" | "draft" | null; hasTranscript: boolean; subtitleIgnored: boolean; thumbnailCached: boolean;
};
type StudioYoutubeCatalogStats = { total: number; imported: number; transcripts: number; pendingImport: number };
type StudioYoutubeChannelAddResult = { ok: true; created: boolean; channel: StudioYoutubeChannel };
type StudioYoutubeChannelMediaOptions = {
  channelId: string;
  metadataLanguage: string;
  subtitleLanguages: string[];
  thumbnailSize: "small" | "standard" | "large";
};
type StudioYoutubeSyncResult = {
  ok: true; mode: "recent" | "full"; tool: StudioTranscriptToolStatus; channel: StudioYoutubeChannel;
  newCount: number; updatedCount: number; removedCount: number; cachedCount: number; archivedThumbnailCount: number;
  detailStats: { requested: number; completed: number; unavailable: number; skipped: number; deferred?: number };
} | { ok: false; canceled: true };
type StudioYoutubeSyncProgress = {
  phase: "preparing" | "catalog" | "scanning" | "thumbnails" | "saving" | "complete" | "canceling" | "canceled";
  processed: number; total: number; percent: number; currentTitle: string;
};

type StudioTranscript = { contentKey: string; videoId?: string; source: "youtube" | "manual"; language: string; text: string; updatedAt: string; characterCount: number; wordCount: number };
type StudioTranscriptToolStatus = { available: boolean; version: string; error?: string };
type StudioYtDlpStatus = {
  available: boolean;
  version: string;
  source: "managed" | "system" | "none";
  path: string;
  error: string;
  platform: string;
  supported: boolean;
  latestVersion: string;
  updateAvailable: boolean;
  autoCheck: boolean;
  autoUpdate: boolean;
  metadataLanguage: string;
  subtitleLanguages: string[];
  thumbnailSize: "small" | "standard" | "large";
  lastCheckedAt: string;
  lastUpdatedAt: string;
  lastError: string;
  phase: "idle" | "checking" | "downloading" | "installing" | "complete" | "error";
  message: string;
};

type StudioAiProvider = "ollama" | "openai-compatible" | "codex-cli" | "opencode-cli";
type StudioAiImageMode = "auto" | "enabled" | "disabled";
type StudioAiImageProvider = "openai-compatible" | "cloudflare-workers-ai" | "codex-cli";
type StudioCodexReasoningEffort = string; // Catalog-driven; providers choose their own names.
type StudioCodexReasoningOption = { reasoningEffort: StudioCodexReasoningEffort; description: string; mode?: "effort" | "variant" | "thinkingLevel" };
type StudioAiModelCatalogEntry = {
  id: string;
  text: boolean;
  image: boolean;
  label: string;
  description?: string;
  isDefault?: boolean;
  supportedReasoningEfforts?: StudioCodexReasoningOption[];
  defaultReasoningEffort?: StudioCodexReasoningEffort | "";
};
type StudioGoogleQuickstart = { endpoint: string; model: string; apiKey: string };
type StudioAiModelCatalogRequest = {
  provider?: StudioAiProvider;
  endpoint?: string;
  apiKey?: string;
  timeoutSeconds?: number;
};
type StudioAiImageModelCatalogRequest = StudioAiModelCatalogRequest & {
  imageProvider?: StudioAiImageProvider;
  imageEndpoint?: string;
  imageApiKey?: string;
};
type StudioAiConfig = {
  provider: StudioAiProvider;
  endpoint: string;
  model: string;
  reasoningEffort: StudioCodexReasoningEffort | "";
  reasoningMode: "" | "effort" | "variant" | "thinkingLevel";
  fallbackModel: string;
  configured: boolean;
  apiKeyConfigured: boolean;
  image: {
    mode: StudioAiImageMode;
    provider: StudioAiImageProvider;
    endpoint: string;
    model: string;
    reasoningEffort: StudioCodexReasoningEffort | "";
    reasoningMode: "" | "effort" | "variant" | "thinkingLevel";
    configured: boolean;
    apiKeyConfigured: boolean;
  };
};
type StudioAiImageCapability = { supported: boolean; detected: boolean; mode: StudioAiImageMode; provider: StudioAiImageProvider; model: string; controllerModel?: string; reason: string };
type StudioAiCliStatus = {
  provider: "codex-cli";
  installed: boolean;
  authenticated: boolean;
  ready: boolean;
  version: string;
  command: string;
  detail: string;
};

type StudioAiRelationSuggestion = { key: string; label: string; reason: string };
type StudioAiSuggestion = { title: string; summary: string; relations: StudioAiRelationSuggestion[]; config: StudioAiConfig };

type StudioVisualDefinition = {
  description: string;
  attributes: string[];
  atmosphere: string;
  prompt: string;
  negativePrompt: string;
};
type StudioAiAnalysisCharacter = { name: string; aliases: string[]; role: string; details: string[]; visual: StudioVisualDefinition };
type StudioAiAnalysisNamedVisual = { name: string; details: string[]; visual: StudioVisualDefinition };
type StudioAiAnalysisScene = { name: string; description: string; visual: StudioVisualDefinition };
type StudioAiAnalysisResult = {
  videoId: string;
  model: string;
  title: string;
  summary: string;
  topics: string[];
  storyBeats: string[];
  storyHints: string[];
  coverVisual: StudioVisualDefinition;
  characters: StudioAiAnalysisCharacter[];
  locations: StudioAiAnalysisNamedVisual[];
  objects: StudioAiAnalysisNamedVisual[];
  scenes: StudioAiAnalysisScene[];
  updatedAt: string;
};
type StudioAiAnalysisVideo = {
  videoId: string; title: string; publishedAt: string; durationSeconds: number | null; thumbnailUrl: string; thumbnailFile: string; contentKey: string | null;
  hasTranscript: boolean; hasAnalysis: boolean; jobState: "" | "waiting" | "running" | "done" | "error"; jobError: string; attempts: number; analysisModel: string; analysisUpdatedAt: string;
};
type StudioAiAnalysisStats = { transcripts: number; analyzed: number; waiting: number; running: number; errors: number };
type StudioAiActivityState = "running" | "done" | "error" | "canceled";
type StudioAiActivityMessage = {
  role: "system" | "user" | "assistant" | "model";
  content: string;
  characters: number;
  truncated: boolean;
};
type StudioAiActivityEvent = {
  id: string;
  at: string;
  type: "status" | "request" | "response" | "error";
  tone?: "info" | "success" | "error";
  requestId?: string;
  label?: string;
  stage?: string;
  attempt?: "primary" | "fallback" | "repair";
  provider?: string;
  model?: string;
  messages?: StudioAiActivityMessage[];
  settings?: { temperature: number | null; maxTokens: number | null; json: boolean; reasoningEffort: StudioCodexReasoningEffort | "" };
  content?: string;
  characters?: number;
  truncated?: boolean;
  finishReason?: string;
  durationMs?: number;
  code?: string;
  message?: string;
};
type StudioAiActivitySession = {
  id: string;
  key: string;
  kind: "analysis" | "universe";
  title: string;
  subject: string;
  state: StudioAiActivityState;
  provider: string;
  configuredModel: string;
  model: string;
  fallbackUsed: boolean;
  stage: string;
  detail: string;
  requestCount: number;
  responseCount: number;
  errorCount: number;
  omittedEventCount: number;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  durationMs: number;
  context: Record<string, unknown>;
};
type StudioAiActivitySnapshot = {
  activeSessionId: string | null;
  activeModel: string;
  latestModel: string;
  sessions: StudioAiActivitySession[];
  selectedSession: (StudioAiActivitySession & { events: StudioAiActivityEvent[] }) | null;
};

type StudioUniverseDetail = { text: string; sourceVideoIds: string[] };
type StudioUniverseStory = {
  name: string; aliases: string[]; summary: string; sourceVideoIds: string[]; sequence: StudioUniverseDetail[];
  characterNames: string[]; locationNames: string[]; objectNames: string[]; visual: StudioVisualDefinition;
};
type StudioUniverseEntity = {
  name: string; aliases: string[]; summary: string; sourceVideoIds: string[]; storyNames: string[]; details: StudioUniverseDetail[]; visual: StudioVisualDefinition;
  roles?: string[];
};
type StudioUniverseEvent = {
  name: string; summary: string; sourceVideoIds: string[]; storyNames: string[]; characterNames: string[]; locationNames: string[]; visual: StudioVisualDefinition;
};
type StudioUniverseRelation = {
  fromType: "story" | "character" | "event" | "location" | "object"; fromName: string;
  toType: "story" | "character" | "event" | "location" | "object"; toName: string; label: string; sourceVideoIds: string[];
};
type StudioUniverse = {
  stories: StudioUniverseStory[];
  characters: StudioUniverseEntity[];
  events: StudioUniverseEvent[];
  locations: StudioUniverseEntity[];
  objects: StudioUniverseEntity[];
  relations: StudioUniverseRelation[];
};
type StudioUniverseMergeRun = {
  id: number; state: "waiting" | "running" | "done" | "error"; model: string; analysisCount: number; error: string;
  createdAt: string; updatedAt: string; finishedAt: string | null; totalChunks: number; doneChunks: number; errorChunks: number; level: number;
};
type StudioUniversePendingSource = { videoId: string; title: string; publishedAt: string };
type StudioUniverseIngestStatus = {
  pending: number; newSources: number; changedSources: number; eligible: number; processed: number; withdrawals: number;
  awaitingApplyRunId: number | null; batchLimit: number; nextSources: StudioUniversePendingSource[];
  backlog: { drafts: number; revisions: number; total: number };
};
type StudioUniverseMergeStatus = { availableAnalyses: number; ingest?: StudioUniverseIngestStatus; run: StudioUniverseMergeRun | null };
type StudioUniverseMergeResult = {
  id: number; state: StudioUniverseMergeRun["state"]; model: string; analysisCount: number; createdAt: string; finishedAt: string | null;
  universe: StudioUniverse; complete: boolean; sourceCoverage: { expected: number; actual: number; missing: string[] };
};

type StudioUniverseWorkspaceState = "draft" | "approved";
type StudioUniverseWorkspaceNode = {
  key: string;
  runId: number;
  kind: "story" | "character" | "event" | "location" | "object";
  name: string;
  summary: string;
  aliases: string[];
  sourceVideoIds: string[];
  payload: StudioUniverseStory | StudioUniverseEntity | StudioUniverseEvent | Record<string, unknown>;
  state: StudioUniverseWorkspaceState;
  isMainCharacter: boolean;
  updatedAt: string;
};
type StudioUniverseWorkspaceStatus = {
  latestImport: null | { runId: number; analysisCount: number; model: string; nodeCount: number; relationCount: number; importedAt: string };
  counts: {
    total: number; draft: number; approved: number; stories: number; characters: number; events: number; locations: number; objects: number;
    relations: number; approvedRelations: number;
  };
};
type StudioUniverseWorkspaceApplyResult = StudioUniverseWorkspaceStatus & {
  ok: true; runId: number; created: number; updated: number; approvedProtected: number;
  relationCreated: number; relationUpdated: number; relationSkipped: number;
};
type StudioUniverseWorkspaceStateResult = StudioUniverseWorkspaceStatus & {
  ok: true; state: StudioUniverseWorkspaceState; requested: number; affected: number; missing: number;
};

type StudioImageOptimization = { format: "webp"; inputBytes: number; bytes: number; width: number; height: number; sourceWidth: number; sourceHeight: number };
type StudioVisualProfile = {
  entityKey: string;
  entityType: string;
  source: string;
  description: string;
  attributes: string[];
  atmosphere: string;
  prompt: string;
  negativePrompt: string;
  imagePath: string;
  imageSource: string;
  imageProvider: string;
  imageModel: string;
  imageDataUrl: string;
  updatedAt: string;
};
type StudioVisualProfileInput = {
  entityKey: string;
  entityType?: string;
  source?: string;
  description?: string;
  attributes?: string[];
  atmosphere?: string;
  prompt?: string;
  negativePrompt?: string;
};

type StudioPublicExportResult = { readiness?: { readyForTheme: boolean; narrativeChangesPending: boolean; visualComplete: boolean; narrativeSections: number }; root: string; file: string; generatedAt: string; itemCount: number; relationCount: number; editorialNodeCount?: number; editorialRelationCount?: number };
type StudioLivePublication = { ok: true; published: true; generatedAt: string; itemCount: number; relationCount: number; bytes: number; sha256: string; verified: boolean; publicUrl: string; admin: { id: number; username: string } };
type StudioPublicPublishResult = StudioPublicExportResult & { live: StudioLivePublication };
type StudioPublicationInfo = { generatedAt: string; file: string; itemCount: number; relationCount: number };
type StudioWebsiteInsights = {
  ok: true; anonymous: true; days: number; visits: number; activeSeconds: number;
  areas: Array<{ area: string; opens: number; views: number; plays: number; completions: number; seconds: number }>;
  daily: Array<{ day: string; visits: number; seconds: number }>;
  contents: Array<{ area: string; contentKey: string; views: number }>;
};
type StudioSeoRow = {
  kind: "section" | "video" | "vefk"; language:PublicationLanguage; id: string; title: string; description: string;
  source: string; sourceHash:string; path: string; override: boolean; needsReview: boolean;
  candidate?:{sourceHash:string;title:string;description:string;createdAt:string}|null;
};
type StudioSeoOverview = {
  site: { title: string; description: string; image: string };
  sites:Record<PublicationLanguage,{title:string;description:string;image:string}>;
  rows: StudioSeoRow[]; draftCount: number;
};

type StudioChannelProject = {
  id: string;
  displayName: string;
  youtubeChannelUrl: string;
  youtubePlaylistUrl: string;
  webRepository: string;
  webDirectory: string;
  webUrl: string;
  hostingProvider: string;
  deploymentEnabled: boolean;
  narrator: StudioNarrativeNarratorProfile;
  narratorMigrationError?: string;
  hasWeb: boolean;
};
type StudioChannelProjects = { activeId: string; projects: StudioChannelProject[] };
type StudioChannelProjectInput = Pick<StudioChannelProject, "id" | "displayName" | "youtubeChannelUrl" | "youtubePlaylistUrl" | "webRepository" | "webUrl" | "hostingProvider"> & { narrator?: StudioNarrativeNarratorProfile };

type StudioWebConnectionConfig = {
  url: string;
  youtubeChannelUrl: string;
  defaultUrl: string;
  customized: boolean;
  environmentOverride: boolean;
  endpoints: { community: string; studio: string; publicationAsset: string; publication: string };
};
type StudioWebConnectionTest = {
  ok: true;
  url: string;
  pageStatus: number;
  studio: { ok: true; service: string; status: number };
  community: { ok: true; service: string; status: number };
  latencyMs: number;
  checkedAt: string;
};

type StudioCommunityAdmin = { id: number; username: string; displayName: string; role: "admin"; researchAccess: boolean };
type StudioCommunityUser = { id: number; username: string; displayName: string; role: "member" | "admin"; status: "active" | "suspended"; researchAccess: boolean; createdAt: string; lastLoginAt: string | null; threadCount: number; postCount: number };
type StudioCommunitySession = {
  connected: boolean; configured: boolean; connecting: boolean; endpoint: string; studioEndpoint?: string; username: string | null;
  lastError: string | null; secureStorageAvailable: boolean;
};

interface Window {
  channelFoundryStudio?: {
    sceneWorkshopLoad(): Promise<StudioSceneWorkshopLoad>;
    sceneWorkshopSave(input: { scene: StudioSceneDocument; assets?: {path:string;dataUrl:string}[]; presentation?:Record<string,unknown>; expectedSourceHash: string }): Promise<StudioSceneWorkshopSave>;
    sceneWorkshopPrepare(): Promise<StudioSceneWorkshopPrepare>;
    sceneWorkshopPreflight(): Promise<StudioSceneWorkshopPreflight>;
    sceneWorkshopDeploy(input: { token: string }): Promise<{ ok: true; message: string }>;
    sceneWorkshopInvalidate(): Promise<{ ok: true }>;
    onSceneWorkshopProgress(callback: (progress: { operation: "preflight" | "deploy"; message: string }) => void): () => void;
    channelProjects(): Promise<StudioChannelProjects>;
    channelNarratorSources(input: { id: string }): Promise<StudioNarratorSourceEntity[]>;
    channelProjectCreate(input: StudioChannelProjectInput): Promise<StudioChannelProject>;
    channelProjectUpdate(input: StudioChannelProjectInput): Promise<StudioChannelProject>;
    channelProjectSelect(input: { id: string }): Promise<{ changed: boolean; project: StudioChannelProject }>;
    channelProjectConnectSource(): Promise<StudioYoutubeChannelAddResult>;
    bootstrap(payload?: Partial<StudioDatabaseState>): Promise<{ seeded: boolean }>;
    loadState(): Promise<StudioDatabaseState>;
    saveItem(item: StudioPersistedItem): Promise<StudioPersistedItem>;
    deleteItem(key: string): Promise<{ deleted: boolean; key: string; relationCount: number }>;
    addRelation(relation: StudioPersistedRelation): Promise<StudioPersistedRelation & { inserted: boolean }>;
    deleteRelation(id: string): Promise<{ deleted: boolean; id: string }>;
    refreshMain(): Promise<boolean>;
    navigate(section: string): Promise<boolean>;
    onNavigate(callback: (section: string) => void): () => void;
    onDataChanged(callback: () => void): () => void;
    bulkApply(input: { action: "publish" | "draft" | "delete"; keys: string[] }): Promise<StudioBulkResult>;
    openExternalUrl(url: string): Promise<boolean>;
    youtubeInspect(input: { url: string }): Promise<StudioYoutubePreview>;
    youtubeImport(input: { url: string }): Promise<StudioYoutubeImportResult>;
    youtubeCatalogStatus(): Promise<StudioTranscriptToolStatus>;
    ytDlpStatus(): Promise<StudioYtDlpStatus>;
    ytDlpSaveOptions(input: { autoCheck?: boolean; autoUpdate?: boolean }): Promise<StudioYtDlpStatus>;
    ytDlpCheck(): Promise<StudioYtDlpStatus>;
    ytDlpInstall(): Promise<StudioYtDlpStatus>;
    onYtDlpChanged(callback: () => void): () => void;
    youtubeCatalogChannels(): Promise<StudioYoutubeChannel[]>;
    youtubeCatalogActive(): Promise<StudioYoutubeChannel | null>;
    youtubeCatalogSetActive(input: { channelId: string }): Promise<StudioYoutubeChannel>;
    youtubeChannelMediaOptions(input?: { channelId?: string }): Promise<StudioYoutubeChannelMediaOptions | null>;
    youtubeChannelMediaOptionsSave(input: StudioYoutubeChannelMediaOptions): Promise<StudioYoutubeChannelMediaOptions>;
    youtubeChannelAdd(input: { youtubeChannelUrl: string; youtubePlaylistUrl?: string }): Promise<StudioYoutubeChannelAddResult>;
    youtubeCatalogVideos(input?: { channelId?: string }): Promise<StudioYoutubeCatalogVideo[]>;
    youtubeCatalogStats(): Promise<StudioYoutubeCatalogStats>;
    youtubeCatalogSync(input: { mode: "recent" | "full"; excludeShorts?: boolean; excludeLive?: boolean; excludeMembersOnly?: boolean }): Promise<StudioYoutubeSyncResult>;
    youtubeCatalogCancel(): Promise<{ canceled: boolean }>;
    onYoutubeCatalogProgress(callback: (progress: StudioYoutubeSyncProgress) => void): () => void;
    youtubeCatalogImport(input: { videoId: string }): Promise<StudioYoutubeImportResult>;
    transcriptIgnoreClear(input: { videoId: string }): Promise<{ cleared: boolean }>;
    transcriptGet(contentKey: string): Promise<StudioTranscript | null>;
    transcriptSave(input: { contentKey: string; source?: "youtube" | "manual"; language?: string; text: string }): Promise<StudioTranscript>;
    transcriptDelete(contentKey: string): Promise<{ deleted: boolean; contentKey: string }>;
    transcriptToolStatus(): Promise<StudioTranscriptToolStatus>;
    transcriptFetchYoutube(input: { contentKey?: string; videoId?: string; archiveOperationId?: string }): Promise<StudioTranscript & { ytDlpVersion: string; filename: string; captionType?: string }>;
    transcriptArchiveCancel(input: { archiveOperationId: string }): Promise<{ canceled: boolean }>;
    aiProviders(): Promise<Array<{ id: string; label: string; role: "text" | "image" | "both"; transport: "cli" | "api" | "local" | "none"; endpoint: string; secret: boolean }>>;
    aiOpenCodeService(): Promise<string>;
    aiTestCandidate(input: Record<string, unknown>): Promise<{ ok: true; reply: string; config: StudioAiConfig }>;
    aiImageTestCandidate(input: Record<string, unknown>): Promise<{ ok: true; model: string; bytes: number }>;
    aiConfig(): Promise<StudioAiConfig>;
    aiCliStatus(): Promise<StudioAiCliStatus>;
    aiRevealKey(kind: "text" | "image"): Promise<string>;
    aiParseGoogleQuickstart(value: string): Promise<StudioGoogleQuickstart>;
    aiSaveConfig(input: {
      provider: StudioAiProvider; endpoint: string; model: string; reasoningEffort?: StudioCodexReasoningEffort | ""; reasoningMode?: "" | "effort" | "variant" | "thinkingLevel"; fallbackModel?: string; apiKey?: string; clearApiKey?: boolean;
      imageMode?: StudioAiImageMode; imageProvider?: StudioAiImageProvider; imageEndpoint?: string; imageModel?: string; imageReasoningEffort?: StudioCodexReasoningEffort | ""; imageReasoningMode?: "" | "effort" | "variant" | "thinkingLevel"; imageApiKey?: string; clearImageApiKey?: boolean;
    }): Promise<StudioAiConfig>;
    aiModels(input?: StudioAiModelCatalogRequest): Promise<{ models: StudioAiModelCatalogEntry[]; textModels: string[]; imageModels: string[]; defaultModel?: string; config: StudioAiConfig }>;
    aiImageModels(input?: StudioAiImageModelCatalogRequest): Promise<{ provider: StudioAiImageProvider; models: Array<StudioAiModelCatalogEntry>; imageModels: string[]; defaultModel?: string; config: StudioAiConfig }>;
    aiTest(): Promise<{ ok: true; reply: string; fallback: null | { model: string; reply: string }; config: StudioAiConfig }>;
    aiImageCapability(): Promise<StudioAiImageCapability>;
    aiSuggest(input: { selected: StudioPersistedItem; related: StudioPersistedItem[]; candidates: StudioPersistedItem[]; transcript?: string }): Promise<StudioAiSuggestion>;
    aiAnalysisList(): Promise<StudioAiAnalysisVideo[]>;
    aiAnalysisStats(): Promise<StudioAiAnalysisStats>;
    aiAnalysisResult(videoId: string): Promise<StudioAiAnalysisResult | null>;
    aiAnalysisEnqueue(input: { videoIds: string[]; force?: boolean }): Promise<{ ok: true; requested: number; accepted: number; skipped: number }>;
    aiAnalysisResume(): Promise<{ running: boolean; reason?: string; stats?: StudioAiAnalysisStats }>;
    aiAnalysisCancel(): Promise<{ running: boolean; canceled: number }>;
    aiActivitySnapshot(input?: { sessionId?: string; includeEvents?: boolean }): Promise<StudioAiActivitySnapshot>;
    universeMergeStatus(): Promise<StudioUniverseMergeStatus>;
    universeMergeResult(runId?: number): Promise<StudioUniverseMergeResult | null>;
    universeMergeStart(input?: { videoIds?: string[] }): Promise<StudioUniverseMergeStatus>;
    universeMergeResume(): Promise<{ running: boolean; reason?: string } & StudioUniverseMergeStatus>;
    universeMergeCancel(): Promise<{ running: boolean; canceled: number; runId: number | null } & StudioUniverseMergeStatus>;
    universeWorkspaceStatus(): Promise<StudioUniverseWorkspaceStatus>;
    universeWorkspaceList(input?: { kind?: StudioUniverseWorkspaceNode["kind"]; state?: StudioUniverseWorkspaceState }): Promise<StudioUniverseWorkspaceNode[]>;
    universeWorkspaceApply(runId?: number): Promise<StudioUniverseWorkspaceApplyResult>;
    universeWorkspaceSetState(input: { keys: string[]; state: StudioUniverseWorkspaceState }): Promise<StudioUniverseWorkspaceStateResult>;
    openAiWorkbench(): Promise<boolean>;
    visualProfileGet(entityKey: string): Promise<StudioVisualProfile | null>;
    visualProfileSave(input: StudioVisualProfileInput): Promise<StudioVisualProfile>;
    visualImagePick(input: { entityKey: string; entityType?: string }): Promise<{ canceled: boolean; profile?: StudioVisualProfile; optimization?: StudioImageOptimization }>;
    visualImageGenerate(input: StudioVisualProfileInput & { size?: "1024x1024" | "1536x1024" | "1024x1536" }): Promise<{ ok: true; profile: StudioVisualProfile; generation: { file: string; provider: string; model: string; controllerModel?: string; size: string; capability: StudioAiImageCapability; optimization: StudioImageOptimization } }>;
    visualImageClear(entityKey: string): Promise<{ cleared: boolean; entityKey: string; profile?: StudioVisualProfile }>;
    visualImageShow(entityKey: string): Promise<boolean>;
    vefkDelete(input: { id: string; confirmed: true }): Promise<{ id: string; revisions: number; catalogRemoved: boolean }>;
    vefkCopy(input: { id: string; newId: string; title?: string }): Promise<StudioVefkRecord>;
    vefkSourceReviewInfo(id: string): Promise<StudioVefkSourceReview | null>;
    vefkSourceDelete(input: { id: string; confirmed: true }): Promise<{ removed: number; cleanupPending?: boolean }>;
    vefkAnalysisDelete(input: { id: string; confirmed: true }): Promise<{ removed: number }>;
    vefkSourceRename(input: { id: string; title: string }): Promise<StudioVefkSource>;
    vefkSourceCleanup(input: { confirmed: true }): Promise<{ removed: number }>;
    vefkGenerate(input: StudioVefkCreateInput): Promise<StudioVefkDocument>;
    vefkValidate(document: StudioVefkDocument): Promise<{ ok: true; contentHash: string; pathCount: number; strokeCount: number }>;
    vefkList(input?: { status?: StudioVefkStatus; query?: string; limit?: number; offset?: number }): Promise<StudioVefkListItem[]>;
    vefkGet(input: { id: string; revision?: number }): Promise<StudioVefkRecord | null>;
    vefkRevisions(id: string): Promise<StudioVefkRevision[]>;
    vefkSaveDraft(input: { document: StudioVefkDocument; expectedContentHash?: string; sourceReview?: StudioVefkSourceReview | null }): Promise<StudioVefkRecord>;
    vefkReview(input: { id: string; revision: number; status: "draft" | "checked" | "approved"; expectedContentHash: string }): Promise<StudioVefkRecord>;
    vefkApproved(): Promise<StudioVefkRecord[]>;
    vefkPackageStatus(): Promise<{ ready: boolean }>;
    vefkCatalogList(): Promise<StudioVefkCatalogSelection[]>;
    vefkCatalogSelect(input: { id: string; revision?: number; contentHash?: string; sortOrder?: number; enabled: boolean }): Promise<{ id: string; revision?: number; selected: boolean; contentHash?: string; sortOrder?: number; selectedAt?: string }>;
    vefkSourcePick(): Promise<{ canceled: true } | { canceled: false; source: StudioVefkSource }>;
    vefkSourceList(): Promise<StudioVefkSource[]>;
    vefkSourceGet(id: string, preparationRevision?: number): Promise<StudioVefkSourceImage | null>;
    vefkSourcePrepare(input: {
      sourceId: string;
      expectedRevision: number;
      config: StudioVefkPreparationConfig;
      imageDataUrl: string;
    }): Promise<StudioVefkPreparation>;
    vefkSourceAnalysis(id: string): Promise<StudioVefkSourceAnalysis | null>;
    vefkSourceAnalyze(id: string): Promise<StudioVefkSourceAnalysis>;
    vefkSourceReview(input: { sourceId: string; expectedAnalysisId: number; result: StudioVefkSourceAnalysisResult }): Promise<StudioVefkSourceAnalysis>;
    vefkVisionSupport(): Promise<StudioVefkVisionSupport>;
    webConnectionConfig(): Promise<StudioWebConnectionConfig>;
    webConnectionTest(input: { url: string }): Promise<StudioWebConnectionTest>;
    webConnectionSave(input: { url: string; youtubeChannelUrl: string }): Promise<StudioWebConnectionConfig>;
    exportPublicSnapshot(mode?: "full" | "update"): Promise<StudioPublicExportResult>;
    publishPublicSnapshot(mode?: "full" | "update"): Promise<StudioPublicPublishResult>;
    analyticsSummary(days?: number): Promise<StudioWebsiteInsights>;
    analyticsReset(): Promise<{ ok: true; removedEvents: number }>;
    languagesOverview(): Promise<PublicationLanguageOverview>;
    languagesGet(input:{kind:PublicationLanguageKind;id:string}): Promise<PublicationLanguagePack|null>;
    languagesSave(input:{kind:PublicationLanguageKind;id:string;language:PublicationLanguage;data:LanguageData;sourceHash:string;revision:number;approved:boolean}): Promise<PublicationLanguagePack>;
    languagesGenerate(input:{kind:PublicationLanguageKind;id:string;language:PublicationLanguage}): Promise<PublicationLanguagePack>;
    languagesBatchStatus():Promise<PublicationTranslationBatchStatus>;
    languagesBatchEnqueue(input:{items:{kind:PublicationLanguageKind;id:string}[]}):Promise<PublicationTranslationBatchStatus & {queued:number;skipped:number}>;
    languagesBatchPause():Promise<PublicationTranslationBatchStatus>;
    languagesBatchResume():Promise<PublicationTranslationBatchStatus>;
    languagesBatchRetry():Promise<PublicationTranslationBatchStatus>;
    seoOverview(): Promise<StudioSeoOverview>;
    seoSave(input: { kind: string; language:PublicationLanguage; approved?:boolean; sourceHash?:string; id?: string; title: string; description: string; image?: string }): Promise<StudioSeoOverview>;
    seoSuggest(input: { kind: string; language:PublicationLanguage; id: string }): Promise<{ title: string; description: string }>;
    seoBatchStatus():Promise<StudioSeoBatchStatus>;
    seoBatchEnqueue(input:{items:{kind:StudioSeoRow['kind'];id:string;language:PublicationLanguage}[]}):Promise<StudioSeoBatchStatus & {queued:number;skipped:number}>;
    seoBatchPause():Promise<StudioSeoBatchStatus>;
    seoBatchResume():Promise<StudioSeoBatchStatus>;
    seoBatchRetry():Promise<StudioSeoBatchStatus>;
    getPublicationInfo(): Promise<StudioPublicationInfo | null>;
    showPublicExport(): Promise<boolean>;
    getDatabaseInfo(): Promise<StudioDatabaseInfo>;
    communitySession(): Promise<StudioCommunitySession>;
    communityAdminConnect(): Promise<StudioCommunitySession>;
    communityAdminSave(input: { username: string; password: string }): Promise<{ ok: true; admin: StudioCommunityAdmin; session: StudioCommunitySession }>;
    communityAdminSetupStatus(): Promise<{ setupRequired: boolean; deploymentReady: boolean }>;
    communityAdminCreateFirst(input: { username: string; password: string }): Promise<{ ok: true; created: true; admin: StudioCommunityAdmin; session: StudioCommunitySession }>;
    communityAdminClear(): Promise<{ ok: true; session: StudioCommunitySession }>;
    communityUsers(): Promise<{ ok: true; users: StudioCommunityUser[] }>;
    communitySetResearch(input: { userId: number; enabled: boolean }): Promise<{ ok: true; userId: number; researchAccess: boolean }>;
    communitySetStatus(input: { userId: number; status: "active" | "suspended" }): Promise<{ ok: true; userId: number; status: "active" | "suspended" }>;
  };
}

type PublicationLanguage = "tr" | "en";
type PublicationLanguageKind = "video" | "section" | "vefk" | "entity" | "outline";
type LanguageData = Record<string, unknown>;
type PublicationLanguageVariant = {language:PublicationLanguage;data:LanguageData;state:"draft"|"approved";stale:boolean;sourceHash:string;revision:number;approvedRevision:number;manual:boolean;model:string;promptVersion:string;candidate:LanguageData|null;jobState:string;error:string};
type PublicationLanguagePack = {kind:PublicationLanguageKind;id:string;sourceHash:string;source:LanguageData;variants:Partial<Record<PublicationLanguage,PublicationLanguageVariant>>;flags?:Record<"ready"|"missing"|"pending"|"stale"|"errors",boolean>};
type PublicationLanguageOverview = {rows:PublicationLanguagePack[];counts:Record<"ready"|"missing"|"pending"|"stale"|"errors",number>};

type PublicationTranslationBatchStatus={rows:{kind:PublicationLanguageKind;id:string;language:"en";sourceHash:string;state:"queued"|"running"|"done"|"failed"|"skipped";attempts:number;error:string;updatedAt:string}[];counts:Record<"queued"|"running"|"done"|"failed"|"skipped",number>;running:boolean;paused:boolean};

type StudioSeoBatchStatus={rows:{kind:StudioSeoRow["kind"];id:string;language:PublicationLanguage;sourceHash:string;state:"queued"|"running"|"done"|"failed"|"skipped";attempts:number;error:string;updatedAt:string}[];counts:Record<"queued"|"running"|"done"|"failed"|"skipped",number>;running:boolean;paused:boolean};
