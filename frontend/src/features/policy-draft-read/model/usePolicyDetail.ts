import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { policyKeys } from "@/entities/policy";
import { useGetPolicy, useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { mapApiError } from "./mapApiError";
import type { PolicyDefinition, PolicySummary } from "@/entities/policy";

export type PolicyDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: PolicyDefinition };

export function usePolicyDetail(
  workspaceId: number,
  packId: number,
  versionId: number,
  policyId: number | null,
  retryKey = 0,
): PolicyDetailState {
  const policyQueryKey =
    policyId === null
      ? [...policyKeys.all, "detail", workspaceId, packId, versionId, "idle"] as const
      : policyKeys.detail(workspaceId, packId, versionId, policyId);

  const query = useGetPolicy(workspaceId, packId, versionId, policyId ?? -1, {
    query: { enabled: policyId !== null },
  });

  const { refetch } = query;

  useEffect(() => {
    if (policyId !== null && retryKey > 0) {
      refetch().catch(() => undefined);
    }
  }, [policyId, refetch, retryKey]);

  if (policyId === null) {
    return { status: "idle" };
  }

  if (query.isLoading || (query.isFetching && !query.data)) {
    return { status: "loading" };
  }

  if (query.isError) {
    return mapApiError(query.error);
  }

  if (!query.data) {
    return { status: "loading" };
  }

  return { status: "ready", data: query.data.data as unknown as PolicyDefinition };
}