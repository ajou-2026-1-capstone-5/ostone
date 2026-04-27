import { useNavigate, useParams } from "react-router-dom";
import { SlotListPanel, SlotDetailPanel } from "../../../features/slot-draft-read/ui";
import { parseRouteId } from "../../../shared/lib/parseRouteId";
import { DashboardLayout } from "../../../shared/ui/layout/DashboardLayout";
import styles from "./slot-draft-read-page.module.css";

export function SlotDraftReadPage() {
  const { workspaceId, packId, versionId, slotId } = useParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const sId = slotId ? parseRouteId(slotId) : null;

  if (wsId === null || pId === null || vId === null || (slotId !== undefined && sId === null)) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DashboardLayout>
    );
  }

  const handleSelect = (id: number) => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/slots/${id}`);
  };

  const handleBack = () => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/slots`);
  };

  const hasSelection = sId !== null;

  return (
    <DashboardLayout>
      <div className={styles.pageWrapper}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumb} aria-label="경로">
            <span>WS · {wsId}</span>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span>PACK · {pId}</span>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span>VER · {vId}</span>
          </nav>
          <div className={styles.versionMeta}>
            <span className={styles.versionTitle}>Slot 초안 조회</span>
            <span className={styles.versionBadge}>READ ONLY</span>
          </div>
        </header>
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={handleBack}>
            ← 목록
          </button>
        )}
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
            <SlotListPanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={sId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            <SlotDetailPanel wsId={wsId} packId={pId} versionId={vId} slotId={sId} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
