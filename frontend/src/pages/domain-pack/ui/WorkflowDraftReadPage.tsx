import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "../../../shared/ui/layout/DashboardLayout";
import { WorkflowDetailPanel, WorkflowListPanel } from "../../../features/workflow-draft-read/ui";
import { WorkflowEditSheet } from "../../../features/update-workflow";
import { parseRouteId } from "../../../shared/lib/parseRouteId";
import styles from "./workflow-draft-read-page.module.css";

export function WorkflowDraftReadPage() {
  const { workspaceId, packId, versionId, workflowId } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const wfId = workflowId ? parseRouteId(workflowId) : null;

  if (wsId === null || pId === null || vId === null || (workflowId !== undefined && wfId === null)) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DashboardLayout>
    );
  }

  const handleSelect = (id: number) => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/workflows/${id}`);
  };

  const handleBack = () => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/workflows`);
  };

  const hasSelection = wfId !== null;

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
            <span className={styles.versionTitle}>Workflow 초안 조회</span>
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
            <WorkflowListPanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={wfId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            <WorkflowDetailPanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              workflowId={wfId}
              onEdit={() => setEditOpen(true)}
            />
          </div>
        </div>
      </div>
      {wfId !== null && (
        <WorkflowEditSheet
          wsId={wsId}
          packId={pId}
          versionId={vId}
          workflowId={wfId}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}
