import { useQuery, skipToken } from "@tanstack/react-query";
import type { WorkflowTransitionDetail } from "@/entities/workflow";
import { listTransitions } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";

export function useTransitionList(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  return useQuery<WorkflowTransitionDetail[]>({
    queryKey:
      workflowId != null
        ? (["transitions", wsId, packId, versionId, workflowId] as const)
        : (["transitions", "disabled"] as const),
    queryFn:
      workflowId != null
        ? async () => {
            const res = await listTransitions(wsId, packId, versionId, workflowId);
            return res.data;
          }
        : skipToken,
  });
}
