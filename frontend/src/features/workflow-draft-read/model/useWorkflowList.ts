import { useQuery } from "@tanstack/react-query";
import { workflowQueryKeys } from "../../../entities/workflow";
import type { WorkflowSummary } from "../../../entities/workflow";
import { workflowApi } from "../api/workflowApi";

export function useWorkflowList(wsId: number, packId: number, versionId: number) {
  return useQuery<WorkflowSummary[]>({
    queryKey: workflowQueryKeys.list(wsId, packId, versionId),
    queryFn: () => workflowApi.list(wsId, packId, versionId),
  });
}
