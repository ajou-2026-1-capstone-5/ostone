import { useGetRisk as useGeneratedGetRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { requireApiData, riskQueryKeys } from "@/shared/api";
import type { RiskDefinitionResponse } from "@/shared/api/generated/zod";

export interface UseGetRiskParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  enabled: boolean;
}

export function useGetRisk({ workspaceId, packId, versionId, riskId, enabled }: UseGetRiskParams) {
  return useGeneratedGetRisk<RiskDefinitionResponse>(workspaceId, packId, versionId, riskId, {
    query: {
      queryKey: riskQueryKeys.detail(workspaceId, packId, versionId, riskId),
      select: (response) =>
        requireApiData<RiskDefinitionResponse>(response, "Risk 상세 응답을 확인할 수 없습니다."),
      enabled,
    },
  });
}
