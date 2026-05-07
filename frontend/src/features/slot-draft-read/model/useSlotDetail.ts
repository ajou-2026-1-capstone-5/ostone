import { useEffect, useState } from "react";
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
  const requestKey =
    slotId === null ? null : `${wsId}:${packId}:${versionId}:${slotId}:${retryKey}`;
  const [state, setState] = useState<{
    requestKey: string | null;
    value: SlotDetailState;
  }>({
    requestKey: null,
    value: { status: "idle" },
  });

  useEffect(() => {
    if (slotId === null) {
      return;
    }

    let cancelled = false;

    getSlot(wsId, packId, versionId, slotId)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  if (requestKey === null) {
    return { status: "idle" };
  }

  return state.requestKey === requestKey ? state.value : { status: "loading" };
}
