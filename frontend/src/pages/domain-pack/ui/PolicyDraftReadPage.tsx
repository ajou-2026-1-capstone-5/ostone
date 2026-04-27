import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PolicyDetailPanel, PolicyListPanel } from "@/features/policy-draft-read/ui";
import { PolicyEditPanel } from "@/features/update-policy";
import { parseRouteId } from "@/shared/lib/parseRouteId";
import { DashboardLayout } from "@/shared/ui/layout/DashboardLayout";
import styles from "./policy-draft-read-page.module.css";

export function PolicyDraftReadPage() {
  const { workspaceId, packId, versionId, policyId } = useParams();
  const navigate = useNavigate();
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const selectedPolicyId = policyId ? parseRouteId(policyId) : null;
  const hasInvalidPolicyId = policyId !== undefined && selectedPolicyId === null;

  useEffect(() => {
    setEditingPolicyId(null);
  }, [selectedPolicyId]);

  if (wsId === null || pId === null || vId === null || hasInvalidPolicyId) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DashboardLayout>
    );
  }

  const handleSelect = (id: number) => {
    setEditingPolicyId(null);
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/policies/${id}`);
  };

  const handleBack = () => {
    setEditingPolicyId(null);
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/policies`);
  };

  const hasSelection = selectedPolicyId !== null;

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
            <span className={styles.versionTitle}>Policy 초안 편집</span>
            <span className={styles.versionBadge}>READ / EDIT</span>
          </div>
        </header>
        {hasSelection && (
          <button type="button" className={styles.backButton} onClick={handleBack}>
            ← 목록
          </button>
        )}
        <div className={`${styles.twoPane} ${hasSelection ? styles.hasSelection : ""}`}>
          <div className={styles.listSlot}>
            <PolicyListPanel
              workspaceId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={selectedPolicyId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            {editingPolicyId === null ? (
              <PolicyDetailPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                policyId={selectedPolicyId}
                onEdit={setEditingPolicyId}
              />
            ) : (
              <PolicyEditPanel
                workspaceId={wsId}
                packId={pId}
                versionId={vId}
                policyId={editingPolicyId}
                onClose={() => setEditingPolicyId(null)}
              />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
