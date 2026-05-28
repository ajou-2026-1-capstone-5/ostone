import type { WorkflowDetail } from "@/entities/workflow";
import { useGetWorkflow } from "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller";
import { requireApiData, workflowQueryKeys } from "@/shared/api";

export function useWorkflowDetail(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number | null,
) {
  const safeWorkflowId = workflowId ?? -1;
  return useGetWorkflow<WorkflowDetail>(wsId, packId, versionId, safeWorkflowId, {
    query: {
      queryKey: workflowQueryKeys.detail(wsId, packId, versionId, safeWorkflowId),
      select: (response) =>
        requireApiData<WorkflowDetail>(response, "Workflow 상세 응답을 확인할 수 없습니다."),
      enabled: workflowId != null,
    },
  });
}
