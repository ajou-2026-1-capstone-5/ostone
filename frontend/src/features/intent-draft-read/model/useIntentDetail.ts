import { useEffect, useState } from "react";
import { intentApi } from "../api/intentApi";
import { mapApiError } from "./mapApiError";
import type { IntentDetail } from "../../../entities/intent";

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
): IntentDetailState {
  const requestKey = intentId === null ? null : `${wsId}:${packId}:${versionId}:${intentId}`;
  const [state, setState] = useState<{
    requestKey: string | null;
    value: IntentDetailState;
  }>({
    requestKey: null,
    value: { status: "idle" },
  });

  useEffect(() => {
    if (intentId === null) {
      return;
    }

    let cancelled = false;

    intentApi
      .detail(wsId, packId, versionId, intentId)
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
  }, [intentId, packId, requestKey, versionId, wsId]);

  if (requestKey === null) {
    return { status: "idle" };
  }

  return state.requestKey === requestKey ? state.value : { status: "loading" };
}
