import { useEffect, useRef } from "react";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";
import { intentQueryKeys, selectApiList } from "@/shared/api";
import { mapApiError } from "@/entities/intent";
import type { IntentListState, IntentSummary } from "../../../entities/intent";

export function useIntentList(
  wsId: number,
  packId: number,
  versionId: number,
  refreshKey?: number,
): IntentListState {
  const query = useListIntents<IntentSummary[]>(wsId, packId, versionId, {
    query: {
      queryKey: intentQueryKeys.list(wsId, packId, versionId),
      select: selectApiList<IntentSummary>,
    },
  });

  const handledRefreshKeyRef = useRef(refreshKey ?? 0);
  const { refetch } = query;

  useEffect(() => {
    const key = refreshKey ?? 0;
    if (key === 0 || key === handledRefreshKeyRef.current) return;
    handledRefreshKeyRef.current = key;
    refetch().catch(() => undefined);
  }, [refetch, refreshKey]);

  if (query.isLoading) return { status: "loading" };
  if (query.isError) return mapApiError(query.error);
  return { status: "ready", data: query.data ?? [] };
}
