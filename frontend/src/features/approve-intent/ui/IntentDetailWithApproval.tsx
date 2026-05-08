import { useEffect, useState } from "react";
import { IntentDetailPanel } from "../../intent-draft-read/ui";
import {
  useApproveIntent,
  type IntentApprovalStatus,
  type IntentApprovalAction,
  ApproveIntentDialog,
  IntentStatusControl,
} from "../index";

function normalizeIntentStatus(
  raw: string,
  override: IntentApprovalStatus | null
): "DRAFT" | IntentApprovalStatus {
  const effective = override ?? raw;
  if (effective === "DRAFT" || effective === "PUBLISHED" || effective === "REJECTED") {
    return effective as IntentApprovalStatus;
  }
  return "DRAFT";
}

export function IntentDetailWithApproval({
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
  const [statusOverride, setStatusOverride] = useState<IntentApprovalStatus | null>(null);
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
            intentStatus={normalizeIntentStatus(detail.status ?? "DRAFT", statusOverride)}
            onPublish={() => setDialogAction("publish")}
            onReject={() => setDialogAction("reject")}
            isPending={mutation.isPending}
          />
          <ApproveIntentDialog
            intentName={detail.name ?? ""}
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
