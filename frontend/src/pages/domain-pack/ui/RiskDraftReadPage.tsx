import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiskDetailPanel, RiskListPanel } from "@/features/risk-draft-read/ui";
import { RiskEditPanel } from "@/features/update-risk";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { OstoneShell } from "@/widgets/ostone-shell";
import styles from "./risk-draft-read-page.module.css";

interface EditingRiskState {
  routeKey: string;
  riskId: number;
}

export function RiskDraftReadPage() {
  const { workspaceId, packId, versionId, riskId } = useParams();
  const navigate = useNavigate();
  const [editingRisk, setEditingRisk] = useState<EditingRiskState | null>(null);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const selectedRiskId = riskId ? parseRouteId(riskId) : null;
  const hasInvalidRiskId = riskId !== undefined && selectedRiskId === null;
  const routeKey = `${wsId}:${pId}:${vId}:${selectedRiskId}`;

  if (wsId === null || pId === null || vId === null || hasInvalidRiskId) {
    return (
      <OstoneShell active="domain" crumbs={["Domain Packs"]}>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </OstoneShell>
    );
  }

  const riskListPath = `/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/risks`;
  const hasSelection = selectedRiskId !== null;
  const activeEditingRiskId =
    editingRisk?.routeKey === routeKey && editingRisk.riskId === selectedRiskId
      ? editingRisk.riskId
      : null;

  return (
    <OstoneShell
      active="domain"
      crumbs={[`WS · ${wsId}`, `PACK · ${pId}`, `VER · ${vId}`]}
    >
      <div className={styles.pageWrapper}>
        <header className={styles.pageHeader}>
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
              setEditingRisk(null);
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
                setEditingRisk(null);
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
                onEdit={(id) => setEditingRisk({ routeKey, riskId: id })}
              />
            ) : (
              <RiskEditPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                riskId={activeEditingRiskId}
                onClose={() => setEditingRisk(null)}
              />
            )}
          </div>
        </div>
      </div>
    </OstoneShell>
  );
}
