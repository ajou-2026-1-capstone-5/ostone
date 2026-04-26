import { useEffect, useState } from "react";
import { slotApi } from "@/entities/slot";
import { mapApiError } from "./mapApiError";
import type { SlotSummary } from "@/entities/slot";

export type SlotListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: SlotSummary[] };

export function useSlotList(wsId: number, packId: number, versionId: number): SlotListState {
  const requestKey = `${wsId}:${packId}:${versionId}`;
  const [state, setState] = useState<{
    requestKey: string;
    value: SlotListState;
  }>({
    requestKey,
    value: { status: "loading" },
  });

  useEffect(() => {
    let cancelled = false;

    slotApi
      .list(wsId, packId, versionId)
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
  }, [packId, requestKey, versionId, wsId]);

  return state.requestKey === requestKey ? state.value : { status: "loading" };
}
