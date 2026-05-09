import { useQuery } from "@tanstack/react-query";
import { getPolicy } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";

export interface UseGetPolicyParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  policyId: number;
  enabled: boolean;
}

export function useGetPolicy({
  workspaceId,
  packId,
  versionId,
  policyId,
  enabled,
}: UseGetPolicyParams) {
  return useQuery({
    queryKey: ["policies", "detail", workspaceId, packId, versionId, policyId] as const,
    queryFn: async () => {
      const res = await getPolicy(workspaceId, packId, versionId, policyId);
      return res.data;
    },
    enabled,
  });
}
