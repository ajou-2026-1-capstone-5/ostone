import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IntentDetailPanel, IntentTreePanel } from "../../../features/intent-draft-read/ui";
import {
  useApproveIntent,
  type IntentApprovalStatus,
  type IntentApprovalAction,
  ApproveIntentDialog,
  IntentStatusControl,
} from "../../../features/approve-intent";
import { parseRouteId } from "../../../shared/lib/parseRouteId";
import { DashboardLayout } from "../../../shared/ui/layout/DashboardLayout";
import styles from "./intent-draft-read-page.module.css";

function IntentDetailWithApproval({
  wsId,
  pId,
  vId,
  iId,
}: {
  wsId: number;
  pId: number;
  vId: number;
  iId: number;
}) {
  const [dialogAction, setDialogAction] = useState<IntentApprovalAction | null>(null);
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  useEffect(() => {
    setDialogAction(null);
    setStatusOverride(null);
    setDetailRefreshKey(0);
  }, [iId]);

  const mutation = useApproveIntent({
    wsId,
    packId: pId,
    versionId: vId,
    intentId: iId,
    onStatusChanged: (status) => {
      setStatusOverride(status);
      setDialogAction(null);
      setDetailRefreshKey((k) => k + 1);
    },
  });

  const handleDialogOpenChange = (next: boolean) => {
    if (!mutation.isPending) setDialogAction(next ? dialogAction : null);
  };

  const handleConfirm = () => {
    if (dialogAction === null) return;
    const status: IntentApprovalStatus =
      dialogAction === "publish" ? "PUBLISHED" : "REJECTED";
    mutation.mutate(status);
  };

  return (
    <IntentDetailPanel
      wsId={wsId}
      packId={pId}
      versionId={vId}
      intentId={iId}
      refreshKey={detailRefreshKey}
    >
      {(detail) => (
        <>
          <IntentStatusControl
            intentStatus={(statusOverride ?? detail.status) as "DRAFT" | IntentApprovalStatus}
            onPublish={() => setDialogAction("publish")}
            onReject={() => setDialogAction("reject")}
            isPending={mutation.isPending}
          />
          <ApproveIntentDialog
            intentName={detail.name}
            action={dialogAction ?? "publish"}
            open={dialogAction !== null}
            onOpenChange={handleDialogOpenChange}
            onConfirm={handleConfirm}
            isLoading={mutation.isPending}
          />
        </>
      )}
    </IntentDetailPanel>
  );
}

export function IntentDraftReadPage() {
  const { workspaceId, packId, versionId, intentId } = useParams();
  const navigate = useNavigate();

  const wsId = parseRouteId(workspaceId);
  const pId = parseRouteId(packId);
  const vId = parseRouteId(versionId);
  const iId = intentId ? parseRouteId(intentId) : null;

  if (wsId === null || pId === null || vId === null || (intentId !== undefined && iId === null)) {
    return (
      <DashboardLayout>
        <div className={styles.invalidParams} role="alert">
          잘못된 URL 파라미터입니다.
        </div>
      </DashboardLayout>
    );
  }

  const handleSelect = (id: number) => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/intents/${id}`);
  };

  const handleBack = () => {
    navigate(`/workspaces/${wsId}/domain-packs/${pId}/versions/${vId}/intents`);
  };

  const hasSelection = iId !== null;

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
            <span className={styles.versionTitle}>Intent 초안 조회</span>
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
            <IntentTreePanel
              wsId={wsId}
              packId={pId}
              versionId={vId}
              selectedId={iId}
              onSelect={handleSelect}
            />
          </div>
          <div className={styles.detailSlot}>
            {iId !== null ? (
              <IntentDetailWithApproval wsId={wsId} pId={pId} vId={vId} iId={iId} />
            ) : (
              <IntentDetailPanel wsId={wsId} packId={pId} versionId={vId} intentId={null} />
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
