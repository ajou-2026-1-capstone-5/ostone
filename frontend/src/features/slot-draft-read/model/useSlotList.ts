import { useEffect, useState } from "react";
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
  const requestKey = `${wsId}:${packId}:${versionId}:${retryKey}`;
  const [state, setState] = useState<{
    requestKey: string;
    value: SlotListState;
  }>({
    requestKey,
    value: { status: "loading" },
  });

  useEffect(() => {
    let cancelled = false;

    listSlots(wsId, packId, versionId)
      .then((res) => {
        if (!cancelled) {
          setState({
            requestKey,
            value: { status: "ready", data: res.data },
          });
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            requestKey,
            value: mapApiError(e),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [packId, requestKey, retryKey, versionId, wsId]);

  return state.requestKey === requestKey ? state.value : { status: "loading" };
}
