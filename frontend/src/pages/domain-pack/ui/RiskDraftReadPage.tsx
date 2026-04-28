import { useNavigate, useParams } from "react-router-dom";
import { RiskDetailPanel, RiskListPanel } from "@/features/risk-draft-read/ui";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import styles from "./risk-draft-read-page.module.css";

export function RiskDraftReadPage() {
  const { workspaceId, packId, versionId, riskId } = useParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const selectedRiskId = riskId ? parseRouteId(riskId) : null;
  const hasInvalidRiskId = riskId !== undefined && selectedRiskId === null;

  if (wsId === null || pId === null || vId === null || hasInvalidRiskId) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DashboardLayout>
    );
  }

  const handleSelect = (id: number) => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/risks/${id}`);
  };

  const handleBack = () => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/risks`);
  };

  const hasSelection = selectedRiskId !== null;

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
            <span className={styles.versionTitle}>Risk Factor 초안 조회</span>
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
            <RiskListPanel
              workspaceId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={selectedRiskId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            <RiskDetailPanel
              workspaceId={wsId}
              packId={pId}
              versionId={vId}
              riskId={selectedRiskId}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
