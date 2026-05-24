import { useState, type ReactNode } from "react";
import type { IntentDetail } from "@/entities/intent";
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
  override: IntentApprovalStatus | null,
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
  refreshKey,
  afterHeader,
  beforeJsonCards,
  nonDraftHeaderActions,
  children,
}: {
  wsId: number;
  pId: number;
  vId: number;
  iId: number;
  refreshKey?: number;
  afterHeader?: (detail: IntentDetail) => ReactNode;
  beforeJsonCards?: (detail: IntentDetail) => ReactNode;
  nonDraftHeaderActions?: (detail: IntentDetail) => ReactNode;
  children?: (detail: IntentDetail) => ReactNode;
}) {
  const [approvalState, setApprovalState] = useState(() => createApprovalState(iId));
  const currentState =
    approvalState.intentId === iId ? approvalState : createApprovalState(iId);

  const mutation = useApproveIntent({
    wsId,
    packId: pId,
    versionId: vId,
    intentId: iId,
    onStatusChanged: (status) => {
      setApprovalState((prev) => {
        const base = prev.intentId === iId ? prev : createApprovalState(iId);
        return {
          ...base,
          dialogAction: null,
          statusOverride: status,
          detailRefreshKey: base.detailRefreshKey + 1,
        };
      });
    },
  });

  const handleDialogOpenChange = (next: boolean) => {
    if (mutation.isPending) return;
    setApprovalState((prev) => {
      const base = prev.intentId === iId ? prev : createApprovalState(iId);
      return { ...base, dialogAction: next ? base.dialogAction : null };
    });
  };

  const handleConfirm = () => {
    if (currentState.dialogAction === null) return;
    const status: IntentApprovalStatus =
      currentState.dialogAction === "publish" ? "PUBLISHED" : "REJECTED";
    mutation.mutate(status);
  };
  const openDialog = (action: IntentApprovalAction) => {
    setApprovalState((prev) => {
      const base = prev.intentId === iId ? prev : createApprovalState(iId);
      return { ...base, dialogAction: action };
    });
  };
  const combinedRefreshKey = (refreshKey ?? 0) * 1000 + currentState.detailRefreshKey;

  return (
    <IntentDetailPanel
      wsId={wsId}
      packId={pId}
      versionId={vId}
      intentId={iId}
      refreshKey={combinedRefreshKey}
      headerActions={(detail) => {
        const intentStatus = normalizeIntentStatus(detail.status ?? "DRAFT", currentState.statusOverride);
        if (intentStatus !== "DRAFT") {
          return nonDraftHeaderActions?.(detail);
        }
        return (
          <IntentStatusControl
            intentStatus={intentStatus}
            onPublish={() => openDialog("publish")}
            onReject={() => openDialog("reject")}
            isPending={mutation.isPending}
          />
        );
      }}
      afterHeader={afterHeader}
      beforeJsonCards={beforeJsonCards}
    >
      {(detail) => (
        <>
          <ApproveIntentDialog
            intentName={detail.name ?? ""}
            action={currentState.dialogAction ?? "publish"}
            open={currentState.dialogAction !== null}
            onOpenChange={handleDialogOpenChange}
            onConfirm={handleConfirm}
            isLoading={mutation.isPending}
          />
          {children?.(detail)}
        </>
      )}
    </IntentDetailPanel>
  );
}

function createApprovalState(intentId: number) {
  return {
    intentId,
    dialogAction: null as IntentApprovalAction | null,
    statusOverride: null as IntentApprovalStatus | null,
    detailRefreshKey: 0,
  };
}
