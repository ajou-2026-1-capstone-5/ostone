import { apiClient } from "@/shared/api";
import type {
  RiskDefinition,
  RiskSummary,
  UpdateRiskRequest,
  UpdateRiskStatusRequest,
} from "../model/types";

export const riskKeys = {
  all: ["risks"] as const,
  lists: () => [...riskKeys.all, "list"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...riskKeys.lists(), workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, riskId: number) =>
    [...riskKeys.all, "detail", workspaceId, packId, versionId, riskId] as const,
};

const basePath = (workspaceId: number, packId: number, versionId: number) =>
  `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/risks`;

export const riskApi = {
  list: (workspaceId: number, packId: number, versionId: number) =>
    apiClient.get<RiskSummary[]>(basePath(workspaceId, packId, versionId)),

  detail: (workspaceId: number, packId: number, versionId: number, riskId: number) =>
    apiClient.get<RiskDefinition>(`${basePath(workspaceId, packId, versionId)}/${riskId}`),

  update: (
    workspaceId: number,
    packId: number,
    versionId: number,
    riskId: number,
    body: UpdateRiskRequest,
  ) =>
    apiClient.patch<RiskDefinition>(
      `${basePath(workspaceId, packId, versionId)}/${riskId}`,
      body,
    ),

  updateStatus: (
    workspaceId: number,
    packId: number,
    versionId: number,
    riskId: number,
    body: UpdateRiskStatusRequest,
  ) =>
    apiClient.patch<RiskDefinition>(
      `${basePath(workspaceId, packId, versionId)}/${riskId}/status`,
      body,
    ),
};
