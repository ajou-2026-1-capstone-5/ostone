import { useEffect, useState } from "react";
import { slotApi } from "@/entities/slot";
import { mapApiError } from "./mapApiError";
import type { SlotDefinition } from "@/entities/slot";

export type SlotDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: SlotDefinition };

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

    slotApi
      .detail(wsId, packId, versionId, slotId)
      .then((data) => {
        if (!cancelled) {
          setState({
            requestKey,
            value: { status: "ready", data },
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
  }, [slotId, packId, requestKey, retryKey, versionId, wsId]);

  if (requestKey === null) {
    return { status: "idle" };
  }

  return state.requestKey === requestKey ? state.value : { status: "loading" };
}
