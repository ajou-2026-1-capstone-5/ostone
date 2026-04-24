import { apiClient } from "@/shared/api";
import type { WorkflowDetail, UpdateWorkflowRequest } from "../model/types";

export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (wsId: number, packId: number, versionId: number) =>
    [...workflowKeys.lists(), wsId, packId, versionId] as const,
  details: (wsId: number, packId: number, versionId: number) =>
    [...workflowKeys.all, "detail", wsId, packId, versionId] as const,
  detail: (wsId: number, packId: number, versionId: number, workflowId: number) =>
    [...workflowKeys.details(wsId, packId, versionId), workflowId] as const,
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
