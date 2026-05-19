import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { unwrapApiResponse } from "@/shared/api/unwrapApiResponse";
import type { WorkflowDefinitionDetail } from "@/shared/api/generated/zod";

export interface UseGetWorkflowDefinitionParams {
  workspaceId: number;
  packId: number;
  versionId: number;
  workflowId: number;
  enabled: boolean;
}

export function useGetWorkflowDefinition({
  workspaceId,
  packId,
  versionId,
  workflowId,
  enabled,
}: UseGetWorkflowDefinitionParams): UseQueryResult<WorkflowDefinitionDetail> {
  return useQuery<WorkflowDefinitionDetail>({
    queryKey: ["workflows", "detail", workspaceId, packId, versionId, workflowId] as const,
    queryFn: async () => {
      const res = await getWorkflow(workspaceId, packId, versionId, workflowId);
      return (unwrapApiResponse(res) ?? res) as WorkflowDefinitionDetail;
    },
    enabled,
  });
}
