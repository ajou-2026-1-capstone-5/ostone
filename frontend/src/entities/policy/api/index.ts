import { apiClient } from "@/shared/api";
import type {
  PolicyDefinition,
  PolicySummary,
  UpdatePolicyRequest,
  UpdatePolicyStatusRequest,
} from "../model/types";

export const policyKeys = {
  all: ["policies"] as const,
  lists: () => [...policyKeys.all, "list"] as const,
  list: (workspaceId: number, packId: number, versionId: number) =>
    [...policyKeys.lists(), workspaceId, packId, versionId] as const,
  detail: (workspaceId: number, packId: number, versionId: number, policyId: number) =>
    [...policyKeys.all, "detail", workspaceId, packId, versionId, policyId] as const,
};

const basePath = (workspaceId: number, packId: number, versionId: number) =>
  `/workspaces/${workspaceId}/domain-packs/${packId}/versions/${versionId}/policies`;

export const policyApi = {
  list: (workspaceId: number, packId: number, versionId: number) =>
    apiClient.get<PolicySummary[]>(basePath(workspaceId, packId, versionId)),

  detail: (workspaceId: number, packId: number, versionId: number, policyId: number) =>
    apiClient.get<PolicyDefinition>(`${basePath(workspaceId, packId, versionId)}/${policyId}`),

  update: (
    workspaceId: number,
    packId: number,
    versionId: number,
    policyId: number,
    body: UpdatePolicyRequest,
  ) =>
    apiClient.patch<PolicyDefinition>(
      `${basePath(workspaceId, packId, versionId)}/${policyId}`,
      body,
    ),

  updateStatus: (
    workspaceId: number,
    packId: number,
    versionId: number,
    policyId: number,
    body: UpdatePolicyStatusRequest,
  ) =>
    apiClient.patch<PolicyDefinition>(
      `${basePath(workspaceId, packId, versionId)}/${policyId}/status`,
      body,
    ),
};
