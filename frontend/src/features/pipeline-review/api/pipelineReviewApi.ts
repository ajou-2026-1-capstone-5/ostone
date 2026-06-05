import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmDomain,
  getCheckpoint,
  submitFeedback,
} from "@/shared/api/generated/endpoints/pipeline-review-controller/pipeline-review-controller";
import { requireApiData } from "@/shared/api";

// 호출은 generated pipeline-review-controller(getCheckpoint/confirmDomain/submitFeedback)에 위임한다.
// 이 wrapper는 (1) 응답 data envelope unwrap, (2) UI가 의존하는 도메인 타입 정규화
// (generated ReviewCheckpointView는 tasks가 optional이고 payload가 loose object라 화면 계약에 부족),
// (3) React Query queryKey/enabled/invalidate 표준화 목적으로만 유지한다.

export interface ReviewTaskPayload {
  candidateId?: string;
  displayName?: string;
  confidence?: number;
  description?: string;
  evidenceTerms?: string[];
  sourceId?: string;
  targetId?: string;
  sourceReviewContext?: ReviewCaseContext;
  targetReviewContext?: ReviewCaseContext;
  sourceSnippet?: string;
  targetSnippet?: string;
  questionText?: string;
  reason?: string;
  reasonLabel?: string;
}

export interface ReviewCaseContext {
  id?: string;
  conversationId?: string;
  summary?: string;
  action?: string;
  object?: string;
  intentType?: string;
  signals?: string[];
  logExcerpt?: string;
  evidenceTurnIds?: string[];
  turns?: Array<{ role?: string; text?: string }>;
}

export interface ReviewTaskView {
  id: number;
  targetType: "DOMAIN_CANDIDATE" | "FEEDBACK_PAIR" | string;
  status: string;
  priority: string;
  title: string;
  payload: ReviewTaskPayload;
}

export interface ReviewCheckpointView {
  pipelineJobId: number;
  pipelineStatus: string;
  reviewKind: "DOMAIN_CONFIRMATION" | "HUMAN_FEEDBACK" | null;
  tasks: ReviewTaskView[];
}

const checkpointQueryKey = (workspaceId?: number, pipelineJobId?: number) =>
  ["pipeline-review-checkpoint", workspaceId, pipelineJobId] as const;

function requirePipelineReviewIds(workspaceId?: number, pipelineJobId?: number) {
  if (workspaceId == null || pipelineJobId == null) {
    throw new Error("workspaceId and pipelineJobId are required");
  }
  return { workspaceId, pipelineJobId };
}

export function usePipelineReviewCheckpoint(workspaceId?: number, pipelineJobId?: number) {
  return useQuery({
    queryKey: checkpointQueryKey(workspaceId, pipelineJobId),
    enabled: workspaceId != null && pipelineJobId != null,
    queryFn: async () => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      const response = await getCheckpoint(ids.workspaceId, ids.pipelineJobId);
      return requireApiData<ReviewCheckpointView>(
        response as unknown as { data?: ReviewCheckpointView },
        "리뷰 체크포인트 응답을 확인할 수 없습니다.",
      );
    },
  });
}

export function useConfirmPipelineDomain(workspaceId?: number, pipelineJobId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewTaskId: number) => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      return confirmDomain(ids.workspaceId, ids.pipelineJobId, { reviewTaskId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: checkpointQueryKey(workspaceId, pipelineJobId),
      });
    },
  });
}

export function useSubmitPipelineFeedback(workspaceId?: number, pipelineJobId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisions: Array<{ reviewTaskId: number; decisionType: string }>) => {
      const ids = requirePipelineReviewIds(workspaceId, pipelineJobId);
      return submitFeedback(ids.workspaceId, ids.pipelineJobId, { decisions });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: checkpointQueryKey(workspaceId, pipelineJobId),
      });
    },
  });
}
