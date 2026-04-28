import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { riskApi, riskKeys } from "@/entities/risk";
import type { RiskDefinition, RiskStatus, RiskSummary } from "@/entities/risk";
import { ApiRequestError } from "@/shared/api";
import { RISK_ERROR_MESSAGES } from "./messages";

interface UpdateRiskStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  status: RiskStatus;
}

export const UPDATE_RISK_STATUS_MUTATION_KEY = ["updateRiskStatus"] as const;

export function useUpdateRiskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: UPDATE_RISK_STATUS_MUTATION_KEY,
    mutationFn: ({ workspaceId, packId, versionId, riskId, status }: UpdateRiskStatusParams) =>
      riskApi.updateStatus(workspaceId, packId, versionId, riskId, { status }),
    onMutate: async ({ workspaceId, packId, versionId, riskId, status }) => {
      const detailKey = riskKeys.detail(workspaceId, packId, versionId, riskId);
      const listKey = riskKeys.list(workspaceId, packId, versionId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<RiskDefinition>(detailKey);
      const previousList = queryClient.getQueryData<RiskSummary[]>(listKey);

      queryClient.setQueryData<RiskDefinition>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<RiskSummary[]>(listKey, (old) =>
        old?.map((item) => (item.id === riskId ? { ...item, status } : item)),
      );

      return { previousDetail, previousList, detailKey, listKey };
    },
    onError: (error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.detailKey, context.previousDetail);
        queryClient.setQueryData(context.listKey, context.previousList);
      }

      if (error instanceof ApiRequestError && error.code === "RISK_NOT_EDITABLE") {
        toast.error(RISK_ERROR_MESSAGES.RISK_NOT_EDITABLE);
        return;
      }

      toast.error(RISK_ERROR_MESSAGES.STATUS_FAILED);
    },
    onSuccess: (updatedRisk, { workspaceId, packId, versionId, riskId }) => {
      queryClient.setQueryData(riskKeys.detail(workspaceId, packId, versionId, riskId), updatedRisk);
      queryClient.setQueryData<RiskSummary[]>(
        riskKeys.list(workspaceId, packId, versionId),
        (old) =>
          old?.map((item) =>
            item.id === riskId
              ? {
                  ...item,
                  status: updatedRisk.status,
                  updatedAt: updatedRisk.updatedAt,
                }
              : item,
          ),
      );
    },
  });
}
