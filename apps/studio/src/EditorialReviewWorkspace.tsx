import { useEffect, useState } from "react";
import AiEditorialReview from "./AiEditorialReview";
import RevisionReviewPane from "./RevisionReviewPane";
import "./revision-review.css";
import "./review-reading.css";

type ReviewMode = "records" | "revisions";
type WorkspaceCountsWithRevisions = StudioUniverseWorkspaceStatus["counts"] & { pendingRevisions?: number };
type EditorialReviewBridge = {
  universeWorkspaceStatus(): Promise<StudioUniverseWorkspaceStatus>;
  onDataChanged?(callback: () => void): () => void;
};

function number(value: number) { return new Intl.NumberFormat("tr-TR").format(Math.max(0, value)); }

export default function EditorialReviewWorkspace({ initialMode = "records" }: { initialMode?: ReviewMode; onReadyForUniverse?: () => void }) {
  const bridge = window.channelFoundryStudio as unknown as EditorialReviewBridge | undefined;
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [counts, setCounts] = useState<WorkspaceCountsWithRevisions | null>(null);

  const load = async () => {
    if (!bridge) return;
    const status = await bridge.universeWorkspaceStatus();
    setCounts(status.counts as WorkspaceCountsWithRevisions);
  };

  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => {
    void load().catch(() => undefined);
    return bridge?.onDataChanged?.(() => { void load().catch(() => undefined); });
  }, []);

  const draftCount = counts?.draft ?? 0;
  const revisionCount = counts?.pendingRevisions ?? 0;
  return <div className="editorial-review-workspace">
    <header className="review-mode-header panel">
      <div>
        <small>04 · İNCELEME</small>
        <strong>Editoryal karar alanı</strong>
      </div>
      <span className={`review-header-status${revisionCount ? " needs-review" : " ready"}`} role="status">
        {revisionCount ? `${number(revisionCount)} revizyon kararı bekliyor` : "Bekleyen revizyon yok"}
      </span>
      <nav aria-label="İnceleme türü">
        <button className={mode === "records" ? "active" : ""} onClick={() => setMode("records")}>
          <span>Yeni Kayıtlar</span><b>{number(draftCount)}</b>
        </button>
        <button className={mode === "revisions" ? "active" : ""} onClick={() => setMode("revisions")}>
          <span>Revizyonlar</span><b>{number(revisionCount)}</b>
        </button>
      </nav>
    </header>

    {mode === "records" ? <AiEditorialReview/> : <RevisionReviewPane/>}
  </div>;
}
