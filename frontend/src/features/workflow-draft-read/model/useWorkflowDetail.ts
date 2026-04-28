import { useQuery } from "@tanstack/react-query";
import { workflowQueryKeys } from "@/entities/workflow";
import type { WorkflowDetail } from "@/entities/workflow";
import { workflowApi } from "../api/workflowApi";

export function useWorkflowDetail(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  return useQuery<WorkflowDetail>({
    queryKey: workflowQueryKeys.detail(wsId, packId, versionId, workflowId!),
    queryFn: () => workflowApi.detail(wsId, packId, versionId, workflowId!),
    enabled: workflowId != null,
  });
}
