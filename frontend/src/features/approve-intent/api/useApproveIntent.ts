import { toast } from "sonner";
import { useUpdateIntentStatus } from "@/shared/api/generated/endpoints/update-intent-status-controller/update-intent-status-controller";
import { ApiRequestError } from "@/shared/api";
import type { IntentApprovalStatus } from "../model/types";

export interface UseApproveIntentProps {
  wsId: number;
  packId: number;
  versionId: number;
  intentId: number;
  onStatusChanged?: (status: IntentApprovalStatus) => void;
}

const INTENT_ERROR_MESSAGES = {
  INTENT_NOT_EDITABLE: "편집할 수 없는 상태의 상담 유형입니다.",
} as const;

export function useApproveIntent({
  wsId,
  packId,
  versionId,
  intentId,
  onStatusChanged,
}: UseApproveIntentProps) {
  const mutation = useUpdateIntentStatus();

  const mutate = (status: IntentApprovalStatus) => {
    mutation.mutate(
      { workspaceId: wsId, packId, versionId, intentId, data: { status } },
      {
        onSuccess: () => {
          onStatusChanged?.(status);
          toast.success("상담 유형 상태가 변경되었습니다.");
        },
        onError: (error) => {
          if (error instanceof ApiRequestError) {
            if (error.code === "INTENT_NOT_EDITABLE") {
              toast.error(INTENT_ERROR_MESSAGES.INTENT_NOT_EDITABLE);
              return;
            }
          }
          toast.error("상담 유형 상태 변경에 실패했습니다.");
        },
      },
    );
  };

  const mutateAsync = (status: IntentApprovalStatus) =>
    mutation.mutateAsync({
      workspaceId: wsId,
      packId,
      versionId,
      intentId,
      data: { status },
    });

  return {
    mutate,
    mutateAsync,
    isPending: mutation.isPending,
  };
}
