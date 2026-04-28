import { Fragment, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiskDetailPanel, RiskListPanel } from "@/features/risk-draft-read/ui";
import { RiskEditPanel } from "@/features/update-risk";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import styles from "./risk-draft-read-page.module.css";

export function RiskDraftReadPage() {
  const { workspaceId, packId, versionId, riskId } = useParams();
  const navigate = useNavigate();
  const [editingRiskId, setEditingRiskId] = useState<number | null>(null);

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

  const riskListPath = `/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/risks`;
  const hasSelection = selectedRiskId !== null;
  const activeEditingRiskId = editingRiskId === selectedRiskId ? editingRiskId : null;
  const breadcrumbs = [
    ["WS", wsId],
    ["PACK", pId],
    ["VER", vId],
  ] as const;

  return (
    <DashboardLayout>
      <div className={styles.pageWrapper}>
        <header className={styles.pageHeader}>
          <nav className={styles.breadcrumb} aria-label="경로">
            {breadcrumbs.map(([label, value], index) => (
              <Fragment key={label}>
                <span>
                  {label} · {value}
                </span>
                {index < breadcrumbs.length - 1 && (
                  <span className={styles.breadcrumbSeparator}>/</span>
                )}
              </Fragment>
            ))}
          </nav>
          <div className={styles.versionMeta}>
            <span className={styles.versionTitle}>Risk Factor 초안 편집</span>
            <span className={styles.versionBadge}>READ / EDIT</span>
          </div>
        </header>
        {hasSelection && (
          <button
            type="button"
            className={styles.backButton}
            onClick={() => {
              setEditingRiskId(null);
              navigate(riskListPath);
            }}
          >
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
              onSelect={(id) => {
                setEditingRiskId(null);
                navigate(`${riskListPath}/${id}`);
              }}
            />
          </div>
          <div className={styles.detailSlot}>
            {activeEditingRiskId === null ? (
              <RiskDetailPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                riskId={selectedRiskId}
                onEdit={setEditingRiskId}
              />
            ) : (
              <RiskEditPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                riskId={activeEditingRiskId}
                onClose={() => setEditingRiskId(null)}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
