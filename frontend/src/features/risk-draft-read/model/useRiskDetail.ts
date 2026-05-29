import { useEffect, useRef } from "react";
import { useGetRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
import { requireApiData, riskQueryKeys } from "@/shared/api";
import { mapApiError } from "./mapApiError";
import type { RiskDefinitionResponse } from "@/shared/api/generated/zod";

export type RiskDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: RiskDefinitionResponse };

export function useRiskDetail(
  workspaceId: number,
  packId: number,
  versionId: number,
  riskId: number | null,
  retryKey = 0,
): RiskDetailState {
  const safeRiskId = riskId ?? -1;
  const query = useGetRisk<RiskDefinitionResponse>(workspaceId, packId, versionId, safeRiskId, {
    query: {
      enabled: riskId !== null,
      queryKey: riskQueryKeys.detail(workspaceId, packId, versionId, safeRiskId),
      select: (response) =>
        requireApiData<RiskDefinitionResponse>(response, "Risk 상세 응답을 확인할 수 없습니다."),
    },
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
