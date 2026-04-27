import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { policyApi, policyKeys } from "@/entities/policy";
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
  const query = useQuery({
    queryKey: policyKeys.list(workspaceId, packId, versionId),
    queryFn: () => policyApi.list(workspaceId, packId, versionId),
  });

  const { refetch } = query;

  useEffect(() => {
    if (retryKey > 0) {
      void refetch();
    }
  }, [refetch, retryKey]);

  if (query.isLoading) {
    return { status: "loading" };
  }

  if (query.isError) {
    return mapApiError(query.error);
  }

  return { status: "ready", data: query.data ?? [] };
}
