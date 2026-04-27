import { useQuery } from "@tanstack/react-query";
import { policyApi, policyKeys } from "@/entities/policy";

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
    queryKey: policyKeys.detail(workspaceId, packId, versionId, policyId),
    queryFn: () => policyApi.detail(workspaceId, packId, versionId, policyId),
    enabled,
  });
}
