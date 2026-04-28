import { apiClient } from "@/shared/api";
import type { WorkflowDetail, UpdateWorkflowRequest } from "../model/types";

export const workflowQueryKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowQueryKeys.all, "list"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...workflowQueryKeys.lists(), workspaceId, packId, versionId] as const,
  details: () => [...workflowQueryKeys.all, "detail"] as const,
  detail: (
    workspaceId: number,
    packId: number,
    versionId: number,
    workflowId: number,
  ) =>
    [
      ...workflowQueryKeys.details(),
      workspaceId,
      packId,
      versionId,
      workflowId,
    ] as const,
};

export function fetchWorkflow(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number,
) {
  return apiClient.get<WorkflowDetail>(
    `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}`,
  );
}

export function patchWorkflow(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number,
  body: UpdateWorkflowRequest,
) {
  return apiClient.patch<WorkflowDetail>(
    `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}`,
    body,
  );
}
