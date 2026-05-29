import { type UseQueryResult } from "@tanstack/react-query";
import { useGetWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { requireApiData, workflowQueryKeys } from "@/shared/api";
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
}: UseGetWorkflowDefinitionParams): UseQueryResult<WorkflowDefinitionDetail, unknown> {
  return useGetWorkflow<WorkflowDefinitionDetail>(workspaceId, packId, versionId, workflowId, {
    query: {
      queryKey: workflowQueryKeys.detail(workspaceId, packId, versionId, workflowId),
      select: (response) =>
        requireApiData<WorkflowDefinitionDetail>(
          response,
          "Workflow 상세 응답을 확인할 수 없습니다.",
        ),
      enabled,
    },
  });
}
