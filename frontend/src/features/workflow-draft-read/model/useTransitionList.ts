import { useQuery } from "@tanstack/react-query";
import { transitionQueryKeys, fetchTransitionList } from "@/entities/workflow";
import type { WorkflowTransitionDetail } from "@/entities/workflow";

export function useTransitionList(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  return useQuery<WorkflowTransitionDetail[]>({
    queryKey: transitionQueryKeys.list(wsId, packId, versionId, workflowId!),
    queryFn: () => fetchTransitionList(wsId, packId, versionId, workflowId!),
    enabled: workflowId != null,
  });
}
