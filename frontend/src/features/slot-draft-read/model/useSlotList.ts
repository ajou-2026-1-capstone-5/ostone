import { useEffect, useRef } from "react";
import { useListSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import { selectApiList, slotQueryKeys } from "@/shared/api";
import { mapApiError } from "./mapApiError";
import type { SlotDefinitionSummary } from "@/shared/api/generated/zod";

export type SlotListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: SlotDefinitionSummary[] };

export function useSlotList(
  wsId: number,
  packId: number,
  versionId: number,
  retryKey = 0,
): SlotListState {
  const query = useListSlots<SlotDefinitionSummary[]>(wsId, packId, versionId, {
    query: {
      queryKey: slotQueryKeys.list(wsId, packId, versionId),
      select: selectApiList<SlotDefinitionSummary>,
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

  return { status: "ready", data: query.data ?? [] };
}
