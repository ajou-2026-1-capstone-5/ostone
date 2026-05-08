import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSlot } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
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
  const query = useQuery({
    queryKey: ["slots", "detail", wsId, packId, versionId, slotId],
    queryFn: async () => {
      if (slotId === null) {
        throw new Error("slotId is required");
      }
      const res = await getSlot(wsId, packId, versionId, slotId);
      return res.data;
    },
    enabled: slotId !== null,
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
