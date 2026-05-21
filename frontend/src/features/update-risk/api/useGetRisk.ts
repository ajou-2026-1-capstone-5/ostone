import { useQuery } from "@tanstack/react-query";
import { getRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";

export interface UseGetRiskParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  riskId: number;
  enabled: boolean;
}

export function useGetRisk({ workspaceId, packId, versionId, riskId, enabled }: UseGetRiskParams) {
  return useQuery({
    queryKey: ["risk", "detail", workspaceId, packId, versionId, riskId] as const,
    queryFn: async () => {
      const res = await getRisk(workspaceId, packId, versionId, riskId);
      return res.data;
    },
    enabled,
  });
}
