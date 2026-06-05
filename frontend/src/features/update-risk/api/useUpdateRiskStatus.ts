import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateRiskStatus } from "@/shared/api/generated/endpoints/update-risk-status-controller/update-risk-status-controller";
import type {
  RiskDefinitionResponse,
  RiskDefinitionSummary,
  UpdateRiskStatusRequest,
} from "@/shared/api/generated/zod";
import { ApiRequestError, requireApiData, riskQueryKeys } from "@/shared/api";
import { RISK_ERROR_MESSAGES } from "./messages";

interface UpdateRiskStatusParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  status: UpdateRiskStatusRequest["status"];
}

type RiskListCache =
  | RiskDefinitionSummary[]
  | ({ data?: RiskDefinitionSummary[] } & Record<string, unknown>);

type RiskStatusPatch = Pick<RiskDefinitionSummary, "status"> &
  Partial<Pick<RiskDefinitionSummary, "updatedAt">>;

export const UPDATE_RISK_STATUS_MUTATION_KEY = ["updateRiskStatus"] as const;

export function useUpdateRiskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: UPDATE_RISK_STATUS_MUTATION_KEY,
    mutationFn: async ({
      workspaceId,
      packId,
      versionId,
      riskId,
      status,
    }: UpdateRiskStatusParams) => {
      const res = await updateRiskStatus(workspaceId, packId, versionId, riskId, { status });
      return requireApiData<RiskDefinitionResponse>(
        res,
        "주의 사항 상태 변경 응답을 확인할 수 없습니다.",
      );
    },
    onMutate: async ({ workspaceId, packId, versionId, riskId, status }) => {
      const detailKey = riskQueryKeys.detail(workspaceId, packId, versionId, riskId);
      const listKey = riskQueryKeys.list(workspaceId, packId, versionId);

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: listKey });

      const previousDetail = queryClient.getQueryData<RiskDefinitionResponse>(detailKey);
      const previousList = queryClient.getQueryData<RiskListCache>(listKey);

      queryClient.setQueryData<RiskDefinitionResponse>(detailKey, (old) =>
        old ? { ...old, status } : old,
      );
      queryClient.setQueryData<RiskListCache>(listKey, (old) =>
        updateRiskStatusListCache(old, riskId, { status }),
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
      queryClient.setQueryData(
        riskQueryKeys.detail(workspaceId, packId, versionId, riskId),
        updatedRisk,
      );
      queryClient.setQueryData<RiskListCache>(
        riskQueryKeys.list(workspaceId, packId, versionId),
        (old) => updateRiskStatusListCache(old, riskId, updatedRisk),
      );
    },
  });
}

function updateRiskStatusListCache<T extends RiskListCache | undefined>(
  old: T,
  riskId: number,
  patch: RiskStatusPatch,
): T {
  const updateItem = (item: RiskDefinitionSummary): RiskDefinitionSummary =>
    item.id === riskId
      ? {
          ...item,
          status: patch.status,
          updatedAt: patch.updatedAt ?? item.updatedAt,
        }
      : item;

  if (Array.isArray(old)) {
    return old.map(updateItem) as T;
  }

  if (old && typeof old === "object" && Array.isArray(old.data)) {
    return { ...old, data: old.data.map(updateItem) } as T;
  }

  return old;
}
