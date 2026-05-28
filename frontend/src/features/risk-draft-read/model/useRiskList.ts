import { useEffect, useRef } from "react";
import { useListRisks } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { riskQueryKeys, selectApiList } from "@/shared/api";
import { mapApiError } from "./mapApiError";
import type { RiskDefinitionSummary } from "@/shared/api/generated/zod";

export type RiskListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "empty" }
  | { status: "ready"; data: RiskDefinitionSummary[] };

export function useRiskList(
  workspaceId: number,
  packId: number,
  versionId: number,
  retryKey = 0,
): RiskListState {
  const query = useListRisks<RiskDefinitionSummary[]>(workspaceId, packId, versionId, {
    query: {
      queryKey: riskQueryKeys.list(workspaceId, packId, versionId),
      select: selectApiList<RiskDefinitionSummary>,
    },
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
