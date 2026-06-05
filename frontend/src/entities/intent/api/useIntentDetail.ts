import { useEffect, useRef } from "react";
import { useGetIntent } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { intentQueryKeys, requireApiData } from "@/shared/api";
import { mapApiError } from "../lib/mapApiError";
import type { IntentDetail } from "../model/types";

export type IntentDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: IntentDetail };

export function useIntentDetail(
  wsId: number,
  packId: number,
  versionId: number,
  intentId: number | null,
  refreshKey?: number,
): IntentDetailState {
  const safeIntentId = intentId ?? -1;
  const query = useGetIntent<IntentDetail>(wsId, packId, versionId, safeIntentId, {
    query: {
      enabled: intentId !== null,
      queryKey: intentQueryKeys.detail(wsId, packId, versionId, safeIntentId),
      select: (response) => requireApiData<IntentDetail>(response, "Intent 상세 응답을 확인할 수 없습니다."),
    },
  });

  const handledRefreshKeyRef = useRef(0);
  const { refetch } = query;

  useEffect(() => {
    const key = refreshKey ?? 0;
    if (intentId === null || key === 0 || key === handledRefreshKeyRef.current) return;
    handledRefreshKeyRef.current = key;
    refetch().catch(() => undefined);
  }, [intentId, refetch, refreshKey]);

  if (intentId === null) return { status: "idle" };
  if (query.isLoading || (query.isFetching && !query.data)) return { status: "loading" };
  if (query.isError) return mapApiError(query.error);
  if (!query.data) return { status: "loading" };
  return { status: "ready", data: query.data };
}
