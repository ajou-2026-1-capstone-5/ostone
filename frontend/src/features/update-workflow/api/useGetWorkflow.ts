import { useQuery } from "@tanstack/react-query";
import { workflowQueryKeys, fetchWorkflow } from "@/entities/workflow";

export function useGetWorkflow(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: workflowQueryKeys.detail(wsId, packId, versionId, workflowId),
    queryFn: () => fetchWorkflow(wsId, packId, versionId, workflowId),
    enabled,
  });
}
