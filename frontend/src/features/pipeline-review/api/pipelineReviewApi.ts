import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@/shared/api/mutator";

// OpenAPI is not generated for the new pipeline review checkpoint endpoints yet.

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

export function usePipelineReviewCheckpoint(workspaceId?: number, pipelineJobId?: number) {
  return useQuery({
    queryKey: ["pipeline-review-checkpoint", workspaceId, pipelineJobId],
    enabled: Boolean(workspaceId && pipelineJobId),
    queryFn: () =>
      customFetch<ReviewCheckpointView>(
        `/api/v1/workspaces/${workspaceId}/pipeline-jobs/${pipelineJobId}/review-checkpoint`,
        { method: "GET" },
      ),
  });
}

export function useConfirmPipelineDomain(workspaceId?: number, pipelineJobId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reviewTaskId: number) =>
      customFetch(`/api/v1/workspaces/${workspaceId}/pipeline-jobs/${pipelineJobId}/review-checkpoint/domain-confirmation`, {
        method: "POST",
        body: JSON.stringify({ reviewTaskId }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pipeline-review-checkpoint", workspaceId, pipelineJobId] });
    },
  });
}

export function useSubmitPipelineFeedback(workspaceId?: number, pipelineJobId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisions: Array<{ reviewTaskId: number; decisionType: string }>) =>
      customFetch(`/api/v1/workspaces/${workspaceId}/pipeline-jobs/${pipelineJobId}/review-checkpoint/human-feedback`, {
        method: "POST",
        body: JSON.stringify({ decisions }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pipeline-review-checkpoint", workspaceId, pipelineJobId] });
    },
  });
}
