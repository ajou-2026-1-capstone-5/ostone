import { useEffect, useState } from "react";
import { intentApi } from "../api/intentApi";
import { mapApiError } from "./mapApiError";
import type { IntentSummary } from "../../../entities/intent";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";

export type IntentListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: IntentSummary[] };

export function useIntentList(
  wsId: number,
  packId: number,
  versionId: number,
  refreshKey?: number,
): IntentListState {
  const requestKey = `${wsId}:${packId}:${versionId}:${refreshKey ?? 0}`;
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
          const list = unwrapApiResponse<IntentSummary[]>(data) ?? [];
          setState({
            requestKey,
            value: { status: "ready", data: list },
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
