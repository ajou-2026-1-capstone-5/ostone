import { apiClient } from "../../../shared/api";
import type { WorkflowDetail, WorkflowSummary } from "../../../entities/workflow";

export const workflowApi = {
  list: (wsId: number, packId: number, versionId: number) =>
    apiClient.get<WorkflowSummary[]>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/workflows`,
    ),

  detail: (wsId: number, packId: number, versionId: number, workflowId: number) =>
    apiClient.get<WorkflowDetail>(
      `/workspaces/${wsId}/domain-packs/${packId}/versions/${versionId}/workflows/${workflowId}`,
    ),
};
