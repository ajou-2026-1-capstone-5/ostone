import type { WorkflowSummary } from "@/entities/workflow";
import { useListWorkflows } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { selectApiList, workflowQueryKeys } from "@/shared/api";

export function useWorkflowList(wsId: number, packId: number, versionId: number) {
  return useListWorkflows<WorkflowSummary[]>(wsId, packId, versionId, undefined, {
    query: {
      queryKey: workflowQueryKeys.list(wsId, packId, versionId),
      select: selectApiList<WorkflowSummary>,
    },
  });
}
