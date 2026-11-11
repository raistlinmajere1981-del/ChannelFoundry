import PublicationTranslationCenter from "./PublicationTranslationCenter";
import { useEffect, useState } from "react";
import {
  formatExportDate,
  publishErrorText,
  type LivePublicationInfo,
  type PublicationInfo,
  type PublicationPreview,
  type PublishItem,
  type PublishRelation,
  type ThemePublicationExport,
} from "./publish-model";

type LocalExportResult = ThemePublicationExport & {
  root: string;
  itemCount?: number;
  publicationV2?: ThemePublicationExport;
};

type LiveExportResult = LocalExportResult & {
  uploadedAssets: number;
  live: LivePublicationInfo;
};

type PublicationBridge = Omit<
  NonNullable<typeof window.channelFoundryStudio>,
  "exportPublicSnapshot" | "publishPublicSnapshot" | "getPublicationInfo"
> & {
  publicationPreview(): Promise<PublicationPreview>;
  exportPublicSnapshot(mode?: "full" | "update"): Promise<LocalExportResult>;
  publishPublicSnapshot(mode?: "full" | "update"): Promise<LiveExportResult>;
  getPublicationInfo(): Promise<PublicationInfo | null>;
};

function exportInfo(result: LocalExportResult): PublicationInfo {
  const value = result.publicationV2 ?? result;
  return {
    generatedAt: String(value.generatedAt ?? ""),
    file: String(value.file ?? ""),
    publicationId: String(value.publicationId ?? ""),
    contentFingerprint: String(value.contentFingerprint ?? ""),
    sectionCount: Number(value.sectionCount ?? 0),
    entityCount: Number(value.entityCount ?? 0),
    relationCount: Number(value.relationCount ?? 0),
    assetCount: Number(value.assetCount ?? 0),
    vefkCount: Number(value.vefkCount ?? 0),
  };
}

export default function PublishCenter({ items, relations, workspaceNodes, workspaceStatus }: {
  items: PublishItem[];
  relations: PublishRelation[];
  workspaceNodes: StudioUniverseWorkspaceNode[];
  workspaceStatus: StudioUniverseWorkspaceStatus | null;
}) {
  void items;
  void relations;
  void workspaceNodes;
  void workspaceStatus;

  const [publishMode, setPublishMode] = useState<"full" | "update">("update");
  const [activePublishView, setActivePublishView] = useState<"languages" | "delivery">("languages");
  const [publicationInfo, setPublicationInfo] = useState<PublicationInfo | null>(null);
  const [preview, setPreview] = useState<PublicationPreview | null>(null);
  const [livePublication, setLivePublication] = useState<LivePublicationInfo | null>(null);
  const [communityConnected, setCommunityConnected] = useState(false);
  const [project, setProject] = useState<StudioChannelProject | null>(null);
  const [localBuilding, setLocalBuilding] = useState(false);
  const [livePublishing, setLivePublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (bridge: PublicationBridge) => {
    const [info, session, nextPreview, projectInfo] = await Promise.all([
      bridge.getPublicationInfo(),
      bridge.communitySession(),
      bridge.publicationPreview(),
      bridge.channelProjects(),
    ]);
    setPublicationInfo(info);
    setCommunityConnected(Boolean(session?.connected));
    setProject(projectInfo.projects.find((entry) => entry.id === projectInfo.activeId) || null);
    setPreview(nextPreview ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    const bridge = window.channelFoundryStudio as PublicationBridge | undefined;
    const reload = async () => {
      if (!bridge) return;
      try {
        await load(bridge);
      } catch (loadError) {
        if (!cancelled) setError(publishErrorText(loadError));
      }
    };
    void reload();
    const unsubscribe = bridge?.onDataChanged?.(() => { void reload(); });
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  const readiness = preview?.readiness;
  const ready = Boolean(readiness?.readyForTheme);
  const updateReady = Boolean(preview?.update?.ready);
  const selectedReady = publishMode === "full" ? ready : updateReady;
  const counts = preview?.counts ?? { sections: 0, entities: 0, relations: 0, assets: 0, vefks: 0 };
  const reasons = [
    ...(readiness && readiness.narrativeSections === 0 ? ["05 · Hikâyeleştir aşamasında en az bir anlatı bölümü onaylanmalı."] : []),
    ...(readiness?.narrativeChangesPending ? ["Onaylı Evren değişiklikleri yaşayan anlatıya henüz uygulanmadı; 05 · Hikâyeleştir tamamlanmalı."] : []),
    ...(readiness && readiness.narrativeSections > 0 && !readiness.visualComplete ? ["06 · Görsel Tamamlama içinde bölüm sahneleri için karar bekliyor."] : []),
  ];

  const buildLocal = async () => {
    const bridge = window.channelFoundryStudio as PublicationBridge | undefined;
    if (!bridge) {
      setError("Yerel publication paketi yalnızca Electron Studio içinde oluşturulabilir.");
      return;
    }
    setLocalBuilding(true);
    setError(null);
    try {
      const result = await bridge.exportPublicSnapshot(publishMode);
      setPublicationInfo(exportInfo(result));
      setPreview(await bridge.publicationPreview());
    } catch (buildError) {
      setError(publishErrorText(buildError));
    } finally {
      setLocalBuilding(false);
    }
  };

  const publishLive = async () => {
    const bridge = window.channelFoundryStudio as PublicationBridge | undefined;
    if (!bridge) {
      setError("Canlı yayın yalnızca Electron Studio içinde yapılabilir.");
      return;
    }
    if (!project?.deploymentEnabled) {
      setError("Canlı yayın kapalı. Önce web sitesini kur; ardından Ayarlar → Kanal ve yayın → Web yayını bölümünden bağlantıyı test edip etkinleştir.");
      return;
    }
    const latestPreview = await bridge.publicationPreview();
    setPreview(latestPreview);
    if (publishMode === "full" ? !latestPreview.readiness.readyForTheme : !latestPreview.update?.ready) {
      setError(publishMode === "full" ? "Tam yayın için 05/06 aşamaları tamamlanmalı." : latestPreview.liveError || "Mevcut yayında doğrulanmış bir güncelleme bulunmuyor.");
      return;
    }
    const session = await bridge.communitySession();
    setCommunityConnected(Boolean(session.connected));
    if (!session.connected) {
      setError("Canlı yayın için önce Topluluk ekranından Studio yönetici bağlantısını kur.");
      return;
    }
    const confirmed = window.confirm(
      `${publishMode === "update" ? "Yalnız mevcut canlı kayıtlar güvenli biçimde güncellensin" : `${latestPreview.counts.sections} anlatı, ${latestPreview.counts.entities} arşiv kaydı ve ${latestPreview.counts.assets} görsel tam paket olarak yayınlansın`} mı?`,
    );
    if (!confirmed) return;

    setLivePublishing(true);
    setError(null);
    try {
      const result = await bridge.publishPublicSnapshot(publishMode);
      setPublicationInfo(exportInfo(result));
      setLivePublication(result.live);
      setPreview(await bridge.publicationPreview());
    } catch (publishError) {
      setError(publishErrorText(publishError));
    } finally {
      setLivePublishing(false);
    }
  };

  const revealPackage = async () => {
    try {
      await window.channelFoundryStudio?.showPublicExport();
    } catch (revealError) {
      setError(publishErrorText(revealError));
    }
  };

  const lastLiveAt = livePublication?.generatedAt ?? preview?.baseline?.generatedAt ?? null;
  const publishStatus = error || (!project?.deploymentEnabled ? "Canlı yayın kapalı · Ayarlar → Kanal ve yayın → Web yayını: bağlantıyı Test et ve etkinleştir." : "")
    || (localBuilding ? "Publication v2 yerel paketi oluşturuluyor…" : "")
    || (livePublishing ? "Asset'ler yükleniyor, publication.json etkinleştiriliyor ve doğrulanıyor…" : "")
    || (livePublication
      ? `Canlı yayın doğrulandı · ${formatExportDate(livePublication.generatedAt)}`
      : lastLiveAt ? `Son canlı yayın · ${formatExportDate(lastLiveAt)}` : "Henüz canlı publication v2 yayını yapılmadı.");

  return <section className="publish-center">
    <nav className="publish-phase-tabs" role="tablist" aria-label="Yayın hazırlığı aşamaları">
      <button type="button" role="tab" aria-selected={activePublishView === "languages"} onClick={() => setActivePublishView("languages")}>01 · Dil ve çeviri</button>
      <button type="button" role="tab" aria-selected={activePublishView === "delivery"} onClick={() => setActivePublishView("delivery")}>02 · Paket ve canlı yayın</button>
    </nav>
    {activePublishView === "languages" ? <PublicationTranslationCenter/> : <>
    <div className="publish-actions" role="group" aria-label="Yayın biçimi">
      <button type="button" className={publishMode === "update" ? "primary-button" : "secondary-button"} onClick={() => setPublishMode("update")}>İçerik / görsel güncellemesi</button>
      <button type="button" className={publishMode === "full" ? "primary-button" : "secondary-button"} onClick={() => setPublishMode("full")}>Tam yayın</button>
    </div>
    <section className={`panel theme-publication-panel${selectedReady ? " ready" : " waiting"}`}>
      <div className="theme-publication-head">
        <div>
          <small>KİTAP WEB · PUBLICATION V2</small>
          <h3>Studio’dan yeni Web temasına tek yayın hattı</h3>
          <p>{project?.webUrl || "Web hedefi tanımlanmadı"} · Publication v2</p>
        </div>
        <span>{!project?.deploymentEnabled ? "YAYIN KAPALI" : selectedReady ? "CANLI YAYINA HAZIR" : "HAZIRLIK BEKLİYOR"}</span>
      </div>

      <div className="theme-publication-metrics">
        <div><small>ANLATI</small><strong>{counts.sections}</strong><span>Onaylı bölüm</span></div>
        <div><small>ARŞİV</small><strong>{counts.entities}</strong><span>Approved entity</span></div>
        <div><small>BAĞLANTI</small><strong>{counts.relations}</strong><span>Approved relation</span></div>
        <div><small>ASSET</small><strong>{counts.assets}</strong><span>Publication görseli</span></div>
        <div><small>VEFK</small><strong>{counts.vefks}</strong><span>Site kataloğunda seçili</span></div>
      </div>

      {publishMode === "update" ? <div className={updateReady ? "theme-publication-gates ready" : "theme-publication-gates"}>
        <strong>{updateReady ? "Mevcut canlı kayıtlar güncellenebilir." : "Güncelleme için canlı yayın karşılaştırması gerekli."}</strong>
        <p>{preview?.liveError || (preview?.update ? `${preview.update.changes.updated} kayıt değişikliği, ${preview.update.changes.images} portre/görsel, ${preview.update.changes.assetUploads} yükleme; yeni kayıtlar yayına eklenmez.` : "Canlı paket bekleniyor.")}</p>
      </div> : reasons.length ? <div className="theme-publication-gates">
        <strong>Publication v2 henüz canlı yayına hazır değil.</strong>
        {reasons.map((reason) => <p key={reason}>{reason}</p>)}
      </div> : <div className="theme-publication-gates ready">
        <strong>05 ve 06 kapıları tamam.</strong>
        <p>Canlı yayın önce içerik-hash'li asset'leri yükler, ardından publication.json dosyasını atomik olarak etkinleştirir.</p>
      </div>}

      <div className="publish-actions">
        <span className={error ? "publish-inline-status error" : "publish-inline-status"} aria-live="polite">{publishStatus}</span>
        <button className="secondary-button" disabled={livePublishing || localBuilding} onClick={() => void buildLocal()}>
          {localBuilding ? "Oluşturuluyor…" : "Yerel paketi oluştur"}
        </button>
        <button className="primary-button" disabled={!project?.deploymentEnabled || !selectedReady || !communityConnected || livePublishing || localBuilding} onClick={() => void publishLive()}>
          {livePublishing ? "Yayınlanıyor…" : "Kitap Web'i canlıya yayınla"}
        </button>
      </div>

      {!project?.deploymentEnabled && <p className="publish-deployment-help">
        Önce web uygulaması hosting üzerinde kurulmalı. Ardından <strong>Ayarlar → Kanal ve yayın → Web yayını</strong> bölümündeki <strong>Test</strong> kontrolü başarılı olunca canlı yayını etkinleştirip kaydet. Yayınlanacak içerik hazır, yalnız sunucu bağlantısı bekleniyor.
      </p>}
      <div className={communityConnected ? "live-readiness ready" : "live-readiness"}>
        <span className="local-dot"/>
        {!project?.deploymentEnabled ? "Yerel tasarım · canlı yayın işlemi devre dışı" : communityConnected ? "Studio yönetici bağlantısı hazır" : "Yayın için Topluluk yönetici bağlantısı gerekli"}
      </div>
    </section>

    <section className="panel last-export-panel">
      <div className="publish-panel-head">
        <div><small>SON YEREL PUBLICATION</small><h3>{publicationInfo ? formatExportDate(publicationInfo.generatedAt) : "Henüz yerel paket bulunamadı"}</h3></div>
        {publicationInfo && <button className="secondary-button" onClick={() => void revealPackage()}>Klasörde göster</button>}
      </div>
      {publicationInfo ? <>
        <div className="last-export-stats">
          <span><small>Anlatı</small><strong>{publicationInfo.sectionCount}</strong></span>
          <span><small>Arşiv</small><strong>{publicationInfo.entityCount}</strong></span>
          <span><small>Bağlantı</small><strong>{publicationInfo.relationCount}</strong></span>
          <span><small>Asset</small><strong>{publicationInfo.assetCount}</strong></span>
          <span><small>Vefk</small><strong>{publicationInfo.vefkCount}</strong></span>
        </div>
        <p className="export-path">{publicationInfo.file}</p>
        {publicationInfo.publicationId && <code>{publicationInfo.publicationId} · {publicationInfo.contentFingerprint.slice(0, 20)}…</code>}
      </> : <p>İlk paket oluşturulduğunda publication ID, fingerprint ve dosya yolu burada tutulacak.</p>}

      {livePublication && <div className="live-proof">
        <div><span className="local-dot"/><strong>Canlı publication v2 doğrulandı</strong><small>{formatExportDate(livePublication.generatedAt)}</small></div>
        <div><span>{livePublication.sectionCount} bölüm</span><span>{livePublication.entityCount} entity</span><span>{livePublication.assetCount} asset</span><span>{publicationInfo?.vefkCount ?? 0} vefk</span><span>{Math.max(1, Math.round(livePublication.bytes / 1024))} KB</span></div>
        <p>{livePublication.publicUrl}</p>
        <code>{livePublication.contentFingerprint.slice(0, 20)}…</code>
      </div>}

      {preview?.baseline && <div className="automation-note">
        <span>CANLI BASELINE</span>
        <p>{preview.changed ? "Yerel approved içerik canlı publication'dan farklı." : "Yerel approved içerik canlı publication ile aynı fingerprint'e sahip."}</p>
      </div>}
    </section>
    </>}
  </section>;
}
