import { useQuery } from "@tanstack/react-query";
import { riskApi, riskKeys } from "@/entities/risk";

export interface UseGetRiskParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  enabled: boolean;
}

export function useGetRisk({
  workspaceId,
  packId,
  versionId,
  riskId,
  enabled,
}: UseGetRiskParams) {
  return useQuery({
    queryKey: riskKeys.detail(workspaceId, packId, versionId, riskId),
    queryFn: () => riskApi.detail(workspaceId, packId, versionId, riskId),
    enabled,
  });
}
