import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { listSlots } from "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller";
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
  const query = useQuery({
    queryKey: ["slots", "list", wsId, packId, versionId],
    queryFn: async () => {
      const res = (await listSlots(wsId, packId, versionId)) as
        | { data?: SlotDefinitionSummary[] }
        | SlotDefinitionSummary[];
      if (Array.isArray(res)) return res;
      return res?.data ?? [];
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
