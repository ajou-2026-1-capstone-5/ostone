import { useQuery } from "@tanstack/react-query";

import { customFetch } from "@/shared/api/mutator";

// OpenAPI is not generated for this dashboard read endpoint yet.

export interface WorkspaceDashboardKnowledgePack {
  packId: number;
  packName: string;
  versionId: number;
  versionNo: number;
  publishedAt?: string | null;
  createdAt?: string | null;
  sourcePipelineJobId?: number | null;
}

export interface WorkspaceDashboardLogUpload {
  datasetId: number;
  datasetKey: string;
  datasetName: string;
  datasetStatus: string;
  uploadedAt?: string | null;
}

export interface WorkspaceDashboardGeneration {
  pipelineJobId: number;
  datasetId?: number | null;
  domainPackId?: number | null;
  status: string;
  requestedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastErrorMessage?: string | null;
}

export interface WorkspaceDashboardHealth {
  activeKnowledgePack?: WorkspaceDashboardKnowledgePack | null;
  lastLogUpload?: WorkspaceDashboardLogUpload | null;
  lastKnowledgePackGeneration?: WorkspaceDashboardGeneration | null;
  pendingReviewCount: number;
}

export interface WorkspaceDashboardActionRecommendation {
  ruleCode: string;
  priority: number;
  title: string;
  description: string;
  evidenceLabel: string;
  evidenceValue: string;
  targetPath: string;
}

export interface WorkspaceDashboardActionRecommendations {
  workspaceId: number;
  periodStart: string;
  periodEnd: string;
  recommendations: WorkspaceDashboardActionRecommendation[];
}

export interface WorkspaceDashboardActionRecommendationParams {
  from?: string;
  to?: string;
}

export const workspaceDashboardHealthKeys = {
  all: ["workspace-dashboard-health"] as const,
  detail: (workspaceId: number) => [...workspaceDashboardHealthKeys.all, workspaceId] as const,
};

export const workspaceDashboardActionRecommendationKeys = {
  all: ["workspace-dashboard-action-recommendations"] as const,
  detail: (workspaceId: number, params: WorkspaceDashboardActionRecommendationParams = {}) =>
    [...workspaceDashboardActionRecommendationKeys.all, workspaceId, params] as const,
};

export function useWorkspaceDashboardHealth(workspaceId: number) {
  return useQuery({
    queryKey: workspaceDashboardHealthKeys.detail(workspaceId),
    queryFn: ({ signal }) =>
      customFetch<WorkspaceDashboardHealth>(
        `/api/v1/workspaces/${workspaceId}/dashboard/knowledge-pack-health`,
        { method: "GET", signal },
      ),
  });
}

export function fetchWorkspaceDashboardActionRecommendations(
  workspaceId: number,
  params: WorkspaceDashboardActionRecommendationParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  const query = searchParams.toString();
  return customFetch<WorkspaceDashboardActionRecommendations>(
    `/api/v1/workspaces/${workspaceId}/dashboard/action-recommendations${query ? `?${query}` : ""}`,
    { method: "GET", signal },
  );
}

export function useWorkspaceDashboardActionRecommendations(
  workspaceId: number,
  params: WorkspaceDashboardActionRecommendationParams = {},
) {
  return useQuery({
    queryKey: workspaceDashboardActionRecommendationKeys.detail(workspaceId, params),
    queryFn: ({ signal }) =>
      fetchWorkspaceDashboardActionRecommendations(workspaceId, params, signal),
  });
}
