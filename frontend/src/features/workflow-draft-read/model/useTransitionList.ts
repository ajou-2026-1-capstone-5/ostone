import type { WorkflowTransitionDetail } from "@/entities/workflow";
import { useListTransitions } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { selectApiList, workflowQueryKeys } from "@/shared/api";

export function useTransitionList(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  const safeWorkflowId = workflowId ?? -1;
  return useListTransitions<WorkflowTransitionDetail[]>(wsId, packId, versionId, safeWorkflowId, {
    query: {
      queryKey: workflowQueryKeys.transitions(wsId, packId, versionId, safeWorkflowId),
      select: selectApiList<WorkflowTransitionDetail>,
      enabled: workflowId != null,
    },
  });
}
