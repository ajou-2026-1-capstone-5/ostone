import { apiClient } from "@/shared/api";
import type { WorkflowDetail, WorkflowSummary, UpdateWorkflowRequest, WorkflowTransitionDetail } from "../model/types";

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

export function fetchWorkflowList(wsId: number, packId: number, versionId: number) {
  return apiClient.get<WorkflowSummary[]>(
    `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/workflows`,
  );
}

export const transitionQueryKeys = {
  all: ["transitions"] as const,
  lists: () => [...transitionQueryKeys.all, "list"] as const,
  list: (wsId: number, packId: number, versionId: number, workflowId: number) =>
    [...transitionQueryKeys.lists(), wsId, packId, versionId, workflowId] as const,
};

export function fetchTransitionList(
  wsId: number,
  packId: number,
  versionId: number,
  workflowId: number,
) {
  return apiClient.get<WorkflowTransitionDetail[]>(
    `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}/transitions`,
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
