import { useEffect } from "react";
import { useListPolicies } from "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller";
import { mapApiError } from "./mapApiError";
import type { PolicySummary } from "@/entities/policy";

export type PolicyListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: PolicySummary[] };

export function usePolicyList(
  workspaceId: number,
  packId: number,
  versionId: number,
  retryKey = 0,
): PolicyListState {
  const query = useListPolicies(workspaceId, packId, versionId, {});

  const { refetch } = query;

  useEffect(() => {
    if (retryKey > 0) {
      refetch().catch(() => undefined);
    }
  }, [refetch, retryKey]);

  if (query.isLoading) {
    return { status: "loading" };
  }

  if (query.isError) {
    return mapApiError(query.error);
  }

  return { status: "ready", data: (query.data?.data ?? []) as unknown as PolicySummary[] };
}