import { useMemo } from "react";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { policyQueryKeys, selectApiList } from "@/shared/api";
import type { PolicySummary } from "@/entities/policy";
import { buildPolicyNameMap } from "./policyNames";

/**
 * 워크플로우 편집기에서 policyRef를 표시 이름으로 해석하기 위한 policyCode → name 맵을 제공한다.
 * 로딩/오류 시에도 빈 맵을 반환해 편집 화면이 깨지지 않게 한다.
 */
export function usePolicyNameMap(
  wsId: number,
  packId: number,
  versionId: number,
): ReadonlyMap<string, string> {
  const query = useListPolicies<PolicySummary[]>(wsId, packId, versionId, {
    query: {
      queryKey: policyQueryKeys.list(wsId, packId, versionId),
      select: selectApiList<PolicySummary>,
    },
  });

  return useMemo(() => buildPolicyNameMap(query.data ?? []), [query.data]);
}
