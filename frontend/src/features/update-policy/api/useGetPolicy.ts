import { useGetPolicy as useGeneratedGetPolicy } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { policyQueryKeys, requireApiData } from "@/shared/api";
import type { PolicyDefinitionResponse } from "@/shared/api/generated/zod";

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
  return useGeneratedGetPolicy<PolicyDefinitionResponse>(workspaceId, packId, versionId, policyId, {
    query: {
      queryKey: policyQueryKeys.detail(workspaceId, packId, versionId, policyId),
      select: (response) =>
        requireApiData<PolicyDefinitionResponse>(response, "Policy 상세 응답을 확인할 수 없습니다."),
      enabled,
    },
  });
}
