import { useGetWorkflow as useGeneratedGetWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { requireApiData, workflowQueryKeys } from "@/shared/api";
import type { WorkflowDefinitionDetail } from "@/shared/api/generated/zod";

export function useGetWorkflow(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number,
  enabled: boolean,
) {
  return useGeneratedGetWorkflow<WorkflowDefinitionDetail>(wsId, packId, versionId, workflowId, {
    query: {
      queryKey: workflowQueryKeys.detail(wsId, packId, versionId, workflowId),
      select: (response) =>
        requireApiData<WorkflowDefinitionDetail>(
          response,
          "Workflow 상세 응답을 확인할 수 없습니다.",
        ),
      enabled,
    },
  });
}
