import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRisk } from "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller";
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
  const query = useQuery({
    queryKey: ["risk", "detail", workspaceId, packId, versionId, riskId],
    queryFn: async () => {
      if (riskId === null) {
        throw new Error("riskId is required");
      }
      const res = (await getRisk(workspaceId, packId, versionId, riskId)) as
        | { data?: RiskDefinitionResponse }
        | RiskDefinitionResponse;
      const candidate = (res as { data?: RiskDefinitionResponse }).data;
      return candidate ?? (res as RiskDefinitionResponse);
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
