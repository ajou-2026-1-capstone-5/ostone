import { useEffect, useState } from "react";
import { workflowApi } from "../api/workflowApi";
import { mapApiError } from "./mapApiError";
import type { WorkflowDetail } from "../../../entities/workflow";

export type WorkflowDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string; httpStatus?: number }
  | { status: "ready"; data: WorkflowDetail };

export function useWorkflowDetail(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
): WorkflowDetailState {
  const [state, setState] = useState<WorkflowDetailState>({ status: "idle" });

  useEffect(() => {
    if (workflowId === null) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    workflowApi
      .detail(wsId, packId, versionId, workflowId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState(mapApiError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, packId, versionId, workflowId]);

  return state;
}
