import { useQuery } from "@tanstack/react-query";

import {
  getActionRecommendations as getGeneratedActionRecommendations,
  getKnowledgePackHealth as getGeneratedKnowledgePackHealth,
} from "@/shared/api/generated/endpoints/workspace-dashboard-controller/workspace-dashboard-controller";
import { requireApiData } from "@/shared/api";

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
  sourceLabel: string;
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
    queryFn: async ({ signal }) => {
      const response = await getGeneratedKnowledgePackHealth(workspaceId, {
        signal,
      });
      return requireApiData<WorkspaceDashboardHealth>(
        response as unknown as
          | WorkspaceDashboardHealth
          | { data?: WorkspaceDashboardHealth },
        "워크스페이스 대시보드 건강도 응답을 확인할 수 없습니다.",
      );
    },
  });
}

export async function fetchWorkspaceDashboardActionRecommendations(
  workspaceId: number,
  params: WorkspaceDashboardActionRecommendationParams = {},
  signal?: AbortSignal,
) {
  const response = await getGeneratedActionRecommendations(workspaceId, params, {
    signal,
  });
  return requireApiData<WorkspaceDashboardActionRecommendations>(
    response as unknown as
      | WorkspaceDashboardActionRecommendations
      | { data?: WorkspaceDashboardActionRecommendations },
    "워크스페이스 대시보드 추천 액션 응답을 확인할 수 없습니다.",
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
