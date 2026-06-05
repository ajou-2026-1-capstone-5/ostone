import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateRisk } from "@/shared/api/generated/endpoints/update-risk-controller/update-risk-controller";
import type {
  RiskDefinitionResponse,
  RiskDefinitionSummary,
  UpdateRiskRequest,
} from "@/shared/api/generated/zod";
import { ApiRequestError, requireApiData, riskQueryKeys } from "@/shared/api";
import { RISK_ERROR_MESSAGES } from "./messages";

interface UpdateRiskParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  body: UpdateRiskRequest;
}

type RiskListCache =
  | RiskDefinitionSummary[]
  | ({ data?: RiskDefinitionSummary[] } & Record<string, unknown>);

export function useUpdateRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, packId, versionId, riskId, body }: UpdateRiskParams) => {
      const res = await updateRisk(workspaceId, packId, versionId, riskId, body);
      return requireApiData<RiskDefinitionResponse>(
        res,
        "주의 사항 수정 응답을 확인할 수 없습니다.",
      );
    },
    onSuccess: (updatedRisk, { workspaceId, packId, versionId, riskId }) => {
      queryClient.setQueryData(
        riskQueryKeys.detail(workspaceId, packId, versionId, riskId),
        updatedRisk,
      );
      queryClient.setQueryData<RiskListCache>(
        riskQueryKeys.list(workspaceId, packId, versionId),
        (old) => updateRiskListCache(old, riskId, updatedRisk),
      );
      toast.success("주의 사항이 수정되었습니다.");
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

function updateRiskListCache<T extends RiskListCache | undefined>(
  old: T,
  riskId: number,
  updatedRisk: RiskDefinitionSummary,
): T {
  const updateItem = (item: RiskDefinitionSummary): RiskDefinitionSummary =>
    item.id === riskId
      ? {
          ...item,
          name: updatedRisk.name,
          description: updatedRisk.description,
          riskLevel: updatedRisk.riskLevel,
          status: updatedRisk.status,
          updatedAt: updatedRisk.updatedAt,
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
