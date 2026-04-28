import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { riskApi, riskKeys } from "@/entities/risk";
import { mapApiError } from "./mapApiError";
import type { RiskSummary } from "@/entities/risk";

export type RiskListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "empty" }
  | { status: "ready"; data: RiskSummary[] };

export function useRiskList(
  workspaceId: number,
  packId: number,
  versionId: number,
  retryKey = 0,
): RiskListState {
  const query = useQuery({
    queryKey: riskKeys.list(workspaceId, packId, versionId),
    queryFn: () => riskApi.list(workspaceId, packId, versionId),
  });

  const { refetch } = query;
  const handledRetryKeyRef = useRef(0);

  useEffect(() => {
    if (retryKey === 0 || retryKey === handledRetryKeyRef.current) {
      return;
    }

    handledRetryKeyRef.current = retryKey;
    refetch().catch(() => undefined);
  }, [refetch, retryKey]);

  if (query.isLoading) {
    return { status: "loading" };
  }

  if (query.isError) {
    return mapApiError(query.error);
  }

  const data = query.data ?? [];
  if (data.length === 0) {
    return { status: "empty" };
  }
  return { status: "ready", data };
}
