import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateRiskStatus } from "@/shared/api/generated/endpoints/update-risk-status-controller/update-risk-status-controller";
import type {
  RiskDefinitionResponse,
  RiskDefinitionSummary,
  UpdateRiskStatusRequest,
} from "@/shared/api/generated/zod";
import { ApiRequestError } from "@/shared/api";
import { RISK_ERROR_MESSAGES } from "./messages";

interface UpdateRiskStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  status: UpdateRiskStatusRequest["status"];
}

export const UPDATE_RISK_STATUS_MUTATION_KEY = ["updateRiskStatus"] as const;

export function useUpdateRiskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: UPDATE_RISK_STATUS_MUTATION_KEY,
    mutationFn: async ({ workspaceId, packId, versionId, riskId, status }: UpdateRiskStatusParams) => {
      const res = await updateRiskStatus(workspaceId, packId, versionId, riskId, { status });
      return res.data;
    },
    onMutate: async ({ workspaceId, packId, versionId, riskId, status }) => {
      const detailKey = ["risks", "detail", workspaceId, packId, versionId, riskId] as const;
      const listKey = ["risks", "list", workspaceId, packId, versionId] as const;

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<RiskDefinitionResponse>(detailKey);
      const previousList = queryClient.getQueryData<RiskDefinitionSummary[]>(listKey);

      queryClient.setQueryData<RiskDefinitionResponse>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<RiskDefinitionSummary[]>(listKey, (old) =>
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
      queryClient.setQueryData(["risks", "detail", workspaceId, packId, versionId, riskId] as const, updatedRisk);
      queryClient.setQueryData<RiskDefinitionSummary[]>(
        ["risks", "list", workspaceId, packId, versionId] as const,
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
