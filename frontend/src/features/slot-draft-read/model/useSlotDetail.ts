import { useEffect, useRef } from "react";
import { useGetSlot } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
import { requireApiData, slotQueryKeys } from "@/shared/api";
import { mapApiError } from "./mapApiError";
import type { SlotDefinitionResponse } from "@/shared/api/generated/zod";

export type SlotDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: SlotDefinitionResponse };

export function useSlotDetail(
  wsId: number,
  packId: number,
  versionId: number,
  slotId: number | null,
  retryKey = 0,
): SlotDetailState {
  const safeSlotId = slotId ?? -1;
  const query = useGetSlot<SlotDefinitionResponse>(wsId, packId, versionId, safeSlotId, {
    query: {
      enabled: slotId !== null,
      queryKey: slotQueryKeys.detail(wsId, packId, versionId, safeSlotId),
      select: (response) =>
        requireApiData<SlotDefinitionResponse>(response, "Slot 상세 응답을 확인할 수 없습니다."),
    },
  });

  const { refetch } = query;
  const handledRetryKeyRef = useRef(0);

  useEffect(() => {
    if (slotId === null || retryKey === 0 || retryKey === handledRetryKeyRef.current) {
      return;
    }

    handledRetryKeyRef.current = retryKey;
    refetch().catch(() => undefined);
  }, [refetch, retryKey, slotId]);

  if (slotId === null) {
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
