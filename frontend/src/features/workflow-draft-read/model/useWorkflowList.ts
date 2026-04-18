import { useEffect, useState } from "react";
import { workflowApi } from "../api/workflowApi";
import { mapApiError } from "./mapApiError";
import type { WorkflowSummary } from "../../../entities/workflow";

export type WorkflowListState =
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: WorkflowSummary[] };

export function useWorkflowList(
  wsId: number,
  packId: number,
  versionId: number,
): WorkflowListState {
  const [state, setState] = useState<WorkflowListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    workflowApi
      .list(wsId, packId, versionId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState(mapApiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, packId, versionId]);

  return state;
}
