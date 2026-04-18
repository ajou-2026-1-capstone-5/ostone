import { useEffect, useState } from "react";
import { workflowApi } from "../api/workflowApi";
import { ApiRequestError } from "../../../shared/api";
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
  }, [wsId, packId, versionId]);

  return state;
}
