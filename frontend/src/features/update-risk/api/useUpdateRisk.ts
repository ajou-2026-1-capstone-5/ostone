import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateRisk } from "@/shared/api/generated/endpoints/update-risk-controller/update-risk-controller";
import type { RiskDefinitionSummary, UpdateRiskRequest } from "@/shared/api/generated/zod";
import { ApiRequestError, riskQueryKeys, selectApiData } from "@/shared/api";
import { RISK_ERROR_MESSAGES } from "./messages";

interface UpdateRiskParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  body: UpdateRiskRequest;
}

export function useUpdateRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, packId, versionId, riskId, body }: UpdateRiskParams) => {
      const res = await updateRisk(workspaceId, packId, versionId, riskId, body);
      return selectApiData(res);
    },
    onSuccess: (updatedRisk, { workspaceId, packId, versionId, riskId }) => {
      if (!updatedRisk) return;
      queryClient.setQueryData(
        riskQueryKeys.detail(workspaceId, packId, versionId, riskId),
        updatedRisk,
      );
      queryClient.setQueryData<RiskDefinitionSummary[]>(
        riskQueryKeys.list(workspaceId, packId, versionId),
        (old) =>
          old?.map((item) =>
            item.id === riskId
              ? {
                  ...item,
                  name: updatedRisk.name,
                  description: updatedRisk.description,
                  riskLevel: updatedRisk.riskLevel,
                  status: updatedRisk.status,
                  updatedAt: updatedRisk.updatedAt,
                }
              : item,
          ),
      );
      toast.success("위험요소가 수정되었습니다.");
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError) {
        if (error.code === "RISK_NOT_EDITABLE") {
          toast.error(RISK_ERROR_MESSAGES.RISK_NOT_EDITABLE);
          return;
        }
        if (error.code === "VALIDATION_ERROR") {
          toast.error(RISK_ERROR_MESSAGES.VALIDATION_ERROR);
          return;
        }
      }
      toast.error(RISK_ERROR_MESSAGES.UPDATE_FAILED);
    },
  });
}
