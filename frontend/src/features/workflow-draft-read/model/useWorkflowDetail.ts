import { useEffect, useState } from "react";
import { workflowApi } from "../api/workflowApi";
import { ApiRequestError } from "../../../shared/api";
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
  const [state, setState] = useState<WorkflowDetailState>(
    workflowId === null ? { status: "idle" } : { status: "loading" },
  );

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
        if (cancelled) return;
        if (e instanceof ApiRequestError) {
          setState({
            status: "error",
            code: e.code,
            message: e.message,
            httpStatus: e.status,
          });
        } else {
          setState({
            status: "error",
            code: "UNKNOWN_ERROR",
            message: "알 수 없는 오류가 발생했습니다.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, packId, versionId, workflowId]);

  return state;
}
