import { useEffect, useState } from "react";
import { intentApi } from "../api/intentApi";
import { mapApiError } from "./mapApiError";
import type { IntentSummary } from "../../../entities/intent";

export type IntentListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: IntentSummary[] };

export function useIntentList(wsId: number, packId: number, versionId: number): IntentListState {
  const requestKey = `${wsId}:${packId}:${versionId}`;
  const [state, setState] = useState<{
    requestKey: string;
    value: IntentListState;
  }>({
    requestKey,
    value: { status: "loading" },
  });

  useEffect(() => {
    let cancelled = false;

    intentApi
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
