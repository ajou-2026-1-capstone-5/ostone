import { useMemo } from "react";
import type { IntentRevisionSummaryState } from "./useIntentRevisionSummary";

export function useIntentRevisionMarkers({
  editingIntentId,
  isDirty,
  summaryState,
}: {
  editingIntentId: number | null;
  isDirty: boolean;
  summaryState: IntentRevisionSummaryState;
}): Record<number, "수정 중" | "수정됨"> {
  return useMemo(() => {
    const markers: Record<number, "수정 중" | "수정됨"> = {};

    if (summaryState.status === "ready") {
      for (const change of summaryState.data.changedIntents) {
        markers[change.intentId] = "수정됨";
      }
    }

    if (editingIntentId !== null && isDirty) {
      markers[editingIntentId] = "수정 중";
    }

    return markers;
  }, [editingIntentId, isDirty, summaryState]);
}
