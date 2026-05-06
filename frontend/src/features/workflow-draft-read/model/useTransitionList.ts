import { useQuery, skipToken } from "@tanstack/react-query";
import { transitionQueryKeys, fetchTransitionList } from "@/entities/workflow";
import type { WorkflowTransitionDetail } from "@/entities/workflow";

export function useTransitionList(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  return useQuery<WorkflowTransitionDetail[]>({
    queryKey:
      workflowId != null
        ? transitionQueryKeys.list(wsId, packId, versionId, workflowId)
        : (["transitions", "disabled"] as const),
    queryFn:
      workflowId != null
        ? () => fetchTransitionList(wsId, packId, versionId, workflowId)
        : skipToken,
  });
}
