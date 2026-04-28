import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { riskApi, riskKeys } from "@/entities/risk";
import { mapApiError } from "./mapApiError";
import type { RiskDefinition } from "@/entities/risk";

export type RiskDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: RiskDefinition };

export function useRiskDetail(
  workspaceId: number,
  packId: number,
  versionId: number,
  riskId: number | null,
  retryKey = 0,
): RiskDetailState {
  const queryKey =
    riskId === null
      ? ([...riskKeys.all, "detail", workspaceId, packId, versionId, "idle"] as const)
      : riskKeys.detail(workspaceId, packId, versionId, riskId);

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (riskId === null) {
        throw new Error("riskId is required");
      }
      return riskApi.detail(workspaceId, packId, versionId, riskId);
    },
    enabled: riskId !== null,
  });

  const { refetch } = query;
  const handledRetryKeyRef = useRef(0);

  useEffect(() => {
    if (riskId === null || retryKey === 0 || retryKey === handledRetryKeyRef.current) {
      return;
    }

    handledRetryKeyRef.current = retryKey;
    refetch().catch(() => undefined);
  }, [riskId, refetch, retryKey]);

  if (riskId === null) {
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

  return { status: "ready", data: query.data };
}
